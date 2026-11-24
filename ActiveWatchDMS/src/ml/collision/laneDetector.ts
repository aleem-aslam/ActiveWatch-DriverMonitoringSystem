// src/ml/collision/laneDetector.ts
// Basic lane-marking detector, runs inside the frame worklet on a few rows of the road.
//
// For ~14 rows in the lower road area it looks for white/yellow paint on each side of the
// image centre, fits one straight line per side (rejecting outliers such as white cars),
// and intersects them to get the VANISHING POINT. The vanishing point tells us:
//   x: where the car is really heading in the picture  -> sideways offsets are measured from it
//   y: where the horizon is                            -> tells us if the phone is tilted up/down
// It is a simple method: it needs visible markings and a mostly straight road. When it is
// not sure it returns null and the rest of the app falls back to "straight ahead = centre".
import type { Frame } from 'react-native-vision-camera';

export type LaneLine = { x0: number; y0: number; x1: number; y1: number }; // normalized 0..1

export type LaneResult = {
  confidence: number; // 0..1
  vpX: number; // vanishing point, normalized
  vpY: number;
  left: LaneLine;
  right: LaneLine;
};

const ROWS = 14;
const Y_TOP = 0.62; // search rows from here ...
const Y_BOTTOM = 0.93; // ... to here (fraction of frame height)

type Pt = { y: number; x: number };

function fitLine(pts: Pt[]): { a: number; b: number; rms: number; n: number } | null {
  'worklet';
  let cur = pts;
  for (let pass = 0; pass < 3; pass++) {
    const n = cur.length;
    if (n < 4) return null;
    let sY = 0, sX = 0, sYY = 0, sYX = 0;
    for (let i = 0; i < n; i++) {
      sY += cur[i].y; sX += cur[i].x; sYY += cur[i].y * cur[i].y; sYX += cur[i].y * cur[i].x;
    }
    const den = n * sYY - sY * sY;
    if (Math.abs(den) < 1e-9) return null;
    const b = (n * sYX - sY * sX) / den;
    const a = (sX - b * sY) / n;
    let worst = 0;
    let worstI = -1;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.abs(cur[i].x - (a + b * cur[i].y));
      sq += r * r;
      if (r > worst) { worst = r; worstI = i; }
    }
    const rms = Math.sqrt(sq / n);
    if (worst <= 0.025 || pass === 2) return { a, b, rms, n };
    cur = cur.filter((_, i) => i !== worstI); // drop the worst point and refit
  }
  return null;
}

export function detectLane(frame: Frame): LaneResult | null {
  'worklet';
  const W = frame.width;
  const H = frame.height;
  const stride = frame.bytesPerRow;
  const src = new Uint8Array(frame.getPixelBuffer());
  const isBgra = String(frame.pixelFormat).includes('bgra');
  const rIdx = isBgra ? 2 : 0;
  const bIdx = isBgra ? 0 : 2;

  const step = Math.max(2, Math.floor(W / 200));
  const x0 = Math.floor(W * 0.04);
  const x1 = Math.floor(W * 0.96);
  const nCols = Math.floor((x1 - x0) / step);
  const lum = new Float32Array(nCols);
  const paint = new Uint8Array(nCols);
  const maxRun = Math.max(2, Math.floor((W * 0.08) / step));
  const centre = W * 0.5;

  const leftPts: Pt[] = [];
  const rightPts: Pt[] = [];

  for (let r = 0; r < ROWS; r++) {
    const yN = Y_TOP + ((Y_BOTTOM - Y_TOP) * r) / (ROWS - 1);
    const row = Math.min(H - 1, Math.floor(yN * H)) * stride;

    let mean = 0;
    for (let c = 0; c < nCols; c++) {
      const i = row + (x0 + c * step) * 4;
      const R = src[i + rIdx], G = src[i + 1], B = src[i + bIdx];
      lum[c] = 0.299 * R + 0.587 * G + 0.114 * B;
      mean += lum[c];
      paint[c] = 0;
      if (R > 140 && G > 110 && B < 90 && R - B > 70) paint[c] = 1; // yellow paint
    }
    mean /= nCols;
    for (let c = 0; c < nCols; c++) {
      if (lum[c] > mean + 40 && lum[c] > 140) paint[c] = 1; // white paint
    }

    // runs of paint -> centres; skip runs that are too wide (cars, signs)
    let bestL = -1, bestLd = 1e9, bestR = -1, bestRd = 1e9;
    let c = 0;
    while (c < nCols) {
      if (!paint[c]) { c++; continue; }
      let e = c;
      while (e + 1 < nCols && (paint[e + 1] || (e + 2 < nCols && paint[e + 2]))) e++;
      const len = e - c + 1;
      if (len <= maxRun) {
        const xc = x0 + ((c + e) / 2) * step;
        if (xc < centre) {
          const d = centre - xc;
          if (d < bestLd && d > W * 0.02) { bestLd = d; bestL = xc; }
        } else {
          const d = xc - centre;
          if (d < bestRd && d > W * 0.02) { bestRd = d; bestR = xc; }
        }
      }
      c = e + 1;
    }
    if (bestL >= 0) leftPts.push({ y: yN, x: bestL / W });
    if (bestR >= 0) rightPts.push({ y: yN, x: bestR / W });
  }

  const L = fitLine(leftPts);
  const R = fitLine(rightPts);
  if (!L || !R) return null;
  // Lines must lean towards each other going up the picture.
  if (!(L.b < -0.05) || !(R.b > 0.05)) return null;

  const vpY = (R.a - L.a) / (L.b - R.b);
  const vpX = L.a + L.b * vpY;
  if (!(vpY > 0.15 && vpY < 0.75 && vpX > 0.15 && vpX < 0.85)) return null;

  const rowsFound = (L.n + R.n) / (2 * ROWS);
  const fit = Math.max(0, 1 - Math.max(L.rms, R.rms) / 0.02);
  const confidence = Math.max(0, Math.min(1, rowsFound * 1.4)) * fit;

  const yTop = Y_TOP;
  const yBot = Y_BOTTOM;
  return {
    confidence,
    vpX,
    vpY,
    left: { x0: L.a + L.b * yBot, y0: yBot, x1: L.a + L.b * yTop, y1: yTop },
    right: { x0: R.a + R.b * yBot, y0: yBot, x1: R.a + R.b * yTop, y1: yTop },
  };
}