// src/utils/stampTimestamp.ts
// Burns a date/time line (digits, '-', ':' and space) into the bottom-left of an RGBA
// picture, so the photo carries its timestamp even when it is saved or shared on its own.

const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function stampTimestamp(rgba: Uint8Array, width: number, height: number, text: string) {
  const scale = Math.max(1, Math.round(width / 160));
  const pad = 2 * scale;
  const textW = text.length * 6 * scale; // 5 px glyph + 1 px gap
  const barW = Math.min(width, textW + 2 * pad);
  const barH = 7 * scale + 2 * pad;
  const y0 = height - barH;

  // dark bar behind the text
  for (let y = y0; y < height; y++) {
    for (let x = 0; x < barW; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 255;
    }
  }
  // white text
  for (let c = 0; c < text.length; c++) {
    const g = GLYPHS[text[c]] ?? GLYPHS[' '];
    const gx = pad + c * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let k = 0; k < 5; k++) {
        if (g[r][k] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const x = gx + k * scale + sx;
            const y = y0 + pad + r * scale + sy;
            if (x >= width || y >= height) continue;
            const i = (y * width + x) * 4;
            rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255;
          }
        }
      }
    }
  }
}