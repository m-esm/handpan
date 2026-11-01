import {
  NOTES,
  FIELDS,
  SIDE,
  PATTERNS,
  TAK,
  eventsOf,
  sheetOf,
  beatLabel,
  pretty,
  numberOf,
} from "./score.js";
import { ADDED } from "./added.js";
import { initPrint } from "./print.js";
import { createAudio } from "./sound.js";
import { createPlayer } from "./play.js";
import { createListener, accepts } from "./listen.js";
import { createGame, wordFor, TIERS } from "./game.js";
import { initMotion } from "./motion.js";
import { initExplore } from "./explore.js";
import { phrasesOf, beginnerPattern, createNotePractice, readPractice, savePractice } from "./practice.js";
import { t, raw, has, plural, digits, pieceText, partName, lang, wireLanguageSwitch, applyDocument } from "./i18n.js";

applyDocument();
initPrint();

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
const kindName = (kind) => (has(`kind.${kind}`) ? raw(`kind.${kind}`) : kind);
const kindNote = (kind) => (has(`kind.note.${kind}`) ? t(`kind.note.${kind}`) : "");
const handName = (hand) => (hand ? t(`hand.${hand}`) : hand);
let query = "";
let kindFilter = "All";
let ratingFilter = "any";
let sortOrder = "library";
let lastScroll = -2;
let settled = false;
let followPaused = false;
let followOrigin = 0;
let followDeparted = false;
let lastListed = "";
let routed = null;
let stage = null;
let sceneLoadCancelled = false;
let explore = null;
let practice = null;
let practiceSaved = null;
try {
  practiceSaved = readPractice(localStorage, PATTERNS);
} catch {
  practiceSaved = null;
}

function syncPickTitle(select) {
  select.title = select.selectedOptions[0]?.textContent ?? "";
}
for (const select of document.querySelectorAll(".pick select")) {
  select.addEventListener("change", () => syncPickTitle(select));
}

wireLanguageSwitch(document.getElementById("language"));

const toolsToggle = document.getElementById("tools-toggle");

function setTools(open) {
  document.body.classList.toggle("tools-open", open);
  toolsToggle.setAttribute("aria-expanded", String(open));
}

toolsToggle.addEventListener("click", () => setTools(!document.body.classList.contains("tools-open")));
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#tools, #tools-toggle")) setTools(false);
});

const loader = document.getElementById("scene-loader");
const loaderBar = document.getElementById("loading-bar");
const loaderPercent = document.getElementById("loading-percent");
const loaderMessage = document.getElementById("loading-message");
let loaderShown = 0;

function setLoading(fraction, messageKey) {
  const value = Math.max(loaderShown, Math.min(1, fraction));
  loaderShown = value;
  const percent = Math.round(value * 100);
  loaderBar.style.setProperty("--progress", String(value));
  loader.setAttribute("aria-valuenow", String(percent));
  loaderPercent.textContent = digits(`${percent}%`);
  if (messageKey) loaderMessage.textContent = t(messageKey);
}

function finishLoading(message = "") {
  const focusLoader = loader.contains(document.activeElement);
  setLoading(1);
  document.querySelector(".wrap").removeAttribute("inert");
  document.getElementById("pan").setAttribute("aria-busy", "false");
  const notice = document.getElementById("scene-notice");
  notice.textContent = message;
  notice.hidden = !message;
  if (focusLoader) document.querySelector(".brand").focus({ preventScroll: true });
  loader.classList.add("is-done");
  const hide = () => { loader.hidden = true; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) hide();
  else {
    loader.addEventListener("transitionend", hide, { once: true });
    setTimeout(hide, 700);
  }
}

document.getElementById("simple-view").addEventListener("click", () => {
  sceneLoadCancelled = true;
  finishLoading(t("simple.ready"));
});

