package com.nxtzenmaker.jarvis

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast

class RoxTrampolineActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check Overlay Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Please enable 'Draw Over Other Apps' for Rox Floating Orb", Toast.LENGTH_LONG).show()
            try {
                val overlayIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(overlayIntent)
            } catch (_: Exception) {
                val intent = Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            }
            finish()
            return
        }

        // Foreground Activity is active: launch Rox Overlay Service safely on Android 12/13/14
        try {
            RoxOverlayService.activate(this)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to launch Rox: ${e.message}", Toast.LENGTH_SHORT).show()
        }

        // Finish immediately so the user remains on their current screen
        finish()
    }
}
