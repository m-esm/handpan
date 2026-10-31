import assert from "node:assert/strict";
import { prepareTextures } from "../js/textures.js";
import { bake } from "../js/bake.js";

let worker;
globalThis.OffscreenCanvas = class {};
globalThis.Worker = class {
  constructor() { worker = this; }
  postMessage() {}
  terminate() { this.terminated = true; }
};

async function resolved(promise) {
  let ready = false;
  promise.then(() => { ready = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, true, "texture readiness must settle after worker completion or failure");
}

{
  const textures = prepareTextures(["ashlar"]);
  const first = textures.ready(["ashlar"]);
  const second = textures.ready(["ashlar"]);
  worker.onmessage({ data: { name: "ashlar", images: null } });
  await resolved(Promise.all([first, second]));
}

for (const beforeReady of [true, false]) {
  for (const images of [null, { map: {} }]) {
    const textures = prepareTextures(["ashlar"]);
    const finish = () => worker.onmessage({ data: { name: "ashlar", images } });
    if (beforeReady) finish();
    let completed = 0;
    const ready = textures.ready(["ashlar"], () => completed++);
    if (!beforeReady) finish();
    await resolved(ready);
    assert.equal(completed, 1);
    assert.equal(textures.pack.has("ashlar"), !!images);
    if (images) assert.equal(textures.pack.get("ashlar"), images);
    await resolved(textures.ready(["ashlar"]));
  }
}

const failed = prepareTextures(["ashlar"]);
const pending = failed.ready(["ashlar"]);
worker.onerror();
assert.equal(worker.terminated, true);
await resolved(pending);
await resolved(failed.ready(["ashlar"]));
delete globalThis.Worker;
await resolved(prepareTextures(["ashlar"]).ready(["ashlar"]));

let canvases = 0;
class Canvas {
  constructor() { canvases++; }
  getContext(type) {
    assert.equal(type, "2d");
    return {
      fillRect() {},
      getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4) }),
    };
  }
}
globalThis.document = { createElement(tag) { assert.equal(tag, "canvas"); return new Canvas(); } };
const contact = bake("contact").map;
assert.equal(canvases, 1, "main-thread baking must create a DOM canvas without recursion");
assert.equal(contact.width, 128);
assert.equal(contact.height, 128);
assert.equal(contact.data.length, 128 * 128 * 4);
assert.equal(contact.wrap, "clamp");
delete globalThis.document;
globalThis.OffscreenCanvas = Canvas;
assert.deepEqual(bake("contact").map, contact);
assert.equal(canvases, 2);
console.log("Texture checks passed: early and late success/failure, repeated readiness, worker errors, unsupported worker fallback and DOM/worker canvas baking.");
