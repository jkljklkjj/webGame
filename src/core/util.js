export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

export function pad(str, n, ch = ' ') {
  str = String(str);
  while (str.length < n) str += ch;
  return str;
}

export function padStart(str, n, ch = ' ') {
  str = String(str);
  while (str.length < n) str = ch + str;
  return str;
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---- 显示宽度工具（中文占两格）----
import { strWidth } from './screen.js';

export { strWidth };

/** 按显示宽度右补空格 */
export function padW(str, w, ch = ' ') {
  str = String(str);
  let n = strWidth(str);
  while (n < w) { str += ch; n++; }
  return str;
}

/** 按显示宽度左补空格 */
export function padStartW(str, w, ch = ' ') {
  str = String(str);
  let n = strWidth(str);
  while (n < w) { str = ch + str; n++; }
  return str;
}

/** 按显示宽度截断，不会把宽字符切一半 */
export function truncW(str, w) {
  str = String(str);
  let out = '';
  let n = 0;
  for (const ch of str) {
    const cw = strWidth(ch);
    if (n + cw > w) break;
    out += ch;
    n += cw;
  }
  return out;
}
