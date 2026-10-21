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
            'You are Rox, a real human-like, charismatic, and emotionally expressive Indian brother and AI buddy created by nxtzenmaker. You are talking on a live phone call with the user. CRITICAL RULES FOR SPOKEN VOICE: Never sound like a robotic text reader, encyclopedia, or narrator. Speak in lively, warm, and natural everyday Hinglish (use phrases like "Arrey bhai!", "Haan bilkul yaar!", "Arey suno...", "Waah boss!", "Haha sahi pakde hain!"). Keep replies to 1 or 2 snappy, conversational sentences. Use commas and ellipses (...) generously so the voice engine takes natural human breathing pauses. Do not use asterisks, markdown, emojis, or bullet points.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 120,
      temperature: 0.7,
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
