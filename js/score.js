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
  {
    id: "climb-home",
    title: "Climb home",
    kind: "Pieces",
    bpm: 76,
    loopBeats: 16,
    blurb: "From the low A up to the high C, then down onto the ding.",
    about:
      "Low A, B-flat, C, D, E, F, G, high A, high C. Then high A, G, F, E, D, C, and the ding. Hands trade on every note. The ding is the last note, and the low A starts the climb again.",
    steps: [
      step(0, "A3", R),
      step(1, "Bb3", L),
      step(2, "C4", R),
      step(3, "D4", L),
      step(4, "E4", R),
      step(5, "F4", L),
      step(6, "G4", R),
      step(7, "A4", L),
      step(8, "C5", R),
      step(9, "A4", L),
      step(10, "G4", R),
      step(11, "F4", L),
      step(12, "E4", R),
      step(13, "D4", L),
      step(14, "C4", R),
      step(15, "D3", L),
    ],
  },
  {
    id: "out-and-back",
    title: "Out and back",
    kind: "Pieces",
    bpm: 80,
    loopBeats: 32,
    blurb: "Up to the high C, down, and a second lift back to the low A.",
    about:
      "It starts on the ding and climbs to the high C: ding, low A, B-flat, C, D, E, F, G, high A, high C. It comes down to the low A. Then F, E, D, C, B-flat, low A, D, E, F, G, high A, G, F, and the low A. The low A leads back to the ding. Left hand on the ding, B-flat, D, F, and high A.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "Bb3", L),
      step(3, "C4", R),
      step(4, "D4", L),
      step(5, "E4", R),
      step(6, "F4", L),
      step(7, "G4", R),
      step(8, "A4", L),
      step(9, "C5", R),
      step(10, "A4", L),
      step(11, "G4", R),
      step(12, "F4", L),
      step(13, "E4", R),
      step(14, "D4", L),
      step(15, "C4", R),
      step(16, "Bb3", L),
      step(17, "A3", R),
      step(18, "F4", L),
      step(19, "E4", R),
      step(20, "D4", L),
      step(21, "C4", R),
      step(22, "Bb3", L),
      step(23, "A3", R),
      step(24, "D4", L),
      step(25, "E4", R),
      step(26, "F4", L),
      step(27, "G4", R),
      step(28, "A4", L),
      step(29, "G4", R),
      step(30, "F4", L),
      step(31, "A3", R),
    ],
  },
  {
    id: "pairs-along-the-way",
    title: "Pairs along the way",
    kind: "Pieces",
    bpm: 74,
    loopBeats: 32,
    blurb: "Four two-note strikes, with a line of single notes between them.",
    about:
      "Ding and low A, then F, low A, D, C, B-flat, low A. G with the higher D, then F, E, D, C, B-flat, C. F with the low A, then G, F, E, D, C, B-flat. High A with E, then F, E, D, C, B-flat, low A. The low A joins the ding when the loop starts again.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(2, "F4", L),
      step(3, "A3", R),
      step(4, "D4", L),
      step(5, "C4", R),
      step(6, "Bb3", L),
      step(7, "A3", R),
      step(8, "D4", L),
      step(8, "G4", R),
      step(10, "F4", L),
      step(11, "E4", R),
      step(12, "D4", L),
      step(13, "C4", R),
      step(14, "Bb3", L),
      step(15, "C4", R),
      step(16, "F4", L),
      step(16, "A3", R),
      step(18, "G4", R),
      step(19, "F4", L),
      step(20, "E4", R),
      step(21, "D4", L),
      step(22, "C4", R),
      step(23, "Bb3", L),
      step(24, "A4", L),
      step(24, "E4", R),
      step(26, "F4", L),
      step(27, "E4", R),
      step(28, "D4", L),
      step(29, "C4", R),
      step(30, "Bb3", L),
      step(31, "A3", R),
    ],
  },
  {
    id: "four-doors",
    title: "Four doors",
    kind: "Pieces",
    bpm: 70,
    loopBeats: 16,
    blurb: "Each bar opens with two notes, one in each hand.",
    about:
      "Ding and low A, then F and low A. B-flat and G, then F and E. F and C, then D and low A. High A and E, then G and the ding.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(2, "F4", L),
      step(3, "A3", R),
      step(4, "Bb3", L),
      step(4, "G4", R),
      step(6, "F4", L),
      step(7, "E4", R),
      step(8, "F4", L),
      step(8, "C4", R),
      step(10, "D4", L),
      step(11, "A3", R),
      step(12, "A4", L),
      step(12, "E4", R),
      step(14, "G4", R),
      step(15, "D3", L),
    ],
  },
];

export function pretty(id) {
  const note = NOTES[id];
  return `${note.letter}${note.octave}`;
}

export function eventsOf(pattern) {
  const map = new Map();
  for (const step of pattern.steps) {
    let event = map.get(step.beat);
    if (!event) {
      event = { beat: step.beat, notes: [], hands: {} };
      map.set(step.beat, event);
    }
    event.notes.push(step.note);
    event.hands[step.note] = step.hand;
  }
  return [...map.values()]
    .sort((a, b) => a.beat - b.beat)
    .map((event, index) => ({ ...event, index }));
}

export function cellsOf(pattern) {
  const events = eventsOf(pattern);
  const cells = [];
  for (let beat = 0; beat < pattern.loopBeats; beat += 1) {
    const group = events.filter((event) => event.beat >= beat && event.beat < beat + 1);
    if (group.length === 0) cells.push({ rest: true, beat });
    else cells.push(...group);
  }
  return cells;
}

export function beatLabel(beat) {
  const inside = beat % 4;
  const count = Math.floor(inside) + 1;
  const fraction = Math.round((inside - Math.floor(inside)) * 2) / 2;
  if (fraction === 0.5) return `${count} and`;
  return String(count);
}
