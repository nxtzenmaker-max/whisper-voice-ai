package com.nxtzenmaker.jarvis

import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings

object ScreenControlHandler {

    private var isTorchOn = false

    /**
     * Checks if the spoken transcript is a screen or hardware control command.
     * Executes the action on the device and returns the spoken feedback string.
     * Returns null if not a screen/device action.
     */
    fun handleCommand(context: Context, transcript: String): String? {
        val norm = normalize(transcript)
        if (norm.isEmpty()) return null

        val accessibility = RoxAccessibilityService.instance

        // 1. Home Screen
        if (matchesAny(norm, "home", "home screen", "home jao", "ghar jao", "go home", "main screen")) {
            val ok = accessibility?.goHome() ?: false
            if (!ok) {
                val intent = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            }
            return "Ji boss, Home screen par aa gaye!"
        }

        // 2. Back Action
        if (matchesAny(norm, "back", "back jao", "go back", "peeche jao", "peeche karo", "wapas jao")) {
            val ok = accessibility?.goBack() ?: false
            return if (ok) "Back kar diya boss!" else "Back action execute nahi ho paya boss."
        }

        // 3. Recent Apps / Multitask
        if (matchesAny(norm, "recent", "recent apps", "recent apps kholo", "app switcher", "multitask", "apps dikhao")) {
            val ok = accessibility?.openRecents() ?: false
            return if (ok) "Recent apps khol diye boss!" else "Recent apps open nahi ho paya."
        }

        // 4. Notifications Panel
        if (matchesAny(norm, "notification", "notifications", "notification panel", "notification shade", "messages dikhao")) {
            val ok = accessibility?.openNotifications() ?: false
            return if (ok) "Notification panel open kar diya!" else "Notifications open nahi ho paya."
        }

        // 5. Quick Settings
        if (matchesAny(norm, "quick settings", "control center", "toggles kholo", "shortcuts dikhao")) {
            val ok = accessibility?.openQuickSettings() ?: false
            return if (ok) "Quick settings open kar diye boss!" else "Quick settings open nahi ho paya."
        }

        // 6. Screenshot
        if (matchesAny(norm, "screenshot", "screen shot", "screenshot lo", "photo lo screen ki", "screen capture")) {
            val ok = accessibility?.takeScreenshot() ?: false
            return if (ok) "Screenshot le liya boss!" else "Screenshot lene ke liye Accessibility permission zaroori hai boss."
        }

        // 7. Lock Screen / Screen Off
        if (matchesAny(norm, "screen lock", "lock screen", "phone lock karo", "screen band karo", "screen off", "lock karo")) {
            val ok = accessibility?.lockScreen() ?: false
            return if (ok) "Screen lock kar di boss!" else "Screen lock karne ke liye Accessibility permission zaroori hai."
        }

        // 8. Scroll Down
        if (matchesAny(norm, "scroll down", "neeche scroll", "neeche karo", "scroll neeche", "down scroll")) {
            val ok = accessibility?.scrollDown() ?: false
            return if (ok) "Neeche scroll kar diya!" else null
        }

        // 9. Scroll Up
        if (matchesAny(norm, "scroll up", "upar scroll", "upar karo", "scroll upar", "up scroll")) {
            val ok = accessibility?.scrollUp() ?: false
            return if (ok) "Upar scroll kar diya!" else null
        }

        // 10. Torch / Flashlight
        if (matchesAny(norm, "torch on", "torch chalu", "flashlight on", "batti jalao", "light on", "torch jalao")) {
            toggleTorch(context, true)
            return "Torch on kar di boss!"
        }
        if (matchesAny(norm, "torch off", "torch band", "flashlight off", "batti bujhao", "light off", "torch bujhao")) {
            toggleTorch(context, false)
            return "Torch band kar di boss!"
        }

        // 11. Volume Controls
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        if (matchesAny(norm, "volume up", "volume badhao", "aawaz badhao", "aawaaz badhao", "sound badhao")) {
            audioManager?.adjustVolume(AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
            return "Volume badha diya boss!"
        }
        if (matchesAny(norm, "volume down", "volume kam karo", "aawaz kam karo", "aawaaz kam karo", "sound kam karo")) {
            audioManager?.adjustVolume(AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
            return "Volume kam kar diya!"
        }
        if (matchesAny(norm, "mute", "silent karo", "aawaz band karo", "aawaaz band karo")) {
            audioManager?.adjustVolume(AudioManager.ADJUST_MUTE, AudioManager.FLAG_SHOW_UI)
            return "Volume mute kar diya boss!"
        }

        // 12. App Launchers ("WhatsApp kholo", "YouTube chalao", etc.)
        val appReply = launchAppIfMatched(context, norm)
        if (appReply != null) {
            return appReply
        }

        return null
    }

    private fun launchAppIfMatched(context: Context, norm: String): String? {
        val appKeywords = listOf("kholo", "open", "chalao", "start", "laga do", "chalu karo")
        val isAppIntent = appKeywords.any { norm.contains(it) }
        if (!isAppIntent) return null

        // Well-known popular app package mappings
        val knownApps = mapOf(
            "whatsapp" to listOf("com.whatsapp", "WhatsApp"),
            "youtube" to listOf("com.google.android.youtube", "YouTube"),
            "camera" to listOf("CAMERA", "Camera"),
            "settings" to listOf("SETTINGS", "Settings"),
            "chrome" to listOf("com.android.chrome", "Google Chrome"),
            "browser" to listOf("com.android.chrome", "Browser"),
            "instagram" to listOf("com.instagram.android", "Instagram"),
            "calculator" to listOf("com.google.android.calculator", "Calculator"),
            "photos" to listOf("com.google.android.apps.photos", "Photos"),
            "gallery" to listOf("com.google.android.apps.photos", "Gallery"),
            "dialer" to listOf("DIALER", "Phone"),
            "phone" to listOf("DIALER", "Phone"),
            "call" to listOf("DIALER", "Phone"),
            "maps" to listOf("com.google.android.apps.maps", "Google Maps"),
            "telegram" to listOf("org.telegram.messenger", "Telegram"),
            "play store" to listOf("com.android.vending", "Google Play Store")
        )

        for ((key, pair) in knownApps) {
            if (norm.contains(key)) {
                val pkgOrSpecial = pair[0]
                val appName = pair[1]

                when (pkgOrSpecial) {
                    "CAMERA" -> {
                        val intent = Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        try {
                            context.startActivity(intent)
                            return "Camera open kar diya boss!"
                        } catch (_: Exception) {}
                    }
                    "SETTINGS" -> {
                        val intent = Intent(Settings.ACTION_SETTINGS).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        try {
                            context.startActivity(intent)
                            return "Settings open kar di boss!"
                        } catch (_: Exception) {}
                    }
                    "DIALER" -> {
                        val intent = Intent(Intent.ACTION_DIAL).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        try {
                            context.startActivity(intent)
                            return "Phone dialer khol diya boss!"
                        } catch (_: Exception) {}
                    }
                    else -> {
                        val pm = context.packageManager
                        val launchIntent = pm.getLaunchIntentForPackage(pkgOrSpecial)
                        if (launchIntent != null) {
                            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            context.startActivity(launchIntent)
                            return "Ji boss, $appName open kar raha hoon!"
                        }
                    }
                }
            }
        }

        // Generic app search by installed app label
        try {
            val pm = context.packageManager
            val installedApps = pm.getInstalledApplications(0)
            for (appInfo in installedApps) {
                val label = pm.getApplicationLabel(appInfo).toString().lowercase()
                if (label.length > 2 && norm.contains(label)) {
                    val launchIntent = pm.getLaunchIntentForPackage(appInfo.packageName)
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(launchIntent)
                        val niceName = pm.getApplicationLabel(appInfo).toString()
                        return "Ji boss, $niceName open kar raha hoon!"
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return null
    }

    private fun toggleTorch(context: Context, enable: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
                val cameraId = cameraManager?.cameraIdList?.firstOrNull()
                if (cameraId != null) {
                    cameraManager.setTorchMode(cameraId, enable)
                    isTorchOn = enable
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun matchesAny(text: String, vararg phrases: String): Boolean {
        return phrases.any { text.contains(it) || text == it }
    }

    private fun normalize(text: String): String {
        return text.lowercase()
            .replace(Regex("[^a-z0-9\\s\u0900-\u097F]"), " ")
            // Common Devanagari equivalents
            .replace("होम", "home")
            .replace("बैक", "back")
            .replace("स्क्रीनशॉट", "screenshot")
            .replace("लॉक", "lock")
            .replace("टॉर्च", "torch")
            .replace("आवाज़", "aawaz")
            .replace("वॉल्यूम", "volume")
            .replace("खोलो", "kholo")
            .replace("चलाओ", "chalao")
            .replace("बंद", "band")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
