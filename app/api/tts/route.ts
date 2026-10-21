import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

function generateEmotionalTTS(
  text: string,
  voice: string = 'hi-IN-MadhurNeural',
  rate: string = '+5%',
  pitch: string = '+2Hz'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [
      '-c',
      `
import sys, asyncio, edge_tts
async def main():
    text = sys.argv[1]
    voice = sys.argv[2]
    rate = sys.argv[3]
    pitch = sys.argv[4]
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    async for chunk in comm.stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])
asyncio.run(main())
      `,
      text,
      voice,
      rate,
      pitch,
    ]);

    const chunks: Buffer[] = [];
    py.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    py.on('error', reject);
    py.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error('Python exited with code ' + code));
      }
    });
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const text = url.searchParams.get('text') || 'Arrey boss! Rox hazir hai. Boliye, aaj kya kamaal karna hai?';
    const voice = url.searchParams.get('voice') || 'hi-IN-MadhurNeural';
    const rate = url.searchParams.get('rate') || '+5%';
    const pitch = url.searchParams.get('pitch') || '+2Hz';

    // 1. Primary: Direct high-speed Python Edge-TTS (hi-IN-MadhurNeural with natural prosody)
    try {
      const audioBuffer = await generateEmotionalTTS(text, voice, rate, pitch);
      return new NextResponse(new Uint8Array(audioBuffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (pyErr) {
      console.warn('Local Python edge-tts not available, checking Vercel /api/speech:', pyErr);
    }

    // 2. Secondary: Vercel Python Serverless Endpoint (/api/speech)
    try {
      const origin = url.origin;
      const speechRes = await fetch(
        `${origin}/api/speech?voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(
          rate
        )}&pitch=${encodeURIComponent(pitch)}&text=${encodeURIComponent(text)}`
      );
      if (speechRes.ok) {
        const buffer = await speechRes.arrayBuffer();
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (speechErr) {
      console.warn('Vercel /api/speech error:', speechErr);
    }

    // 3. Fallback: Google TTS
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(
      text.slice(0, 200)
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
