package com.nxtzenmaker.jarvis

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AudioPlayer(private val context: Context? = null) {

    private var mediaPlayer: MediaPlayer? = null
    private var isPlaying = false

    suspend fun playUrl(
        url: String,
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) = withContext(Dispatchers.Main) {
        stop()

        try {
            val audioManager = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            audioManager?.mode = AudioManager.MODE_NORMAL

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setLegacyStreamType(AudioManager.STREAM_MUSIC)
                        .build()
                )

                // Force output routing to built-in loudspeaker unless user has headphones connected
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

                setDataSource(url)
                setOnPreparedListener { mp ->
                    this@AudioPlayer.isPlaying = true
                    onStart?.invoke()
                    mp.start()
                }
                setOnCompletionListener {
                    this@AudioPlayer.isPlaying = false
                    releasePlayer()
                    onComplete?.invoke()
                }
                setOnErrorListener { _, what, extra ->
                    this@AudioPlayer.isPlaying = false
                    releasePlayer()
                    onError?.invoke("Audio error: what=$what extra=$extra")
                    true
                }
                prepareAsync()
            }
        } catch (e: Exception) {
            isPlaying = false
            releasePlayer()
            onError?.invoke(e.message ?: "Failed to play audio")
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
            isPlaying = false
        }
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
