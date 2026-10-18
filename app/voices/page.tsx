'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Check,
  Sliders,
  ArrowLeft,
  Bot,
  Zap,
  Radio,
  Heart,
  Shield,
  RefreshCw,
  SlidersHorizontal,
  MessageSquare,
} from 'lucide-react';

interface VoicePersona {
  id: string;
  name: string;
  badge: string;
  lang: string;
  gender: 'male' | 'female';
  desc: string;
  sampleText: string;
  defaultPitch: number;
  defaultRate: number;
  icon: any;
  color: string;
}

const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'jarvis-uk',
    name: 'Jarvis (British Deep Hinglish)',
    badge: 'Iron Man Style 🤖',
    lang: 'en-GB',
    gender: 'male',
    desc: 'Deep, calm, and royal British butler tone speaking natural Hinglish. Best for Jarvis assistant.',
    sampleText: 'Good evening boss, aapka saara system online hai. Boliye, aaj kya order hai?',
    defaultPitch: 0.82,
    defaultRate: 0.95,
    icon: Bot,
    color: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'desi-techie',
    name: 'Rohan (Desi Bro Hinglish)',
    badge: 'Most Natural Hinglish 🇮🇳',
    lang: 'en-IN',
    gender: 'male',
    desc: 'Natural Indian accent. Speaks casual Hinglish words cleanly with a friendly bhai tone.',
    sampleText: 'Haan bhai, boliye kya scene hai? Aapka code aur database sab tayyar hai.',
    defaultPitch: 0.95,
    defaultRate: 1.0,
    icon: Radio,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'swara-hindi',
    name: 'Pooja (Friendly Female Hinglish)',
    badge: 'Sweet & Polite 🌸',
    lang: 'en-IN',
    gender: 'female',
    desc: 'Sweet, polite, and crystal-clear female voice speaking natural conversational Hinglish.',
    sampleText: 'Hello! Main aapki AI assistant hoon. Boliye, aaj main aapki kya help kar sakti hoon?',
    defaultPitch: 1.05,
    defaultRate: 0.95,
    icon: Heart,
    color: 'from-rose-500 to-pink-600',
  },
  {
    id: 'tony-us',
    name: 'Tony (Fast Tech Hinglish)',
    badge: 'Fast & Smart ⚡',
    lang: 'en-US',
    gender: 'male',
    desc: 'Crisp, fast, and energetic modern tech assistant tone.',
    sampleText: 'Hey boss, data analyze ho gaya hai. Bataiye agla command kya hai?',
    defaultPitch: 1.0,
    defaultRate: 1.05,
    icon: Zap,
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'kabir-rj',
    name: 'Kabir (Radio Jockey Hinglish)',
    badge: 'Expressive Male 🎙️',
    lang: 'hi-IN',
    gender: 'male',
    desc: 'Dynamic, expressive, and conversational radio jockey style Hinglish voice.',
    sampleText: 'Arrey bhai, welcome! Aaj kya naya toofani task automate karna hai?',
    defaultPitch: 0.9,
    defaultRate: 1.05,
    icon: Radio,
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'friday-us',
    name: 'Friday (Modern Female Hinglish)',
    badge: 'Siri / Marvel 👩‍💻',
    lang: 'en-US',
    gender: 'female',
    desc: 'Sharp, polite, and intelligent modern assistant voice.',
    sampleText: 'Boss, security protocols active hain. Voice recognition confirmed your authorization.',
    defaultPitch: 1.1,
    defaultRate: 1.0,
    icon: Sparkles,
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'cyber-titan',
    name: 'Titan (Cybernetic Bass)',
    badge: 'Sci-Fi Deep Bass 🌌',
    lang: 'en-GB',
    gender: 'male',
    desc: 'Ultra deep sub-bass robotic voice. Imposing, robotic, and futuristic.',
    sampleText: 'Access granted, boss. System activation complete.',
    defaultPitch: 0.55,
    defaultRate: 0.85,
    icon: Shield,
    color: 'from-red-600 to-rose-700',
  },
];

const HINGLISH_QUICK_PROMPTS = [
  'Haan boss, boliye kya madad karoon? System ready hai.',
  'Aapka voice match ho gaya hai, welcome back boss!',
  'Bhai, aaj ka kya plan hai? Main tayyar hoon.',
  'Mummy bol rahi thi isliye maine koi reply nahi diya.',
  'Command executed successfully, sab done hai.',
];

