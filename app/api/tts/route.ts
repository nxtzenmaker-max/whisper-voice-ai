import { NextRequest, NextResponse } from 'next/server';

const HINGLISH_PHONETIC_MAP: Record<string, string> = {
  haan: 'haa',
  kya: 'kyaa',
  boliye: 'bolee-ye',
  bolo: 'boh-lo',
  kaam: 'kahm',
  sab: 'sub',
  hai: 'high',
  hain: 'high',
  kaise: 'kie-say',
  kaisa: 'kie-saa',
  kaisi: 'kie-see',
  nahi: 'na-hee',
  nahin: 'na-hee',
  bhai: 'bhaai',
  madad: 'mudd-udd',
  aaj: 'aahj',
  karo: 'kah-ro',
  karoon: 'kah-roon',
  karein: 'kah-ren',
  karen: 'kah-ren',
  aapka: 'up-kaa',
  aapki: 'up-kee',
  mera: 'may-raa',
  meri: 'may-ree',
  accha: 'utch-haa',
  theek: 'theek',
  baat: 'baht',
  kuch: 'kootch',
  batao: 'buh-taho',
  shuru: 'shoo-roo',
  khatam: 'khuh-tumm',
  namaste: 'nuh-mus-tay',
  dost: 'dohst',
  yahan: 'yuh-haan',
  wahan: 'wuh-haan',
  abhi: 'uh-bhee',
  chahiye: 'chah-hee-ye',
};

function phonetizeForEnglishVoice(input: string): string {
  return input
    .split(/\b/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (HINGLISH_PHONETIC_MAP[lower]) {
        const mapped = HINGLISH_PHONETIC_MAP[lower];
        return word[0] === word[0].toUpperCase()
          ? mapped.charAt(0).toUpperCase() + mapped.slice(1)
          : mapped;
      }
      return word;
    })
    .join('');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawText = url.searchParams.get('text') || 'Hello boss, all systems online.';
    const voice = url.searchParams.get('voice') || 'Tony';
    const pitchParam = url.searchParams.get('pitch') || '-18%';
    const rateParam = url.searchParams.get('rate') || '108%';

    let textToSynthesize = rawText;
    const pollyLang = 'Matthew'; // Tony is 100% Genuine Male (Matthew)!

    // If input text has Devanagari Hindi characters, transliterate to clean Roman Hinglish
    // because Matthew (American model) will glitch on Devanagari
    if (/[\u0900-\u097F]/.test(rawText)) {
      try {
        const groqKey = process.env.GROQ_API_KEY;
        if (groqKey) {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'qwen/qwen3.8-27b',
              messages: [
                {
                  role: 'system',
                  content:
                    'Transliterate Hindi Devanagari text into natural conversational Roman Hinglish using English phonics. Keep English words (boss, data, system, ready, plan, AI) as is. Output ONLY the transliterated text, no explanation.',
                },
                { role: 'user', content: rawText },
              ],
              temperature: 0.0,
              max_tokens: 300,
            }),
          });
          const groqData = await groqRes.json();
          const converted = groqData.choices?.[0]?.message?.content?.trim();
          if (converted && converted.length > 0) {
            textToSynthesize = converted;
          }
        }
      } catch (convErr) {
        console.warn('Groq Devanagari to Roman conversion error:', convErr);
      }
    }

    // Apply phonetic enhancer for smooth American pronunciation of Roman Hindi syllables
    textToSynthesize = phonetizeForEnglishVoice(textToSynthesize);

    // Apply speed rate if desired
    if (rateParam && rateParam !== '100%') {
      textToSynthesize = `<prosody rate="${rateParam}">${textToSynthesize}</prosody>`;
    }

    // 2. Try Amazon Polly neural speech endpoint (via server-side proxy)
    try {
      const formData = new URLSearchParams();
      formData.append('msg', textToSynthesize.slice(0, 400));
      formData.append('lang', pollyLang);
      formData.append('source', 'ttsmp3');

      const res = await fetch('https://ttsmp3.com/makemp3_new.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: formData.toString(),
      });

      const data = await res.json();

      if (data && data.success === 1 && data.URL) {
        const audioFetch = await fetch(data.URL);
        if (audioFetch.ok) {
          const audioBuffer = await audioFetch.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    } catch (primaryErr) {
      console.warn('Primary TTS provider error, falling back:', primaryErr);
    }

    // 2. High-speed Fallback to Google TTS
    const lang = voice === 'Aditi' || voice === 'Kabir' || voice === 'Raveena' ? 'hi' : 'en-GB';
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(
      textToSynthesize.replace(/<[^>]*>/g, '').slice(0, 200)
    )}`;

    const fallbackRes = await fetch(fallbackUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (fallbackRes.ok) {
      const buffer = await fallbackRes.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
  } catch (err: any) {
    console.error('TTS API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
