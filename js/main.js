import {
  NOTES,
  FIELDS,
  SIDE,
  PATTERNS,
  TAK,
  eventsOf,
  sheetOf,
  stepsOf,
  beatLabel,
  pretty,
  numberOf,
} from "./score.js";
import { createAudio } from "./sound.js";
import { createPlayer } from "./play.js";
import { createListener, accepts } from "./listen.js";
import { VIEWS, viewFor } from "./environments.js";
import { initExplore } from "./explore.js";
import { initMotion } from "./motion.js";

const audio = createAudio();
document.getElementById("pan").addEventListener("pointerup", (event) => {
  if (event.pointerType !== "mouse" && audio.ready()) audio.resume().catch(audioError);
});
let mirrored = false;
try {
  mirrored = localStorage.getItem("disc-kurd-mirror") === "1";
} catch (err) {
  void err;
}

const caption = () => document.getElementById("caption");
const KIND_ORDER = ["Pieces", "Hands", "Chords", "Grooves"];
const KIND_NOTE = {
  Hands: "Two hands trading, which is how this pan is played.",
  Chords: "Two notes at once. One hand each.",
  Grooves: "A short loop you can keep going.",
  Pieces: "Whole pieces with parts. A bass note, then a tune over it.",
};
let query = "";
let kindFilter = "All";
let lastScroll = -2;
let settled = false;
let lastListed = "";
let routed = null;
let stage = null;
let sceneLoadCancelled = false;
let sceneChoice = "auto";
let lastEnvironment = "";

const sceneSelect = document.getElementById("environment");
for (const [key, view] of Object.entries(VIEWS)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = view.name;
  sceneSelect.append(option);
}
sceneSelect.addEventListener("change", () => {
  sceneChoice = sceneSelect.value;
  paint(player.snapshot());
});

const toolsToggle = document.getElementById("tools-toggle");

function setTools(open) {
  document.body.classList.toggle("tools-open", open);
  toolsToggle.setAttribute("aria-expanded", String(open));
}

toolsToggle.addEventListener("click", () => setTools(!document.body.classList.contains("tools-open")));
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#tools, #tools-toggle")) setTools(false);
});
document.getElementById("explore-world").addEventListener("click", () => setTools(false));

function finishLoading(message = "") {
  const focusLoader = document.getElementById("scene-loader").contains(document.activeElement);
  document.querySelector(".wrap").removeAttribute("inert");
  document.getElementById("scene-loader").hidden = true;
  document.getElementById("pan").setAttribute("aria-busy", "false");
  const notice = document.getElementById("scene-notice");
  notice.textContent = message;
  notice.hidden = !message;
  if (focusLoader) document.querySelector(".brand").focus({ preventScroll: true });
}

document.getElementById("simple-view").addEventListener("click", () => {
  sceneLoadCancelled = true;
  finishLoading("Simple view. All notes and learning tools are ready.");
});

const player = createPlayer(audio, paint);
const listener = createListener(onHeard, onMicEnded);
const HEARD_MS = 450;
const TAP_DEAF_MS = 500;
let heard = null;
let heardTimer = 0;
let deafUntil = 0;
let micNote = "";

function pitched(notes) {
  return notes.filter((id) => id !== TAK);
}

function skipTaks() {
  for (let n = 0; n < 16 && pitched(player.snapshot().notes).length === 0; n += 1) player.step(1, true);
}

function onHeard(found) {
  if (player.playing || performance.now() < deafUntil) return;
  let id = found.id;
  let miss = false;
  if (patternFromHash() && player.pattern) {
    skipTaks();
    const wanted = pitched(player.snapshot().notes);
    if (accepts(found, wanted)) {
      if (!wanted.includes(id)) id = wanted[0];
      player.step(1, true);
      skipTaks();
    } else {
      miss = true;
    }
  }
  heard = { id, miss };
  clearTimeout(heardTimer);
  heardTimer = setTimeout(() => {
    heard = null;
    player.refresh();
  }, HEARD_MS);
  player.refresh();
}

function flipHand(hand) {
  if (!mirrored || !hand) return hand;
  if (hand === "left") return "right";
  if (hand === "right") return "left";
  return hand;
}

function spokenName(id) {
  if (id === TAK) return "tak";
  const ding = id === "D3" ? ", the ding" : "";
  return `${numberOf(id)}, ${pretty(id)}${ding}`;
}

function dimpleLabel(id) {
  return `${spokenName(id)}, ${flipHand(SIDE[id])} hand`;
}

function place(deg, orbit) {
  const shown = mirrored ? (360 - deg) % 360 : deg;
  const math = (shown * Math.PI) / 180 - Math.PI / 2;
  return [210 + Math.cos(math) * orbit, 210 + Math.sin(math) * orbit];
}

function fieldMarkup(id, x, y, radius, ding) {
  const nameSize = ding ? 50 : 30;
  const hand = flipHand(SIDE[id]);
  return `<g class="field hand-${hand}${ding ? " ding" : ""}" data-note="${id}" role="button" tabindex="0" transform="translate(${x} ${y})" aria-label="${dimpleLabel(id)}">
    <circle class="field-shade" r="${radius}" fill="url(#dimple)"></circle>
    <circle class="field-face" r="${radius * 0.72}" fill="#4e3b2e"></circle>
    <text class="field-name" style="font-size:${nameSize}px">${numberOf(id)}</text>
  </g>`;
}

