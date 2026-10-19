package com.nxtzenmaker.jarvis

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class AudioRecorder(private val context: Context) {

    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingJob: Job? = null

    private val recordedShorts = ArrayList<Short>()

    data class RecordingResult(
        val wavFile: File,
        val features: VoiceFeatureExtractor.VoiceFeatures,
        val durationMs: Long
    )

    @SuppressLint("MissingPermission")
    fun startRecording(onAmplitudeUpdate: ((Float) -> Unit)? = null): Boolean {
        val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        val bufferSize = maxOf(minBufferSize, 4096)

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                return false
            }

            recordedShorts.clear()
            audioRecord?.startRecording()
            isRecording = true

            recordingJob = CoroutineScope(Dispatchers.IO).launch {
                val buffer = ShortArray(1024)
                while (isRecording && isActive) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read > 0) {
                        var maxAmp = 0
                        synchronized(recordedShorts) {
                            for (i in 0 until read) {
                                val s = buffer[i]
                                recordedShorts.add(s)
                                val abs = kotlin.math.abs(s.toInt())
                                if (abs > maxAmp) maxAmp = abs
                            }
                        }
                        onAmplitudeUpdate?.invoke((maxAmp / 32768.0f).coerceIn(0f, 1f))
                    }
                }
            }

            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    suspend fun stopRecording(): RecordingResult? = withContext(Dispatchers.IO) {
        if (!isRecording) return@withContext null
        isRecording = false

        recordingJob?.cancelAndJoin()
        recordingJob = null

        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            audioRecord = null
        }

        val samples: ShortArray
        synchronized(recordedShorts) {
            samples = ShortArray(recordedShorts.size)
            for (i in recordedShorts.indices) {
                samples[i] = recordedShorts[i]
            }
        }

        if (samples.isEmpty()) return@withContext null

        val durationMs = (samples.size.toDouble() / sampleRate * 1000.0).toLong()

        // Convert to FloatArray for VoiceFeatureExtractor
        val floatSamples = FloatArray(samples.size)
        for (i in samples.indices) {
            floatSamples[i] = samples[i] / 32768.0f
        }

        // Extract Voiceprint & Pitch
        val features = VoiceFeatureExtractor.extractFeatures(floatSamples, sampleRate)

        // Save to WAV file
        val wavFile = File(context.cacheDir, "recorded_voice_${System.currentTimeMillis()}.wav")
        writeWavFile(wavFile, samples, sampleRate)

        return@withContext RecordingResult(wavFile, features, durationMs)
    }

    fun isCurrentlyRecording(): Boolean = isRecording

    private fun writeWavFile(file: File, samples: ShortArray, sampleRate: Int) {
        val totalAudioLen = (samples.size * 2).toLong()
        val totalDataLen = totalAudioLen + 36
        val byteRate = (sampleRate * 2 * 1).toLong() // 16 bit, 1 channel

        val header = ByteArray(44)
        val bb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN)

        // RIFF header
        bb.put('R'.code.toByte()); bb.put('I'.code.toByte()); bb.put('F'.code.toByte()); bb.put('F'.code.toByte())
        bb.putInt(totalDataLen.toInt())
        bb.put('W'.code.toByte()); bb.put('A'.code.toByte()); bb.put('V'.code.toByte()); bb.put('E'.code.toByte())

        // fmt chunk
        bb.put('f'.code.toByte()); bb.put('m'.code.toByte()); bb.put('t'.code.toByte()); bb.put(' '.code.toByte())
        bb.putInt(16) // Subchunk1Size for PCM
        bb.putShort(1.toShort()) // AudioFormat (1 = PCM)
        bb.putShort(1.toShort()) // NumChannels (1 = Mono)
        bb.putInt(sampleRate)
        bb.putInt(byteRate.toInt())
        bb.putShort(2.toShort()) // BlockAlign (channels * bitsPerSample / 8)
        bb.putShort(16.toShort()) // BitsPerSample

        // data chunk
        bb.put('d'.code.toByte()); bb.put('a'.code.toByte()); bb.put('t'.code.toByte()); bb.put('a'.code.toByte())
        bb.putInt(totalAudioLen.toInt())

        FileOutputStream(file).use { fos ->
            fos.write(header)
            val pcmBytes = ByteArray(samples.size * 2)
            val pcmBb = ByteBuffer.wrap(pcmBytes).order(ByteOrder.LITTLE_ENDIAN)
            for (s in samples) {
                pcmBb.putShort(s)
            }
            fos.write(pcmBytes)
            fos.flush()
        }
    }
}
