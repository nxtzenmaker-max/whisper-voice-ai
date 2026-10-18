import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { getDb, initDb } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const speakerName = (formData.get('speaker_name') as string) || 'Aap (Owner)';
    const isOwner = formData.get('is_owner') === 'true' ? 1 : 0;
    const language = (formData.get('language') as string) || 'hi';

    const customApiKey = req.headers.get('x-groq-api-key') || '';
    const apiKey = customApiKey || process.env.GROQ_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Groq API Key missing. Please set GROQ_API_KEY in environment or Settings.' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    // Call Groq Whisper Large V3 Turbo API
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
      language: language !== 'auto' ? language : undefined,
      prompt: 'Hindi, Hinglish aur English conversation transcription.',
      response_format: 'json',
      temperature: 0.0,
    });

    const latencyMs = Date.now() - startTime;
    const text = transcription.text.trim();

    // Save to Turso DB
    let id = crypto.randomUUID();
    try {
      await initDb();
      const db = getDb();
      await db.execute({
        sql: `INSERT INTO transcriptions (id, speaker_name, is_owner, text, latency_ms) VALUES (?, ?, ?, ?, ?);`,
        args: [id, speakerName, isOwner, text, latencyMs],
      });
    } catch (dbErr) {
      console.error('Turso DB save error:', dbErr);
    }

    return NextResponse.json({
      id,
      text,
      speaker_name: speakerName,
      is_owner: Boolean(isOwner),
      latency_ms: latencyMs,
    });
  } catch (error: any) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
