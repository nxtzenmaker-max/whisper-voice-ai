import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

function generatePrabhatTTS(text: string, rate: string = '+20%'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [
      '-c',
      `
import sys, asyncio, edge_tts
async def main():
    comm = edge_tts.Communicate(sys.argv[1], 'en-IN-PrabhatNeural', rate=sys.argv[2])
    async for chunk in comm.stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])
asyncio.run(main())
      `,
      text,
      rate,
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
    const text = url.searchParams.get('text') || 'Haan boss, boliye kya madad karoon? Data analyze ho gaya hai, all systems ready hain.';
    const rate = url.searchParams.get('rate') || '+20%';

    // 1. Primary: Direct high-speed Python Edge-TTS (en-IN-PrabhatNeural, Male Tech Tone)
    try {
      const audioBuffer = await generatePrabhatTTS(text, rate);
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
        `${origin}/api/speech?voice=en-IN-PrabhatNeural&rate=${encodeURIComponent(
          rate
        )}&text=${encodeURIComponent(text)}`
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
