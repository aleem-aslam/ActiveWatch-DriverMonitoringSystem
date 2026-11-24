// src/ml/collision/yoloDecoder.ts
// Runs inside the rear-camera frame worklet: turns a camera Frame into the YOLO
// input tensor, and turns the raw YOLOv8 output into a short list of detections.
import type { Frame } from 'react-native-vision-camera';

export type Detection = {
  x0: number; y0: number; x1: number; y1: number; // normalized 0..1 of the full frame
  score: number;
  classId: number; // COCO id
};

// COCO ids we care about on the road.
export const ROAD_CLASSES: Record<number, string> = {
  0: 'person',
  1: 'bicycle',
  2: 'car',
  3: 'motorcycle',
  5: 'bus',
  7: 'truck',
};

/**
 * Stretches the WHOLE frame to size x size and returns float32 interleaved RGB in [0,1].
 * (Detection keeps the full field of view; boxes stay normalized to the full frame.)
 * Nearest-neighbour sampling: cheap enough to run on every frame.
 * Expects a non-planar 32-bit RGB frame (pixelFormat 'rgb' on useFrameOutput).
 */
export function frameToYoloInput(frame: Frame, size: number, channelsFirst = false, gain = 1): Float32Array {
  'worklet';
  const srcW = frame.width;
  const srcH = frame.height;
  const stride = frame.bytesPerRow;
  const src = new Uint8Array(frame.getPixelBuffer());
  const isBgra = String(frame.pixelFormat).includes('bgra');
  const rIdx = isBgra ? 2 : 0;
  const bIdx = isBgra ? 0 : 2;

  const plane = size * size;
  const out = new Float32Array(plane * 3);
  const inv255 = gain / 255; // gain > 1 brightens dark scenes (night mode)
  let o = 0;
  for (let y = 0; y < size; y++) {
    const sy = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / size));
    const row = sy * stride;
    for (let x = 0; x < size; x++) {
      const sx = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / size));
      const i = row + sx * 4;
      if (channelsFirst) {
        // NCHW: all R, then all G, then all B
        const p = y * size + x;
        out[p] = Math.min(1, src[i + rIdx] * inv255);
        out[plane + p] = Math.min(1, src[i + 1] * inv255);
        out[2 * plane + p] = Math.min(1, src[i + bIdx] * inv255);
      } else {
        // NHWC: R,G,B per pixel
        out[o++] = Math.min(1, src[i + rIdx] * inv255);
        out[o++] = Math.min(1, src[i + 1] * inv255);
        out[o++] = Math.min(1, src[i + bIdx] * inv255);
      }
    }
  }
  return out;
}

/**
 * Brightness and contrast of the scene from a 24 x 24 grid of pixels (cheap, every frame).
 * mean 0..1 (dark = low), std 0..~0.4 (haze / rain / fog = low).
 */
export function sceneStats(frame: Frame): { mean: number; std: number } {
  'worklet';
  const W = frame.width;
  const H = frame.height;
  const stride = frame.bytesPerRow;
  const src = new Uint8Array(frame.getPixelBuffer());
  const isBgra = String(frame.pixelFormat).includes('bgra');
  const rIdx = isBgra ? 2 : 0;
  const bIdx = isBgra ? 0 : 2;
  const N = 24;
  let sum = 0;
  let sumSq = 0;
  for (let gy = 0; gy < N; gy++) {
    const y = Math.min(H - 1, Math.floor(((gy + 0.5) * H) / N));
    for (let gx = 0; gx < N; gx++) {
      const x = Math.min(W - 1, Math.floor(((gx + 0.5) * W) / N));
      const i = y * stride + x * 4;
      const l = (0.299 * src[i + rIdx] + 0.587 * src[i + 1] + 0.114 * src[i + bIdx]) / 255;
      sum += l;
      sumSq += l * l;
    }
  }
  const n = N * N;
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

/**
 * Copies the frame to a small RGBA picture (outW wide, same aspect) for the incident photo.
 * Runs in the worklet, only when a photo was requested.
 */
export function frameToRgba(frame: Frame, outW: number): { rgba: ArrayBuffer; w: number; h: number } {
  'worklet';
  const srcW = frame.width;
  const srcH = frame.height;
  const stride = frame.bytesPerRow;
  const src = new Uint8Array(frame.getPixelBuffer());
  const isBgra = String(frame.pixelFormat).includes('bgra');
  const rIdx = isBgra ? 2 : 0;
  const bIdx = isBgra ? 0 : 2;
  const w = outW;
  const h = Math.max(1, Math.round((outW * srcH) / srcW));
  const out = new Uint8Array(w * h * 4);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / h));
    const row = sy * stride;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / w));
      const i = row + sx * 4;
      out[o++] = src[i + rIdx];
      out[o++] = src[i + 1];
      out[o++] = src[i + bIdx];
      out[o++] = 255;
    }
  }
  return { rgba: out.buffer as ArrayBuffer, w, h };
}

