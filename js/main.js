import {
  NOTES,
  FIELDS,
  SIDE,
  PATTERNS,
  eventsOf,
  cellsOf,
  beatLabel,
  pretty,
} from "./score.js";
import { createAudio } from "./sound.js";
import { createPlayer } from "./play.js";

const audio = createAudio();
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let mirrored = false;
try {
  mirrored = localStorage.getItem("disc-kurd-mirror") === "1";
} catch (err) {
  void err;
}

const caption = () => document.getElementById("caption");
let lastScroll = -2;

const player = createPlayer(audio, paint);

function flipHand(hand) {
  if (!mirrored || !hand) return hand;
  if (hand === "left") return "right";
  if (hand === "right") return "left";
  return hand;
}

function dimpleLabel(id) {
  const hand = flipHand(SIDE[id]);
  const name = id === "D3" ? "ding D3" : pretty(id);
  return `${name}, ${hand} hand`;
}

function place(deg, orbit) {
  const shown = mirrored ? (360 - deg) % 360 : deg;
  const math = (shown * Math.PI) / 180 - Math.PI / 2;
  return [210 + Math.cos(math) * orbit, 210 + Math.sin(math) * orbit];
}

function fieldMarkup(id, x, y, radius, ding) {
  const note = NOTES[id];
  const wide = note.letter.length > 1;
  const nameSize = ding ? 46 : wide ? 20 : 24;
  const nameY = ding ? 6 : 8;
  const octY = ding ? -22 : -12;
  const octSize = ding ? 16 : 13;
  return `<g class="field${ding ? " ding" : ""}" data-note="${id}" role="button" tabindex="0" transform="translate(${x} ${y})" aria-label="${dimpleLabel(id)}">
    <circle class="field-shade" r="${radius}" fill="url(#dimple)"></circle>
    <circle class="field-face" r="${radius * 0.72}" fill="#4e3b2e"></circle>
    <text class="field-name" style="font-size:${nameSize}px" y="${nameY}">${note.letter}</text>
    <text class="field-oct" style="font-size:${octSize}px" y="${octY}">${note.octave}</text>
    ${ding ? '<text class="field-role" y="22">ding</text>' : ""}
  </g>`;
}

function drawPan() {
  const ring = ["A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "C5"]
    .map((id) => {
      const field = FIELDS.find((item) => item.id === id);
      const [x, y] = place(field.deg, 122);
      return fieldMarkup(id, x, y, 30, false);
    })
    .join("");
  const ding = fieldMarkup("D3", 210, 210, 54, true);
  document.getElementById("pan").innerHTML = `<svg class="pan-svg" viewBox="0 0 420 420" role="group">
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
    <circle cx="210" cy="210" r="160" fill="none" stroke="#f3e2cc" stroke-opacity="0.13"/>
    <circle cx="210" cy="210" r="132" fill="none" stroke="#f3e2cc" stroke-opacity="0.08"/>
    <circle cx="210" cy="210" r="96" fill="none" stroke="#1a100c" stroke-opacity="0.28"/>
    <ellipse cx="164" cy="146" rx="74" ry="32" fill="#fff6e8" opacity="0.16" transform="rotate(-32 164 146)"/>
    ${ring}
    ${ding}
  </svg>`;
  const svg = document.querySelector(".pan-svg");
  svg.addEventListener("click", onPanHit);
  svg.addEventListener("keydown", onPanKey);
  syncMirror();
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
  audio.resume().then(() => audio.strikeChord([id], audio.now() + 0.02));
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
    const name = id === "D3" ? "ding" : pretty(id);
    const node = caption();
    if (node) node.textContent = hand ? `${name}, ${hand} hand` : name;
  }
}