const player = createPlayer(audio, paint);
const listener = createListener(onHeard, onMicEnded);
const game = createGame({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
const POP_MS = 1800;
let popTimer = 0;
const HEARD_MS = 450;
const TAP_DEAF_MS = 500;
let heard = null;
let heardCount = 0;
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
  if (practice || player.playing || performance.now() < deafUntil) return;
  let id = found.id;
  let miss = false;
  let wanted = [];
  if (patternFromHash() && player.pattern) {
    skipTaks();
    wanted = pitched(player.snapshot().notes);
    if (accepts(found, wanted)) {
      if (!wanted.includes(id)) id = wanted[0];
      player.step(1, true);
      skipTaks();
    } else {
      miss = true;
    }
  }
  heardCount += 1;
  heard = { id, miss, count: heardCount };
  clearTimeout(heardTimer);
  heardTimer = setTimeout(() => {
    heard = null;
    player.refresh();
  }, HEARD_MS);
  const result = game.strike({ id, quality: found.quality, miss, wanted });
  drawGame(result);
  if (stage) {
    stage.magic(game.snapshot().tier.magic);
    if (result.milestone) stage.celebrate();
  }
  player.refresh();
}

function bump(node) {
  node.classList.remove("is-bump");
  void node.offsetWidth;
  node.classList.add("is-bump");
}

function popText(result, snap) {
  if (result.milestone) return t("game.row", { n: result.milestone, tier: t(`tier.${snap.tier.name}`) });
  if (result.broke) return result.miss ? t("game.lost") : t("game.muffledLost");
  if (result.newBest) return t("game.newBest");
  return "";
}

function qualityColor(quality) {
  if (quality < 0.25) return "var(--bad)";
  if (quality < 0.5) return "var(--brass)";
  if (quality < 0.75) return "var(--teal)";
  return "#fff3d6";
}

function strikeWords(last) {
  if (!last) return [t("game.start"), t("game.start.sub")];
  if (last.miss) {
    const wanted = last.wanted.map(numberOf).join(t("game.or"));
    return [t("game.wrong"), wanted ? t("game.wrong.sub", { heard: numberOf(last.id), wanted }) : t("game.heard", { heard: numberOf(last.id) })];
  }
  if (!last.clean) return [t("game.muffled"), t("game.muffled.sub")];
  const combo = last.combo > 1 ? t("game.at", { n: last.combo }) : "";
  return [t("game.strike", { word: t(`quality.${wordFor(last.quality)}`) }), t("game.gained", { n: last.gained, combo })];
}

function drawGame(result) {
  const panel = document.getElementById("game");
  const snap = game.snapshot();
  const text = (id, value) => {
    const node = document.getElementById(id);
    if (node.textContent !== value) {
      node.textContent = value;
      if (node.tagName === "DD" || node.tagName === "STRONG") bump(node);
    }
  };
  const last = snap.last;
  panel.dataset.tier = String(snap.tier.index);
  panel.dataset.heard = last ? (last.miss ? "miss" : last.clean ? "hit" : "dull") : "";
  panel.style.setProperty("--q", last && !last.miss ? last.quality.toFixed(3) : "0");
  panel.style.setProperty("--q-color", last ? (last.miss ? "var(--bad)" : qualityColor(last.quality)) : "var(--brass)");
  text("game-note", last ? panLabel(last.id) : "\u2013");
  const [word, sub] = strikeWords(last);
  text("game-word", word);
  text("game-sub", sub);
  text("game-streak", digits(snap.streak));
  text("game-best", digits(snap.best));
  text("game-combo", `\u00d7${digits(snap.combo)}`);
  text("game-points", digits(snap.points));
  text("game-tier", t(`tier.${snap.tier.name}`));
  text("game-tier-next", snap.tier.next ? t("game.more", { n: snap.tier.next - snap.streak, tier: t(`tier.${TIERS[snap.tier.index + 1].name}`) }) : t("game.awake"));
  if (!result) return;
  const pop = popText(result, snap);
  if (!pop) return;
  const node = document.getElementById("game-pop");
  node.textContent = pop;
  node.classList.remove("is-live");
  void node.offsetWidth;
  node.classList.add("is-live");
  clearTimeout(popTimer);
  popTimer = setTimeout(() => node.classList.remove("is-live"), POP_MS);
}

function flipHand(hand) {
  if (!mirrored || !hand) return hand;
  if (hand === "left") return "right";
  if (hand === "right") return "left";
  return hand;
}

function spokenName(id) {
  if (id === TAK) return t("practice.tak.name");
  const ding = id === "D3" ? `,${t("note.ding")}` : "";
  return `${numberOf(id)}, ${pretty(id)}${ding}`;
}

function dimpleLabel(id) {
  return `${spokenName(id)}, ${t("hand.label", { hand: handName(flipHand(SIDE[id])) })}`;
}

function place(deg, orbit) {
  const shown = mirrored ? (360 - deg) % 360 : deg;
  const math = (shown * Math.PI) / 180 - Math.PI / 2;
  return [210 + Math.cos(math) * orbit, 210 + Math.sin(math) * orbit];
}

const panLabel = (id) => digits(numberOf(id));

function fieldMarkup(id, x, y, radius, ding) {
  const nameSize = lang === "fa" ? (ding ? 110 : 42) : ding ? 84 : 48;
  const hand = flipHand(SIDE[id]);
  return `<g class="field hand-${hand}${ding ? " ding" : ""}" data-note="${id}" role="button" tabindex="0" transform="translate(${x} ${y})" aria-label="${dimpleLabel(id)}">
    <circle class="field-shade" r="${radius}" fill="url(#dimple)"></circle>
    <circle class="field-face" r="${radius * 0.72}" fill="#4e3b2e"></circle>
    <text class="field-name" style="font-size:${nameSize}px">${panLabel(id)}</text>
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
  document.getElementById("pan").innerHTML = `<svg class="pan-svg" viewBox="0 0 420 420" role="group" aria-label="${t("pan.label")}">
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
  if (stage) stage.layout(panLayout());
}

function panLayout() {
  return ["D3", ...FIELDS.map((field) => field.id)].map((id) => {
    const field = FIELDS.find((item) => item.id === id);
    const deg = field ? (mirrored ? (360 - field.deg) % 360 : field.deg) : 0;
    return { id, deg, ding: id === "D3", hand: flipHand(SIDE[id]), text: numberOf(id), label: panLabel(id) };
  });
}

async function bootStage() {
  document.getElementById("pan").setAttribute("aria-busy", "true");
  const probe = document.createElement("canvas");
  const context = probe.getContext("webgl2") || probe.getContext("webgl");
  if (!context) { finishLoading(t("simple.no3d")); return; }
  context.getExtension("WEBGL_lose_context")?.loseContext();
  const slow = setTimeout(() => {
    document.getElementById("slow-hint").hidden = false;
  }, 8000);
  try {
    setLoading(0.02, "loader.modules");
    const { prepareTextures, COURTYARD, LANDSCAPE } = await import("./textures.js");
    const textures = prepareTextures();
    const { createStage } = await import("./scene.js");
    performance.mark("boot:scene-module");
    setLoading(0.15, "loader.textures");
    let baked = 0;
    // Gate the first paint on courtyard textures only. Landscape materials bake
    // in the background so a slow or failing valley cannot block 3D or trip
    // simple view while WebGL is available.
    await textures.ready(COURTYARD, () => setLoading(0.15 + (0.45 * ++baked) / COURTYARD.length));
    performance.mark("boot:textures");
    if (sceneLoadCancelled) return;
    setLoading(0.6, "loader.building");
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (sceneLoadCancelled) return;
    stage = createStage({ pan: document.getElementById("pan"), onHit: soundNote, textures });
    stage.layout(panLayout());
    performance.mark("boot:layout");
    setLoading(0.75, "loader.tuning");
    await stage.ready(() => setLoading(loaderShown + 0.12));
    if (sceneLoadCancelled) {
      for (const canvas of document.querySelectorAll(".world, .pan-3d")) canvas.remove();
      stage = null;
      return;
    }
    document.body.classList.add("has-3d");
    const exploreEntry = document.getElementById("explore-world");
    if (exploreEntry) exploreEntry.hidden = false;
    document.fonts.load(lang === "fa" ? "700 200px \"Vazirmatn\"" : "700 200px Georgia", digits("0123456789") + "\u00d7").then(() => stage && stage.layout(panLayout())).catch(() => {});
    initMotion({ button: document.getElementById("motion-toggle"), recenter: document.getElementById("motion-center"), status: document.getElementById("motion-status"), onChange: stage.motion });
    document.querySelector(".motion-controls").hidden = false;
    stage.selectCourtyard(!!patternFromHash());
    paint(player.snapshot());
    requestAnimationFrame(() => finishLoading());
    void Promise.race([
      textures.ready(LANDSCAPE),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]).then(() => {
      if (sceneLoadCancelled || !stage) return;
      return stage.ensureLandscape();
    }).catch(() => {});
  } catch (err) {
    console.error(err);
    for (const canvas of document.querySelectorAll(".world, .pan-3d")) canvas.remove();
    document.body.classList.remove("has-3d");
    const exploreEntry = document.getElementById("explore-world");
    if (exploreEntry) exploreEntry.hidden = true;
    finishLoading(t("simple.failed"));
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
  if (event.repeat) return;
  soundNote(field.dataset.note);
}

const tapTimers = new Map();
const tapCounts = new Map();

function soundNote(id) {
  const session = practice;
  const run = session?.run;
  if (practice?.mode === "try") {
    const result = practice.attempt.strike(id);
    practice.message = result.complete ? t("practice.done")
      : !result.accepted ? t("practice.keepTarget")
        : result.partial.length ? t("practice.chordMore") : "";
    if (result.target) player.seek(result.target.index, false, true);
    updatePractice(player.snapshot());
  }
  deafUntil = performance.now() + TAP_DEAF_MS;
  audio.resume().then(() => {
    if (session && (practice !== session || session.run !== run)) return;
    audio.strikeChord([id], audio.now() + 0.02);
  }).catch(audioError);
  const field = document.querySelector(`.field[data-note="${id}"]`);
  if (field) {
    field.classList.add("is-tap");
    tapCounts.set(id, (tapCounts.get(id) || 0) + 1);
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
  if (!player.playing && !practice) {
    const hand = flipHand(SIDE[id]);
    const node = caption();
    if (node) node.textContent = hand ? t("note.named", { number: numberOf(id), hand: handName(hand) }) : digits(numberOf(id));
  }
}

function audioError() {
  const message = t("sound.failed");
  document.getElementById("status").textContent = message;
}

function readHash() {
  const raw = location.hash || "#/";
  const cut = raw.indexOf("?");
  return {
    path: cut < 0 ? raw : raw.slice(0, cut),
    params: new URLSearchParams(cut < 0 ? "" : raw.slice(cut + 1)),
  };
}

function patternFromHash() {
  const match = /^#\/p\/([\w-]+)(?:\/(play|learn))?$/.exec(readHash().path);
  if (!match) return null;
  return PATTERNS.find((pattern) => pattern.id === match[1]) || null;
}

function learnMode() {
  return !!patternFromHash() && readHash().path.endsWith("/learn");
}

function numberParam(params, key) {
  const value = Number(params.get(key));
  return params.has(key) && Number.isFinite(value) ? value : null;
}

function applyListParams(params) {
  const nextQuery = params.get("q") || "";
  const kinds = ["All", ...kindList()];
  const nextKind = kinds.find((kind) => kind.toLowerCase() === (params.get("kind") || "").toLowerCase()) || "All";
  const nextRating = optionId(RATING_FILTERS, params.get("rating"));
  const nextSort = optionId(SORT_ORDERS, params.get("sort"));
  if (nextQuery === query && nextKind === kindFilter && nextRating === ratingFilter && nextSort === sortOrder) return;
  query = nextQuery;
  kindFilter = nextKind;
  ratingFilter = nextRating;
  sortOrder = nextSort;
  if (document.getElementById("find")) renderList();
}

function stateHash() {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kindFilter !== "All") params.set("kind", kindFilter.toLowerCase());
  if (ratingFilter !== RATING_FILTERS[0].id) params.set("rating", ratingFilter);
  if (sortOrder !== SORT_ORDERS[0].id) params.set("sort", sortOrder);
  let path = "#/";
  const pattern = patternFromHash();
  if (pattern && practice) {
    path = `#/p/${pattern.id}/learn`;
    if (practice.at > 0) params.set("phrase", String(practice.at + 1));
  } else if (pattern) {
    path = `#/p/${pattern.id}`;
  }
  const tail = params.toString();
  return tail ? `${path}?${tail}` : path;
}

let syncTimer = 0;
let routing = false;

function syncUrl() {
  if (routing) return;
  clearTimeout(syncTimer);
  syncTimer = 0;
  const next = stateHash();
  if (next !== (location.hash || "#/")) history.replaceState(history.state, "", next);
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncUrl, 250);
}

function handLine(hands) {
  const names = [...new Set(Object.values(hands).map((hand) => flipHand(hand)))];
  if (names.length === 0) return "";
  if (names.length === 1) return t("hand.label", { hand: handName(names[0]) });
  return `${handName(names[0])}${t("and")}${handName(names[1])}`;
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

const RATING_FILTERS = [
  { id: "any", label: t("rating.any"), keep: () => true },
  { id: "rated", label: t("rating.rated"), keep: (stars) => stars > 0 },
  { id: "unrated", label: t("rating.unrated"), keep: (stars) => stars === 0 },
  { id: "4", label: "4 stars and up", keep: (stars) => stars >= 4 },
  { id: "5", label: "5 stars", keep: (stars) => stars === 5 },
];

function lengthSeconds(pattern) {
  return (pattern.loopBeats * 60) / pattern.bpm;
}

const NEW_DAYS = 7;
const DAY_MS = 86400000;

function addedOf(pattern) {
  return ADDED[pattern.id] || "";
}

function addedDate(pattern) {
  const stamp = addedOf(pattern);
  return stamp ? new Date(stamp) : null;
}

function isNew(pattern) {
  const date = addedDate(pattern);
  return !!date && Date.now() - date.getTime() < NEW_DAYS * DAY_MS;
}

function addedLabel(pattern, month) {
  const date = addedDate(pattern);
  if (!date) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const options = { day: "numeric", month, ...(sameYear && month === "short" ? {} : { year: "numeric" }) };
  return date.toLocaleDateString(lang === "fa" ? "fa-IR" : undefined, options);
}

const SORT_ORDERS = [
  { id: "library", label: t("sort.library") },
  { id: "new", label: t("sort.new"), compare: (a, b) => addedOf(b).localeCompare(addedOf(a)) },
  { id: "rating", label: t("sort.rating"), compare: (a, b) => ratingOf(b) - ratingOf(a) },
  { id: "title", label: t("sort.title"), compare: (a, b) => a.title.localeCompare(b.title, lang) },
  { id: "slow", label: t("sort.slow"), compare: (a, b) => a.bpm - b.bpm },
  { id: "fast", label: t("sort.fast"), compare: (a, b) => b.bpm - a.bpm },
  { id: "short", label: t("sort.short"), compare: (a, b) => lengthSeconds(a) - lengthSeconds(b) },
];

function optionId(options, value) {
  return options.some((option) => option.id === value) ? value : options[0].id;
}

function optionFor(options, id) {
  return options.find((option) => option.id === id) || options[0];
}

function hitsRating(pattern) {
  return optionFor(RATING_FILTERS, ratingFilter).keep(ratingOf(pattern));
}

function matches(pattern) {
  if (kindFilter !== "All" && pattern.kind !== kindFilter) return false;
  return hitsRating(pattern) && hitsQuery(pattern);
}

function chipCount(kind) {
  const hits = PATTERNS.filter((pattern) => hitsRating(pattern) && hitsQuery(pattern));
  if (kind === "All") return hits.length;
  return hits.filter((pattern) => pattern.kind === kind).length;
}

function setChipLabel(chip) {
  const name = document.createElement("span");
  name.className = "chip-name";
  name.textContent = kindName(chip.dataset.kind);
  const count = document.createElement("span");
  count.className = "chip-count";
  count.textContent = digits(chipCount(chip.dataset.kind));
  chip.replaceChildren(name, document.createTextNode(" "), count);
}

function renderList() {
  const dock = document.getElementById("dock");
  dock.innerHTML = "";
  const heading = document.createElement("h1");
  heading.textContent = t("library");
  const intro = document.createElement("p");
  intro.className = "library-intro";
  intro.textContent = t("library.intro");
  const find = document.createElement("input");
  find.id = "find";
  find.className = "find";
  find.type = "search";
  find.placeholder = t("search.placeholder");
  find.setAttribute("aria-label", t("search.label"));
  find.value = query;
  find.addEventListener("input", () => {
    query = find.value;
    fillRows();
    paint(player.snapshot());
    scheduleSync();
  });
  const chips = document.createElement("div");
  chips.className = "chips";
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", t("kinds.label"));
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
      syncUrl();
    });
    chips.append(chip);
  }
  const listTools = document.createElement("div");
  listTools.className = "list-tools";
  const optionsToggle = textButton("list-options-toggle", "");
  optionsToggle.id = "list-options-toggle";
  optionsToggle.setAttribute("aria-expanded", "false");
  optionsToggle.setAttribute("aria-controls", "list-options");
  const options = document.createElement("div");
  options.id = "list-options";
  options.className = "list-options";
  options.hidden = true;
  options.append(
    optionRow("rating-filter", t("rating"), RATING_FILTERS, (id) => { ratingFilter = id; }),
    optionRow("sort-order", t("sort"), SORT_ORDERS, (id) => { sortOrder = id; }),
  );
  optionsToggle.addEventListener("click", () => {
    options.hidden = !options.hidden;
    optionsToggle.setAttribute("aria-expanded", options.hidden ? "false" : "true");
  });
  listTools.append(optionsToggle);
  const rows = document.createElement("div");
  rows.id = "rows";
  const libraryHead = document.createElement("div");
  libraryHead.className = "library-head";
  const siteNav = document.createElement("nav");
  siteNav.className = "library-site-nav";
  siteNav.setAttribute("aria-label", t("site.pages"));
  const features = document.createElement("a");
  features.href = "features.html";
  features.textContent = t("site.features");
  siteNav.append(features);
  const titleRow = document.createElement("div");
  titleRow.className = "library-title";
  titleRow.append(heading, siteNav);
  const resultCount = document.createElement("p");
  resultCount.id = "result-count";
  resultCount.className = "result-count";
  resultCount.setAttribute("role", "status");
  listTools.append(resultCount);
  libraryHead.append(titleRow, intro, find, chips, listTools, options);
  const beginner = textButton("practice-start", t("start.learning"));
  beginner.id = "practice-beginner";
  beginner.addEventListener("click", () => requestPractice(beginnerPattern(PATTERNS)));
  const continuePractice = textButton("practice-start is-main", "");
  continuePractice.id = "practice-continue";
  continuePractice.hidden = !practiceSaved;
  continuePractice.addEventListener("click", () => {
    const pattern = PATTERNS.find((item) => item.id === practiceSaved?.patternId);
    if (pattern) requestPractice(pattern);
  });
  const welcome = document.createElement("div");
  welcome.className = "library-welcome";
  welcome.append(continuePractice, beginner);
  intro.after(welcome);
  dock.append(libraryHead, rows);
  syncListOptions();
  updateResume();
  fillRows();
}

