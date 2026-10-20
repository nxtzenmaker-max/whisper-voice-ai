package com.nxtzenmaker.jarvis

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import java.util.Locale

class RoxOverlayService : Service() {

    companion object {
        const val ACTION_ACTIVATE = "com.nxtzenmaker.jarvis.ACTION_ACTIVATE"
        const val ACTION_STOP = "com.nxtzenmaker.jarvis.ACTION_STOP"
        private const val CHANNEL_ID = "rox_assistant_channel"
        private const val NOTIFICATION_ID = 2001

        fun activate(context: Context) {
            val intent = Intent(context, RoxOverlayService::class.java).apply {
                action = ACTION_ACTIVATE
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, RoxOverlayService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var webView: WebView? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var speechRecognizer: SpeechRecognizer? = null
    private var recognizerIntent: Intent? = null

    private var isCodeVerified = false
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        initTTS()
        initSpeechRecognizer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Rox Active • Ready"))

        if (intent?.action == ACTION_STOP) {
            shutdownService()
            return START_NOT_STICKY
        }

        showFloatingOverlay()

        mainHandler.postDelayed({
            speakText("Rox activated, send your code with your voice to start", "UTTERANCE_ACTIVATION")
        }, 500)

        return START_STICKY
    }

    private fun showFloatingOverlay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Enable 'Draw Over Other Apps' permission first", Toast.LENGTH_LONG).show()
            stopSelf()
            return
        }

        if (overlayView != null) {
            overlayView?.visibility = View.VISIBLE
            return
        }

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val inflater = LayoutInflater.from(this)
        overlayView = inflater.inflate(R.layout.layout_overlay_orb, null)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
            x = 0
            y = 0
        }

        webView = overlayView?.findViewById(R.id.overlayWebView)
        webView?.apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
            }

            addJavascriptInterface(object : Any() {
                @JavascriptInterface
                fun onOrbTapped() {
                    mainHandler.post {
                        if (!isListening) startListening()
                    }
                }
            }, "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    updateOrbState("activating", "Rox Activated • Send code...")
                }
            }

            loadUrl("file:///android_asset/orb_overlay.html")
        }

        val btnClose = overlayView?.findViewById<TextView>(R.id.btnClose)
        btnClose?.setOnClickListener { shutdownService() }

        // Touch & Drag across screen
        overlayView?.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f

            override fun onTouch(v: View?, event: MotionEvent): Boolean {
                val lp = layoutParams ?: return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = lp.x
                        initialY = lp.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        return false
                    }
                    MotionEvent.ACTION_MOVE -> {
                        lp.x = initialX + (event.rawX - initialTouchX).toInt()
                        lp.y = initialY + (event.rawY - initialTouchY).toInt()
                        try {
                            windowManager?.updateViewLayout(overlayView, lp)
                        } catch (_: Exception) {}
                        return true
                    }
                }
                return false
            }
        })

        try {
            windowManager?.addView(overlayView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun updateOrbState(state: String, text: String) {
        mainHandler.post {
            webView?.evaluateJavascript("window.setRoxState('$state', '${text.replace("'", "\\'")}');", null)
        }
    }

    private fun feedAudioLevelToOrb(level: Float) {
        mainHandler.post {
            webView?.evaluateJavascript("window.feedAudioLevel($level);", null)
        }
    }

    private fun initTTS() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true
                tts?.language = Locale("hi", "IN")
                tts?.setPitch(1.0f)
                tts?.setSpeechRate(1.1f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        feedAudioLevelToOrb(0.85f)
                    }

                    override fun onDone(utteranceId: String?) {
                        feedAudioLevelToOrb(0.1f)
                        when (utteranceId) {
                            "UTTERANCE_ACTIVATION", "UTTERANCE_RETRY" -> {
                                mainHandler.post {
                                    updateOrbState("listening_code", "Listening for code word...")
                                    startListening()
                                }
                            }
                            "UTTERANCE_VERIFIED" -> {
                                mainHandler.post {
                                    isCodeVerified = true
                                    updateOrbState("code_verified", "Verified • Command ready")
                                    startListening()
                                }
                            }
                            "UTTERANCE_SHUTDOWN" -> {
                                mainHandler.post { shutdownService() }
                            }
                        }
                    }

                    override fun onError(utteranceId: String?) {
                        feedAudioLevelToOrb(0.05f)
                    }
                })
            }
        }
    }

    private fun speakText(text: String, utteranceId: String) {
        if (ttsReady && tts != null) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        }
    }

    private fun initSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
            recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            }

            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { isListening = true }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {
                    val normalized = ((rmsdB + 2f) / 10f).coerceIn(0f, 1f)
                    feedAudioLevelToOrb(normalized)
                }
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { isListening = false }
                override fun onError(error: Int) {
                    isListening = false
                    if (!isCodeVerified) {
                        mainHandler.postDelayed({ startListening() }, 1200)
                    }
                }
                override fun onResults(results: Bundle?) {
                    isListening = false
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        processSpokenText(matches)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    private fun startListening() {
        mainHandler.post {
            try {
                speechRecognizer?.cancel()
                recognizerIntent?.let { speechRecognizer?.startListening(it) }
            } catch (_: Exception) {}
        }
    }

    private fun processSpokenText(matches: ArrayList<String>) {
        val codeWord = Prefs.getCodeWord(this).lowercase()
        var matchedCode = false

        for (match in matches) {
            val lower = match.lowercase()

            // Shutdown commands
            if (lower.contains("rox close") || lower.contains("rox stop") || lower.contains("rox shutdown") || lower.contains("band ho jao") || lower.contains("so jao")) {
                updateOrbState("closing", "Shutting down Rox...")
                speakText("Shutting down Rox. Goodbye.", "UTTERANCE_SHUTDOWN")
                return
            }

            // Code word verification
            if (!isCodeVerified && (lower.contains(codeWord) || lower.replace("\\s+".toRegex(), "").contains(codeWord.replace("\\s+".toRegex(), "")))) {
                matchedCode = true
                break
            }
        }

        if (!isCodeVerified) {
            if (matchedCode) {
                speakText("Code verified. Rox is ready.", "UTTERANCE_VERIFIED")
            } else {
                updateOrbState("activating", "Invalid code. Try again...")
                speakText("Code not recognized. Send your code to start.", "UTTERANCE_RETRY")
            }
        } else {
            val cmd = matches[0]
            updateOrbState("listening_cmd", "Received: $cmd")
            speakText("I heard $cmd", "UTTERANCE_CMD")
            mainHandler.postDelayed({ startListening() }, 2500)
        }
    }

    private fun shutdownService() {
        if (overlayView != null && windowManager != null) {
            try {
                windowManager?.removeView(overlayView)
            } catch (_: Exception) {}
            overlayView = null
        }
        try { speechRecognizer?.destroy() } catch (_: Exception) {}
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {}
        stopForeground(true)
        stopSelf()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rox AI Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Running Rox floating orb assistant"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Rox AI Assistant")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_rox_tile)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        shutdownService()
    }
}
