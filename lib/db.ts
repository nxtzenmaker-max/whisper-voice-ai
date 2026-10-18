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

  // Create speakers table with voiceprint vector storage
  await db.execute(`
    CREATE TABLE IF NOT EXISTS speakers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      voiceprint TEXT,
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
    await db.execute(`ALTER TABLE transcriptions ADD COLUMN match_percent REAL DEFAULT 0;`);
  } catch (_) {}
}

export async function getOwnerVoiceprint(): Promise<number[] | null> {
  await initDb();
  const db = getDb();
  const res = await db.execute(`SELECT voiceprint FROM speakers WHERE is_owner = 1 AND voiceprint IS NOT NULL LIMIT 1;`);
  if (res.rows.length === 0 || !res.rows[0].voiceprint) return null;
  try {
    return JSON.parse(res.rows[0].voiceprint as string);
  } catch {
    return null;
  }
}

export async function saveOwnerVoiceprint(vector: number[]) {
  await initDb();
  const db = getDb();
  const vectorStr = JSON.stringify(vector);
  
  // Update or insert owner
  await db.execute(`DELETE FROM speakers WHERE is_owner = 1;`);
  await db.execute({
    sql: `INSERT INTO speakers (id, name, is_owner, voiceprint) VALUES (?, ?, 1, ?);`,
    args: ['owner-main', 'Aap (Owner)', vectorStr],
  });
}

export async function resetOwnerVoiceprint() {
  await initDb();
  const db = getDb();
  await db.execute(`DELETE FROM speakers WHERE is_owner = 1;`);
}
