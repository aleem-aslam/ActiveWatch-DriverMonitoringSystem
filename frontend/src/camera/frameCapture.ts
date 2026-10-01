// frameCapture.ts
import RNFS from 'react-native-fs';
import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';
import type { CameraPhotoOutput } from 'react-native-vision-camera';
import { rgbaToModelInput, MODEL_INPUT_SIZE } from '../ml/imagePreprocessor';
import type { Roi } from '../../types';

/**
 * Reads the EXIF Orientation tag (0x0112) from raw JPEG bytes.
 * jpeg-js ignores EXIF entirely, so without this, a portrait selfie whose
 * sensor captures natively in landscape comes out of jpeg.decode() sideways
 * -- the face ends up rotated relative to a centered square crop, so it's
 * silently cropped out. Returns 1 (no correction needed) if absent.
 */
function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];

    if (marker === 0xe1) {
      const segStart = offset + 4;
      const isExif =
        bytes[segStart] === 0x45 &&
        bytes[segStart + 1] === 0x78 &&
        bytes[segStart + 2] === 0x69 &&
        bytes[segStart + 3] === 0x66; // "Exif"
      if (isExif) {
        const tiffStart = segStart + 6;
        const little = bytes[tiffStart] === 0x49; // 'II' little-endian, 'MM' big-endian
        const readU16 = (o: number) =>
          little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
        const readU32 = (o: number) =>
          little
            ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
            : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;

        const ifd0Offset = readU32(tiffStart + 4);
        const entriesStart = tiffStart + ifd0Offset;
        const numEntries = readU16(entriesStart);
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = entriesStart + 2 + i * 12;
          if (readU16(entryOffset) === 0x0112) {
            return readU16(entryOffset + 8);
          }
        }
      }
      return 1;
    }

    if (marker === 0xda) break; // Start of Scan -- no more metadata follows
    offset += 2 + segmentLength;
  }
  return 1;
}

/** Rotates/flips a decoded RGBA buffer to correct for an EXIF orientation value. */
function applyExifOrientation(
  data: Uint8Array,
  width: number,
  height: number,
  orientation: number
): { data: Uint8Array; width: number; height: number } {
  if (orientation === 1) return { data, width, height };

  const swapped = orientation >= 5;
  const outW = swapped ? height : width;
  const outH = swapped ? width : height;
  const out = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx = x;
      let dy = y;
      switch (orientation) {
        case 2: dx = width - 1 - x; dy = y; break;
        case 3: dx = width - 1 - x; dy = height - 1 - y; break;
        case 4: dx = x; dy = height - 1 - y; break;
        case 5: dx = y; dy = x; break;
        case 6: dx = height - 1 - y; dy = x; break;
        case 7: dx = height - 1 - y; dy = width - 1 - x; break;
        case 8: dx = y; dy = width - 1 - x; break;
      }
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (dy * outW + dx) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: out, width: outW, height: outH };
}

export async function captureAndPreprocess(
  photoOutput: CameraPhotoOutput,
  roi?: Roi
): Promise<{ input: Float32Array; frameWidth: number; frameHeight: number } | null> {
  const { filePath } = await photoOutput.capturePhotoToFile({ enableShutterSound: false }, {});

  const path = filePath.startsWith('file://') ? filePath.slice(7) : filePath;
  const base64 = await RNFS.readFile(path, 'base64');
  const jpegBytes = toByteArray(base64);

  const orientation = readJpegOrientation(jpegBytes);
  const raw = jpeg.decode(jpegBytes, { useTArray: true });
  const decoded = applyExifOrientation(raw.data, raw.width, raw.height, orientation);

  if (__DEV__) {
    console.log(`[frameCapture] orientation=${orientation} raw=${raw.width}x${raw.height} corrected=${decoded.width}x${decoded.height}`);
  }

  const input = rgbaToModelInput(decoded, roi, MODEL_INPUT_SIZE);
  RNFS.unlink(path).catch(() => {});

  return { input, frameWidth: decoded.width, frameHeight: decoded.height };
}