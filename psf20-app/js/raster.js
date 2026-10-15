// Turning pixels into printer dots.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) * 16);

// Grayscale + dither an image area. Returns Uint8Array(w*h) with 1 = black dot.
// mode: 'fs' Floyd-Steinberg, 'atk' Atkinson, 'bayer' ordered halftone, 'thr' plain cut-off.
export function dither(data, w, h, mode, thr = 128, inv = false) {
  const g = new Float32Array(w * h), o = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255, v = (.299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]) * a + 255 * (1 - a);
    g[i] = inv ? 255 - v : v;
  }
  const add = (x, y, e) => { if (x >= 0 && x < w && y < h) g[y * w + x] += e };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = g[i];
    if (mode === 'bayer') { o[i] = v < BAYER[(y & 3) * 4 + (x & 3)] * thr / 128 ? 1 : 0; continue }
    const n = v < thr ? 0 : 255, e = v - n;
    o[i] = n ? 0 : 1;
    if (mode === 'fs') { add(x + 1, y, e * 7 / 16); add(x - 1, y + 1, e * 3 / 16); add(x, y + 1, e * 5 / 16); add(x + 1, y + 1, e / 16) }
    else if (mode === 'atk') { const q = e / 8; add(x + 1, y, q); add(x + 2, y, q); add(x - 1, y + 1, q); add(x, y + 1, q); add(x + 1, y + 1, q); add(x, y + 2, q) }
  }
  return o;
}

// 1 = black dot array -> canvas with opaque black dots and transparent paper.
export function dotsToCanvas(d, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) if (d[i]) im.data[i * 4 + 3] = 255;
  x.putImageData(im, 0, 0);
  return c;
}

// Pack a w×h dot array into printer rows of `rowBytes` bytes, shifted right by `offset` dots (clipped).
export function pack(d, w, h, rowBytes, offset = 0) {
  const o = new Uint8Array(h * rowBytes), W = rowBytes * 8;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x + offset;
    if (d[y * w + x] && X >= 0 && X < W) o[y * rowBytes + (X >> 3)] |= 0x80 >> (X & 7);
  }
  return o;
}
