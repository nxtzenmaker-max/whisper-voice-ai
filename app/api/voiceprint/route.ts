import { NextResponse } from 'next/server';
import { getOwnerProfile, resetOwnerVoiceprint } from '@/lib/db';

export async function GET() {
  try {
    const profile = await getOwnerProfile();
    return NextResponse.json({
      has_owner: Boolean(profile && profile.vector && profile.vector.length > 0),
      owner_pitch: profile ? profile.pitch : null,
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
