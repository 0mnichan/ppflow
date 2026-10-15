// Built-in starting points. Geometry is in dots (8 per mm).
import { uid } from './render.js';

export const PAPER = { type: 'label', w: 40, h: 30, gap: 2, gapSensor: false, trim: true, feed: 10, offset: 0, darkness: 150, counter: 1, pad: 0 };

const T = { type: 'text', rot: 0, locked: false, font: 'sans', custom: '', size: 12, bold: false, italic: false, underline: false, strike: false, align: 'center', valign: 'middle', wrap: true, fit: false, autoH: false, lh: 1.15, ls: 0, invert: false };
const t = (text, x, y, w, h, o = {}) => ({ ...T, id: uid(), text, x, y, w, h, ...o });
const el = (type, x, y, w, h, o = {}) => ({ id: uid(), type, x, y, w, h, rot: 0, locked: false, ...o });
const line = (x, y, w, o = {}) => el('line', x, y, w, 2, { dash: false, ...o });
const doc = (paper, els) => ({ v: 1, paper: { ...PAPER, ...paper }, els, assets: {} });

export const TEMPLATES = [
  { name: 'Blank label', make: () => doc({}, []) },
  { name: 'Blank receipt', make: () => doc({ type: 'receipt', w: 48, h: 80 }, []) },
  {
    name: 'Price tag', make: () => doc({ w: 40, h: 30 }, [
      t('Product name', 12, 8, 296, 48, { bold: true, size: 11 }),
      t('₹ 99.00', 12, 58, 296, 92, { bold: true, fit: true }),
      el('barcode', 24, 156, 272, 72, { kind: 'c128', data: '1234567', showText: true, textSize: 7 }),
    ])
  },
  {
    name: 'Asset tag', make: () => doc({ w: 48, h: 30, pad: 4 }, [
      el('rect', 0, 0, 384, 240, { stroke: 4, fill: false, radius: 16 }),
      el('qr', 16, 24, 192, 192, { data: 'ASSET-{n}', ecc: 'M' }),
      t('ASSET', 216, 28, 152, 40, { bold: true, size: 10, invert: true }),
      t('{n}', 216, 76, 152, 80, { bold: true, fit: true, font: 'mono' }),
      t('{date}', 216, 168, 152, 40, { size: 8 }),
    ])
  },
  {
    name: 'Address label', make: () => doc({ w: 48, h: 40 }, [
      t('TO', 16, 12, 352, 28, { bold: true, size: 9, align: 'left' }),
      t('Full Name\n12 Example Street\nCity 600001\nPhone 98765 43210', 16, 40, 352, 160, { size: 11, align: 'left', valign: 'top', autoH: false }),
      line(16, 212, 352),
      t('From: My Shop, Main Road, City', 16, 222, 352, 90, { size: 8, align: 'left', valign: 'top' }),
    ])
  },
  {
    name: 'Receipt', make: () => doc({ type: 'receipt', w: 48, h: 110 }, [
      t('MY SHOP', 0, 8, 384, 56, { bold: true, size: 18 }),
      t('{date}  {time}\nBill #{n}', 0, 66, 384, 56, { size: 9 }),
      line(0, 132, 384, { dash: true }),
      t('Coffee            2 x 60\nCake              1 x 80\nWater             1 x 20', 8, 142, 368, 110, { font: 'mono', size: 9, align: 'left', valign: 'top' }),
      line(0, 262, 384, { dash: true }),
      t('TOTAL  ₹ 220', 0, 272, 384, 56, { bold: true, size: 16 }),
      el('qr', 132, 344, 120, 120, { data: 'upi://pay?pa=shop@upi&am=220', ecc: 'M' }),
      t('Thank you! Come again.', 0, 472, 384, 48, { size: 10, italic: true }),
    ])
  },
];
