// src/hooks/usePerformanceGuard.ts
// Heat / slow-down protection without any extra package. When a phone gets hot Android
// slows its processor down, so the number of frames we can process per second falls.
// The guard learns the normal speed during the first ~30 s, and if the speed stays below
// 60 % of that for 15 s it switches to ECO mode (the road screen then does the lane
// finder less often and shows a "phone is running slow" note). It leaves ECO mode when
// the speed has been back above 80 % for 20 s.
import { useEffect, useRef, useState } from 'react';

const LEARN_SECONDS = 30;
const MIN_LEARN_SAMPLES = 20;
const SLOW_FACTOR = 0.6;
const RECOVER_FACTOR = 0.8;
const SLOW_FOR_S = 15;
const RECOVER_FOR_S = 20;

export type PerformanceState = { eco: boolean; reason: string | null };

/** Feed it the processed frames per second, once a second. */
export function usePerformanceGuard(fps: number, active: boolean): PerformanceState {
  const [state, setState] = useState<PerformanceState>({ eco: false, reason: null });
  const learn = useRef<number[]>([]);
  const baseline = useRef<number | null>(null);
  const slowFor = useRef(0);
  const okFor = useRef(0);

  useEffect(() => {
    if (!active || fps <= 0) return;
    if (baseline.current === null) {
      learn.current.push(fps);
      if (learn.current.length >= LEARN_SECONDS && learn.current.length >= MIN_LEARN_SAMPLES) {
        const s = [...learn.current].sort((a, b) => a - b);
        baseline.current = s[Math.floor(s.length * 0.7)]; // a good-but-not-peak value
      }
      return;
    }
    const base = baseline.current;
    if (fps < base * SLOW_FACTOR) {
      slowFor.current += 1;
      okFor.current = 0;
    } else if (fps > base * RECOVER_FACTOR) {
      okFor.current += 1;
      slowFor.current = 0;
    }
    setState((prev) => {
      if (!prev.eco && slowFor.current >= SLOW_FOR_S) {
        return { eco: true, reason: 'Phone is running slowly (it may be hot). Eco mode is on.' };
      }
      if (prev.eco && okFor.current >= RECOVER_FOR_S) return { eco: false, reason: null };
      return prev;
    });
  }, [fps, active]);

  return state;
}