// src/ml/collision/ttcEstimator.ts
// JS-thread logic for the road (rear) camera. It turns YOLO boxes into:
//   1. TRACKS      each vehicle/person gets an id that follows it from frame to frame
//   2. POSITION    forward distance Z and sideways offset X in metres (pinhole model)
//   3. VELOCITY    closing speed and sideways speed, from a 1.2 s least-squares fit
//   4. LEAD SPEED  speed of the car ahead = your GPS speed + its relative speed
//   5. WARNINGS    three kinds, each only after several confirmations:
//        APPROACHING   predicted path reaches your bumper inside your lane
//        CROSSING      same, but the object is coming in from the side
//        HARD_BRAKING  the car ahead loses a lot of speed within ~2.5 s
//
// Distance needs assumptions (typical real heights, camera field of view) so it is
// approximate; speeds are derived from how that distance CHANGES and are better
// than the distance itself.
import type { Detection } from './yoloDecoder';

export type CollisionLevel = 'SAFE' | 'CAUTION' | 'COLLISION';
export type WarningReason = 'NONE' | 'APPROACHING' | 'CROSSING' | 'HARD_BRAKING' | 'TAILGATING';

export type TrackInfo = {
  id: number;
  det: Detection;
  distanceM: number | null; // forward distance
  lateralM: number | null; // + right of your car's centre line, - left
  closingMps: number | null; // + = getting closer
  speedKmh: number | null; // speed of that vehicle (needs GPS), only for vehicles ahead in your lane area
  risk: CollisionLevel;
  reason: WarningReason;
};

export type CollisionSnapshot = {
  level: CollisionLevel;
  ttcSeconds: number | null; // predicted time until it reaches your bumper (null = no threat)
  distanceMeters: number | null;
  target: Detection | null; // the box to highlight
  reason: WarningReason;
  message: string; // text for the banner
  leadSpeedKmh: number | null; // speed of the nearest car ahead (needs GPS)
  youBraking: boolean; // you are already braking hard, so the beep was held back
  headwaySeconds: number | null; // gap to the car ahead in seconds of travel (needs your speed)
  tracks: TrackInfo[];
};

export type TtcConfig = {
  ttcThresholdSeconds: number; // below this -> COLLISION (proposal: 2.5 s)
  verticalFovDegrees: number; // phone rear camera field of view along the LONG side of the frame
  followingEnabled: boolean; // warn when following too closely
  followingGapSeconds: number; // ... closer than this many seconds
};

export const DEFAULT_TTC_CONFIG: TtcConfig = {
  ttcThresholdSeconds: 2.5,
  verticalFovDegrees: 65,
  followingEnabled: true,
  followingGapSeconds: 1.5,
};

// Typical real-world heights (m) used for the distance estimate.
// person 0 (a seated rider is lower than a standing person), bicycle 1, car 2, motorcycle 3, bus 5, truck 7.
const REAL_HEIGHT_M: Record<number, number> = { 0: 1.5, 1: 1.1, 2: 1.5, 3: 1.2, 5: 3.2, 7: 3.0 };
// Half of the object's width (m), used to decide whether paths overlap.
const OBJ_HALF_WIDTH_M: Record<number, number> = { 0: 0.3, 1: 0.4, 2: 0.9, 3: 0.5, 5: 1.3, 7: 1.3 };

const OUR_HALF_WIDTH_M = 0.95; // your car is ~1.9 m wide
const CAMERA_TO_BUMPER_M = 1.0;
const OBJ_DEPTH_M = 1.5; // we count a hit once the object's centre is this close to the bumper

const MAX_RANGE_M = 60; // beyond this the estimate is too noisy to warn on
const HORIZON_S = 6; // how far ahead the path is predicted
const MIN_CLOSING_MPS = 1.5; // slower closing than this (~5 km/h) is noise
const LAT_DEADBAND_MPS = 0.6; // sideways speeds below this are treated as zero
const LEAD_HALF_WIDTH_M = 2.0; // "ahead of me": within +-2 m of the centre line

const VEL_WINDOW_MS = 1200;
const SAMPLE_KEEP_MS = 1500;
const TRACK_LOST_MS = 700;
const IOU_MATCH = 0.25;
const MIN_HITS = 5; // frames a track must be seen before it can raise a warning
const MIN_AGE_MS = 600;
const MIN_SCORE_ALERT = 0.45;
const CONFIRM_UPDATES = 3; // consecutive danger results before COLLISION
const HOLD_MS = 800; // keep COLLISION on this long after the last danger frame (no flicker)

