import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { getDb, initDb, getOwnerProfile, addOwnerSample } from '@/lib/db';
import { identifySpeaker } from '@/lib/voiceprint';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = (formData.get('action') as string) || 'identify';
    const voiceprintStr = (formData.get('voiceprint') as string) || '';
    const pitchStr = (formData.get('pitch') as string) || '0';
    const language = (formData.get('language') as string) || 'hi';

    const incomingPitch = Math.round(Number(pitchStr) || 0);

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

    // Parse incoming voiceprint vector
    let incomingVector: number[] = [];
    if (voiceprintStr) {
      try {
        incomingVector = JSON.parse(voiceprintStr);
      } catch (e) {
        console.error('Invalid voiceprint json:', e);
      }
    }

    // Call Groq Whisper Large V3 Turbo API
    const groq = new Groq({ apiKey });
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

    // Speaker Identification Multi-Sample Logic
    let speakerName = 'Aap (Owner)';
    let isOwner = true;
    let matchPercent = 100;
    let detail = '';
    let isNewRegistration = false;
    let sampleCount = 1;

    await initDb();
    const ownerProfile = await getOwnerProfile();

    if (action === 'register' || !ownerProfile || ownerProfile.samples.length === 0) {
      if (incomingVector.length > 0) {
        const res = await addOwnerSample(incomingVector, incomingPitch);
        sampleCount = res.sampleCount;
      }
      isOwner = true;
      speakerName = `Aap (Owner - Sample ${sampleCount} Saved ✅)`;
      matchPercent = 100;
      detail = incomingPitch > 0 ? `Sample ${sampleCount} Enrolled (Pitch: ${incomingPitch}Hz)` : `Sample ${sampleCount} Enrolled`;
      isNewRegistration = true;
    } else {
      const identification = identifySpeaker(incomingVector, incomingPitch, ownerProfile);
      isOwner = identification.isOwner;
      speakerName = identification.speakerName;
      matchPercent = identification.matchPercent;
      detail = identification.detail || '';
      sampleCount = ownerProfile.samples.length;
    }

    // Save transcription to Turso DB
    const id = crypto.randomUUID();
    try {
      const db = getDb();
      await db.execute({
        sql: `INSERT INTO transcriptions (id, speaker_name, is_owner, match_percent, pitch, text, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [id, speakerName, isOwner ? 1 : 0, matchPercent, incomingPitch, text, latencyMs],
      });
    } catch (dbErr) {
      console.error('Turso DB save error:', dbErr);
    }

    return NextResponse.json({
      id,
      text,
      speaker_name: speakerName,
      is_owner: isOwner,
      match_percent: matchPercent,
      pitch: incomingPitch,
      detail,
      is_new_registration: isNewRegistration,
      sample_count: sampleCount,
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
