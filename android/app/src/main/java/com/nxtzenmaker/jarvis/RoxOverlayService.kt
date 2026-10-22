package com.nxtzenmaker.jarvis

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*
import java.io.File
import java.util.ArrayDeque
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
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
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

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val mainHandler = Handler(Looper.getMainLooper())

    private lateinit var audioPlayer: AudioPlayer
    private lateinit var apiClient: ApiClient

    private var audioRecord: AudioRecord? = null
    private var listeningJob: Job? = null
    private var isListeningLoopActive = false
    private var isRecordingPaused = false
    private var isSpeaking = false

    private var isCodeVerified = false
    private var wasJarvisServiceRunning = false

    private var fallbackTts: TextToSpeech? = null
    private var fallbackTtsReady = false

    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        audioPlayer = AudioPlayer(this)
        apiClient = ApiClient("https://whisper-voice-ai.vercel.app")
        initFallbackTTS()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasMic) {
                startForeground(NOTIFICATION_ID, buildNotification("Rox Active • Ready"), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(NOTIFICATION_ID, buildNotification("Rox Active • Ready"))
            }
        } catch (_: Exception) {
            try {
                startForeground(NOTIFICATION_ID, buildNotification("Rox Active • Ready"))
            } catch (_: Exception) {}
        }

        if (intent?.action == ACTION_STOP) {
            shutdownService()
            return START_NOT_STICKY
        }

        // Avoid mic contention with JarvisService
        if (JarvisService.isServiceRunning) {
            wasJarvisServiceRunning = true
            JarvisService.stopListeningService(this)
        }

        showFloatingOverlay()

        val requireCode = Prefs.isCodeRequired(this)
        isCodeVerified = !requireCode

        mainHandler.postDelayed({
            if (requireCode) {
                updateOrbState("activating", "Code boliye start karne ke liye...")
                speakEmotional("Arrey boss, Rox active hai! Apna code boliye start karne ke liye.") {
                    startContinuousListening()
                }
            } else {
                updateOrbState("code_verified", "Rox Active • Boliye!")
                speakEmotional("Arrey boss! Rox hazir hai. Boliye, aaj kya kamaal karna hai?") {
                    startContinuousListening()
                }
            }
        }, 350)

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

        // Compact window bounds to remove any invisible board blocking the screen
        layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
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
                        if (!isCodeVerified) {
                            // Instant Tap-To-Unlock fallback
                            isCodeVerified = true
                            updateOrbState("code_verified", "Verified • Ready!")
                            speakEmotional("Code verified boss! Rox poori tarah ready hai, boliye kya madad karoon?") {
                                resumeRecordingAfterSpeech()
                            }
                        } else {
                            updateOrbState("code_verified", "Rox sun raha hai... Boliye!")
                        }
                    }
                }
            }, "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (isCodeVerified) {
                        updateOrbState("code_verified", "Rox Active • Boliye!")
                    } else {
                        updateOrbState("activating", "Code boliye start karne ke liye...")
                    }
                }
            }

            loadUrl("file:///android_asset/orb_overlay.html")
        }

        // Drag to reposition + Slide Down To Turn Off
        overlayView?.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f
            private var isSlidingDownToClose = false

            override fun onTouch(v: View?, event: MotionEvent): Boolean {
                val lp = layoutParams ?: return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = lp.x
                        initialY = lp.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isSlidingDownToClose = false
                        return false
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val deltaX = event.rawX - initialTouchX
                        val deltaY = event.rawY - initialTouchY

                        // Check if sliding down predominantly to turn off
                        if (deltaY > 140f && deltaY > kotlin.math.abs(deltaX) * 1.25f) {
                            if (!isSlidingDownToClose) {
                                isSlidingDownToClose = true
                                updateOrbState("closing", "Slide down to close Rox ⬇️")
                            }
                        } else if (isSlidingDownToClose && deltaY < 90f) {
                            isSlidingDownToClose = false
                            if (isCodeVerified) {
                                updateOrbState("code_verified", "Rox sun raha hai... Boliye!")
                            } else {
                                updateOrbState("activating", "Code boliye...")
                            }
                        }

                        lp.x = initialX + deltaX.toInt()
                        lp.y = initialY + deltaY.toInt()
                        try {
                            windowManager?.updateViewLayout(overlayView, lp)
                        } catch (_: Exception) {}
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        val deltaX = event.rawX - initialTouchX
                        val deltaY = event.rawY - initialTouchY

                        if (deltaY > 130f && deltaY > kotlin.math.abs(deltaX) * 1.2f) {
                            // User slid down to turn off Rox!
                            updateOrbState("closing", "Rox so raha hai...")
                            speakEmotional("Chaliye boss, Rox ab so raha hai. Jab bhi bulana ho, bas awaaz dijiyega. Alvida!") {
                                shutdownService()
                            }
                            return true
                        }
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

    private fun pauseRecordingForSpeech() {
        isSpeaking = true
        isRecordingPaused = true
        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
        } catch (_: Exception) {}
    }

    /**
     * Speaks text using selected emotional voice (Madhur / Swara / Prabhat) with natural cadence.
     * Automatically pauses mic to prevent loudspeaker echo, and re-arms continuous listening on complete.
     */
    private fun speakEmotional(text: String, onComplete: (() -> Unit)? = null) {
        serviceScope.launch {
            pauseRecordingForSpeech()

            // Pulse the 3D orb while speaking
            val speechAnimJob = launch {
                var angle = 0.0
                while (isActive && isSpeaking) {
                    val lvl = (0.35f + 0.35f * kotlin.math.sin(angle)).toFloat()
                    feedAudioLevelToOrb(lvl)
                    angle += 0.35
                    delay(50)
                }
                feedAudioLevelToOrb(0.04f)
            }

            try {
                val voice = Prefs.getVoiceModel(this@RoxOverlayService)
                val rate = Prefs.getVoiceRate(this@RoxOverlayService)
                val pitch = Prefs.DEFAULT_PITCH
                val elevenKey = Prefs.getElevenLabsApiKey(this@RoxOverlayService)

                audioPlayer.playSpeech(
                    text = text,
                    voice = voice,
                    elevenApiKey = elevenKey,
                    baseUrl = apiClient.baseUrl,
                    rate = rate,
                    pitch = pitch,
                    onStart = {
                        isSpeaking = true
                    },
                    onComplete = {
                        isSpeaking = false
                        speechAnimJob.cancel()
                        feedAudioLevelToOrb(0.04f)
                        onComplete?.invoke()
                    },
                    onError = {
                        isSpeaking = false
                        speechAnimJob.cancel()
                        feedAudioLevelToOrb(0.04f)
                        fallbackSpeak(text, onComplete)
                    }
                )
            } catch (e: Exception) {
                isSpeaking = false
                speechAnimJob.cancel()
                feedAudioLevelToOrb(0.04f)
                fallbackSpeak(text, onComplete)
            }
        }
    }

    private fun fallbackSpeak(text: String, onComplete: (() -> Unit)?) {
        mainHandler.post {
            if (fallbackTtsReady && fallbackTts != null) {
                fallbackTts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "FALLBACK_ROX")
                val estimatedDurationMs = (text.length * 60L).coerceIn(1200L, 5000L)
                mainHandler.postDelayed({ onComplete?.invoke() }, estimatedDurationMs)
            } else {
                onComplete?.invoke()
            }
        }
    }

    private fun initFallbackTTS() {
        fallbackTts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                fallbackTtsReady = true
                fallbackTts?.language = Locale("hi", "IN")
            }
        }
    }

    private fun initAudioRecord(): Boolean {
        cleanUpAudioRecord()
        val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        val bufferSize = maxOf(minBufferSize, 4096)
        return try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )
            audioRecord?.state == AudioRecord.STATE_INITIALIZED
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Completely continuous, hands-free audio recording.
     * Zero taps needed. Sensitive voice threshold detects speech effortlessly.
     */
    @SuppressLint("MissingPermission")
    private fun startContinuousListening() {
        if (isListeningLoopActive) return
        isListeningLoopActive = true
        isRecordingPaused = false

        listeningJob = serviceScope.launch {
            if (!initAudioRecord()) {
                updateOrbState("activating", "Mic Initialization Failed")
                return@launch
            }

            try {
                audioRecord?.startRecording()

                val frameSize = 1024 // ~64ms
                val buffer = ShortArray(frameSize)
                val preSpeechQueue = ArrayDeque<ShortArray>(5)
                val speechChunks = ArrayList<ShortArray>()

                var isCollectingSpeech = false
                var silenceFrames = 0

                val voiceThreshold = 0.019f   // Sensitive speech trigger
                val silenceThreshold = 0.011f // Room silence floor
                val maxSilenceFrames = 10     // ~640ms silence concludes utterance
                val maxSpeechFrames = 85      // ~5.4s max utterance
                val minSpeechFrames = 7       // ~0.45s min speech (filters clicks)

                while (isActive && isListeningLoopActive) {
                    if (isRecordingPaused || isSpeaking || audioPlayer.isPlayingAudio()) {
                        delay(100)
                        continue
                    }

                    // Check that AudioRecord is actively recording
                    if (audioRecord?.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                        try {
                            audioRecord?.startRecording()
                        } catch (_: Exception) {
                            delay(100)
                            continue
                        }
                    }

                    val read = audioRecord?.read(buffer, 0, frameSize) ?: 0
                    if (read <= 0) {
                        delay(20)
                        continue
                    }

                    // Calculate RMS
                    var sum = 0.0
                    for (i in 0 until read) {
                        val s = buffer[i]
                        sum += s * s
                    }
                    val rms = kotlin.math.sqrt(sum / read).toFloat() / 32768.0f

                    // Live feed RMS to 3D WebGL Orb visualizer
                    val visualLevel = (rms * 5.0f).coerceIn(0.03f, 1.0f)
                    feedAudioLevelToOrb(visualLevel)

                    if (!isCollectingSpeech) {
                        if (preSpeechQueue.size >= 5) {
                            preSpeechQueue.pollFirst()
                        }
                        preSpeechQueue.addLast(buffer.copyOf())

                        if (rms >= voiceThreshold) {
                            isCollectingSpeech = true
                            speechChunks.clear()
                            for (pre in preSpeechQueue) {
                                speechChunks.add(pre)
                            }
                            preSpeechQueue.clear()
                            speechChunks.add(buffer.copyOf())
                            silenceFrames = 0

                            if (!isCodeVerified) {
                                updateOrbState("hearing", "Code sun raha hoon...")
                            } else {
                                updateOrbState("hearing", "Rox sun raha hai...")
                            }
                        }
                    } else {
                        speechChunks.add(buffer.copyOf())

                        if (rms < silenceThreshold) {
                            silenceFrames++
                        } else {
                            silenceFrames = 0
                        }

                        if (silenceFrames >= maxSilenceFrames || speechChunks.size >= maxSpeechFrames) {
                            val collectedChunks = ArrayList(speechChunks)
                            isCollectingSpeech = false
                            silenceFrames = 0
                            speechChunks.clear()

                            if (collectedChunks.size >= minSpeechFrames) {
                                processSpeechUtterance(collectedChunks)
                            } else {
                                if (!isCodeVerified) {
                                    updateOrbState("listening_code", "Code boliye...")
                                } else {
                                    updateOrbState("code_verified", "Rox sun raha hai... Boliye!")
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                cleanUpAudioRecord()
            }
        }
    }

    private fun resumeRecordingAfterSpeech() {
        serviceScope.launch {
            delay(200) // Clear room echo
            isSpeaking = false
            try {
                if (audioRecord?.state == AudioRecord.STATE_INITIALIZED) {
                    if (audioRecord?.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                        audioRecord?.startRecording()
                    }
                } else {
                    initAudioRecord()
                    audioRecord?.startRecording()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                initAudioRecord()
                try { audioRecord?.startRecording() } catch (_: Exception) {}
            } finally {
                isRecordingPaused = false
                if (isCodeVerified) {
                    updateOrbState("code_verified", "Rox sun raha hai... Boliye!")
                } else {
                    updateOrbState("listening_code", "Code boliye...")
                }
            }
        }
    }

    private fun processSpeechUtterance(chunks: List<ShortArray>) {
        serviceScope.launch(Dispatchers.IO) {
            pauseRecordingForSpeech()
            updateOrbState("processing", "Soch raha hoon...")

            val wavFile = File(cacheDir, "rox_utt_${System.currentTimeMillis()}.wav")
            try {
                var totalSamples = 0
                for (c in chunks) totalSamples += c.size
                val allShorts = ShortArray(totalSamples)
                var offset = 0
                for (c in chunks) {
                    System.arraycopy(c, 0, allShorts, offset, c.size)
                    offset += c.size
                }

                val floatSamples = FloatArray(allShorts.size)
                for (i in allShorts.indices) {
                    floatSamples[i] = allShorts[i] / 32768.0f
                }

                val features = VoiceFeatureExtractor.extractFeatures(floatSamples, sampleRate)
                AudioUtils.writeWavFile(wavFile, allShorts, sampleRate)

                val res = apiClient.transcribeAndVerify(
                    wavFile = wavFile,
                    voiceprintJson = features.vectorJson,
                    pitch = features.pitch,
                    action = "identify",
                    language = "hinglish"
                )

                if (!res.success) {
                    updateOrbState("activating", "Network busy • Try again...")
                    delay(300)
                    resumeRecordingAfterSpeech()
                    return@launch
                }

                val transcript = res.text.trim()

                // Filter out room noise or micro-clicks
                if (transcript.length < 2) {
                    resumeRecordingAfterSpeech()
                    return@launch
                }

                // 1. Check for Shutdown Command (e.g. "Rox off", "band ho jao", "so jao")
                if (CodeWordMatcher.isShutdownCommand(transcript)) {
                    updateOrbState("closing", "Rox OFF ho raha hai...")
                    speakEmotional("Theek hai boss! Rox off ho raha hai... Phir milenge, alvida!") {
                        shutdownService()
                    }
                    return@launch
                }

                // 2. Check Code Word if not verified (e.g. "Rox on", "Rox 7", "Rox start")
                if (!isCodeVerified) {
                    val configuredCode = Prefs.getCodeWord(this@RoxOverlayService)
                    val matched = CodeWordMatcher.isCodeWordMatched(transcript, configuredCode)

                    if (matched) {
                        isCodeVerified = true
                        updateOrbState("code_verified", "Rox ON • Ready!")
                        speakEmotional("Haan boss! Rox ON ho gaya hai... Boliye, kya madad karoon?") {
                            resumeRecordingAfterSpeech()
                        }
                    } else {
                        val displayTxt = if (transcript.isNotEmpty()) "Heard: '$transcript' • Dobara boliye" else "Code samajh nahi aaya"
                        updateOrbState("activating", displayTxt)
                        speakEmotional("Arey code samajh nahi aaya boss... 'Rox ON' ya 'Rox 7' boliye na!") {
                            resumeRecordingAfterSpeech()
                        }
                    }
                } else {
                    // Already active - check if user said "rox on" or wake command
                    if (CodeWordMatcher.isWakeCommand(transcript)) {
                        updateOrbState("code_verified", "Rox ON • Active!")
                        speakEmotional("Haan boss! Rox ON hai aur aapko hi sun raha hai... Boliye kya baat hai?") {
                            resumeRecordingAfterSpeech()
                        }
                        return@launch
                    }

                    // 3. Screen Controls & Hardware Actions (Home, Back, Recent, Screenshot, Lock, Scroll, Torch, Volume, Apps)
                    val screenReply = ScreenControlHandler.handleCommand(this@RoxOverlayService, transcript)
                    if (screenReply != null) {
                        updateOrbState("listening_cmd", screenReply)
                        speakEmotional(screenReply) {
                            resumeRecordingAfterSpeech()
                        }
                        return@launch
                    }

                    // 4. User Query / Conversational AI -> Rox AI Brain (Groq API)
                    updateOrbState("processing", "Rox Brain soch raha hai...")
                    val aiReply = GroqBrain.askRox(this@RoxOverlayService, transcript)
                    updateOrbState("listening_cmd", aiReply)
                    speakEmotional(aiReply) {
                        resumeRecordingAfterSpeech()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                resumeRecordingAfterSpeech()
            } finally {
                try { wavFile.delete() } catch (_: Exception) {}
            }
        }
    }

    private fun cleanUpAudioRecord() {
        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
            audioRecord?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            audioRecord = null
        }
    }

    private fun shutdownService() {
        isListeningLoopActive = false
        listeningJob?.cancel()
        listeningJob = null
        cleanUpAudioRecord()
        audioPlayer.stop()

        mainHandler.post {
            if (overlayView != null && windowManager != null) {
                try {
                    windowManager?.removeView(overlayView)
                } catch (_: Exception) {}
                overlayView = null
            }
        }

        try {
            fallbackTts?.stop()
            fallbackTts?.shutdown()
        } catch (_: Exception) {}

        // Restore JarvisService if it was running before
        if (wasJarvisServiceRunning) {
            JarvisService.startListeningService(this)
        }

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
        serviceScope.cancel()
    }
}
