// src/services/tripStore.ts
// Collects what happens during one monitoring session ("trip"): duration, distance and
// speed (needs GPS), and how many drowsiness / hard-braking / near-miss events there were.
// MonitoringScreen starts a trip when it opens and ends it when it closes.

export type TripEventKind = 'drowsy' | 'hardBraking' | 'nearMiss';

export type TripSummary = {
  startedAtIso: string;
  endedAtIso: string;
  durationSec: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number | null; // null when there was no GPS speed
  drowsyEvents: number;
  hardBrakingEvents: number;
  nearMisses: number;
};

type Active = {
  startedAt: number;
  lastSpeedAt: number | null;
  distanceM: number;
  maxMps: number;
  movingSec: number;
  drowsy: number;
  hardBraking: number;
  nearMiss: number;
};

let active: Active | null = null;
let last: TripSummary | null = null;

export function startTrip() {
  if (active) return;
  active = { startedAt: Date.now(), lastSpeedAt: null, distanceM: 0, maxMps: 0, movingSec: 0, drowsy: 0, hardBraking: 0, nearMiss: 0 };
}

export function recordEvent(kind: TripEventKind) {
  if (!active) return;
  if (kind === 'drowsy') active.drowsy += 1;
  else if (kind === 'hardBraking') active.hardBraking += 1;
  else active.nearMiss += 1;
}

/** Call about once a second with your GPS speed in km/h (null if unknown). */
export function recordSpeed(kmh: number | null) {
  if (!active || kmh === null) return;
  const now = Date.now();
  const mps = kmh / 3.6;
  if (active.lastSpeedAt !== null) {
    const dt = Math.min(3, (now - active.lastSpeedAt) / 1000);
    active.distanceM += mps * dt;
    if (mps > 1) active.movingSec += dt;
  }
  active.lastSpeedAt = now;
  if (mps > active.maxMps) active.maxMps = mps;
}

export function endTrip(): TripSummary | null {
  if (!active) return null;
  const a = active;
  active = null;
  const now = Date.now();
  const hadSpeed = a.lastSpeedAt !== null;
  const summary: TripSummary = {
    startedAtIso: new Date(a.startedAt).toISOString(),
    endedAtIso: new Date(now).toISOString(),
    durationSec: Math.round((now - a.startedAt) / 1000),
    distanceKm: Math.round((a.distanceM / 1000) * 100) / 100,
    maxSpeedKmh: Math.round(a.maxMps * 3.6),
    avgSpeedKmh: hadSpeed && a.movingSec > 5 ? Math.round((a.distanceM / a.movingSec) * 3.6) : null,
    drowsyEvents: a.drowsy,
    hardBrakingEvents: a.hardBraking,
    nearMisses: a.nearMiss,
  };
  last = summary;
  return summary;
}

export function getLastTrip(): TripSummary | null {
  return last;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export function describeTrip(t: TripSummary): string {
  const lines = [
    `Duration: ${formatDuration(t.durationSec)}`,
    t.avgSpeedKmh !== null ? `Distance: ${t.distanceKm} km  (avg ${t.avgSpeedKmh}, max ${t.maxSpeedKmh} km/h)` : 'Distance: not available (no GPS)',
    `Drowsiness events: ${t.drowsyEvents}`,
    `Hard-braking events ahead: ${t.hardBrakingEvents}`,
    `Near misses: ${t.nearMisses}`,
  ];
  return lines.join('\n');
}