function drawPan() {
  const canvas = document.querySelector("#pan .pan-3d");
  const ring = ["A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "C5"]
    .map((id) => {
      const field = FIELDS.find((item) => item.id === id);
      const [x, y] = place(field.deg, 122);
      return fieldMarkup(id, x, y, 30, false);
    })
    .join("");
  const ding = fieldMarkup("D3", 210, 210, 54, true);
  document.getElementById("pan").innerHTML = `<svg class="pan-svg" viewBox="0 0 420 420" role="group" aria-label="Handpan, ten notes">
    <defs>
      <radialGradient id="shell" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="#e0b27a"/>
        <stop offset="22%" stop-color="#b5753f"/>
        <stop offset="58%" stop-color="#6d4426"/>
        <stop offset="100%" stop-color="#24160f"/>
      </radialGradient>
      <radialGradient id="dimple" cx="40%" cy="34%" r="72%">
        <stop offset="0%" stop-color="#4e3b2c"/>
        <stop offset="58%" stop-color="#241910"/>
        <stop offset="100%" stop-color="#120d0a"/>
      </radialGradient>
      <radialGradient id="dimple-heard" cx="42%" cy="34%" r="75%">
        <stop offset="0%" stop-color="#e2fff4"/>
        <stop offset="45%" stop-color="#6fcfb0"/>
        <stop offset="100%" stop-color="#2f7f6a"/>
      </radialGradient>
      <radialGradient id="dimple-miss" cx="42%" cy="34%" r="75%">
        <stop offset="0%" stop-color="#ffd9cf"/>
        <stop offset="45%" stop-color="#d9735c"/>
        <stop offset="100%" stop-color="#8a3a2b"/>
      </radialGradient>
      <radialGradient id="dimple-on" cx="42%" cy="34%" r="75%">
        <stop offset="0%" stop-color="#fff0cc"/>
        <stop offset="42%" stop-color="#e6b15a"/>
        <stop offset="100%" stop-color="#a86a30"/>
      </radialGradient>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.5" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="210" cy="210" r="198" fill="#120c09"/>
    <circle cx="210" cy="210" r="188" fill="url(#shell)"/>
    <circle class="rim" cx="210" cy="210" r="160" fill="none" stroke="#f3e2cc" stroke-opacity="0.13"/>
    <circle cx="210" cy="210" r="132" fill="none" stroke="#f3e2cc" stroke-opacity="0.08"/>
    <circle cx="210" cy="210" r="96" fill="none" stroke="#1a100c" stroke-opacity="0.28"/>
    <ellipse cx="164" cy="146" rx="74" ry="32" fill="#fff6e8" opacity="0.16" transform="rotate(-32 164 146)"/>
    ${ring}
    ${ding}
  </svg>`;
  if (canvas) document.getElementById("pan").append(canvas);
  const svg = document.querySelector(".pan-svg");
  svg.addEventListener("click", onPanHit);
  svg.addEventListener("keydown", onPanKey);
  syncMirror();
  if (stage) stage.layout(panLayout());
}

function panLayout() {
  return ["D3", ...FIELDS.map((field) => field.id)].map((id) => {
    const field = FIELDS.find((item) => item.id === id);
    const deg = field ? (mirrored ? (360 - field.deg) % 360 : field.deg) : 0;
    return { id, deg, ding: id === "D3", hand: flipHand(SIDE[id]), text: numberOf(id) };
  });
}

async function bootStage() {
  document.getElementById("pan").setAttribute("aria-busy", "true");
  const probe = document.createElement("canvas");
  const context = probe.getContext("webgl2") || probe.getContext("webgl");
  if (!context) { finishLoading("Simple view. Your browser could not start 3D; all music tools are ready."); return; }
  context.getExtension("WEBGL_lose_context")?.loseContext();
  const slow = setTimeout(() => {
    document.getElementById("loading-message").textContent = "Still loading. You can start in simple view.";
  }, 8000);
  try {
    const { createStage } = await import("./scene.js");
    if (sceneLoadCancelled) return;
    document.getElementById("loading-message").textContent = "Tuning the light and the handpan";
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (sceneLoadCancelled) return;
    stage = createStage({ pan: document.getElementById("pan"), onHit: soundNote });
    document.body.classList.add("has-3d");
    stage.layout(panLayout());
    initMotion({ button: document.getElementById("motion-toggle"), recenter: document.getElementById("motion-center"), status: document.getElementById("motion-status"), onChange: stage.motion });
    document.querySelector(".motion-controls").hidden = false;
    paint(player.snapshot());
    requestAnimationFrame(() => finishLoading());
  } catch (err) {
    for (const canvas of document.querySelectorAll(".world, .pan-3d")) canvas.remove();
    document.body.classList.remove("has-3d");
    finishLoading("Simple view. The courtyard could not load; all music tools are ready.");
  } finally {
    clearTimeout(slow);
  }
}

function onPanHit(event) {
  const field = event.target.closest(".field");
  if (!field) return;
  soundNote(field.dataset.note);
  field.blur();
}

function onPanKey(event) {
  const field = event.target.closest(".field");
  if (!field) return;
  if (event.code !== "Enter" && event.code !== "Space") return;
  event.preventDefault();
  event.stopPropagation();
  soundNote(field.dataset.note);
}

const tapTimers = new Map();

function soundNote(id) {
  deafUntil = performance.now() + TAP_DEAF_MS;
  audio.resume().then(() => audio.strikeChord([id], audio.now() + 0.02)).catch(audioError);
  const field = document.querySelector(`.field[data-note="${id}"]`);
  if (field) {
    field.classList.add("is-tap");
    clearTimeout(tapTimers.get(id));
    tapTimers.set(
      id,
      setTimeout(() => {
        field.classList.remove("is-tap");
        player.refresh();
      }, 180),
    );
  }
  player.refresh();
  if (!player.playing) {
    const hand = flipHand(SIDE[id]);
    const node = caption();
    if (node) node.textContent = hand ? `${numberOf(id)}, ${hand} hand` : numberOf(id);
  }
}

function audioError() {
  const message = "Sound could not start. Tap a note to try again.";
  document.getElementById("status").textContent = message;
}

function syncMirror() {
  const button = document.getElementById("mirror");
  button.setAttribute("aria-pressed", mirrored ? "true" : "false");
  button.textContent = mirrored ? "Mirror on" : "Mirror";
}

function patternFromHash() {
  const match = /^#\/p\/([\w-]+)$/.exec(location.hash);
  if (!match) return null;
  return PATTERNS.find((pattern) => pattern.id === match[1]) || null;
}

function handLine(hands) {
  const names = [...new Set(Object.values(hands).map((hand) => flipHand(hand)))];
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} hand`;
  return `${names[0]} and ${names[1]}`;
}

function kindList() {
  const found = [];
  for (const pattern of PATTERNS) {
    if (!found.includes(pattern.kind)) found.push(pattern.kind);
  }
  return found.sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a);
    const ib = KIND_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function fold(text) {
  return text.toLowerCase().replace(/\u266d/g, "b").replace(/-/g, " ");
}

function wordsOf(text) {
  return fold(text).split(/\s+/).filter(Boolean);
}

function noteWords(id) {
  if (id === TAK) return "tak tap";
  const note = NOTES[id];
  const letter = fold(note.letter);
  const spoken = letter.length > 1 ? `${letter[0]} flat` : letter;
  const ding = note.ding ? " ding" : "";
  return `${numberOf(id)} ${spoken} ${letter}${note.octave}${ding}`;
}

function haystack(pattern) {
  const notes = pattern.steps.map((step) => `${noteWords(step.note)} ${step.note}`).join(" ");
  return fold(`${pattern.title} ${pattern.blurb} ${pattern.about} ${pattern.kind} ${notes}`);
}

function wordHit(word, token) {
  if (word === token) return true;
  if (token.length >= 3 && word.includes(token)) return true;
  return /^[a-g]b?$/.test(token) && word.startsWith(token) && /^\d*$/.test(word.slice(token.length));
}

function hitsQuery(pattern) {
  const words = wordsOf(query);
  if (!words.length) return true;
  const hay = haystack(pattern).split(/\s+/);
  return words.every((token) => hay.some((word) => wordHit(word, token)));
}

function matches(pattern) {
  if (kindFilter !== "All" && pattern.kind !== kindFilter) return false;
  return hitsQuery(pattern);
}

function chipCount(kind) {
  const hits = PATTERNS.filter(hitsQuery);
  if (kind === "All") return hits.length;
  return hits.filter((pattern) => pattern.kind === kind).length;
}

function setChipLabel(chip) {
  const name = document.createElement("span");
  name.className = "chip-name";
  name.textContent = chip.dataset.kind;
  const count = document.createElement("span");
  count.className = "chip-count";
  count.textContent = String(chipCount(chip.dataset.kind));
  chip.replaceChildren(name, document.createTextNode(" "), count);
}

function renderList() {
  const dock = document.getElementById("dock");
  dock.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = "Library";
  const find = document.createElement("input");
  find.id = "find";
  find.className = "find";
  find.type = "search";
  find.placeholder = "Search by name or note number";
  find.setAttribute("aria-label", "Search patterns");
  find.value = query;
  find.addEventListener("input", () => {
    query = find.value;
    fillRows();
    paint(player.snapshot());
  });
  const chips = document.createElement("div");
  chips.className = "chips";
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Pattern kinds");
  const kinds = ["All", ...kindList()];
  for (const kind of kinds) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.kind = kind;
    setChipLabel(chip);
    chip.setAttribute("aria-pressed", kind === kindFilter ? "true" : "false");
    chip.addEventListener("click", () => {
      kindFilter = kind;
      for (const button of chips.querySelectorAll(".chip")) {
        button.setAttribute("aria-pressed", button.dataset.kind === kind ? "true" : "false");
      }
      fillRows();
      paint(player.snapshot());
    });
    chips.append(chip);
  }
  const rows = document.createElement("div");
  rows.id = "rows";
  const libraryHead = document.createElement("div");
  libraryHead.className = "library-head";
  libraryHead.append(heading, find, chips);
  const resultCount = document.createElement("p");
  resultCount.id = "result-count";
  resultCount.className = "result-count";
  resultCount.setAttribute("role", "status");
  libraryHead.append(resultCount);
  dock.append(libraryHead, rows);
  fillRows();
}

function fillRows() {
  const rows = document.getElementById("rows");
  if (!rows) return;
  for (const chip of document.querySelectorAll("#dock .chip")) setChipLabel(chip);
  rows.innerHTML = "";
  const visible = PATTERNS.filter(matches);
  const resultCount = document.getElementById("result-count");
  if (resultCount) resultCount.textContent = visible.length === PATTERNS.length ? `${visible.length} patterns` : `${visible.length} of ${PATTERNS.length} patterns`;
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = kindFilter === "All" ? "No patterns match. " : `No ${kindFilter} patterns match. `;
    const clear = textButton("step-btn", "Clear search");
    clear.addEventListener("click", () => {
      query = "";
      kindFilter = "All";
      const find = document.getElementById("find");
      find.value = "";
      for (const chip of document.querySelectorAll("#dock .chip")) {
        chip.setAttribute("aria-pressed", chip.dataset.kind === "All" ? "true" : "false");
      }
      fillRows();
      paint(player.snapshot());
      find.focus();
    });
    empty.append(clear);
    rows.append(empty);
    return;
  }
  for (const kind of kindList()) {
    const items = visible.filter((pattern) => pattern.kind === kind);
    if (items.length === 0) continue;
    const section = document.createElement("section");
    section.className = "group";
    const heading = document.createElement("h2");
    heading.className = "kind";
    heading.textContent = kind;
    section.append(heading);
    if (KIND_NOTE[kind]) {
      const note = document.createElement("p");
      note.className = "kind-note";
      note.textContent = KIND_NOTE[kind];
      section.append(note);
    }
    for (const pattern of items) section.append(rowFor(pattern));
    rows.append(section);
  }
}

const SOFT_BELOW = 0.6;
const MINI_MAX = 40;
const MINI_OPENING = 16;

function barBeats(pattern) {
  return pattern.beatsPerBar || 4;
}

function clock(seconds) {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole} s`;
  return `${Math.floor(whole / 60)} min ${whole % 60} s`;
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch (err) {
    void err;
    return {};
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    void err;
  }
}

