import { NextResponse } from 'next/server';
import { getOwnerVoiceprint, resetOwnerVoiceprint } from '@/lib/db';

export async function GET() {
  try {
    const ownerVoiceprint = await getOwnerVoiceprint();
    return NextResponse.json({
      has_owner: Boolean(ownerVoiceprint && ownerVoiceprint.length > 0),
    });
  } catch (error: any) {
    return NextResponse.json({ has_owner: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await resetOwnerVoiceprint();
    return NextResponse.json({ success: true, message: 'Owner voiceprint reset' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
