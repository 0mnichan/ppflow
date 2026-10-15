import * as R from './render.js';
import { BARCODES } from './barcode.js';
import * as P from './printer.js';
import { pack, dotsToCanvas } from './raster.js';
import { TEMPLATES, PAPER } from './templates.js';

const $ = (s, r = document) => r.querySelector(s);
const DPMM = R.DPMM, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k in e) e[k] = v; else e.setAttribute(k, v);
  }
  e.append(...kids.flat().filter(k => k != null && k !== false && k !== ''));
  return e;
}
function icon(id) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#i-' + id); s.append(u); return s;
}
const ib = (id, title, fn) => h('button', { type: 'button', className: 'ib', title, 'aria-label': title, onclick: fn }, icon(id));

/* ---------- messages and log ---------- */
let msgT;
function say(m, cls = '') {
  const e = $('#msg'); e.textContent = m; e.className = 'on ' + cls; clearTimeout(msgT);
  msgT = setTimeout(() => e.className = cls, cls === 'err' ? 7000 : 2500);
}
$('#msg').onclick = () => $('#msg').className = '';
function log(m, c = '') {
  const d = document.createElement('div'); d.className = c; d.textContent = new Date().toTimeString().slice(0, 8) + '  ' + m;
  $('#log').prepend(d); while ($('#log').children.length > 150) $('#log').lastChild.remove();
}
P.events.addEventListener('log', e => log(e.detail.msg, e.detail.cls));
P.events.addEventListener('state', e => {
  $('#dot').className = 'dot' + (e.detail.on ? ' on' : '');
  $('#st').textContent = e.detail.on ? e.detail.name || 'Connected' : 'Connect';
  $('#conn').title = e.detail.on ? 'Connected. Click to reconnect.' : 'Connect to the printer';
});

/* ---------- document, history, storage ---------- */
const KEY = 'psf20-doc', DKEY = 'psf20-designs';
const normalize = d => ({ v: 1, paper: { ...PAPER, ...(d.paper || {}) }, els: Array.isArray(d.els) ? d.els : [], assets: d.assets || {} });
function starter() {
  const d = TEMPLATES[0].make();
  d.els.push(R.newEl('text', d.paper, null, { text: 'Hello!', size: 26, bold: true }));
  return d;
}
let doc;
try { const s = localStorage.getItem(KEY); doc = s ? normalize(JSON.parse(s)) : starter() } catch (e) { doc = starter() }
const env = () => ({ doc, n: doc.paper.counter, pad: doc.paper.pad });
doc.els.forEach(e => R.relayout(e, env()));

let sel = null, hist = [], future = [], commitT, storageWarned = false;
const snapshot = () => JSON.stringify({ paper: doc.paper, els: doc.els });
let lastSnap = snapshot();
const getSel = () => doc.els.find(e => e.id === sel) || null;
const usedAssets = d => Object.fromEntries(d.els.filter(e => e.type === 'image' && d.assets[e.asset]).map(e => [e.asset, d.assets[e.asset]]));
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...doc, assets: usedAssets(doc) })) }
  catch (e) { if (!storageWarned) { storageWarned = true; say('Browser storage is full, so this design is not auto-saved. Use smaller images or export the design.', 'err') } }
}
function commit() {
  clearTimeout(commitT);
  const s = snapshot(); if (s === lastSnap) return;
  hist.push(lastSnap); if (hist.length > 100) hist.shift();
  future = []; lastSnap = s; persist(); updUndo();
}
const scheduleCommit = () => { clearTimeout(commitT); commitT = setTimeout(commit, 500) };
function restore(s) {
  const o = JSON.parse(s); doc.paper = o.paper; doc.els = o.els; lastSnap = s;
  if (!getSel()) sel = null;
  layoutStage(); buildInsp(); persist(); updUndo();
}
function undo() { commit(); if (!hist.length) return; future.push(lastSnap); restore(hist.pop()) }
function redo() { if (!future.length) return; hist.push(lastSnap); restore(future.pop()) }
function updUndo() { $('#bUndo').disabled = !hist.length; $('#bRedo').disabled = !future.length }
function loadDoc(d) {
  d = normalize(d); Object.assign(doc.assets, d.assets);
  doc.paper = d.paper; doc.els = d.els; doc.els.forEach(e => R.relayout(e, env()));
  sel = null; zoom = 1; layoutStage(); buildInsp(); commit();
}

/* ---------- stage ---------- */
const stage = $('#stage'), wrap = $('#stagewrap'), M = 30;
let S = 1, zoom = 1, preview = false, guides = [], rotating = null, raf = 0;
const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw() }) };
R.onImageLoad(redraw);
function layoutStage() {
  const { w, h } = R.paperDots(doc.paper), wide = innerWidth >= 860;
  let fit = (wrap.clientWidth - 2 * M) / w;
  if (doc.paper.type === 'label') fit = Math.min(fit, ((wide ? wrap.clientHeight : innerHeight * .45) - 2 * M) / h);
  else fit = Math.min(fit, 1.5);
  S = clamp(fit, .15, 3) * zoom;
  const cw = Math.round(w * S + 2 * M), ch = Math.round(h * S + 2 * M), dpr = devicePixelRatio || 1;
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  stage.width = Math.round(cw * dpr); stage.height = Math.round(ch * dpr);
  stage.style.marginLeft = stage.style.marginRight = cw < wrap.clientWidth ? 'auto' : '0';
  draw(); updChip();
}
const sc = p => ({ x: M + p.x * S, y: M + p.y * S });
function toDoc(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left - M) / S, y: (e.clientY - r.top - M) / S } }
function printWindow() { const { w } = R.paperDots(doc.paper), off = Math.round((P.DOTS - w) / 2 + doc.paper.offset * DPMM); return [-off, P.DOTS - off] }

function handleList(el) {
  const c = R.center(el), a = el.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const at = (lx, ly) => sc({ x: c.x + lx * co - ly * si, y: c.y + lx * si + ly * co });
  let hs = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  if (el.type === 'line') hs = [[-1, 0], [1, 0]];
  else if (el.type === 'qr' || el.w * S < 44 || el.h * S < 44) hs = hs.filter(([x, y]) => x && y);
  const out = hs.map(([hx, hy]) => ({ hx, hy, ...at(hx * el.w / 2, hy * el.h / 2) }));
  out.push({ rot: true, ...at(0, -el.h / 2 - 28 / S) });
  return out;
}

