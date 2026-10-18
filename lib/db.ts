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

  // Create speakers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS speakers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create transcriptions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id TEXT PRIMARY KEY,
      speaker_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      text TEXT NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default Owner exists
  const ownerCheck = await db.execute(`SELECT id FROM speakers WHERE is_owner = 1 LIMIT 1;`);
  if (ownerCheck.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO speakers (id, name, is_owner) VALUES (?, ?, ?);`,
      args: ['owner-default', 'Aap (Owner)', 1],
    });
  }
}
