import assert from "node:assert/strict";
import { PATTERNS, eventsOf, sheetOf, stepsOf } from "../js/score.js";
import { beginnerPattern, phrasesOf, createNotePractice, parsePractice, readPractice, savePractice, PRACTICE_KEY } from "../js/practice.js";
import { createPlayer } from "../js/play.js";

const meters = new Set();
let count = 0;
for (const pattern of PATTERNS) {
  const legacy = JSON.stringify(stepsOf(pattern));
  const phrases = phrasesOf(pattern);
  const beats = pattern.beatsPerBar || 4;
  meters.add(beats);
  assert.ok(phrases.length, `${pattern.id}: no phrases`);
  assert.equal(phrases[0].from, 0);
  assert.equal(phrases.at(-1).to, pattern.loopBeats);
  assert.deepEqual(phrases.flatMap((phrase) => phrase.events), eventsOf(pattern), `${pattern.id}: missing or duplicated event`);
  assert.deepEqual(phrases.flatMap((phrase) => phrase.slots), sheetOf(pattern).sections.flatMap((section) => section.bars.flatMap((bar) => bar.slots)));
  phrases.forEach((phrase, i) => {
    assert.ok(phrase.to > phrase.from && phrase.to - phrase.from <= beats * 2);
    assert.equal(phrase.from, phrase.first * beats);
    assert.equal(phrase.to, phrase.end * beats);
    if (i) assert.equal(phrases[i - 1].to, phrase.from);
    for (const event of phrase.events) assert.ok(event.beat >= phrase.from && event.beat < phrase.to);
    const attempt = createNotePractice(phrase.events);
    for (const event of phrase.events) {
      for (const id of new Set(event.notes)) attempt.strike(id);
    }
    assert.equal(attempt.snapshot().complete, true, `${pattern.id}: cannot finish phrase ${i}`);
    assert.equal(attempt.snapshot().target, null);
    count += 1;
  });
  assert.equal(JSON.stringify(stepsOf(pattern)), legacy);
}
assert.ok(meters.has(4) && meters.has(2) && meters.has(3.5), "4/4, 6/8 and 7/8 catalog coverage");
const odd = {
  id: "odd-fixture", kind: "Hands", bpm: 60, beatsPerBar: 3.5, slotsPerBeat: 2,
  loopBeats: 7, steps: [{ beat: 0.5, note: "D3", hand: "left" }, { beat: 3.5, note: "A3", hand: "right" }],
};
assert.deepEqual(phrasesOf(odd).map(({ from, to }) => [from, to]), [[0, 3.5], [3.5, 7]]);
assert.equal(phrasesOf(odd)[0].slots[0], null);
assert.equal(phrasesOf(odd)[0].slots.at(-1), null);
const beginner = beginnerPattern(PATTERNS);
assert.equal(beginner.kind, "Hands");
assert.ok(eventsOf(beginner).every((event) => new Set(event.notes).size === 1));

const noteEvents = [
  { index: 0, notes: ["D3", "A3", "D3"] },
  { index: 1, notes: ["D3"] },
  { index: 2, notes: ["D3"] },
  { index: 3, notes: ["tak"] },
];
const attempt = createNotePractice(noteEvents);
assert.equal(attempt.strike("C5").at, 0);
assert.deepEqual(attempt.strike("A3").partial, ["A3"]);
assert.equal(attempt.strike("A3").at, 0);
assert.deepEqual(attempt.strike("C5").partial, ["A3"]);
assert.equal(attempt.strike("D3").at, 1);
assert.deepEqual(attempt.snapshot().partial, []);
assert.equal(attempt.strike("D3", { repeat: true }).at, 1);
assert.equal(attempt.strike("D3").at, 2);
assert.equal(attempt.strike("D3", { repeat: true }).at, 2);
assert.equal(attempt.strike("D3").at, 3);
assert.equal(attempt.strike("tak").complete, true);
assert.equal(attempt.strike("D3").at, 4);
assert.equal(attempt.snapshot().next, null);
attempt.reset();
attempt.strike("A3");
assert.deepEqual(attempt.reset().partial, []);
assert.equal(attempt.strike("D3").at, 0);
assert.equal(attempt.strike("A3").at, 1);
assert.equal(attempt.reset([{ notes: ["tak"] }]).at, 0);
assert.deepEqual(attempt.snapshot().partial, []);
assert.equal(createNotePractice([]).snapshot().complete, true);