function optionRow(id, name, options, choose) {
  const row = document.createElement("div");
  row.id = id;
  row.className = "option-row";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", name);
  const caption = document.createElement("span");
  caption.className = "option-row-name";
  caption.textContent = name;
  row.append(caption);
  for (const option of options) {
    const button = textButton("option", option.label);
    button.dataset.id = option.id;
    button.addEventListener("click", () => {
      choose(option.id);
      syncListOptions();
      fillRows();
      paint(player.snapshot());
      syncUrl();
    });
    row.append(button);
  }
  return row;
}

function syncListOptions() {
  const current = { "rating-filter": ratingFilter, "sort-order": sortOrder };
  for (const [id, value] of Object.entries(current)) {
    for (const button of document.querySelectorAll(`#${id} .option`)) {
      button.setAttribute("aria-pressed", button.dataset.id === value ? "true" : "false");
    }
  }
  const toggle = document.getElementById("list-options-toggle");
  if (!toggle) return;
  const parts = [];
  if (sortOrder !== SORT_ORDERS[0].id) parts.push(SORT_ORDERS.find((o) => o.id === sortOrder).label);
  if (ratingFilter !== RATING_FILTERS[0].id) parts.push(RATING_FILTERS.find((o) => o.id === ratingFilter).label);
  toggle.textContent = parts.length ? parts.join(" · ") : t("list.options");
  toggle.classList.toggle("is-set", parts.length > 0);
}

function libraryOrder(patterns) {
  const kinds = kindList();
  return patterns
    .map((pattern, index) => ({ pattern, index }))
    .sort((a, b) => kinds.indexOf(a.pattern.kind) - kinds.indexOf(b.pattern.kind) || a.index - b.index)
    .map((entry) => entry.pattern);
}

