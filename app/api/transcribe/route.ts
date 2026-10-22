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
    const language = (formData.get('language') as string) || 'hinglish';

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

    // Call Groq Whisper Large V3 Turbo API with language-specific anchors
    const groq = new Groq({ apiKey });

    let whisperLanguage: string | undefined = 'hi';
    let whisperPrompt = 'नमस्ते, यह बातचीत हिंदी में है।';

    if (language === 'en') {
      whisperLanguage = 'en';
      whisperPrompt = 'Hello, this is a clear English conversation.';
    } else if (language === 'hi') {
      whisperLanguage = 'hi';
      whisperPrompt = 'नमस्ते, यह बातचीत हिंदी में है। साफ और सही हिंदी में लिखें।';
    } else {
      // 'hinglish' default: transcribe in Hindi first to avoid Nordic/Icelandic hallucinations
      whisperLanguage = 'hi';
      whisperPrompt = 'नमस्ते, यह बातचीत हिंदी और हिंग्लिश में है।';
    }

    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
      language: whisperLanguage,
      prompt: whisperPrompt,
      response_format: 'json',
      temperature: 0.0,
    });

    const text = transcription.text.trim();

    const latencyMs = Date.now() - startTime;

    // Speaker Identification Multi-Sample Logic
    let speakerName = 'Aap (Owner)';
    let isOwner = true;
    let matchPercent = 100;
    let detail = '';
    let isNewRegistration = false;
    let sampleCount = 1;

    await initDb();
    const ownerProfile = await getOwnerProfile();

    if (action === 'register') {
      if (incomingVector.length > 0) {
        const res = await addOwnerSample(incomingVector, incomingPitch);
        sampleCount = res.sampleCount;
      }
      isOwner = true;
      speakerName = `Aap (Owner - Sample ${sampleCount} Saved ✅)`;
      matchPercent = 100;
      detail =
        incomingPitch > 0
          ? `Sample ${sampleCount} Enrolled (Pitch: ${incomingPitch}Hz)`
          : `Sample ${sampleCount} Enrolled`;
      isNewRegistration = true;
    } else {
      if (!ownerProfile || ownerProfile.samples.length === 0) {
        isOwner = false;
        speakerName = 'Unknown (Owner Not Enrolled)';
        matchPercent = 0;
        detail = 'Owner voice register nahi hui hai. Pehle 3 samples enroll karein!';
        sampleCount = 0;
      } else {
        const identification = identifySpeaker(incomingVector, incomingPitch, ownerProfile);
        isOwner = identification.isOwner;
        speakerName = identification.speakerName;
        matchPercent = identification.matchPercent;
        detail = identification.detail || '';
        sampleCount = ownerProfile.samples.length;
      }
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
