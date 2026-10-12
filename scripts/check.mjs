import { cpSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_JS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "js");
const MIN_SAME_HAND_MS = 210;

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
  faults.filter((line) => line.startsWith("DUPLICATE ID")).forEach((line) => console.log(line));
  console.log(`${faults.length} faults`);
  process.exit(faults.length ? 1 : 0);
}

main();
