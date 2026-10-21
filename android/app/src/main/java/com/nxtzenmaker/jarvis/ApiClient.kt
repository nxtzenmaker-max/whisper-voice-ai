package com.nxtzenmaker.jarvis

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class ApiClient(var baseUrl: String = "https://whisper-voice-ai.vercel.app") {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    data class TranscribeResult(
        val success: Boolean,
        val id: String = "",
        val speakerName: String = "",
        val isOwner: Boolean = false,
        val matchPercent: Double = 0.0,
        val pitch: Int = 0,
        val text: String = "",
        val detail: String = "",
        val latencyMs: Long = 0,
        val sampleCount: Int = 0,
        val isNewRegistration: Boolean = false,
        val errorMessage: String? = null
    )

    suspend fun transcribeAndVerify(
        wavFile: File,
        voiceprintJson: String,
        pitch: Int,
        action: String = "identify",
        language: String = "hinglish"
    ): TranscribeResult = withContext(Dispatchers.IO) {
        try {
            val fileBody = wavFile.asRequestBody("audio/wav".toMediaTypeOrNull())

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", wavFile.name, fileBody)
                .addFormDataPart("action", action)
                .addFormDataPart("voiceprint", voiceprintJson)
                .addFormDataPart("pitch", pitch.toString())
                .addFormDataPart("language", language)
                .build()

            val cleanBaseUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanBaseUrl/api/transcribe")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                return@withContext TranscribeResult(
                    success = false,
                    errorMessage = "Server error ${response.code}: $responseBody"
                )
            }

            val json = JSONObject(responseBody)
            return@withContext TranscribeResult(
                success = true,
                id = json.optString("id"),
                speakerName = json.optString("speaker_name", "Unknown"),
                isOwner = json.optBoolean("is_owner", false),
                matchPercent = json.optDouble("match_percent", 0.0),
                pitch = json.optInt("pitch", 0),
                text = json.optString("text", ""),
                detail = json.optString("detail", ""),
                latencyMs = json.optLong("latency_ms", 0),
                sampleCount = json.optInt("sample_count", 0),
                isNewRegistration = json.optBoolean("is_new_registration", false)
            )
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext TranscribeResult(
                success = false,
                errorMessage = e.message ?: "Network error during voice verification"
            )
        }
    }

    fun getTtsAudioUrl(
        text: String,
        voice: String = "hi-IN-MadhurNeural",
        rate: String = "+5%",
        pitch: String = "+2Hz"
    ): String {
        val cleanBaseUrl = baseUrl.trimEnd('/')
        val encodedText = URLEncoder.encode(text, "UTF-8")
        val encodedVoice = URLEncoder.encode(voice, "UTF-8")
        val encodedRate = URLEncoder.encode(rate, "UTF-8")
        val encodedPitch = URLEncoder.encode(pitch, "UTF-8")
        return "$cleanBaseUrl/api/tts?voice=$encodedVoice&rate=$encodedRate&pitch=$encodedPitch&text=$encodedText"
    }

    data class VoiceprintStatus(
        val hasOwner: Boolean,
        val sampleCount: Int,
        val avgPitch: Int?
    )

    suspend fun getVoiceprintStatus(): VoiceprintStatus = withContext(Dispatchers.IO) {
        try {
            val cleanBaseUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanBaseUrl/api/voiceprint")
                .get()
                .build()
            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val json = JSONObject(response.body?.string() ?: "{}")
                return@withContext VoiceprintStatus(
                    hasOwner = json.optBoolean("has_owner", false),
                    sampleCount = json.optInt("sample_count", 0),
                    avgPitch = if (json.has("avg_pitch") && !json.isNull("avg_pitch")) json.getInt("avg_pitch") else null
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return@withContext VoiceprintStatus(false, 0, null)
    }

    suspend fun resetVoiceprint(): Boolean = withContext(Dispatchers.IO) {
        try {
            val cleanBaseUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanBaseUrl/api/voiceprint")
                .delete()
                .build()
            val response = client.newCall(request).execute()
            return@withContext response.isSuccessful
        } catch (e: Exception) {
            return@withContext false
        }
    }

    suspend fun checkHealth(): Boolean = withContext(Dispatchers.IO) {
        try {
            val cleanBaseUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanBaseUrl/api/voiceprint")
                .get()
                .build()
            val response = client.newCall(request).execute()
            return@withContext response.isSuccessful
        } catch (e: Exception) {
            return@withContext false
        }
    }
}
