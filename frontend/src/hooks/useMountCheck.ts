// src/hooks/useMountCheck.ts
// "Is the phone mounted well?" Uses the lane's vanishing point:
//   horizon too high / too low  -> phone tilted down / up
//   vanishing point far left / right of centre -> phone turned away from the road direction
// A message appears only when the problem lasts a few seconds, and goes away when fixed.
// A short "mount the phone" reminder is shown when monitoring starts.
import { useEffect, useRef, useState } from 'react';

export type LaneInfo = { vpX: number; vpY: number; confidence: number; at: number };

const BAD_FOR_MS = 4000;
const GOOD_FOR_MS = 2000;
const START_REMINDER_MS = 6000;
const MIN_CONFIDENCE = 0.6;

function problemFor(l: LaneInfo): string | null {
  if (l.vpY < 0.28) return 'Phone is tilted down: tilt it up a little';
  if (l.vpY > 0.62) return 'Phone is tilted up: tilt it down a little';
  if (l.vpX < 0.38) return 'Phone points right of the road: turn it left';
  if (l.vpX > 0.62) return 'Phone points left of the road: turn it right';
  return null;
}

export function useMountCheck(lane: LaneInfo | null, enabled: boolean): string | null {
  const [message, setMessage] = useState<string | null>(null);
  const [reminder, setReminder] = useState(enabled);
  const badSince = useRef<number | null>(null);
  const goodSince = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setReminder(true);
    const id = setTimeout(() => setReminder(false), START_REMINDER_MS);
    return () => clearTimeout(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !lane || lane.confidence < MIN_CONFIDENCE || Date.now() - lane.at > 3000) return;
    const p = problemFor(lane);
    const now = Date.now();
    if (p) {
      goodSince.current = null;
      if (badSince.current === null) badSince.current = now;
      if (now - badSince.current >= BAD_FOR_MS) setMessage(p);
    } else {
      badSince.current = null;
      if (goodSince.current === null) goodSince.current = now;
      if (now - goodSince.current >= GOOD_FOR_MS) setMessage(null);
    }
  }, [lane, enabled]);

  if (!enabled) return null;
  return message ?? (reminder ? 'Mount the phone upright, facing the road, lens in the middle of the car' : null);
}