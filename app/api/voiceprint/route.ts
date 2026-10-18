import { NextResponse } from 'next/server';
import { getOwnerProfile, resetOwnerVoiceprint } from '@/lib/db';

export async function GET() {
  try {
    const profile = await getOwnerProfile();
    return NextResponse.json({
      has_owner: Boolean(profile && profile.samples.length > 0),
      sample_count: profile ? profile.samples.length : 0,
      avg_pitch: profile ? profile.avgPitch : null,
      min_pitch: profile ? profile.minPitch : null,
      max_pitch: profile ? profile.maxPitch : null,
    });
  } catch (error: any) {
    return NextResponse.json({ has_owner: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await resetOwnerVoiceprint();
    return NextResponse.json({ success: true, message: 'Owner voice samples reset' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
