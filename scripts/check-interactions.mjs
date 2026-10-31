import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createGame } from "../js/game.js";

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Could not locate ${start}`);
  return source.slice(from, to);
}

const main = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
const blockedStorage = { createGame, assert };
Object.defineProperty(blockedStorage, "localStorage", { get() { throw new Error("Storage access denied"); } });
vm.runInNewContext(`${between(main, "const game = ", "\nconst POP_MS")}
game.strike({ id: "D3", quality: 1, miss: false });
assert.equal(game.snapshot().best, 1);
`, blockedStorage);
let keydown;
let toggles = 0;
let practicePauses = 0;
const keyboard = {
  window: { addEventListener(type, handler) { assert.equal(type, "keydown"); keydown = handler; } },
  document: {
    body: { classList: { contains: () => false } },
    getElementById: () => ({ click() { toggles++; } }),
  },
  practice: null,
  pausePractice() { practicePauses++; },
};
vm.runInNewContext(between(main, 'window.addEventListener("keydown",', '\nconst MIC_KEY'), keyboard);
function press(repeat, closest = () => null) {
  keydown({ code: "Space", repeat, target: { closest }, preventDefault() {} });
}
press(false);
press(true);
press(true);
assert.equal(toggles, 1, "holding Space must toggle transport only once");
press(false);
assert.equal(toggles, 2, "a new Space press must still toggle transport");
press(false, selector => selector.includes("button") ? {} : null);
press(false, selector => selector.includes("input") ? {} : null);
assert.equal(toggles, 2, "native controls must retain their Space handling");
keyboard.practice = {};
press(false);
press(true);
assert.equal(practicePauses, 1);

const scene = await readFile(new URL("../js/scene.js", import.meta.url), "utf8");
for (const cancel of [false, true]) {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const scope = {
    VIEWS: { dawn: {}, courtyard: {} },
    viewKey: "courtyard",
    wantedKey: "courtyard",
    landscape: null,
    landscapeReady: ready,
  };
  scope.ensureLandscape = () => { scope.landscape = {}; };
  vm.createContext(scope);
  vm.runInContext(between(scene, "  function environment(key) {", '  document.addEventListener("alamut-explore"'), scope);
  scope.environment("dawn");
  if (cancel) scope.environment("courtyard");
  const applied = [];
  scope.environment = key => applied.push(key);
  release();
  await ready;
  assert.deepEqual(applied, cancel ? [] : ["dawn"], "a deferred landscape must respect the latest selection");
}
console.log("Interaction checks passed: blocked storage, held Space, native controls, practice pause and deferred landscape cancellation.");
