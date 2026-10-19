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
  Activity,
  UserCheck,
} from 'lucide-react';

const PRABHAT_QUICK_PROMPTS = [
  'Haan boss, boliye kya madad karoon? Data analyze ho gaya hai, all systems ready hain.',
  'Aapka voice match ho gaya hai, welcome back boss!',
  'Bhai, aaj ka kya plan hai? Main bilkul tayyar hoon.',
  'Mummy bol rahi thi isliye maine koi reply nahi diya.',
  'Command successfully execute ho gaya hai, all clear boss.',
];

export default function PrabhatVoiceStudio() {
  const [rate, setRate] = useState<string>('+20%');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(
    'Haan boss, boliye kya madad karoon? Data analyze ho gaya hai, all systems ready hain.'
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('selected_ai_voice');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rate) setRate(parsed.rate);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const playVoice = (textToPlay?: string, rateOverride?: string) => {
    stopPlayback();
    const text = textToPlay || customText;
    const activeRate = rateOverride || rate;

    setIsLoadingAudio(true);

    const url = `/api/tts?voice=en-IN-PrabhatNeural&rate=${encodeURIComponent(
      activeRate
    )}&text=${encodeURIComponent(text)}`;

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

  const handleSaveVoice = () => {
    const config = {
      id: 'prabhat-male',
      name: 'Prabhat',
      voiceKey: 'Prabhat',
      engine: 'en-IN-PrabhatNeural',
      rate,
    };
    localStorage.setItem('selected_ai_voice', JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    playVoice('Aawaz lock ho gayi hai boss! Main Prabhat hoon, ab se isi voice me baat hogi.');
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
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Prabhat AI Voice Control
              </h1>
              <p className="text-[10px] text-slate-400">Indian Tech Male • Real Hinglish</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveVoice}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" /> Locked!
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-black" /> Lock Prabhat Voice
            </>
          )}
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mt-5 space-y-4">
        {/* Prabhat Hero Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <Bot className="w-8 h-8 text-black" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">Prabhat</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    Indian Male AI 🇮🇳
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Real Indian Tech Male voice. Speaks 100% natural, crisp, fast Hinglish!
                </p>
              </div>
            </div>

            <button
              onClick={() => (isPlaying ? stopPlayback() : playVoice())}
              disabled={isLoadingAudio}
              className={`p-3 rounded-2xl border transition shadow-lg cursor-pointer flex items-center justify-center ${
                isPlaying
                  ? 'bg-emerald-500 text-black border-emerald-400 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border-slate-700'
              }`}
              title="Test Prabhat Audio"
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

          {/* Speed Selector */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Prabhat Ki Speed:
              </span>
              <span className="text-emerald-400 font-mono font-bold">
                {rate === '+20%' ? 'Fast & Punchy (+20%) ⚡' : rate === '+30%' ? 'Ultra Fast (+30%) 🚀' : 'Smooth (+10%)'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Smooth (+10%)', val: '+10%' },
                { label: 'Fast (+20%) ⚡', val: '+20%' },
                { label: 'Ultra Fast (+30%) 🚀', val: '+30%' },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => {
                    setRate(item.val);
                    playVoice(undefined, item.val);
                  }}
                  className={`py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    rate === item.val
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Audition Box */}
        <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Prabhat Se Kuch Bhi Bolwayein
            </label>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md">
              Real Indian Male 🇮🇳
            </span>
          </div>

          <div className="relative">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={3}
              placeholder="Hinglish ya English me likhein..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 transition resize-none leading-relaxed"
            />

            <button
              onClick={() => (isPlaying ? stopPlayback() : playVoice(customText))}
              disabled={isLoadingAudio || !customText.trim()}
              className="absolute bottom-3 right-3 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center gap-1 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isLoadingAudio ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-black" /> Stop
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" /> Prabhat Sunao
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
              {PRABHAT_QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCustomText(prompt);
                    playVoice(prompt);
                  }}
                  className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer"
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
