import assert from "node:assert/strict";
import { cpSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DAY_SECONDS, YEAR_SECONDS, REST_SECONDS, writeCycle } from "../js/environments.js";

const REPO_JS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "js");
const MIN_SAME_HAND_MS = 210;
const CYCLE_HEX = ["zenith", "horizon", "ground", "glow", "cloud", "sky", "light", "steppe", "rock", "ranges", "leaf", "plaster", "brick", "mud", "water", "sunColor"];
const DAY_FIELDS = ["day", "zenith", "horizon", "ground", "glow", "cloud", "stars", "sky", "fog", "exposure", "hemi", "lamp", "light", "sunX", "sunY", "sunZ", "moonX", "moonY", "moonZ", "sunColor", "moonColor"];

function channelGap(a, b) {
  return Math.max(
    Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)),
    Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)),
    Math.abs((a & 255) - (b & 255)),
  );
}

function assertCycle() {
  const left = {};
  const right = {};
  assert.equal(writeCycle(0, left), left);
  assert.equal(left.snow, 0.22);
  assert.equal(left.zenith, 0x030919);
  assert.equal(left.sunY, -46);
  assert.equal(left.moonY, 46);
  assert.equal(left.stars, 1);
  assert.equal(left.sunColor, 0xfff1c4);
  assert.equal(left.moonColor, 0xd7e4f6);
  writeCycle(DAY_SECONDS * 0.5, right);
  assert.ok(right.sunY > 40);
  assert.equal(right.stars, 0);
  writeCycle(0.42 * YEAR_SECONDS, right);
  assert.ok(right.snow < 0.02);
  writeCycle(0.82 * YEAR_SECONDS, right);
  assert.ok(right.snow > 0.97);
  assert.ok(Number.isFinite(REST_SECONDS));
  writeCycle(REST_SECONDS, right);
  assert.ok(right.sunY > 30);
  writeCycle(-3, left);
  writeCycle(YEAR_SECONDS - 3, right);
  assert.deepEqual(left, right);
  writeCycle(0, left);
  writeCycle(YEAR_SECONDS, right);
  assert.deepEqual(left, right);
  writeCycle(DAY_SECONDS, right);
  for (const key of DAY_FIELDS) assert.equal(left[key], right[key], key);
  let prev = left;
  let next = right;
  writeCycle(0, prev);
  for (let t = 0.5; t <= YEAR_SECONDS + DAY_SECONDS; t += 0.5) {
    writeCycle(t, next);
    for (const key of CYCLE_HEX) {
      const gap = channelGap(prev[key], next[key]);
      assert.ok(gap < 24, `${key} at ${t} moved ${gap}`);
    }
    assert.ok(Math.abs(prev.sunY - next.sunY) < 2, `sunY at ${t}`);
    for (const value of Object.values(next)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `non-finite at ${t}`);
    }
    assert.equal(next.moonColor, 0xd7e4f6);
    const swap = prev;
    prev = next;
    next = swap;
  }
}

function scoreDir(candidate) {
  if (!candidate) return REPO_JS;
  const dir = mkdtempSync(join(tmpdir(), "handpan-check-"));
  cpSync(REPO_JS, dir, { recursive: true });
  copyFileSync(resolve(candidate), join(dir, "pieces.js"));
  return dir;
}

async function loadScore(candidate) {
  return import(pathToFileURL(join(scoreDir(candidate), "score.js")).href);
}

function msPerBeat(pattern) {
  return 60000 / pattern.bpm;
}

function byBeat(steps) {
  return [...steps].sort((a, b) => a.beat - b.beat);
}

function badNotes(pattern, score) {
  return pattern.steps
    .filter((item) => !(item.note in score.NOTES) && item.note !== score.TAK)
    .map((item) => `beat ${item.beat}: note ${item.note}`);
}

function offSides(pattern, score) {
  return pattern.steps
    .filter((item) => item.note in score.NOTES && !score.NOTES[item.note].ding)
    .filter((item) => item.hand !== score.SIDE[item.note])
    .map((item) => `beat ${item.beat}: ${item.note} in the ${item.hand} hand`);
}

