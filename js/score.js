import { PIECES } from "./pieces.js";

export const NOTES = {
  D3: { id: "D3", letter: "D", octave: 3, hz: 146.8324, ding: true },
  A3: { id: "A3", letter: "A", octave: 3, hz: 220 },
  Bb3: { id: "Bb3", letter: "B\u266d", octave: 3, hz: 233.0819 },
  C4: { id: "C4", letter: "C", octave: 4, hz: 261.6256 },
  D4: { id: "D4", letter: "D", octave: 4, hz: 293.6648 },
  E4: { id: "E4", letter: "E", octave: 4, hz: 329.6276 },
  F4: { id: "F4", letter: "F", octave: 4, hz: 349.2282 },
  G4: { id: "G4", letter: "G", octave: 4, hz: 391.9954 },
  A4: { id: "A4", letter: "A", octave: 4, hz: 440 },
  C5: { id: "C5", letter: "C", octave: 5, hz: 523.2511 },
};

export const FIELDS = [
  { id: "C5", deg: 0 },
  { id: "G4", deg: 40 },
  { id: "E4", deg: 80 },
  { id: "C4", deg: 120 },
  { id: "A3", deg: 160 },
  { id: "Bb3", deg: 200 },
  { id: "D4", deg: 240 },
  { id: "F4", deg: 280 },
  { id: "A4", deg: 320 },
];

export const SIDE = {
  D3: "left",
  A3: "right",
  Bb3: "left",
  C4: "right",
  D4: "left",
  E4: "right",
  F4: "left",
  G4: "right",
  A4: "left",
  C5: "right",
};

const L = "left";
const R = "right";

function step(beat, note, hand) {
  return { beat, note, hand };
}

export const TAK = "tak";

const TAB = { D: "D3", 1: "A3", 2: "Bb3", 3: "C4", 4: "D4", 5: "E4", 6: "F4", 7: "G4", 8: "A4", 9: "C5", t: TAK };

export const NUMBER = Object.fromEntries(
  Object.entries(TAB)
    .filter(([key]) => key !== "t")
    .map(([key, id]) => [id, key === "D" ? "0" : key]),
);

export function numberOf(id) {
  return id === TAK ? "\u00d7" : NUMBER[id];
}

const METERS = {
  eighths: { slotsPerBeat: 2, beatsPerBar: 4 },
  sixteenths: { slotsPerBeat: 4, beatsPerBar: 4 },
  "six-eight": { slotsPerBeat: 3, beatsPerBar: 2, count: "slots" },
  "seven-eight": { slotsPerBeat: 2, beatsPerBar: 3.5, count: "slots" },
};

const LEVEL = { "^": 1, plain: 0.8, "-": 0.42 };
const FORCED = { "<": L, ">": R };
const FREE = { D3: L, [TAK]: R };

function readBar(text, where) {
  const slots = [];
  let chord = null;
  let target = [];
  for (const char of text) {
    if (char === " ") continue;
    if (char === ".") {
      slots.push([]);
      target = [];
    } else if (char === "[") {
      chord = [];
    } else if (char === "]") {
      slots.push(chord);
      target = chord;
      chord = null;
    } else if (char in TAB) {
      const hit = { note: TAB[char], amp: LEVEL.plain, hand: null };
      if (chord) chord.push(hit);
      else slots.push([hit]);
      target = [hit];
    } else if (char in LEVEL) {
      for (const hit of target) hit.amp = LEVEL[char];
    } else if (char in FORCED) {
      for (const hit of target) hit.hand = FORCED[char];
    } else {
      throw new Error(`${where}: unknown mark ${char}`);
    }
  }
  return slots;
}

function handChoices(hits, where) {
  for (const hit of hits) {
    if (!hit.hand && !(hit.note in FREE)) hit.hand = SIDE[hit.note];
  }
  const other = (hand) => (hand === L ? R : L);
  if (hits.length === 1) return hits[0].hand ? [[hits[0].hand]] : [[L], [R]];
  if (hits.length === 2) {
    const [a, b] = hits;
    if (a.hand && b.hand && a.hand !== b.hand) return [[a.hand, b.hand]];
    if (a.hand && !b.hand) return [[a.hand, other(a.hand)]];
    if (!a.hand && b.hand) return [[other(b.hand), b.hand]];
  }
  throw new Error(`${where}: a strike needs one note for each hand`);
}

