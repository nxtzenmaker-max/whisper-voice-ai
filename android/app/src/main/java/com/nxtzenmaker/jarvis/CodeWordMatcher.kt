package com.nxtzenmaker.jarvis

object CodeWordMatcher {

    /**
     * Intelligently checks if the spoken transcript matches the expected code word.
     * Handles common phonetics and mishearings (e.g. Rox -> Rocs, Rocks, Rock, 7 -> seven, saat).
     */
    fun isCodeWordMatched(transcript: String, expectedCode: String): Boolean {
        val raw = transcript.lowercase().trim()
        if (raw.isEmpty()) return false

        val normalizedTranscript = normalize(raw)
        val normalizedExpected = normalize(expectedCode)

        // 1. Direct contains check
        if (normalizedTranscript.contains(normalizedExpected) ||
            normalizedTranscript.replace(" ", "").contains(normalizedExpected.replace(" ", ""))
        ) {
            return true
        }

        // 2. Default Rox 7 phonetic tolerance
        val hasRox = normalizedTranscript.contains("rox")
        val hasSeven = normalizedTranscript.contains("7")

        if (normalizedExpected.contains("rox") && normalizedExpected.contains("7")) {
            // Both "rox" and "7" present anywhere in the transcript
            if (hasRox && hasSeven) return true
            // If user said "rox" or "rocs" or "rocks" or just "7" / "seven" / "saat"
            if (hasRox || normalizedTranscript == "7") return true
        }

        // 3. If expected is just "rox"
        if (normalizedExpected.contains("rox") && hasRox) {
            return true
        }

        // 4. Token-by-token match for multi-word phrases
        val expTokens = normalizedExpected.split(" ").filter { it.length > 1 }
        if (expTokens.isNotEmpty() && expTokens.any { normalizedTranscript.contains(it) }) {
            return true
        }

        return false
    }

    /**
     * Checks if the transcript contains a shutdown command.
     */
    fun isShutdownCommand(transcript: String): Boolean {
        val lower = transcript.lowercase().trim()
        val shutdownPhrases = listOf(
            "rox close", "rox stop", "rox shutdown",
            "band ho jao", "band ho ja", "so jao",
            "close", "shutdown", "stop", "exit", "shut down",
            "band karo", "band kar do"
        )
        return shutdownPhrases.any { lower.contains(it) }
    }

    private fun normalize(text: String): String {
        return text.lowercase()
            .replace(Regex("[^a-z0-9\\s]"), " ")
            // Common Whisper and speech recognition aliases for "rox"
            .replace(Regex("\\b(rox|rocs|rocks|rock|rok|roxx|raks|ross|brocks|box|fox)\\b"), "rox")
            // Common number words
            .replace(Regex("\\b(seven|saat|sat|sath)\\b"), "7")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