function draw() {
  const x = stage.getContext('2d'), dpr = stage.width / parseFloat(stage.style.width), Pp = doc.paper, { w, h } = R.paperDots(Pp);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, stage.width, stage.height); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.save(); x.translate(M, M); x.scale(S, S);
  const paper = new Path2D();
  if (Pp.type === 'label') paper.roundRect(0, 0, w, h, 12);
  else { paper.moveTo(0, 0); paper.lineTo(w, 0); paper.lineTo(w, h); for (let i = w; i > 0; i -= 16) { paper.lineTo(i - 8, h - 6); paper.lineTo(Math.max(0, i - 16), h) } paper.closePath() }
  x.save(); x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 10; x.shadowOffsetY = 2; x.fillStyle = '#fff'; x.fill(paper); x.restore();
  x.save(); x.clip(paper);
  let drawn = false;
  if (preview) try {
    const r = R.rasterize(doc, Pp.counter); x.imageSmoothingEnabled = false; x.drawImage(dotsToCanvas(r.d, r.w, r.h), 0, 0); drawn = true;
  } catch (e) { }
  if (!drawn) { const en = env(); for (const el of doc.els) R.drawEl(x, el, en) }
  const [a, b] = printWindow();
  x.fillStyle = 'rgba(200,40,40,.13)';
  if (a > 0) x.fillRect(0, 0, a, h);
  if (b < w) x.fillRect(b, 0, w - b, h);
  x.restore(); x.restore();

  // overlays, in screen pixels
  const poly = pts => { x.beginPath(); pts.forEach((p, i) => { const q = sc(p); i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y) }); x.closePath() };
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#1553d6';
  if (!preview) {
    x.save(); x.setLineDash([3, 3]); x.strokeStyle = 'rgba(80,110,170,.45)'; x.lineWidth = 1;
    for (const el of doc.els) if (el.id !== sel) { poly(R.corners(el)); x.stroke() }
    x.restore();
  }
  x.strokeStyle = '#e0368c'; x.lineWidth = 1;
  for (const g of guides) {
    x.beginPath();
    if (g.x != null) { const q = sc({ x: g.x, y: 0 }); x.moveTo(Math.round(q.x) + .5, M - 8); x.lineTo(Math.round(q.x) + .5, M + h * S + 8) }
    else { const q = sc({ x: 0, y: g.y }); x.moveTo(M - 8, Math.round(q.y) + .5); x.lineTo(M + w * S + 8, Math.round(q.y) + .5) }
    x.stroke();
  }
  const el = getSel();
  if (el) {
    x.strokeStyle = acc; x.lineWidth = 1.5; poly(R.corners(el)); x.stroke();
    if (!el.locked) {
      const hs = handleList(el), rh = hs[hs.length - 1];
      const tm = sc((() => { const c = R.center(el), a = el.rot * Math.PI / 180; return { x: c.x + Math.sin(a) * el.h / 2, y: c.y - Math.cos(a) * el.h / 2 } })());
      x.beginPath(); x.moveTo(tm.x, tm.y); x.lineTo(rh.x, rh.y); x.stroke();
      for (const p of hs) {
        x.beginPath();
        if (p.rot) x.arc(p.x, p.y, 7, 0, Math.PI * 2); else x.rect(p.x - 5.5, p.y - 5.5, 11, 11);
        x.fillStyle = p.rot ? acc : '#fff'; x.fill(); x.stroke();
      }
    }
    if (rotating != null) {
      const q = sc(R.center(el)), t = Math.round(rotating) + '°';
      x.font = '600 13px system-ui,sans-serif'; const tw = x.measureText(t).width + 12;
      x.fillStyle = acc; x.beginPath(); x.roundRect(q.x - tw / 2, q.y - 11, tw, 22, 11); x.fill();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, q.x, q.y + .5);
    }
  }
}

/* ---------- pointer interaction ---------- */
const ptrs = new Map();
let drag = null, lastTap = { id: null, t: 0 };
function hitHandle(el, e) {
  const r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, rad = e.pointerType === 'mouse' ? 9 : 20;
  let best = null, bd = rad;
  for (const p of handleList(el)) { const d = Math.hypot(p.x - px, p.y - py); if (d <= bd) { bd = d; best = p } }
  return best;
}
function topHit(p, e) {
  const tol = (e.pointerType === 'mouse' ? 3 : 10) / S, cur = getSel();
  if (cur && R.contains(cur, p, tol)) return cur;
  for (let i = doc.els.length - 1; i >= 0; i--) if (R.contains(doc.els[i], p, doc.els[i].type === 'line' ? Math.max(tol, 6 / S) : tol)) return doc.els[i];
  return null;
}
stage.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  stage.focus({ preventScroll: true });
  stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: zoom }; return }
  const p = toDoc(e), cur = getSel();
  if (cur && !cur.locked) {
    const hnd = hitHandle(cur, e);
    if (hnd) { drag = { mode: hnd.rot ? 'rotate' : 'resize', h: hnd, e0: { ...cur } }; return }
  }
  const hit = topHit(p, e);
  if (hit) {
    const now = Date.now(), dbl = lastTap.id === hit.id && now - lastTap.t < 350;
    lastTap = { id: hit.id, t: now };
    if (sel !== hit.id) { sel = hit.id; buildInsp() }
    if (dbl) focusContent();
    drag = hit.locked ? null : { mode: 'move', e0: { ...hit }, p0: p, sx: e.clientX, sy: e.clientY, moved: false };
  } else {
    if (sel) { sel = null; buildInsp() }
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, st: wrap.scrollTop, sl: wrap.scrollLeft };
  }
  redraw();
});
stage.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!drag) { hover(e); return }
  const el = getSel(), p = toDoc(e);
  if (drag.mode === 'pinch') {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()]; zoom = clamp(drag.z0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0, .3, 8); layoutStage(); return;
  }
  if (drag.mode === 'pan') { wrap.scrollTop = drag.st - (e.clientY - drag.sy); wrap.scrollLeft = drag.sl - (e.clientX - drag.sx); return }
  if (!el) return;
  if (drag.mode === 'move') {
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    el.x = Math.round(drag.e0.x + p.x - drag.p0.x); el.y = Math.round(drag.e0.y + p.y - drag.p0.y);
    snap(el, e.altKey);
  } else if (drag.mode === 'resize') resize(el, p, e.shiftKey);
  else if (drag.mode === 'rotate') {
    const c = R.center(el); let a = (Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI + 90 + 360) % 360;
    if (e.shiftKey) a = Math.round(a / 15) * 15; else { const s = Math.round(a / 45) * 45; if (Math.abs(a - s) < 4) a = s }
    el.rot = Math.round(a) % 360; rotating = el.rot;
  }
  redraw(); syncInsp();
});
function endDrag(e) {
  ptrs.delete(e.pointerId);
  if (!drag) return;
  if (drag.mode !== 'pinch' || !ptrs.size) {
    const changedSomething = drag.mode === 'resize' || drag.mode === 'rotate' || (drag.mode === 'move' && drag.moved);
    drag = null; guides = []; rotating = null;
    if (changedSomething) { grow(); commit() }
    redraw();
  }
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('dblclick', e => { const el = topHit(toDoc(e), e); if (el) { sel = el.id; buildInsp(); focusContent() } });
stage.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), .3, 8); layoutStage();
}, { passive: false });
function hover(e) {
  if (e.pointerType !== 'mouse') return;
  const el = getSel(), hnd = el && !el.locked && hitHandle(el, e);
  let c = 'default';
  if (hnd) {
    if (hnd.rot) c = 'grab';
    else { const ang = ((Math.atan2(hnd.hy, hnd.hx) * 180 / Math.PI + el.rot) % 180 + 180) % 180; c = ['ew', 'nwse', 'ns', 'nesw'][Math.round(ang / 45) % 4] + '-resize' }
  } else { const t = topHit(toDoc(e), e); if (t) c = t.locked ? 'pointer' : 'move' }
  stage.style.cursor = c;
}

