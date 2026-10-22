package com.nxtzenmaker.jarvis

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import java.io.File
import java.util.ArrayDeque

class JarvisService : Service() {

    companion object {
        const val CHANNEL_ID = "rox_voice_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START_LISTENING = "com.nxtzenmaker.jarvis.START_LISTENING"
        const val ACTION_STOP_LISTENING = "com.nxtzenmaker.jarvis.STOP_LISTENING"
        const val BROADCAST_JARVIS_UPDATE = "com.nxtzenmaker.jarvis.UPDATE"

        var isServiceRunning = false
            private set

        fun startListeningService(context: Context) {
            val intent = Intent(context, JarvisService::class.java).apply {
                action = ACTION_START_LISTENING
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopListeningService(context: Context) {
            val intent = Intent(context, JarvisService::class.java).apply {
                action = ACTION_STOP_LISTENING
            }
            context.stopService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var audioRecord: AudioRecord? = null
    private var listeningJob: Job? = null
    private var isListeningLoopActive = false

    private lateinit var audioPlayer: AudioPlayer
    private lateinit var apiClient: ApiClient

    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        audioPlayer = AudioPlayer(this)
        apiClient = ApiClient("https://whisper-voice-ai.vercel.app")

        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
        audioManager?.mode = android.media.AudioManager.MODE_NORMAL
        audioManager?.isSpeakerphoneOn = false

        acquireWakeLock()
        createNotificationChannel()
        startInForeground("🟢 ROX Active • Listening for your voice...")
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Rox:BackgroundListeningWakeLock"
            ).apply {
                acquire(12 * 60 * 60 * 1000L) // 12 hours safe window
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            wakeLock = null
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_LISTENING -> {
                stopContinuousListening()
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                startContinuousListening()
            }
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ROX Background Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "ROX Voiceprint Biometrics & Always-On Ear"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ROX Voice AI")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_shield_check)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startInForeground(statusText: String) {
        val notification = buildNotification(statusText)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(statusText: String) {
        val notification = buildNotification(statusText)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    @Volatile
    private var isRecordingPaused = false

    private fun pauseRecordingForSpeech() {
        isRecordingPaused = true
        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @SuppressLint("MissingPermission")
    private fun resumeRecordingAfterSpeech() {
        try {
            if (audioRecord?.state == AudioRecord.STATE_INITIALIZED &&
                audioRecord?.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.startRecording()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isRecordingPaused = false
        }
    }

    @SuppressLint("MissingPermission")
    private fun startContinuousListening() {
        if (isListeningLoopActive) return
        isListeningLoopActive = true

        listeningJob = serviceScope.launch {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
            audioManager?.mode = android.media.AudioManager.MODE_NORMAL
            audioManager?.isSpeakerphoneOn = false

            val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            val bufferSize = maxOf(minBufferSize, 4096)

            try {
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    bufferSize
                )

                if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                    updateNotification("Mic Init Failed ❌")
                    return@launch
                }

                audioRecord?.startRecording()
                updateNotification("🟢 ROX Active • Listening for your voice...")

                val frameSize = 1024 // ~64ms
                val buffer = ShortArray(frameSize)

                // Pre-speech ring buffer (stores ~320ms before trigger)
                val preSpeechQueue = ArrayDeque<ShortArray>(5)

                val speechChunks = ArrayList<ShortArray>()
                var isCollectingSpeech = false
                var silenceFrames = 0

                val voiceThreshold = 0.035f   // Speech volume
                val silenceThreshold = 0.020f // Ambient silence floor
                val maxSilenceFrames = 13     // ~800ms silence ends utterance
                val maxSpeechFrames = 80      // ~5.1 seconds max utterance
                val minSpeechFrames = 12      // ~0.76s minimum utterance

                while (isActive && isListeningLoopActive) {
                    // Echo Prevention & Loudspeaker Protection: Pause mic processing while ROX speaks
                    if (isRecordingPaused || audioPlayer.isPlayingAudio()) {
                        delay(150)
                        continue
                    }

                    val read = audioRecord?.read(buffer, 0, frameSize) ?: 0
                    if (read <= 0) continue

                    // Calculate RMS Energy
                    var sum = 0.0
                    for (i in 0 until read) {
                        val s = buffer[i]
                        sum += s * s
                    }
                    val rms = kotlin.math.sqrt(sum / read).toFloat() / 32768.0f

                    if (!isCollectingSpeech) {
                        // Keep rolling pre-speech buffer
                        if (preSpeechQueue.size >= 5) {
                            preSpeechQueue.pollFirst()
                        }
                        preSpeechQueue.addLast(buffer.copyOf())

                        // Trigger Voice Activity Detection
                        if (rms >= voiceThreshold) {
                            isCollectingSpeech = true
                            speechChunks.clear()

                            // Prepend pre-speech frames so word start is not clipped
                            for (preFrame in preSpeechQueue) {
                                speechChunks.add(preFrame)
                            }
                            preSpeechQueue.clear()

                            speechChunks.add(buffer.copyOf())
                            silenceFrames = 0
                            updateNotification("🎙️ Speech detected... Listening")
                            broadcastStatus("LISTENING", "Hearing speech...", 0.0, 0)
                        }
                    } else {
                        // Actively gathering utterance
                        speechChunks.add(buffer.copyOf())

                        if (rms < silenceThreshold) {
                            silenceFrames++
                        } else {
                            silenceFrames = 0
                        }

                        // Utterance complete (either silence detected or timeout)
                        if (silenceFrames >= maxSilenceFrames || speechChunks.size >= maxSpeechFrames) {
                            isCollectingSpeech = false

                            if (speechChunks.size >= minSpeechFrames) {
                                updateNotification("🔍 Verifying Voiceprint Biometrics...")
                                broadcastStatus("VERIFYING", "Verifying biometrics...", 0.0, 0)

                                processCapturedUtterance(speechChunks)
                            } else {
                                updateNotification("🟢 ROX Active • Listening for your voice...")
                                broadcastStatus("IDLE", "Standby", 0.0, 0)
                            }

                            speechChunks.clear()
                            silenceFrames = 0
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

    private suspend fun processCapturedUtterance(chunks: List<ShortArray>) = withContext(Dispatchers.IO) {
        var totalSamples = 0
        for (chunk in chunks) totalSamples += chunk.size
        val allShorts = ShortArray(totalSamples)
        var offset = 0
        for (chunk in chunks) {
            System.arraycopy(chunk, 0, allShorts, offset, chunk.size)
            offset += chunk.size
        }

        val floatSamples = FloatArray(allShorts.size)
        for (i in allShorts.indices) {
            floatSamples[i] = allShorts[i] / 32768.0f
        }

        // 1. Extract Biometric Voice Features
        val features = VoiceFeatureExtractor.extractFeatures(floatSamples, sampleRate)

        // 2. Save Temporary WAV
        val wavFile = File(cacheDir, "bg_utterance_${System.currentTimeMillis()}.wav")
        AudioUtils.writeWavFile(wavFile, allShorts, sampleRate)

        // 3. Post to Whisper Voice AI Backend
        val res = apiClient.transcribeAndVerify(
            wavFile = wavFile,
            voiceprintJson = features.vectorJson,
            pitch = features.pitch,
            action = "identify",
            language = "hinglish"
        )

        wavFile.delete()

        if (!res.success) {
            updateNotification("🟢 ROX Active • Listening for your voice...")
            broadcastStatus("ERROR", res.errorMessage ?: "Verification failed", 0.0, 0)
            return@withContext
        }

        if (res.isOwner) {
            // OWNER VERIFIED!
            updateNotification("✅ Aap (Owner) - ${res.matchPercent}% Match")
            broadcastStatus("OWNER_VERIFIED", res.text, res.matchPercent, res.pitch)

            // Test acknowledgment reply (Strictly no LLM as requested)
            val replyText = "Haan boss, Rox sun raha hai. Boliye."

            // Stop mic recording IMMEDIATELY so phone leaves recording state and routes to loudspeaker!
            pauseRecordingForSpeech()

            val voice = Prefs.getVoiceModel(this@JarvisService)
            val elevenKey = Prefs.getElevenLabsApiKey(this@JarvisService)
            audioPlayer.playSpeech(
                text = replyText,
                voice = voice,
                elevenApiKey = elevenKey,
                baseUrl = apiClient.baseUrl,
                onStart = {
                    updateNotification("🗣️ ROX Speaking (Loudspeaker)...")
                    broadcastStatus("SPEAKING", replyText, res.matchPercent, res.pitch)
                },
                onComplete = {
                    serviceScope.launch {
                        delay(500) // Clear room echo before mic resumes
                        resumeRecordingAfterSpeech()
                        updateNotification("🟢 ROX Active • Listening for your voice...")
                        broadcastStatus("IDLE", "Standby", 0.0, 0)
                    }
                },
                onError = {
                    serviceScope.launch {
                        resumeRecordingAfterSpeech()
                        updateNotification("🟢 ROX Active • Listening for your voice...")
                        broadcastStatus("IDLE", "Standby", 0.0, 0)
                    }
                }
            )
        } else {
            // NOT OWNER! STRICT SECURITY GATE: ZERO AUDIO OUTPUT!
            updateNotification("🔇 Stranger voice blocked (${res.matchPercent}%)")
            broadcastStatus("STRANGER_BLOCKED", res.speakerName, res.matchPercent, res.pitch)

            delay(1200)
            updateNotification("🟢 ROX Active • Listening for your voice...")
            broadcastStatus("IDLE", "Standby", 0.0, 0)
        }
    }

    private fun broadcastStatus(state: String, text: String, matchPercent: Double, pitch: Int) {
        val intent = Intent(BROADCAST_JARVIS_UPDATE).apply {
            putExtra("state", state)
            putExtra("text", text)
            putExtra("matchPercent", matchPercent)
            putExtra("pitch", pitch)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun cleanUpAudioRecord() {
        try {
            isRecordingPaused = false
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

    private fun stopContinuousListening() {
        isListeningLoopActive = false
        listeningJob?.cancel()
        listeningJob = null
        cleanUpAudioRecord()
        audioPlayer.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        stopContinuousListening()
        serviceScope.cancel()
        releaseWakeLock()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
