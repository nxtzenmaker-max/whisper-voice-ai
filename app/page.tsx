'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Mic,
  MicOff,
  Copy,
  Check,
  Settings,
  Trash2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Fingerprint,
  UserCheck,
  UserX,
  Database,
  PlusCircle,
  CheckCircle2,
  Volume2,
} from 'lucide-react';

interface Transcription {
  id: string;
  speaker_name: string;
  is_owner: boolean;
  match_percent: number;
  pitch?: number;
  text: string;
  latency_ms: number;
  created_at: string;
}

// Fast YIN Algorithm for accurate fundamental pitch (F0) detection
function detectPitchYin(buffer: Float32Array, sampleRate: number): number | null {
  const minPeriod = Math.floor(sampleRate / 350); // ~45 (up to 350 Hz)
  const maxPeriod = Math.floor(sampleRate / 65); // ~246 (down to 65 Hz)
  const W = 1000;
  if (buffer.length < W + maxPeriod) return null;

  const d = new Float32Array(maxPeriod + 1);
  for (let tau = 0; tau <= maxPeriod; tau++) {
    let diff = 0;
    for (let i = 0; i < W; i++) {
      const delta = buffer[i] - buffer[i + tau];
      diff += delta * delta;
    }
    d[tau] = diff;
  }

  const cmnd = new Float32Array(maxPeriod + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxPeriod; tau++) {
    runningSum += d[tau];
    cmnd[tau] = d[tau] / (runningSum / tau);
  }

  let period = -1;
  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    if (cmnd[tau] < 0.20) {
      while (tau + 1 <= maxPeriod && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      period = tau;
      break;
    }
  }

  return period > 0 ? Math.round(sampleRate / period) : null;
}

// Iterative in-place Radix-2 FFT
function fftIterative(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) { j -= k; k >>= 1; }
    j += k;
  }
  for (let l = 2; l <= n; l <<= 1) {
    const half = l >> 1;
    const ang = -2 * Math.PI / l;
    const wStepR = Math.cos(ang), wStepI = Math.sin(ang);
    for (let i = 0; i < n; i += l) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const idx1 = i + k;
        const idx2 = i + k + half;
        const tr = wr * real[idx2] - wi * imag[idx2];
        const ti = wr * imag[idx2] + wi * real[idx2];
        real[idx2] = real[idx1] - tr;
        imag[idx2] = imag[idx1] - ti;
        real[idx1] += tr;
        imag[idx1] += ti;
        const nextWr = wr * wStepR - wi * wStepI;
        wi = wr * wStepI + wi * wStepR;
        wr = nextWr;
      }
    }
  }
}

function hzToMel(hz: number) { return 2595 * Math.log10(1 + hz / 700); }
function melToHz(mel: number) { return 700 * (Math.pow(10, mel / 2595) - 1); }

