package com.nxtzenmaker.jarvis

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class AudioPlayer(private val context: Context? = null) {

    private var mediaPlayer: MediaPlayer? = null
    private var isPlaying = false
    private var currentPlayingFile: File? = null

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(6, TimeUnit.SECONDS)
        .writeTimeout(4, TimeUnit.SECONDS)
        .build()

    /**
     * Downloads TTS audio to a local cache file first, then plays via MediaPlayer.
     * This avoids Android's slow/hanging NuPlayer network buffering and guarantees instant playback.
     */
    suspend fun playUrl(
        url: String,
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) {
        stop()

        // 1. Download audio file in IO dispatcher with strict timeout
        val localFile = withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url(url)
                    .addHeader("User-Agent", "RoxAudioPlayer/2.3")
                    .build()

                val response = httpClient.newCall(request).execute()
                if (!response.isSuccessful) {
                    return@withContext null
                }

                val bodyBytes = response.body?.bytes()
                if (bodyBytes == null || bodyBytes.isEmpty()) {
                    return@withContext null
                }

                val cacheDir = context?.cacheDir ?: File("/data/local/tmp")
                val tempFile = File(cacheDir, "tts_rox_${System.currentTimeMillis()}.mp3")
                FileOutputStream(tempFile).use { fos ->
                    fos.write(bodyBytes)
                    fos.flush()
                }
                tempFile
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }

        if (localFile == null || !localFile.exists() || localFile.length() == 0L) {
            withContext(Dispatchers.Main) {
                onError?.invoke("Failed to fetch audio stream")
            }
            return
        }

        currentPlayingFile = localFile

        // 2. Play local file on Main dispatcher (instant synchronous prepare, < 5ms)
        withContext(Dispatchers.Main) {
            try {
                val audioManager = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                audioManager?.mode = AudioManager.MODE_NORMAL

                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                            .setLegacyStreamType(AudioManager.STREAM_MUSIC)
                            .build()
                    )

                    // Output routing to built-in loudspeaker unless user has headphones
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioManager != null) {
                        try {
                            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
                            val hasHeadphones = devices.any {
                                it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                                it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                            }
                            if (!hasHeadphones) {
                                val speaker = devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                                if (speaker != null) {
                                    preferredDevice = speaker
                                }
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    setDataSource(localFile.absolutePath)
                    prepare() // Synchronous prepare on local file is instantaneous (<5ms)

                    this@AudioPlayer.isPlaying = true
                    onStart?.invoke()

                    setOnCompletionListener {
                        this@AudioPlayer.isPlaying = false
                        releasePlayer()
                        cleanUpTempFile()
                        onComplete?.invoke()
                    }

                    setOnErrorListener { _, what, extra ->
                        this@AudioPlayer.isPlaying = false
                        releasePlayer()
                        cleanUpTempFile()
                        onError?.invoke("Audio error: what=$what extra=$extra")
                        true
                    }

                    start()
                }
            } catch (e: Exception) {
                isPlaying = false
                releasePlayer()
                cleanUpTempFile()
                onError?.invoke(e.message ?: "Failed to play audio")
            }
        }
    }

    fun stop() {
        try {
            if (mediaPlayer?.isPlaying == true) {
                mediaPlayer?.stop()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            releasePlayer()
            cleanUpTempFile()
            isPlaying = false
        }
    }

    private fun cleanUpTempFile() {
        try {
            currentPlayingFile?.delete()
        } catch (_: Exception) {}
        currentPlayingFile = null
    }

    private fun releasePlayer() {
        try {
            mediaPlayer?.reset()
            mediaPlayer?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            mediaPlayer = null
        }
    }

    fun isPlayingAudio(): Boolean = isPlaying
}
