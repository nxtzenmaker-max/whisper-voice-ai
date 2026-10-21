package com.nxtzenmaker.jarvis

object CodeWordMatcher {

    /**
     * Intelligently checks if the spoken transcript matches the expected code word or wake word.
     * Handles common phonetics and mishearings (e.g. Rox -> Rocs, Rocks, Rock, 7 -> seven, saat).
     */
    fun isCodeWordMatched(transcript: String, expectedCode: String): Boolean {
        val raw = transcript.lowercase().trim()
        if (raw.isEmpty()) return false

        // Direct wake command check (e.g. "Rox on", "Rox wake up", "Rox start")
        if (isWakeCommand(raw)) {
            return true
        }

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
     * Checks if the transcript contains a wake/turn-on command (e.g. "Rox on", "Rox start", "Rox chalu").
     */
    fun isWakeCommand(transcript: String): Boolean {
        val norm = normalize(transcript)
        val wakePhrases = listOf(
            "rox on", "rox start", "rox wake", "rox wake up",
            "rox chalu", "rox chalu ho jao", "rox suno", "rox 7",
            "turn on rox", "chalu ho jao", "wake up rox", "wake up"
        )
        return wakePhrases.any { norm.contains(it) } || norm == "rox on" || norm == "on"
    }

    /**
     * Checks if the transcript contains a shutdown/turn-off command (e.g. "Rox off", "Rox stop", "band ho jao").
     */
    fun isShutdownCommand(transcript: String): Boolean {
        val norm = normalize(transcript)
        val shutdownPhrases = listOf(
            "rox off", "rox of", "rox stop", "rox close", "rox shutdown",
            "rox shut down", "rox sleep", "rox chup", "rox band",
            "band ho jao", "band ho ja", "band karo", "band kar do", "band ho",
            "so jao", "so ja", "chup ho jao", "chup raho",
            "turn off rox", "turn off", "shutdown", "exit", "quit",
            "alvida", "bye rox", "bye bye"
        )
        return shutdownPhrases.any { norm.contains(it) } || norm == "rox off" || norm == "off"
    }

    fun normalize(text: String): String {
        return text.lowercase()
            .replace(Regex("[^a-z0-9\\s]"), " ")
            // Common Whisper and speech recognition aliases for "rox"
            .replace(Regex("\\b(rox|rocs|rocks|rock|rok|roxx|raks|ross|brocks|box|fox|roks)\\b"), "rox")
            // Common number words
            .replace(Regex("\\b(seven|saat|sat|sath)\\b"), "7")
            // Treat "of" after "rox" as "off"
            .replace(Regex("\\brox of\\b"), "rox off")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