function syncMirror() {
  const button = document.getElementById("mirror");
  button.setAttribute("aria-pressed", mirrored ? "true" : "false");
  button.textContent = mirrored ? "Mirrored" : "Mirror";
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

function renderList() {
  document.title = "DISC D Kurd";
  const groups = [];
  for (const pattern of PATTERNS) {
    let group = groups.find((item) => item.stage === pattern.stage);
    if (!group) {
      group = { stage: pattern.stage, items: [] };
      groups.push(group);
    }
    group.items.push(pattern);
  }
  const dock = document.getElementById("dock");
  dock.innerHTML = "";
  const heading = document.createElement("h1");
  heading.textContent = "Patterns";
  dock.append(heading);
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = "Play a pattern against the pan. Open it when you want the notes written out.";
  dock.append(lead);
  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "group";
    const stage = document.createElement("h2");
    stage.className = "stage";
    stage.textContent = group.stage;
    section.append(stage);
    for (const pattern of group.items) {
      section.append(rowFor(pattern));
    }
    dock.append(section);
  }
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
    player.setLoop(true);
    player.play(pattern, 0);
  });

  const body = document.createElement("div");
  body.className = "row-body";
  const title = document.createElement("h3");
  title.textContent = pattern.title;
  const blurb = document.createElement("p");
  blurb.textContent = pattern.blurb;
  const mini = document.createElement("div");
  mini.className = "mini";
  for (const event of eventsOf(pattern)) {
    const chip = document.createElement("span");
    chip.className = "mini-hit";
    chip.dataset.event = String(event.index);
    chip.textContent = event.notes.map((id) => pretty(id)).join(" ");
    mini.append(chip);
  }
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `${eventsOf(pattern).length} hits at ${pattern.bpm}`;
  body.append(title, blurb, mini, meta);

  const open = document.createElement("a");
  open.className = "open";
  open.href = `#/p/${pattern.id}`;
  open.textContent = "Learn";

  row.append(play, body, open);
  return row;
}

