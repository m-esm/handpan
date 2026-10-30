export const TIERS = [
  { name: "Ember", at: 0 },
  { name: "Spark", at: 3 },
  { name: "Lantern", at: 6 },
  { name: "Moonlit", at: 12 },
  { name: "Starlit", at: 20 },
  { name: "Mythic", at: 32 },
];
export const MILESTONES = [5, 10, 20, 32, 50, 75, 100];
export const CLEAN = 0.25;
const COMBO_STEP = 5;
const COMBO_MAX = 5;
const NOTABLE = 5;
const BEST_KEY = "disc-kurd-best";
const WORDS = [
  [0.25, "Muffled"],
  [0.5, "Fair"],
  [0.75, "Clean"],
  [1.01, "Pure"],
];

export function wordFor(quality) {
  return WORDS.find(([top]) => quality < top)[1];
}

export function tierOf(streak) {
  let index = 0;
  TIERS.forEach((tier, i) => {
    if (streak >= tier.at) index = i;
  });
  const tier = TIERS[index];
  const next = TIERS[index + 1];
  const progress = next ? (streak - tier.at) / (next.at - tier.at) : 1;
  return { index, name: tier.name, next: next ? next.at : null, progress, magic: (index + progress) / (TIERS.length - 1) };
}

export function comboOf(streak) {
  return Math.min(COMBO_MAX, 1 + Math.floor(streak / COMBO_STEP));
}

function readBest(storage) {
  try {
    return Number(storage.getItem(BEST_KEY)) || 0;
  } catch (err) {
    void err;
    return 0;
  }
}

function writeBest(storage, best) {
  try {
    storage.setItem(BEST_KEY, String(best));
  } catch (err) {
    void err;
  }
}

export function createGame(storage) {
  let streak = 0;
  let best = readBest(storage);
  let points = 0;
  let strikes = 0;
  let last = null;
  let bestBefore = best;

  function strike({ id, quality, miss, wanted = [] }) {
    strikes += 1;
    const clean = !miss && quality >= CLEAN;
    const broke = streak > 0 && !clean;
    if (streak === 0) bestBefore = best;
    streak = clean ? streak + 1 : 0;
    const combo = comboOf(clean ? streak - 1 : 0);
    const gained = clean ? Math.round(quality * 100) * combo : 0;
    points += gained;
    const newBest = bestBefore >= NOTABLE && streak === bestBefore + 1;
    if (streak > best) {
      best = streak;
      writeBest(storage, best);
    }
    const milestone = MILESTONES.includes(streak) ? streak : 0;
    last = { id, quality, miss, wanted, clean, gained, combo, broke, milestone, newBest, count: strikes };
    return last;
  }

  function rest() {
    streak = 0;
    points = 0;
    strikes = 0;
    last = null;
    bestBefore = best;
  }

  function snapshot() {
    return { streak, best, points, strikes, combo: comboOf(streak), tier: tierOf(streak), last };
  }

  return { strike, rest, snapshot };
}
