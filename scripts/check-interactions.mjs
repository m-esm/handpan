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

const seekHandlers = {};
const seekInput = {
  setAttribute() {},
  addEventListener(type, handler) { seekHandlers[type] = handler; },
};
const seeks = [];
const seekContext = {
  document: { createElement: () => seekInput, querySelector: () => null },
  pattern: { loopBeats: 8 },
  events: [{ index: 0, beat: 0 }, { index: 1, beat: 2 }, { index: 2, beat: 7.5 }],
  t: key => key,
  followPaused: true,
  player: {
    playing: false,
    index: 0,
    seek(index, playing, silent) { seeks.push({ index, playing, silent }); this.index = index; },
  },
};
vm.runInNewContext(between(main, '  const seek = document.createElement("input");', '  const time = document.createElement("span");'), seekContext);
seekInput.value = "5.5";
seekHandlers.input();
assert.deepEqual(seeks.at(-1), { index: 2, playing: false, silent: true }, "scrubbing uses score time and stays silent while paused");
assert.equal(seekContext.followPaused, false, "seeking resumes score following");
seekContext.player.playing = true;
seekInput.value = "0";
seekHandlers.input();
assert.deepEqual(seeks.at(-1), { index: 0, playing: true, silent: true }, "seeking preserves playback");
let prevented = 0;
const seekKey = key => seekHandlers.keydown({ key, preventDefault() { prevented++; } });
seekKey("ArrowLeft");
assert.equal(seeks.at(-1).index, 0, "seek arrows must not wrap at the start");
seekKey("ArrowRight");
assert.equal(seeks.at(-1).index, 1);
seekKey("ArrowUp");
seekKey("ArrowRight");
assert.equal(seeks.at(-1).index, 2, "seek arrows must not wrap at the end");
seekKey("ArrowDown");
assert.equal(seeks.at(-1).index, 1);
seekKey("Tab");
assert.equal(prevented, 5, "unrelated keys retain native handling");

let fixedTransport = true;
let playing = false;
const body = { classList: { contains: () => playing } };
const controlBox = { top: 650, bottom: 780 };
const controls = { get parentElement() { return fixedTransport ? body : {}; }, getBoundingClientRect: () => controlBox };
const boundsContext = {
  document: {
    body,
    getElementById: () => ({ getBoundingClientRect: () => ({ top: -200, bottom: 1100 }) }),
    querySelector: selector => selector === ".pan-stick" ? { getBoundingClientRect: () => ({ bottom: 210 }) } : controls,
  },
  matchMedia: () => ({ matches: true }),
  window: { innerHeight: 800 },
};
vm.runInNewContext(between(main, "function scoreBounds()", "function pauseFollow("), boundsContext);
assert.equal(boundsContext.scoreBounds().top, 0, "a static pan must not reduce the score viewport");
assert.equal(boundsContext.scoreBounds().bottom, 650, "a floating player must not cover the current bar");
playing = true;
assert.equal(boundsContext.scoreBounds().top, 210, "the playing handpan reserves space above the score");
playing = false;
fixedTransport = false;
controlBox.top = 0;
controlBox.bottom = 130;
assert.equal(boundsContext.scoreBounds().top, 130, "a sticky desktop player reserves its full height");
assert.equal(boundsContext.scoreBounds().bottom, 800);

console.log("Interaction checks passed: blocked storage, held Space, native controls, practice pause, seeking and score visibility.");