function snap(el, off) {
  guides = []; if (off) return;
  const tol = 7 / S, b = R.aabb(el), { w, h } = R.paperDots(doc.paper);
  const tx = [0, w / 2, w], ty = [0, h / 2, h];
  if (doc.paper.type === 'receipt') ty.pop();
  for (const o of doc.els) if (o.id !== el.id) { const a = R.aabb(o); tx.push(a.l, (a.l + a.r) / 2, a.r); ty.push(a.t, (a.t + a.b) / 2, a.b) }
  const best = (vals, ts) => { let r = null; for (const v of vals) for (const t of ts) { const d = t - v; if (Math.abs(d) <= tol && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, t } } return r };
  const bx = best([b.l, (b.l + b.r) / 2, b.r], tx), by = best([b.t, (b.t + b.b) / 2, b.b], ty);
  if (bx) { el.x = Math.round(el.x + bx.d); guides.push({ x: bx.t }) }
  if (by) { el.y = Math.round(el.y + by.d); guides.push({ y: by.t }) }
}

function resize(el, p, shift) {
  const e0 = drag.e0, { hx, hy } = drag.h, a = e0.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const c0 = R.center(e0), vx = p.x - c0.x, vy = p.y - c0.y, lx = vx * co + vy * si, ly = -vx * si + vy * co, MIN = 4;
  let l = -e0.w / 2, r = e0.w / 2, t = -e0.h / 2, b = e0.h / 2;
  if (hx === 1) r = Math.max(l + MIN, lx); if (hx === -1) l = Math.min(r - MIN, lx);
  if (hy === 1) b = Math.max(t + MIN, ly); if (hy === -1) t = Math.min(b - MIN, ly);
  const keep = el.type === 'qr' || (el.type === 'image' && el.lockAspect) ? !shift || el.type === 'qr' : shift;
  if (keep && hx && hy) {
    const s = Math.max((r - l) / e0.w, (b - t) / e0.h), nw = e0.w * s, nh = e0.h * s;
    if (hx === 1) r = l + nw; else l = r - nw;
    if (hy === 1) b = t + nh; else t = b - nh;
  }
  const mx = (l + r) / 2, my = (t + b) / 2;
  el.w = Math.round(r - l); el.h = Math.round(b - t);
  el.x = Math.round(c0.x + mx * co - my * si - el.w / 2); el.y = Math.round(c0.y + mx * si + my * co - el.h / 2);
  if (el.type === 'text') { if (hy) el.autoH = false; R.relayout(el, env()) }
}

// Receipts grow as you place things near the end.
function grow() {
  if (doc.paper.type !== 'receipt' || !doc.els.length) return;
  const bottom = Math.max(...doc.els.map(e => R.aabb(e).b)) / DPMM;
  if (bottom > doc.paper.h - 10) { doc.paper.h = Math.ceil(bottom + 20); layoutStage() }
}

/* ---------- element actions ---------- */
function visibleSpot() {
  if (doc.paper.type !== 'receipt') return null;
  const { w, h } = R.paperDots(doc.paper);
  return { x: w / 2, y: clamp((wrap.scrollTop + wrap.clientHeight / 2 - M) / S, 40, h - 40) };
}
function addEl(type, extra) {
  const el = R.newEl(type, doc.paper, visibleSpot(), extra);
  R.relayout(el, env());
  placeFree(el);
  doc.els.push(el); R.relayout(el, env()); sel = el.id;
  grow(); redraw(); buildInsp(); commit();
  if (['text', 'qr', 'barcode'].includes(type)) focusContent();
  return el;
}
// Put a new element in empty space: below everything if it fits, else nudged off anything identical.
function placeFree(el) {
  const { w, h } = R.paperDots(doc.paper), others = doc.els.map(R.aabb);
  const hits = () => others.some(b => b.l < el.x + el.w && b.r > el.x && b.t < el.y + el.h && b.b > el.y);
  if (!hits()) return;
  const below = Math.ceil(Math.max(...others.map(b => b.b))) + 8;
  if (doc.paper.type === 'receipt' || below + el.h <= h) { el.y = below; el.x = Math.round((w - el.w) / 2); return }
  for (let y = 8; y + el.h <= h; y += 8) { el.y = y; if (!hits()) return }
  el.x = Math.round((w - el.w) / 2); el.y = Math.round((h - el.h) / 2);
  while (doc.els.some(o => o.x === el.x && o.y === el.y)) { el.x += 16; el.y += 16 }
}
function add(type) { if (type === 'image') { replacing = null; $('#file').click() } else addEl(type) }
function del() { const el = getSel(); if (!el) return; doc.els = doc.els.filter(e => e !== el); sel = null; redraw(); buildInsp(); commit() }
function duplicate(src = getSel()) {
  if (!src) return;
  const el = { ...structuredClone(src), id: R.uid(), x: src.x + 16, y: src.y + 16, locked: false };
  doc.els.push(el); sel = el.id; grow(); redraw(); buildInsp(); commit();
}
function order(d) {
  const el = getSel(); if (!el) return;
  const i = doc.els.indexOf(el), j = clamp(i + d, 0, doc.els.length - 1); if (i === j) return;
  doc.els.splice(i, 1); doc.els.splice(j, 0, el); redraw(); commit(); say(d > 0 ? 'Brought forward' : 'Sent backward');
}
function toggleLock() { const el = getSel(); if (!el) return; el.locked = !el.locked; redraw(); buildInsp(); commit() }
function alignTo(where) {
  const el = getSel(); if (!el) return;
  const b = R.aabb(el), { w, h } = R.paperDots(doc.paper);
  const dx = { l: -b.l, cx: w / 2 - (b.l + b.r) / 2, r: w - b.r }[where], dy = { t: -b.t, cy: h / 2 - (b.t + b.b) / 2, b: h - b.b }[where];
  if (dx != null) el.x = Math.round(el.x + dx); if (dy != null) el.y = Math.round(el.y + dy);
  changed();
}
// Typed sizes keep QR codes square and images in proportion (when that is on).
function setSize(el, k, mmv) {
  const v = Math.max(4, Math.round(mmv * DPMM)), o = k === 'w' ? 'h' : 'w';
  if (el.type === 'qr' || (el.type === 'image' && el.lockAspect)) el[o] = Math.max(4, Math.round(el[o] * v / el[k]));
  el[k] = v;
}
function focusContent() {
  const t = $('#inspContent'); if (!t) return;
  t.focus({ preventScroll: true }); t.select && t.select(); t.scrollIntoView({ block: 'nearest' });
}

