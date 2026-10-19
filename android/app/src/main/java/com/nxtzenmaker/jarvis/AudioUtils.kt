package com.nxtzenmaker.jarvis

import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

object AudioUtils {

    fun writeWavFile(file: File, samples: ShortArray, sampleRate: Int = 16000) {
        val totalAudioLen = (samples.size * 2).toLong()
        val totalDataLen = totalAudioLen + 36
        val byteRate = (sampleRate * 2 * 1).toLong()

        val header = ByteArray(44)
        val bb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN)

        // RIFF header
        bb.put('R'.code.toByte()); bb.put('I'.code.toByte()); bb.put('F'.code.toByte()); bb.put('F'.code.toByte())
        bb.putInt(totalDataLen.toInt())
        bb.put('W'.code.toByte()); bb.put('A'.code.toByte()); bb.put('V'.code.toByte()); bb.put('E'.code.toByte())

        // fmt chunk
        bb.put('f'.code.toByte()); bb.put('m'.code.toByte()); bb.put('t'.code.toByte()); bb.put(' '.code.toByte())
        bb.putInt(16)
        bb.putShort(1.toShort()) // PCM
        bb.putShort(1.toShort()) // Mono
        bb.putInt(sampleRate)
        bb.putInt(byteRate.toInt())
        bb.putShort(2.toShort()) // BlockAlign
        bb.putShort(16.toShort()) // 16-bit

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
