// Bluetooth LE transport and ESC/POS raster printing for the PSF-20.
export const SVC = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const WR = '49535343-8841-43f4-a8d4-ecbe34729bb3', NT = '49535343-1e4d-4bd9-ba61-23c647249616';
export const DOTS = 384, WB = DOTS / 8, DPMM = 8; // 48 mm print head, 203 dpi

export const cfg = { chunk: 20, delay: 0, band: 128, feed: 3, resp: false };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('psf20') || '{}')) } catch (e) { }
export const saveCfg = () => { try { localStorage.setItem('psf20', JSON.stringify(cfg)) } catch (e) { } };

const sleep = ms => new Promise(r => setTimeout(r, ms));
export const hex = a => [...a].map(b => b.toString(16).padStart(2, '0')).join(' ');
const asc = a => [...a].map(b => b > 31 && b < 127 ? String.fromCharCode(b) : '.').join('');
export function cat(...p) {
  const a = p.map(x => typeof x === 'number' ? Uint8Array.of(x) : typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63) : x);
  const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0;
  for (const x of a) { o.set(x, i); i += x.length }
  return o;
}

let dev, wch;
export const events = new EventTarget(); // 'state' {detail:{on,name}}, 'log' {detail:{msg,cls}}
const log = (msg, cls = '') => events.dispatchEvent(new CustomEvent('log', { detail: { msg, cls } }));
const state = on => events.dispatchEvent(new CustomEvent('state', { detail: { on, name: dev && dev.name } }));
export const connected = () => !!(dev && dev.gatt.connected);

async function link() {
  const s = await dev.gatt.connect(), v = await s.getPrimaryService(SVC);
  wch = await v.getCharacteristic(WR);
  const n = await v.getCharacteristic(NT); await n.startNotifications();
  n.addEventListener('characteristicvaluechanged', e => {
    const a = new Uint8Array(e.target.value.buffer), t = asc(a);
    log('printer: ' + hex(a) + '  ' + t, /NACK/.test(t) ? 'warn' : '');
  });
  state(true); log('connected');
}

export async function connect(showAll, pickNew) {
  if (!navigator.bluetooth) throw Error('This browser has no Web Bluetooth. Open Printer settings for the connection check.');
  if (!dev || pickNew) {
    dev = await navigator.bluetooth.requestDevice(showAll
      ? { acceptAllDevices: true, optionalServices: [SVC] }
      : { filters: [{ namePrefix: 'PSF-20' }], optionalServices: [SVC] });
    dev.addEventListener('gattserverdisconnected', () => { state(false); log('disconnected', 'warn') });
  }
  await link();
}

export function hint(e) {
  const m = e && e.message ? e.message : String(e);
  if (e && e.name === 'NotFoundError' && /cancel|chooser/i.test(m)) return 'No printer chosen. Switch the printer on, close anything else connected to it, then pick PSF-20-… in the list.';
  if (e && e.name === 'NotFoundError') return 'No printer found. Check it is on and not connected to your phone, nRF Connect or a script. In Printer settings, tick "Show all Bluetooth devices" if it is not listed.';
  if (/br-connection-profile-unavailable|NetworkError|GATT|Connection attempt failed|Unsupported device/i.test(m))
    return m + '. Only one device can use the printer at a time, so disconnect everything else first. On Linux, BlueZ must also be LE-only: sudo btmgmt power off; sudo btmgmt bredr off; sudo btmgmt power on.';
  if (e && e.name === 'SecurityError') return m + '. Web Bluetooth only works on https:// pages or http://localhost.';
  return m;
}

export async function send(data) {
  if (!dev) throw Error('Connect to the printer first.');
  if (!dev.gatt.connected) { log('relinking', 'warn'); await link() }
  const c = Math.max(20, cfg.chunk);
  for (let i = 0; i < data.length; i += c) {
    const p = data.slice(i, i + c);
    if (wch.writeValueWithoutResponse && !cfg.resp) await wch.writeValueWithoutResponse(p); else await wch.writeValue(p);
    if (cfg.delay) await sleep(cfg.delay);
  }
}

// bits: 1 bit per dot, rows of WB bytes, MSB = leftmost dot. after: bytes sent once the image is done.
export async function printBits(bits, h, after, cancelled = () => false) {
  await send(cat(0x1b, 0x40));
  for (let y = 0; y < h; y += cfg.band) {
    if (cancelled()) throw Error('Printing cancelled.');
    const n = Math.min(cfg.band, h - y);
    await send(cat(0x1d, 0x76, 0x30, 0, WB, 0, n & 255, n >> 8, bits.subarray(y * WB, (y + n) * WB)));
  }
  if (after && after.length) await send(after);
}

// Feed paper by a distance in mm (ESC J, up to 255 dots per command).
export function feedMm(mm) {
  const parts = [];
  for (let d = Math.round(mm * DPMM); d > 0; d -= 255) parts.push(cat(0x1b, 0x4a, Math.min(255, d)));
  return cat(...parts);
}