function renderLearn(pattern) {
  document.title = `${pattern.title} - DISC D Kurd`;
  const dock = document.getElementById("dock");
  dock.innerHTML = "";

  const head = document.createElement("div");
  head.className = "learn-head";
  const back = document.createElement("a");
  back.className = "back";
  back.href = "#/";
  back.textContent = "All patterns";
  const title = document.createElement("h1");
  title.textContent = pattern.title;
  head.append(back, title);

  const about = document.createElement("p");
  about.className = "about";
  about.textContent = pattern.about;

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
  previous.className = "stepper";
  previous.textContent = "Previous";
  previous.addEventListener("click", () => nudge(-1));

  const next = document.createElement("button");
  next.type = "button";
  next.className = "stepper";
  next.textContent = "Next";
  next.addEventListener("click", () => nudge(1));

  const tempoLabel = document.createElement("label");
  tempoLabel.className = "tempo";
  tempoLabel.append("Tempo ");
  const bpm = document.createElement("span");
  bpm.id = "bpm";
  bpm.textContent = String(player.pattern && player.pattern.id === pattern.id ? player.bpm : pattern.bpm);
  const range = document.createElement("input");
  range.id = "tempo";
  range.type = "range";
  range.min = "48";
  range.max = "140";
  range.step = "1";
  range.value = bpm.textContent;
  range.addEventListener("input", () => {
    bpm.textContent = range.value;
    player.setTempo(Number(range.value));
  });
  tempoLabel.append(bpm, range);

  const loop = document.createElement("button");
  loop.type = "button";
  loop.id = "loop";
  loop.className = "loop";
  loop.textContent = "Loop";
  loop.addEventListener("click", () => {
    player.setLoop(!player.loop);
  });

  const keys = document.createElement("p");
  keys.className = "keys";
  keys.textContent = "Space plays and pauses. Arrow keys move one note.";

  transport.append(play, previous, next, tempoLabel, loop);

  const roll = document.createElement("div");
  roll.className = "roll";
  roll.id = "roll";
  for (const cell of cellsOf(pattern)) {
    if (cell.rest) {
      const rest = document.createElement("div");
      rest.className = "rest";
      const count = document.createElement("span");
      count.className = "step-count";
      count.textContent = beatLabel(cell.beat);
      const word = document.createElement("span");
      word.className = "rest-word";
      word.textContent = "ring";
      rest.append(count, word);
      roll.append(rest);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "step";
    button.dataset.event = String(cell.index);
    if (pattern.loopBeats > 4 && cell.beat % 4 === 0) {
      const bar = document.createElement("span");
      bar.className = "step-bar";
      bar.textContent = `Bar ${Math.floor(cell.beat / 4) + 1}`;
      button.append(bar);
    }
    const count = document.createElement("span");
    count.className = "step-count";
    count.textContent = beatLabel(cell.beat);
    const notes = document.createElement("span");
    notes.className = "step-notes";
    for (const id of cell.notes) {
      const name = document.createElement("span");
      name.className = "step-note";
      name.textContent = pretty(id);
      notes.append(name);
    }
    const hand = document.createElement("span");
    hand.className = "step-hand";
    const hands = {};
    for (const id of cell.notes) hands[id] = cell.hands[id];
    hand.textContent = handLine(hands);
    button.append(count, notes, hand);
    button.addEventListener("click", () => {
      player.seek(cell.index, player.playing);
    });
    roll.append(button);
  }

  const firstEvent = eventsOf(pattern)[0];
  if (firstEvent && eventsOf(pattern).length > 1) {
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "step";
    preview.dataset.loopNext = "0";
    preview.setAttribute("aria-label", "Back to the first note");
    const count = document.createElement("span");
    count.className = "step-count";
    count.textContent = beatLabel(firstEvent.beat);
    const notes = document.createElement("span");
    notes.className = "step-notes";
    for (const id of firstEvent.notes) {
      const name = document.createElement("span");
      name.className = "step-note";
      name.textContent = pretty(id);
      notes.append(name);
    }
    const hand = document.createElement("span");
    hand.className = "step-hand";
    hand.textContent = handLine(firstEvent.hands);
    preview.append(count, notes, hand);
    preview.addEventListener("click", () => {
      player.seek(0, player.playing);
    });
    roll.append(preview);
  }

  const brief = document.createElement("div");
  brief.className = "brief";
  brief.append(about, warn);

  dock.append(head, brief, transport, keys, roll);
}

function nudge(dir) {
  if (!player.pattern) return;
  const total = player.length;
  if (!total) return;
  let index = player.index < 0 ? 0 : player.index + dir;
  index = (index + total) % total;
  player.seek(index, player.playing);
}

function route() {
  const pattern = patternFromHash();
  if (location.hash.startsWith("#/p/") && !pattern) {
    location.hash = "#/";
    return;
  }
  document.body.classList.toggle("is-learn", !!pattern);
  document.body.classList.toggle("is-list", !pattern);
  if (!pattern) {
    renderList();
    paint(player.snapshot());
    return;
  }
  renderLearn(pattern);
  if (!player.pattern || player.pattern.id !== pattern.id) player.load(pattern);
  else paint(player.snapshot());
}

function paint(snap) {
  const onNotes = new Set(snap.notes);
  const nextNotes = new Set(snap.nextNotes);
  document.querySelectorAll(".field").forEach((field) => {
    const id = field.dataset.note;
    const on = onNotes.has(id);
    const sounding = snap.playing && on;
    field.classList.toggle("is-on", sounding);
    field.classList.toggle("is-place", !snap.playing && on);
    field.classList.toggle("is-next", !on && nextNotes.has(id));
    field.setAttribute("aria-pressed", on ? "true" : "false");
    const shade = field.querySelector(".field-shade");
    const face = field.querySelector(".field-face");
    if (sounding || field.classList.contains("is-tap")) {
      shade.setAttribute("fill", "url(#dimple-on)");
      face.setAttribute("fill", "url(#dimple-on)");
      face.setAttribute("filter", "url(#glow)");
    } else if (!snap.playing && on) {
      shade.setAttribute("fill", "#5c4128");
      face.setAttribute("fill", "#6a4e34");
      face.setAttribute("filter", "none");
    } else {
      shade.setAttribute("fill", "url(#dimple)");
      face.setAttribute("fill", "#4e3b2e");
      face.setAttribute("filter", "none");
    }
  });
  document.querySelectorAll("[data-event]").forEach((node) => {
    const row = node.closest("[data-pattern]");
    const inPattern = !row || row.dataset.pattern === snap.patternId;
    const index = Number(node.dataset.event);
    const here = inPattern && snap.index >= 0 && index === snap.index;
    node.classList.toggle("is-on", !!snap.playing && here);
    node.classList.toggle("is-place", !snap.playing && here);
    node.classList.toggle("is-next", inPattern && index === snap.nextIndex && index !== snap.index);
  });
  document.querySelectorAll("[data-loop-next]").forEach((node) => {
    node.classList.toggle("is-next", snap.nextIndex === 0 && snap.index > 0);
  });
  if (snap.playing && snap.index !== lastScroll) {
    lastScroll = snap.index;
    const roll = document.getElementById("roll");
    const current = roll && roll.querySelector(".step.is-on");
    if (current && roll) {
      const pad = 8;
      const next = current.nextElementSibling;
      let left = Math.max(0, current.offsetLeft - pad);
      if (next) {
        const end = next.offsetLeft + next.offsetWidth + pad;
        const shifted = Math.max(0, end - roll.clientWidth);
        if (end - left > roll.clientWidth && shifted <= current.offsetLeft) left = shifted;
      }
      const max = Math.max(0, roll.scrollWidth - roll.clientWidth);
      roll.scrollTo({
        left: Math.max(0, Math.min(left, max)),
        behavior: reduce ? "auto" : "smooth",
      });
    }
  }
  const node = caption();
  const text = captionText(snap);
  if (node.textContent !== text) node.textContent = text;

  document.querySelectorAll(".row-play").forEach((button) => {
    const active = snap.playing && button.dataset.play === snap.patternId;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    const label = active ? "Pause" : "Play";
    const mark = button.querySelector(".mark");
    if (mark.textContent !== label) mark.textContent = label;
    const title = PATTERNS.find((pattern) => pattern.id === button.dataset.play);
    button.setAttribute("aria-label", `${label} ${title ? title.title : ""}`.trim());
  });
  document.querySelectorAll(".row").forEach((row) => {
    row.classList.toggle("is-current", !!snap.patternId && row.dataset.pattern === snap.patternId);
  });

  const play = document.getElementById("play");
  if (play) {
    play.setAttribute("aria-pressed", snap.playing ? "true" : "false");
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
  }
  const loop = document.getElementById("loop");
  if (loop) {
    loop.setAttribute("aria-pressed", snap.loop ? "true" : "false");
  }
  const warn = document.querySelector(".mirror-note");
  if (warn) warn.hidden = !mirrored;
}

function captionText(snap) {
  if (!snap.notes.length) {
    if (!snap.patternId) return "Tap a dimple to hear it.";
    const pattern = PATTERNS.find((item) => item.id === snap.patternId);
    return pattern ? pattern.title : "Tap a dimple to hear it.";
  }
  return snap.notes
    .map((id) => {
      const hand = flipHand(snap.hands[id]);
      const name = id === "D3" ? "ding" : pretty(id);
      return hand ? `${name}, ${hand} hand` : name;
    })
    .join(" and ");
}

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
  if (event.code === "Escape" && document.body.classList.contains("is-learn")) {
    event.preventDefault();
    location.hash = "#/";
    return;
  }
  if (event.target.closest("input, textarea, .field")) return;
  if (event.code === "Space") {
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
    nudge(1);
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    nudge(-1);
  }
});

drawPan();
route();
