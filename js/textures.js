export const COURTYARD = ["ashlar", "limestone", "brass", "zellige", "flagstone", "kilim", "velvet", "lantern", "contact", "moon"];
export const LANDSCAPE = ["strata", "meadow", "foliage", "bark", "ripples"];

export function prepareTextures(names = [...COURTYARD, ...LANDSCAPE]) {
  const pack = new Map();
  const waits = new Map();
  let worker = null;
  const settle = (name, images) => {
    if (images) pack.set(name, images);
    waits.get(name)?.();
    waits.delete(name);
  };
  const giveUp = () => {
    worker?.terminate();
    worker = null;
    for (const resolve of waits.values()) resolve();
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
    if (pack.has(name) || !worker) resolve();
    else waits.set(name, resolve);
  });
  const ready = (list, onEach = () => {}) => Promise.all(list.map((name) => pending(name).then(onEach)));
  return { pack, ready };
}
