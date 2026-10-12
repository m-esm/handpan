import { eventsOf, sheetOf } from "./score.js";

export const PRACTICE_KEY = "alamut-practice-v1";

export function practiceTempo(bpm) {
  return Math.min(140, Math.max(48, Math.round(bpm)));
}

export function phrasesOf(pattern) {
  const sheet = sheetOf(pattern);
  const events = eventsOf(pattern);
  return sheet.sections.flatMap((section) => section.bars.map((bar) => {
    const from = bar.bar * sheet.barBeats;
    const to = (bar.bar + 1) * sheet.barBeats;
    return {
      first: bar.bar,
      end: bar.bar + 1,
      name: section.name,
      from,
      to,
      slots: bar.slots,
      events: events.filter((event) => event.beat >= from && event.beat < to),
    };
  }));
}

export function beginnerPattern(patterns) {
  const hands = patterns.filter((pattern) => pattern.kind === "Hands");
  const difficulty = (pattern) => {
    const events = eventsOf(pattern);
    const notes = new Set(events.flatMap((event) => event.notes)).size;
    const chords = events.filter((event) => new Set(event.notes).size > 1).length;
    return chords * 100 + notes * 10 + events.length / pattern.loopBeats;
  };
  return [...(hands.length ? hands : patterns)].sort((a, b) => difficulty(a) - difficulty(b))[0] || null;
}

export function createNotePractice(events) {
  let targets = events;
  let at = 0;
  let partial = new Set();
  function snapshot() {
    return { at, target: targets[at] || null, next: targets[at + 1] || null, partial: [...partial], complete: at >= targets.length, total: targets.length };
  }
  function reset(next = targets) {
    targets = next;
    at = 0;
    partial = new Set();
    return snapshot();
  }
  function strike(note, { repeat = false } = {}) {
    const target = targets[at];
    if (!target || repeat) return { ...snapshot(), accepted: false };
    const wanted = new Set(target.notes);
    if (!wanted.has(note) || partial.has(note)) return { ...snapshot(), accepted: false };
    partial.add(note);
    if (partial.size === wanted.size) {
      at += 1;
      partial = new Set();
    }
    return { ...snapshot(), accepted: true };
  }
  return { snapshot, reset, strike };
}

export function parsePractice(raw, patterns) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || value.version !== 1 || typeof value.patternId !== "string") return null;
    const pattern = patterns.find((item) => item.id === value.patternId);
    if (!pattern || !Number.isInteger(value.phrase) || !Number.isFinite(value.tempo)) return null;
    const phrases = phrasesOf(pattern);
    if (!phrases.length) return null;
    return { version: 1, patternId: pattern.id, phrase: Math.max(0, Math.min(phrases.length - 1, value.phrase)), tempo: practiceTempo(value.tempo) };
  } catch {
    return null;
  }
}

export function readPractice(storage, patterns) {
  try {
    return parsePractice(storage.getItem(PRACTICE_KEY), patterns);
  } catch {
    return null;
  }
}

export function savePractice(storage, value, patterns) {
  const valid = parsePractice(value, patterns);
  if (!valid) return false;
  try {
    storage.setItem(PRACTICE_KEY, JSON.stringify(valid));
    return true;
  } catch {
    return false;
  }
}
