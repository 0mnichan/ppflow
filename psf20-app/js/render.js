// Document model and drawing. All element geometry is in printer dots (8 dots = 1 mm).
// Elements rotate around their centre; x, y, w, h describe the unrotated box.
import { qr } from './qr.js';
import { barcode } from './barcode.js';
import { dither, dotsToCanvas } from './raster.js';

export const DPMM = 8, PT = 203.2 / 72; // dots per mm, dots per typographic point

export const FONTS = {
  sans: ['Sans', 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'],
  serif: ['Serif', 'Georgia,"Times New Roman","Noto Serif",serif'],
  mono: ['Mono', 'ui-monospace,Menlo,Consolas,"Roboto Mono","Courier New",monospace'],
  condensed: ['Condensed', '"Arial Narrow","Roboto Condensed","sans-serif-condensed","Helvetica Neue",sans-serif'],
  rounded: ['Rounded', 'ui-rounded,"SF Pro Rounded","Varela Round","Arial Rounded MT Bold",sans-serif'],
  script: ['Script', '"Brush Script MT","Segoe Script","Dancing Script",cursive'],
  custom: ['Other installed font…', ''],
};
const family = el => el.font === 'custom' ? `"${(el.custom || '').replace(/"/g, '')}",sans-serif` : (FONTS[el.font] || FONTS.sans)[1];

// {date} {time} {n} placeholders
export const hasCounter = doc => doc.els.some(e => /\{n\}/.test(e.text || e.data || ''));
export function fillTokens(s, env) {
  const d = new Date();
  return String(s ?? '').replace(/\{(date|time|n)\}/g, (m, k) =>
    k === 'date' ? d.toLocaleDateString() :
    k === 'time' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
    String(env.n ?? 1).padStart(env.pad || 0, '0'));
}

/* ---------- small caches ---------- */
const lru = (max, m = new Map()) => (key, make) => {
  if (m.has(key)) { const v = m.get(key); m.delete(key); m.set(key, v); return v }
  const v = make(); m.set(key, v); if (m.size > max) m.delete(m.keys().next().value); return v;
};
const imgCache = lru(40), qrCache = lru(40), bcCache = lru(40);
const safe = f => { try { return { v: f() } } catch (e) { return { err: e.message } } };
export const qrOf = (data, ecc) => qrCache(ecc + '|' + data, () => safe(() => qr(data, ecc)));
export const barcodeOf = (kind, data) => bcCache(kind + '|' + data, () => safe(() => barcode(kind, data)));

const images = new Map();
let onImage = () => { };
export const onImageLoad = f => { onImage = f };
function image(doc, id) {
  let r = images.get(id);
  if (!r && doc.assets[id]) {
    const i = new Image(); r = { i, ok: false, p: null };
    r.p = new Promise(res => { i.onload = () => { r.ok = true; onImage(); res() }; i.onerror = res });
    i.src = doc.assets[id]; images.set(id, r);
  }
  return r;
}
export const imagesReady = doc => Promise.all(doc.els.filter(e => e.type === 'image').map(e => (image(doc, e.asset) || {}).p));

/* ---------- geometry ---------- */
export const center = e => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
export function corners(e) {
  const c = center(e), a = e.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const lx = sx * e.w / 2, ly = sy * e.h / 2;
    return { x: c.x + lx * co - ly * si, y: c.y + lx * si + ly * co };
  });
}
export function aabb(e) {
  const p = corners(e), xs = p.map(q => q.x), ys = p.map(q => q.y);
  return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
}
export function toLocal(e, p) {
  const c = center(e), a = e.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), vx = p.x - c.x, vy = p.y - c.y;
  return { x: vx * co + vy * si, y: -vx * si + vy * co };
}
export const contains = (e, p, tol = 0) => { const l = toLocal(e, p); return Math.abs(l.x) <= e.w / 2 + tol && Math.abs(l.y) <= e.h / 2 + tol };

