/**
 * detector.ts — ตรวจจับแบนเนอร์ "MISSION START" (พอร์ตจาก dragonica-project)
 * framework-free ใช้ได้ทั้งหน้าเว็บและ Web Worker
 */
export const MASK_W = 96;
export const MASK_H = 36;
export const MASK_N = MASK_W * MASK_H;
export const TPL_ASPECT = 470 / 180;
export const COARSE_CUTOFF = 110;
export const SEARCH_W = 960;

export type Region = { x: number; y: number; w: number; h: number };
export type Mask = { data: Uint8Array; w: number; h: number; n: number };
export type Template = { on: Mask; off: Mask; cOn: Mask; cOff: Mask };

const TPL_ON =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA6O8cGHwQODAQAAAA7O+eOP8YeDAQAAAA/PnXPOeY/HAQAAAI/PHDDAHMzHAQAAAI3HHHDADMzHAAAAgM3m+PBBDszOAAAAgG3n8MFDBszMAAAAgD1jwAFnBu5sAAAAwDhzwAFnBmd8AAAAwJhzxwxznmN4AAAAwIgz//wx/HF4AAAAYIAxfvgw+DA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHz4DwTwAAAAAAAAAP/8Hwb4j/8BAAAAgP/8Dwb43/8BAAAAgOPhAQ8cHBwAAAAAwMHggA8cHAwAAAAAwAHggA8cHA4AAAAAwANgwA0cHA4AAAAAwB9w4AwcDwYAAAAAgD9wYBz+BwYAAAAAAHwwcBz+AwcAAAAAAHg4+B/+AAMAAAAAAHA4/B/mAAMAAAAAOHAYHDznAAMAAAAAeDgYDjjngQEAAAAA8D8cDzjHgQEAAAAA8B8MBzjDgwEAAAAAwAMMAAACAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TPL_OFF =
  "//////////////////////////////////////////////////FxDj54Pvx8/v////ExBhxwDnh8/v////AwYowxhnA4/v///3Aw488/4zM4/v///3I4448/8zM4////fzIZBw8W8TMR////f5IYDz4Y8TMT////f8KcP/6Y+RED////P8eMP/6Y+ZiD////P2eMOPOMYZyH////P3fMAAPOA46H////n3/OgQfPB8/H/////////////////////////////////////////4MH8PsP/P///////wAD4PkHcAD+////fwAD8PkHIAD+////fxwe/vDj4+P/////Pz4ff/Dj4/P/////P/4ff/Dj4/H/////P/yfP/Lj4/H/////P+CPH/Pj8Pn/////f8CPn+MB+Pn//////4PPj+MB/Pj//////4fHB+AB//z//////4/HA+AZ//z/////x4/n48MY//z/////h8fn8ccYfv7/////D8Dj8Mc4fv7/////D+Dz+Mc8fP7/////P/zz///9/f//////////////////////////////////";

function unpack(b64: string): Mask {
  const bin = atob(b64);
  const data = new Uint8Array(MASK_N);
  let n = 0;
  for (let i = 0; i < MASK_N; i++) {
    const bit = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
    data[i] = bit;
    n += bit;
  }
  return { data, w: MASK_W, h: MASK_H, n };
}

function subsample(mask: Mask, step: number): Mask {
  const w = Math.floor(mask.w / step);
  const h = Math.floor(mask.h / step);
  const data = new Uint8Array(w * h);
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = mask.data[y * step * mask.w + x * step];
      data[y * w + x] = v;
      n += v;
    }
  return { data, w, h, n };
}

export function buildTemplate(): Template {
  const on = unpack(TPL_ON);
  const off = unpack(TPL_OFF);
  return { on, off, cOn: subsample(on, 3), cOff: subsample(off, 3) };
}

export function toGray(rgba: Uint8ClampedArray, out: Uint8Array): Uint8Array {
  for (let i = 0; i < out.length; i++) {
    const p = i * 4;
    out[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) | 0;
  }
  return out;
}

export function scoreMask(gray: Uint8Array, on: Mask, off: Mask, cutoff: number): number {
  let onHit = 0, offHit = 0;
  for (let i = 0; i < gray.length; i++) {
    const lit = gray[i] >= cutoff;
    if (on.data[i] && lit) onHit++;
    if (off.data[i] && !lit) offHit++;
  }
  return (onHit / on.n) * (offHit / off.n);
}

function scoreBox(gray: Uint8Array, gw: number, ox: number, oy: number, bw: number, bh: number, on: Mask, off: Mask, cutoff: number): number {
  const tw = on.w, th = on.h, onD = on.data, offD = off.data;
  let onHit = 0, offHit = 0;
  for (let ty = 0; ty < th; ty++) {
    const row = (((oy + ((ty + 0.5) * bh) / th) | 0) * gw) | 0;
    const trow = ty * tw;
    for (let tx = 0; tx < tw; tx++) {
      const gx = (ox + ((tx + 0.5) * bw) / tw) | 0;
      const lit = gray[row + gx] >= cutoff ? 1 : 0;
      const i = trow + tx;
      if (onD[i] && lit) onHit++;
      if (offD[i] && !lit) offHit++;
    }
  }
  return (onHit / on.n) * (offHit / off.n);
}

export function searchGray(gray: Uint8Array, sw: number, sh: number, cutoff: number, tpl: Template): { score: number; region: Region } | null {
  let best = { s: -1, x: 0, y: 0, w: 0, h: 0 };
  for (let bw = 80; bw <= 340; bw = Math.round(bw * 1.12)) {
    const bh = bw / TPL_ASPECT;
    if (bh >= sh) break;
    for (let oy = 0; oy + bh <= sh; oy += 5)
      for (let ox = 0; ox + bw <= sw; ox += 5) {
        const s = scoreBox(gray, sw, ox, oy, bw, bh, tpl.cOn, tpl.cOff, COARSE_CUTOFF);
        if (s > best.s) best = { s, x: ox, y: oy, w: bw, h: bh };
      }
  }
  if (best.s < 0) return null;

  let fine = { s: -1, x: best.x, y: best.y, w: best.w, h: best.h };
  for (let f = 0.88; f <= 1.13; f += 0.04) {
    const bw = best.w * f;
    const bh = bw / TPL_ASPECT;
    for (let oy = best.y - 6; oy <= best.y + 6; oy++)
      for (let ox = best.x - 6; ox <= best.x + 6; ox++) {
        if (ox < 0 || oy < 0 || ox + bw > sw || oy + bh > sh) continue;
        const s = scoreBox(gray, sw, ox, oy, bw, bh, tpl.on, tpl.off, cutoff);
        if (s > fine.s) fine = { s, x: ox, y: oy, w: bw, h: bh };
      }
  }
  return {
    score: fine.s,
    region: { x: (fine.x / sw) * 100, y: (fine.y / sh) * 100, w: (fine.w / sw) * 100, h: (fine.h / sh) * 100 },
  };
}
