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
    id: "ding-fifth",
    title: "Ding and fifth",
    stage: "First notes",
    bpm: 60,
    loopBeats: 8,
    blurb: "Ding in the center, low A under your right hand.",
    about:
      "Sit with the low A by your right thigh and the B-flat by your left. Left hand plays the ding in the center. Right hand plays the low A. Use the pad of one finger, strike, and lift so the steel can ring.",
    steps: [
      step(0, "D3", L),
      step(2, "A3", R),
      step(4, "D3", L),
      step(6, "A3", R),
    ],
  },
  {
    id: "kurd-color",
    title: "Kurd color",
    stage: "First notes",
    bpm: 72,
    loopBeats: 8,
    blurb: "The half step that makes this scale a Kurd.",
    about:
      "B-flat is the dimple by your left thigh. Play A with the right hand, B-flat with the left, then A again. That half step is the sound of this scale. The ding starts each group of four.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "Bb3", L),
      step(3, "A3", R),
      step(4, "D3", L),
      step(5, "A3", R),
      step(6, "Bb3", L),
      step(7, "A3", R),
    ],
  },
  {
    id: "where-they-sit",
    title: "Where they sit",
    stage: "First notes",
    bpm: 54,
    loopBeats: 12,
    blurb: "Every note, one at a time, so your hands learn the map.",
    about:
      "Play up the scale one note at a time. Right hand climbs A, C, E, G, then the high C at the far rim. Left hand climbs B-flat, D, F, A. Finish on the ding. If a dimple is on the wrong side, turn on Mirror.",
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
      step(9, "D3", L),
    ],
  },
  {
    id: "pass-across",
    title: "Pass it across",
    stage: "First notes",
    bpm: 56,
    loopBeats: 4,
    blurb: "One dimple on each side, back and forth.",
    about:
      "C is on the right, just up from the low A. D is on the left, just up from the B-flat. Play C, D, C, D. Right, left, right, left. Keep every note the same length. Count 1 2 3 4 until the hand change is automatic.",
    steps: [
      step(0, "C4", R),
      step(1, "D4", L),
      step(2, "C4", R),
      step(3, "D4", L),
    ],
  },
  {
    id: "one-stays",
    title: "One hand stays",
    stage: "First notes",
    bpm: 64,
    loopBeats: 8,
    blurb: "Left hand holds B-flat. Right hand walks C, E, G, E.",
    about:
      "Leave the left hand on B-flat, the dimple by your left thigh. It plays on 1 and on 3. The right hand answers on 2 and on 4: C, then E, then G, then E again. The left hand is the clock. Only the right hand changes notes.",
    steps: [
      step(0, "Bb3", L),
      step(1, "C4", R),
      step(2, "Bb3", L),
      step(3, "E4", R),
      step(4, "Bb3", L),
      step(5, "G4", R),
      step(6, "Bb3", L),
      step(7, "E4", R),
    ],
  },
  {
    id: "two-places",
    title: "Two Ds, two As",
    stage: "Next",
    bpm: 66,
    loopBeats: 8,
    blurb: "Find the octave of D and the octave of A.",
    about:
      "D is in the center and again on the left, one place up from B-flat. A is by your right thigh and again high on the left. Both Ds stay in the left hand. Low A is the right hand, and the high A is the left hand. Listen for the same note an octave up.",
    steps: [
      step(0, "D3", L),
      step(2, "D4", L),
      step(4, "A3", R),
      step(6, "A4", L),
    ],
  },
  {
    id: "right-side",
    title: "Right side",
    stage: "Next",
    bpm: 80,
    loopBeats: 8,
    blurb: "A walk up the dimples on your right.",
    about:
      "Left hand plays the ding at the start of each bar and lets it ring. Right hand walks A, C, E, G, reaches the high C, and walks back down. Keep one finger and a quiet wrist.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(1, "C4", R),
      step(2, "E4", R),
      step(3, "G4", R),
      step(4, "D3", L),
      step(4, "C5", R),
      step(5, "G4", R),
      step(6, "E4", R),
      step(7, "A3", R),
    ],
  },
  {
    id: "left-side",
    title: "Left side",
    stage: "Next",
    bpm: 80,
    loopBeats: 8,
    blurb: "A walk up the dimples on your left.",
    about:
      "Right hand plays the low A at the start of each bar and lets it ring. Left hand walks B-flat, D, F, and the high A, then comes back down. B-flat, D, and F are the B-flat chord. The high A is the seventh.",
    steps: [
      step(0, "A3", R),
      step(0, "Bb3", L),
      step(1, "D4", L),
      step(2, "F4", L),
      step(3, "A4", L),
      step(4, "A3", R),
      step(4, "A4", L),
      step(5, "F4", L),
      step(6, "D4", L),
      step(7, "Bb3", L),
    ],
  },
  {
    id: "small-turn",
    title: "Small turn",
    stage: "Next",
    bpm: 76,
    loopBeats: 8,
    blurb: "Two bars you can sit on.",
    about:
      "Bar one is the Kurd color. Bar two goes to C on the right and D on the left, then low A, then the ding. Loop both bars until the second one is as calm as the first.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "Bb3", L),
      step(3, "A3", R),
      step(4, "C4", R),
      step(5, "D4", L),
      step(6, "A3", R),
      step(7, "D3", L),
    ],
  },
  {
    id: "let-it-ring",
    title: "Let it ring",
    stage: "Next",
    bpm: 60,
    loopBeats: 8,
    blurb: "The silence is part of the pattern.",
    about:
      "Play the ding and the low A together, then wait. The empty beats are the pattern. B-flat answers, then D, then the high A, then the high C. Leave the space empty.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(3, "Bb3", L),
      step(4, "D4", L),
      step(6, "A4", L),
      step(7, "C5", R),
    ],
  },
  {
    id: "lap-groove",
    title: "Lap groove",
    stage: "Further",
    bpm: 72,
    loopBeats: 4,
    blurb: "A four-beat pattern with quick notes on the ands.",
    about:
      'Count "1, 2, 3 and, 4 and". On 1, ding and low A together. On 2, B-flat. On 3, D on the left, and on the and a quick E on the right. On 4, low A, then C on the and. Both of those are the right hand.',
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(1, "Bb3", L),
      step(2, "D4", L),
      step(2.5, "E4", R),
      step(3, "A3", R),
      step(3.5, "C4", R),
    ],
  },
  {
    id: "call-return",
    title: "Call and return",
    stage: "Further",
    bpm: 80,
    loopBeats: 16,
    blurb: "Climb one side, then the other, then come home.",
    about:
      "Ding, then A, C, and E on the right. The left hand answers with the ding, then climbs B-flat, D, F, and the high A. The right hand walks down G, E, C, and low A. The phrase closes B-flat, A, ding. Slow the tempo while the jumps are new.",
    steps: [
      step(0, "D3", L),
      step(1, "A3", R),
      step(2, "C4", R),
      step(3, "E4", R),
      step(4, "D3", L),
      step(5, "Bb3", L),
      step(6, "D4", L),
      step(7, "F4", L),
      step(8, "A4", L),
      step(9, "G4", R),
      step(10, "E4", R),
      step(11, "C4", R),
      step(12, "A3", R),
      step(13, "Bb3", L),
      step(14, "A3", R),
      step(15, "D3", L),
    ],
  },
  {
    id: "up-and-back",
    title: "Up and back",
    stage: "Next",
    bpm: 66,
    loopBeats: 8,
    blurb: "Five steps up, then turn around before F.",
    about:
      "Start on low A with the right hand. Alternate hands up the scale: A, B-flat, C, D, E. Come back down D, C, B-flat. When the loop starts again, the right hand steps from B-flat to low A. This one stops at E on purpose.",
    steps: [
      step(0, "A3", R),
      step(1, "Bb3", L),
      step(2, "C4", R),
      step(3, "D4", L),
      step(4, "E4", R),
      step(5, "D4", L),
      step(6, "C4", R),
      step(7, "Bb3", L),
    ],
  },
  {
    id: "minor-home",
    title: "D minor",
    stage: "Next",
    bpm: 66,
    loopBeats: 4,
    blurb: "The home chord, rolled because D and F share a hand.",
    about:
      "D, F, and A are D minor, the chord this pan is built on. Ding and low A together, then F, then the higher D, then low A. D and F are both on your left, so they take turns.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(1, "F4", L),
      step(2, "D4", L),
      step(3, "A3", R),
    ],
  },
  {
    id: "a-minor",
    title: "A minor",
    stage: "Next",
    bpm: 72,
    loopBeats: 4,
    blurb: "High A under the left hand, high C and E under the right.",
    about:
      "A, C, and E are A minor. High A and high C can sound together: high C is the third above that A, and they sit on opposite hands. High A and E can sound together too. E sits below the high A, because this pan has no E above it.",
    steps: [
      step(0, "A4", L),
      step(0, "C5", R),
      step(1, "E4", R),
      step(2, "A4", L),
      step(2, "E4", R),
      step(3, "C5", R),
    ],
  },
  {
    id: "f-under",
    title: "F underneath",
    stage: "Next",
    bpm: 66,
    loopBeats: 8,
    blurb: "F stays on the left. The right hand answers with C, then A.",
    about:
      "F, A, and C are F major. F is on the left, so it can sound with the high C, and it can sound with the low A. Both of those are on the right. The high A is also on the left, so it cannot join the F. Play F with high C, rest, F with low A, rest, and the same again.",
    steps: [
      step(0, "F4", L),
      step(0, "C5", R),
      step(2, "F4", L),
      step(2, "A3", R),
      step(4, "F4", L),
      step(4, "C5", R),
      step(6, "F4", L),
      step(6, "A3", R),
    ],
  },
  {
    id: "g-minor",
    title: "G minor",
    stage: "Next",
    bpm: 66,
    loopBeats: 8,
    blurb: "G on the right, with D and then B-flat on the left.",
    about:
      "G, B-flat, and D are G minor. G is on the right. D and B-flat are both on the left, so they take turns under the G. Play the higher D with G, rest, then B-flat with G, and repeat.",
    steps: [
      step(0, "D4", L),
      step(0, "G4", R),
      step(2, "Bb3", L),
      step(2, "G4", R),
      step(4, "D4", L),
      step(4, "G4", R),
      step(6, "Bb3", L),
      step(6, "G4", R),
    ],
  },
  {
    id: "three-and-two",
    title: "Three, three, two",
    stage: "Further",
    bpm: 72,
    loopBeats: 4,
    blurb: "Eight quick notes, grouped three, three, and two.",
    about:
      "Play every half beat. The groups are ding, A, A, then ding, A, A, then ding, A. That is three notes, three notes, and two notes. Only the ding and the low A. The hands go left, right, right, left, right, right, left, right.",
    steps: [
      step(0, "D3", L),
      step(0.5, "A3", R),
      step(1, "A3", R),
      step(1.5, "D3", L),
      step(2, "A3", R),
      step(2.5, "A3", R),
      step(3, "D3", L),
      step(3.5, "A3", R),
    ],
  },
  {
    id: "together-split",
    title: "Together, then split",
    stage: "Further",
    bpm: 76,
    loopBeats: 8,
    blurb: "Both hands together, then one note each.",
    about:
      "Both hands play together, then they take turns. Ding and low A, then E on the right, B-flat on the left, C on the right. Same hand order from a new pair: ding with G, then E, F, and low A.",
    steps: [
      step(0, "D3", L),
      step(0, "A3", R),
      step(1, "E4", R),
      step(2, "Bb3", L),
      step(3, "C4", R),
      step(4, "D3", L),
      step(4, "G4", R),
      step(5, "E4", R),
      step(6, "F4", L),
      step(7, "A3", R),
    ],
  },
  {
    id: "long-short-long",
    title: "Long, short, long",
    stage: "Further",
    bpm: 76,
    loopBeats: 4,
    blurb: "One long note, three quick notes, then a note on 4.",
    about:
      'Count "1 and 2 and 3 and 4 and". On 1, F and G together, and let them hold through the and. Then three quick notes: D, E, B-flat. Those are 2, the and of 2, and 3. Leave the and of 3 empty. On 4, C. The hands go both, left, right, left, right.',
    steps: [
      step(0, "F4", L),
      step(0, "G4", R),
      step(1, "D4", L),
      step(1.5, "E4", R),
      step(2, "Bb3", L),
      step(3, "C4", R),
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
