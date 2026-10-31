export const COURTYARD = ["ashlar", "limestone", "brass", "zellige", "flagstone", "kilim", "velvet", "lantern", "contact", "moon"];
export const LANDSCAPE = ["strata", "meadow", "foliage", "bark", "ripples"];

export function prepareTextures(names = [...COURTYARD, ...LANDSCAPE]) {
  const pack = new Map();
  const waits = new Map();
  const settled = new Set();
  let worker = null;
  const settle = (name, images) => {
    settled.add(name);
    if (images) pack.set(name, images);
    for (const resolve of waits.get(name) || []) resolve();
    waits.delete(name);
  };
  const giveUp = () => {
    worker?.terminate();
    worker = null;
    for (const group of waits.values()) for (const resolve of group) resolve();
    waits.clear();
  };
  try {
    if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined") throw new Error("No worker canvas");
    worker = new Worker(new URL("./bake-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event) => settle(event.data.name, event.data.images);
    worker.onerror = giveUp;
    worker.postMessage(names);
  } catch {
    worker = null;
  }
  const pending = (name) => new Promise((resolve) => {
    if (settled.has(name) || !worker) resolve();
    else waits.set(name, [...(waits.get(name) || []), resolve]);
  });
  const ready = (list, onEach = () => {}) => Promise.all(list.map((name) => pending(name).then(onEach)));
  return { pack, ready };
}
