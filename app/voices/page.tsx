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
  ArrowLeft,
  Bot,
  Zap,
  Radio,
  Heart,
  Shield,
  MessageSquare,
  Loader2,
  Cpu,
} from 'lucide-react';

interface VoicePersona {
  id: string;
  name: string;
  engine: string;
  badge: string;
  provider: 'openai' | 'aws-polly';
  voice: string;
  lang?: string;
  gender: 'male' | 'female';
  desc: string;
  sampleText: string;
  icon: any;
  color: string;
}

const NEURAL_VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'openai-onyx',
    name: 'Jarvis Prime (OpenAI Onyx)',
    engine: 'OpenAI Neural TTS',
    badge: 'Deep & Cinematic 🦾',
    provider: 'openai',
    voice: 'onyx',
    gender: 'male',
    desc: 'Studio-grade ultra deep cinematic male voice. Sounds exactly like a Hollywood movie AI.',
    sampleText: 'Good evening boss, aapka saara system online hai. Boliye, aaj kya order hai?',
    icon: Bot,
    color: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'polly-brian',
    name: 'Sir Brian (British Butler)',
    engine: 'AWS Polly Neural',
    badge: 'Royal British 🇬🇧',
    provider: 'aws-polly',
    voice: 'Brian',
    lang: 'en-GB',
    gender: 'male',
    desc: 'The iconic calm British butler voice. Speaks Hinglish with sophisticated elegance.',
    sampleText: 'Good day boss. Security protocols are active and ready for your command.',
    icon: Shield,
    color: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'polly-kajal',
    name: 'Kajal (Indian Hinglish Neural)',
    engine: 'AWS Polly Indian Neural',
    badge: '100% Desi Hinglish 🇮🇳',
    provider: 'aws-polly',
    voice: 'Kajal',
    lang: 'hi-IN',
    gender: 'female',
    desc: 'Natural Indian neural accent. Pronounces Hinglish and Hindi words with human-level perfection.',
    sampleText: 'Haan bhai, boliye kya scene hai? Aapka code aur database sab tayyar hai.',
    icon: Radio,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'openai-nova',
    name: 'Friday (OpenAI Nova)',
    engine: 'OpenAI Neural TTS',
    badge: 'Warm & Modern 🌸',
    provider: 'openai',
    voice: 'nova',
    gender: 'female',
    desc: 'Warm, natural, expressive modern female AI. Fast, friendly, and super pleasant.',
    sampleText: 'Hello boss! Main aapki AI assistant hoon. Boliye, aaj main aapki kya help kar sakti hoon?',
    icon: Heart,
    color: 'from-rose-500 to-pink-600',
  },
  {
    id: 'openai-echo',
    name: 'Tony (OpenAI Echo)',
    engine: 'OpenAI Neural TTS',
    badge: 'Conversational & Smart ⚡',
    provider: 'openai',
    voice: 'echo',
    gender: 'male',
    desc: 'Smooth, resonant conversational male voice. Confident and great for tech chat.',
    sampleText: 'Hey boss, data analyze ho gaya hai. Bataiye agla command kya execute karein?',
    icon: Zap,
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'openai-alloy',
    name: 'Alloy (OpenAI Official)',
    engine: 'OpenAI Neural TTS',
    badge: 'ChatGPT Standard 🚀',
    provider: 'openai',
    voice: 'alloy',
    gender: 'male',
    desc: 'The classic balanced OpenAI voice. Clean, neutral, and highly intelligible.',
    sampleText: 'Command received boss. All Turso database records are synchronized.',
    icon: Cpu,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'openai-shimmer',
    name: 'Aria (OpenAI Shimmer)',
    engine: 'OpenAI Neural TTS',
    badge: 'Bright & Crisp ✨',
    provider: 'openai',
    voice: 'shimmer',
    gender: 'female',
    desc: 'Bright, cheerful, and clear female assistant tone.',
    sampleText: 'Voice recognition confirmed boss! Aapki identity verified ho gayi hai.',
    icon: Sparkles,
    color: 'from-pink-500 to-fuchsia-600',
  },
  {
    id: 'polly-aditi',
    name: 'Aditi (Indian Bilingual)',
    engine: 'AWS Polly Neural',
    badge: 'Professional Hindi/English 🇮🇳',
    provider: 'aws-polly',
    voice: 'Aditi',
    lang: 'hi-IN',
    gender: 'female',
    desc: 'Polite and clear Indian bilingual voice. Perfect for professional assistant tasks.',
    sampleText: 'Namaste boss! Aapka personal AI system 24/7 active hai.',
    icon: Radio,
    color: 'from-orange-500 to-amber-600',
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
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('openai-onyx');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [loadingPersonaId, setLoadingPersonaId] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>(
    'Haan boss, boliye kya madad karoon? Aapka AI assistant ready hai.'
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [puterReady, setPuterReady] = useState<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Puter.js dynamically
  useEffect(() => {
    // Load saved voice preference
    const saved = localStorage.getItem('selected_ai_voice');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id) setSelectedVoiceId(parsed.id);
      } catch (e) {
        console.error(e);
      }
    }

    // Check or load Puter.js
    if (typeof window !== 'undefined') {
      if ((window as any).puter) {
        setPuterReady(true);
      } else {
        const script = document.createElement('script');
        script.src = 'https://js.puter.com/v2/';
        script.async = true;
        script.onload = () => {
          setPuterReady(true);
        };
        script.onerror = () => {
          console.error('Failed to load Puter.js');
        };
        document.head.appendChild(script);
      }
    }
  }, []);

  const playVoice = async (persona: VoicePersona, textToPlay?: string) => {
    stopPlayback();
    const text = textToPlay || persona.sampleText;
    setLoadingPersonaId(persona.id);
    setIsLoadingAudio(true);

    try {
      // 1. Check if puter is available
      const puter = (typeof window !== 'undefined' && (window as any).puter) || null;

      if (puter && puter.ai && puter.ai.txt2speech) {
        const options: any = {
          provider: persona.provider,
          voice: persona.voice,
        };

        if (persona.provider === 'openai') {
          options.model = 'tts-1';
        } else if (persona.provider === 'aws-polly') {
          options.engine = 'neural';
          if (persona.lang) options.language = persona.lang;
        }

        const audio = await puter.ai.txt2speech(text, options);
        setIsLoadingAudio(false);
        setLoadingPersonaId(null);
        setPlayingId(persona.id);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setPlayingId(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingId(null);
          currentAudioRef.current = null;
        };

        audio.play().catch((e: any) => {
          console.error('Audio play error:', e);
          setPlayingId(null);
        });
      } else {
        // Fallback to serverless API
        playFallbackAudio(persona, text);
      }
    } catch (err: any) {
      console.error('TTS Generation error, falling back:', err);
      playFallbackAudio(persona, text);
    }
  };

  const playFallbackAudio = (persona: VoicePersona, text: string) => {
    const lang = persona.lang || (persona.gender === 'female' ? 'hi' : 'en-GB');
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    setIsLoadingAudio(false);
    setLoadingPersonaId(null);
    setPlayingId(persona.id);

    audio.onended = () => {
      setPlayingId(null);
      currentAudioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      currentAudioRef.current = null;
    };
    audio.play().catch(() => setPlayingId(null));
  };

  const stopPlayback = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setPlayingId(null);
    setIsLoadingAudio(false);
    setLoadingPersonaId(null);
  };

  const handleSelectVoice = (persona: VoicePersona) => {
    setSelectedVoiceId(persona.id);

    const config = {
      id: persona.id,
      name: persona.name,
      provider: persona.provider,
      voice: persona.voice,
      engine: persona.engine,
    };
    localStorage.setItem('selected_ai_voice', JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    // Audition confirmation in the selected voice!
    playVoice(persona, `Voice locked boss! Main ${persona.name} hoon, ab se isi voice me baat hogi.`);
  };

  const handleCustomPlay = () => {
    const persona =
      NEURAL_VOICE_PERSONAS.find((p) => p.id === selectedVoiceId) || NEURAL_VOICE_PERSONAS[0];
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
              Neural AI Voice Studio 🔊
            </h1>
            <p className="text-[11px] text-slate-400">
              OpenAI & AWS Polly Neural Voices • Zero API Key Required
            </p>
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
              Live Neural Audition (Kuch Bhi Likh Kar Suniye)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Selected:{' '}
              <strong className="text-cyan-400">
                {NEURAL_VOICE_PERSONAS.find((p) => p.id === selectedVoiceId)?.name}
              </strong>
            </span>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Hinglish ya Hindi me kuch bhi likhein..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500 transition font-medium"
            />
            <button
              onClick={playingId ? stopPlayback : handleCustomPlay}
              disabled={isLoadingAudio}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isLoadingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" /> Generating...
                </>
              ) : playingId ? (
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
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Quick:
            </span>
            {HINGLISH_QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomText(prompt);
                  const persona =
                    NEURAL_VOICE_PERSONAS.find((p) => p.id === selectedVoiceId) ||
                    NEURAL_VOICE_PERSONAS[0];
                  playVoice(persona, prompt);
                }}
                className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-800 transition cursor-pointer"
              >
                &quot;{prompt.slice(0, 32)}...&quot;
              </button>
            ))}
          </div>
        </section>

        {/* Voices Grid */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              Real Neural Voices ({NEURAL_VOICE_PERSONAS.length})
            </h2>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              No API Key Required ✅
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NEURAL_VOICE_PERSONAS.map((persona) => {
              const Icon = persona.icon;
              const isSelected = selectedVoiceId === persona.id;
              const isThisPlaying = playingId === persona.id;
              const isThisLoading = loadingPersonaId === persona.id && isLoadingAudio;

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
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 px-1.5 py-0.2 rounded border border-cyan-800/40">
                              {persona.engine}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {persona.badge}
                            </span>
                          </div>
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
                      onClick={() => (isThisPlaying ? stopPlayback() : playVoice(persona))}
                      disabled={isLoadingAudio && !isThisLoading}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isThisPlaying
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isThisLoading
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isThisLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>Generating...</span>
                        </>
                      ) : isThisPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-red-400" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-slate-200" />
                          <span>Sunein (Play)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSelectVoice(persona)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
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
