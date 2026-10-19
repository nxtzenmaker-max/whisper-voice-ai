package com.nxtzenmaker.jarvis

import android.media.AudioAttributes
import android.media.MediaPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AudioPlayer {

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
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .build()
                )
                setDataSource(url)
                setOnPreparedListener { mp ->
                    isPlaying = true
                    onStart?.invoke()
                    mp.start()
                }
                setOnCompletionListener {
                    isPlaying = false
                    releasePlayer()
                    onComplete?.invoke()
                }
                setOnErrorListener { _, what, extra ->
                    isPlaying = false
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