const saved = { version: 1, patternId: beginner.id, phrase: 0, tempo: 60 };
assert.deepEqual(parsePractice(JSON.stringify(saved), PATTERNS), saved);
assert.equal(parsePractice(JSON.stringify({ ...saved, phrase: -5, tempo: -100 }), PATTERNS).tempo, 48);
assert.equal(parsePractice(JSON.stringify({ ...saved, phrase: -5 }), PATTERNS).phrase, 0);
assert.equal(parsePractice(JSON.stringify({ ...saved, phrase: 999, tempo: 999 }), PATTERNS).phrase, phrasesOf(beginner).length - 1);
assert.equal(parsePractice(JSON.stringify({ ...saved, tempo: 999 }), PATTERNS).tempo, 140);
for (const raw of ["{", "null", "[]", "true", "{}", JSON.stringify({ ...saved, version: 2 }), JSON.stringify({ ...saved, patternId: "missing" }), JSON.stringify({ ...saved, phrase: 1.5 }), JSON.stringify({ ...saved, tempo: "60" }), JSON.stringify({ ...saved, tempo: null })]) {
  assert.equal(parsePractice(raw, PATTERNS), null);
}
const store = new Map();
const storage = { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) };
assert.equal(readPractice(storage, PATTERNS), null);
assert.equal(savePractice(storage, saved, PATTERNS), true);
assert.ok(store.has(PRACTICE_KEY));
assert.deepEqual(readPractice(storage, PATTERNS), saved);
const blockedStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
assert.equal(readPractice(blockedStorage, PATTERNS), null);
assert.equal(savePractice(blockedStorage, saved, PATTERNS), false);
assert.equal(savePractice(storage, { ...saved, patternId: "missing" }, PATTERNS), false);

const real = { setTimeout, clearTimeout, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
let timerId = 0;
const timers = new Map();
globalThis.setTimeout = (fn) => { const id = ++timerId; timers.set(id, fn); return id; };
globalThis.clearTimeout = (id) => timers.delete(id);
globalThis.requestAnimationFrame = () => ++timerId;
globalThis.cancelAnimationFrame = () => {};
const fixture = { id: "rest-fixture", bpm: 60, loopBeats: 8, steps: [{ beat: 1, note: "D3", hand: "left" }, { beat: 4, note: "A3", hand: "right" }] };
function mockAudio(resume = async () => {}) {
  let now = 0;
  const hits = [];
  return {
    resume, ready: () => true, now: () => now, latency: () => 0,
    strikeChord(notes, when) { hits.push({ notes, when }); return () => {}; },
    hits,
    advance(time) {
      now = time;
      const queued = [...timers.values()];
      timers.clear();
      queued.forEach((fn) => fn());
    },
  };
}
try {
  for (const cancel of [
    (player) => player.pause(),
    (player) => player.load(odd),
    (player) => player.seek(0, false, true),
    (player) => player.setRange({ from: 0, to: 4 }),
  ]) {
    let release;
    const audio = mockAudio(() => new Promise((resolve) => { release = resolve; }));
    const player = createPlayer(audio, () => {});
    player.load(fixture);
    const pending = player.play(fixture);
    cancel(player);
    release();
    await pending;
    assert.equal(player.playing, false, "pending audio revived cancelled playback");
    assert.equal(audio.hits.length, 0);
    player.pause();
  }
  const audio = mockAudio();
  const player = createPlayer(audio, () => {});
  player.load(fixture);
  player.setRange({ from: 0, to: 4 });
  player.setLoop(false);
  await player.play(fixture, 0, { keepTempo: true });
  assert.equal(audio.hits.length, 0, "leading rest was skipped");
  audio.advance(0.9);
  assert.deepEqual(audio.hits[0].notes, ["D3"]);
  assert.ok(Math.abs(audio.hits[0].when - 1.05) < 0.0001);
  audio.advance(2);
  assert.equal(player.playing, true, "trailing rest cut short");
  audio.advance(4.04);
  assert.equal(player.playing, true);
  audio.advance(4.06);
  assert.equal(player.playing, false);
  assert.equal(player.snapshot().ended, true);
  assert.equal(audio.hits.length, 1, "played beyond selected phrase");
  player.setRange({ from: 2, to: 4 });
  await player.play(fixture, 2);
  assert.equal(player.playing, false, "silent range fell back to full pattern");
  assert.equal(audio.hits.length, 1);
  player.pause();

  for (const beats of [2, 3.5, 4]) {
    const pattern = { ...fixture, id: `meter-${beats}`, beatsPerBar: beats, loopBeats: beats * 2, steps: [{ beat: 0, note: "D3" }, { beat: beats, note: "A3" }] };
    const sound = mockAudio();
    const loop = createPlayer(sound, () => {});
    loop.load(pattern);
    loop.setRange({ from: 0, to: beats });
    loop.setLoop(true);
    await loop.play(pattern);
    sound.advance(beats - 0.1);
    assert.equal(sound.hits.length, 2);
    assert.ok(Math.abs(sound.hits[1].when - sound.hits[0].when - beats) < 0.0001);
    assert.ok(sound.hits.every((hit) => hit.notes[0] === "D3"));
    loop.pause();
  }
} finally {
  Object.assign(globalThis, real);
}
console.log(`Practice checks passed: ${PATTERNS.length} patterns, ${count} phrases, note matching, storage, cancelled audio, rest timing and 4/4, 6/8, 7/8 loops.`);