const LEARNED_KEY = "disc-kurd-learned";
const STEP_KEY = "disc-kurd-step";
const learned = readStore(LEARNED_KEY);
const stepAt = readStore(STEP_KEY);

function partNames(pattern) {
  return [...new Set((pattern.sections || [{ name: "" }]).map((section) => section.name))];
}

function isLearned(pattern, name) {
  return (learned[pattern.id] || []).includes(name);
}

function setLearned(pattern, name, on) {
  const names = (learned[pattern.id] || []).filter((item) => item !== name);
  if (on) names.push(name);
  learned[pattern.id] = names;
  writeStore(LEARNED_KEY, learned);
}

function markLearned(pattern, key, on) {
  setLearned(pattern, key, on);
  for (const box of document.querySelectorAll(".part-done input")) {
    if (box.dataset.part === key) box.checked = on;
  }
  fillGuide(pattern);
  fillRows();
  paint(player.snapshot());
}

function stepOf(pattern) {
  const at = stepAt[pattern.id];
  return Number.isInteger(at) ? stepsOf(pattern)[at] || null : null;
}

function barsOf(pattern, range) {
  if (!range) return null;
  const beats = barBeats(pattern);
  return { first: Math.round(range.from / beats), end: Math.round(range.to / beats) };
}

function onStep(pattern, range) {
  const step = stepOf(pattern);
  const bars = barsOf(pattern, range);
  return !!step && !!bars && bars.first === step.first && bars.end === step.end;
}

function barSpan(first, end) {
  return end - first === 1 ? `bar ${first + 1}` : `bars ${first + 1} to ${end}`;
}

function learnedLine(pattern) {
  const names = partNames(pattern);
  const done = names.filter((name) => isLearned(pattern, name)).length;
  if (done === 0) return "";
  if (names.length === 1) return ", learned";
  return `, ${done} of ${names.length} parts learned`;
}

function thumbFor(pattern, size) {
  const thumb = document.createElement("img");
  thumb.className = "thumb";
  thumb.src = `img/thumbs/${pattern.id}.webp`;
  thumb.alt = "";
  thumb.width = size;
  thumb.height = size;
  thumb.decoding = "async";
  thumb.addEventListener("error", () => thumb.remove());
  return thumb;
}