/* ---------- images ---------- */
let replacing = null;
async function importImage(file) {
  let src;
  try { src = await createImageBitmap(file) }
  catch (e) {
    src = await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i) }; i.onerror = () => rej(Error('Could not read that image.')); i.src = u });
  }
  const iw = src.width, ih = src.height, s = Math.min(1, 1000 / Math.max(iw, ih)), w = Math.max(1, Math.round(iw * s)), hh = Math.max(1, Math.round(ih * s));
  const c = h('canvas', { width: w, height: hh }), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, w, hh);
  const a = x.getImageData(0, 0, w, hh).data; let alpha = false;
  for (let i = 3; i < a.length; i += 16) if (a[i] < 250) { alpha = true; break }
  const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  doc.assets[id] = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .9);
  return { id, w, h: hh };
}
async function placeImage(file) {
  try {
    const img = await importImage(file), ar = img.h / img.w, target = replacing && getSel();
    if (target && target.type === 'image') {
      target.asset = img.id; const c = R.center(target); target.h = Math.round(target.w * ar); target.y = Math.round(c.y - target.h / 2);
      redraw(); buildInsp(); commit(); return;
    }
    const { w: PW, h: PH } = R.paperDots(doc.paper), maxH = doc.paper.type === 'receipt' ? 480 : PH * .9;
    let w = Math.min(PW, P.DOTS) * .8, hh = w * ar;
    if (hh > maxH) { hh = maxH; w = hh / ar }
    addEl('image', { asset: img.id, w: Math.round(w), h: Math.round(hh), dither: /png/.test(doc.assets[img.id].slice(0, 15)) ? 'thr' : 'fs' });
  } catch (e) { say(e.message || 'Could not read that image.', 'err') }
  finally { replacing = null }
}
$('#file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) placeImage(f) };
wrap.addEventListener('dragover', e => e.preventDefault());
wrap.addEventListener('drop', e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (f) placeImage(f) });

