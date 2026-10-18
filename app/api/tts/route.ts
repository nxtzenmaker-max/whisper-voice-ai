import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const text = url.searchParams.get('text') || 'Hello boss, all systems online.';
    const voice = url.searchParams.get('voice') || 'Brian';

    // 1. Try Amazon Polly neural speech endpoint (via server-side proxy)
    try {
      const formData = new URLSearchParams();
      formData.append('msg', text.slice(0, 300));
      formData.append('lang', voice);
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
    const lang = voice === 'Aditi' || voice === 'Raveena' ? 'hi' : 'en-GB';
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(
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