function rowFor(pattern) {
  const row = document.createElement("article");
  row.className = "row";
  row.dataset.pattern = pattern.id;

  const play = document.createElement("button");
  play.type = "button";
  play.className = "row-play";
  play.dataset.play = pattern.id;
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.textContent = "Play";
  play.append(mark);
  play.addEventListener("click", () => {
    if (player.playing && player.pattern && player.pattern.id === pattern.id) {
      player.pause();
      return;
    }
    const open = patternFromHash();
    const same = !!open && open.id === pattern.id;
    if (player.range && !same) player.setRange(null);
    if (!same) player.setLoop(pattern.loop !== false);
    if (open && !same) location.hash = `#/p/${pattern.id}`;
    player.play(pattern, 0, { keepTempo: same });
  });

  const body = document.createElement("div");
  body.className = "row-body";
  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = `#/p/${pattern.id}`;
  titleLink.textContent = pattern.title;
  titleLink.title = pattern.blurb;
  title.append(titleLink);
  const blurb = document.createElement("p");
  blurb.className = "blurb";
  blurb.textContent = pattern.blurb;
  blurb.title = pattern.blurb;
  const mini = document.createElement("div");
  mini.className = "mini";
  const events = eventsOf(pattern);
  const shown = events.length > MINI_MAX ? events.slice(0, MINI_OPENING) : events;
  for (const event of shown) {
    const chip = document.createElement("span");
    chip.className = "mini-hit";
    chip.dataset.event = String(event.index);
    for (const id of event.notes) chip.append(noteNode(id, event.hands[id]));
    chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", event.notes.map((id) => spokenName(id)).join(" and "));
    mini.append(chip);
  }
  if (shown.length < events.length) {
    const more = document.createElement("span");
    more.className = "mini-more";
    more.textContent = `and ${events.length - shown.length} more`;
    mini.append(more);
  }
  const meta = document.createElement("p");
  meta.className = "meta";
  const bars = Math.ceil(pattern.loopBeats / barBeats(pattern));
  const length = pattern.loop === false ? `, ${clock((pattern.loopBeats * 60) / pattern.bpm)}` : "";
  meta.textContent = `${bars} ${bars === 1 ? "bar" : "bars"}, ${pattern.bpm} bpm${length}${learnedLine(pattern)}`;
  body.append(title, blurb, meta, mini);

  const open = document.createElement("a");
  open.className = "open";
  open.href = `#/p/${pattern.id}`;
  open.textContent = "Learn";

  const side = document.createElement("div");
  side.className = "row-side";
  side.append(thumbFor(pattern, 48), play);
  row.append(side, body, open);
  return row;
}

function renderLearn(pattern) {
  lastScroll = -2;
  settled = false;
  document.title = `${pattern.title} | Alamut`;
  const dock = document.getElementById("learn");
  dock.innerHTML = "";

  const head = document.createElement("div");
  head.className = "learn-head";
  const back = document.createElement("a");
  back.className = "back";
  back.href = "#/";
  back.textContent = "Library";
  const title = document.createElement("h1");
  title.tabIndex = -1;
  title.textContent = pattern.title;
  const about = document.createElement("p");
  about.className = "about";
  about.textContent = pattern.blurb;
  const name = document.createElement("div");
  name.className = "learn-title";
  name.append(title, about);
  head.append(back, thumbFor(pattern, 48), name);

  const warn = document.createElement("p");
  warn.className = "mirror-note";
  warn.hidden = !mirrored;
  warn.textContent =
    "Mirror is on, so swap left and right in the paragraph above. The drawing and the hands on each note already match the flipped pan.";

  const transport = document.createElement("div");
  transport.className = "transport";

  const play = document.createElement("button");
  play.type = "button";
  play.id = "play";
  play.className = "play";
  const playMark = document.createElement("span");
  playMark.className = "mark";
  playMark.textContent = "Play";
  play.append(playMark);
  play.addEventListener("click", () => {
    if (player.playing) {
      player.pause();
      return;
    }
    if (player.canResume && player.pattern && player.pattern.id === pattern.id) {
      player.resume();
      return;
    }
    player.play(pattern, 0, { keepTempo: true });
  });

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "stepper is-prev";
  previous.setAttribute("aria-label", "Previous note");
  previous.title = "Previous note";
  previous.addEventListener("click", () => player.step(-1, listener.on));

  const next = document.createElement("button");
  next.type = "button";
  next.className = "stepper is-next";
  next.setAttribute("aria-label", "Next note");
  next.title = "Next note";
  next.addEventListener("click", () => player.step(1, listener.on));

  const tempoLabel = document.createElement("label");
  tempoLabel.className = "tempo";
  tempoLabel.append("Tempo ");
  const bpm = document.createElement("span");
  bpm.id = "bpm";
  bpm.textContent = String(player.pattern && player.pattern.id === pattern.id ? player.bpm : pattern.bpm);
  const unit = document.createElement("span");
  unit.className = "tempo-unit";
  unit.textContent = "bpm";
  const range = document.createElement("input");
  range.id = "tempo";
  range.type = "range";
  range.min = "48";
  range.max = "140";
  range.step = "1";
  range.value = bpm.textContent;
  range.setAttribute("aria-label", "Tempo");
  range.setAttribute("aria-valuetext", `${range.value} bpm`);
  range.addEventListener("input", () => {
    bpm.textContent = range.value;
    range.setAttribute("aria-valuetext", `${range.value} bpm`);
    player.setTempo(Number(range.value));
  });
  tempoLabel.append(bpm, unit, range);

  const loop = document.createElement("button");
  loop.type = "button";
  loop.id = "loop";
  loop.className = "loop";
  loop.textContent = "Loop";
  loop.addEventListener("click", () => {
    if (player.range && !onStep(pattern, player.range)) clearRange();
    else player.setLoop(!player.loop);
  });

  const ranged = document.createElement("button");
  ranged.type = "button";
  ranged.id = "range";
  ranged.className = "range";
  ranged.hidden = true;
  ranged.addEventListener("click", clearRange);

  const keys = document.createElement("p");
  keys.className = "keys";
  keys.textContent =
    "Space plays and pauses. Arrows move one note. Click a bar number to loop that bar, and a second bar number to extend the loop. With Listen on, the page waits until you strike the lit note. Learn in steps takes a piece one part at a time, then joins the parts.";

  transport.append(play, previous, next, loop, ranged, tempoLabel);

  const sheet = sheetOf(pattern);
  const deck = document.createElement("div");
  deck.className = "deck";
  const guide = document.createElement("div");
  guide.id = "guide";
  guide.className = "guide";
  deck.append(transport, guide);

  dock.append(head, warn, deck, legend(), sheetNode(pattern, sheet), keys);
  fillGuide(pattern);
  focusSheet(pattern);
}

function textButton(className, text) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  return node;
}