function filtersActive() {
  return kindFilter !== "All" || ratingFilter !== RATING_FILTERS[0].id;
}

function fillRows() {
  const rows = document.getElementById("rows");
  if (!rows) return;
  for (const chip of document.querySelectorAll("#dock .chip")) setChipLabel(chip);
  rows.innerHTML = "";
  const visible = PATTERNS.filter(matches);
  const resultCount = document.getElementById("result-count");
  if (resultCount) resultCount.textContent = visible.length === PATTERNS.length ? t("count.all", { n: visible.length }) : t("count.some", { n: visible.length, total: PATTERNS.length });
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = kindFilter === "All" ? t("empty.all") : t("empty.kind", { kind: kindName(kindFilter) });
    const clear = textButton("step-btn", filtersActive() ? t("clear.filters") : t("clear.search"));
    clear.addEventListener("click", () => {
      query = "";
      kindFilter = "All";
      ratingFilter = RATING_FILTERS[0].id;
      syncListOptions();
      const find = document.getElementById("find");
      find.value = "";
      for (const chip of document.querySelectorAll("#dock .chip")) {
        chip.setAttribute("aria-pressed", chip.dataset.kind === "All" ? "true" : "false");
      }
      fillRows();
      paint(player.snapshot());
      syncUrl();
      find.focus();
    });
    empty.append(clear);
    rows.append(empty);
    return;
  }
  const sort = optionFor(SORT_ORDERS, sortOrder);
  if (sort.compare) {
    const section = document.createElement("section");
    section.className = "group";
    section.setAttribute("aria-label", sort.label);
    for (const pattern of libraryOrder(visible).sort(sort.compare)) section.append(rowFor(pattern));
    rows.append(section);
    return;
  }
  for (const kind of kindList()) {
    const items = visible.filter((pattern) => pattern.kind === kind);
    if (items.length === 0) continue;
    const section = document.createElement("section");
    section.className = "group";
    const heading = document.createElement("h2");
    heading.className = "kind";
    heading.textContent = kindName(kind);
    section.append(heading);
    if (kindNote(kind)) {
      const note = document.createElement("p");
      note.className = "kind-note";
      note.textContent = kindNote(kind);
      section.append(note);
    }
    for (const pattern of items) section.append(rowFor(pattern));
    rows.append(section);
  }
}

const SOFT_BELOW = 0.6;

function barBeats(pattern) {
  return pattern.beatsPerBar || 4;
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
const learned = readStore(LEARNED_KEY);

const RATINGS_KEY = "disc-kurd-ratings";
const STAR_COUNT = 5;
const ratings = readStore(RATINGS_KEY);

function ratingOf(pattern) {
  const stars = ratings[pattern.id];
  return Number.isInteger(stars) && stars >= 1 && stars <= STAR_COUNT ? stars : 0;
}

function setRating(pattern, stars) {
  if (stars) ratings[pattern.id] = stars;
  else delete ratings[pattern.id];
  writeStore(RATINGS_KEY, ratings);
}

function starLabel(stars) {
  return plural(stars, "stars");
}

function paintStars(group, pattern) {
  const current = ratingOf(pattern);
  for (const star of group.querySelectorAll(".star")) {
    const value = Number(star.dataset.stars);
    star.classList.toggle("is-on", value <= current);
    star.setAttribute("aria-pressed", String(value === current));
    star.title = value === current ? t("rating.clear") : t("rating.rate", { stars: starLabel(value) });
  }
  group.querySelector(".rating-text").textContent = current ? t("rating.yours", { stars: starLabel(current) }) : "";
}

function ratingControl(pattern) {
  const group = document.createElement("div");
  group.className = "rating";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", t("rating.group", { title: pieceText(pattern, "title") }));
  const stars = document.createElement("div");
  stars.className = "stars";
  for (let value = 1; value <= STAR_COUNT; value += 1) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star";
    star.dataset.stars = String(value);
    star.setAttribute("aria-label", starLabel(value));
    star.textContent = "\u2605";
    star.addEventListener("click", () => {
      setRating(pattern, ratingOf(pattern) === value ? 0 : value);
      paintStars(group, pattern);
      fillRows();
      paint(player.snapshot());
    });
    stars.append(star);
  }
  const text = document.createElement("span");
  text.className = "rating-text";
  text.setAttribute("aria-live", "polite");
  group.append(stars, text);
  paintStars(group, pattern);
  return group;
}

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
  fillRows();
  paint(player.snapshot());
}

function barsOf(pattern, range) {
  if (!range) return null;
  const beats = barBeats(pattern);
  return { first: Math.round(range.from / beats), end: Math.round(range.to / beats) };
}

function countLabel(beat, pattern) {
  return digits(beatLabel(beat, pattern).replace(/ (and|e|a)$/, (m, word) => t(`count.${word}`)));
}

function barSpan(first, end) {
  return end - first === 1 ? t("span.bar", { n: first + 1 }) : t("span.bars", { first: first + 1, end });
}

function learnedLine(pattern) {
  const names = partNames(pattern);
  const done = names.filter((name) => isLearned(pattern, name)).length;
  if (done === 0) return "";
  if (names.length === 1) return t("learned.one");
  return t("learned.some", { done, total: names.length });
}

function thumbFor(pattern, size) {
  const thumb = document.createElement("img");
  thumb.className = "thumb";
  thumb.src = `img/thumbs/${pattern.id}.webp`;
  thumb.alt = "";
  thumb.width = size;
  thumb.height = size;
  thumb.decoding = "async";
  thumb.loading = "lazy";
  thumb.addEventListener("error", () => thumb.remove());
  return thumb;
}

function rowFor(pattern) {
  const row = document.createElement("article");
  row.className = "row";
  row.dataset.pattern = pattern.id;
  const open = document.createElement("a");
  open.className = "open";
  open.href = `#/p/${pattern.id}`;
  const body = document.createElement("div");
  body.className = "row-body";
  const title = document.createElement("h3");
  title.textContent = pieceText(pattern, "title");
  const meta = document.createElement("p");
  meta.className = "meta";
  const bars = Math.ceil(pattern.loopBeats / barBeats(pattern));
  meta.textContent = t("row.meta", { bars: plural(bars, "bars"), bpm: pattern.bpm, learned: learnedLine(pattern) });
  const added = addedLabel(pattern, "short");
  if (added) {
    const when = document.createElement("time");
    when.className = "row-added";
    when.dateTime = addedOf(pattern);
    when.textContent = t("row.added", { date: added });
    meta.append(" \u00b7 ", when);
  }
  const stars = ratingOf(pattern);
  if (stars) {
    const rated = document.createElement("span");
    rated.className = "row-rating";
    rated.setAttribute("aria-label", t("rating.rated.label", { stars: starLabel(stars) }));
    rated.textContent = `\u2605 ${digits(stars)}`;
    meta.append(" \u00b7 ", rated);
  }
  if (isNew(pattern)) {
    const badge = document.createElement("span");
    badge.className = "row-new";
    badge.textContent = t("row.new");
    title.append(" ", badge);
  }
  body.append(title, meta);
  const arrow = document.createElement("span");
  arrow.className = "row-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "›";
  open.append(thumbFor(pattern, 48), body, arrow);
  row.append(open);
  return row;
}

function updateResume() {
  const button = document.getElementById("practice-continue");
  if (!button) return;
  const pattern = PATTERNS.find((item) => item.id === practiceSaved?.patternId);
  button.hidden = !pattern;
  button.textContent = pattern ? t("start.continue", { title: pieceText(pattern, "title") }) : "";
  const beginner = document.getElementById("practice-beginner");
  beginner.classList.toggle("is-main", !pattern);
  beginner.textContent = pattern ? t("start.new") : t("start.learning");
}

function rememberPractice() {
  if (!practice) return;
  practiceSaved = { version: 1, patternId: practice.pattern.id, phrase: practice.at, tempo: practice.tempo };
  try {
    savePractice(localStorage, practiceSaved, PATTERNS);
  } catch {
    void 0;
  }
  updateResume();
  scheduleSync();
}

function requestPractice(pattern) {
  if (pattern) location.hash = `#/p/${pattern.id}/learn`;
}

