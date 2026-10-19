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
  voiceKey: string;
  engine: string;
  badge: string;
  gender: 'male' | 'female';
  desc: string;
  sampleText: string;
  icon: any;
  color: string;
}

const NEURAL_VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'kabir-desi-male',
    name: 'Kabir (Desi Tech Male)',
    voiceKey: 'Kabir',
    engine: 'Polly Neural (Desi Male AI)',
    badge: 'Desi Tony Stark 🇮🇳 (Male)',
    gender: 'male',
    desc: 'Deep, confident Indian male tech voice. Speaks 100% authentic, crystal-clear Hindi and Hinglish!',
    sampleText: 'हाँ बॉस, बोलिए क्या मदद करूँ? आपका AI असिस्टेंट बिल्कुल तैयार है।',
    icon: Zap,
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'aditi-hindi',
    name: 'Aditi (Desi AI Female)',
    voiceKey: 'Aditi',
    engine: 'Amazon Polly Indian (Aditi)',
    badge: '100% Native Hinglish 🇮🇳 (Female)',
    gender: 'female',
    desc: 'Natural Indian bilingual female voice. Clean, polite, and fluent in Hindi and Hinglish.',
    sampleText: 'नमस्ते बॉस! आपकी आवाज़ मैच हो गई है, स्वागत है!',
    icon: Radio,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'matthew-tony',
    name: 'Tony (US Tech Male)',
    voiceKey: 'Matthew',
    engine: 'Amazon Polly Neural (Matthew)',
    badge: 'US English ⚡ (American)',
    gender: 'male',
    desc: 'Crisp, fast American tech tone. Best for English conversations.',
    sampleText: 'Hey boss, data analyze ho gaya hai. What is our next move?',
    icon: Bot,
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'brian-jarvis',
    name: 'Jarvis (British Deep Male)',
    voiceKey: 'Brian',
    engine: 'Amazon Polly Neural (Brian)',
    badge: 'Iron Man Jarvis 🤖 (UK Male)',
    gender: 'male',
    desc: 'The iconic deep British butler voice. Best for English commands.',
    sampleText: 'Good evening boss, all systems are online and operational. Awaiting your command.',
    icon: Shield,
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'joanna-friday',
    name: 'Friday (Modern US Female)',
    voiceKey: 'Joanna',
    engine: 'Amazon Polly Neural (Joanna)',
    badge: 'Siri / Marvel 🌸',
    gender: 'female',
    desc: 'Sharp, polite, and intelligent modern assistant voice.',
    sampleText: 'Boss, security protocols active hain. Voice recognition confirmed your authorization.',
    icon: Heart,
    color: 'from-rose-500 to-pink-600',
  },
  {
    id: 'raveena-desi',
    name: 'Raveena (Indian Accent Female)',
    voiceKey: 'Raveena',
    engine: 'Amazon Polly Indian (Raveena)',
    badge: 'Indian English 🇮🇳',
    gender: 'female',
    desc: 'Classic Indian English accent with crystal-clear diction.',
    sampleText: 'Hello boss, your code and database are completely synchronized.',
    icon: Radio,
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'amy-uk',
    name: 'Amy (British Female AI)',
    voiceKey: 'Amy',
    engine: 'Amazon Polly Neural (Amy)',
    badge: 'Royal UK Female 🇬🇧',
    gender: 'female',
    desc: 'Polite, sophisticated, and articulate British female voice.',
    sampleText: 'All background tasks have completed successfully, boss.',
    icon: Sparkles,
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'joey-us',
    name: 'Joey (Casual US Male)',
    voiceKey: 'Joey',
    engine: 'Amazon Polly Neural (Joey)',
    badge: 'Youthful & Chill 🎧',
    gender: 'male',
    desc: 'Relaxed, conversational American male voice.',
    sampleText: 'Yo boss, everything looks good to go. What are we building next?',
    icon: Cpu,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'russell-au',
    name: 'Russell (Deep Charismatic Male)',
    voiceKey: 'Russell',
    engine: 'Amazon Polly Neural (Russell)',
    badge: 'Deep & Resonant 🌌',
    gender: 'male',
    desc: 'Deep Australian resonant male voice. Warm and authoritative.',
    sampleText: 'Authorization confirmed. Core systems fully engaged.',
    icon: Shield,
    color: 'from-red-600 to-rose-700',
  },
];

const PURE_HINDI_QUICK_PROMPTS = [
  'हाँ बॉस, बोलिए क्या मदद करूँ? आपका AI असिस्टेंट बिल्कुल तैयार है।',
  'आपकी आवाज़ की पहचान हो चुकी है। स्वागत है बॉस!',
  'आज का क्या कार्य है? मैं पूरी तरह तैयार हूँ।',
  'कमांड सफलतापूर्वक पूरा हो गया है, सब सुरक्षित है।',
  'मम्मी की आवाज़ पहचान ली गई है, इसलिए मैंने कोई उत्तर नहीं दिया।',
];

