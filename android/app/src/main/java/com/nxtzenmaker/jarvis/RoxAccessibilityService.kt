package com.nxtzenmaker.jarvis

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.Intent
import android.graphics.Path
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class RoxAccessibilityService : AccessibilityService() {

    companion object {
        var instance: RoxAccessibilityService? = null
            private set
    }

    private val volumeDownPressTimes = mutableListOf<Long>()
    private val REQUIRED_PRESSES = 3
    private val TIME_WINDOW_MS = 1500L

    @Volatile
    private var pendingWhatsAppAutoSend = false
    private var whatsAppAutoSendStartTime = 0L

    fun scheduleWhatsAppAutoSend() {
        pendingWhatsAppAutoSend = true
        whatsAppAutoSendStartTime = System.currentTimeMillis()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) instance = null
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!pendingWhatsAppAutoSend) return

        if (System.currentTimeMillis() - whatsAppAutoSendStartTime > 8000L) {
            pendingWhatsAppAutoSend = false
            return
        }

        val root = rootInActiveWindow ?: return
        val pkg = root.packageName?.toString() ?: ""
        if (pkg.contains("whatsapp")) {
            // Strategy 1: Find by view ID 'com.whatsapp:id/send'
            val sendById = root.findAccessibilityNodeInfosByViewId("com.whatsapp:id/send")
            if (sendById.isNotEmpty()) {
                val btn = sendById.first()
                if (btn.isClickable) {
                    btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    pendingWhatsAppAutoSend = false
                    return
                }
            }

            // Strategy 2: Find by description or text
            val sendByDesc = mutableListOf<AccessibilityNodeInfo>()
            findSendNode(root, sendByDesc)
            if (sendByDesc.isNotEmpty()) {
                for (node in sendByDesc) {
                    if (node.isClickable) {
                        node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        pendingWhatsAppAutoSend = false
                        return
                    } else {
                        var parent = node.parent
                        while (parent != null) {
                            if (parent.isClickable) {
                                parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                                pendingWhatsAppAutoSend = false
                                return
                            }
                            parent = parent.parent
                        }
                    }
                }
            }
        }
    }

    private fun findSendNode(node: AccessibilityNodeInfo?, result: MutableList<AccessibilityNodeInfo>) {
        if (node == null) return
        val desc = node.contentDescription?.toString()?.lowercase() ?: ""
        val text = node.text?.toString()?.lowercase() ?: ""
        val viewId = node.viewIdResourceName?.lowercase() ?: ""

        if (viewId.contains("send") || desc == "send" || desc.contains("भेजें") || text == "send" || text.contains("भेजें")) {
            result.add(node)
            return
        }

        for (i in 0 until node.childCount) {
            findSendNode(node.getChild(i), result)
        }
    }

    override fun onInterrupt() {
        // Not used
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN && event.action == KeyEvent.ACTION_DOWN) {
            val now = System.currentTimeMillis()
            volumeDownPressTimes.add(now)

            // Keep only recent presses within TIME_WINDOW_MS
            while (volumeDownPressTimes.isNotEmpty() && now - volumeDownPressTimes[0] > TIME_WINDOW_MS) {
                volumeDownPressTimes.removeAt(0)
            }

            if (volumeDownPressTimes.size >= REQUIRED_PRESSES) {
                volumeDownPressTimes.clear()
                vibrateFeedback()
                val intent = Intent(applicationContext, RoxTrampolineActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                startActivity(intent)
                return true // Consume event
            }
        }
        return super.onKeyEvent(event)
    }

    // --- Screen Control Actions ---

    fun goHome(): Boolean = performGlobalAction(GLOBAL_ACTION_HOME)

    fun goBack(): Boolean = performGlobalAction(GLOBAL_ACTION_BACK)

    fun openRecents(): Boolean = performGlobalAction(GLOBAL_ACTION_RECENTS)

    fun openNotifications(): Boolean = performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)

    fun openQuickSettings(): Boolean = performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)

    fun lockScreen(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
        } else {
            false
        }
    }

    fun takeScreenshot(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
        } else {
            false
        }
    }

    fun scrollDown(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val displayMetrics = resources.displayMetrics
            val width = displayMetrics.widthPixels.toFloat()
            val height = displayMetrics.heightPixels.toFloat()

            val path = Path().apply {
                moveTo(width / 2f, height * 0.75f)
                lineTo(width / 2f, height * 0.25f)
            }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 300))
                .build()
            return dispatchGesture(gesture, null, null)
        }
        return false
    }

    fun scrollUp(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val displayMetrics = resources.displayMetrics
            val width = displayMetrics.widthPixels.toFloat()
            val height = displayMetrics.heightPixels.toFloat()

            val path = Path().apply {
                moveTo(width / 2f, height * 0.25f)
                lineTo(width / 2f, height * 0.75f)
            }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 300))
                .build()
            return dispatchGesture(gesture, null, null)
        }
        return false
    }

    private fun vibrateFeedback() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 80, 60, 80), -1))
            } else {
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 80, 60, 80), -1))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(150)
                }
            }
        } catch (_: Exception) {}
    }
}
