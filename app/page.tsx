'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  User,
  Users,
  Database,
  Zap,
  Trash2,
  Copy,
  Check,
  Settings,
  Plus,
  Volume2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface Transcription {
  id: string;
  speaker_name: string;
  is_owner: boolean;
  text: string;
  latency_ms: number;
  created_at: string;
}

interface Speaker {
  id: string;
  name: string;
  is_owner: boolean;
}

export default function Home() {
  const [history, setHistory] = useState<Transcription[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([
    { id: '1', name: 'Aap (Owner)', is_owner: true },
    { id: '2', name: 'Guest / Dost', is_owner: false },
  ]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker>({
    id: '1',
    name: 'Aap (Owner)',
    is_owner: true,
  });
  const [language, setLanguage] = useState<string>('hi');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [groqKey, setGroqKey] = useState<string>('');
  const [showAddSpeaker, setShowAddSpeaker] = useState<boolean>(false);
  const [newSpeakerName, setNewSpeakerName] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchSpeakers();
    const savedKey = localStorage.getItem('custom_groq_key') || '';
    setGroqKey(savedKey);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (e) {
      console.error('Fetch history error:', e);
    }
  };

  const fetchSpeakers = async () => {
    try {
      const res = await fetch('/api/speakers');
      const data = await res.json();
      if (data.speakers && data.speakers.length > 0) {
        setSpeakers(data.speakers);
        const owner = data.speakers.find((s: Speaker) => s.is_owner) || data.speakers[0];
        setSelectedSpeaker(owner);
      }
    } catch (e) {
      console.error('Fetch speakers error:', e);
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

      // Audio meter
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
        await handleSendAudio(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

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

  const handleSendAudio = async (blob: Blob) => {
    if (blob.size < 500) return;
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('file', blob, 'voice.webm');
    formData.append('speaker_name', selectedSpeaker.name);
    formData.append('is_owner', String(selectedSpeaker.is_owner));
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
      if (data.text) {
        setHistory((prev) => [
          {
            id: data.id,
            speaker_name: data.speaker_name,
            is_owner: data.is_owner,
            text: data.text,
            latency_ms: data.latency_ms,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSpeaker = async () => {
    if (!newSpeakerName.trim()) return;
    try {
      const res = await fetch('/api/speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpeakerName.trim(), is_owner: false }),
      });
      const data = await res.json();
      if (data.id) {
        setSpeakers((prev) => [...prev, data]);
        setSelectedSpeaker(data);
        setNewSpeakerName('');
        setShowAddSpeaker(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Kya aap saara history delete karna chahte hain?')) return;
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

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6">
      {/* Top Navbar */}
      <header className="w-full max-w-2xl flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Whisper Voice AI
            </h1>
            <p className="text-[11px] text-slate-400">Turso Edge DB • Groq Whisper LPU</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-2xl flex-1 flex flex-col mt-4">
        {/* Controls Card */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          {/* Speaker Selector */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Kaun bol raha hai (Speaker):
              </label>
              <button
                onClick={() => setShowAddSpeaker(true)}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Naya Speaker
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {speakers.map((sp) => {
                const isSelected = selectedSpeaker.id === sp.id;
                return (
                  <button
                    key={sp.id}
                    onClick={() => setSelectedSpeaker(sp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                      isSelected
                        ? sp.is_owner
                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                          : 'bg-blue-500/20 border border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${sp.is_owner ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                    {sp.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Selector */}
          <div className="mt-3.5 flex items-center justify-between pt-3 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Bhasha (Language):</span>
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  language === 'hi' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  language === 'en' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('auto')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  language === 'auto' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Auto
              </button>
            </div>
          </div>
        </section>

        {/* Record Walkie-Talkie Button */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <div
                className="absolute w-32 h-32 rounded-full bg-red-500/20 animate-ping pointer-events-none"
                style={{ transform: `scale(${1 + audioLevel / 100})` }}
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
                  : 'bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-cyan-500/30 hover:scale-105 active:scale-95'
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
                  <span className="text-[9px] font-medium text-cyan-100 tracking-wider mt-0.5 uppercase">
                    Tap to Talk
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Volume Level Bar */}
          <div className="w-36 h-1.5 bg-slate-900 rounded-full mt-3 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
              style={{ width: `${audioLevel}%` }}
            />
          </div>

          <p className="text-xs text-slate-400 mt-2 font-medium">
            {isRecording
              ? '🎙️ Sun raha hoon... Bol kar button dobara dabayein'
              : isProcessing
              ? '⚡ Groq Whisper + Turso DB process kar raha hai...'
              : 'Button dabayein aur bolna shuru karein'}
          </p>
        </div>

        {/* History / Feed Section */}
        <section className="flex-1 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Turso DB Live Feed ({history.length})
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

          <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-3 pr-1">
            {history.length === 0 ? (
              <div className="m-auto text-center py-12 text-slate-500 text-xs">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                Abhi tak koi recording nahi hai.
                <br />
                Upar mic button daba kar boliye!
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition ${
                    item.is_owner
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
                      : 'bg-blue-950/20 border-blue-500/30 text-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        item.is_owner ? 'text-emerald-400' : 'text-blue-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${item.is_owner ? 'bg-emerald-400' : 'bg-blue-400'}`}
                      />
                      {item.speaker_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                        ⚡ {item.latency_ms}ms
                      </span>
                      <button
                        onClick={() => copyToClipboard(item.text, item.id)}
                        className="text-slate-400 hover:text-white transition"
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
                  <p className="text-sm font-normal text-slate-100 leading-relaxed">
                    &ldquo;{item.text}&rdquo;
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Add Speaker Modal */}
      {showAddSpeaker && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Naya Speaker Add Karein
            </h3>
            <input
              type="text"
              placeholder="Speaker ka naam (e.g. Rahul, Boss, Guest)..."
              value={newSpeakerName}
              onChange={(e) => setNewSpeakerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddSpeaker(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSpeaker}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              API & Database Settings
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Vercel par deploy karte waqt aap yeh Environment Variables me bhi daal sakte hain.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Custom Groq API Key (Optional)
                </label>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    localStorage.setItem('custom_groq_key', e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-200 block">Turso DB Connection:</span>
                <span>• `TURSO_DATABASE_URL` (libsql://...)</span>
                <br />
                <span>• `TURSO_AUTH_TOKEN` (ey...)</span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Local dev me yeh automatically `file:local.db` par chalta hai.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold"
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
