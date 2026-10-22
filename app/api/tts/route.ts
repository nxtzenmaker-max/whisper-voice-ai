import { NextRequest, NextResponse } from 'next/server';
import { synthesizeEdgeTTS } from '@/lib/edge-tts';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawText = url.searchParams.get('text') || 'Arrey boss! Rox hazir hai. Boliye, aaj kya kamaal karna hai?';
    const voice = url.searchParams.get('voice') || 'hi-IN-MadhurNeural';
    const rate = url.searchParams.get('rate') || '+4%';
    const pitch = url.searchParams.get('pitch') || '+2Hz';

    // Conversational text cleanup for human speech prosody
    const cleanText = rawText
      .replace(/[*#_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Primary: Pure Node.js Edge-TTS with Sec-MS-GEC v2 (Native on Vercel)
    try {
      const audioBuffer = await synthesizeEdgeTTS(cleanText, voice, rate, pitch);
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