function enterPractice(pattern, saved = null) {
  player.pause();
  stopListening("");
  const phrases = phrasesOf(pattern);
  if (!phrases.length) return;
  const at = Math.min(phrases.length - 1, Math.max(0, saved?.phrase ?? 0));
  practice = {
    pattern,
    phrases,
    at,
    tempo: pattern.bpm,
    mode: "ready",
    attempt: createNotePractice(phrases[at].events),
    message: t("practice.welcome"),
    pending: false,
  };
  selectPhrase(at);
}

function selectPhrase(at) {
  player.pause();
  practice.at = Math.max(0, Math.min(practice.phrases.length - 1, at));
  practice.mode = "ready";
  practice.pending = false;
  practice.run = (practice.run || 0) + 1;
  const phrase = practice.phrases[practice.at];
  practice.attempt.reset(phrase.events);
  practice.message = phrase.events.length ? t("practice.chooseMode") : t("practice.silentBar");
  player.setRange(phrase.events.length ? { from: phrase.from, to: phrase.to } : null);
  player.setLoop(false);
  player.setTempo(practice.tempo);
  if (phrase.events.length) player.seek(phrase.events[0].index, false, true);
  rememberPractice();
  renderLearn(practice.pattern);
  paint(player.snapshot());
}

function leavePractice() {
  if (!practice) return;
  const pattern = practice.pattern;
  practice = null;
  player.load(pattern);
  document.body.classList.remove("is-practicing");
}

function tryPhrase() {
  if (!practice) return;
  player.pause();
  practice.pending = false;
  practice.run += 1;
  practice.mode = "try";
  const phrase = practice.phrases[practice.at];
  const attempt = practice.attempt.reset(phrase.events);
  player.setLoop(false);
  practice.message = attempt.complete ? t("practice.silentTry") : t("practice.tapLit");
  if (attempt.target) player.seek(attempt.target.index, false, true);
  updatePractice(player.snapshot());
}

async function playPhrase(mode, resume = false) {
  if (!practice) return;
  const session = practice;
  const run = ++session.run;
  const phrase = session.phrases[session.at];
  if (!phrase.events.length) return;
  player.pause();
  session.mode = mode;
  session.attempt.reset(phrase.events);
  session.message = mode === "hear" ? t("practice.listenOnce") : t("practice.repeatBar");
  player.setLoop(mode === "repeat");
  player.setTempo(session.tempo);
  session.pending = true;
  updatePractice(player.snapshot());
  try {
    if (resume) await player.resume();
    else await player.play(session.pattern, phrase.from, { keepTempo: true });
  } catch {
    if (practice === session && session.run === run) session.message = t("practice.soundFailed");
  } finally {
    if (practice === session && session.run === run) {
      session.pending = false;
      updatePractice(player.snapshot());
    }
  }
}

function pausePractice() {
  if (!practice || !["hear", "repeat"].includes(practice.mode)) return;
  if (player.playing || practice.pending) {
    practice.pending = false;
    practice.run += 1;
    player.pause();
    practice.message = t("practice.paused");
    updatePractice(player.snapshot());
  } else playPhrase(practice.mode, true);
}

function practicePanel() {
  const panel = document.createElement("section");
  panel.className = "practice-panel";
  panel.setAttribute("aria-label", t("practice.panel"));
  const position = document.createElement("strong");
  position.id = "practice-position";
  position.tabIndex = -1;
  const modes = document.createElement("div");
  modes.className = "practice-actions";
  for (const [id, label, action] of [
    ["hear", t("practice.hear"), () => playPhrase("hear")],
    ["try", t("practice.try"), tryPhrase],
    ["repeat", t("practice.repeat"), () => playPhrase("repeat")],
  ]) {
    const button = textButton("practice-mode", label);
    button.id = `practice-${id}`;
    button.addEventListener("click", action);
    modes.append(button);
  }
  const target = document.createElement("p");
  target.id = "practice-target";
  const next = document.createElement("p");
  next.id = "practice-next";
  const message = document.createElement("p");
  message.id = "practice-message";
  message.setAttribute("role", "status");
  const actions = document.createElement("div");
  actions.className = "practice-actions";
  const pause = textButton("", t("pause"));
  pause.id = "practice-pause";
  pause.addEventListener("click", pausePractice);
  const restart = textButton("", t("practice.restart"));
  restart.id = "practice-restart";
  restart.addEventListener("click", () => {
    if (["hear", "repeat"].includes(practice.mode)) playPhrase(practice.mode);
    else tryPhrase();
  });
  const tak = textButton("", t("practice.tak"));
  tak.id = "practice-tak";
  tak.addEventListener("click", () => soundNote(TAK));
  const back = textButton("", t("practice.previous"));
  back.id = "practice-previous";
  back.addEventListener("click", () => {
    selectPhrase(practice.at - 1);
    const target = document.getElementById("practice-previous");
    (target.disabled ? document.getElementById("practice-position") : target).focus({ preventScroll: true });
  });
  const forward = textButton("", t("practice.next"));
  forward.id = "practice-forward";
  forward.addEventListener("click", () => {
    selectPhrase(practice.at + 1);
    const target = document.getElementById("practice-forward");
    (target.disabled ? document.getElementById("practice-position") : target).focus({ preventScroll: true });
  });
  actions.append(pause, restart, tak);
  const navigation = document.createElement("div");
  navigation.className = "phrase-navigation";
  navigation.append(back, forward);
  const help = document.createElement("details");
  help.className = "practice-help";
  const summary = document.createElement("summary");
  summary.textContent = t("practice.help");
  const explanation = document.createElement("p");
  explanation.textContent = t("practice.explain");
  help.append(summary, explanation);
  panel.append(position, target, next, modes, actions, message, navigation, help);
  for (const button of panel.querySelectorAll(".practice-actions button, .phrase-navigation button")) {
    button.classList.add("practice-control");
  }
  return panel;
}

function updatePractice(snap) {
  if (!practice || !document.getElementById("practice-position")) return;
  const phrase = practice.phrases[practice.at];
  const attempt = practice.attempt.snapshot();
  const active = ["hear", "repeat"].includes(practice.mode);
  const at = active ? phrase.events.findIndex((event) => event.index === snap.index) : attempt.at;
  const target = active ? phrase.events[at] : attempt.target;
  const next = phrase.events[at + 1];
  const describe = (event) => event ? event.notes.map((id) => `${id === TAK ? t("practice.tak.name") : digits(numberOf(id))} (${t("hand.label", { hand: handName(flipHand(event.hands[id]) || "either") })})`).join(" + ") : t("practice.none");
  const set = (id, text) => {
    const node = document.getElementById(id);
    if (node.textContent !== text) node.textContent = text;
  };
  set("practice-position", `${t("practice.position", { at: practice.at + 1, total: practice.phrases.length, span: barSpan(phrase.first, phrase.end) })}${phrase.name ? ` · ${partName(phrase.name)}` : ""}`);
  set("practice-target", !phrase.events.length ? t("practice.rest") : attempt.complete && practice.mode === "try" ? t("practice.complete") : t("practice.current", { target: describe(target) }));
  set("practice-next", `${t("practice.nextIs", { target: describe(next) })}${attempt.partial.length ? t("practice.tapped", { notes: attempt.partial.map((id) => id === TAK ? t("practice.tak.name") : numberOf(id)).join(" + ") }) : ""}`);
  set("practice-message", active && snap.ended ? t("practice.heardAll") : practice.message);
  set("practice-restart", practice.mode === "try" && attempt.complete ? t("practice.retry") : t("practice.restart"));
  document.getElementById("practice-restart").hidden = practice.mode === "ready" || !phrase.events.length;
  document.getElementById("practice-tak").hidden = practice.mode !== "try" || !phrase.events.some((event) => event.notes.includes(TAK));
  const pause = document.getElementById("practice-pause");
  pause.hidden = !active;
  pause.disabled = !active || !phrase.events.length;
  pause.textContent = snap.playing || practice.pending ? t("pause") : t("resume");
  document.getElementById("practice-previous").disabled = practice.at === 0;
  document.getElementById("practice-forward").disabled = practice.at === practice.phrases.length - 1;
  for (const mode of ["hear", "try", "repeat"]) {
    const button = document.getElementById(`practice-${mode}`);
    button.setAttribute("aria-pressed", String(practice.mode === mode));
    button.classList.toggle("is-main", practice.mode === "ready" && mode === "hear");
    button.disabled = !phrase.events.length;
  }
}

function shareUrl(pattern) {
  return new URL(`p/${pattern.id}`, document.baseURI).href;
}

