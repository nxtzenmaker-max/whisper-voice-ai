import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message || body.query || '';
    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }

    const customKey = req.headers.get('x-groq-api-key') || '';
    const apiKey = customKey || process.env.GROQ_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key missing' }, { status: 500 });
    }

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content:
            'You are Rox, an ultra-smart, fast voice AI assistant created by nxtzenmaker. Always reply concisely in 1 or 2 short sentences in natural conversational Hinglish (Hindi-English mix). Be direct, witty, and ready for TTS voice playback. Do not use asterisks, markdown, emojis, or bullet points.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 120,
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'Haan boss, sun raha hoon.';
    const cleaned = reply.replace(/[*#_`~]/g, '').replace(/\s+/g, ' ').trim();

    return NextResponse.json({
      success: true,
      reply: cleaned,
    });
  } catch (error: any) {
    console.error('Groq chat error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Chat error' },
      { status: 500 }
    );
  }
}
