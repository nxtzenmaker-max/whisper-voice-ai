'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Zap,
  Play,
  Square,
  Sparkles,
  Check,
  ArrowLeft,
  Bot,
  MessageSquare,
  Loader2,
  Volume2,
  Sliders,
  Shield,
  Activity,
} from 'lucide-react';

const TONY_QUICK_PROMPTS = [
  'Hey boss, data analyze ho gaya hai. All systems online, what is our next mission?',
  'Voice match ho gaya hai, welcome back boss!',
  'Bataiye boss, what is the plan today? Main bilkul ready hoon.',
  'Mummy bol rahi thi isliye maine koi reply nahi diya.',
  'Command executed successfully boss, sab theek hai.',
];

export default function TonyVoiceStudio() {
  const [voiceMode, setVoiceMode] = useState<'Tony' | 'Tony-US'>('Tony');
  const [pitch, setPitch] = useState<string>('default');
  const [rate, setRate] = useState<string>('105%');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(
    'Hey boss, data analyze ho gaya hai. All systems online, what is our next mission?'
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load saved Tony config
    const saved = localStorage.getItem('selected_ai_voice');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.voiceKey === 'Tony-US' || parsed.voiceKey === 'Tony') {
          setVoiceMode(parsed.voiceKey);
        }
        if (parsed.pitch) setPitch(parsed.pitch);
        if (parsed.rate) setRate(parsed.rate);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const playTony = (textToPlay?: string, modeOverride?: 'Tony' | 'Tony-US') => {
    stopPlayback();
    const text = textToPlay || customText;
    const mode = modeOverride || voiceMode;

    setIsLoadingAudio(true);

    const url = `/api/tts?voice=${encodeURIComponent(mode)}&pitch=${encodeURIComponent(
      pitch
    )}&rate=${encodeURIComponent(rate)}&text=${encodeURIComponent(text)}`;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setIsLoadingAudio(false);
      setIsPlaying(true);
      audio.play().catch(() => {
        setIsPlaying(false);
        setIsLoadingAudio(false);
      });
    };

    audio.onended = () => {
      setIsPlaying(false);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setIsLoadingAudio(false);
      audioRef.current = null;
    };

    audio.load();
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  const handleSaveTony = () => {
    const config = {
      id: 'tony-ai',
      name: 'Tony',
      voiceKey: voiceMode,
      pitch,
      rate,
    };
    localStorage.setItem('selected_ai_voice', JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    const confirmMsg =
      voiceMode === 'Tony'
        ? 'Aawaz lock ho gayi hai boss! Main Tony hoon, ab se isi voice me baat hogi.'
        : 'Voice locked boss! Tony AI assistant is online and operational.';

    playTony(confirmMsg);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6">
      {/* Top Navbar */}
      <header className="w-full max-w-2xl flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Assistant</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Tony Voice Control
              </h1>
              <p className="text-[10px] text-slate-400">Personal AI Assistant Voice</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveTony}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" /> Saved!
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-black" /> Lock Tony Voice
            </>
          )}
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mt-5 space-y-4">
        {/* Tony Hero Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/50 shadow-2xl shadow-amber-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
                  <Bot className="w-8 h-8 text-black" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">Tony</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    Your AI Assistant ⚡
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fast, confident & tech-savvy male AI. Speaks crystal-clear Hinglish.
                </p>
              </div>
            </div>

            <button
              onClick={() => (isPlaying ? stopPlayback() : playTony())}
              disabled={isLoadingAudio}
              className={`p-3 rounded-2xl border transition shadow-lg cursor-pointer flex items-center justify-center ${
                isPlaying
                  ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-amber-400 border-slate-700'
              }`}
              title="Test Tony Audio"
            >
              {isLoadingAudio ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="mt-5 grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => {
                setVoiceMode('Tony');
                playTony(undefined, 'Tony');
              }}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                voiceMode === 'Tony'
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Tony Hinglish
                </span>
                {voiceMode === 'Tony' && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                100% natural, crystal-clear Hinglish. Clean Hindi + English tech terms.
              </p>
            </button>

            <button
              onClick={() => {
                setVoiceMode('Tony-US');
                playTony(undefined, 'Tony-US');
              }}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                voiceMode === 'Tony-US'
                  ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-md shadow-cyan-500/10'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" /> Tony Stark (US)
                </span>
                {voiceMode === 'Tony-US' && <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Original American accent. Best for pure English commands.
              </p>
            </button>
          </div>

          {/* Sliders: Pitch & Speed */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1.5 text-[11px]">
                <span className="flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-amber-400" /> Aawaz (Pitch)
                </span>
                <span className="text-amber-400 font-mono font-bold">
                  {pitch === '-22%' ? 'Deep Male' : pitch === '-18%' ? 'Confident' : 'Sharp Tech'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: 'Deep', val: '-22%' },
                  { label: 'Optimal', val: '-18%' },
                  { label: 'Sharp', val: '-12%' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => {
                      setPitch(item.val);
                      playTony();
                    }}
                    className={`py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      pitch === item.val
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1.5 text-[11px]">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-amber-400" /> Speed (Rate)
                </span>
                <span className="text-amber-400 font-mono font-bold">
                  {rate === '112%' ? 'Fast' : rate === '108%' ? 'Crisp' : 'Normal'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: '1.0x', val: '100%' },
                  { label: '1.1x', val: '108%' },
                  { label: '1.15x', val: '112%' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => {
                      setRate(item.val);
                      playTony();
                    }}
                    className={`py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      rate === item.val
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Audition Box */}
        <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> Tony Se Kuch Bhi Bolwayein
            </label>
            <span className="text-[10px] text-slate-500 font-mono">Realtime Speech</span>
          </div>

          <div className="relative">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={3}
              placeholder="Hinglish ya English me likhein..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/80 transition resize-none leading-relaxed"
            />

            <button
              onClick={() => (isPlaying ? stopPlayback() : playTony(customText))}
              disabled={isLoadingAudio || !customText.trim()}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center gap-1 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isLoadingAudio ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-black" /> Stop
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" /> Tony Sunao
                </>
              )}
            </button>
          </div>

          {/* Quick Audition Chips */}
          <div className="mt-3">
            <span className="text-[10px] text-slate-500 font-bold block mb-1.5">
              ⚡ Quick Test Prompts (Click karke suniye):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TONY_QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCustomText(prompt);
                    playTony(prompt);
                  }}
                  className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-slate-800 hover:border-amber-500/40 transition cursor-pointer"
                >
                  &quot;{prompt.slice(0, 36)}...&quot;
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
