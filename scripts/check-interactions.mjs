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
let exploring = false;
const keyboard = {
  window: { addEventListener(type, handler) { assert.equal(type, "keydown"); keydown = handler; } },
  document: {
    body: { classList: { contains: (name) => exploring && name === "is-exploring" } },
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
exploring = true;
press(false);
press(true);
assert.equal(toggles, 2, "explore mode must not toggle transport");
assert.equal(practicePauses, 1, "explore mode must not pause practice");
exploring = false;

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

for (const active of ["play", "learn"]) {
  const node = tag => ({
    tag,
    children: [],
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    addEventListener() {},
  });
  const head = node("div");
  vm.runInNewContext(between(main, '  const modes = document.createElement("nav");', '  const warn = document.createElement("p");'), {
    document: { createElement: node },
    head,
    practice: active === "learn" ? {} : null,
    pattern: { id: "sample-piece" },
    t: key => key,
    controlIcon: () => node("svg"),
  });
  const modes = head.children[0];
  assert.equal(modes.attributes["aria-label"], "piece.mode");
  assert.equal(modes.children.length, 3, "Play, Learn and Share remain available");
  for (const [index, mode] of ["play", "learn"].entries()) {
    const link = modes.children[index];
    assert.equal(link.tag, "a");
    assert.equal(link.textContent, mode, "both modes have visible translated labels");
    assert.equal(link.href, `#/p/sample-piece/${mode}`, "switching modes preserves the piece");
    assert.equal(link.attributes["aria-current"], mode === active ? "page" : undefined);
  }
}

console.log("Interaction checks passed: blocked storage, held Space, native controls, practice pause, seeking, score visibility and labeled mode navigation.");
const explore = await readFile(new URL("../js/explore.js", import.meta.url), "utf8");
const i18n = await readFile(new URL("../js/i18n.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/app.css", import.meta.url), "utf8");
assert.match(html, /id="explore-world"/, "Explore control is in the tools");
assert.match(html, /data-i18n="explore"/, "Explore has an accessible label");
assert.match(explore, /exitPointerLock/, "closing must drop pointer lock");
assert.match(explore, /removeEventListener/, "closing must drop flight listeners");
assert.match(explore, /cancelAnimationFrame/, "closing must drop the flight loop");
assert.match(explore, /pointerdown/, "touch pads bind press, not hover");
assert.match(explore, /aria-modal/, "Explore is a modal dialog");
assert.match(css, /body\.is-exploring \.wrap/, "Explore hides the practice UI");
assert.match(css, /overflow-x: hidden/, "Explore HUD must not overflow sideways");
assert.doesNotMatch(css, /\.explore-stick:hover/, "touch pads must not rely on hover");
for (const key of ["explore", "explore.eyebrow", "explore.title", "explore.controls", "explore.controlsTouch", "explore.return", "explore.move", "explore.look", "explore.rise", "explore.sink"]) {
  assert.equal([...i18n.matchAll(new RegExp(`"${key}":`, "g"))].length, 2, `${key} needs English and Persian`);
}
const flightScope = {};
vm.runInNewContext(`${between(explore, "const KEY_X =", "\nfunction releaseCapture")}\nthis.move = flightMove(new Set(["KeyW", "KeyD"]), { x: 0, z: 0 }, 0);\nthis.still = flightMove(new Set(), { x: 0, z: 0 }, 0);\nthis.lift = flightMove(new Set(["Space"]), { x: 0.2, z: 0 }, 0);\nthis.back = flightMove(new Set(["KeyS", "ArrowDown"]), { x: 0, z: 0 }, 0);\n`, flightScope);
assert.ok(Math.abs(Math.hypot(flightScope.move.x, flightScope.move.z) - 1) < 1e-9, "diagonal flight is normalized");
assert.equal(flightScope.still.x, 0);
assert.equal(flightScope.still.y, 0);
assert.equal(flightScope.still.z, 0);
assert.equal(flightScope.lift.y, 1);
assert.equal(flightScope.back.z, -1, "S and down move backward");

assert.doesNotMatch(explore, /innerHTML/, "Explore copy is assigned as text and accessible names");

function listenerTarget() {
  const map = new Map();
  return {
    addEventListener(type, handler) {
      const list = map.get(type);
      if (list) list.push(handler);
      else map.set(type, [handler]);
    },
    removeEventListener(type, handler) {
      map.set(type, (map.get(type) || []).filter((item) => item !== handler));
    },
    handlers(type) {
      return [...(map.get(type) || [])];
    },
  };
}

function matches(node, selector) {
  return selector.split(",").some((part) => {
    const token = part.trim();
    if (token.startsWith(".")) return node.className.split(/\s+/).includes(token.slice(1));
    if (token.startsWith("#")) return node.id === token.slice(1);
    if (token.startsWith("[") && token.endsWith("]")) {
      const body = token.slice(1, -1);
      const eq = body.indexOf("=");
      const name = eq === -1 ? body : body.slice(0, eq);
      const raw = eq === -1 ? null : body.slice(eq + 1).replace(/^["']|["']$/g, "");
      return raw === null ? Object.hasOwn(node.attrs, name) : node.attrs[name] === raw;
    }
    return node.tag === token;
  });
}

function queryAll(root, selector) {
  const found = [];
  for (const child of root.children) {
    if (matches(child, selector)) found.push(child);
    found.push(...queryAll(child, selector));
  }
  return found;
}

function findId(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findId(child, id);
    if (found) return found;
  }
  return null;
}

function createElement(tag, active) {
  const events = listenerTarget();
  const node = {
    tag,
    id: "",
    className: "",
    hidden: false,
    textContent: "",
    isConnected: true,
    type: "",
    children: [],
    parent: null,
    attrs: {},
    dataset: {},
    style: {},
    addEventListener: events.addEventListener,
    removeEventListener: events.removeEventListener,
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name === "id") this.id = String(value);
      if (name.startsWith("data-")) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[key] = String(value);
      }
    },
    getAttribute(name) {
      return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
    },
    append(...nodes) {
      for (const child of nodes) {
        child.parent = this;
        this.children.push(child);
      }
    },
    focus() { active.current = this; },
    closest(selector) {
      let cursor = this;
      while (cursor) {
        if (matches(cursor, selector)) return cursor;
        cursor = cursor.parent;
      }
      return null;
    },
    contains(other) {
      if (other === this) return true;
      return this.children.some((child) => child.contains(other));
    },
    querySelector(selector) { return queryAll(this, selector)[0] ?? null; },
    querySelectorAll(selector) { return queryAll(this, selector); },
    setPointerCapture() {},
    releasePointerCapture() {},
    getClientRects() { let item = this; while (item) { if (item.hidden) return []; item = item.parent; } return [{}]; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
  };
  node.classList = {
    add(name) {
      const names = new Set(node.className.split(/\s+/).filter(Boolean));
      names.add(name);
      node.className = [...names].join(" ");
    },
    remove(name) {
      node.className = node.className.split(/\s+/).filter((item) => item && item !== name).join(" ");
    },
    contains(name) { return node.className.split(/\s+/).includes(name); },
  };
  return node;
}

function verifyExplore(source, coarse) {
  const english = {
    "explore.eyebrow": "EN eyebrow",
    "explore.title": "EN title",
    "explore.controls": "EN keys",
    "explore.controlsTouch": "EN touch",
    "explore.return": "EN return",
    "explore.move": "EN move",
    "explore.look": "EN look",
    "explore.rise": "EN rise",
    "explore.sink": "EN sink",
  };
  const persian = {
    "explore.eyebrow": "FA eyebrow",
    "explore.title": "FA title",
    "explore.controls": "FA keys",
    "explore.controlsTouch": "FA touch",
    "explore.return": "FA return",
    "explore.move": "FA move",
    "explore.look": "FA look",
    "explore.rise": "FA rise",
    "explore.sink": "FA sink",
  };
  let table = english;
  const moves = [];
  let pending = null;
  const active = { current: null };
  const body = createElement("body", active);
  const entry = createElement("button", active);
  entry.id = "explore-world";
  const wrap = createElement("div", active);
  wrap.className = "wrap";
  body.append(entry, wrap);
  active.current = entry;
  const windowBox = listenerTarget();
  const document = {
    body,
    hidden: false,
    pointerLockElement: null,
    get activeElement() { return active.current; },
    set activeElement(value) { active.current = value; },
    exitPointerLock() {},
    createElement(tag) { return createElement(tag, active); },
    getElementById(id) { return findId(body, id); },
    querySelector(selector) { return queryAll(body, selector)[0] ?? null; },
    addEventListener: listenerTarget().addEventListener,
    removeEventListener: listenerTarget().removeEventListener,
  };
  const documentEvents = listenerTarget();
  document.addEventListener = documentEvents.addEventListener;
  document.removeEventListener = documentEvents.removeEventListener;
  const sandbox = {
    exploreT: (key) => table[key],
    matchMedia: () => ({ matches: coarse }),
    requestAnimationFrame(fn) { pending = fn; return 1; },
    cancelAnimationFrame() { pending = null; },
    document,
    window: windowBox,
    scene: {
      fly() {},
      steer(move) { moves.push(move); },
    },
  };
  vm.runInNewContext(`${source}\nthis.api = initExplore({ world: () => this.scene });`, sandbox);
  const hud = document.getElementById("explore-hud");
  const title = hud.querySelector("#explore-title");
  const described = hud.querySelector("#explore-description");
  assert.equal(title.textContent, "EN title");
  table = persian;
  assert.equal(title.textContent, "EN title", "changing language leaves the closed overlay unchanged");
  sandbox.api.open();
  assert.equal(title.textContent, "FA title", "opening Explore paints the current language");
  assert.equal(hud.querySelector(".explore-eyebrow").textContent, "FA eyebrow");
  assert.equal(described.textContent, coarse ? "FA touch" : "FA keys");
  assert.equal(hud.querySelector(".explore-return").textContent, "FA return");
  assert.equal(hud.querySelector(".explore-rise").textContent, "FA rise");
  assert.equal(hud.querySelector(".explore-sink").textContent, "FA sink");
  assert.equal(hud.querySelector('[data-stick="move"]').getAttribute("aria-label"), "FA move");
  assert.equal(hud.querySelector('[data-stick="look"]').getAttribute("aria-label"), "FA look");
  table = english;
  assert.equal(title.textContent, "FA title", "labels stay until the next open");
  sandbox.api.close();
  sandbox.api.open();
  assert.equal(title.textContent, "EN title");
  assert.equal(hud.querySelector(".explore-return").textContent, "EN return");
  assert.equal(hud.querySelector('[data-stick="look"]').getAttribute("aria-label"), "EN look");
  assert.equal(hud.getAttribute("tabindex"), "-1", "the dialog is programmatically focusable");
  assert.equal(document.activeElement, hud, "opening Explore focuses the dialog");
  if (coarse) return;
  function pump() {
    const fn = pending;
    assert.ok(fn, "a flight frame is scheduled");
    pending = null;
    fn();
  }
  function press(code, target, type = "keydown") {
    const event = {
      key: code === "Space" ? " " : code,
      code,
      type,
      target,
      shiftKey: false,
      prevented: false,
      stopped: false,
      preventDefault() { event.prevented = true; },
      stopPropagation() { event.stopped = true; },
    };
    for (const handler of windowBox.handlers(type)) handler(event);
    return event;
  }
  pump();
  const stick = hud.querySelector('[data-stick="move"]');
  const back = hud.querySelector(".explore-return");
  const dialogRise = press("Space", document.activeElement);
  assert.equal(document.activeElement, hud, "Space keeps focus on the dialog");
  assert.equal(dialogRise.prevented, true, "Space rises when the dialog itself is focused");
  assert.equal(dialogRise.stopped, true);
  pump();
  assert.equal(moves.at(-1).y, 1, "Space on the dialog rises");
  assert.equal(hud.hidden, false, "Space on the dialog must not activate Return");
  press("Space", hud, "keyup");
  pump();
  assert.equal(moves.at(-1).y, 0);
  const intoReturn = press("Tab", hud);
  assert.equal(intoReturn.prevented, true, "Tab from the dialog moves to Return");
  assert.equal(document.activeElement, back);
  const wrapReturn = press("Tab", back);
  assert.equal(wrapReturn.prevented, true, "Tab stays in the dialog when touch controls are hidden");
  assert.equal(document.activeElement, back);
  const rising = press("Space", stick);
  assert.equal(rising.prevented, true, "Space rises when no button is focused");
  assert.equal(rising.stopped, true);
  pump();
  assert.equal(moves.at(-1).y, 1);
  press("Space", stick, "keyup");
  pump();
  assert.equal(moves.at(-1).y, 0);
  const native = press("Space", back);
  assert.equal(native.prevented, false, "Space on the focused Return button keeps native activation");
  assert.equal(native.stopped, false);
  pump();
  assert.equal(moves.at(-1).y, 0, "Space on the focused Return button must not rise");
  const climb = press("ArrowUp", back);
  assert.equal(climb.prevented, true, "arrow keys still fly while Return is focused");
  pump();
  assert.equal(moves.at(-1).z, 1);
  assert.equal(moves.at(-1).y, 0);
  press("ArrowUp", back, "keyup");
}

const exploreProgram = explore
  .replace('import { t } from "./i18n.js";', "const t = (key) => exploreT(key);")
  .replace("export function initExplore", "function initExplore");
assert.match(exploreProgram, /function initExplore/);
assert.doesNotMatch(exploreProgram, /^export |^import /m);
verifyExplore(exploreProgram, false);
verifyExplore(exploreProgram, true);

console.log("Interaction checks passed: blocked storage, held Space, native controls, practice pause, seeking, score visibility, explore flight, language refresh, dialog focus and Return Space.");
