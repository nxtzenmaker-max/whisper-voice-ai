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
  ownerVector: number[] | null,
  threshold = 0.72
): { isOwner: boolean; speakerName: string; matchPercent: number } {
  if (!ownerVector || ownerVector.length === 0) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner - Auto Registered)',
      matchPercent: 100,
    };
  }

  const similarity = cosineSimilarity(incomingVector, ownerVector);
  const matchPercent = Math.max(0, Math.min(100, Math.round(similarity * 1000) / 10));

  if (similarity >= threshold) {
    return {
      isOwner: true,
      speakerName: 'Aap (Owner)',
      matchPercent,
    };
  } else {
    return {
      isOwner: false,
      speakerName: 'Koi aur (Speaker 2 / Unknown)',
      matchPercent,
    };
  }
}
