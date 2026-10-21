package com.nxtzenmaker.jarvis

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.nxtzenmaker.jarvis.databinding.ActivityMainBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var audioRecorder: AudioRecorder
    private lateinit var audioPlayer: AudioPlayer
    private lateinit var apiClient: ApiClient

    private var durationJob: Job? = null
    private var recordDurationSeconds = 0

    // Receiver to receive live background listening updates from JarvisService
    private val serviceUpdateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == JarvisService.BROADCAST_JARVIS_UPDATE) {
                val state = intent.getStringExtra("state") ?: "IDLE"
                val text = intent.getStringExtra("text") ?: ""
                val matchPercent = intent.getDoubleExtra("matchPercent", 0.0)
                val pitch = intent.getIntExtra("pitch", 0)

                handleServiceStateUpdate(state, text, matchPercent, pitch)
            }
        }
    }

    // Permission launcher
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val recordAudioGranted = permissions[Manifest.permission.RECORD_AUDIO] ?: false
        if (recordAudioGranted) {
            checkAndStartBackgroundListening()
            binding.tvSpeakerStatus.text = "Microphone Ready • Listening Active"
            requestBatteryOptimizationExemption()
        } else {
            Toast.makeText(this, "Microphone permission is required for voice assistant", Toast.LENGTH_LONG).show()
            binding.tvSpeakerStatus.text = "Mic permission denied ❌"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        audioRecorder = AudioRecorder(this)
        audioPlayer = AudioPlayer(this)
        apiClient = ApiClient("https://whisper-voice-ai.vercel.app")

        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
        audioManager?.mode = android.media.AudioManager.MODE_NORMAL
        audioManager?.isSpeakerphoneOn = false

        setupViews()
        checkAndRequestPermissions()
        checkBackendHealth()
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(JarvisService.BROADCAST_JARVIS_UPDATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(serviceUpdateReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(serviceUpdateReceiver, filter)
        }
    }

    override fun onStop() {
        super.onStop()
        try {
            unregisterReceiver(serviceUpdateReceiver)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupViews() {
        binding.tvBackendUrl.text = apiClient.baseUrl.removePrefix("https://")

        val prefs = getSharedPreferences("jarvis_prefs", Context.MODE_PRIVATE)
        val bgEnabled = prefs.getBoolean("bg_listening_enabled", true)
        binding.switchBackgroundListening.isChecked = bgEnabled

        binding.switchBackgroundListening.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean("bg_listening_enabled", isChecked).apply()
            if (isChecked) {
                JarvisService.startListeningService(this)
                Toast.makeText(this, "Continuous Background Ear Activated 🟢", Toast.LENGTH_SHORT).show()
                binding.tvSpeakerStatus.text = "Background Ear: Active (Listening always)"
            } else {
                JarvisService.stopListeningService(this)
                Toast.makeText(this, "Background Listening Paused", Toast.LENGTH_SHORT).show()
                binding.tvSpeakerStatus.text = "Background Ear: Paused (Tap Mic to talk)"
            }
        }

        binding.switchRegister.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                binding.tvModeBadge.text = "ENROLL MODE"
                binding.tvModeBadge.setTextColor(ContextCompat.getColor(this, R.color.emerald_400))
                binding.tvSpeakerStatus.text = "Enroll Mode: Speak to save owner voice sample"
            } else {
                binding.tvModeBadge.text = "IDENTIFY"
                binding.tvModeBadge.setTextColor(ContextCompat.getColor(this, R.color.cyan_400))
                binding.tvSpeakerStatus.text = "Identify Mode: Only Owner will trigger reply"
            }
        }

        binding.btnResetVoice.setOnClickListener {
            lifecycleScope.launch {
                val ok = apiClient.resetVoiceprint()
                if (ok) {
                    Toast.makeText(this@MainActivity, "Voice Reset Done! Please enroll 3 samples.", Toast.LENGTH_LONG).show()
                    binding.switchRegister.isChecked = true
                    binding.tvModeBadge.text = "ENROLL (0/3)"
                    binding.tvSpeakerStatus.text = "⚠️ Voice Reset Done"
                    binding.tvBiometricDetail.text = "Mic dabakar 3 baar aawaz bol kar enroll karein."
                    binding.pbMatch.progress = 0
                    binding.tvMatchPercent.text = "0%"
                }
            }
        }

        binding.btnMic.setOnClickListener {
            if (audioRecorder.isCurrentlyRecording()) {
                stopListeningAndVerify()
            } else {
                startListening()
            }
        }

        updateCodeWordDisplay()
        val openCodeDialog = View.OnClickListener { showCodeWordDialog() }
        binding.rowCodeWord.setOnClickListener(openCodeDialog)
        binding.tvCurrentCodeWord.setOnClickListener(openCodeDialog)

        updateVoiceDisplay()
        val openVoiceDialog = View.OnClickListener { showVoiceSelectorDialog() }
        binding.rowVoiceModel.setOnClickListener(openVoiceDialog)
        binding.tvCurrentVoice.setOnClickListener(openVoiceDialog)

        binding.tvBackendUrl.setOnClickListener { showGroqApiKeyDialog() }
    }

    private fun updateVoiceDisplay() {
        val voice = Prefs.getVoiceModel(this)
        val label = when (voice) {
            "hi-IN-MadhurNeural" -> "Madhur (Emotional Hindi)"
            "hi-IN-SwaraNeural" -> "Swara (Expressive Female)"
            "en-IN-PrabhatNeural" -> "Prabhat (Tech Male)"
            "en-IN-NeerjaExpressiveNeural" -> "Neerja (Expressive Female)"
            else -> voice
        }
        binding.tvCurrentVoice.text = label
    }

    private fun showVoiceSelectorDialog() {
        val voiceOptions = arrayOf(
            "Madhur (Deep & Emotional Hindi Male - Recommended)",
            "Swara (Expressive & Warm Hindi Female)",
            "Prabhat (Tech Indian Male)",
            "Neerja (Expressive English-Hindi Female)"
        )
        val voiceValues = arrayOf(
            "hi-IN-MadhurNeural",
            "hi-IN-SwaraNeural",
            "en-IN-PrabhatNeural",
            "en-IN-NeerjaExpressiveNeural"
        )
        val currentVoice = Prefs.getVoiceModel(this)
        val selectedIndex = voiceValues.indexOf(currentVoice).let { if (it >= 0) it else 0 }

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Select Rox Voice & Emotion")
            .setSingleChoiceItems(voiceOptions, selectedIndex) { dialog, which ->
                val chosenVoice = voiceValues[which]
                Prefs.setVoiceModel(this, chosenVoice)
                updateVoiceDisplay()
                Toast.makeText(this, "Voice set to ${voiceOptions[which].split(" (")[0]}", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun showGroqApiKeyDialog() {
        val currentKey = Prefs.getGroqApiKey(this)
        val input = android.widget.EditText(this).apply {
            setText(currentKey)
            hint = "gsk_..."
            setPadding(40, 30, 40, 30)
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.GRAY)
        }

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Groq AI Brain API Key")
            .setMessage("Rox AI brain uses Groq Cloud API for lightning-fast voice replies. You can keep the default key or use your own.")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val newKey = input.text.toString().trim()
                if (newKey.isNotEmpty()) {
                    Prefs.setGroqApiKey(this, newKey)
                    Toast.makeText(this, "Groq API Key saved!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNeutralButton("Reset Default") { _, _ ->
                Prefs.setGroqApiKey(this, "")
                Toast.makeText(this, "Reset to default Groq Key (Auto Cloud)", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateCodeWordDisplay() {
        val requireCode = Prefs.isCodeRequired(this)
        val codeWord = Prefs.getCodeWord(this)
        if (!requireCode) {
            binding.tvCurrentCodeWord.text = "Disabled (Instant Start)"
            binding.tvCurrentCodeWord.setTextColor(ContextCompat.getColor(this, R.color.emerald_400))
        } else {
            binding.tvCurrentCodeWord.text = "$codeWord (Tap to edit)"
            binding.tvCurrentCodeWord.setTextColor(ContextCompat.getColor(this, R.color.cyan_400))
        }
    }

    private fun showCodeWordDialog() {
        val currentCode = Prefs.getCodeWord(this)
        val isRequired = Prefs.isCodeRequired(this)

        val input = android.widget.EditText(this).apply {
            setText(currentCode)
            hint = "e.g. rox 7, open, jarvis"
            setPadding(40, 30, 40, 30)
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.GRAY)
        }

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Set Rox Activation Code Word")
            .setMessage("Jab Rox shuru hoga, ye secret code voice se bolna hoga. Default: 'rox 7'")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val newCode = input.text.toString().trim()
                if (newCode.isNotEmpty()) {
                    Prefs.setCodeWord(this, newCode)
                    Prefs.setCodeRequired(this, true)
                    updateCodeWordDisplay()
                    Toast.makeText(this, "Code set to '$newCode'", Toast.LENGTH_SHORT).show()
                }
            }
            .setNeutralButton(if (isRequired) "Disable Code Requirement" else "Enable Code Requirement") { _, _ ->
                val newState = !isRequired
                Prefs.setCodeRequired(this, newState)
                updateCodeWordDisplay()
                val msg = if (newState) "Code word enabled" else "Code word disabled (Rox activates instantly!)"
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun checkAndStartBackgroundListening() {
        val prefs = getSharedPreferences("jarvis_prefs", Context.MODE_PRIVATE)
        val bgEnabled = prefs.getBoolean("bg_listening_enabled", true)
        if (bgEnabled) {
            JarvisService.startListeningService(this)
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            checkAndStartBackgroundListening()
            requestBatteryOptimizationExemption()
        }

        // Prompt for Floating Overlay permission if needed for 3D Orb
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            try {
                val overlayIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                startActivity(overlayIntent)
            } catch (_: Exception) {}
        }
    }

    @SuppressLint("BatteryLife")
    private fun requestBatteryOptimizationExemption() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun checkBackendHealth() {
        lifecycleScope.launch {
            val ok = apiClient.checkHealth()
            if (ok) {
                binding.tvStatusSub.text = "● Connected to Vercel Backend"
                binding.tvStatusSub.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.emerald_400))

                val status = apiClient.getVoiceprintStatus()
                if (!status.hasOwner || status.sampleCount == 0) {
                    binding.switchRegister.isChecked = true
                    binding.tvModeBadge.text = "ENROLL (0/3)"
                    binding.tvModeBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.red_400))
                    binding.tvSpeakerStatus.text = "⚠️ Voice Not Registered Yet"
                    binding.tvBiometricDetail.text = "ROX abhi kisi ke liye nahi bolega! Niche 'Enroll Voice' ON hai, Mic daba kar 3 samples boliye."
                } else {
                    binding.switchRegister.isChecked = false
                    binding.tvModeBadge.text = "IDENTIFY"
                    binding.tvModeBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.cyan_400))
                    binding.tvSpeakerStatus.text = "Owner Enrolled (${status.sampleCount} Samples) ✅"
                    binding.tvBiometricDetail.text = "Biometric Lock Active • Strangers stay silent."
                }
            } else {
                binding.tvStatusSub.text = "○ Backend connecting..."
                binding.tvStatusSub.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_muted))
            }
        }
    }

    private fun handleServiceStateUpdate(state: String, text: String, matchPercent: Double, pitch: Int) {
        when (state) {
            "LISTENING" -> {
                binding.tvSpeakerStatus.text = "Hearing speech in background... 🎙️"
                binding.tvMicStatus.text = "Listening..."
            }
            "VERIFYING" -> {
                binding.tvSpeakerStatus.text = "Verifying Voiceprint Biometrics..."
                binding.tvMicStatus.text = "Verifying..."
            }
            "OWNER_VERIFIED" -> {
                val emeraldColor = ContextCompat.getColor(this, R.color.emerald_400)
                binding.tvSpeakerStatus.text = "Aap (Owner) Verified ✅"
                binding.tvSpeakerStatus.setTextColor(emeraldColor)
                binding.tvMatchPercent.text = "${matchPercent}%"
                binding.tvMatchPercent.setTextColor(emeraldColor)
                binding.pbMatch.progress = matchPercent.toInt().coerceIn(0, 100)
                binding.pbMatch.progressTintList = ColorStateList.valueOf(emeraldColor)

                val pitchInfo = if (pitch > 0) "Pitch: ${pitch}Hz • " else ""
                binding.tvBiometricDetail.text = "${pitchInfo}Owner Voice Confirmed (${matchPercent}%)"
                binding.tvYouSpoke.text = "\"$text\""
                binding.tvJarvisReply.text = "\"Haan boss, Rox sun raha hai. Boliye.\""
                binding.tvStatusSub.text = "Prabhat (+20% speed) Speaking..."
            }
            "STRANGER_BLOCKED" -> {
                val redColor = ContextCompat.getColor(this, R.color.red_400)
                binding.tvSpeakerStatus.text = "$text ❌"
                binding.tvSpeakerStatus.setTextColor(redColor)
                binding.tvMatchPercent.text = "${matchPercent}%"
                binding.tvMatchPercent.setTextColor(redColor)
                binding.pbMatch.progress = matchPercent.toInt().coerceIn(0, 100)
                binding.pbMatch.progressTintList = ColorStateList.valueOf(redColor)

                binding.tvBiometricDetail.text = "Voice Mismatch (${matchPercent}%) • SILENT GATE ACTIVATED"
                binding.tvJarvisReply.text = "🔇 [MUTED] Security Gate: Speaker is NOT the owner. Audio response blocked."
                binding.tvStatusSub.text = "Stranger Ignored • Zero Audio"
                binding.tvMicStatus.text = "Tap to Speak"
            }
            "SPEAKING" -> {
                binding.tvMicStatus.text = "ROX Speaking..."
            }
            "IDLE" -> {
                binding.tvMicStatus.text = "Tap to Speak"
            }
        }
    }

    private fun startListening() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            checkAndRequestPermissions()
            return
        }

        audioPlayer.stop()

        val started = audioRecorder.startRecording()
        if (started) {
            binding.btnMic.setImageResource(R.drawable.ic_stop)
            binding.btnMic.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.red_500))
            binding.tvMicStatus.text = "Listening... Tap to Stop"
            binding.tvDuration.visibility = View.VISIBLE
            binding.tvDuration.text = "00:00"

            recordDurationSeconds = 0
            durationJob?.cancel()
            durationJob = lifecycleScope.launch {
                while (isActive) {
                    delay(1000)
                    recordDurationSeconds++
                    val mins = recordDurationSeconds / 60
                    val secs = recordDurationSeconds % 60
                    binding.tvDuration.text = String.format("%02d:%02d", mins, secs)
                }
            }
        } else {
            Toast.makeText(this, "Could not start audio recording", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopListeningAndVerify() {
        durationJob?.cancel()
        durationJob = null

        binding.btnMic.setImageResource(R.drawable.ic_mic)
        binding.btnMic.backgroundTintList = null
        binding.tvMicStatus.text = "Verifying..."
        binding.tvDuration.visibility = View.INVISIBLE

        binding.tvSpeakerStatus.text = "Analyzing Voice Biometrics & Whisper AI..."
        binding.tvBiometricDetail.text = "Extracting YIN Pitch + 20-band Mel Filterbank..."

        lifecycleScope.launch {
            val recResult = audioRecorder.stopRecording()
            if (recResult == null || recResult.durationMs < 400) {
                binding.tvSpeakerStatus.text = "Audio too short. Please try again."
                binding.tvMicStatus.text = "Tap to Speak"
                return@launch
            }

            val isRegister = binding.switchRegister.isChecked
            val action = if (isRegister) "register" else "identify"

            val res = apiClient.transcribeAndVerify(
                wavFile = recResult.wavFile,
                voiceprintJson = recResult.features.vectorJson,
                pitch = recResult.features.pitch,
                action = action,
                language = "hinglish"
            )

            recResult.wavFile.delete() // Clean up temp WAV

            if (!res.success) {
                binding.tvSpeakerStatus.text = "Verification Error"
                binding.tvBiometricDetail.text = res.errorMessage ?: "Unknown error"
                binding.tvMicStatus.text = "Tap to Speak"
                return@launch
            }

            // Update Transcribed Speech
            binding.tvYouSpoke.text = if (res.text.isNotBlank()) "\"${res.text}\"" else "[Silence / Unrecognized]"

            // Update Biometric UI
            val matchInt = res.matchPercent.toInt().coerceIn(0, 100)
            binding.tvMatchPercent.text = "${res.matchPercent}%"
            binding.pbMatch.progress = matchInt

            if (res.isNewRegistration) {
                // SAMPLE SAVED!
                val sampleNum = res.sampleCount
                val emeraldColor = ContextCompat.getColor(this@MainActivity, R.color.emerald_400)
                binding.tvSpeakerStatus.setTextColor(emeraldColor)
                binding.tvMatchPercent.setTextColor(emeraldColor)
                binding.pbMatch.progressTintList = ColorStateList.valueOf(emeraldColor)

                val replyText: String
                if (sampleNum < 3) {
                    binding.tvModeBadge.text = "ENROLL ($sampleNum/3)"
                    binding.tvSpeakerStatus.text = "Sample $sampleNum/3 Saved ✅"
                    binding.tvBiometricDetail.text = "Sample $sampleNum save ho gaya! Niche Mic dabakar sample ${sampleNum + 1}/3 boliye."
                    replyText = "Sample $sampleNum save ho gaya boss. Ek aur sample boliye."
                } else {
                    binding.switchRegister.isChecked = false
                    binding.tvModeBadge.text = "IDENTIFY"
                    binding.tvSpeakerStatus.text = "Aap (Owner) - Enrolled (3/3) ✅"
                    binding.tvBiometricDetail.text = "Biometric Voiceprint 3 samples se lock ho gaya! Ab ROX sirf AAPKO reply dega."
                    replyText = "Aapki aawaz 3 samples ke sath register ho gayi hai boss. Ab Rox sirf aapki aawaz pehchanega."
                }

                binding.tvJarvisReply.text = "\"$replyText\""
                binding.tvStatusSub.text = "Prabhat (+20% speed) speaking..."

                val ttsUrl = apiClient.getTtsAudioUrl(replyText)
                audioPlayer.playUrl(
                    url = ttsUrl,
                    onStart = {
                        binding.tvMicStatus.text = "ROX Speaking..."
                    },
                    onComplete = {
                        binding.tvMicStatus.text = "Tap to Speak"
                        binding.tvStatusSub.text = "● Reply completed"
                    },
                    onError = { err ->
                        binding.tvMicStatus.text = "Tap to Speak"
                        binding.tvStatusSub.text = "TTS playback error: $err"
                    }
                )
            } else if (res.isOwner) {
                // OWNER VERIFIED!
                val emeraldColor = ContextCompat.getColor(this@MainActivity, R.color.emerald_400)
                binding.tvSpeakerStatus.text = "${res.speakerName} ✅"
                binding.tvSpeakerStatus.setTextColor(emeraldColor)
                binding.tvMatchPercent.setTextColor(emeraldColor)
                binding.pbMatch.progressTintList = ColorStateList.valueOf(emeraldColor)

                val pitchInfo = if (res.pitch > 0) "Pitch: ${res.pitch}Hz • " else ""
                binding.tvBiometricDetail.text = "$pitchInfo${res.detail.ifBlank { "Owner identity confirmed." }}"

                val replyText = "Haan boss, Rox online hai. Aapki aawaz verify ho gayi hai."
                binding.tvJarvisReply.text = "\"$replyText\""
                binding.tvStatusSub.text = "Prabhat (+20% speed) speaking..."

                val ttsUrl = apiClient.getTtsAudioUrl(replyText)
                audioPlayer.playUrl(
                    url = ttsUrl,
                    onStart = {
                        binding.tvMicStatus.text = "ROX Speaking..."
                    },
                    onComplete = {
                        binding.tvMicStatus.text = "Tap to Speak"
                        binding.tvStatusSub.text = "● Reply completed"
                    },
                    onError = { err ->
                        binding.tvMicStatus.text = "Tap to Speak"
                        binding.tvStatusSub.text = "TTS playback error: $err"
                    }
                )
            } else {
                // NOT OWNER! STRICT SECURITY GATE ACTIVATION: SILENT!
                val redColor = ContextCompat.getColor(this@MainActivity, R.color.red_400)
                binding.tvSpeakerStatus.text = "${res.speakerName} ❌"
                binding.tvSpeakerStatus.setTextColor(redColor)
                binding.tvMatchPercent.setTextColor(redColor)
                binding.pbMatch.progressTintList = ColorStateList.valueOf(redColor)

                val pitchInfo = if (res.pitch > 0) "Pitch: ${res.pitch}Hz • " else ""
                binding.tvBiometricDetail.text = "$pitchInfo${res.detail.ifBlank { "Voice mismatch." }} • Access Denied! (STRANGER)"

                binding.tvJarvisReply.text = "🔇 [MUTED] Security Gate: Speaker is NOT the owner. Audio output blocked."
                binding.tvStatusSub.text = "Stranger Ignored • Zero Audio Response"
                binding.tvMicStatus.text = "Tap to Speak"
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        durationJob?.cancel()
        audioPlayer.stop()
    }
}
