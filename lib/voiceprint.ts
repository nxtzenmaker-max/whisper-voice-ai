import { OwnerProfile } from './db';

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
  ownerProfile: OwnerProfile | null
): { isOwner: boolean; speakerName: string; matchPercent: number; detail?: string } {
  if (!ownerProfile || !ownerProfile.samples || ownerProfile.samples.length === 0) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner - Registered ✅)',
      matchPercent: 100,
      detail: 'Pehle sample se Owner profile set ho gayi',
    };
  }

  // Calculate cosine similarity against all enrolled voice notes of the owner
  const similarities = ownerProfile.samples.map((sample) =>
    cosineSimilarity(incomingVector, sample.vector)
  );
  const bestSimilarity = Math.max(...similarities);
  const matchPercent = Math.max(0, Math.min(100, Math.round(bestSimilarity * 1000) / 10));

  const inPitch = Math.round(incomingPitch || 0);

  // Pitch Envelope Check:
  // Male voices: ~95-155 Hz, Female (Mummy) voices: ~185-265 Hz.
  if (inPitch > 0 && ownerProfile.avgPitch > 0) {
    const upperLimit = Math.max(ownerProfile.maxPitch, ownerProfile.avgPitch) + 35;
    if (inPitch > upperLimit) {
      return {
        isOwner: false,
        speakerName: 'Koi aur (Mummy / Female Voice)',
        matchPercent,
        detail: `Pitch Mismatch: ${inPitch}Hz (Owner Range: ${ownerProfile.minPitch}-${ownerProfile.maxPitch}Hz) ❌`,
      };
    }

    const lowerLimit = Math.min(ownerProfile.minPitch, ownerProfile.avgPitch) - 30;
    if (inPitch < lowerLimit && lowerLimit > 50) {
      return {
        isOwner: false,
        speakerName: 'Koi aur (Alag Aawaz / Low Pitch)',
        matchPercent,
        detail: `Pitch Mismatch: ${inPitch}Hz (Owner Range: ${ownerProfile.minPitch}-${ownerProfile.maxPitch}Hz) ❌`,
      };
    }
  }

  // Vector Match Check:
  // With multiple enrolled samples from the owner, the user's best match with one of their own notes
  // is almost always >= 0.70 (and typically 85%-98%).
  // Other people (or Mummy) with different spectral formants match at 30%-55%.
  if (bestSimilarity >= 0.70) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner)',
      matchPercent,
      detail: inPitch > 0 ? `Multi-Sample Verified (${matchPercent}% • ${inPitch}Hz) ✅` : `Multi-Sample Verified (${matchPercent}%) ✅`,
    };
  } else if (bestSimilarity >= 0.55) {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Similar Tone, Not Owner)',
      matchPercent,
      detail: `Voiceprint Match: ${matchPercent}% (Owner threshold: 70%) ⚠️`,
    };
  } else {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Speaker 2 / Unknown)',
      matchPercent,
      detail: `Voice Mismatch (${matchPercent}%) ❌`,
    };
  }
}