function assignHands(events, id) {
  const rows = [];
  events.forEach((event, i) => {
    const choices = handChoices(event.hits, `${id}, beat ${event.beat}`);
    const solo = event.hits.length === 1 ? event.hits[0].note : null;
    rows.push(
      choices.map((hands) => {
        const lean = solo in FREE && hands[0] !== FREE[solo] ? 0.01 : 0;
        if (i === 0) return { hands, cost: lean, from: null };
        const gap = event.beat - events[i - 1].beat;
        let best = null;
        for (const before of rows[i - 1]) {
          const clash = hands.some((hand) => before.hands.includes(hand)) ? 1 / gap : 0;
          const cost = before.cost + clash + lean;
          if (!best || cost < best.cost) best = { hands, cost, from: before };
        }
        return best;
      }),
    );
  });
  let node = rows[rows.length - 1].reduce((a, b) => (a.cost <= b.cost ? a : b));
  for (let i = events.length - 1; i >= 0; i -= 1) {
    events[i].hits.forEach((hit, n) => {
      hit.hand = node.hands[n];
    });
    node = node.from;
  }
}

function compile(piece) {
  const meter = METERS[piece.meter];
  const perBar = meter.slotsPerBeat * meter.beatsPerBar;
  const events = [];
  const sections = [];
  let bar = 0;
  for (const name of piece.form) {
    sections.push({ beat: bar * meter.beatsPerBar, name });
    piece.parts[name].forEach((text, n) => {
      const where = `${piece.id}, ${name}, bar ${n + 1}`;
      const slots = readBar(text, where);
      if (slots.length !== perBar) throw new Error(`${where}: ${slots.length} slots, not ${perBar}`);
      slots.forEach((hits, slot) => {
        if (hits.length === 0) return;
        events.push({ beat: (bar * perBar + slot) / meter.slotsPerBeat, hits: hits.map((hit) => ({ ...hit })) });
      });
      bar += 1;
    });
  }
  assignHands(events, piece.id);
  return {
    id: piece.id,
    title: piece.title,
    kind: piece.category || "Pieces",
    bpm: piece.bpm,
    loopBeats: bar * meter.beatsPerBar,
    blurb: piece.blurb,
    about: piece.about,
    steps: events.flatMap((event) => event.hits.map((hit) => ({ beat: event.beat, ...hit }))),
    sections,
    loop: false,
    ...meter,
  };
}