function sharedHands(pattern) {
  const faults = [];
  const hands = new Map();
  for (const item of pattern.steps) {
    const seen = hands.get(item.beat) || [];
    if (seen.includes(item.hand)) faults.push(`beat ${item.beat}: ${item.hand} hand twice`);
    hands.set(item.beat, [...seen, item.hand]);
  }
  return faults;
}

function pastEnd(pattern) {
  return pattern.steps
    .filter((item) => item.beat >= pattern.loopBeats)
    .map((item) => `beat ${item.beat}: past ${pattern.loopBeats}`);
}

function placedCount(sheet) {
  return sheet.sections.flatMap((section) => section.bars).flatMap((bar) => bar.slots).filter(Boolean).length;
}

function sheetLost(pattern, score) {
  const expected = score.eventsOf(pattern).length;
  try {
    const placed = placedCount(score.sheetOf(pattern));
    return placed < expected ? [`${placed} of ${expected} events on the sheet`] : [];
  } catch (error) {
    return [`sheet failed: ${error.message}`];
  }
}

function fastSameHand(pattern) {
  const faults = [];
  const last = {};
  for (const item of byBeat(pattern.steps)) {
    const before = last[item.hand];
    const ms = before === undefined ? Infinity : (item.beat - before) * msPerBeat(pattern);
    if (ms > 0 && ms < MIN_SAME_HAND_MS) faults.push(`beat ${item.beat}: ${item.hand} hand again after ${Math.round(ms)} ms`);
    last[item.hand] = item.beat;
  }
  return faults;
}

const CHECKS = [
  ["BAD NOTE", badNotes],
  ["OFF SIDE", offSides],
  ["TWO NOTES ONE HAND", sharedHands],
  ["PAST END", pastEnd],
  ["SHEET LOST", sheetLost],
  ["FAST SAME HAND", fastSameHand],
];

function faultsOf(pattern, score) {
  return CHECKS.flatMap(([kind, check]) => check(pattern, score).map((detail) => `${kind} ${pattern.id}: ${detail}`));
}

function duplicateIds(patterns) {
  const seen = new Set();
  const faults = [];
  for (const { id } of patterns) {
    if (seen.has(id)) faults.push(`DUPLICATE ID ${id}`);
    seen.add(id);
  }
  return faults;
}

async function undated(patterns) {
  const { ADDED } = await import(pathToFileURL(join(REPO_JS, "added.js")).href);
  return patterns.filter(({ id }) => !ADDED[id]).map(({ id }) => `NO ADDED DATE ${id}: run node scripts/added.mjs`);
}

function noteUse(pattern, score) {
  const counts = {};
  for (const item of pattern.steps) counts[item.note] = (counts[item.note] || 0) + 1;
  const order = [...Object.keys(score.NOTES), score.TAK];
  return order.filter((id) => counts[id]).map((id) => `${id}×${counts[id]}`).join(" ");
}

function summary(pattern, score) {
  const bars = pattern.loopBeats / pattern.beatsPerBar;
  const seconds = (pattern.loopBeats * msPerBeat(pattern)) / 1000;
  return `${pattern.id}: ${bars} bars, ${pattern.steps.length} strikes, ${seconds.toFixed(1)} s, ${noteUse(pattern, score)}`;
}

async function main() {
  assertCycle();
  const score = await loadScore(process.argv[2]).catch((error) => {
    console.log(`COMPILE ${error.message}`);
    process.exit(1);
  });
  const pieces = score.PATTERNS.filter((pattern) => pattern.sections?.length);
  const faults = duplicateIds(score.PATTERNS);
  for (const pattern of pieces) {
    console.log(summary(pattern, score));
    const found = faultsOf(pattern, score);
    found.forEach((line) => console.log(`  ${line}`));
    faults.push(...found);
  }
  const missing = await undated(score.PATTERNS);
  faults.push(...missing);
  faults.filter((line) => line.startsWith("DUPLICATE ID") || line.startsWith("NO ADDED DATE")).forEach((line) => console.log(line));
  console.log(`${faults.length} faults`);
  process.exit(faults.length ? 1 : 0);
}

main();
