package com.nxtzenmaker.jarvis

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("jarvis_prefs", Context.MODE_PRIVATE)
            val bgEnabled = prefs.getBoolean("bg_listening_enabled", true)
            if (bgEnabled) {
                JarvisService.startListeningService(context)
            }
        }
    }
}
