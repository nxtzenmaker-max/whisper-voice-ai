import { createClient, Client } from '@libsql/client';

let dbClient: Client | null = null;

export function getDb(): Client {
  if (dbClient) return dbClient;

  const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  dbClient = createClient({
    url,
    authToken,
  });

  return dbClient;
}

export async function initDb() {
  const db = getDb();

  // Create speakers table with voiceprint vector and pitch storage
  await db.execute(`
    CREATE TABLE IF NOT EXISTS speakers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      voiceprint TEXT,
      pitch REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create transcriptions table with match_percent
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id TEXT PRIMARY KEY,
      speaker_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      match_percent REAL DEFAULT 0,
      pitch REAL DEFAULT 0,
      text TEXT NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration checks for existing databases
  try {
    await db.execute(`ALTER TABLE speakers ADD COLUMN voiceprint TEXT;`);
  } catch (_) {}

  try {
    await db.execute(`ALTER TABLE speakers ADD COLUMN pitch REAL DEFAULT 0;`);
  } catch (_) {}

  try {
    await db.execute(`ALTER TABLE transcriptions ADD COLUMN match_percent REAL DEFAULT 0;`);
  } catch (_) {}

  try {
    await db.execute(`ALTER TABLE transcriptions ADD COLUMN pitch REAL DEFAULT 0;`);
  } catch (_) {}
}

export interface VoiceSample {
  vector: number[];
  pitch: number;
}

export interface OwnerProfile {
  samples: VoiceSample[];
  minPitch: number;
  maxPitch: number;
  avgPitch: number;
}

export async function getOwnerProfile(): Promise<OwnerProfile | null> {
  await initDb();
  const db = getDb();
  const res = await db.execute(`SELECT voiceprint, pitch FROM speakers WHERE is_owner = 1 AND voiceprint IS NOT NULL LIMIT 1;`);
  if (res.rows.length === 0 || !res.rows[0].voiceprint) return null;

  try {
    const raw = JSON.parse(res.rows[0].voiceprint as string);
    let samples: VoiceSample[] = [];

    // Support legacy single vector array format [0.1, 0.2, ...]
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
      const pitch = Number(res.rows[0].pitch) || 0;
      samples.push({ vector: raw, pitch });
    } else if (Array.isArray(raw)) {
      // Array of samples [{ vector, pitch }, ...]
      samples = raw;
    } else if (raw && Array.isArray(raw.samples)) {
      samples = raw.samples;
    }

    if (samples.length === 0) return null;

    const pitches = samples.map((s) => s.pitch).filter((p) => p > 0);
    const minPitch = pitches.length > 0 ? Math.min(...pitches) : 0;
    const maxPitch = pitches.length > 0 ? Math.max(...pitches) : 0;
    const avgPitch = pitches.length > 0 ? Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length) : 0;

    return {
      samples,
      minPitch,
      maxPitch,
      avgPitch,
    };
  } catch {
    return null;
  }
}

// Backwards-compatible alias
export async function getOwnerVoiceprint(): Promise<number[] | null> {
  const profile = await getOwnerProfile();
  return profile && profile.samples.length > 0 ? profile.samples[0].vector : null;
}

export async function addOwnerSample(vector: number[], pitch: number) {
  await initDb();
  const db = getDb();
  const current = await getOwnerProfile();

  let samples: VoiceSample[] = current ? [...current.samples] : [];
  samples.push({ vector, pitch });

  // Keep up to 5 samples
  if (samples.length > 5) {
    samples = samples.slice(samples.length - 5);
  }

  const pitches = samples.map((s) => s.pitch).filter((p) => p > 0);
  const avgPitch = pitches.length > 0 ? Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length) : pitch;

  const vectorStr = JSON.stringify(samples);
  await db.execute(`DELETE FROM speakers WHERE is_owner = 1;`);
  await db.execute({
    sql: `INSERT INTO speakers (id, name, is_owner, voiceprint, pitch) VALUES (?, ?, 1, ?, ?);`,
    args: ['owner-main', 'Aap (Owner)', vectorStr, avgPitch],
  });

  return {
    sampleCount: samples.length,
    avgPitch,
  };
}

export async function saveOwnerProfile(vector: number[], pitch: number) {
  return addOwnerSample(vector, pitch);
}

export async function saveOwnerVoiceprint(vector: number[]) {
  return addOwnerSample(vector, 0);
}

export async function resetOwnerVoiceprint() {
  await initDb();
  const db = getDb();
  await db.execute(`DELETE FROM speakers WHERE is_owner = 1;`);
}