const HINGLISH_QUICK_PROMPTS = [
  'Haan boss, boliye kya madad karoon? System ready hai.',
  'Aapka voice match ho gaya hai, welcome back boss!',
  'Bhai, aaj ka kya plan hai? Main tayyar hoon.',
  'Mummy bol rahi thi isliye maine koi reply nahi diya.',
  'Command executed successfully, sab done hai.',
];

export default function VoiceStudio() {
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<string>('Kabir');
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [loadingPersonaKey, setLoadingPersonaKey] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>(
    'हाँ बॉस, बोलिए क्या मदद करूँ? आपका AI असिस्टेंट बिल्कुल तैयार है। आपकी हर आज्ञा का पालन होगा।'
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load saved voice preference
    const saved = localStorage.getItem('selected_ai_voice');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.voiceKey) setSelectedVoiceKey(parsed.voiceKey);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const playVoice = (persona: VoicePersona, textToPlay?: string) => {
    stopPlayback();
    const text = textToPlay || persona.sampleText;
    setLoadingPersonaKey(persona.voiceKey);
    setIsLoadingAudio(true);

    const url = `/api/tts?voice=${encodeURIComponent(persona.voiceKey)}&text=${encodeURIComponent(
      text
    )}`;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setIsLoadingAudio(false);
      setLoadingPersonaKey(null);
      setPlayingKey(persona.voiceKey);
      audio.play().catch(() => {
        setPlayingKey(null);
        setIsLoadingAudio(false);
      });
    };

    audio.onended = () => {
      setPlayingKey(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingKey(null);
      setIsLoadingAudio(false);
      setLoadingPersonaKey(null);
      audioRef.current = null;
    };

    audio.load();
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingKey(null);
    setIsLoadingAudio(false);
    setLoadingPersonaKey(null);
  };

  const handleSelectVoice = (persona: VoicePersona) => {
    setSelectedVoiceKey(persona.voiceKey);

    const config = {
      id: persona.id,
      name: persona.name,
      voiceKey: persona.voiceKey,
      engine: persona.engine,
    };
    localStorage.setItem('selected_ai_voice', JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    // Audition confirmation in the selected voice!
    const isDesi = persona.voiceKey === 'Kabir' || persona.voiceKey === 'Aditi';
    const confirmMsg = isDesi
      ? 'आवाज़ सेट हो गई है बॉस! अब से इसी आवाज़ में बात होगी।'
      : `Voice locked boss! All systems operational in ${persona.name} voice.`;
    playVoice(persona, confirmMsg);
  };

  const handleCustomPlay = () => {
    const persona =
      NEURAL_VOICE_PERSONAS.find((p) => p.voiceKey === selectedVoiceKey) ||
      NEURAL_VOICE_PERSONAS[0];
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
              Zero Redirects • Zero API Key Required • Pure Amazon Polly Neural Audio
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
              Live Hinglish Audition Box (Kuch Bhi Likh Kar Suniye)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Selected:{' '}
              <strong className="text-cyan-400">
                {NEURAL_VOICE_PERSONAS.find((p) => p.voiceKey === selectedVoiceKey)?.name}
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
              onClick={playingKey ? stopPlayback : handleCustomPlay}
              disabled={isLoadingAudio}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isLoadingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" /> Generating...
                </>
              ) : playingKey ? (
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

          {/* Quick Audition Chips */}
          <div className="mt-3 space-y-2">
            {/* Pure Hindi Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                🇮🇳 शुद्ध हिन्दी:
              </span>
              {PURE_HINDI_QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={`hi-${idx}`}
                  onClick={() => {
                    setCustomText(prompt);
                    const persona =
                      NEURAL_VOICE_PERSONAS.find((p) => p.voiceKey === selectedVoiceKey) ||
                      NEURAL_VOICE_PERSONAS[0];
                    playVoice(persona, prompt);
                  }}
                  className="text-[10px] bg-slate-950 hover:bg-slate-800 text-amber-200/90 hover:text-white px-2 py-1 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition cursor-pointer"
                >
                  &quot;{prompt.slice(0, 26)}...&quot;
                </button>
              ))}
            </div>

            {/* Hinglish Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Hinglish:
              </span>
              {HINGLISH_QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={`hing-${idx}`}
                  onClick={() => {
                    setCustomText(prompt);
                    const persona =
                      NEURAL_VOICE_PERSONAS.find((p) => p.voiceKey === selectedVoiceKey) ||
                      NEURAL_VOICE_PERSONAS[0];
                    playVoice(persona, prompt);
                  }}
                  className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-800 transition cursor-pointer"
                >
                  &quot;{prompt.slice(0, 26)}...&quot;
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Voices Grid */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              Real Neural Voice Library ({NEURAL_VOICE_PERSONAS.length})
            </h2>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              Zero Redirects • 100% Free ✅
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NEURAL_VOICE_PERSONAS.map((persona) => {
              const Icon = persona.icon;
              const isSelected = selectedVoiceKey === persona.voiceKey;
              const isThisPlaying = playingKey === persona.voiceKey;
              const isThisLoading = loadingPersonaKey === persona.voiceKey && isLoadingAudio;

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
                          <span>Streaming MP3...</span>
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