async function sharePiece(pattern) {
  const url = shareUrl(pattern);
  const status = document.getElementById("status");
  const data = { title: t("piece.title", { title: pieceText(pattern, "title") }), text: pieceText(pattern, "blurb"), url };
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = t("share.copied");
  } catch {
    status.textContent = t("share.failed", { url });
  }
}

function controlIcon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  return svg;
}

function renderLearn(pattern) {
  transportObserver.disconnect();
  document.querySelector(".transport-settings")?.remove();
  lastScroll = -2;
  settled = false;
  followPaused = false;
  followDeparted = false;
  document.title = t("piece.title", { title: pieceText(pattern, "title") });
  const dock = document.getElementById("learn");
  dock.innerHTML = "";

  const head = document.createElement("div");
  head.className = "learn-head";
  const back = document.createElement("a");
  back.className = "back";
  back.href = "#/";
  back.textContent = t("library");
  const title = document.createElement("h1");
  title.tabIndex = -1;
  title.textContent = pieceText(pattern, "title");
  const about = document.createElement("p");
  about.className = "about";
  about.textContent = pieceText(pattern, "blurb");
  const name = document.createElement("div");
  name.className = "learn-title";
  name.append(title, about, ratingControl(pattern));
  head.append(back, name);
  const modes = document.createElement("nav");
  modes.className = "piece-modes";
  modes.setAttribute("aria-label", t("piece.mode"));
  for (const mode of ["play", "learn"]) {
    const link = document.createElement("a");
    link.className = "mode-link";
    link.href = `#/p/${pattern.id}/${mode}`;
    link.textContent = t(mode);
    if (mode === (practice ? "learn" : "play")) link.setAttribute("aria-current", "page");
    modes.append(link);
  }
  const share = document.createElement("button");
  share.type = "button";
  share.className = "mode-link share-link";
  share.setAttribute("aria-label", t("share"));
  share.append(controlIcon("M12 16V3 M7 8l5-5 5 5 M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"));
  share.title = t("share.hint");
  share.addEventListener("click", () => sharePiece(pattern));
  modes.append(share);
  head.append(modes);

  const warn = document.createElement("p");
  warn.className = "mirror-note";
  warn.hidden = !mirrored;
  warn.textContent = t("mirror.note");

  const transport = document.createElement("div");
  transport.className = "transport";

  const play = document.createElement("button");
  play.type = "button";
  play.id = "play";
  play.className = "play";
  const playMark = document.createElement("span");
  playMark.className = "mark";
  playMark.textContent = t("play");
  play.append(playMark);
  play.addEventListener("click", () => {
    if (learnMode()) return;
    if (player.playing) {
      player.pause();
      return;
    }
    if (player.canResume && player.pattern && player.pattern.id === pattern.id) {
      player.resume().catch(audioError);
      return;
    }
    player.play(pattern, 0, { keepTempo: true }).catch(audioError);
  });

  const loop = document.createElement("button");
  loop.type = "button";
  loop.id = "loop";
  loop.className = "loop";
  loop.append(controlIcon("M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3"));
  loop.addEventListener("click", () => {
    if (learnMode()) return;
    if (player.range) clearRange();
    else player.setLoop(!player.loop);
  });

  const ranged = document.createElement("button");
  ranged.type = "button";
  ranged.id = "range";
  ranged.className = "range";
  ranged.hidden = true;
  ranged.addEventListener("click", clearRange);

  transport.append(play);
  const settings = document.createElement("div");
  settings.className = "transport transport-settings";
  settings.setAttribute("role", "region");
  settings.setAttribute("aria-label", t("player.controls"));
  const timeline = document.createElement("div");
  timeline.className = "timeline";
  const scrubber = document.createElement("div");
  scrubber.className = "scrubber";
  const waveform = document.createElement("div");
  waveform.className = "waveform";
  waveform.setAttribute("aria-hidden", "true");
  const events = eventsOf(pattern);
  for (let n = 0; n < 64; n += 1) {
    const start = n * pattern.loopBeats / 64;
    const end = (n + 1) * pattern.loopBeats / 64;
    const count = events.filter(event => event.beat >= start && event.beat < end).length;
    const bar = document.createElement("span");
    bar.style.height = `${Math.min(100, 14 + count * 24)}%`;
    waveform.append(bar);
  }
  const seek = document.createElement("input");
  seek.id = "seek";
  seek.type = "range";
  seek.min = "0";
  seek.max = String(pattern.loopBeats);
  seek.step = "0.001";
  seek.value = "0";
  seek.disabled = !events.length;
  seek.setAttribute("aria-label", t("player.seek"));
  function seekTo(event) {
    if (!event) return;
    followPaused = false;
    player.seek(event.index, player.playing, true);
    const bar = document.querySelector(`#sheet [data-event="${event.index}"]`)?.closest(".bar");
    if (bar) keepInView(bar);
  }
  seek.addEventListener("input", () => {
    const beat = Number(seek.value);
    const event = events.reduce((nearest, candidate) => Math.abs(candidate.beat - beat) < Math.abs(nearest.beat - beat) ? candidate : nearest, events[0]);
    seekTo(event);
  });
  seek.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const direction = ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1;
    seekTo(events[Math.max(0, Math.min(events.length - 1, player.index + direction))]);
  });
  const time = document.createElement("span");
  time.id = "playback-time";
  time.className = "playback-time";
  time.setAttribute("aria-hidden", "true");
  scrubber.append(waveform, seek);
  timeline.append(scrubber, time);

  const sheet = sheetOf(pattern);
  const deck = document.createElement("div");
  deck.className = "deck";
  deck.append(transport);
  settings.append(timeline, deck, loop, ranged);

  document.body.classList.toggle("is-practicing", !!practice);
  const notation = sheetNode(pattern, sheet);
  dock.append(head, warn);
  if (practice) {
    const panel = practicePanel();
    panel.querySelector("#practice-next").after(notation);
    dock.append(panel);
  } else {
    dock.append(settings, notation);
    placeDeck();
    transportObserver.observe(settings);
  }
  focusSheet(pattern);
  updatePractice(player.snapshot());
}

const transportObserver = new ResizeObserver(() => {
  const settings = document.querySelector(".transport-settings");
  document.body.style.setProperty("--transport-h", `${settings?.offsetHeight || 0}px`);
});

function placeDeck() {
  const settings = document.querySelector(".transport-settings");
  const notation = document.querySelector("#sheet");
  if (!settings || !notation) return;
  const desktop = window.matchMedia("(min-width: 1001px) and (min-height: 521px)").matches;
  const parent = desktop ? notation.parentElement : document.body;
  if (settings.parentElement === parent) return;
  const focus = settings.contains(document.activeElement) ? document.activeElement : null;
  if (desktop) notation.before(settings);
  else parent.append(settings);
  focus?.focus({ preventScroll: true });
}

window.addEventListener("resize", placeDeck);

function textButton(className, text) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  return node;
}

