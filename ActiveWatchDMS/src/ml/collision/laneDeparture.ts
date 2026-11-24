// src/ml/collision/laneDeparture.ts
// Lane-departure warning from the lane lines the detector already finds.
//
// Position in the lane (in lane widths): where the middle of the two lane lines is, seen from
// a camera that points along the road (the vanishing point corrects a turned phone).
//   offset > 0  you are right of the lane centre,  offset < 0  left of it.
// Phones are rarely mounted on the exact centre line, so for the first few seconds of steady
// driving the monitor LEARNS your normal offset ("baseline") and warns only when you move
// well away from it: about 0.22 of a lane width (~0.8 m), held for 0.4 s.
// A drift that lasts more than 4 s is treated as a lane change and the baseline is re-learned.
import type { LaneResult } from './laneDetector';

export type DepartureState = 'OFF' | 'LEARNING' | 'OK' | 'DRIFT_LEFT' | 'DRIFT_RIGHT';

const MIN_SPEED_KMH = 35;
const MIN_CONFIDENCE = 0.7;
const LEARN_SAMPLES = 20; // lane updates (about 3 per second)
const ENTER = 0.22;
const EXIT = 0.14;
const HOLD_MS = 400;
const LANE_CHANGE_MS = 4000;

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export class LaneDepartureMonitor {
  private baseline: number | null = null;
  private learn: number[] = [];
  private driftSince: number | null = null;
  private state: DepartureState = 'LEARNING';
  offsetLanes: number | null = null;

  reset() {
    this.baseline = null;
    this.learn = [];
    this.driftSince = null;
    this.state = 'LEARNING';
    this.offsetLanes = null;
  }

  /** Call whenever the lane finder ran (lane may be null). Returns the current state. */
  update(lane: LaneResult | null, now: number, speedKmh: number | null, enabled: boolean): DepartureState {
    if (!enabled) {
      this.state = 'OFF';
      return this.state;
    }
    if (this.state === 'OFF') this.state = this.baseline === null ? 'LEARNING' : 'OK';

    const usable = lane !== null && lane.confidence >= MIN_CONFIDENCE && speedKmh !== null && speedKmh >= MIN_SPEED_KMH;
    if (!usable || !lane) {
      this.driftSince = null;
      if (this.state === 'DRIFT_LEFT' || this.state === 'DRIFT_RIGHT') this.state = 'OK';
      return this.state;
    }

    const width = lane.right.x0 - lane.left.x0;
    if (width < 0.2 || width > 1.2) return this.state; // not a believable lane
    const centre = (lane.left.x0 + lane.right.x0) / 2 - (lane.vpX - 0.5);
    const offset = (0.5 - centre) / width;
    this.offsetLanes = offset;

    if (this.baseline === null) {
      if (Math.abs(offset) < 0.4) this.learn.push(offset);
      if (this.learn.length >= LEARN_SAMPLES) {
        this.baseline = median(this.learn);
        this.state = 'OK';
      } else {
        this.state = 'LEARNING';
      }
      return this.state;
    }

    const rel = offset - this.baseline;
    const away = this.state === 'DRIFT_LEFT' || this.state === 'DRIFT_RIGHT' ? Math.abs(rel) > EXIT : Math.abs(rel) > ENTER;

    if (!away) {
      this.driftSince = null;
      this.state = 'OK';
      return this.state;
    }
    if (this.driftSince === null) this.driftSince = now;
    if (now - this.driftSince >= LANE_CHANGE_MS) {
      // far too long to be a drift: you changed lanes (or the baseline was wrong). Start over.
      this.baseline = null;
      this.learn = [];
      this.driftSince = null;
      this.state = 'LEARNING';
      return this.state;
    }
    if (now - this.driftSince >= HOLD_MS) this.state = rel > 0 ? 'DRIFT_RIGHT' : 'DRIFT_LEFT';
    return this.state;
  }
}