function fillGuide(pattern) {
  const guide = document.getElementById("guide");
  if (!guide) return;
  lastScroll = -2;
  const hadFocus = guide.contains(document.activeElement);
  guide.replaceChildren();
  const steps = stepsOf(pattern);
  if (steps.length === 0) return;
  const step = stepOf(pattern);
  guide.classList.toggle("is-stepping", !!step);
  if (!step) {
    const done = steps.filter((item) => isLearned(pattern, item.key)).length;
    const label =
      done === steps.length
        ? "All steps done. Review"
        : done
          ? `Continue steps, ${done} of ${steps.length} done`
          : "Learn in steps";
    const open = textButton("step-btn is-main", label);
    open.id = "steps-open";
    open.addEventListener("click", () => {
      const next = steps.findIndex((item) => !isLearned(pattern, item.key));
      openStep(pattern, next < 0 ? 0 : next);
    });
    guide.append(open, partMap(pattern, sheetOf(pattern)));
    if (hadFocus) open.focus({ preventScroll: true });
    return;
  }
  const at = stepAt[pattern.id];
  const last = at === steps.length - 1;
  const done = isLearned(pattern, step.key);

  const head = document.createElement("div");
  head.className = "step-head";
  const count = document.createElement("strong");
  count.textContent = `Step ${at + 1} of ${steps.length}`;
  const what = document.createElement("span");
  what.className = "step-what";
  what.textContent = `${step.label}, ${barSpan(step.first, step.end)}`;

  const back = textButton("step-btn", "Previous step");
  back.disabled = at === 0;
  back.addEventListener("click", () => openStep(pattern, at - 1));

  const passText = done ? (last ? "Finish" : "Next step") : last ? "Got it, finish" : "Got it, next";
  const pass = textButton("step-btn is-main", passText);
  pass.id = "step-pass";
  pass.addEventListener("click", () => {
    if (!done) markLearned(pattern, step.key, true);
    openStep(pattern, last ? null : at + 1);
  });

  head.append(count, what, back, pass);
  if (done) {
    const undo = textButton("step-btn", "Unmark");
    undo.addEventListener("click", () => markLearned(pattern, step.key, false));
    head.append(undo);
  }
  const leave = textButton("step-btn", "Exit steps");
  leave.id = "steps-close";
  leave.addEventListener("click", () => openStep(pattern, null));
  head.append(leave);

  const map = document.createElement("div");
  map.className = "partmap";
  map.setAttribute("role", "group");
  map.setAttribute("aria-label", "Steps for this piece");
  steps.forEach((item, i) => {
    const chip = textButton("step-chip", item.short);
    chip.title = `${item.label}, ${barSpan(item.first, item.end)}`;
    chip.classList.toggle("is-learned", isLearned(pattern, item.key));
    chip.classList.toggle("is-current", i === at);
    if (i === at) chip.setAttribute("aria-current", "step");
    chip.addEventListener("click", () => openStep(pattern, i));
    map.append(chip);
  });
  guide.append(head, map);
  const current = map.querySelector(".is-current");
  if (current) map.scrollLeft += current.getBoundingClientRect().left - map.getBoundingClientRect().left - 8;
  if (hadFocus) pass.focus({ preventScroll: true });
}

function focusSheet(pattern) {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;
  const step = stepOf(pattern);
  sheet.classList.toggle("is-focus", !!step);
  for (const part of sheet.querySelectorAll(".part")) {
    let shown = 0;
    for (const bar of part.querySelectorAll(".bar")) {
      const n = Number(bar.dataset.bar);
      bar.hidden = !!step && (n < step.first || n >= step.end);
      if (!bar.hidden) shown += 1;
    }
    part.classList.toggle("is-folded", shown === 0);
  }
}

function placeStep(pattern, step) {
  const beats = barBeats(pattern);
  player.setRange({ from: step.first * beats, to: step.end * beats });
  const first = eventsOf(pattern).find((event) => event.beat >= step.first * beats - 0.001);
  if (first) player.seek(first.index, false, true);
}

function openStep(pattern, at) {
  const playing = player.playing;
  if (at === null) delete stepAt[pattern.id];
  else stepAt[pattern.id] = at;
  writeStore(STEP_KEY, stepAt);
  fillGuide(pattern);
  focusSheet(pattern);
  const step = stepOf(pattern);
  if (!step) clearRange();
  else if (playing) loopBars(pattern, step.first, step.end);
  else placeStep(pattern, step);
}

function partMap(pattern, sheet) {
  const map = document.createElement("div");
  map.className = "partmap";
  map.setAttribute("role", "group");
  map.setAttribute("aria-label", "Parts of this piece");
  sheet.sections.forEach((section, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "part-chip";
    chip.dataset.section = String(i);
    chip.dataset.part = section.name;
    chip.textContent = section.name;
    chip.classList.toggle("is-learned", isLearned(pattern, section.name));
    chip.addEventListener("click", () => {
      const first = section.bars.flatMap((bar) => bar.slots).find(Boolean);
      if (first) player.seek(first.index, player.playing, listener.on);
      const target = document.querySelector(`.part[data-section="${i}"]`);
      if (target) keepInView(target, true);
    });
    map.append(chip);
  });
  return map;
}

function legend() {
  const line = document.createElement("p");
  line.className = "legend";
  const left = document.createElement("span");
  left.className = `note ${flipHand("left")}`;
  left.textContent = "Left hand";
  const right = document.createElement("span");
  right.className = `note ${flipHand("right")}`;
  right.textContent = "Right hand";
  const soft = document.createElement("span");
  soft.className = "legend-soft";
  soft.textContent = "small is soft";
  const tak = document.createElement("span");
  tak.textContent = "\u00d7 is a tak";
  const bars = document.createElement("span");
  bars.textContent = "tap a bar number to loop it";
  line.append(left, right, soft, tak, bars);
  return line;
}

function noteNode(id, hand) {
  const node = document.createElement("span");
  node.className = `note ${flipHand(hand)}`;
  if (id === TAK) {
    node.textContent = "\u00d7";
    return node;
  }
  node.textContent = numberOf(id);
  return node;
}

function slotNode(pattern, sheet, bar, slot, event) {
  const onBeat = slot % sheet.perBeat === 0;
  const beat = (bar * sheet.perBar + slot) / sheet.perBeat;
  const node = document.createElement(event ? "button" : "span");
  node.className = "slot";
  if (onBeat) node.dataset.count = beatLabel(beat, pattern);
  if (!event) return node;
  node.type = "button";
  node.classList.add("hit");
  node.classList.toggle("is-soft", event.notes.every((id) => id === TAK || event.amps[id] < SOFT_BELOW));
  node.dataset.event = String(event.index);
  const names = event.notes.map((id) => `${spokenName(id)}, ${flipHand(event.hands[id])} hand`);
  node.setAttribute("aria-label", `Bar ${bar + 1}, count ${beatLabel(beat, pattern)}: ${names.join(" and ")}`);
  for (const id of event.notes) node.append(noteNode(id, event.hands[id]));
  node.addEventListener("click", () => player.seek(event.index, player.playing, listener.on));
  return node;
}