// Hard braking of the car ahead:
const BRAKE_WINDOW_MS = 2500;
const BRAKE_MIN_DROP_MPS = 5.5; // ~20 km/h lost
const BRAKE_MIN_RATIO = 0.7; // and below 70 % of its peak speed (GPS mode only)
const BRAKE_MIN_DECEL = 2.5; // m/s^2
const BRAKE_HOLD_MS = 3000; // keep the "braking" flag this long
const MAX_SHOWN_TTC_S = 15;

// Following distance: needs your own speed; ignored below 18 km/h.
const TAILGATE_MIN_SPEED_MPS = 5;
const TAILGATE_CAUTION_AFTER_MS = 2000; // too close for this long -> amber banner
const TAILGATE_SEVERE_FACTOR = 0.5; // gap below half the limit ...
const TAILGATE_SEVERE_AFTER_MS = 3000; // ... for this long -> alarm

// You are already braking hard: do not beep for a warning that is not an emergency.
const OWN_BRAKE_DECEL = 2.0; // m/s^2
const OWN_BRAKE_EMERGENCY_TTC_S = 1.2; // below this the beep stays on whatever you do

type Sample = { t: number; z: number; x: number };
type Track = {
  id: number;
  det: Detection;
  firstSeen: number;
  lastSeen: number;
  hits: number;
  hS: number; // smoothed box height
  z: number | null;
  x: number | null;
  samples: Sample[];
  vz: number | null; // forward velocity relative to you (m/s); negative = closing
  vx: number | null;
  mode: boolean; // true when own GPS speed was used for vS
  vS: number | null; // smoothed (absolute or relative) forward speed
  vHist: { t: number; v: number }[];
  brakeUntil: number;
  streak: number;
  tHit: number | null;
  risk: CollisionLevel;
  reason: WarningReason;
};

/** Tangents of the half field of view, vertical and horizontal, for a frame of this aspect (w/h). */
function fovTangents(longSideFovDeg: number, aspect: number) {
  const tanLong = Math.tan((longSideFovDeg * Math.PI) / 360);
  if (aspect < 1) return { tanV: tanLong, tanH: tanLong * aspect }; // portrait: height is the long side
  return { tanV: tanLong / aspect, tanH: tanLong };
}

/**
 * Pinhole-camera distance from the apparent height of the box.
 *   distance = realHeight / (2 * boxHeight * tan(vFov / 2))   (box height as a fraction of frame height)
 * Returns null when the box touches the top/bottom of the frame (cut off, so too short)
 * or is too small to trust.
 */
export function estimateDistanceM(
  d: Detection,
  longSideFovDegrees = DEFAULT_TTC_CONFIG.verticalFovDegrees,
  aspect = 0.75
): number | null {
  const h = d.y1 - d.y0;
  if (h < 0.03) return null;
  if (d.y0 <= 0.01 || d.y1 >= 0.99) return null;
  const realH = REAL_HEIGHT_M[d.classId] ?? 1.5;
  const { tanV } = fovTangents(longSideFovDegrees, aspect);
  return realH / (2 * h * tanV);
}

const VEHICLE = new Set([2, 5, 7]);
function sameKind(a: number, b: number) {
  return a === b || (VEHICLE.has(a) && VEHICLE.has(b));
}

function iou(a: Detection, b: Detection): number {
  const ix0 = Math.max(a.x0, b.x0);
  const iy0 = Math.max(a.y0, b.y0);
  const ix1 = Math.min(a.x1, b.x1);
  const iy1 = Math.min(a.y1, b.y1);
  const inter = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0);
  const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
  return union > 0 ? inter / union : 0;
}

/** Least-squares slope of value(t) in units per second. */
function slope(pts: { t: number; v: number }[]): number {
  const n = pts.length;
  const t0 = pts[0].t;
  let sT = 0, sV = 0, sTT = 0, sTV = 0;
  for (const p of pts) {
    const x = (p.t - t0) / 1000;
    sT += x; sV += p.v; sTT += x * x; sTV += x * p.v;
  }
  const den = n * sTT - sT * sT;
  return den !== 0 ? (n * sTV - sT * sV) / den : 0;
}

const RANK: Record<CollisionLevel, number> = { SAFE: 0, CAUTION: 1, COLLISION: 2 };

