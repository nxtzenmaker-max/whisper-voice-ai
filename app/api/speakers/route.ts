import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const result = await db.execute(`
      SELECT id, name, is_owner, created_at
      FROM speakers
      ORDER BY is_owner DESC, created_at ASC;
    `);

    const speakers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      is_owner: Boolean(row.is_owner),
      created_at: row.created_at,
    }));

    return NextResponse.json({ speakers });
  } catch (error: any) {
    console.error('Speakers GET error:', error);
    return NextResponse.json({ speakers: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name || '').trim();
    const isOwner = body.is_owner ? 1 : 0;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await initDb();
    const db = getDb();
    const id = crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO speakers (id, name, is_owner) VALUES (?, ?, ?);`,
      args: [id, name, isOwner],
    });

    return NextResponse.json({ id, name, is_owner: Boolean(isOwner) });
  } catch (error: any) {
    console.error('Speakers POST error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing speaker id' }, { status: 400 });
    }

    await initDb();
    const db = getDb();
    await db.execute({
      sql: `DELETE FROM speakers WHERE id = ? AND is_owner != 1;`, // protect default owner
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Speakers DELETE error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
