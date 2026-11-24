import type { Frame } from 'react-native-vision-camera';

export const MODEL_INPUT_SIZE = 192;

/**
 * Converts the model input (float RGB in [0,1]) into 8-bit RGBA bytes, used to
 * make a viewable snapshot (JPEG) of the exact crop the model saw.
 */
export function floatRgbToRgba(input: Float32Array): Uint8Array {
  'worklet';
  const pixels = input.length / 3;
  const out = new Uint8Array(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    out[i * 4] = Math.round(input[i * 3] * 255);
    out[i * 4 + 1] = Math.round(input[i * 3 + 1] * 255);
    out[i * 4 + 2] = Math.round(input[i * 3 + 2] * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Center-crops the frame to a SQUARE (side = min(width, height)), resizes it to
 * 192x192 and returns float32 interleaved RGB in [0, 1].
 *
 * Why crop instead of stretch: stretching a portrait frame into a square
 * distorts the face (horizontal vs vertical scale differ), which deflates the
 * eye aspect ratio and makes open eyes look closed. A uniform crop keeps the
 * geometry true, so EAR matches the real eye shape.
 *
 * Runs inside the frame-output worklet, CPU only. Expects a NON-planar 32-bit
 * RGB frame (pixelFormat: 'rgb' on useFrameOutput).
 * Place in src/ml/framePreprocessor.ts.
 */
export function preprocessFrame(frame: Frame): Float32Array {
  'worklet';

  const srcW = frame.width;
  const srcH = frame.height;
  const stride = frame.bytesPerRow; // rows can be padded -- never assume srcW * 4
  const src = new Uint8Array(frame.getPixelBuffer());

  const isBgra = String(frame.pixelFormat).includes('bgra');
  const rIdx = isBgra ? 2 : 0;
  const bIdx = isBgra ? 0 : 2;

  const size = 192;
  const side = Math.min(srcW, srcH);
  const cropX0 = (srcW - side) / 2;
  const cropY0 = (srcH - side) / 2;
  const ratio = side / size;

  const out = new Float32Array(size * size * 3);
  const inv255 = 1 / 255;

  let o = 0;
  for (let y = 0; y < size; y++) {
    const fy = cropY0 + (y + 0.5) * ratio - 0.5;
    const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(fy)));
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = Math.max(0, fy - y0);
    const row0 = y0 * stride;
    const row1 = y1 * stride;

    for (let x = 0; x < size; x++) {
      const fx = cropX0 + (x + 0.5) * ratio - 0.5;
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(fx)));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = Math.max(0, fx - x0);

      const i00 = row0 + x0 * 4;
      const i10 = row0 + x1 * 4;
      const i01 = row1 + x0 * 4;
      const i11 = row1 + x1 * 4;

      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;

      out[o++] = (src[i00 + rIdx] * w00 + src[i10 + rIdx] * w10 + src[i01 + rIdx] * w01 + src[i11 + rIdx] * w11) * inv255;
      out[o++] = (src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11) * inv255;
      out[o++] = (src[i00 + bIdx] * w00 + src[i10 + bIdx] * w10 + src[i01 + bIdx] * w01 + src[i11 + bIdx] * w11) * inv255;
    }
  }
  return out;
}