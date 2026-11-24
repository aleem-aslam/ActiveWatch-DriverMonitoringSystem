import type { Point3D } from '../../types';

// MediaPipe face-mesh indices: nose tip, and the left/right edge of the face.
const NOSE_TIP = 1;
const FACE_EDGE_A = 234;
const FACE_EDGE_B = 454;

const TURN_ENTER = 0.18; // |ratio - 0.5| above this = head turned (about 35-40 degrees)
const TURN_EXIT = 0.12; // must come back inside this to count as facing the road
const AWAY_MS = 2000; // head turned this long -> "looking away" alarm
const NO_FACE_MS = 3000; // face missing this long -> soft "no face" sound
const LOST_WHILE_TURNED_MS = 1200; // face vanished right after a turn = still looking away
const RECOVER_MS = 300; // facing road this long before the alert clears

export type DistractionState = 'ok' | 'looking_away' | 'no_face';

/** 0.5 = facing the camera. Below/above = turned one way or the other. null if unusable. */
export function headTurnRatio(landmarks: Point3D[]): number | null {
  const nose = landmarks?.[NOSE_TIP];
  const a = landmarks?.[FACE_EDGE_A];
  const b = landmarks?.[FACE_EDGE_B];
  if (!nose || !a || !b) return null;
  const width = Math.abs(b.x - a.x);
  if (width < 1e-6) return null;
  return (nose.x - Math.min(a.x, b.x)) / width;
}

/** Plain JS-thread class, real clock time. Call update() once per processed frame. */
export class DistractionTracker {
  private turned = false;
  private turnedSince: number | null = null;
  private lastTurnedAt = 0;
  private faceLostSince: number | null = null;
  private facingSince: number | null = null;
  private state: DistractionState = 'ok';

  reset() {
    this.turned = false;
    this.turnedSince = null;
    this.faceLostSince = null;
    this.facingSince = null;
    this.state = 'ok';
  }

  update(landmarks: Point3D[] | null, facePresent: boolean, now = Date.now()): DistractionState {
    if (facePresent && landmarks) {
      this.faceLostSince = null;
      const r = headTurnRatio(landmarks);
      if (r !== null) {
        const dev = Math.abs(r - 0.5);
        if (!this.turned && dev > TURN_ENTER) {
          this.turned = true;
          this.turnedSince = now;
          this.facingSince = null;
        } else if (this.turned && dev < TURN_EXIT) {
          if (this.facingSince === null) this.facingSince = now;
          if (now - this.facingSince >= RECOVER_MS) {
            this.turned = false;
            this.turnedSince = null;
            this.facingSince = null;
          }
        } else if (this.turned) {
          this.facingSince = null;
        }
        if (this.turned) this.lastTurnedAt = now;
      }
      this.state =
        this.turned && this.turnedSince !== null && now - this.turnedSince >= AWAY_MS ? 'looking_away' : 'ok';
      return this.state;
    }

    // No usable face.
    if (this.faceLostSince === null) this.faceLostSince = now;
    const lostFor = now - this.faceLostSince;
    // Turned so far the model lost the face: that is still "looking away", not "no face".
    if (this.turned && now - this.lastTurnedAt <= LOST_WHILE_TURNED_MS + lostFor && this.turnedSince !== null) {
      this.state = now - this.turnedSince >= AWAY_MS ? 'looking_away' : 'ok';
      return this.state;
    }
    this.turned = false;
    this.turnedSince = null;
    this.state = lostFor >= NO_FACE_MS ? 'no_face' : 'ok';
    return this.state;
  }
}