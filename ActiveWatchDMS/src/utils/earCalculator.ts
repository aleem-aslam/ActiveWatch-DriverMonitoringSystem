// src/utils/earCalculator.ts

// Simple Euclidean distance between two 2D points
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function calculateEAR(eyeLandmarks: { x: number; y: number }[]) {
  // eyeLandmarks expects 6 specific points around an eye
  if (!eyeLandmarks || eyeLandmarks.length < 6) return 1.0;

  const vertical1 = distance(eyeLandmarks[1], eyeLandmarks[5]);
  const vertical2 = distance(eyeLandmarks[2], eyeLandmarks[4]);
  const horizontal = distance(eyeLandmarks[0], eyeLandmarks[3]);

  const ear = (vertical1 + vertical2) / (2.0 * horizontal);
  return ear;
}