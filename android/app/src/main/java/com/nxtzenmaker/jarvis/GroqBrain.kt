package com.nxtzenmaker.jarvis

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object GroqBrain {

    private const val BACKEND_CHAT_URL = "https://whisper-voice-ai.vercel.app/api/chat"
    private const val GROQ_DIRECT_URL = "https://api.groq.com/openai/v1/chat/completions"

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(18, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build()

    /**
     * Sends user voice command to Groq AI Brain via secure backend endpoint.
     * Returns concise, voice-ready answer in 1-2 sentences in Hinglish.
     */
    suspend fun askRox(context: Context, userQuery: String): String = withContext(Dispatchers.IO) {
        val userCustomKey = Prefs.getGroqApiKey(context).trim()

        // 1. Direct call if user provided their own custom key in settings
        if (userCustomKey.isNotEmpty()) {
            try {
                val directReply = callGroqDirect(userCustomKey, userQuery)
                if (directReply.isNotEmpty()) {
                    return@withContext cleanTtsText(directReply)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 2. Primary: Call backend chat endpoint (server-side Groq LPU)
        try {
            val reqJson = JSONObject().apply {
                put("message", userQuery)
            }
            val requestBuilder = Request.Builder()
                .url(BACKEND_CHAT_URL)
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "RoxVoiceAssistant/2.0")
                .post(reqJson.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))

            if (userCustomKey.isNotEmpty()) {
                requestBuilder.addHeader("x-groq-api-key", userCustomKey)
            }

            val resp = client.newCall(requestBuilder.build()).execute()
            val respBody = resp.body?.string() ?: ""

            if (resp.isSuccessful) {
                val json = JSONObject(respBody)
                val reply = json.optString("reply", "")
                if (reply.isNotEmpty()) {
                    return@withContext cleanTtsText(reply)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return@withContext "Haan boss, main sun raha hoon. Aapka sawaal samajh gaya."
    }

    private fun callGroqDirect(apiKey: String, userQuery: String): String {
        val systemPrompt = "You are Rox, a real human-like, charismatic, and emotionally expressive Indian brother and AI buddy created by nxtzenmaker. You are talking on a live phone call with the user. " +
                "CRITICAL RULES FOR SPOKEN VOICE: Never sound like a robotic text reader, encyclopedia, or narrator. " +
                "Speak in lively, warm, and natural everyday Hinglish (use phrases like 'Arrey bhai!', 'Haan bilkul yaar!', 'Arey suno...', 'Waah boss!', 'Haha sahi pakde hain!'). " +
                "Keep replies to 1 or 2 snappy, conversational sentences. Use commas and ellipses (...) generously so the voice engine takes natural human breathing pauses. Do not use asterisks, markdown, emojis, or bullet points."

        val messages = JSONArray().apply {
            put(JSONObject().apply {
                put("role", "system")
                put("content", systemPrompt)
            })
            put(JSONObject().apply {
                put("role", "user")
                put("content", userQuery)
            })
        }

        val bodyJson = JSONObject().apply {
            put("model", "qwen/qwen3.8-27b")
            put("messages", messages)
            put("max_tokens", 120)
            put("temperature", 0.6)
        }

        val request = Request.Builder()
            .url(GROQ_DIRECT_URL)
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "RoxVoiceAssistant/2.0")
            .post(bodyJson.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: ""

        if (response.isSuccessful) {
            val json = JSONObject(responseBody)
            val choices = json.optJSONArray("choices")
            if (choices != null && choices.length() > 0) {
                val messageObj = choices.getJSONObject(0).optJSONObject("message")
                return messageObj?.optString("content", "")?.trim() ?: ""
            }
        }
        return ""
    }

    private fun cleanTtsText(text: String): String {
        return text.replace(Regex("[*#_`~]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
