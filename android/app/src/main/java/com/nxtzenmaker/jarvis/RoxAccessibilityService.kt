package com.nxtzenmaker.jarvis

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

class RoxAccessibilityService : AccessibilityService() {

    private val volumeDownPressTimes = mutableListOf<Long>()
    private val REQUIRED_PRESSES = 3
    private val TIME_WINDOW_MS = 1500L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used
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
                RoxOverlayService.activate(applicationContext)
                return true // Consume event
            }
        }
        return super.onKeyEvent(event)
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
