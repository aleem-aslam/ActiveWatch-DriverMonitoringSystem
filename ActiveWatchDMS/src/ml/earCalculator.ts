import type { EyeAspectRatios, Point3D } from '../../types';
import { getLeftEyePoints, getRightEyePoints, type EyePoints } from './eyeCalculator';

function dist(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Standard Soukupová & Čech Eye Aspect Ratio:
 *   EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * where p1/p4 are the horizontal corners and p2,p3,p5,p6 are the vertical
 * lid points. Typical open-eye EAR ~0.28-0.35; closed-eye EAR drops toward
 * ~0.05-0.15. This is scale-invariant (a ratio), so it works the same
 * whether landmarks are normalized 0..1 or in raw pixels — just be
 * consistent.
 */
function computeEAR(eye: EyePoints): number {
  const vertical1 = dist(eye.topOuter, eye.bottomOuter);
  const vertical2 = dist(eye.topInner, eye.bottomInner);
  const horizontal = dist(eye.outerCorner, eye.innerCorner);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

export function calculateEAR(landmarks: Point3D[]): EyeAspectRatios {
  const left = computeEAR(getLeftEyePoints(landmarks));
  const right = computeEAR(getRightEyePoints(landmarks));
  return { left, right, average: (left + right) / 2 };
}
