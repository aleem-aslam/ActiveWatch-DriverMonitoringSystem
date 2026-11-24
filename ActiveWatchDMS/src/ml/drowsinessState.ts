import { DrowsinessLevel, type DrowsinessSnapshot } from '../../types';
import type { DetectionConfig } from './detectionConfig';

// Defaults match the previously tuned values; the app overrides them from the
// user's Settings via setConfig() (see detectionConfig.ts).
const DEFAULT_CONFIG: DetectionConfig = {
  closeThreshold: 0.2,
  openThreshold: 0.23,
  drowsyMs: 1500,
  warningMs: 800,
};

const OPEN_CONFIRM_FRAMES = 2; // consecutive open frames needed to clear (~100-200 ms), filters noise
const NO_FACE_GRACE_MS = 500; // ignore a single dropped/failed frame

/**
 * Plain class (JS thread). Uses wall-clock timestamps rather than frame counts
 * so FPS changes don't change the real-world thresholds.
 *
 * - Thresholds and timing are configurable at runtime (setConfig).
 * - While the face check fails inside the grace period, the caller passes
 *   ear = 0; that is ignored and the previous state is held.
 * - Recovery from DROWSY/WARNING is fast: a short run of clearly-open frames.
 */
export class DrowsinessStateMachine {
  private cfg: DetectionConfig = DEFAULT_CONFIG;
  private closedSinceMs: number | null = null;
  private lastFaceSeenMs: number = Date.now();
  private eyesCurrentlyClosed = false;
  private openStreak = 0;
  private lastSnapshot: DrowsinessSnapshot | null = null;

  setConfig(cfg: DetectionConfig) {
    this.cfg = cfg;
  }

  update(ear: number, faceScore: number, isFacePresent: boolean, now = Date.now()): DrowsinessSnapshot {
    if (!isFacePresent) {
      if (now - this.lastFaceSeenMs > NO_FACE_GRACE_MS) {
        this.closedSinceMs = null;
        this.eyesCurrentlyClosed = false;
        this.openStreak = 0;
        return this.remember(this.snapshot(DrowsinessLevel.NO_FACE, 0, faceScore, now));
      }
      if (this.lastSnapshot) {
        return this.remember({ ...this.lastSnapshot, faceScore, timestamp: now });
      }
      return this.remember(this.snapshot(DrowsinessLevel.NO_FACE, 0, faceScore, now));
    }

    this.lastFaceSeenMs = now;

    if (!this.eyesCurrentlyClosed) {
      if (ear < this.cfg.closeThreshold) {
        this.eyesCurrentlyClosed = true;
        this.closedSinceMs = now;
        this.openStreak = 0;
      }
    } else if (ear > this.cfg.openThreshold) {
      this.openStreak += 1;
      if (this.openStreak >= OPEN_CONFIRM_FRAMES) {
        this.eyesCurrentlyClosed = false;
        this.closedSinceMs = null;
        this.openStreak = 0;
      }
    } else {
      this.openStreak = 0;
    }

    if (!this.eyesCurrentlyClosed || this.closedSinceMs === null) {
      return this.remember(this.snapshot(DrowsinessLevel.AWAKE, ear, faceScore, now));
    }

    const closedForMs = now - this.closedSinceMs;
    if (closedForMs >= this.cfg.drowsyMs) {
      return this.remember(this.snapshot(DrowsinessLevel.DROWSY, ear, faceScore, now, closedForMs));
    }
    if (closedForMs >= this.cfg.warningMs) {
      return this.remember(this.snapshot(DrowsinessLevel.WARNING, ear, faceScore, now, closedForMs));
    }
    return this.remember(this.snapshot(DrowsinessLevel.AWAKE, ear, faceScore, now, closedForMs));
  }

  private remember(s: DrowsinessSnapshot): DrowsinessSnapshot {
    this.lastSnapshot = s;
    return s;
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