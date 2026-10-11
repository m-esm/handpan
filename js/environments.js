export const VIEWS = {
  courtyard: { name: "The lantern courtyard", sky: 0x142c3c, eye: [1, 4.2, 15], target: [1, 5.5, -20] },
  dawn: { name: "Alamut · Eagle’s ridge", sky: 0xa28b7e, eye: [26, 12, 38], target: [-4, 12, -28] },
  valley: { name: "Alamut · The green valley", sky: 0x779baf, eye: [-28, 9, 30], target: [3, 8, -32] },
  lake: { name: "Alamut · Moonwater", sky: 0x132f49, eye: [0, 6, 42], target: [5, 9, -28] },
  winter: { name: "Alamut · Winter silence", sky: 0x859bad, eye: [20, 18, 22], target: [-6, 13, -40] },
  storm: { name: "Alamut · Before the rain", sky: 0x384953, eye: [-30, 13, 26], target: [0, 14, -32] },
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

