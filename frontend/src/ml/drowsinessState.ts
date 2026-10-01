import { DrowsinessLevel, type DrowsinessSnapshot } from '../../types';

// Two different thresholds (hysteresis) instead of one — this is what stops
// the alert from flickering on/off when EAR noise hovers near a single
// cutoff. Calibrate these per-device/lighting if needed.
const EAR_CLOSE_THRESHOLD = 0.20; // below this -> counted as "closed"
const EAR_OPEN_THRESHOLD = 0.25; // above this -> counted as "clearly open" again

const WARNING_MS = 800; // eyes closed this long -> pre-alert state
const DROWSY_MS = 1500; // eyes closed this long -> full alert (matches your spec)
const NO_FACE_GRACE_MS = 500; // ignore a single dropped/failed frame

/**
 * Plain class, not a worklet — this holds mutable state across time and
 * is meant to run on the JS thread, fed by runOnJS() from the frame
 * processor. Do NOT try to run this inside the worklet itself: React state
 * updates and audio playback (the beep) can only happen on the JS thread.
 *
 * BUG THIS FIXES: counting "closed for N consecutive frames" assumes a
 * perfectly steady FPS. Inference time varies (thermal throttling, other
 * apps, older devices), so a frame-count threshold silently becomes a
 * different real-world duration over time. This tracks wall-clock
 * timestamps instead.
 */
export class DrowsinessStateMachine {
  private closedSinceMs: number | null = null;
  private lastFaceSeenMs: number = Date.now();
  private eyesCurrentlyClosed = false;

  update(ear: number, faceScore: number, isFacePresent: boolean, now = Date.now()): DrowsinessSnapshot {
    if (!isFacePresent) {
      // Don't instantly flip to NO_FACE on one bad frame (blink motion blur,
      // brief occlusion by a hand, etc.) — require a short grace period.
      if (now - this.lastFaceSeenMs > NO_FACE_GRACE_MS) {
        this.closedSinceMs = null;
        this.eyesCurrentlyClosed = false;
        return this.snapshot(DrowsinessLevel.NO_FACE, ear, faceScore, now);
      }
      // still within grace period — fall through and keep last known state
    } else {
      this.lastFaceSeenMs = now;
    }

    // Hysteresis: only flip state on a clear crossing, not on every wiggle
    // around a single threshold.
    if (!this.eyesCurrentlyClosed && ear < EAR_CLOSE_THRESHOLD) {
      this.eyesCurrentlyClosed = true;
      this.closedSinceMs = now;
    } else if (this.eyesCurrentlyClosed && ear > EAR_OPEN_THRESHOLD) {
      this.eyesCurrentlyClosed = false;
      this.closedSinceMs = null;
    }

    if (!this.eyesCurrentlyClosed || this.closedSinceMs === null) {
      return this.snapshot(DrowsinessLevel.AWAKE, ear, faceScore, now);
    }

    const closedForMs = now - this.closedSinceMs;
    if (closedForMs >= DROWSY_MS) {
      return this.snapshot(DrowsinessLevel.DROWSY, ear, faceScore, now, closedForMs);
    }
    if (closedForMs >= WARNING_MS) {
      return this.snapshot(DrowsinessLevel.WARNING, ear, faceScore, now, closedForMs);
    }
    return this.snapshot(DrowsinessLevel.AWAKE, ear, faceScore, now, closedForMs);
  }

  private snapshot(
    level: DrowsinessLevel,
    ear: number,
    faceScore: number,
    timestamp: number,
    eyesClosedForMs = 0
  ): DrowsinessSnapshot {
    return { level, ear, faceScore, timestamp, eyesClosedForMs };
  }
}