function focusSheet(pattern) {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;
  const step = practice?.pattern.id === pattern.id ? practice.phrases[practice.at] : null;
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

function noteNode(id, hand) {
  const node = document.createElement("span");
  node.className = `note ${flipHand(hand)}`;
  if (id === TAK) {
    node.textContent = "\u00d7";
    return node;
  }
  node.textContent = digits(numberOf(id));
  return node;
}

function slotNode(pattern, sheet, bar, slot, event) {
  const onBeat = slot % sheet.perBeat === 0;
  const beat = (bar * sheet.perBar + slot) / sheet.perBeat;
  const node = document.createElement(event ? "button" : "span");
  node.className = "slot";
  if (onBeat) node.dataset.count = countLabel(beat, pattern);
  if (!event) return node;
  node.type = "button";
  node.classList.add("hit");
  node.classList.toggle("is-soft", event.notes.every((id) => id === TAK || event.amps[id] < SOFT_BELOW));
  node.dataset.event = String(event.index);
  const names = event.notes.map((id) => `${spokenName(id)}, ${t("hand.label", { hand: handName(flipHand(event.hands[id])) })}`);
  node.setAttribute("aria-label", t("bar.label", { bar: bar + 1, beat: beatLabel(beat, pattern), names: names.join(t("and")) }));
  for (const id of event.notes) node.append(noteNode(id, event.hands[id]));
  node.addEventListener("click", () => {
    if (learnMode()) return;
    player.seek(event.index, player.playing, listener.on);
  });
  if (practice) {
    node.disabled = true;
    node.setAttribute("aria-label", t("bar.play", { label: node.getAttribute("aria-label") }));
  }
  return node;
}

function sheetNode(pattern, sheet) {
  const node = document.createElement("div");
  node.className = "sheet";
  node.id = "sheet";
  node.title = [t("hand.leftLabel"), t("hand.rightLabel"), t("legend.soft"), t("legend.tak"), t("legend.bars")].join(" \u00b7 ");
  node.style.setProperty("--cols", String(sheet.cols));
  sheet.sections.forEach((section, i) => {
    const part = document.createElement("section");
    part.className = "part";
    part.dataset.section = String(i);

    const head = document.createElement("header");
    head.className = "part-head";
    if (section.name) {
      const name = document.createElement("h2");
      name.textContent = partName(section.name);
      const span = document.createElement("span");
      span.className = "part-bars";
      span.textContent = barSpan(section.first, section.end);
      const loop = document.createElement("button");
      loop.type = "button";
      loop.className = "part-loop";
      loop.dataset.from = String(section.first);
      loop.dataset.to = String(section.end);
      loop.append(controlIcon("M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3"), document.createTextNode(t("loop.part")));
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
    done.append(box, ` ${t("learned")}`);
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
      number.textContent = digits(bar.bar + 1);
      number.setAttribute("aria-label", t(practice ? "phrase.barLabel" : "loop.barLabel", { n: bar.bar + 1 }));
      number.disabled = !!practice;
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
    if (learnMode()) return;
    const number = event.target.closest(".bar-num");
    dragFrom = number ? Number(number.parentElement.dataset.bar) : null;
    dragged = false;
  });
  node.addEventListener("pointerup", (event) => {
    if (learnMode()) return;
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
    if (learnMode()) return;
    const number = event.target.closest(".bar-num");
    if (!number || dragged) return;
    pickBar(pattern, Number(number.parentElement.dataset.bar));
  });
  return node;
}

function loopBars(pattern, first, end) {
  if (learnMode()) return;
  const beats = barBeats(pattern);
  player.setRange({ from: first * beats, to: end * beats });
  player.play(pattern, first * beats, { keepTempo: true });
}

function clearRange() {
  if (learnMode()) return;
  const playing = player.playing;
  const at = player.index;
  player.setRange(null);
  if (playing) player.seek(at, true);
}

function pickBar(pattern, bar) {
  const bars = barsOf(pattern, player.range);
  if (!bars) loopBars(pattern, bar, bar + 1);
  else if (bar >= bars.first && bar < bars.end) clearRange();
  else loopBars(pattern, Math.min(bars.first, bar), Math.max(bars.end, bar + 1));
}

function keepInView(node, toTop) {
  const learn = document.getElementById("learn");
  const inner = learn.scrollHeight > learn.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(learn).overflowY);
  const box = node.getBoundingClientRect();
  const { top, bottom } = scoreBounds();
  if (!toTop && box.top >= top + 4 && box.bottom <= bottom - 4) return;
  const shift = box.top - top - 10;
  if (inner) learn.scrollTop += shift;
  else window.scrollBy(0, shift);
}

function scoreBounds() {
  const learn = document.getElementById("learn");
  const box = learn.getBoundingClientRect();
  const controls = document.querySelector(".transport-settings");
  const fixed = controls?.parentElement === document.body;
  const pan = document.body.classList.contains("is-playing") && matchMedia("(max-width: 1000px) and (min-height: 521px)").matches
    ? document.querySelector(".pan-stick") : null;
  const top = Math.max(0, box.top, controls && !fixed ? controls.getBoundingClientRect().bottom : 0, pan?.getBoundingClientRect().bottom || 0);
  const bottom = Math.min(window.innerHeight, box.bottom, fixed ? controls.getBoundingClientRect().top : Infinity);
  return { top, bottom };
}

function pauseFollow(event) {
  if (event?.target.closest(".transport-settings")) return;
  if (!followPaused) {
    const learn = document.getElementById("learn");
    followOrigin = learn.scrollTop + window.scrollY;
    followDeparted = false;
    followPaused = true;
  }
}

function resumeFollowNearCurrent() {
  if (!followPaused) return;
  const learn = document.getElementById("learn");
  const position = learn.scrollTop + window.scrollY;
  if (Math.abs(position - followOrigin) > 80) followDeparted = true;
  if (!followDeparted) return;
  const bar = document.querySelector("#sheet .slot.is-on, #sheet .slot.is-place")?.closest(".bar");
  if (!bar) return;
  const box = bar.getBoundingClientRect();
  const { top, bottom } = scoreBounds();
  if (box.top >= top && box.bottom <= bottom) followPaused = false;
}

document.addEventListener("touchmove", pauseFollow, { passive: true });
document.addEventListener("wheel", pauseFollow, { passive: true });
document.addEventListener("scroll", resumeFollowNearCurrent, true);

function route() {
  routing = true;
  try {
    routeNow();
  } finally {
    routing = false;
  }
  syncUrl();
}

function routeNow() {
  setTools(false);
  const { path, params } = readHash();
  const pattern = patternFromHash();
  const learning = learnMode();
  const changed = routed !== pattern?.id;
  const modeChanged = learning !== !!practice;
  if (!pattern && path !== "#/" && path !== "#") {
    history.replaceState(history.state, "", "#/");
    routeNow();
    return;
  }
  if (stage) stage.selectCourtyard(!!pattern);
  if (routed === null || [...params.keys()].length) applyListParams(params);
  if (practice && (changed || !learning)) leavePractice();
  if (changed || modeChanged) {
    player.pause();
    stopListening("");
  }
  document.body.classList.toggle("is-learn", !!pattern);
  if (!document.getElementById("find")) renderList();
  updateResume();
  const learn = document.getElementById("learn");
  if (!pattern) {
    document.querySelector(".transport-settings")?.remove();
    transportObserver.disconnect();
    document.title = t("app.title");
    learn.replaceChildren();
    paint(player.snapshot());
    const left = routed ? document.querySelector(`.row[data-pattern="${routed}"] .open`) : null;
    if (left) {
      left.focus({ preventScroll: true });
      left.scrollIntoView({ block: "nearest" });
    } else if (routed) document.getElementById("find").focus({ preventScroll: true });
    routed = "";
    drawMic();
    return;
  }
  if (!player.pattern || player.pattern.id !== pattern.id) player.load(pattern);
  const askedPhrase = numberParam(params, "phrase");
  if (learning && !practice) {
    const saved = practiceSaved?.patternId === pattern.id ? { ...practiceSaved } : {};
    if (askedPhrase !== null) saved.phrase = Math.max(0, Math.round(askedPhrase) - 1);
    enterPractice(pattern, saved);
  } else if (learning) {
    const at = askedPhrase === null ? practice.at : Math.round(askedPhrase) - 1;
    if (at !== practice.at) {
      selectPhrase(at);
    }
  } else {
    if (modeChanged) {
      player.setRange(null);
      player.setLoop(pattern.loop !== false);
      player.setTempo(pattern.bpm);
    }
    renderLearn(pattern);
  }
  drawMic();
  if (routed !== null && (changed || modeChanged)) document.querySelector("#learn h1").focus({ preventScroll: true });
  routed = pattern.id;
  if (changed && window.scrollY !== 0) window.scrollTo(0, 0);
  paint(player.snapshot());
}

function paint(snap) {
  document.body.classList.toggle("is-playing", !!snap.playing && !practice);
  if (practice && (!practice.phrases[practice.at].events.length || (practice.mode === "try" && practice.attempt.snapshot().complete))) {
    snap = { ...snap, index: -1, notes: [], nextIndex: -1, nextNotes: [] };
  }
  updatePractice(snap);
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
      const tapped = field.classList.contains("is-tap");
      const lit = sounding || tapped;
      const look = echo ? (heard.miss ? "miss" : "heard") : lit ? "on" : on ? "place" : nextNotes.has(id) ? "next" : "idle";
      const strikeKey = echo ? `heard ${heard.count}` : tapped ? `tap ${tapCounts.get(id)}` : sounding ? `play ${snap.strike}` : null;
      stage.set(id, look, strikeKey);
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
    if (slot) scrollStrip(slot.parentElement, slot);
    if (slot && !practice) {
      if (settled && !followPaused) keepInView(slot.closest(".bar"));
      settled = true;
    }
  }
  const node = caption();
  const text = captionText(snap);
  if (node.textContent !== text) node.textContent = text;
  const status = document.getElementById("status");
  const say = micNote || (listener.on && !snap.playing ? text : "");
  if (status && status.textContent !== say) status.textContent = say;

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
    const label = snap.playing ? t("pause") : player.canResume ? t("resume") : t("play");
    const mark = play.querySelector(".mark");
    if (mark.textContent !== label) mark.textContent = label;
    play.setAttribute("aria-label", label);
    play.title = label;
  }
  const waveform = document.querySelector(".waveform");
  if (waveform) {
    [...waveform.children].forEach((bar, index) => bar.classList.toggle("played", index / waveform.children.length < snap.progress));
  }
  const seek = document.getElementById("seek");
  if (seek && player.pattern) {
    seek.value = String(snap.progress * player.pattern.loopBeats);
    const total = player.pattern.loopBeats * 60 / snap.bpm;
    const elapsed = total * snap.progress;
    const time = document.getElementById("playback-time");
    const label = t("player.position", { elapsed: playbackTime(elapsed), total: playbackTime(total) });
    if (seek.getAttribute("aria-valuetext") !== label) seek.setAttribute("aria-valuetext", label);
    const text = `${playbackTime(elapsed)} / ${playbackTime(total)}`;
    if (time.textContent !== text) time.textContent = text;
  }
  const loop = document.getElementById("loop");
  if (loop) {
    loop.setAttribute("aria-pressed", snap.loop ? "true" : "false");
    const label = snap.range ? t("loop.bars") : t("loop");
    loop.setAttribute("aria-label", label);
    loop.title = label;
  }
  const warn = document.querySelector(".mirror-note");
  if (warn) warn.hidden = !mirrored;
}

function playbackTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return digits(`${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`);
}

function paintRange(snap) {
  const pattern = PATTERNS.find((item) => item.id === snap.patternId);
  const bars = pattern ? barsOf(pattern, snap.range) : null;
  const first = bars ? bars.first : -1;
  const end = bars ? bars.end : -1;
  const key = `${snap.patternId} ${first} ${end}`;
  const sheet = document.getElementById("sheet");
  if (!sheet || sheet.dataset.range === key) return;
  sheet.dataset.range = key;
  for (const bar of sheet.querySelectorAll(".bar")) {
    const n = Number(bar.dataset.bar);
    bar.classList.toggle("in-range", n >= first && n < end);
  }
  for (const button of sheet.querySelectorAll(".part-loop")) {
    const whole = Number(button.dataset.from) === first && Number(button.dataset.to) === end;
    button.setAttribute("aria-pressed", whole ? "true" : "false");
  }
  const ranged = document.getElementById("range");
  if (ranged) {
    ranged.hidden = first < 0;
    ranged.textContent = end - first === 1 ? t("loop.bar", { first: first + 1 }) : t("loop.range", { first: first + 1, end });
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
  return hand ? t("note.named", { number: numberOf(id), hand: handName(hand) }) : numberOf(id);
}

function captionText(snap) {
  if (practice?.mode === "try" && practice.attempt.snapshot().complete) return t("caption.phraseDone");
  if (practice && !practice.phrases[practice.at].events.length) return t("caption.restBar");
  if (listener.on && !snap.playing) {
    const wanted = patternFromHash() ? pitched(snap.notes) : [];
    const target = wanted.map((id) => spoken(id, snap.hands)).join(t("and"));
    const name = heard ? digits(numberOf(heard.id)) : "";
    if (heard && heard.miss) return t("caption.heardMiss", { name, target });
    if (heard) return target ? t("caption.heardNext", { name, target }) : t("caption.heard", { name });
    return target ? t("caption.play", { target }) : t("caption.listening");
  }
  if (!snap.notes.length) {
    if (!snap.patternId) return t("caption.tap");
    const pattern = PATTERNS.find((item) => item.id === snap.patternId);
    return pattern ? t("caption.playOrTap") : t("caption.tap");
  }
  return snap.notes
    .map((id) => spoken(id, snap.hands))
    .join(" and ");
}

document.getElementById("listen").addEventListener("click", toggleListen);


window.addEventListener("hashchange", route);
window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || document.body.classList.contains("is-exploring")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, select") || event.target.isContentEditable) return;
  if (/^(Digit[0-9]|Numpad[0-9]|KeyT)$/.test(event.code)) {
    event.preventDefault();
    if (!event.repeat) {
      const id = event.code === "KeyT" ? TAK : Object.keys(NOTES).find((note) => numberOf(note) === event.code.slice(-1));
      if (id) soundNote(id);
    }
    return;
  }
  if (practice && event.repeat && ["Space", "Enter"].includes(event.code)) {
    event.preventDefault();
    return;
  }
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
    if (event.repeat) return;
    if (practice) {
      if (!event.repeat) pausePractice();
      return;
    }
    const play = document.getElementById("play");
    if (play) {
      play.click();
      return;
    }
    return;
  }
  if (!document.body.classList.contains("is-learn")) return;
  if (event.code === "ArrowRight") {
    event.preventDefault();
    if (!learnMode()) player.step(1, listener.on);
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    if (!learnMode()) player.step(-1, listener.on);
  }
});

const MIC_KEY = "disc-kurd-mic";
const MIC_QUIET_MS = 4000;
const MIC_QUIET_LEVEL = 0.06;
let micState = "off";
let micQuietSince = 0;
let micGeneration = 0;
let micPending = null;

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
  if (name === "NotAllowedError") return t("mic.blocked");
  if (name === "NotFoundError") return t("mic.missing");
  if (name === "NotReadableError") return t("mic.busy");
  return t("mic.failed");
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
  document.getElementById("game").hidden = micState !== "on";
  if (micState === "asking") setMicText(t("mic.asking"));
  if (micState === "error") setMicText(micNote);
  const button = document.getElementById("listen");
  button.setAttribute("aria-pressed", listener.on ? "true" : "false");
  button.disabled = learnMode();
  button.querySelector(".tool-text").textContent = listener.on ? t("mic.on") : t("mic");
  button.title = learnMode() ? t("mic.hint.learn") : t("mic.hint");
  document.getElementById("mic-context").hidden = !learnMode();
}

async function fillMicList() {
  const select = document.getElementById("mic-input");
  const found = await listener.inputs();
  select.replaceChildren(
    ...found.map((device, i) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || t("mic.device", { n: i + 1 });
      return option;
    }),
  );
  select.value = listener.deviceId;
  if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
  syncPickTitle(select);
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
  setMicText(quiet ? t("mic.quiet") : t("mic.listening"));
  requestAnimationFrame(meterLoop);
}

async function startListening(deviceId) {
  if (learnMode()) return;
  const generation = ++micGeneration;
  if (micPending) {
    try { await micPending; } catch { void 0; }
    if (generation !== micGeneration) return;
  }
  audio.recordingMode(true);
  micNote = "";
  micState = "asking";
  drawMic();
  try {
    const pending = listener.start(deviceId);
    micPending = pending;
    try { await pending; } finally { if (micPending === pending) micPending = null; }
    if (generation !== micGeneration) {
      listener.stop();
      audio.recordingMode(false);
      return;
    }
  } catch (err) {
    if (generation !== micGeneration) return;
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
  game.rest();
  drawGame(null);
  saveMic(listener.deviceId);
  await fillMicList();
  if (generation !== micGeneration) return;
  drawMic();
  meterLoop();
  player.refresh();
}

function stopListening(note) {
  micGeneration += 1;
  listener.stop();
  audio.recordingMode(false);
  game.rest();
  if (stage) stage.magic(0);
  micNote = note || "";
  micState = note ? "error" : "off";
  drawMic();
  player.refresh();
}

function onMicEnded() {
  stopListening(t("mic.disconnected"));
}

async function toggleListen() {
  if (learnMode()) return;
  if (listener.on || micState === "asking") {
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

explore = initExplore({
  world: () => stage,
  onOpen: () => {
    setTools(false);
    if (practice && ["hear", "repeat"].includes(practice.mode) && (player.playing || practice.pending)) {
      pausePractice();
    } else if (practice) {
      practice.pending = false;
      practice.run += 1;
    }
    player.pause();
    stopListening("");
  },
});
drawPan();
route();
bootStage();