/**
 * Debug helper: the highest road-class score anywhere in the output (before any
 * threshold). Near 0 on every frame means the model output is not what the decoder
 * expects (wrong shape/layout) or the input is wrong, not that nothing is in view.
 */
export function scanMaxRoadScore(raw: Float32Array, shape: number[]): number {
  'worklet';
  const a = shape[shape.length - 2];
  const b = shape[shape.length - 1];
  const channelsFirst = a < b;
  const C = channelsFirst ? a : b;
  const N = channelsFirst ? b : a;
  const ids = [0, 1, 2, 3, 5, 7];
  let best = 0;
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < ids.length; k++) {
      if (ids[k] >= C - 4) continue;
      const c = 4 + ids[k];
      const s = channelsFirst ? raw[c * N + i] : raw[i * C + c];
      if (s > best) best = s;
    }
  }
  return best;
}

function iou(a: Detection, b: Detection): number {
  'worklet';
  const ix0 = Math.max(a.x0, b.x0);
  const iy0 = Math.max(a.y0, b.y0);
  const ix1 = Math.min(a.x1, b.x1);
  const iy1 = Math.min(a.y1, b.y1);
  const inter = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0);
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Decodes a standard Ultralytics YOLOv8 detection output (no built-in NMS).
 *  - shape [1, 4+classes, N] (e.g. [1, 84, 2100] at 320 px)  or  [1, N, 4+classes]
 *  - box = (cx, cy, w, h), either normalized 0..1 or in input pixels (auto-detected)
 * Only road classes are kept. Class-wise NMS is applied.
 */
export function decodeYolo(
  raw: Float32Array,
  shape: number[],
  inputSize: number,
  scoreThreshold = 0.4,
  iouThreshold = 0.45,
  maxDetections = 20
): Detection[] {
  'worklet';
  const a = shape[shape.length - 2];
  const b = shape[shape.length - 1];
  const channelsFirst = a < b; // 84 < 2100
  const C = channelsFirst ? a : b;
  const N = channelsFirst ? b : a;
  const numClasses = C - 4;

  const candidates: Detection[] = [];
  for (let i = 0; i < N; i++) {
    const at = (c: number) => (channelsFirst ? raw[c * N + i] : raw[i * C + c]);

    let bestScore = 0;
    let bestClass = -1;
    for (let k = 0; k < 6; k++) {
      // loop over the road classes only
      const classId = k === 0 ? 0 : k === 1 ? 1 : k === 2 ? 2 : k === 3 ? 3 : k === 4 ? 5 : 7;
      if (classId >= numClasses) continue;
      const s = at(4 + classId);
      if (s > bestScore) {
        bestScore = s;
        bestClass = classId;
      }
    }
    if (bestClass < 0 || bestScore < scoreThreshold) continue;

    let cx = at(0);
    let cy = at(1);
    let w = at(2);
    let h = at(3);
    if (cx > 1.5 || cy > 1.5 || w > 1.5 || h > 1.5) {
      // pixel coordinates -> normalized
      cx /= inputSize; cy /= inputSize; w /= inputSize; h /= inputSize;
    }
    candidates.push({
      x0: Math.max(0, cx - w / 2),
      y0: Math.max(0, cy - h / 2),
      x1: Math.min(1, cx + w / 2),
      y1: Math.min(1, cy + h / 2),
      score: bestScore,
      classId: bestClass,
    });
  }

  candidates.sort((p, q) => q.score - p.score);
  const kept: Detection[] = [];
  for (let i = 0; i < candidates.length && kept.length < maxDetections; i++) {
    const d = candidates[i];
    let suppressed = false;
    for (let j = 0; j < kept.length; j++) {
      if (kept[j].classId === d.classId && iou(kept[j], d) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(d);
  }
  return kept;
}