/* ---------- inspector ---------- */
const insp = $('#insp');
let binds = [];
function changed(layout) {
  const el = getSel(); if (el) R.relayout(el, env());
  if (layout) layoutStage(); else redraw();
  syncInsp(); updChip(); scheduleCommit();
}
function syncInsp() { for (const b of binds) b() }
const row = (label, ...kids) => h('label', { className: 'f' }, h('span', {}, label), ...kids);
const grp = (title, ...kids) => h('div', { className: 'grp' }, title ? h('h3', {}, title) : null, ...kids);
function num(label, get, set, o = {}) {
  const inp = h('input', { type: 'number', step: o.step ?? 1, min: o.min, max: o.max, inputMode: 'decimal' });
  inp.oninput = () => {
    if (inp.value === '' || isNaN(+inp.value)) return;
    set(clamp(+inp.value, o.min ?? -Infinity, o.max ?? Infinity)); changed(o.layout);
  };
  inp.onchange = () => { syncInsp(); commit() };
  binds.push(() => { if (document.activeElement !== inp) inp.value = +(+get()).toFixed(o.dp ?? 2); if (o.off) inp.disabled = o.off() });
  return row(label, inp, o.unit ? h('output', {}, o.unit) : null);
}
const mmNum = (label, o, k, x = {}) => num(label, () => o[k] / DPMM, v => o[k] = Math.round(v * DPMM), { step: .5, unit: 'mm', ...x });
function sel_(label, get, set, opts, o = {}) {
  const s = h('select', {}, opts.map(([v, t]) => h('option', { value: v }, t)));
  s.onchange = () => { set(s.value); changed(o.layout); commit(); if (o.rebuild) buildInsp() };
  binds.push(() => { s.value = get() });
  return label ? row(label, s) : s;
}
function chk(label, get, set, o = {}) {
  const c = h('input', { type: 'checkbox' });
  c.onchange = () => { set(c.checked); changed(o.layout); commit(); if (o.rebuild) buildInsp() };
  binds.push(() => { c.checked = !!get(); if (o.off) c.disabled = o.off() });
  return h('label', { className: 'ck' }, c, label);
}
function range(label, get, set, min, max, step = 1, fmt = v => v) {
  const r = h('input', { type: 'range', min, max, step }), out = h('output');
  r.oninput = () => { set(+r.value); changed() };
  r.onchange = () => commit();
  binds.push(() => { r.value = get(); out.textContent = fmt(+get()) });
  return row(label, r, out);
}
function seg(opts, get, set, icons) {
  const box = h('span', { className: 'seg' + (icons ? ' ic' : '') });
  const bs = opts.map(([v, c, tip]) => {
    const b = h('button', { type: 'button', title: tip, 'aria-label': tip }, icons ? icon(c) : c);
    b.onclick = () => { set(v); changed(true); commit(); buildInsp() };
    box.append(b); return [v, b];
  });
  binds.push(() => { for (const [v, b] of bs) b.setAttribute('aria-pressed', get() === v) });
  return box;
}
function toggles(o, list) {
  const box = h('span', { className: 'seg ic' });
  const bs = list.map(([k, c, tip]) => {
    const b = h('button', { type: 'button', title: tip, 'aria-label': tip }, h(c)); b.lastChild.textContent = tip[0];
    b.onclick = () => { o[k] = !o[k]; changed(); commit() };
    box.append(b); return [k, b];
  });
  binds.push(() => { for (const [k, b] of bs) b.setAttribute('aria-pressed', !!o[k]) });
  return box;
}
function area(get, set, placeholder, tokens = true) {
  const t = h('textarea', { id: 'inspContent', placeholder, spellcheck: false, rows: 3 });
  t.oninput = () => { set(t.value); changed() };
  t.onchange = () => commit();
  binds.push(() => { if (document.activeElement !== t) t.value = get() });
  const tk = tokens && h('div', { className: 'tokens' }, h('span', { className: 'hint' }, 'Insert:'),
    ['{date}', '{time}', '{n}'].map(k => h('button', { type: 'button', title: k === '{n}' ? 'Counter: goes up by one with every copy printed' : 'Filled in when printing', onclick: () => { t.focus(); t.setRangeText(k, t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input')); commit() } }, k)));
  return [t, tk];
}
function info(fn) { const d = h('div'); binds.push(() => { const [cls, txt] = fn() || ['', '']; d.className = cls; d.textContent = txt }); return d }

const NAMES = { text: 'Text', image: 'Image', qr: 'QR code', barcode: 'Barcode', rect: 'Box', ellipse: 'Circle', line: 'Line' };
function buildInsp() {
  binds = []; insp.textContent = '';
  const el = getSel();
  if (el) elementPanel(el); else paperPanel();
  syncInsp(); updChip();
}

function elementPanel(el) {
  insp.append(h('div', { className: 'ih' }, h('h2', {}, NAMES[el.type]),
    ib('copy', 'Duplicate (Ctrl+D)', () => duplicate()), ib('up', 'Bring forward (])', () => order(1)), ib('down', 'Send backward ([)', () => order(-1)),
    ib(el.locked ? 'lock' : 'unlock', el.locked ? 'Unlock' : 'Lock in place', toggleLock), ib('trash', 'Delete (Del)', del)));
  if (el.locked) insp.append(h('p', { className: 'hint' }, 'Locked. It cannot be moved or resized until you unlock it.'));
  const G = (k, cb) => [() => el[k], v => { el[k] = v; cb && cb(v) }];

  if (el.type === 'text') {
    insp.append(...area(...G('text'), 'Type your text'));
    insp.append(row('Font', sel_(null, ...G('font'), Object.entries(R.FONTS).map(([k, v]) => [k, v[0]]), { rebuild: true })));
    if (el.font === 'custom') {
      const c = h('input', { type: 'text', placeholder: 'e.g. Impact, Noto Sans Tamil', value: el.custom });
      c.oninput = () => { el.custom = c.value; changed() }; c.onchange = () => commit();
      insp.append(row('Font name', c));
    }
    insp.append(num('Size', ...G('size'), { min: 4, max: 300, step: 1, unit: 'pt', dp: 1, off: () => el.fit }));
    insp.append(h('div', { className: 'f' },
      toggles(el, [['bold', 'b', 'Bold'], ['italic', 'i', 'Italic'], ['underline', 'u', 'Underline'], ['strike', 's', 'Strikethrough']]),
      seg([['left', 'tl', 'Align left'], ['center', 'tc', 'Align centre'], ['right', 'tr', 'Align right']], ...G('align'), true)));
    insp.append(h('div', { className: 'f' }, h('span', {}, 'Vertical'),
      seg([['top', 'vt', 'Top'], ['middle', 'vm', 'Middle'], ['bottom', 'vb', 'Bottom']], ...G('valign'), true)));
    insp.append(chk('Wrap lines to the box width', ...G('wrap')));
    insp.append(chk('Fit text to the box (auto size)', ...G('fit'), { rebuild: true }));
    insp.append(chk('Grow the box with the text', ...G('autoH'), { off: () => el.fit }));
    insp.append(chk('White text on black', ...G('invert')));
    insp.append(grp('Spacing',
      range('Line', ...G('lh'), .7, 2.5, .05, v => v.toFixed(2)),
      range('Letter', ...G('ls'), -4, 30, 1, v => v)));
  }

  if (el.type === 'image') {
    insp.append(h('div', { className: 'row' }, h('button', { type: 'button', onclick: () => { replacing = el.id; $('#file').click() } }, icon('image'), 'Replace image')));
    insp.append(sel_('Style', ...G('dither'), [['fs', 'Photo, smooth (Floyd–Steinberg)'], ['atk', 'Photo, crisp (Atkinson)'], ['bayer', 'Halftone pattern'], ['thr', 'Black and white (logos, text)']]));
    insp.append(range('Brightness', ...G('br'), 40, 180, 1, v => v + '%'));
    insp.append(range('Contrast', ...G('co'), 40, 260, 1, v => v + '%'));
    insp.append(range('Cut-off', ...G('thr'), 20, 235, 1));
    insp.append(chk('Invert', ...G('inv')));
    insp.append(chk('Keep proportions when resizing', ...G('lockAspect')));
  }

  if (el.type === 'qr') {
    insp.append(...area(...G('data'), 'Link, text, phone number…'));
    insp.append(sel_('Error fix', ...G('ecc'), [['L', 'Low (7%), smallest'], ['M', 'Medium (15%)'], ['Q', 'High (25%)'], ['H', 'Highest (30%)']]));
    insp.append(info(() => {
      const q = R.qrOf(R.fillTokens(el.data, env()) || ' ', el.ecc);
      if (q.err) return ['err', q.err];
      const n = q.v.size, m = Math.min(el.w, el.h) / n;
      if (m < 2) return ['warn', `${n}×${n} squares at ${m.toFixed(1)} dots each: too small to scan reliably. Make it at least ${Math.ceil(n * 2 / DPMM)} mm wide or shorten the content.`];
      return ['hint', `${n}×${n} squares, ${Math.floor(m)} dots each.`];
    }));
  }

  if (el.type === 'barcode') {
    insp.append(sel_('Type', ...G('kind'), Object.entries(BARCODES).map(([k, v]) => [k, v.name])));
    const [t, tk] = area(...G('data'), 'Content');
    t.rows = 1; insp.append(t, tk);
    insp.append(chk('Show the number under the bars', ...G('showText')));
    insp.append(num('Text size', ...G('textSize'), { min: 4, max: 40, unit: 'pt', off: () => !el.showText }));
    insp.append(info(() => {
      const b = R.barcodeOf(el.kind, R.fillTokens(el.data, env()));
      if (b.err) return ['err', b.err];
      const n = b.v.bits.length, m = el.w / n;
      if (m < 1) return ['err', `Too narrow to print: make it at least ${Math.ceil(n / DPMM)} mm wide.`];
      if (m < 2) return ['warn', `Bars are 1 dot thin, which some scanners struggle with. ${Math.ceil(n * 2 / DPMM)} mm wide or more is safer.`];
      return ['hint', `${n} modules, ${Math.floor(m)} dots each. Leave some blank space on both sides for scanners.`];
    }));
  }

  if (el.type === 'rect' || el.type === 'ellipse') {
    insp.append(chk('Filled', ...G('fill')));
    insp.append(mmNum('Line width', el, 'stroke', { min: .125, max: 20, step: .125, off: () => el.fill }));
    if (el.type === 'rect') insp.append(mmNum('Corners', el, 'radius', { min: 0, max: 50 }));
  }
  if (el.type === 'line') {
    insp.append(mmNum('Thickness', el, 'h', { min: .125, max: 20, step: .125 }));
    insp.append(chk('Dashed', ...G('dash')));
  }

  const r90 = () => { el.rot = (Math.round(el.rot / 90) * 90 + 90) % 360; changed() };
  insp.append(grp('Position and size',
    h('div', { className: 'grid2' },
      mmNum('X', el, 'x', { min: -500 }), mmNum('Y', el, 'y', { min: -500 }),
      num(el.type === 'line' ? 'Len' : 'W', () => el.w / DPMM, v => setSize(el, 'w', v), { min: .5, step: .5, unit: 'mm' }),
      el.type === 'line' ? null : num('H', () => el.h / DPMM, v => setSize(el, 'h', v), { min: .5, step: .5, unit: 'mm', off: () => el.type === 'text' && el.autoH && !el.fit })),
    h('div', { className: 'f' }, h('span', {}, 'Rotation'),
      (() => { const n = num('', () => el.rot, v => el.rot = ((Math.round(v) % 360) + 360) % 360, { min: -360, max: 720, unit: '°', dp: 0 }); n.style.flex = '1'; n.style.margin = '0'; n.firstChild.remove(); return n })(),
      ib('rotate', 'Rotate 90°', r90)),
    h('div', { className: 'f' }, h('span', {}, 'Align'),
      h('span', { className: 'seg ic' }, [['l', 'al', 'Left edge'], ['cx', 'acx', 'Centre across'], ['r', 'ar', 'Right edge'], ['t', 'at', 'Top edge'], ['cy', 'acy', 'Centre down'], ['b', 'ab', 'Bottom edge']]
        .map(([k, i, t]) => h('button', { type: 'button', title: t, 'aria-label': t, onclick: () => { alignTo(k); commit() } }, icon(i)))))));
}

const PRESETS = [[25, 15], [30, 20], [40, 20], [40, 30], [40, 40], [40, 60], [48, 30], [48, 40], [48, 60], [50, 20], [50, 30], [50, 40], [50, 50], [57, 30]];
function paperPanel() {
  const p = doc.paper, G = k => [() => p[k], v => p[k] = v];
  insp.append(h('div', { className: 'ih' }, h('h2', {}, 'Paper')));
  insp.append(h('div', { className: 'f' }, seg([['label', 'Label', 'Die-cut labels with gaps'], ['receipt', 'Receipt', 'Continuous roll']], () => p.type, v => {
    if (v === p.type) return;
    p.type = v;
    if (v === 'receipt') { p.w = 48; p.h = Math.max(60, Math.ceil(Math.max(0, ...doc.els.map(e => R.aabb(e).b)) / DPMM + 15)) }
    else if (p.h > 100) p.h = 30;
  })));
  if (p.type === 'label') {
    insp.append(sel_('Size', () => PRESETS.some(([w, hh]) => w === p.w && hh === p.h) ? p.w + 'x' + p.h : 'custom',
      v => { if (v !== 'custom') [p.w, p.h] = v.split('x').map(Number) },
      [...PRESETS.map(([w, hh]) => [w + 'x' + hh, `${w} × ${hh} mm`]), ['custom', 'Custom']], { layout: true }));
    insp.append(h('div', { className: 'grid2' },
      num('W', ...G('w'), { min: 5, max: 80, step: .5, unit: 'mm', layout: true }),
      num('H', ...G('h'), { min: 5, max: 500, step: .5, unit: 'mm', layout: true })));
    insp.append(info(() => p.w > 48 ? ['warn', `The print head is 48 mm wide, so ${(p.w - 48).toFixed(1)} mm of this label (shaded red) cannot be printed.`] : null));
    insp.append(num('Gap', ...G('gap'), { min: 0, max: 20, step: .5, unit: 'mm' }));
    insp.append(chk('Use the printer\'s gap sensor to find the next label', ...G('gapSensor')));
    insp.append(h('p', { className: 'hint' }, 'With the sensor off, the printer feeds exactly the gap after each label. Turn it on if labels drift; turn it off if a blank label comes out after each print.'));
  } else {
    insp.append(num('Length', ...G('h'), { min: 10, max: 2000, step: 5, unit: 'mm', layout: true }));
    insp.append(chk('Cut off blank space at the end', ...G('trim')));
    insp.append(num('Feed after', ...G('feed'), { min: 0, max: 60, step: 1, unit: 'mm' }));
    insp.append(h('p', { className: 'hint' }, '58 mm paper, 48 mm printable. The roll grows as you add things near the end.'));
  }
  insp.append(grp('Printing',
    range('Darkness', ...G('darkness'), 60, 230, 1, v => Math.round((v - 60) / 1.7) + '%'),
    num('Shift right', ...G('offset'), { min: -24, max: 24, step: .5, unit: 'mm' }),
    num('Next {n}', ...G('counter'), { min: 0, max: 99999999, dp: 0 }),
    num('{n} digits', ...G('pad'), { min: 0, max: 10, dp: 0 }),
    h('p', { className: 'hint' }, 'Darkness affects text and shapes; images have their own controls. Shift moves everything sideways if your labels are not centred. {n} in any text, QR or barcode becomes the counter, which goes up by one per copy.')));
  insp.append(grp('Tips', h('ul', { className: 'hint', style: 'padding-left:18px;margin:0' },
    h('li', {}, 'Tap a button above to add text, images, codes or shapes.'),
    h('li', {}, 'Tap something to select it, drag to move. Square handles resize, the round one rotates (hold Shift for 15° steps).'),
    h('li', {}, 'Double-tap text to edit it. Pink lines show when things line up.'),
    h('li', {}, 'Paste or drop an image anywhere to add it. Ctrl+Z undoes, Ctrl+D duplicates, arrow keys nudge.'))));
  if (doc.els.length) insp.append(h('div', { className: 'row' }, h('button', { type: 'button', className: 'danger', onclick: () => { doc.els = []; sel = null; redraw(); buildInsp(); commit(); say('Cleared. Undo brings it back.') } }, icon('trash'), 'Clear everything')));
}

function updChip() {
  const p = doc.paper;
  $('#paperChip').textContent = p.type === 'label' ? `Label ${p.w} × ${p.h} mm` : `Receipt ${p.trim ? 'auto length' : p.h + ' mm'}`;
}
$('#paperChip').onclick = () => { sel = null; buildInsp(); redraw(); insp.scrollTop = 0 };

/* ---------- printing ---------- */
let printing = false, cancelReq = false;
function setPrintBtn() {
  const b = $('#bPrint'); b.lastChild.textContent = printing ? 'Cancel' : 'Print'; b.classList.toggle('danger', printing); b.classList.toggle('p', !printing);
}
async function print() {
  if (printing) { cancelReq = true; return }
  commit();
  const copies = clamp(Math.round(+$('#copies').value) || 1, 1, 999), p = doc.paper;
  let done = 0;
  try {
    R.rasterize(doc, p.counter); // shows design problems before connecting
    if (!P.connected()) { say('Connecting…'); await P.connect($('#showall').checked) }
    printing = true; cancelReq = false; setPrintBtn();
    await R.imagesReady(doc);
    const dyn = R.hasCounter(doc); let job = null;
    for (; done < copies; done++) {
      say(copies > 1 ? `Printing ${done + 1} of ${copies}…` : 'Printing…');
      if (!job || dyn) {
        const r = R.rasterize(doc, p.counter + done), off = Math.round((P.DOTS - r.w) / 2 + p.offset * DPMM);
        job = { bits: pack(r.d, r.w, r.h, P.WB, off), h: r.h };
      }
      const after = p.type === 'label' ? (p.gapSensor ? P.cat(0x1d, 0x0c) : P.feedMm(p.gap)) : P.feedMm(p.feed);
      await P.printBits(job.bits, job.h, after, () => cancelReq);
    }
    say(copies > 1 ? `Printed ${copies} copies` : 'Printed', 'ok');
  } catch (e) { say(P.hint(e), 'err'); log((e.name || 'Error') + ': ' + (e.message || e), 'err') }
  finally {
    if (done && R.hasCounter(doc)) { p.counter += done; commit(); syncInsp() }
    printing = false; setPrintBtn();
  }
}
$('#bPrint').onclick = print;
$('#cMinus').onclick = () => $('#copies').value = Math.max(1, (+$('#copies').value || 1) - 1);
$('#cPlus').onclick = () => $('#copies').value = Math.min(999, (+$('#copies').value || 1) + 1);

/* ---------- printer settings dialog ---------- */
async function diag() {
  const r = [['Secure page (https or localhost)', window.isSecureContext], ['Web Bluetooth in this browser', !!navigator.bluetooth]];
  if (navigator.bluetooth && navigator.bluetooth.getAvailability) { try { r.push(['Bluetooth adapter available', await navigator.bluetooth.getAvailability()]) } catch (e) { r.push(['Bluetooth adapter available', 'unknown']) } }
  const b = $('#diagbody'); b.textContent = '';
  for (const [k, v] of r) b.append(h('div', { style: `color:var(${v === true ? '--ok' : v === false ? '--bad' : '--mute'})` }, (v === true ? 'OK   ' : v === false ? 'FAIL ' : '?    ') + k));
  b.append(h('div', {}, navigator.userAgent));
  if (!navigator.bluetooth) b.append(h('div', { style: 'margin-top:6px;color:var(--bad)' }, 'This browser cannot use Web Bluetooth. Use Chrome, Edge or Opera on Android, Windows, macOS, ChromeOS or Linux. Firefox, Safari and every browser on iPhone/iPad do not support it. On Linux Chrome, if this stays FAIL, open chrome://flags/#enable-experimental-web-platform-features, enable it and restart.'));
  else if (!window.isSecureContext) b.append(h('div', { style: 'margin-top:6px;color:var(--bad)' }, 'Open this page over https:// (for example your Vercel link) or http://localhost.'));
  return r.every(([, v]) => v !== false);
}
$('#bSettings').onclick = () => { diag(); $('#dlgSettings').showModal() };
const doConnect = async pickNew => { try { await P.connect($('#showall').checked, pickNew); say('Connected', 'ok') } catch (e) { say(P.hint(e), 'err'); log(e.name + ': ' + (e.message || e), 'err') } };
$('#conn').onclick = () => doConnect(false);
$('#bPickNew').onclick = () => doConnect(true);
for (const k of ['chunk', 'delay', 'band']) $('#c_' + k).value = P.cfg[k];
$('#c_resp').checked = P.cfg.resp;
$('#dlgSettings').addEventListener('input', e => {
  const k = e.target.id; if (!k.startsWith('c_')) return;
  P.cfg[k.slice(2)] = k === 'c_resp' ? e.target.checked : Math.max(0, +e.target.value || 0);
  if (P.cfg.chunk < 20) P.cfg.chunk = 20; P.saveCfg();
});
const act = {
  feed3: () => P.send(P.cat(0x1b, 0x64, 3)),
  feed10: () => P.send(P.cat(0x1b, 0x64, 10)),
  nextLabel: () => P.send(P.cat(0x1d, 0x0c)),
  async testPage() {
    await P.send(P.cat(0x1b, 0x40, 0x1b, 0x61, 1, 'PSF-20 test page\n', 0x1b, 0x61, 0));
    await P.send(P.cat(0x1b, 0x61, 1, 0x1d, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0, 0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x43, 5, 0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x45, 49, 0x1d, 0x28, 0x6b, 10, 0, 0x31, 0x50, 0x30, 'PSF20 OK!', 0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30, '\n', 0x1b, 0x61, 0));
    await P.send(P.cat(0x1b, 0x64, 3));
  },
  async stress() {
    const n = Math.max(50, +$('#srows').value || 400), b = new Uint8Array(n * P.WB);
    for (let y = 0; y < n; y++) for (let i = 0; i < P.WB; i++) b[y * P.WB + i] = (i + ((y >> 3) & 1)) % 2 ? 0 : 255;
    const t = performance.now(); await P.printBits(b, n, P.cat(0x1b, 0x64, 3));
    const s = (performance.now() - t) / 1000; log(`${n * P.WB + n} bytes sent in ${s.toFixed(1)} s (${Math.round(n * P.WB / s)} B/s)`);
  },
  async sendRaw() {
    const x = $('#raw').value.replace(/[^0-9a-f]/gi, '');
    if (!x.length || x.length % 2) throw Error('Enter whole hex bytes.');
    await P.send(Uint8Array.from(x.match(/../g), v => parseInt(v, 16)));
  },
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-do]'); if (!b) return;
  b.disabled = true; say('Sending…');
  try { await act[b.dataset.do](); say('Done', 'ok') } catch (x) { say(P.hint(x), 'err'); log(x.message, 'err') }
  b.disabled = false;
});

/* ---------- designs dialog ---------- */
const designs = () => { try { return JSON.parse(localStorage.getItem(DKEY) || '[]') } catch (e) { return [] } };
function thumb(d, W = 240, H = 120) {
  d = normalize(d);
  const { w, h } = R.paperDots(d.paper), s = Math.min(W / w, H / Math.min(h, w * 1.6)), c = h_canvas(Math.round(w * s), Math.round(Math.min(h, w * 1.6) * s));
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.scale(s, s);
  const en = { doc: d, n: d.paper.counter, pad: d.paper.pad };
  for (const el of d.els) R.drawEl(x, el, en);
  return c;
}
const h_canvas = (w, hh) => h('canvas', { width: w, height: hh });
function renderDesigns() {
  const list = $('#savedList'), all = designs(); list.textContent = '';
  if (!all.length) list.append(h('p', { className: 'hint' }, 'Nothing saved yet.'));
  all.sort((a, b) => b.t - a.t).forEach(d => list.append(h('div', { className: 'it' },
    h('span', {}, d.name, h('small', {}, new Date(d.t).toLocaleString())),
    h('button', { type: 'button', onclick: () => { loadDoc(d.doc); $('#dlgDesigns').close(); say(`Opened "${d.name}"`) } }, 'Open'),
    ib('trash', 'Delete ' + d.name, () => { if (!confirm(`Delete "${d.name}"?`)) return; localStorage.setItem(DKEY, JSON.stringify(designs().filter(x => x.name !== d.name))); renderDesigns() }))));
  const tl = $('#tplList'); tl.textContent = '';
  for (const t of TEMPLATES) tl.append(h('button', { type: 'button', onclick: () => { loadDoc(t.make()); $('#dlgDesigns').close(); say(`${t.name} ready. Undo brings back your previous design.`) } }, thumb(t.make()), t.name));
}
$('#bDesigns').onclick = () => { renderDesigns(); $('#dlgDesigns').showModal() };
$('#bSave').onclick = () => {
  const name = $('#saveName').value.trim() || 'Untitled'; commit();
  const all = designs().filter(d => d.name !== name);
  all.push({ name, t: Date.now(), doc: { ...doc, assets: usedAssets(doc) } });
  try { localStorage.setItem(DKEY, JSON.stringify(all)); say(`Saved "${name}"`, 'ok'); renderDesigns() }
  catch (e) { say('Browser storage is full. Delete old designs, or use Export design file instead.', 'err') }
};
$('#bExport').onclick = () => {
  const name = ($('#saveName').value.trim() || 'design').replace(/[^\w\- ]+/g, '');
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...doc, assets: usedAssets(doc) })], { type: 'application/json' }));
  h('a', { href: url, download: name + '.psf20.json' }).click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('#bImport').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d.paper || !Array.isArray(d.els)) throw Error(); loadDoc(d); $('#dlgDesigns').close(); say('Design imported', 'ok') }
  catch (x) { say('That file is not a PSF-20 design.', 'err') }
};

