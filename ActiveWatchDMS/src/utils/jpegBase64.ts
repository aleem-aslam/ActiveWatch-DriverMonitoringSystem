// src/utils/jpegBase64.ts
// Encodes raw RGBA pixels to a base64 JPEG string using the jpeg-js package
// that is already installed.
import { encode } from 'jpeg-js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: ArrayLike<number>): string {
  let out = '';
  const n = bytes.length;
  let i = 0;
  for (; i + 2 < n; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(v >> 18) & 63] + B64[(v >> 12) & 63] + B64[(v >> 6) & 63] + B64[v & 63];
  }
  if (i < n) {
    const rem = n - i;
    const v = (bytes[i] << 16) | ((rem === 2 ? bytes[i + 1] : 0) << 8);
    out += B64[(v >> 18) & 63] + B64[(v >> 12) & 63] + (rem === 2 ? B64[(v >> 6) & 63] : '=') + '=';
  }
  return out;
}

export function rgbaToJpegBase64(rgba: Uint8Array, width: number, height: number, quality = 70): string {
  // jpeg-js's encoder ends with `Buffer.from(bytes)`, and React Native has no
  // global Buffer. Provide a minimal stand-in ONLY for this synchronous call,
  // then remove it so other libraries never see a fake Buffer.
  const g: any = globalThis;
  const hadBuffer = typeof g.Buffer !== 'undefined';
  if (!hadBuffer) g.Buffer = { from: (arr: number[]) => Uint8Array.from(arr) };
  try {
    const encoded = encode({ data: rgba, width, height }, quality);
    return toBase64(encoded.data as unknown as ArrayLike<number>);
  } finally {
    if (!hadBuffer) delete g.Buffer;
  }
}