/* ---------- text ---------- */
function breakChars(x, line, max) {
  const r = []; let c = '';
  for (const ch of line) { if (x.measureText(c + ch).width > max && c) { r.push(c); c = ch } else c += ch }
  r.push(c); return r;
}
function wrap(x, s, max) {
  const out = [];
  for (const p of s.split('\n')) {
    let cur = '';
    for (const w of p.split(' ')) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width <= max || !cur) cur = t; else { out.push(cur); cur = w } }
    out.push(cur);
  }
  return out.flatMap(l => x.measureText(l).width > max ? breakChars(x, l, max) : [l]);
}
const scratch = document.createElement('canvas').getContext('2d');
export function textLayout(ctx, el, env) {
  const txt = fillTokens(el.text, env), style = (el.italic ? 'italic ' : '') + (el.bold ? 'bold ' : ''), fam = family(el);
  const lay = size => {
    ctx.font = `${style}${size}px ${fam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (el.ls || 0) + 'px';
    const lines = el.wrap ? wrap(ctx, txt, Math.max(1, el.w)) : txt.split('\n'), lh = size * el.lh;
    let mw = 0; for (const l of lines) mw = Math.max(mw, ctx.measureText(l).width);
    return { size, lines, lh, mw, th: lines.length * lh };
  };
  if (!el.fit) return lay(el.size * PT);
  let lo = 3, hi = Math.max(8, el.h * 1.5), best = lo;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2, L = lay(mid);
    if (L.mw <= el.w + .5 && L.th <= el.h + .5) { best = mid; lo = mid } else hi = mid;
  }
  return lay(best);
}
// Keeps a text box's height matched to its content while "auto height" is on.
export function relayout(el, env) {
  if (el.type !== 'text' || !el.autoH || el.fit) return;
  const h = Math.max(8, Math.ceil(textLayout(scratch, el, env).th));
  if (h === el.h) return;
  const a = el.rot * Math.PI / 180, d = (h - el.h) / 2, c = center(el);
  el.h = h; el.x = Math.round(c.x - Math.sin(a) * d - el.w / 2); el.y = Math.round(c.y + Math.cos(a) * d - h / 2);
}

/* ---------- element painters (origin at element centre) ---------- */
function invalid(x, el, msg, env) {
  env.errors && env.errors.push(msg);
  x.save(); x.strokeStyle = '#000'; x.lineWidth = 2; x.setLineDash([6, 4]);
  x.strokeRect(-el.w / 2 + 1, -el.h / 2 + 1, el.w - 2, el.h - 2);
  x.font = `${Math.max(10, Math.min(24, el.h / 3))}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('!', 0, 0); x.restore();
}
const DRAW = {
  text(x, el, env) {
    const L = textLayout(x, el, env), left = -el.w / 2, top = -el.h / 2;
    const y0 = top + (el.valign === 'middle' ? (el.h - L.th) / 2 : el.valign === 'bottom' ? el.h - L.th : 0);
    if (el.invert) { x.fillRect(left, top, el.w, el.h); x.fillStyle = '#fff' }
    x.textBaseline = 'middle'; x.textAlign = el.align;
    const ax = el.align === 'left' ? left : el.align === 'center' ? 0 : left + el.w, t = Math.max(1, Math.round(L.size / 14));
    L.lines.forEach((l, i) => {
      const cy = y0 + i * L.lh + L.lh / 2;
      x.fillText(l, ax, cy);
      if (el.underline || el.strike) {
        const w = x.measureText(l).width, lx = el.align === 'left' ? ax : el.align === 'center' ? ax - w / 2 : ax - w;
        if (el.underline) x.fillRect(lx, cy + L.size * .42, w, t);
        if (el.strike) x.fillRect(lx, cy + L.size * .04 - t / 2, w, t);
      }
    });
  },
  image(x, el, env) {
    const r = image(env.doc, el.asset), w = Math.max(1, Math.round(el.w)), h = Math.max(1, Math.round(el.h));
    if (!r || !r.ok) { if (!r) invalid(x, el, 'Image is missing.', env); return }
    const c = imgCache([el.asset, w, h, el.dither, el.thr, el.br, el.co, el.inv].join('|'), () => {
      const t = document.createElement('canvas'); t.width = w; t.height = h;
      const g = t.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingQuality = 'high'; g.filter = `brightness(${el.br}%) contrast(${el.co}%)`; g.drawImage(r.i, 0, 0, w, h);
      return dotsToCanvas(dither(g.getImageData(0, 0, w, h).data, w, h, el.dither, el.thr, el.inv), w, h);
    });
    x.imageSmoothingEnabled = false; x.drawImage(c, -el.w / 2, -el.h / 2, el.w, el.h);
  },
  qr(x, el, env) {
    const q = qrOf(fillTokens(el.data, env) || ' ', el.ecc);
    if (q.err) return invalid(x, el, q.err, env);
    const n = q.v.size, s = Math.min(el.w, el.h); let m = s / n; if (m >= 1) m = Math.floor(m);
    const ox = -el.w / 2 + Math.floor((el.w - n * m) / 2), oy = -el.h / 2 + Math.floor((el.h - n * m) / 2);
    for (let y = 0; y < n; y++) for (let i = 0; i < n;) {
      if (!q.v.get(i, y)) { i++; continue }
      let j = i; while (j < n && q.v.get(j, y)) j++;
      x.fillRect(ox + i * m, oy + y * m, (j - i) * m, m); i = j;
    }
  },
  barcode(x, el, env) {
    const b = barcodeOf(el.kind, fillTokens(el.data, env));
    if (b.err) return invalid(x, el, b.err, env);
    const bits = b.v.bits, M = bits.length; let m = el.w / M; if (m >= 1) m = Math.floor(m);
    const fs = el.textSize * PT, th = el.showText ? Math.round(fs * 1.15) : 0, bh = Math.max(1, el.h - th);
    const left = -el.w / 2 + Math.floor((el.w - M * m) / 2), top = -el.h / 2;
    for (let i = 0; i < M;) {
      if (bits[i] !== '1') { i++; continue }
      let j = i; while (bits[j] === '1') j++;
      x.fillRect(left + i * m, top, (j - i) * m, bh); i = j;
    }
    if (el.showText) { x.font = `${fs}px ${FONTS.sans[1]}`; x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText(b.v.text, left + M * m / 2, top + bh + 1) }
  },
  rect(x, el) {
    const s = el.stroke, r = Math.min(el.radius || 0, el.w / 2, el.h / 2); x.beginPath();
    if (el.fill) { x.roundRect(-el.w / 2, -el.h / 2, el.w, el.h, r); x.fill(); return }
    x.lineWidth = s; x.roundRect(-el.w / 2 + s / 2, -el.h / 2 + s / 2, Math.max(0, el.w - s), Math.max(0, el.h - s), Math.max(0, r - s / 2)); x.stroke();
  },
  ellipse(x, el) {
    const s = el.stroke; x.beginPath();
    if (el.fill) { x.ellipse(0, 0, el.w / 2, el.h / 2, 0, 0, Math.PI * 2); x.fill(); return }
    x.lineWidth = s; x.ellipse(0, 0, Math.max(0, el.w / 2 - s / 2), Math.max(0, el.h / 2 - s / 2), 0, 0, Math.PI * 2); x.stroke();
  },
  line(x, el) {
    const left = -el.w / 2, top = -el.h / 2;
    if (!el.dash) return x.fillRect(left, top, el.w, el.h);
    const seg = Math.max(4, el.h * 3), gap = Math.max(3, el.h * 2);
    for (let p = 0; p < el.w; p += seg + gap) x.fillRect(left + p, top, Math.min(seg, el.w - p), el.h);
  },
};

export function drawEl(x, el, env) {
  x.save();
  let { x: cx, y: cy } = center(el);
  const r = ((el.rot % 360) + 360) % 360;
  if ((r === 90 || r === 270) && (el.w - el.h) % 2) { cx += .5; cy += .5 } // keep 90° turns on whole dots
  x.translate(cx, cy); if (r) x.rotate(r * Math.PI / 180);
  x.fillStyle = x.strokeStyle = '#000';
  DRAW[el.type](x, el, env);
  x.restore();
}

export const paperDots = p => ({ w: Math.round(p.w * DPMM), h: Math.round(p.h * DPMM) });

// Render the whole design at printer resolution. Returns {d: Uint8Array (1 = black), w, h}.
export function rasterize(doc, n) {
  const { w, h } = paperDots(doc.paper), c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }), env = { doc, n, pad: doc.paper.pad, errors: [] };
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  for (const el of doc.els) drawEl(x, el, env);
  if (env.errors.length) throw Error(env.errors[0]);
  const px = x.getImageData(0, 0, w, h).data, d = new Uint8Array(w * h), thr = doc.paper.darkness;
  let last = -1;
  for (let i = 0; i < w * h; i++) if (.299 * px[i * 4] + .587 * px[i * 4 + 1] + .114 * px[i * 4 + 2] < thr) { d[i] = 1; last = i }
  if (doc.paper.type === 'receipt' && doc.paper.trim) {
    if (last < 0) throw Error('Nothing to print yet. Add some text or an image.');
    return { d: d.subarray(0, (Math.floor(last / w) + 1) * w), w, h: Math.floor(last / w) + 1 };
  }
  return { d, w, h };
}

