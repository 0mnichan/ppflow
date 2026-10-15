// 1D barcode encoders. barcode(type, text) -> {bits: '1010…' (1 = bar), text: human readable}
// Throws an Error with a plain-language message when the content is invalid.

const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
  '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 ' +
  '111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 ' +
  '141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 ' +
  '124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 ' +
  '311141 411131 211412 211214 211232 2331112').split(' ');

const widths = w => [...w].map((n, i) => (i % 2 ? '0' : '1').repeat(+n)).join('');

function code128(s) {
  if (!s) throw Error('Enter something to encode.');
  if (!/^[\x20-\x7e]*$/.test(s)) throw Error('Code 128 takes plain letters, digits and symbols (no accents or emoji).');
  const codes = [];
  const digitRun = i => { let n = 0; while (/\d/.test(s[i + n] || '')) n++; return n };
  let set = digitRun(0) >= 4 ? 'C' : 'B';
  codes.push(set === 'C' ? 105 : 104);
  for (let i = 0; i < s.length;) {
    if (set === 'B') {
      const run = digitRun(i);
      if (run >= 6 || (run >= 4 && i + run === s.length)) { set = 'C'; codes.push(99); continue }
      codes.push(s.charCodeAt(i) - 32); i++;
    } else {
      if (digitRun(i) >= 2) { codes.push(+s.substr(i, 2)); i += 2 }
      else { set = 'B'; codes.push(100) }
    }
  }
  codes.push(codes.reduce((a, c, i) => a + c * (i || 1), 0) % 103, 106);
  return { bits: codes.map(c => widths(C128[c])).join(''), text: s };
}

const C39 = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001', '5': '100110000', '6': '001110000',
  '7': '000100101', '8': '100100100', '9': '001100100', A: '100001001', B: '001001001', C: '101001000', D: '000011001',
  E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100', K: '100000011',
  L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110',
  S: '001000110', T: '000010110', U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
  Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000', '/': '010100010',
  '+': '010001010', '%': '000101010', '*': '010010100',
};
function code39(s) {
  s = s.toUpperCase();
  if (!s) throw Error('Enter something to encode.');
  if (!/^[0-9A-Z \-.$/+%]+$/.test(s)) throw Error('Code 39 takes letters, digits, spaces and - . $ / + %');
  const bits = [...('*' + s + '*')].map(ch => [...C39[ch]].map((w, i) => (i % 2 ? '0' : '1').repeat(w === '1' ? 3 : 1)).join('')).join('0');
  return { bits, text: s };
}

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map(c => [...c].map(b => b === '1' ? '0' : '1').join(''));
const G = R.map(c => [...c].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Accepts the number without its check digit (it is added) or with it (it is verified).
function withCheck(s, len, name) {
  if (!/^\d+$/.test(s) || (s.length !== len - 1 && s.length !== len)) throw Error(`${name} needs ${len - 1} or ${len} digits.`);
  const d = [...s.slice(0, len - 1)].map(Number);
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 ? 1 : 3), 0), c = (10 - sum % 10) % 10;
  if (s.length === len && +s[len - 1] !== c) throw Error(`${name} check digit should be ${c}.`);
  return s.slice(0, len - 1) + c;
}
function ean13(s) {
  s = withCheck(s, 13, 'EAN-13');
  const p = PARITY[+s[0]];
  let bits = '101';
  for (let i = 1; i < 7; i++) bits += (p[i - 1] === 'L' ? L : G)[+s[i]];
  bits += '01010';
  for (let i = 7; i < 13; i++) bits += R[+s[i]];
  return { bits: bits + '101', text: s };
}
function upca(s) {
  s = withCheck(s, 12, 'UPC-A');
  return { bits: ean13('0' + s).bits, text: s };
}
function ean8(s) {
  s = withCheck(s, 8, 'EAN-8');
  let bits = '101';
  for (let i = 0; i < 4; i++) bits += L[+s[i]];
  bits += '01010';
  for (let i = 4; i < 8; i++) bits += R[+s[i]];
  return { bits: bits + '101', text: s };
}

export const BARCODES = {
  c128: { name: 'Code 128', fn: code128, sample: 'PSF20-001' },
  c39: { name: 'Code 39', fn: code39, sample: 'PSF20' },
  ean13: { name: 'EAN-13', fn: ean13, sample: '400638133393' },
  upca: { name: 'UPC-A', fn: upca, sample: '03600029145' },
  ean8: { name: 'EAN-8', fn: ean8, sample: '9638507' },
};
export const barcode = (type, s) => (BARCODES[type] || BARCODES.c128).fn(String(s));
