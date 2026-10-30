export const VIEWS = {
  courtyard: { name: "The lantern courtyard", sky: 0x17324a, eye: [1, 4.2, 15], target: [1, 5.5, -20], zenith: 0x040a18, horizon: 0x1c3a52, ground: 0x0b1318, glow: 0x6d86b0, cloud: 0x2a3d52, cover: 0.32, stars: 1 },
  dawn: { name: "Alamut · Eagle’s ridge", sky: 0xd9a487, eye: [26, 12, 38], target: [-4, 12, -28], zenith: 0x4f6690, horizon: 0xefb48e, ground: 0x6b5448, glow: 0xffa860, cloud: 0xf4c4a4, cover: 0.46, stars: 0 },
  valley: { name: "Alamut · The green valley", sky: 0xb7d0de, eye: [-28, 9, 30], target: [3, 8, -32], zenith: 0x3a72b0, horizon: 0xc4dae6, ground: 0x5f7356, glow: 0xfff0cc, cloud: 0xfdfcf8, cover: 0.4, stars: 0 },
  lake: { name: "Alamut · Moonwater", sky: 0x1d3c5a, eye: [0, 6, 42], target: [5, 9, -28], zenith: 0x030919, horizon: 0x1f4466, ground: 0x0b1622, glow: 0x88a2cf, cloud: 0x2a4462, cover: 0.3, stars: 1 },
  winter: { name: "Alamut · Winter silence", sky: 0xb4c2cd, eye: [20, 18, 22], target: [-6, 13, -40], zenith: 0x71889e, horizon: 0xc6d1da, ground: 0x9aa7b0, glow: 0xf3f6ff, cloud: 0xdce2e9, cover: 0.68, stars: 0 },
  storm: { name: "Alamut · Before the rain", sky: 0x56656b, eye: [-30, 13, 26], target: [0, 14, -32], zenith: 0x222c35, horizon: 0x5f6e73, ground: 0x2a3236, glow: 0xa7b6bd, cloud: 0x48545a, cover: 0.86, stars: 0 },
};

export function viewFor(id) {
  if (!id) return "courtyard";
  if (/rain|storm|shout|runaway/.test(id)) return "storm";
  if (/light|sun|bright|fire/.test(id)) return "dawn";
  if (/night|tide|cradle|train/.test(id)) return "lake";
  const keys = Object.keys(VIEWS);
  const seed = [...id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
  return keys[seed % keys.length];
}

