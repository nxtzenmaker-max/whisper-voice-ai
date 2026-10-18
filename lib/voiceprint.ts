export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  
  const minLen = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < minLen; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function identifySpeaker(
  incomingVector: number[],
  incomingPitch: number,
  ownerProfile: { vector: number[]; pitch: number } | null,
  threshold = 0.80
): { isOwner: boolean; speakerName: string; matchPercent: number; detail?: string } {
  if (!ownerProfile || !ownerProfile.vector || ownerProfile.vector.length === 0) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner - Registered ✅)',
      matchPercent: 100,
      detail: 'Pehle sample se Owner profile set ho gayi',
    };
  }

  const similarity = cosineSimilarity(incomingVector, ownerProfile.vector);
  const matchPercent = Math.max(0, Math.min(100, Math.round(similarity * 1000) / 10));

  const ownerPitch = Math.round(ownerProfile.pitch || 0);
  const inPitch = Math.round(incomingPitch || 0);
  const pitchDiff = (inPitch > 0 && ownerPitch > 0) ? Math.abs(inPitch - ownerPitch) : null;

  // 1. Strict Pitch Mismatch (e.g. Mummy / Female Voice vs Male Owner)
  // Male voices: ~95-155 Hz, Female voices: ~185-265 Hz. Diff is typically 70-120 Hz.
  if (pitchDiff !== null && pitchDiff > 35) {
    const isHigher = inPitch > ownerPitch;
    const speakerName = isHigher ? 'Koi aur (Mummy / Female Voice)' : 'Koi aur (Alag Pitch / Speaker 2)';
    return {
      isOwner: false,
      speakerName,
      matchPercent,
      detail: `Pitch Mismatch: ${inPitch}Hz vs Owner ${ownerPitch}Hz (Diff: +${pitchDiff}Hz ❌)`,
    };
  }

  // 2. Multi-factor Mel-scale Vector Match
  if (similarity >= threshold) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner)',
      matchPercent,
      detail: inPitch > 0 ? `Verified: ${matchPercent}% Match, Pitch ${inPitch}Hz ✅` : `Verified: ${matchPercent}% Match ✅`,
    };
  } else if (similarity >= 0.65) {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Similar Tone, Not Owner)',
      matchPercent,
      detail: `Match: ${matchPercent}% (Owner ke liye ≥80% chahiye) ⚠️`,
    };
  } else {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Speaker 2 / Unknown)',
      matchPercent,
      detail: `Mismatch: ${matchPercent}% ❌`,
    };
  }
}