export const PATTERNS = [
  {
    id: "bottom-cross",
    title: "Bottom cross",
    kind: "Hands",
    bpm: 76,
    loopBeats: 8,
    blurb: "Low A, B-flat, and the ding. The hands cross the bottom of the pan.",
    about:
      "Right hand on the low A, left hand on the B-flat, right hand on the low A, left hand on the ding. The same four notes again. This is the crossing you can keep playing.",
    steps: [
      step(0, "A3", R),
      step(1, "Bb3", L),
      step(2, "A3", R),
      step(3, "D3", L),
      step(4, "A3", R),
      step(5, "Bb3", L),
      step(6, "A3", R),
      step(7, "D3", L),
    ],
  },
  {
    id: "ding-answers",
    title: "The ding answers",
    kind: "Hands",
    bpm: 72,
    loopBeats: 16,
    blurb: "The right hand walks. The ding answers every note.",
    about:
      "The right hand plays low A, C, E, G, and the high C, then comes back down G, E, C. After every one of those, the left hand plays the ding. The ding is the clock.",
    steps: [
      step(0, "A3", R),
      step(1, "D3", L),
      step(2, "C4", R),
      step(3, "D3", L),
      step(4, "E4", R),
      step(5, "D3", L),
      step(6, "G4", R),
      step(7, "D3", L),
      step(8, "C5", R),
      step(9, "D3", L),
      step(10, "G4", R),
      step(11, "D3", L),
      step(12, "E4", R),
      step(13, "D3", L),
      step(14, "C4", R),
      step(15, "D3", L),
    ],
  },
  {
    id: "left-then-right",
    title: "Left, then right",
    kind: "Hands",
    bpm: 74,
    loopBeats: 8,
    blurb: "Each note on the left is answered from the right.",
    about:
      "B-flat then C. D then E. F then G. High A then high C. The left hand starts each pair. The right hand answers.",
    steps: [
      step(0, "Bb3", L),
      step(1, "C4", R),
      step(2, "D4", L),
      step(3, "E4", R),
      step(4, "F4", L),
      step(5, "G4", R),
      step(6, "A4", L),
      step(7, "C5", R),
    ],
  },
  {
    id: "other-d",
    title: "The other D",
    kind: "Hands",
    bpm: 70,
    loopBeats: 8,
    blurb: "D in two places, A in two places, hands still trading.",
    about:
      "Ding, low A, the higher D, high C, high A, G, the higher D, low A. The two Ds are both in the left hand. Low A is the right hand, and the high A is the left hand.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "D4", L),
      step(3, "C5", R),
      step(4, "A4", L),
      step(5, "G4", R),
      step(6, "D4", L),
      step(7, "A3", R),
    ],
  },
  {
    id: "home-pair",
    title: "Ding and low A",
    kind: "Chords",
    bpm: 64,
    loopBeats: 8,
    blurb: "The home sound. Both notes together, then each one alone.",
    about:
      "On 1, the ding and the low A together. They ring. Then the low A alone, then the ding alone, then both again. The ding alone, then the low A, and both come back on the next 1.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(2, "A3", R),
      step(3, "D3", L),
      step(4, "D3", L),
      step(4, "A3", R),
      step(6, "D3", L),
      step(7, "A3", R),
    ],
  },
  {
    id: "minor-third",
    title: "F with the low A",
    kind: "Chords",
    bpm: 68,
    loopBeats: 8,
    blurb: "The minor third. F in the left hand, low A in the right.",
    about:
      "F and the low A together. That interval is the minor color of D. Then F alone, then the low A alone, then both again. The low A alone, and the ding closes the loop.",
    steps: [
      step(0, "F4", L),
      step(0, "A3", R),
      step(2, "F4", L),
      step(3, "A3", R),
      step(4, "F4", L),
      step(4, "A3", R),
      step(6, "A3", R),
      step(7, "D3", L),
    ],
  },
  {
    id: "g-over-d",
    title: "G over D",
    kind: "Chords",
    bpm: 66,
    loopBeats: 8,
    blurb: "G with the higher D, then G with the ding.",
    about:
      "G and the higher D together. B-flat, then E. Then G and the ding together. B-flat, then G. G is always the right hand. D, B-flat, and the ding are the left.",
    steps: [
      step(0, "D4", L),
      step(0, "G4", R),
      step(2, "Bb3", L),
      step(3, "E4", R),
      step(4, "D3", L),
      step(4, "G4", R),
      step(6, "Bb3", L),
      step(7, "G4", R),
    ],
  },
  {
    id: "bright-pair",
    title: "High A and E",
    kind: "Chords",
    bpm: 72,
    loopBeats: 8,
    blurb: "The bright pair up high, then the hands come down.",
    about:
      "High A and E together. High C, then F. Then high A and high C together. E, then the ding. The high notes are one in each hand.",
    steps: [
      step(0, "A4", L),
      step(0, "E4", R),
      step(2, "C5", R),
      step(3, "F4", L),
      step(4, "A4", L),
      step(4, "C5", R),
      step(6, "E4", R),
      step(7, "D3", L),
    ],
  },
  {
    id: "kurd-loop",
    title: "Kurd loop",
    kind: "Grooves",
    bpm: 86,
    loopBeats: 8,
    blurb: "Eight notes. The right hand stays on the low A.",
    about:
      "Ding, low A, F, low A, ding, low A, B-flat, low A. The right hand does not move. The left hand moves between the ding, F, and B-flat. You can keep this going.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "F4", L),
      step(3, "A3", R),
      step(4, "D3", L),
      step(5, "A3", R),
      step(6, "Bb3", L),
      step(7, "A3", R),
    ],
  },
  {
    id: "eight-roll",
    title: "Eight-note roll",
    kind: "Grooves",
    bpm: 92,
    loopBeats: 8,
    blurb: "A roll with no rest. Hands trade on every note.",
    about:
      "Ding, low A, F, low A, D, C, B-flat, low A. The right hand plays low A, low A, C, and low A. The left hand plays the ding, F, D, and B-flat. Count 1 and 2 and 3 and 4 and.",
    steps: [
      step(0, "D3", L),
      step(0.5, "A3", R),
      step(1, "F4", L),
      step(1.5, "A3", R),
      step(2, "D4", L),
      step(2.5, "C4", R),
      step(3, "Bb3", L),
      step(3.5, "A3", R),
    ],
  },
  {
    id: "long-then-short",
    title: "Long, then short",
    kind: "Grooves",
    bpm: 84,
    loopBeats: 8,
    blurb: "A held pair, then four quick notes.",
    about:
      "On 1, the ding and the low A together, and they ring across 2. Then F, E, D, C. The same pair again, then B-flat, E, D, C. The quick notes trade hands.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(2, "F4", L),
      step(2.5, "E4", R),
      step(3, "D4", L),
      step(3.5, "C4", R),
      step(4, "D3", L),
      step(4, "A3", R),
      step(6, "Bb3", L),
      step(6.5, "E4", R),
      step(7, "D4", L),
      step(7.5, "C4", R),
    ],
  },
  {
    id: "down-to-the-ding",
    title: "Down to the ding",
    kind: "Grooves",
    bpm: 88,
    loopBeats: 16,
    blurb: "Two bars on the low A, then a walk down to it.",
    about:
      "Ding, low A, D, low A, then ding, low A, B-flat, low A. The second half steps down F, E, D, C, B-flat, low A, F, low A. That last low A leads back to the ding.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "D4", L),
      step(3, "A3", R),
      step(4, "D3", L),
      step(5, "A3", R),
      step(6, "Bb3", L),
      step(7, "A3", R),
      step(8, "F4", L),
      step(9, "E4", R),
      step(10, "D4", L),
      step(11, "C4", R),
      step(12, "Bb3", L),
      step(13, "A3", R),
      step(14, "F4", L),
      step(15, "A3", R),
    ],
  },
  ...PIECES.map(compile),
].filter((pattern) => ["in-the-end", "nothing-else-matters", "seven-nation-army"].includes(pattern.id));

