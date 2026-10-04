// src/ml/detectionConfig.ts
// Turns the user-facing settings into the numbers the state machine uses.

export type DetectionConfig = {
  closeThreshold: number; // EAR below this = eyes closed
  openThreshold: number; // EAR above this (for a couple of frames) = eyes open again
  drowsyMs: number; // closed this long -> DROWSY
  warningMs: number; // closed this long -> WARNING
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Sensitivity 0..100 maps to the "closed" EAR threshold 0.12..0.22.
 * The default (80) lands exactly on 0.20, the value we tuned with, so default
 * behaviour is unchanged. Higher sensitivity = higher threshold = more eye
 * closure counts as "closed" = alert comes easier.
 */
export function configFromSettings(s: {
  drowsinessSensitivity: number;
  drowsinessTimeSeconds: number;
}): DetectionConfig {
  const sensitivity = clamp(s.drowsinessSensitivity, 0, 100);
  const closeThreshold = 0.12 + (sensitivity / 100) * 0.1;
  const openThreshold = closeThreshold + 0.03;
  const drowsyMs = Math.round(clamp(s.drowsinessTimeSeconds, 0.3, 10) * 1000);
  const warningMs = Math.round(drowsyMs * 0.53); // 1500 ms -> ~800 ms, as before
  return { closeThreshold, openThreshold, drowsyMs, warningMs };
}