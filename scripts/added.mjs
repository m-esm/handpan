import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PATTERNS } from "../js/score.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "js", "added.js");

function now() {
  return new Date().toISOString();
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function presentIn(commit, id) {
  try {
    git(["grep", "-q", "-F", `"${id}"`, commit, "--", "js"]);
    return true;
  } catch {
    return false;
  }
}

function addedDay(id) {
  const changes = git(["log", "--format=%H %P %cI", `-S"${id}"`, "--", "js"]).split("\n").filter(Boolean);
  for (const line of changes) {
    const [commit, ...rest] = line.split(" ");
    const day = rest.pop();
    const parent = rest[0];
    if (presentIn(commit, id) && !(parent && presentIn(parent, id))) return new Date(day).toISOString();
  }
  return now();
}

function render(added) {
  const lines = Object.entries(added).map(([id, day]) => `  ${JSON.stringify(id)}: ${JSON.stringify(day)},`);
  return ["export const ADDED = {", ...lines, "};", ""].join("\n");
}

function current() {
  try {
    return readFileSync(OUT, "utf8");
  } catch {
    return "";
  }
}

const added = Object.fromEntries(PATTERNS.map((pattern) => [pattern.id, addedDay(pattern.id)]));
const text = render(added);

if (process.argv.includes("--check")) {
  if (text === current()) {
    console.log("js/added.js is current");
  } else {
    console.log("js/added.js is stale: run node scripts/added.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${Object.keys(added).length} added dates to js/added.js`);
}
