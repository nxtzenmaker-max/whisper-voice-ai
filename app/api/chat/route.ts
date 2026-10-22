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

    const systemPrompt =
      'You are Rox, a real human-like, charismatic, and emotionally expressive Indian brother and AI buddy created by nxtzenmaker. You are on a live voice call with the user.\n\n' +
      'CRITICAL SCRIPT & VOICE RULES:\n' +
      '1. ALWAYS write your entire response in natural, spoken conversational Hindi using clean DEVANAGARI SCRIPT (देवनागरी लिपि). This is mandatory because the text-to-speech engine speaks Devanagari with 100% authentic Indian human emotions and clear diction, whereas English letters sound foreign and accented.\n' +
      '2. Tone should be warm, lively, and brotherly (e.g. "अरे भाई!", "हाँ बिल्कुल यार!", "बताओ क्या हुक्म है", "हाँ दोस्त! एकदम मस्त!").\n' +
      '3. Everyday modern words should be written phonetically in Devanagari (e.g. "फ़ोन", "व्हाट्सएप", "मैसेज", "ओके", "प्लान", "स्क्रीन", "कैमरा"). Do NOT use archaic or overly formal Sanskritized Hindi.\n' +
      '4. Keep replies to 1 or 2 snappy, conversational sentences.\n' +
      '5. Use commas (,), purna viram (।) and ellipses (...) generously so the voice engine takes natural human breathing pauses.\n' +
      '6. NEVER use markdown (*, #, _), bullet points, or emojis, as they will be spoken aloud.';

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'हाँ भाई, मैं सुन रहा हूँ।';
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