/* ---------- new elements ---------- */
let seq = 0;
export const uid = () => 'e' + Date.now().toString(36) + (seq++).toString(36);
export function newEl(type, paper, at, extra = {}) {
  const { w: PW, h: PH } = paperDots(paper), W = Math.min(PW, 384), H = paper.type === 'receipt' ? Math.min(PH, 320) : PH;
  const base = { id: uid(), type, x: 0, y: 0, w: Math.round(W * .8), h: 64, rot: 0, locked: false };
  const d = {
    text: { text: 'Text', font: 'sans', custom: '', size: 14, bold: false, italic: false, underline: false, strike: false, align: 'center', valign: 'top', wrap: true, fit: false, autoH: true, lh: 1.2, ls: 0, invert: false },
    image: { asset: null, dither: 'fs', thr: 128, br: 100, co: 110, inv: false, lockAspect: true },
    qr: { data: 'https://example.com', ecc: 'M', w: Math.round(Math.min(W, H) * .7), h: Math.round(Math.min(W, H) * .7) },
    barcode: { kind: 'c128', data: 'PSF20-001', showText: true, textSize: 8, h: Math.min(Math.round(H * .6), 120) },
    rect: { stroke: 3, fill: false, radius: 0, w: Math.round(W * .6), h: Math.round(H * .5) },
    ellipse: { stroke: 3, fill: false, w: Math.round(Math.min(W, H) * .5), h: Math.round(Math.min(W, H) * .5) },
    line: { dash: false, h: 3 },
  }[type];
  const el = Object.assign(base, d, extra);
  el.x = Math.round((at ? at.x : PW / 2) - el.w / 2); el.y = Math.round((at ? at.y : H / 2) - el.h / 2);
  return el;
}