export function pretty(id) {
  if (id === TAK) return TAK;
  const note = NOTES[id];
  return `${note.letter}${note.octave}`;
}

export function eventsOf(pattern) {
  const map = new Map();
  for (const step of pattern.steps) {
    let event = map.get(step.beat);
    if (!event) {
      event = { beat: step.beat, notes: [], hands: {}, amps: {} };
      map.set(step.beat, event);
    }
    event.notes.push(step.note);
    event.hands[step.note] = step.hand;
    event.amps[step.note] = step.amp ?? 1;
  }
  return [...map.values()]
    .sort((a, b) => a.beat - b.beat)
    .map((event, index) => ({ ...event, index }));
}

export function sheetOf(pattern) {
  const perBeat = pattern.slotsPerBeat || (pattern.steps.some((item) => item.beat % 1) ? 2 : 1);
  const barBeats = pattern.beatsPerBar || 4;
  const perBar = Math.round(perBeat * barBeats);
  const total = Math.round(pattern.loopBeats / barBeats);
  const bars = Array.from({ length: total }, (unused, bar) => ({ bar, slots: Array(perBar).fill(null) }));
  for (const event of eventsOf(pattern)) {
    const slot = Math.round(event.beat * perBeat);
    bars[Math.floor(slot / perBar)].slots[slot % perBar] = event;
  }
  const marks = pattern.sections || [{ beat: 0, name: "" }];
  const sections = marks.map((mark, i) => {
    const first = Math.round(mark.beat / barBeats);
    const end = i + 1 < marks.length ? Math.round(marks[i + 1].beat / barBeats) : total;
    return { name: mark.name, first, end, bars: bars.slice(first, end) };
  });
  return {
    perBeat,
    perBar,
    barBeats,
    cols: perBar > 8 ? perBar / 2 : perBar,
    sections,
  };
}

const HALVE_OVER = 4;

export function stepsOf(pattern) {
  const sections = sheetOf(pattern).sections;
  if (sections.length < 2) return [];
  const total = sections[sections.length - 1].end;
  const steps = [];
  const seen = new Set();
  const add = (kind, label, short, first, end, key) =>
    steps.push({ kind, label, short, first, end, key: key || `${first}:${end}` });
  sections.forEach((section, i) => {
    if (seen.has(section.name)) return;
    seen.add(section.name);
    const bars = section.end - section.first;
    if (bars > HALVE_OVER) {
      const mid = section.first + Math.ceil(bars / 2);
      add("half", `${section.name}, first half`, `${section.name} 1/2`, section.first, mid);
      add("half", `${section.name}, second half`, `${section.name} 2/2`, mid, section.end);
    }
    add("part", section.name, section.name, section.first, section.end, section.name);
    if (i > 0 && section.end < total) {
      add("join", `Join, start to ${section.name}`, `Join 1-${section.end}`, 0, section.end);
    }
  });
  add("whole", "Whole piece", "Whole", 0, total);
  return steps;
}

const COUNT_WORDS = { 2: ["", " and"], 4: ["", " e", " and", " a"] };

export function beatLabel(beat, pattern) {
  const perBeat = pattern.slotsPerBeat || 2;
  const perBar = (pattern.beatsPerBar || 4) * perBeat;
  const slot = Math.round(beat * perBeat) % Math.round(perBar);
  if (pattern.count === "slots") return String(slot + 1);
  return `${Math.floor(slot / perBeat) + 1}${COUNT_WORDS[perBeat][slot % perBeat]}`;
}
