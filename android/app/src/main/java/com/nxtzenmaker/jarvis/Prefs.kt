package com.nxtzenmaker.jarvis

import android.content.Context

object Prefs {
    private const val PREF_NAME = "rox_assistant_prefs"
    private const val KEY_CODE_WORD = "key_code_word"

    fun getCodeWord(context: Context): String {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return sp.getString(KEY_CODE_WORD, "rox 7") ?: "rox 7"
    }

    fun setCodeWord(context: Context, codeWord: String) {
        val sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        sp.edit().putString(KEY_CODE_WORD, codeWord.trim().lowercase()).apply()
    }
}