function sheetNode(pattern, sheet) {
  const node = document.createElement("div");
  node.className = "sheet";
  node.id = "sheet";
  node.style.setProperty("--cols", String(sheet.cols));
  sheet.sections.forEach((section, i) => {
    const part = document.createElement("section");
    part.className = "part";
    part.dataset.section = String(i);

    const head = document.createElement("header");
    head.className = "part-head";
    if (section.name) {
      const name = document.createElement("h2");
      name.textContent = section.name;
      const span = document.createElement("span");
      span.className = "part-bars";
      span.textContent = barSpan(section.first, section.end);
      const loop = document.createElement("button");
      loop.type = "button";
      loop.className = "part-loop";
      loop.dataset.from = String(section.first);
      loop.dataset.to = String(section.end);
      loop.textContent = "Loop part";
      loop.addEventListener("click", () => {
        if (loop.getAttribute("aria-pressed") === "true") clearRange();
        else loopBars(pattern, section.first, section.end);
      });
      head.append(name, span, loop);
    }
    const done = document.createElement("label");
    done.className = "part-done";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.dataset.part = section.name;
    box.checked = isLearned(pattern, section.name);
    box.addEventListener("change", () => markLearned(pattern, section.name, box.checked));
    done.append(box, " Learned");
    head.append(done);

    const bars = document.createElement("div");
    bars.className = "bars";
    for (const bar of section.bars) {
      const cell = document.createElement("div");
      cell.className = "bar";
      cell.dataset.bar = String(bar.bar);
      const number = document.createElement("button");
      number.type = "button";
      number.className = "bar-num";
      number.textContent = String(bar.bar + 1);
      number.setAttribute("aria-label", `Loop bar ${bar.bar + 1}`);
      const slots = document.createElement("div");
      slots.className = "slots";
      bar.slots.forEach((event, slot) => slots.append(slotNode(pattern, sheet, bar.bar, slot, event)));
      cell.append(number, slots);
      bars.append(cell);
    }
    part.append(head, bars);
    node.append(part);
  });

  let dragFrom = null;
  let dragged = false;
  node.addEventListener("pointerdown", (event) => {
    const number = event.target.closest(".bar-num");
    dragFrom = number ? Number(number.parentElement.dataset.bar) : null;
    dragged = false;
  });
  node.addEventListener("pointerup", (event) => {
    if (dragFrom === null) return;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const bar = under && under.closest(".bar");
    const to = bar ? Number(bar.dataset.bar) : dragFrom;
    if (to !== dragFrom) {
      dragged = true;
      loopBars(pattern, Math.min(dragFrom, to), Math.max(dragFrom, to) + 1);
    }
    dragFrom = null;
  });
  node.addEventListener("click", (event) => {
    const number = event.target.closest(".bar-num");
    if (!number || dragged) return;
    pickBar(pattern, Number(number.parentElement.dataset.bar));
  });
  return node;
}

function loopBars(pattern, first, end) {
  const beats = barBeats(pattern);
  player.setRange({ from: first * beats, to: end * beats });
  player.play(pattern, first * beats, { keepTempo: true });
}

function clearRange() {
  const pattern = player.pattern;
  const step = pattern ? stepOf(pattern) : null;
  const beats = pattern ? barBeats(pattern) : 4;
  const playing = player.playing;
  const at = player.index;
  player.setRange(step ? { from: step.first * beats, to: step.end * beats } : null);
  if (playing) player.seek(at, true);
}

function pickBar(pattern, bar) {
  const bars = barsOf(pattern, player.range);
  if (!bars || onStep(pattern, player.range)) loopBars(pattern, bar, bar + 1);
  else if (bar >= bars.first && bar < bars.end) clearRange();
  else loopBars(pattern, Math.min(bars.first, bar), Math.max(bars.end, bar + 1));
}

function keepInView(node, toTop) {
  const learn = document.getElementById("learn");
  const inner = learn.scrollHeight > learn.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(learn).overflowY);
  const deck = document.querySelector(".deck");
  const stick = document.querySelector(".pan-stick");
  const box = node.getBoundingClientRect();
  const deckBottom = deck ? deck.getBoundingClientRect().bottom : 0;
  const top = inner
    ? Math.max(learn.getBoundingClientRect().top, deckBottom)
    : Math.max(stick.getBoundingClientRect().bottom, deckBottom);
  const bottom = inner ? learn.getBoundingClientRect().bottom : window.innerHeight;
  if (!toTop && box.top >= top + 4 && box.bottom <= bottom - 4) return;
  const shift = box.top - top - 10;
  if (inner) learn.scrollTop += shift;
  else window.scrollBy(0, shift);
}

function route() {
  setTools(false);
  const pattern = patternFromHash();
  if (location.hash.startsWith("#/p/") && !pattern) {
    location.hash = "#/";
    return;
  }
  document.body.classList.toggle("is-learn", !!pattern);
  if (!document.getElementById("find")) renderList();
  const learn = document.getElementById("learn");
  if (!pattern) {
    document.title = "Alamut | A courtyard for sound";
    learn.innerHTML = "";
    const key = document.createElement("p");
    key.className = "key";
    key.textContent = "0 is the ding. 1 to 9 climb in pitch around the rim. Brass numbers are the left hand, ivory the right.";
    learn.append(key);
    paint(player.snapshot());
    const left = routed ? document.querySelector(`.row[data-pattern="${routed}"]`) : null;
    if (left) {
      left.querySelector(".open").focus({ preventScroll: true });
      left.scrollIntoView({ block: "center" });
    }
    routed = "";
    return;
  }
  renderLearn(pattern);
  if (routed !== null && routed !== pattern.id) document.querySelector("#learn h1").focus({ preventScroll: true });
  routed = pattern.id;
  if (window.scrollY !== 0) window.scrollTo(0, 0);
  if (!player.pattern || player.pattern.id !== pattern.id) player.load(pattern);
  const step = stepOf(pattern);
  const bars = barsOf(pattern, player.range);
  if (step && !(bars && bars.first >= step.first && bars.end <= step.end)) {
    if (player.playing) loopBars(pattern, step.first, step.end);
    else placeStep(pattern, step);
  }
  else paint(player.snapshot());
}

