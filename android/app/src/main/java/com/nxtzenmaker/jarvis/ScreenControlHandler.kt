package com.nxtzenmaker.jarvis

import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Settings
import java.net.URLEncoder

object ScreenControlHandler {

    private var isTorchOn = false

    /**
     * Checks if the spoken transcript is a screen, app, or WhatsApp voice command.
     * Executes the action on the device and returns the spoken feedback string.
     * Returns null if not a recognized control action.
     */
    fun handleCommand(context: Context, transcript: String): String? {
        val norm = normalize(transcript)
        if (norm.isEmpty()) return null

        val accessibility = RoxAccessibilityService.instance

        // 0. WhatsApp Voice Messaging ("WhatsApp par [Number/Name] ko message bhejo [Message]")
        val waReply = handleWhatsAppMessaging(context, transcript, norm)
        if (waReply != null) {
            return waReply
        }

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

    /**
     * Handles WhatsApp Voice Messaging:
     * - Parses direct phone numbers (e.g. 9876543210 or +91...)
     * - Parses contact names and resolves them via ContactsProvider
     * - Extracts the message body
     * - Opens WhatsApp chat and auto-clicks Send via AccessibilityService
     */
    private fun handleWhatsAppMessaging(context: Context, raw: String, norm: String): String? {
        val mentionsWhatsApp = norm.contains("whatsapp") || norm.contains("व्हाट्सएप") || norm.contains("व्हाट्सऐप")
        val hasMessageAction = listOf("message", "msg", "bolo", "kehna", "send", "text", "भेजो", "करो", "कहो", "लिखो")
            .any { norm.contains(it) }

        if (!mentionsWhatsApp || !hasMessageAction) {
            return null
        }

        // Case 1: Direct Phone Number (10 to 12 digits, optional leading +)
        val phoneRegex = Regex("(\\+?\\d{10,12})")
        val phoneMatch = phoneRegex.find(raw)

        if (phoneMatch != null) {
            val phoneStr = phoneMatch.value
            val cleanDigits = phoneStr.replace(Regex("[^0-9]"), "")
            val cleanPhone = if (cleanDigits.length == 10) "91$cleanDigits" else cleanDigits

            // Extract message: everything after the phone number
            val textAfterPhone = raw.substring(phoneMatch.range.last + 1).trim()
            val message = cleanMessagePrefix(textAfterPhone).ifBlank { "Hello!" }

            return sendWhatsAppDirect(context, cleanPhone, phoneStr, message)
        }

        // Case 2: Contact Name (e.g. "whatsapp par rahul ko message bhejo kal aana")
        val namePattern = Regex("whatsapp\\s+(?:par|pe|mein)?\\s*([a-zA-Z\u0900-\u097F\\s]{2,25})\\s+ko\\s+(?:message|msg|bolo|send|text)?\\s*(.*)", RegexOption.IGNORE_CASE)
        val nameMatch = namePattern.find(raw)

        if (nameMatch != null) {
            val contactName = nameMatch.groupValues[1].trim()
            val textPart = nameMatch.groupValues[2].trim()
            val message = cleanMessagePrefix(textPart).ifBlank { "Hello!" }

            val resolvedPhone = findContactPhoneNumber(context, contactName)
            if (resolvedPhone != null) {
                val cleanDigits = resolvedPhone.replace(Regex("[^0-9]"), "")
                val cleanPhone = if (cleanDigits.length == 10) "91$cleanDigits" else cleanDigits
                return sendWhatsAppDirect(context, cleanPhone, contactName, message)
            } else {
                return "Boss, contacts me '$contactName' ka number nahi mila. Aap direct number bol kar message bhej sakte hain jaise: 'WhatsApp par 9876543210 ko message bhejo'."
            }
        }

        return null
    }

    private fun cleanMessagePrefix(text: String): String {
        var t = text.trim()
        val prefixes = listOf(
            "ko message bhejo", "ko message karo", "ko text bhejo", "ko text karo",
            "ko bolo", "ko kehna", "ko likho", "message bhejo", "message karo",
            "bolo", "send", "text", "ki", ":"
        )
        for (p in prefixes) {
            if (t.lowercase().startsWith(p)) {
                t = t.substring(p.length).trim()
            }
        }
        return t.removePrefix(":").removePrefix("-").trim()
    }

    private fun sendWhatsAppDirect(context: Context, cleanPhone: String, displayName: String, message: String): String {
        try {
            val encodedMsg = URLEncoder.encode(message, "UTF-8")
            val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleanPhone&text=$encodedMsg")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage("com.whatsapp")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }

            // Trigger auto-send button click in AccessibilityService
            RoxAccessibilityService.instance?.scheduleWhatsAppAutoSend()

            context.startActivity(intent)
            return "Ji boss, $displayName ko WhatsApp par message bhej diya!"
        } catch (e: Exception) {
            e.printStackTrace()
            // Generic browser/WhatsApp fallback
            try {
                val encodedMsg = URLEncoder.encode(message, "UTF-8")
                val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleanPhone&text=$encodedMsg")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                return "Ji boss, $displayName ke liye WhatsApp chat open kar di hai!"
            } catch (_: Exception) {
                return "WhatsApp open nahi ho paya boss. Please check karein ki phone me WhatsApp installed hai."
            }
        }
    }

    private fun findContactPhoneNumber(context: Context, nameQuery: String): String? {
        try {
            val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            )
            val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?"
            val selectionArgs = arrayOf("%$nameQuery%")

            context.contentResolver.query(uri, projection, selection, selectionArgs, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val numberIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    if (numberIdx != -1) {
                        return cursor.getString(numberIdx)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    private fun launchAppIfMatched(context: Context, norm: String): String? {
        val appKeywords = listOf("kholo", "open", "chalao", "start", "laga do", "chalu karo")
        val isAppIntent = appKeywords.any { norm.contains(it) }
        if (!isAppIntent) return null

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
            .replace("व्हाट्सएप", "whatsapp")
            .replace("व्हाट्सऐप", "whatsapp")
            .replace("भेजो", "bhejo")
            .replace("बोलो", "bolo")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