export default function Home() {
  const [history, setHistory] = useState<Transcription[]>([]);
  const [hasOwnerVoice, setHasOwnerVoice] = useState<boolean>(false);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [avgPitch, setAvgPitch] = useState<number | null>(null);
  const [pitchRange, setPitchRange] = useState<string>('');
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('hinglish');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Suggested registration prompts
  const registerPrompts = [
    'Sample 1/3: "Namaste! Mera naam Jaino hai aur main owner hoon."',
    'Sample 2/3: "Aaj ka din kaisa hai aur kya chal raha hai?"',
    'Sample 3/3: "Whisper Voice AI automatic multi-speaker test."',
  ];

  // Settings
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [groqKey, setGroqKey] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchHistory();
    checkOwnerStatus();
    const savedKey = localStorage.getItem('custom_groq_key') || '';
    setGroqKey(savedKey);
  }, []);

  const checkOwnerStatus = async () => {
    try {
      const res = await fetch('/api/voiceprint');
      const data = await res.json();
      setHasOwnerVoice(Boolean(data.has_owner));
      setSampleCount(data.sample_count || 0);
      setAvgPitch(data.avg_pitch || null);
      if (data.min_pitch && data.max_pitch) {
        setPitchRange(`${data.min_pitch}-${data.max_pitch}Hz`);
      }
      if (!data.has_owner) {
        setIsRegisterMode(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (e) {
      console.error('Fetch history error:', e);
    }
  };

  // Extract a 20-dimensional Mel-frequency vector + Pitch (F0) from audio
  const extractVoiceFeatures = async (
    audioBlob: Blob
  ): Promise<{ vector: number[]; pitch: number }> => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const offlineCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = 16000;

      // 1. Detect Fundamental Pitch (F0) across voiced chunks
      const pitches: number[] = [];
      const frameStep = 3200; // 0.2s step
      for (let i = 0; i <= channelData.length - 2000; i += frameStep) {
        const slice = channelData.subarray(i, i + 2000);
        let energy = 0;
        for (let j = 0; j < slice.length; j++) energy += slice[j] * slice[j];
        if (energy > 0.05) {
          const p = detectPitchYin(slice, sampleRate);
          if (p && p >= 65 && p <= 350) pitches.push(p);
        }
      }
      pitches.sort((a, b) => a - b);
      const medianPitch = pitches.length > 0 ? pitches[Math.floor(pitches.length / 2)] : 0;

      // 2. Real FFT and 20-band Mel Filterbank
      const N = 512;
      const numMelBands = 20;
      const melPoints: number[] = [];
      const minMel = hzToMel(100);
      const maxMel = hzToMel(sampleRate / 2);
      for (let i = 0; i < numMelBands + 2; i++) {
        const hz = melToHz(minMel + (maxMel - minMel) * (i / (numMelBands + 1)));
        melPoints.push(Math.floor((hz / sampleRate) * N));
      }

      const melEnergies = new Float32Array(numMelBands);
      let framesCount = 0;

      for (let start = 0; start <= channelData.length - N; start += N / 2) {
        framesCount++;
        const real = new Float32Array(N);
        const imag = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))); // Hann window
          real[i] = channelData[start + i] * win;
        }

        fftIterative(real, imag);

        for (let m = 0; m < numMelBands; m++) {
          const left = melPoints[m];
          const center = melPoints[m + 1];
          const right = melPoints[m + 2];
          let bandEnergy = 0;
          for (let k = left; k < right; k++) {
            const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
            const weight = k < center ? (k - left) / (center - left || 1) : (right - k) / (right - center || 1);
            bandEnergy += mag * weight;
          }
          melEnergies[m] += bandEnergy;
        }
      }

      offlineCtx.close();

      if (framesCount > 0) {
        for (let m = 0; m < numMelBands; m++) melEnergies[m] /= framesCount;
      }

      // L2 Normalize
      let sumSq = 0;
      for (let m = 0; m < numMelBands; m++) sumSq += melEnergies[m] * melEnergies[m];
      const norm = Math.sqrt(sumSq) || 1;
      const vector = Array.from(melEnergies).map((v) => Number((v / norm).toFixed(4)));

      return { vector, pitch: medianPitch };
    } catch (err) {
      console.error('Feature extraction error:', err);
      return { vector: [], pitch: 0 };
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Audio Level meter
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round(avg * 2.5)));
        requestAnimationFrame(updateMeter);
      };
      updateMeter();

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await handleProcessVoice(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);
      setStatusMessage(
        isRegisterMode
          ? `Sample ${Math.min(sampleCount + 1, 3)} bol rahe hain... (3-5s bolein)`
          : 'Sun raha hoon... Boliye!'
      );

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert('Microphone permission required: ' + err.message);
      stopRecording();
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setAudioLevel(0);
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleProcessVoice = async (blob: Blob) => {
    if (blob.size < 600) return;
    setIsProcessing(true);
    setStatusMessage('Voice analysis aur Groq Whisper transcription ho raha hai...');

    // 1. Extract Mel-scale vector + pitch in browser
    const { vector, pitch } = await extractVoiceFeatures(blob);

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append('file', blob, 'speech.webm');
    formData.append('action', isRegisterMode ? 'register' : 'identify');
    formData.append('voiceprint', JSON.stringify(vector));
    formData.append('pitch', pitch.toString());
    formData.append('language', language);

    const headers: Record<string, string> = {};
    if (groqKey) headers['x-groq-api-key'] = groqKey;

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();

      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      if (data.is_new_registration) {
        setHasOwnerVoice(true);
        const count = data.sample_count || sampleCount + 1;
        setSampleCount(count);
        if (data.pitch) setAvgPitch(data.pitch);
        if (count >= 3) {
          setIsRegisterMode(false);
          setStatusMessage('🎉 3/3 Voice Samples Complete! Voice Profile Locked & Ready!');
        } else {
          setStatusMessage(`✅ Sample ${count} Saved! Ab alag sentence bolein (Sample ${count + 1}/3)...`);
        }
      } else {
        const icon = data.is_owner ? '🟢' : '🔵';
        const pitchText = data.pitch > 0 ? ` [${data.pitch}Hz]` : '';
        setStatusMessage(
          `${icon} ${data.speaker_name} • ${data.match_percent}% Match${pitchText}`
        );
      }

      if (data.text) {
        setHistory((prev) => [
          {
            id: data.id,
            speaker_name: data.speaker_name,
            is_owner: data.is_owner,
            match_percent: data.match_percent,
            pitch: data.pitch,
            text: data.text,
            latency_ms: data.latency_ms,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error('Processing error:', err);
      setStatusMessage('Error processing audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetVoiceprint = async () => {
    if (!confirm('Kya aap saare saved Owner Voice Samples delete karna chahte hain?')) return;
    try {
      await fetch('/api/voiceprint', { method: 'DELETE' });
      setHasOwnerVoice(false);
      setSampleCount(0);
      setAvgPitch(null);
      setPitchRange('');
      setIsRegisterMode(true);
      setStatusMessage('Voice samples reset ho gaye. Alag-alag 3 voice notes record karein.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Saari transcription history delete karein?')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const playAudioItem = (text: string, id: string) => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    if (playingItemId === id) {
      setPlayingItemId(null);
      return;
    }

    let voiceKey = 'Brian';
    try {
      const saved = localStorage.getItem('selected_ai_voice');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.voiceKey) voiceKey = parsed.voiceKey;
      }
    } catch (e) {}

    setPlayingItemId(id);
    const audio = new Audio(`/api/tts?voice=${encodeURIComponent(voiceKey)}&text=${encodeURIComponent(text)}`);
    ttsAudioRef.current = audio;

    audio.onended = () => {
      setPlayingItemId(null);
      ttsAudioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingItemId(null);
      ttsAudioRef.current = null;
    };
    audio.play().catch(() => setPlayingItemId(null));
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6">
      {/* Top Navbar */}
      <header className="w-full max-w-2xl flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Voiceprint AI Speaker ID
            </h1>
            <p className="text-[11px] text-slate-400">Multi-Sample Voice Enrollment • Turso Edge DB</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/voices"
            className="p-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition flex items-center gap-1.5 text-xs font-bold shadow-sm"
            title="AI Voice Studio"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Voice Studio 🔊</span>
          </Link>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl flex-1 flex flex-col mt-3.5">
        {/* Owner Multi-Sample Status Bar */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs">
            {hasOwnerVoice ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Owner: Active ({sampleCount} {sampleCount === 1 ? 'Sample' : 'Samples'}
                {pitchRange ? ` • ${pitchRange}` : avgPitch ? ` • ~${avgPitch}Hz` : ''}) ✅
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30">
                <UserX className="w-4 h-4 text-amber-400" />
                Owner Voice: Not Registered ({sampleCount}/3 Samples) ⚠️
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasOwnerVoice && (
              <button
                onClick={handleResetVoiceprint}
                className="text-[11px] text-slate-400 hover:text-red-400 transition flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800"
                title="Reset All Samples"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            )}

            <button
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                isRegisterMode
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
              }`}
            >
              {isRegisterMode ? (
                <>🎙️ Registering ({sampleCount}/3)</>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  {sampleCount === 0 ? 'Register Voice' : 'Add Sample'}
                </>
              )}
            </button>
          </div>
        </section>

        {/* Multi-Sample Prompt Card (if registering) */}
        {isRegisterMode && (
          <div className="mt-3 p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1.5">
              <span>🎙️ Voice Enrollment (Alag-Alag 3 Samples Boliye):</span>
              <span>{sampleCount}/3 Samples</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              👉 {registerPrompts[sampleCount % registerPrompts.length]}
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex-1 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (sampleCount / 3) * 100)}%` }}
                />
              </div>
              {sampleCount > 0 && (
                <button
                  onClick={() => setIsRegisterMode(false)}
                  className="text-[11px] text-emerald-400 font-semibold hover:underline"
                >
                  Done (Identify Mode) →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Language Bar */}
        <div className="mt-2.5 flex items-center justify-between px-1">
          <span className="text-[11px] text-slate-400 font-medium">Bhasha / Script:</span>
          <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setLanguage('hinglish')}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition ${
                language === 'hinglish' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hinglish (ABCD)
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition ${
                language === 'hi' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              हिन्दी (कखग)
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition ${
                language === 'en' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Record Walkie-Talkie Button */}
        <div className="my-5 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <div
                className="absolute w-32 h-32 rounded-full bg-red-500/20 animate-ping pointer-events-none"
                style={{ transform: `scale(${1 + audioLevel / 80})` }}
              />
            )}
            <button
              onClick={toggleRecording}
              disabled={isProcessing}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-2xl transition duration-200 cursor-pointer ${
                isRecording
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 shadow-red-500/40 scale-105'
                  : isProcessing
                  ? 'bg-slate-800 text-slate-400 opacity-60'
                  : isRegisterMode
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-600 shadow-amber-500/30 hover:scale-105'
                  : 'bg-gradient-to-tr from-emerald-500 to-cyan-600 shadow-emerald-500/30 hover:scale-105 active:scale-95'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-8 h-8 text-white mb-0.5" />
                  <span className="text-[10px] font-mono font-bold text-white tracking-wider">
                    {formatDuration(recordDuration)}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-9 h-9 text-white" />
                  <span className="text-[9px] font-medium text-emerald-100 tracking-wider mt-0.5 uppercase">
                    {isRegisterMode ? `Save (${sampleCount + 1}/3)` : 'Tap to Speak'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Volume Bar */}
          <div className="w-36 h-1.5 bg-slate-900 rounded-full mt-3 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
              style={{ width: `${audioLevel}%` }}
            />
          </div>

          <p className="text-xs text-slate-300 mt-2 font-medium text-center px-4">
            {statusMessage ||
              (isRegisterMode
                ? `Alag sentence me boliye taaki voice sample save ho sake (${sampleCount}/3)`
                : 'Boliye, aap bolenge toh GREEN ho jayega!')}
          </p>
        </div>

        {/* Live Feed & History from Turso DB ("aur green hojaaye jo bhi bolu") */}
        <section className="flex-1 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Live Transcription Feed ({history.length})
              </h2>
            </div>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[11px] text-slate-400 hover:text-red-400 transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-3.5 pr-1">
            {history.length === 0 ? (
              <div className="m-auto text-center py-10 text-slate-500 text-xs">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                Abhi tak koi recording nahi hai.
                <br />
                Mic button daba kar boliye, aapki aawaz aate hi <span className="text-emerald-400 font-bold">GREEN</span> ho jayega!
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl transition-all duration-200 ${
                    item.is_owner
                      ? 'bg-gradient-to-br from-emerald-950/60 via-slate-950 to-emerald-950/40 border-2 border-emerald-500/80 shadow-xl shadow-emerald-500/15 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900/60 border border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        item.is_owner ? 'text-emerald-300' : 'text-blue-400'
                      }`}
                    >
                      {item.is_owner ? (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Aap (Owner)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                          <UserX className="w-3.5 h-3.5 text-blue-400" />
                          {item.speaker_name}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800">
                        {item.match_percent > 0 ? `${item.match_percent}% Match • ` : ''}
                        {item.pitch && item.pitch > 0 ? `${item.pitch}Hz • ` : ''}
                        ⚡ {item.latency_ms}ms
                      </span>
                      <button
                        onClick={() => playAudioItem(item.text, item.id)}
                        className={`transition p-1 ${
                          playingItemId === item.id
                            ? 'text-emerald-400 animate-pulse'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="Listen with AI Voice"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(item.text, item.id)}
                        className="text-slate-400 hover:text-white transition p-1"
                        title="Copy text"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      item.is_owner ? 'text-emerald-100 font-semibold' : 'text-slate-200 font-normal'
                    }`}
                  >
                    {item.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              API & Turso Database Settings
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Vercel par deploy karte waqt yeh Environment Variables me set kar sakte hain.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Groq API Key (Optional Override)
                </label>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    localStorage.setItem('custom_groq_key', e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800 font-mono space-y-1">
                <span className="font-bold text-slate-300 block mb-1">Turso DB Config (.env):</span>
                <span>• `TURSO_DATABASE_URL` (libsql://...)</span>
                <br />
                <span>• `TURSO_AUTH_TOKEN` (ey...)</span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Local me yeh automatically fallback `file:local.db` par save hota hai.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
