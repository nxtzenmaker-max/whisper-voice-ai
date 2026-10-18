import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const result = await db.execute(`
      SELECT id, speaker_name, is_owner, text, latency_ms, created_at
      FROM transcriptions
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    const items = result.rows.map((row) => ({
      id: row.id,
      speaker_name: row.speaker_name,
      is_owner: Boolean(row.is_owner),
      text: row.text,
      latency_ms: row.latency_ms,
      created_at: row.created_at,
    }));

    return NextResponse.json({ history: items });
  } catch (error: any) {
    console.error('History API error:', error);
    return NextResponse.json({ history: [], error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await initDb();
    const db = getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (id) {
      await db.execute({
        sql: `DELETE FROM transcriptions WHERE id = ?;`,
        args: [id],
      });
    } else {
      await db.execute(`DELETE FROM transcriptions;`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('History delete error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