export class TtcEstimator {
  private cfg: TtcConfig = { ...DEFAULT_TTC_CONFIG };
  private tracks: Track[] = [];
  private nextId = 1;
  private ownSpeedMps: number | null = null;
  private ownDecel: number | null = null;
  private pathCenterX = 0.5;
  private distScale = 1;
  private tailSince: number | null = null;
  private tailSevereSince: number | null = null;
  private lastDangerAt = 0;
  private held: { reason: WarningReason; message: string; target: Detection | null } | null = null;

  setConfig(cfg: Partial<TtcConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  /** Your own speed from GPS in m/s, or null when unknown (then speeds are relative to you). */
  setOwnSpeed(mps: number | null) {
    this.ownSpeedMps = mps !== null && mps >= 0 ? (mps < 0.5 ? 0 : mps) : null;
  }

  /** Distance calibration: multiplies every distance (1 = none). */
  setDistanceScale(k: number) {
    this.distScale = Math.max(0.4, Math.min(2.5, k));
  }

  /** How hard you are braking, m/s^2 (positive = slowing). null = unknown. */
  setOwnDecel(a: number | null) {
    this.ownDecel = a;
  }

  /** Image x (0..1) the car is heading towards (the lane's vanishing point). 0.5 = frame centre. */
  setPathCenter(x: number | null) {
    this.pathCenterX = x === null ? 0.5 : Math.max(0.3, Math.min(0.7, x));
  }

  reset() {
    this.tracks = [];
    this.lastDangerAt = 0;
    this.held = null;
    this.tailSince = null;
    this.tailSevereSince = null;
  }

  update(detections: Detection[], now = Date.now(), aspect = 0.75): CollisionSnapshot {
    const { tanV, tanH } = fovTangents(this.cfg.verticalFovDegrees, aspect);
    const own = this.ownSpeedMps;
    const thr = this.cfg.ttcThresholdSeconds;

    // ---- 1) associate detections with tracks -------------------------------------
    const free = this.tracks.slice();
    const updated = new Set<Track>();
    const sorted = [...detections].sort((a, b) => b.score - a.score);
    for (const d of sorted) {
      let best: Track | null = null;
      let bestIou = IOU_MATCH;
      for (const tr of free) {
        if (!sameKind(tr.det.classId, d.classId)) continue;
        const v = iou(tr.det, d);
        if (v > bestIou) { bestIou = v; best = tr; }
      }
      const h = d.y1 - d.y0;
      if (best) {
        free.splice(free.indexOf(best), 1);
        best.det = d;
        best.hits += 1;
        best.lastSeen = now;
        best.hS = best.hS * 0.5 + h * 0.5;
        updated.add(best);
      } else {
        const tr: Track = {
          id: this.nextId++, det: d, firstSeen: now, lastSeen: now, hits: 1, hS: h,
          z: null, x: null, samples: [], vz: null, vx: null,
          mode: own !== null, vS: null, vHist: [], brakeUntil: 0, streak: 0, tHit: null,
          risk: 'SAFE', reason: 'NONE',
        };
        this.tracks.push(tr);
        updated.add(tr);
      }
    }
    this.tracks = this.tracks.filter((t) => now - t.lastSeen <= TRACK_LOST_MS);

    // ---- 2-5) per track: position, velocity, lead speed, risk ---------------------
    for (const tr of this.tracks) {
      if (!updated.has(tr)) continue; // not seen this frame: keep the old state

      const d = tr.det;
      const cut = d.y0 <= 0.01 || d.y1 >= 0.99;
      if (!cut && tr.hS >= 0.03) {
        const realH = REAL_HEIGHT_M[d.classId] ?? 1.5;
        const z = (realH / (2 * tr.hS * tanV)) * this.distScale;
        const cx = (d.x0 + d.x1) / 2;
        tr.z = z;
        tr.x = z * (cx - this.pathCenterX) * 2 * tanH;
        tr.samples.push({ t: now, z, x: tr.x });
        while (tr.samples.length > 0 && now - tr.samples[0].t > SAMPLE_KEEP_MS) tr.samples.shift();
      }

      // velocity (relative to you)
      const win = tr.samples.filter((p) => now - p.t <= VEL_WINDOW_MS);
      if (win.length >= 5 && win[win.length - 1].t - win[0].t >= 400) {
        const rz = slope(win.map((p) => ({ t: p.t, v: p.z })));
        const rx = slope(win.map((p) => ({ t: p.t, v: p.x })));
        tr.vz = tr.vz === null ? rz : tr.vz * 0.5 + rz * 0.5;
        tr.vx = tr.vx === null ? rx : tr.vx * 0.5 + rx * 0.5;
      }

      const isLead = tr.z !== null && tr.x !== null && Math.abs(tr.x) < LEAD_HALF_WIDTH_M && tr.z <= MAX_RANGE_M;
      const eligible =
        tr.hits >= MIN_HITS && now - tr.firstSeen >= MIN_AGE_MS && d.score >= MIN_SCORE_ALERT &&
        tr.z !== null && tr.x !== null && tr.z <= MAX_RANGE_M && tr.vz !== null;

      // lead-vehicle speed series: vz = (its speed) - (your speed), so its speed = vz + yours
      if (tr.vz !== null) {
        const mode = own !== null;
        if (tr.mode !== mode) { tr.mode = mode; tr.vS = null; tr.vHist = []; }
        const raw = tr.vz + (own ?? 0);
        tr.vS = tr.vS === null ? raw : tr.vS * 0.65 + raw * 0.35;
        tr.vHist.push({ t: now, v: tr.vS });
        while (tr.vHist.length > 0 && now - tr.vHist[0].t > BRAKE_WINDOW_MS) tr.vHist.shift();

        if (isLead && eligible && tr.vHist.length >= 6 && now - tr.vHist[0].t >= 1000) {
          let peak = tr.vHist[0];
          for (const p of tr.vHist) if (p.v > peak.v) peak = p;
          const drop = peak.v - tr.vS;
          const dt = (now - peak.t) / 1000;
          const ratioOk = tr.mode ? tr.vS <= peak.v * BRAKE_MIN_RATIO : true;
          if (dt >= 0.4 && drop >= BRAKE_MIN_DROP_MPS && ratioOk && drop / dt >= BRAKE_MIN_DECEL) {
            tr.brakeUntil = now + BRAKE_HOLD_MS;
          }
        }
      }

      // predicted path: does it reach your bumper inside your lane?
      tr.tHit = null;
      let crossing = false;
      let half = OUR_HALF_WIDTH_M + (OBJ_HALF_WIDTH_M[d.classId] ?? 0.9);
      if (eligible && tr.vz !== null && tr.vz <= -MIN_CLOSING_MPS && tr.z !== null && tr.x !== null) {
        const vx0 = tr.vx ?? 0;
        const vx = Math.abs(vx0) < LAT_DEADBAND_MPS ? 0 : vx0;
        for (let t = 0; t <= HORIZON_S; t += 0.1) {
          const zt = tr.z + tr.vz * t;
          const xt = tr.x + vx * t;
          if (zt < -2) break;
          const w = half + 0.02 * tr.z + 0.15 * t; // allow for measurement noise, growing with time
          if (zt <= CAMERA_TO_BUMPER_M + OBJ_DEPTH_M && Math.abs(xt) < w) { tr.tHit = t; break; }
        }
        crossing = Math.abs(vx) >= 1.0 && Math.abs(tr.x) > half;
      }

      let risk: CollisionLevel = 'SAFE';
      let reason: WarningReason = 'NONE';
      if (tr.tHit !== null) {
        reason = crossing ? 'CROSSING' : 'APPROACHING';
        if (tr.tHit < thr) risk = 'COLLISION';
        else if (tr.tHit < thr * 1.6) risk = 'CAUTION';
      }
      if (isLead && eligible && now < tr.brakeUntil && tr.z !== null) {
        reason = 'HARD_BRAKING';
        const gapLimit = Math.max(15, 2 * (own ?? 0)); // ~2 s of travel, at least 15 m
        const close = tr.z < gapLimit || (tr.tHit !== null && tr.tHit < thr * 1.6);
        if (close) risk = 'COLLISION';
        else if (risk === 'SAFE') risk = 'CAUTION';
      }

      if (risk === 'COLLISION') tr.streak += 1;
      else tr.streak = 0;
      if (risk === 'COLLISION' && tr.streak < CONFIRM_UPDATES) risk = 'CAUTION'; // confirm first
      tr.risk = risk;
      tr.reason = risk === 'SAFE' ? 'NONE' : reason;
    }

    // ---- 6) overall result -----------------------------------------------------------
    const seen = this.tracks.filter((t) => now - t.lastSeen <= 300);
    const infos: TrackInfo[] = seen.map((t) => {
      const lead = t.z !== null && t.x !== null && Math.abs(t.x) < LEAD_HALF_WIDTH_M;
      return {
        id: t.id,
        det: t.det,
        distanceM: t.z,
        lateralM: t.x,
        closingMps: t.vz !== null ? -t.vz : null,
        speedKmh: lead && t.mode && t.vS !== null ? Math.max(0, t.vS) * 3.6 : null,
        risk: t.risk,
        reason: t.reason,
      };
    });

    // worst track wins; ties go to the closest
    let worst: Track | null = null;
    for (const t of seen) {
      if (t.risk === 'SAFE') continue;
      if (!worst || RANK[t.risk] > RANK[worst.risk] || (RANK[t.risk] === RANK[worst.risk] && (t.z ?? 1e9) < (worst.z ?? 1e9))) {
        worst = t;
      }
    }
    // nearest car ahead, for the distance / speed readout when nothing is wrong
    let lead: Track | null = null;
    for (const t of seen) {
      if (t.z === null || t.x === null || Math.abs(t.x) >= LEAD_HALF_WIDTH_M) continue;
      if (!lead || t.z < (lead.z ?? 1e9)) lead = t;
    }
    const shown = worst ?? lead;
    const leadInfo = lead ? infos.find((i) => i.id === lead!.id) : undefined;

    let level: CollisionLevel = worst ? worst.risk : 'SAFE';
    let reason: WarningReason = worst ? worst.reason : 'NONE';
    let target: Detection | null = shown ? shown.det : null;

    // ---- following distance (only when nothing more urgent is going on) ----------------
    let headway: number | null = null;
    if (lead && lead.z !== null && own !== null && own >= TAILGATE_MIN_SPEED_MPS && lead.hits >= MIN_HITS) {
      headway = lead.z / own;
    }
    const gap = this.cfg.followingGapSeconds;
    if (this.cfg.followingEnabled && headway !== null && headway < gap) {
      if (this.tailSince === null) this.tailSince = now;
      if (headway < gap * TAILGATE_SEVERE_FACTOR) {
        if (this.tailSevereSince === null) this.tailSevereSince = now;
      } else this.tailSevereSince = null;
    } else {
      this.tailSince = null;
      this.tailSevereSince = null;
    }
    if (level === 'SAFE' && lead && this.tailSince !== null && now - this.tailSince >= TAILGATE_CAUTION_AFTER_MS) {
      const severe = this.tailSevereSince !== null && now - this.tailSevereSince >= TAILGATE_SEVERE_AFTER_MS;
      level = severe ? 'COLLISION' : 'CAUTION';
      reason = 'TAILGATING';
      target = lead.det;
    }

    if (level === 'COLLISION') {
      this.lastDangerAt = now;
      this.held = { reason, message: messageFor('COLLISION', reason), target };
    } else if (this.held && now - this.lastDangerAt < HOLD_MS) {
      level = 'COLLISION';
      reason = this.held.reason;
      target = this.held.target ?? target;
    }

    const ttc = shown && shown.tHit !== null && shown.tHit <= MAX_SHOWN_TTC_S ? shown.tHit : null;

    // You are already braking hard and it is not an emergency: banner only, no beep.
    let youBraking = false;
    if (level === 'COLLISION' && this.ownDecel !== null && this.ownDecel >= OWN_BRAKE_DECEL && (ttc === null || ttc >= OWN_BRAKE_EMERGENCY_TTC_S)) {
      level = 'CAUTION';
      youBraking = true;
    }

    return {
      level,
      ttcSeconds: ttc,
      distanceMeters: shown ? shown.z : null,
      target,
      reason,
      message: messageFor(level, reason) + (youBraking ? ' (you are braking)' : ''),
      leadSpeedKmh: leadInfo ? leadInfo.speedKmh : null,
      youBraking,
      headwaySeconds: headway,
      tracks: infos,
    };
  }
}

function messageFor(level: CollisionLevel, reason: WarningReason): string {
  if (level === 'SAFE') return '';
  const base =
    reason === 'HARD_BRAKING' ? 'SUDDEN BRAKING AHEAD'
    : reason === 'TAILGATING' ? 'FOLLOWING TOO CLOSE'
    : reason === 'CROSSING' ? 'VEHICLE CROSSING'
    : 'COLLISION WARNING';
  return level === 'COLLISION' ? base : `CAUTION: ${base}`;
}