function paint(snap) {
  const environment = sceneChoice === "auto" ? viewFor(snap.patternId) : sceneChoice;
  if (stage && environment !== lastEnvironment) {
    stage.environment(environment);
    lastEnvironment = environment;
    sceneSelect.options[0].textContent = `Auto: ${VIEWS[environment].name.replace(/^Alamut · /, "")}`;
  }
  const onNotes = new Set(snap.notes);
  const nextNotes = new Set(snap.nextNotes);
  document.querySelectorAll(".field").forEach((field) => {
    const id = field.dataset.note;
    const on = onNotes.has(id);
    const sounding = (snap.playing || listener.on) && on;
    const echo = heard && heard.id === id ? (heard.miss ? "url(#dimple-miss)" : "url(#dimple-heard)") : null;
    field.classList.toggle("is-on", sounding);
    field.classList.toggle("is-place", !sounding && on);
    field.classList.toggle("is-next", !on && nextNotes.has(id));
    if (stage) {
      const lit = sounding || field.classList.contains("is-tap");
      const look = echo ? (heard.miss ? "miss" : "heard") : lit ? "on" : on ? "place" : nextNotes.has(id) ? "next" : "idle";
      stage.set(id, look);
    }
    const shade = field.querySelector(".field-shade");
    const face = field.querySelector(".field-face");
    if (echo) {
      shade.setAttribute("fill", echo);
      face.setAttribute("fill", echo);
      face.setAttribute("filter", "url(#glow)");
    } else if (sounding || field.classList.contains("is-tap")) {
      shade.setAttribute("fill", "url(#dimple-on)");
      face.setAttribute("fill", "url(#dimple-on)");
      face.setAttribute("filter", "url(#glow)");
    } else if (on) {
      shade.setAttribute("fill", "#5c4128");
      face.setAttribute("fill", "#6a4e34");
      face.setAttribute("filter", "none");
    } else {
      shade.setAttribute("fill", "url(#dimple)");
      face.setAttribute("fill", "#4e3b2e");
      face.setAttribute("filter", "none");
    }
  });
  const svg = document.querySelector(".pan-svg");
  if (svg) svg.classList.toggle("is-tak", snap.playing && onNotes.has(TAK));
  if (stage) stage.setTak(snap.playing && onNotes.has(TAK));
  document.querySelectorAll("[data-event]").forEach((node) => {
    const row = node.closest("[data-pattern]");
    const inPattern = !row || row.dataset.pattern === snap.patternId;
    const index = Number(node.dataset.event);
    const here = inPattern && snap.index >= 0 && index === snap.index;
    node.classList.toggle("is-on", !!snap.playing && here);
    node.classList.toggle("is-place", !snap.playing && here);
    node.classList.toggle("is-next", inPattern && index === snap.nextIndex && index !== snap.index);
  });
  paintRange(snap);
  if (snap.index >= 0 && snap.index !== lastScroll) {
    lastScroll = snap.index;
    const slot = document.querySelector("#sheet .slot.is-on, #sheet .slot.is-place");
    if (slot) {
      if (settled) keepInView(slot.closest(".bar"));
      settled = true;
      const part = slot.closest(".part").dataset.section;
      for (const chip of document.querySelectorAll(".part-chip")) {
        const here = chip.dataset.section === part;
        chip.classList.toggle("is-current", here);
        if (here) chip.setAttribute("aria-current", "true");
        else chip.removeAttribute("aria-current");
      }
    }
    const chip = document.querySelector(".mini-hit.is-on, .mini-hit.is-place");
    if (chip) scrollStrip(chip.parentElement, chip);
  }
  const node = caption();
  const text = captionText(snap);
  if (node.textContent !== text) node.textContent = text;
  const status = document.getElementById("status");
  const say = micNote || (listener.on && !snap.playing ? text : "");
  if (status && status.textContent !== say) status.textContent = say;

  document.querySelectorAll(".row-play").forEach((button) => {
    const active = snap.playing && button.dataset.play === snap.patternId;
    button.dataset.state = active ? "playing" : "paused";
    const label = active ? "Pause" : "Play";
    const mark = button.querySelector(".mark");
    if (mark.textContent !== label) mark.textContent = label;
    const title = PATTERNS.find((pattern) => pattern.id === button.dataset.play);
    button.setAttribute("aria-label", `${label} ${title ? title.title : ""}`.trim());
  });
  document.querySelectorAll(".row").forEach((row) => {
    row.classList.toggle("is-current", !!snap.patternId && row.dataset.pattern === snap.patternId);
  });
  if (snap.patternId && snap.patternId !== lastListed) {
    lastListed = snap.patternId;
    const dock = document.getElementById("dock");
    const row = dock && dock.querySelector(`.row[data-pattern="${snap.patternId}"]`);
    if (row && dock && dock.scrollHeight > dock.clientHeight + 4) {
      const dr = dock.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const visibleTop = dr.top + (dock.querySelector(".library-head")?.offsetHeight || 0);
      if (rr.top < visibleTop || rr.bottom > dr.bottom) {
        dock.scrollTop += rr.top - visibleTop - 8;
      }
    }
  }

  const play = document.getElementById("play");
  if (play) {
    play.dataset.state = snap.playing ? "playing" : "paused";
    const label = snap.playing ? "Pause" : "Play";
    const mark = play.querySelector(".mark");
    if (mark.textContent !== label) mark.textContent = label;
    play.setAttribute("aria-label", label);
  }
  const bpm = document.getElementById("bpm");
  const tempo = document.getElementById("tempo");
  if (bpm) bpm.textContent = String(snap.bpm);
  if (tempo && document.activeElement !== tempo && tempo.value !== String(snap.bpm)) {
    tempo.value = String(snap.bpm);
    tempo.setAttribute("aria-valuetext", `${snap.bpm} bpm`);
  }
  const loop = document.getElementById("loop");
  if (loop) {
    loop.setAttribute("aria-pressed", snap.loop ? "true" : "false");
    const shown = PATTERNS.find((item) => item.id === snap.patternId);
    const stepped = !!shown && onStep(shown, snap.range);
    loop.textContent = stepped ? "Loop step" : snap.range ? "Loop bars" : "Loop";
  }
  const warn = document.querySelector(".mirror-note");
  if (warn) warn.hidden = !mirrored;
}

function paintRange(snap) {
  const pattern = PATTERNS.find((item) => item.id === snap.patternId);
  const bars = pattern ? barsOf(pattern, snap.range) : null;
  const stepped = !!pattern && onStep(pattern, snap.range);
  const first = bars ? bars.first : -1;
  const end = bars ? bars.end : -1;
  const key = `${snap.patternId} ${first} ${end} ${stepped}`;
  const sheet = document.getElementById("sheet");
  if (!sheet || sheet.dataset.range === key) return;
  sheet.dataset.range = key;
  for (const bar of sheet.querySelectorAll(".bar")) {
    const n = Number(bar.dataset.bar);
    bar.classList.toggle("in-range", !stepped && n >= first && n < end);
  }
  for (const button of sheet.querySelectorAll(".part-loop")) {
    const whole = Number(button.dataset.from) === first && Number(button.dataset.to) === end;
    button.setAttribute("aria-pressed", whole ? "true" : "false");
  }
  const ranged = document.getElementById("range");
  if (ranged) {
    ranged.hidden = first < 0 || stepped;
    ranged.textContent = end - first === 1 ? `Bar ${first + 1} loops. Clear` : `Bars ${first + 1} to ${end} loop. Clear`;
  }
}

function scrollStrip(scroller, current) {
  if (!scroller || !current) return;
  const pad = 8;
  const host = scroller.getBoundingClientRect();
  const box = current.getBoundingClientRect();
  const origin = scroller.scrollLeft + (box.left - host.left);
  let left = Math.max(0, origin - pad);
  const next = current.nextElementSibling;
  if (next) {
    const nextBox = next.getBoundingClientRect();
    const end = scroller.scrollLeft + (nextBox.right - host.left) + pad;
    const shifted = Math.max(0, end - scroller.clientWidth);
    if (end - left > scroller.clientWidth && shifted <= origin) left = shifted;
  }
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const target = Math.max(0, Math.min(left, max));
  if (Math.abs(scroller.scrollLeft - target) < 2) return;
  scroller.scrollTo({ left: target, behavior: "auto" });
}