/* ---------- toolbar, keyboard, clipboard ---------- */
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => add(b.dataset.add));
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
const setZoom = z => { zoom = clamp(z, .3, 8); layoutStage() };
$('#bZoomIn').onclick = () => setZoom(zoom * 1.25);
$('#bZoomOut').onclick = () => setZoom(zoom / 1.25);
$('#bFit').onclick = () => setZoom(1);
const togglePreview = () => { preview = !preview; $('#bPreview').setAttribute('aria-pressed', preview); redraw() };
$('#bPreview').onclick = togglePreview;

let clip = null;
const typing = t => t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'p') { e.preventDefault(); print(); return }
  if (document.querySelector('dialog[open]')) return;
  if (mod && k === 's') { e.preventDefault(); $('#bDesigns').click(); return }
  if (typing(e.target)) { if (k === 'escape') e.target.blur(); return }
  const el = getSel();
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
  if (mod && k === 'y') { e.preventDefault(); redo(); return }
  if (mod && k === 'd') { e.preventDefault(); duplicate(); return }
  if (mod && k === 'c' && el) { clip = structuredClone(el); return }
  if (mod && k === 'x' && el) { clip = structuredClone(el); del(); return }
  if (mod && k === 'a') return;
  if (mod) return;
  if ((k === 'delete' || k === 'backspace') && el) { e.preventDefault(); del(); return }
  if (k === 'escape') { sel = null; buildInsp(); redraw(); return }
  if (k.startsWith('arrow') && el && !el.locked) {
    e.preventDefault(); const d = e.shiftKey ? DPMM : 1;
    if (k === 'arrowleft') el.x -= d; if (k === 'arrowright') el.x += d; if (k === 'arrowup') el.y -= d; if (k === 'arrowdown') el.y += d;
    changed(); return;
  }
  if (k === 'enter' && el) { e.preventDefault(); focusContent(); return }
  const adds = { t: 'text', i: 'image', q: 'qr', b: 'barcode', r: 'rect', e: 'ellipse', l: 'line' };
  if (adds[k]) { e.preventDefault(); add(adds[k]); return }
  if (k === '+' || k === '=') setZoom(zoom * 1.25);
  else if (k === '-') setZoom(zoom / 1.25);
  else if (k === '0') setZoom(1);
  else if (k === 'p') togglePreview();
  else if (k === ']') order(1);
  else if (k === '[') order(-1);
});
document.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
  if (f) { e.preventDefault(); placeImage(f); return }
  if (typing(e.target) || !clip || document.querySelector('dialog[open]')) return;
  e.preventDefault(); duplicate(clip); clip = { ...clip, x: clip.x + 16, y: clip.y + 16 };
});

/* ---------- start ---------- */
let lastWrap = '';
new ResizeObserver(() => { const k = wrap.clientWidth + 'x' + (innerWidth >= 860 ? wrap.clientHeight : innerHeight); if (k !== lastWrap) { lastWrap = k; layoutStage() } }).observe(wrap);
updUndo(); buildInsp(); layoutStage();
diag().then(ok => { if (!ok) say('This browser cannot reach the printer. Open Printer for details.', 'err') });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
