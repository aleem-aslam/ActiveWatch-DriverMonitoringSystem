// src/hooks/useRoadEvents.ts
// Watches the road snapshot and reports each NEW warning once (not every frame):
// to the trip log, and (signed-in users) to the fleet dashboard.
import { useEffect, useRef } from 'react';
import type { CollisionSnapshot } from '../ml/collision/ttcEstimator';
import { recordEvent } from '../services/tripStore';
import { pushFleetEvent } from '../firebase/fleetService';
import type { GpsFix } from './useOwnSpeed';

const COOLDOWN_MS = 8000; // same kind of warning is counted at most once per 8 s

export function useRoadEvents(
  road: CollisionSnapshot,
  uid: string | null | undefined,
  getFix: () => GpsFix | null,
  ownSpeedKmh: number | null
) {
  const prevActive = useRef(false);
  const lastAt = useRef(0);
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const speedRef = useRef(ownSpeedKmh);
  speedRef.current = ownSpeedKmh;

  // "active" = a real warning, including one whose beep was held back because you are braking
  const isActive = road.level === 'COLLISION' || road.youBraking;

  useEffect(() => {
    const rising = isActive && !prevActive.current;
    prevActive.current = isActive;
    if (!rising) return;
    const now = Date.now();
    if (now - lastAt.current < COOLDOWN_MS) return;
    lastAt.current = now;

    const hard = road.reason === 'HARD_BRAKING';
    recordEvent(hard ? 'hardBraking' : 'nearMiss');

    const u = uidRef.current;
    if (u) {
      const fix = getFix();
      pushFleetEvent(u, {
        type: road.reason === 'NONE' ? 'APPROACHING' : road.reason,
        occurredAtIso: new Date(now).toISOString(),
        ttcSeconds: road.ttcSeconds,
        distanceMeters: road.distanceMeters,
        leadSpeedKmh: road.leadSpeedKmh,
        ownSpeedKmh: speedRef.current,
        latitude: fix?.lat ?? null,
        longitude: fix?.lng ?? null,
        detail: road.youBraking ? 'driver already braking' : null,
      });
    }
  }, [isActive, road, getFix]);
}