import type { Roi } from '../../types';

export const MODEL_INPUT_SIZE = 192;

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, 4 bytes/pixel (this is what jpeg-js produces)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Pure JS crop (square) + nearest-neighbor resize + normalize.
 *
 * BUG THIS FIXES (same one as before, just done without native/worklet
 * help): stretching a non-square image straight to 192x192 distorts facial
 * geometry. This always takes a square region first.
 *
 * No native dependency, no worklet — this is a plain loop over typed
 * arrays. For a 192x192 output that's ~37k iterations, well under a
 * millisecond on any phone from the last several years — the bottleneck in
 * this pipeline is the JPEG decode in frameCapture.ts, not this step.
 *
 * @param image  decoded RGBA image (see frameCapture.ts)
 * @param roi    optional region to crop before resizing — omit for a
 *               centered square crop, which is the right default for a
 *               fixed driver-facing camera where the face is roughly
 *               centered.
 */
export function rgbaToModelInput(
  image: DecodedImage,
  roi?: Roi,
  targetSize = MODEL_INPUT_SIZE
): Float32Array {
  const { width, height, data } = image;

  const size = roi?.size ?? Math.min(width, height);
  const maxX = width - size;
  const maxY = height - size;
  const cropX = clamp(roi?.x ?? (width - size) / 2, 0, Math.max(maxX, 0));
  const cropY = clamp(roi?.y ?? (height - size) / 2, 0, Math.max(maxY, 0));

  const output = new Float32Array(targetSize * targetSize * 3);
  const scale = size / targetSize;

  let o = 0;
  for (let ty = 0; ty < targetSize; ty++) {
    const sy = Math.min(height - 1, Math.floor(cropY + ty * scale));
    const rowOffset = sy * width;
    for (let tx = 0; tx < targetSize; tx++) {
      const sx = Math.min(width - 1, Math.floor(cropX + tx * scale));
      const srcIdx = (rowOffset + sx) * 4; // RGBA -> skip alpha
      output[o++] = data[srcIdx] / 255;
      output[o++] = data[srcIdx + 1] / 255;
      output[o++] = data[srcIdx + 2] / 255;
    }
  }

  return output;
}

/**
 * Same tracking-ROI idea as before, just consuming plain landmark
 * coordinates instead of a worklet-produced Float32Array. Optional — skip
 * it and always pass `roi: undefined` to rgbaToModelInput for a simpler,
 * centered-crop-only pipeline.
 */
export function roiFromLandmarks(
  landmarksFlat: Float32Array | null,
  prevRoi: Roi,
  frameW: number,
  frameH: number,
  marginRatio = 0.6
): Roi | undefined {
  if (!landmarksFlat) return undefined;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const scale = prevRoi.size / MODEL_INPUT_SIZE;
  for (let i = 0; i < landmarksFlat.length; i += 3) {
    const x = prevRoi.x + landmarksFlat[i] * scale;
    const y = prevRoi.y + landmarksFlat[i + 1] * scale;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const boxSize = Math.max(maxX - minX, maxY - minY);
  const size = Math.min(Math.max(boxSize * (1 + marginRatio), 40), Math.min(frameW, frameH));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return { x: cx - size / 2, y: cy - size / 2, size };
}