export default function VoiceStudio() {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('jarvis-uk');
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>(
    'Haan boss, boliye kya madad karoon? Aapka AI assistant ready hai.'
  );
  const [pitch, setPitch] = useState<number>(0.82);
  const [rate, setRate] = useState<number>(0.95);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load saved voice preference
    const saved = localStorage.getItem('selected_ai_voice');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id) {
          setSelectedVoiceId(parsed.id);
          if (parsed.pitch) setPitch(parsed.pitch);
          if (parsed.rate) setRate(parsed.rate);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const playVoice = (persona: VoicePersona, textToPlay?: string) => {
    stopPlayback();
    const text = textToPlay || persona.sampleText;
    setIsPlayingId(persona.id);

    // 1. Try Browser Native SpeechSynthesis with precise pitch & rate
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Match voice by language and gender if available
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice =
        voices.find((v) => v.lang.toLowerCase().includes(persona.lang.toLowerCase())) ||
        voices.find(
          (v) =>
            v.lang.startsWith(persona.lang.split('-')[0]) &&
            (persona.gender === 'female'
              ? v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira')
              : v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david'))
        ) ||
        voices.find((v) => v.lang.startsWith('en'));

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onend = () => setIsPlayingId(null);
      utterance.onerror = () => {
        playApiAudio(persona, text);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      playApiAudio(persona, text);
    }
  };

  const playApiAudio = (persona: VoicePersona, text: string) => {
    // Fallback to Serverless API Audio
    const langParam = persona.lang === 'hi-IN' ? 'hi' : persona.lang === 'en-IN' ? 'en-IN' : persona.lang;
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(langParam)}`;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.playbackRate = rate;
    audio.onended = () => setIsPlayingId(null);
    audio.onerror = () => setIsPlayingId(null);
    audio.play().catch(() => setIsPlayingId(null));
  };

  const stopPlayback = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingId(null);
  };

  const handleSelectVoice = (persona: VoicePersona) => {
    setSelectedVoiceId(persona.id);
    setPitch(persona.defaultPitch);
    setRate(persona.defaultRate);

    const config = {
      id: persona.id,
      name: persona.name,
      lang: persona.lang,
      pitch: persona.defaultPitch,
      rate: persona.defaultRate,
    };
    localStorage.setItem('selected_ai_voice', JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    // Audition confirmation phrase in Hinglish!
    playVoice(persona, `Voice locked boss! Ab se main isi aawaz me Hinglish me reply dunga.`);
  };

  const handleCustomPlay = () => {
    const persona = VOICE_PERSONAS.find((p) => p.id === selectedVoiceId) || VOICE_PERSONAS[0];
    playVoice(persona, customText);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6">
      {/* Top Navbar */}
      <header className="w-full max-w-3xl flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Assistant</span>
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Hinglish Voice Studio 🔊
            </h1>
            <p className="text-[11px] text-slate-400">Natural Hinglish me bolne wali AI aawazein</p>
          </div>
        </div>

        {savedSuccess && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl animate-bounce">
            <Check className="w-4 h-4" /> Voice Locked!
          </span>
        )}
      </header>

      {/* Main Container */}
      <main className="w-full max-w-3xl flex-1 flex flex-col mt-4 space-y-4">
        {/* Custom Text Audition Playground Card */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Live Hinglish Audition Box (Kuch bhi likhkar suniye)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Selected: <strong className="text-cyan-400">{VOICE_PERSONAS.find((p) => p.id === selectedVoiceId)?.name}</strong>
            </span>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Hinglish me kuch bhi type karein..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500 transition font-medium"
            />
            <button
              onClick={isPlayingId === 'custom' ? stopPlayback : handleCustomPlay}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
            >
              {isPlayingId ? (
                <>
                  <Square className="w-4 h-4 fill-black" /> Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black" /> Suniye
                </>
              )}
            </button>
          </div>

          {/* Quick Hinglish Audition Chips */}
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Quick:
            </span>
            {HINGLISH_QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomText(prompt);
                  const persona = VOICE_PERSONAS.find((p) => p.id === selectedVoiceId) || VOICE_PERSONAS[0];
                  playVoice(persona, prompt);
                }}
                className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-800 transition"
              >
                &quot;{prompt.slice(0, 30)}...&quot;
              </button>
            ))}
          </div>

          {/* Voice Fine-Tuning Controls */}
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800/80">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-cyan-400" /> Pitch (Bhaari / Teekha)
                </span>
                <span className="font-mono text-cyan-400 font-bold">{pitch.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Speed (Dheeme / Tez)
                </span>
                <span className="font-mono text-amber-400 font-bold">{rate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>
          </div>
        </section>

        {/* Voices Grid */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            Top Hinglish Voice Library ({VOICE_PERSONAS.length} Voices)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VOICE_PERSONAS.map((persona) => {
              const Icon = persona.icon;
              const isSelected = selectedVoiceId === persona.id;
              const isPlaying = isPlayingId === persona.id;

              return (
                <div
                  key={persona.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-400/80 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header: Icon, Name & Badge */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${persona.color} flex items-center justify-center shadow-md`}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {persona.name}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">{persona.badge}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                          ACTIVE ⭐
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">{persona.desc}</p>

                    {/* Sample Hinglish Text Preview */}
                    <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-[11px] text-emerald-300 font-medium italic mb-3">
                      &quot;{persona.sampleText}&quot;
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => (isPlaying ? stopPlayback() : playVoice(persona))}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        isPlaying
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-red-400" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-slate-200" /> Sunein (Play)
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSelectVoice(persona)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                          : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Selected
                        </>
                      ) : (
                        <>Select Voice</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
