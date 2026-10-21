package com.nxtzenmaker.jarvis

import android.content.Context

object Prefs {
    private const val PREF_NAME = "rox_assistant_prefs"
    private const val KEY_CODE_WORD = "key_code_word"
    private const val KEY_REQUIRE_CODE = "key_require_code"
    private const val KEY_GROQ_API_KEY = "key_groq_api_key"
    private const val KEY_VOICE_MODEL = "key_voice_model"
    private const val KEY_VOICE_RATE = "key_voice_rate"

    const val DEFAULT_VOICE = "hi-IN-MadhurNeural"
    const val DEFAULT_RATE = "+5%"
    const val DEFAULT_PITCH = "+2Hz"

    fun getVoiceModel(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return sp.getString(KEY_VOICE_MODEL, DEFAULT_VOICE) ?: DEFAULT_VOICE
    }

    fun setVoiceModel(context: Context, voice: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_VOICE_MODEL, voice.trim()).apply()
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
