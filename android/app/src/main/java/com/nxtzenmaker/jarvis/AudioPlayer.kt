package com.nxtzenmaker.jarvis

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class AudioPlayer(private val context: Context? = null) {

    private var mediaPlayer: MediaPlayer? = null
    private var isPlaying = false
    private var currentPlayingFile: File? = null

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(6, TimeUnit.SECONDS)
        .build()

    /**
     * Synthesizes and plays speech using the best available pipeline:
     * 1. Ultra-emotional direct ElevenLabs API (Turbo v2.5 / Multilingual v2) if configured.
     * 2. Edge-TTS neural server proxy fallback.
     * 3. Dispatches callbacks for start, completion, and fallback handling.
     */
    suspend fun playSpeech(
        text: String,
        voice: String,
        elevenApiKey: String = "",
        baseUrl: String = "https://whisper-voice-ai.vercel.app",
        rate: String = "+5%",
        pitch: String = "+2Hz",
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) {
        stop()

        // 1. Direct ElevenLabs synthesis (Ultra-emotional & low latency ~240ms)
        if (elevenApiKey.isNotBlank() && Prefs.isElevenLabsVoice(voice)) {
            val voiceId = Prefs.getElevenLabsVoiceId(voice)
            val success = playElevenLabs(text, voiceId, elevenApiKey, onStart, onComplete, onError)
            if (success) return
        }

        // 2. Seamless fallback: Edge-TTS via server proxy
        val edgeVoice = if (voice.startsWith("hi-") || voice.startsWith("en-")) voice else "hi-IN-MadhurNeural"
        val cleanBaseUrl = baseUrl.trimEnd('/')
        val encodedText = URLEncoder.encode(text, "UTF-8")
        val encodedVoice = URLEncoder.encode(edgeVoice, "UTF-8")
        val encodedRate = URLEncoder.encode(rate, "UTF-8")
        val encodedPitch = URLEncoder.encode(pitch, "UTF-8")
        val fallbackUrl = "$cleanBaseUrl/api/tts?voice=$encodedVoice&rate=$encodedRate&pitch=$encodedPitch&text=$encodedText"

        playUrl(fallbackUrl, onStart, onComplete, onError)
    }

    /**
     * Synthesizes speech directly against ElevenLabs API for maximum emotional depth and zero intermediary latency.
     */
    suspend fun playElevenLabs(
        text: String,
        voiceId: String,
        apiKey: String,
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ): Boolean = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) return@withContext false

        val cleanText = text
            .replace(Regex("[*#_`~]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()

        if (cleanText.isBlank()) return@withContext false

        try {
            val jsonBody = JSONObject().apply {
                put("text", cleanText)
                put("model_id", "eleven_turbo_v2_5")
                val voiceSettings = JSONObject().apply {
                    put("stability", 0.5)
                    put("similarity_boost", 0.8)
                    put("style", 0.15)
                    put("use_speaker_boost", true)
                }
                put("voice_settings", voiceSettings)
            }

            val request = Request.Builder()
                .url("https://api.elevenlabs.io/v1/text-to-speech/$voiceId?output_format=mp3_44100_128")
                .addHeader("xi-api-key", apiKey)
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "audio/mpeg")
                .post(jsonBody.toString().toRequestBody("application/json".toMediaTypeOrNull()))
                .build()

            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext false
            }

            val bodyBytes = response.body?.bytes()
            if (bodyBytes == null || bodyBytes.isEmpty()) {
                return@withContext false
            }

            val cacheDir = context?.cacheDir ?: File("/data/local/tmp")
            val tempFile = File(cacheDir, "tts_eleven_${System.currentTimeMillis()}.mp3")
            FileOutputStream(tempFile).use { fos ->
                fos.write(bodyBytes)
                fos.flush()
            }

            currentPlayingFile = tempFile
            playLocalFile(tempFile, onStart, onComplete, onError)
            return@withContext true
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext false
        }
    }

    /**
     * Downloads TTS audio to a local cache file first, then plays via MediaPlayer.
     */
    suspend fun playUrl(
        url: String,
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) {
        stop()

        val localFile = withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url(url)
                    .addHeader("User-Agent", "RoxAudioPlayer/2.6")
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
        playLocalFile(localFile, onStart, onComplete, onError)
    }

    private suspend fun playLocalFile(
        localFile: File,
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) = withContext(Dispatchers.Main) {
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
                prepare()

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