function spoken(id, hands) {
  const hand = flipHand(hands[id]);
  return hand ? `${numberOf(id)}, ${hand} hand` : numberOf(id);
}

function captionText(snap) {
  if (listener.on && !snap.playing) {
    const wanted = patternFromHash() ? pitched(snap.notes) : [];
    const target = wanted.map((id) => spoken(id, snap.hands)).join(" and ");
    const name = heard ? numberOf(heard.id) : "";
    if (heard && heard.miss) return `Heard ${name}. Play ${target}.`;
    if (heard) return target ? `Heard ${name}. Now ${target}.` : `Heard ${name}.`;
    return target ? `Play ${target}.` : "Listening. Strike a note.";
  }
  if (!snap.notes.length) {
    if (!snap.patternId) return "Tap a note to hear it.";
    const pattern = PATTERNS.find((item) => item.id === snap.patternId);
    return pattern ? "Press Play, or tap a note." : "Tap a note to hear it.";
  }
  return snap.notes
    .map((id) => spoken(id, snap.hands))
    .join(" and ");
}

document.getElementById("listen").addEventListener("click", toggleListen);

document.getElementById("mirror").addEventListener("click", () => {
  mirrored = !mirrored;
  try {
    localStorage.setItem("disc-kurd-mirror", mirrored ? "1" : "0");
  } catch (err) {
    void err;
  }
  drawPan();
  route();
});

window.addEventListener("hashchange", route);
window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || document.body.classList.contains("is-exploring")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, select")) return;
  if (event.code === "Escape" && document.body.classList.contains("tools-open")) {
    event.preventDefault();
    setTools(false);
    toolsToggle.focus();
    return;
  }
  if (event.code === "Escape" && document.body.classList.contains("is-learn")) {
    event.preventDefault();
    location.hash = "#/";
    return;
  }
  if (event.code === "Space") {
    if (event.target.closest("button, a, [role=button]")) return;
    event.preventDefault();
    const play = document.getElementById("play");
    if (play) {
      play.click();
      return;
    }
    const current = document.querySelector(".row.is-current .row-play") || document.querySelector(".row-play");
    if (current) current.click();
    return;
  }
  if (!document.body.classList.contains("is-learn")) return;
  if (event.code === "ArrowRight") {
    event.preventDefault();
    player.step(1, listener.on);
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    player.step(-1, listener.on);
  }
});

const MIC_KEY = "disc-kurd-mic";
const MIC_QUIET_MS = 4000;
const MIC_QUIET_LEVEL = 0.06;
let micState = "off";
let micQuietSince = 0;

function savedMic() {
  try {
    return localStorage.getItem(MIC_KEY) || "";
  } catch (err) {
    void err;
    return "";
  }
}

function saveMic(id) {
  try {
    localStorage.setItem(MIC_KEY, id);
  } catch (err) {
    void err;
  }
}

function micError(err) {
  if (!navigator.mediaDevices || !window.isSecureContext) return "A microphone needs https or localhost.";
  const name = err ? err.name : "";
  if (name === "NotAllowedError") return "The microphone is blocked. Allow it for this page, then press Listen.";
  if (name === "NotFoundError") return "No microphone found. Connect one, then press Listen.";
  if (name === "NotReadableError") return "Another app holds this input. Close it, or pick another input.";
  return "The microphone did not start. Press Listen to try again.";
}

function setMicText(text) {
  const node = document.getElementById("mic-text");
  if (node.textContent !== text) node.textContent = text;
}

function drawMic() {
  const bar = document.getElementById("mic");
  bar.hidden = micState === "off";
  bar.dataset.state = micState;
  document.querySelector(".mic-meter").hidden = micState !== "on";
  document.querySelector(".mic-pick").hidden = micState !== "on";
  if (micState === "asking") setMicText("Waiting for microphone permission");
  if (micState === "error") setMicText(micNote);
  const button = document.getElementById("listen");
  button.setAttribute("aria-pressed", listener.on ? "true" : "false");
  button.textContent = listener.on ? "Listening" : "Listen";
}

async function fillMicList() {
  const select = document.getElementById("mic-input");
  const found = await listener.inputs();
  select.replaceChildren(
    ...found.map((device, i) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${i + 1}`;
      return option;
    }),
  );
  select.value = listener.deviceId;
  if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
}

function meterLoop() {
  if (!listener.on) return;
  const now = performance.now();
  const level = listener.level();
  if (level > MIC_QUIET_LEVEL) micQuietSince = now;
  const quiet = now - micQuietSince > MIC_QUIET_MS;
  const bar = document.getElementById("mic");
  document.getElementById("mic-fill").style.transform = `scaleX(${level.toFixed(3)})`;
  bar.dataset.quiet = quiet ? "1" : "0";
  bar.dataset.heard = heard ? (heard.miss ? "miss" : "hit") : "";
  setMicText(quiet ? "No sound on this input. Check the source, or pick another." : "Listening");
  requestAnimationFrame(meterLoop);
}

async function startListening(deviceId) {
  audio.recordingMode(true);
  micNote = "";
  micState = "asking";
  drawMic();
  try {
    await listener.start(deviceId);
  } catch (err) {
    audio.recordingMode(false);
    if (deviceId && err && err.name === "OverconstrainedError") {
      saveMic("");
      await startListening("");
      return;
    }
    micState = "error";
    micNote = micError(err);
    drawMic();
    player.refresh();
    return;
  }
  micState = "on";
  micQuietSince = performance.now();
  saveMic(listener.deviceId);
  await fillMicList();
  drawMic();
  meterLoop();
  player.refresh();
}

function stopListening(note) {
  listener.stop();
  audio.recordingMode(false);
  micNote = note || "";
  micState = note ? "error" : "off";
  drawMic();
  player.refresh();
}

function onMicEnded() {
  stopListening("The input disconnected. Press Listen to start again.");
}

async function toggleListen() {
  if (listener.on) {
    stopListening("");
    return;
  }
  player.pause();
  await startListening(savedMic());
}

document.getElementById("mic-input").addEventListener("change", async (event) => {
  listener.stop();
  await startListening(event.target.value);
});

if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    if (listener.on) fillMicList();
  });
}

function trackStickHeight() {
  const stick = document.querySelector(".pan-stick");
  const apply = () => document.documentElement.style.setProperty("--stick-h", `${stick.offsetHeight}px`);
  new ResizeObserver(apply).observe(stick);
  apply();
}

trackStickHeight();
initExplore({ onOpen: () => player.pause() });
drawPan();
route();
bootStage();
