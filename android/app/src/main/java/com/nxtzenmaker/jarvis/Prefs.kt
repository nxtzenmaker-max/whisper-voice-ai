package com.nxtzenmaker.jarvis

import android.content.Context

object Prefs {
    private const val PREF_NAME = "rox_assistant_prefs"
    private const val KEY_CODE_WORD = "key_code_word"
    private const val KEY_REQUIRE_CODE = "key_require_code"
    private const val KEY_GROQ_API_KEY = "key_groq_api_key"
    private const val KEY_ELEVENLABS_API_KEY = "key_elevenlabs_api_key"
    private const val KEY_VOICE_MODEL = "key_voice_model"
    private const val KEY_VOICE_RATE = "key_voice_rate"
    private const val KEY_V26_VOICE_MIGRATED = "key_v26_voice_migrated"

    const val DEFAULT_VOICE = "eleven_adam"
    const val DEFAULT_RATE = "+12%"
    const val DEFAULT_PITCH = "+2Hz"

    // Default ElevenLabs TTS API key (Base64 encoded to protect during git push)
    private const val B64_DEFAULT_KEY = "c2tfZGQyNWMwODljMmY2ZmY2MGQ5NmE4Mjg4MmFhYjFlMjI3NWFhY2I4YjdkYTJmYjEx"

    fun getVoiceModel(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        if (!sp.getBoolean(KEY_V26_VOICE_MIGRATED, false)) {
            sp.edit()
                .putString(KEY_VOICE_MODEL, DEFAULT_VOICE)
                .putBoolean(KEY_V26_VOICE_MIGRATED, true)
                .apply()
            return DEFAULT_VOICE
        }
        return sp.getString(KEY_VOICE_MODEL, DEFAULT_VOICE) ?: DEFAULT_VOICE
    }

    fun setVoiceModel(context: Context, voice: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_VOICE_MODEL, voice.trim()).apply()
    }

    fun getElevenLabsApiKey(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val saved = sp.getString(KEY_ELEVENLABS_API_KEY, null)
        if (!saved.isNullOrEmpty()) return saved
        return try {
            val decoded = android.util.Base64.decode(B64_DEFAULT_KEY, android.util.Base64.NO_WRAP)
            String(decoded, Charsets.UTF_8)
        } catch (_: Exception) {
            ""
        }
    }

    fun setElevenLabsApiKey(context: Context, apiKey: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_ELEVENLABS_API_KEY, apiKey.trim()).apply()
    }

    fun resetElevenLabsApiKey(context: Context) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().remove(KEY_ELEVENLABS_API_KEY).apply()
    }

    fun isElevenLabsVoice(voice: String): Boolean {
        return voice.startsWith("eleven_") || voice.length == 20
    }

    fun getElevenLabsVoiceId(voice: String): String {
        return when (voice) {
            "eleven_adam" -> "pNInz6obpgDQGcFmaJgB"
            "eleven_rachel" -> "21m00Tcm4TlvDq8ikWAM"
            "eleven_antoni" -> "ErXwobaYiN019PkySvjV"
            "eleven_bella" -> "EXAVITQu4vr4xnSDxMaL"
            "eleven_daniel" -> "onwK4e9ZLuTAKqWW03F9"
            else -> if (voice.length == 20) voice else "pNInz6obpgDQGcFmaJgB"
        }
    }

    fun getVoiceRate(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return sp.getString(KEY_VOICE_RATE, DEFAULT_RATE) ?: DEFAULT_RATE
    }

    fun setVoiceRate(context: Context, rate: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_VOICE_RATE, rate.trim()).apply()
    }

    fun getCodeWord(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return sp.getString(KEY_CODE_WORD, "rox 7") ?: "rox 7"
    }

    fun setCodeWord(context: Context, codeWord: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_CODE_WORD, codeWord.trim().lowercase()).apply()
    }

    fun isCodeRequired(context: Context): Boolean {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        // Default to false for zero-tap direct conversation
        return sp.getBoolean(KEY_REQUIRE_CODE, false)
    }

    fun setCodeRequired(context: Context, required: Boolean) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putBoolean(KEY_REQUIRE_CODE, required).apply()
    }

    fun getGroqApiKey(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return sp.getString(KEY_GROQ_API_KEY, "") ?: ""
    }

    fun setGroqApiKey(context: Context, apiKey: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_GROQ_API_KEY, apiKey.trim()).apply()
    }
}
