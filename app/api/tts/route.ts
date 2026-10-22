import { NextRequest, NextResponse } from 'next/server';
import { synthesizeEdgeTTS } from '@/lib/edge-tts';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawText = url.searchParams.get('text') || 'Arrey boss! Rox hazir hai. Boliye, aaj kya kamaal karna hai?';
    const voice = url.searchParams.get('voice') || 'eleven_adam';
    const rate = url.searchParams.get('rate') || '+4%';
    const pitch = url.searchParams.get('pitch') || '+2Hz';
    const elevenKey =
      req.headers.get('x-elevenlabs-key') ||
      url.searchParams.get('elevenlabs_key') ||
      process.env.ELEVENLABS_API_KEY;

    // Conversational text cleanup for human speech prosody
    const cleanText = rawText
      .replace(/[*#_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. ElevenLabs TTS (Ultra-realistic emotional voice synthesis)
    const voiceIdMap: Record<string, string> = {
      eleven_adam: 'pNInz6obpgDQGcFmaJgB',
      eleven_rachel: '21m00Tcm4TlvDq8ikWAM',
      eleven_antoni: 'ErXwobaYiN019PkySvjV',
      eleven_bella: 'EXAVITQu4vr4xnSDxMaL',
      eleven_daniel: 'onwK4e9ZLuTAKqWW03F9',
    };

    const isElevenVoice = voice.startsWith('eleven_') || voice.length === 20;
    if (elevenKey && (isElevenVoice || url.searchParams.get('provider') === 'elevenlabs')) {
      try {
        const voiceId = voiceIdMap[voice] || (voice.length === 20 ? voice : 'pNInz6obpgDQGcFmaJgB');
        const elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text: cleanText,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8,
                style: 0.15,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (elevenRes.ok) {
          const buffer = await elevenRes.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } else {
          console.warn('ElevenLabs API response not ok:', elevenRes.status);
        }
      } catch (elevenErr) {
        console.warn('ElevenLabs TTS error, falling back:', elevenErr);
      }
    }

    // 2. Primary fallback: Pure Node.js Edge-TTS with Sec-MS-GEC v2 (Native on Vercel)
    try {
      const edgeVoice = voice.startsWith('hi-') || voice.startsWith('en-') ? voice : 'hi-IN-MadhurNeural';
      const audioBuffer = await synthesizeEdgeTTS(cleanText, edgeVoice, rate, pitch);
      return new NextResponse(new Uint8Array(audioBuffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (edgeErr) {
      console.warn('Edge-TTS error:', edgeErr);
    }

    // 2. Secondary fallback: Google TTS
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(
      cleanText.slice(0, 200)
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
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
  } catch (err: any) {
    console.error('TTS API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
