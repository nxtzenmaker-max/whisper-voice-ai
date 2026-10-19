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
  // STRICT GATE: If owner has not enrolled any voice, NO ONE is owner!
  if (!ownerProfile || !ownerProfile.samples || ownerProfile.samples.length === 0) {
    return {
      isOwner: false,
      speakerName: 'Unknown (Owner Not Enrolled)',
      matchPercent: 0,
      detail: 'Owner voice register nahi hui hai. Pehle Enroll Voice Mode me 3 samples boliye!',
    };
  }

  // Calculate cosine similarity against all enrolled voice notes of the owner
  const similarities = ownerProfile.samples.map((sample) =>
    cosineSimilarity(incomingVector, sample.vector)
  );
  const bestSimilarity = Math.max(...similarities);

  // Calibrate similarity scale:
  // Raw positive filterbank similarity for strangers is ~0.80 - 0.90.
  // Genuine owner voice matches at ~0.95 - 0.99.
  // Scale: 0.85 -> 0%, 0.98 -> 100%
  const calibrated = Math.max(
    0,
    Math.min(100, Math.round(((bestSimilarity - 0.85) / (0.98 - 0.85)) * 1000) / 10)
  );
  const matchPercent = calibrated;

  const inPitch = Math.round(incomingPitch || 0);

  // 1. Pitch Envelope Check:
  // Real owner's pitch must fall within owner's enrolled pitch envelope (+/- 25 Hz)
  if (ownerProfile.avgPitch > 0) {
    if (inPitch > 0) {
      const upperLimit = Math.max(ownerProfile.maxPitch, ownerProfile.avgPitch) + 25;
      if (inPitch > upperLimit) {
        return {
          isOwner: false,
          speakerName: 'Koi aur (High Pitch / Stranger)',
          matchPercent,
          detail: `Pitch Mismatch: ${inPitch}Hz (Owner Range: ${ownerProfile.minPitch}-${ownerProfile.maxPitch}Hz) ❌`,
        };
      }

      const lowerLimit = Math.min(ownerProfile.minPitch, ownerProfile.avgPitch) - 25;
      if (inPitch < lowerLimit && lowerLimit > 50) {
        return {
          isOwner: false,
          speakerName: 'Koi aur (Low Pitch / Stranger)',
          matchPercent,
          detail: `Pitch Mismatch: ${inPitch}Hz (Owner Range: ${ownerProfile.minPitch}-${ownerProfile.maxPitch}Hz) ❌`,
        };
      }
    } else {
      // Unvoiced or whisper: require very high vector similarity
      if (bestSimilarity < 0.96) {
        return {
          isOwner: false,
          speakerName: 'Koi aur (Unclear / Stranger)',
          matchPercent,
          detail: `Unvoiced pitch and similarity too low (${matchPercent}%) ❌`,
        };
      }
    }
  }

  // 2. Vector Threshold Check:
  // Genuine owner must achieve at least 70% calibrated match (raw similarity >= 0.941)
  if (matchPercent >= 70.0 && bestSimilarity >= 0.941) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner)',
      matchPercent,
      detail:
        inPitch > 0
          ? `Biometric Verified (${matchPercent}% • ${inPitch}Hz) ✅`
          : `Biometric Verified (${matchPercent}%) ✅`,
    };
  } else if (matchPercent >= 45.0) {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Similar Pitch, Not Owner)',
      matchPercent,
      detail: `Voiceprint Match: ${matchPercent}% (Owner threshold: 70%) ⚠️`,
    };
  } else {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Unknown Voice)',
      matchPercent,
      detail: `Voice Mismatch (${matchPercent}%) ❌`,
    };
  }
}
