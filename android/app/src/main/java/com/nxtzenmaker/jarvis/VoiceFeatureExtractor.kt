package com.nxtzenmaker.jarvis

import kotlin.math.*

object VoiceFeatureExtractor {

    private fun hzToMel(hz: Double): Double = 2595.0 * log10(1.0 + hz / 700.0)
    private fun melToHz(mel: Double): Double = 700.0 * (10.0.pow(mel / 2595.0) - 1.0)

    /**
     * Fast YIN Algorithm for accurate fundamental pitch (F0) detection
     */
    fun detectPitchYin(buffer: FloatArray, sampleRate: Int): Int? {
        val minPeriod = floor(sampleRate / 350.0).toInt() // ~45 (up to 350 Hz)
        val maxPeriod = floor(sampleRate / 65.0).toInt()  // ~246 (down to 65 Hz)
        val W = 1000
        if (buffer.size < W + maxPeriod) return null

        val d = FloatArray(maxPeriod + 1)
        for (tau in 0..maxPeriod) {
            var diff = 0f
            for (i in 0 until W) {
                val delta = buffer[i] - buffer[i + tau]
                diff += delta * delta
            }
            d[tau] = diff
        }

        val cmnd = FloatArray(maxPeriod + 1)
        cmnd[0] = 1f
        var runningSum = 0f
        for (tau in 1..maxPeriod) {
            runningSum += d[tau]
            cmnd[tau] = d[tau] / (runningSum / tau)
        }

        var period = -1
        for (tau in minPeriod..maxPeriod) {
            if (cmnd[tau] < 0.20f) {
                var p = tau
                while (p + 1 <= maxPeriod && cmnd[p + 1] < cmnd[p]) {
                    p++
                }
                period = p
                break
            }
        }

        return if (period > 0) Math.round(sampleRate.toFloat() / period) else null
    }

    /**
     * Iterative in-place Radix-2 FFT
     */
    private fun fftIterative(real: FloatArray, imag: FloatArray) {
        val n = real.size
        var j = 0
        for (i in 0 until n - 1) {
            if (i < j) {
                val tr = real[i]; real[i] = real[j]; real[j] = tr
                val ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
            }
            var k = n shr 1
            while (k <= j) {
                j -= k
                k = k shr 1
            }
            j += k
        }

        var l = 2
        while (l <= n) {
            val half = l shr 1
            val ang = -2.0 * Math.PI / l
            val wStepR = cos(ang).toFloat()
            val wStepI = sin(ang).toFloat()
            var i = 0
            while (i < n) {
                var wr = 1.0f
                var wi = 0.0f
                for (k in 0 until half) {
                    val idx1 = i + k
                    val idx2 = i + k + half
                    val tr = wr * real[idx2] - wi * imag[idx2]
                    val ti = wr * imag[idx2] + wi * real[idx2]
                    real[idx2] = real[idx1] - tr
                    imag[idx2] = imag[idx1] - ti
                    real[idx1] += tr
                    imag[idx1] += ti
                    val nextWr = wr * wStepR - wi * wStepI
                    wi = wr * wStepI + wi * wStepR
                    wr = nextWr
                }
                i += l
            }
            l = l shl 1
        }
    }

    data class VoiceFeatures(
        val vector: List<Float>,
        val pitch: Int,
        val vectorJson: String
    )

    /**
     * Extracts 20-band Mel-frequency filterbank vector + Median Pitch from PCM float audio
     */
    fun extractFeatures(channelData: FloatArray, sampleRate: Int = 16000): VoiceFeatures {
        if (channelData.isEmpty()) {
            return VoiceFeatures(emptyList(), 0, "[]")
        }

        // 1. Detect Fundamental Pitch (F0) across voiced chunks
        val pitches = mutableListOf<Int>()
        val frameStep = 3200 // 0.2s step
        var i = 0
        while (i <= channelData.size - 2000) {
            var energy = 0f
            for (k in 0 until 2000) {
                val s = channelData[i + k]
                energy += s * s
            }
            if (energy > 0.05f) {
                val slice = channelData.copyOfRange(i, i + 2000)
                val p = detectPitchYin(slice, sampleRate)
                if (p != null && p in 65..350) {
                    pitches.add(p)
                }
            }
            i += frameStep
        }
        pitches.sort()
        val medianPitch = if (pitches.isNotEmpty()) pitches[pitches.size / 2] else 0

        // 2. Real FFT and 20-band Mel Filterbank
        val N = 512
        val numMelBands = 20
        val melPoints = IntArray(numMelBands + 2)
        val minMel = hzToMel(100.0)
        val maxMel = hzToMel(sampleRate / 2.0)

        for (m in 0 until numMelBands + 2) {
            val hz = melToHz(minMel + (maxMel - minMel) * (m.toDouble() / (numMelBands + 1)))
            melPoints[m] = floor((hz / sampleRate) * N).toInt()
        }

        val melEnergies = FloatArray(numMelBands)
        var framesCount = 0

        var start = 0
        while (start <= channelData.size - N) {
            framesCount++
            val real = FloatArray(N)
            val imag = FloatArray(N)
            for (k in 0 until N) {
                val win = 0.5f * (1.0f - cos(2.0 * Math.PI * k / (N - 1)).toFloat()) // Hann window
                real[k] = channelData[start + k] * win
            }

            fftIterative(real, imag)

            for (m in 0 until numMelBands) {
                val left = melPoints[m]
                val center = melPoints[m + 1]
                val right = melPoints[m + 2]
                var bandEnergy = 0f
                for (k in left until right) {
                    val mag = sqrt(real[k] * real[k] + imag[k] * imag[k])
                    val centerDiff = if (center - left > 0) center - left else 1
                    val rightDiff = if (right - center > 0) right - center else 1
                    val weight = if (k < center) (k - left).toFloat() / centerDiff else (right - k).toFloat() / rightDiff
                    bandEnergy += mag * weight
                }
                melEnergies[m] += bandEnergy
            }
            start += N / 2
        }

        if (framesCount > 0) {
            for (m in 0 until numMelBands) {
                melEnergies[m] /= framesCount
            }
        }

        // L2 Normalize
        var sumSq = 0f
        for (m in 0 until numMelBands) {
            sumSq += melEnergies[m] * melEnergies[m]
        }
        val norm = if (sqrt(sumSq) > 0f) sqrt(sumSq) else 1f
        val vector = melEnergies.map { (round((it / norm) * 10000.0f) / 10000.0f) }

        val jsonBuilder = StringBuilder("[")
        for (idx in vector.indices) {
            jsonBuilder.append(String.format(java.util.Locale.US, "%.4f", vector[idx]))
            if (idx < vector.size - 1) jsonBuilder.append(",")
        }
        jsonBuilder.append("]")

        return VoiceFeatures(vector, medianPitch, jsonBuilder.toString())
    }
}
