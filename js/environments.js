export const DAY_SECONDS = 96;
export const YEAR_SECONDS = 384;
export const REST_SECONDS = 42;

const DAY_AT = [0, 0.22, 0.5, 0.78, 1];
const YEAR_AT = [0, 0.18, 0.42, 0.62, 0.82, 1];

const DAY_ZENITH = [0x030919, 0x3f5f9c, 0x2f64aa, 0x3a3f78, 0x030919];
const DAY_HORIZON = [0x16324e, 0xf6cfae, 0xd4e5ee, 0xe7a07a, 0x16324e];
const DAY_GROUND = [0x0b1622, 0x7a6454, 0x5f7356, 0x5c463c, 0x0b1622];
const DAY_GLOW = [0x6e86b4, 0xffb070, 0xfff6dd, 0xff8a4a, 0x6e86b4];
const DAY_CLOUD = [0x243e58, 0xfbe6d4, 0xffffff, 0xf0c2a4, 0x243e58];
const DAY_COVER = [0.18, 0.15, 0.22, 0.22, 0.18];
const DAY_STARS = [1, 0.15, 0, 0.2, 1];
const DAY_SKY = [0x10283a, 0xdcc0a8, 0xc6dbe8, 0xc48a72, 0x10283a];
const DAY_FOG = [0.0046, 0.0036, 0.0032, 0.0038, 0.0046];
const DAY_EXPOSURE = [0.82, 1.05, 1.12, 0.98, 0.82];
const DAY_HEMI = [0.35, 1.05, 1.45, 0.9, 0.35];
const DAY_LAMP = [1, 0.35, 0, 0.55, 1];
const DAY_LIGHT = [0x8eafd4, 0xffc28b, 0xffeed2, 0xffb089, 0x8eafd4];

const YEAR_SNOW = [0.22, 0.02, 0, 0.05, 1, 0.22];
const YEAR_LEAF = [0x6d8f48, 0x4d6e3c, 0x3f6a34, 0x8a6a32, 0x8a8378, 0x6d8f48];
const YEAR_STEPPE = [0xf3efe4, 0xf6f3e6, 0xf4f1df, 0xe7d2a4, 0xf2f4f6, 0xf3efe4];
const YEAR_ROCK = [0xe7e2da, 0xece8e2, 0xe8e0d4, 0xe4d2c0, 0xe8e9ec, 0xe7e2da];
const YEAR_PLASTER = [0xe9ddc6, 0xe9ddc6, 0xf0e4cc, 0xf0d8b4, 0xeeebe4, 0xe9ddc6];
const YEAR_BRICK = [0xb07a5c, 0xb07a5c, 0xb07a5c, 0xc4815c, 0xc0988a, 0xb07a5c];
const YEAR_MUD = [0xb8926a, 0xb8926a, 0xc09a72, 0xc4a06a, 0xd9cfbf, 0xb8926a];
const YEAR_WATER = [0x3f6b74, 0x3a6d72, 0x2f6a78, 0x4a6258, 0x4a5d66, 0x3f6b74];

const TAU = Math.PI * 2;
const SUN_PALE = 0xfff1c4;
const SUN_WARM = 0xff9a4a;

let spanIndex = 0;
let spanT = 0;

function phaseOf(seconds, period) {
  const value = Number.isFinite(seconds) ? seconds : 0;
  return value / period - Math.floor(value / period);
}

function unit(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function span(stops, phase) {
  spanIndex = 0;
  const last = stops.length - 2;
  while (spanIndex < last && phase >= stops[spanIndex + 1]) spanIndex += 1;
  const width = stops[spanIndex + 1] - stops[spanIndex];
  spanT = width === 0 ? 0 : unit((phase - stops[spanIndex]) / width);
}

function mixHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function sampleHex(values) {
  return mixHex(values[spanIndex], values[spanIndex + 1], spanT);
}

function sampleNum(values) {
  return values[spanIndex] + (values[spanIndex + 1] - values[spanIndex]) * spanT;
}

export function writeCycle(seconds, out) {
  const day = phaseOf(seconds, DAY_SECONDS);
  const year = phaseOf(seconds, YEAR_SECONDS);
  out.day = day;
  out.year = year;
  span(DAY_AT, day);
  out.zenith = sampleHex(DAY_ZENITH);
  out.horizon = sampleHex(DAY_HORIZON);
  out.ground = sampleHex(DAY_GROUND);
  out.glow = sampleHex(DAY_GLOW);
  out.cloud = sampleHex(DAY_CLOUD);
  out.cover = sampleNum(DAY_COVER);
  out.stars = sampleNum(DAY_STARS);
  out.sky = sampleHex(DAY_SKY);
  out.fog = sampleNum(DAY_FOG);
  out.exposure = sampleNum(DAY_EXPOSURE);
  out.hemi = sampleNum(DAY_HEMI);
  out.lamp = sampleNum(DAY_LAMP);
  out.light = sampleHex(DAY_LIGHT);
  span(YEAR_AT, year);
  out.snow = sampleNum(YEAR_SNOW);
  out.leaf = sampleHex(YEAR_LEAF);
  out.steppe = sampleHex(YEAR_STEPPE);
  out.rock = sampleHex(YEAR_ROCK);
  out.plaster = sampleHex(YEAR_PLASTER);
  out.brick = sampleHex(YEAR_BRICK);
  out.mud = sampleHex(YEAR_MUD);
  out.water = sampleHex(YEAR_WATER);
  const lifted = Math.min(0.78, out.cover + 0.26);
  out.cover += (lifted - out.cover) * out.snow * 0.7;
  const angle = day * TAU;
  const elev = -Math.cos(angle);
  out.sunX = Math.sin(angle) * 78;
  out.sunY = elev * 46;
  out.sunZ = -58;
  out.moonX = -out.sunX;
  out.moonY = -out.sunY;
  out.moonZ = -62;
  const near = 1 - Math.min(1, Math.abs(elev) / 0.65);
  const gate = unit((elev + 0.45) / 0.4);
  out.sunColor = mixHex(SUN_PALE, SUN_WARM, near * gate);
  out.moonColor = 0xd7e4f6;
  return out;
}
