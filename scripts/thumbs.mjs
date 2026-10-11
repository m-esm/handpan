import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PATTERNS } from "../js/score.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "img", "thumbs");
const GROK = process.env.GROK_BIN || join(homedir(), ".grok", "bin", "grok");
const SIZE = 320;
const QUALITY = 82;
const PARALLEL = 4;

const STYLE = [
  "Style, the same for every image in a set of forty: flat vector illustration, large simple shapes, no outlines, no texture, no text, no letters, no numbers, no people, no hands, no border, no frame.",
  "Palette only: a near-black warm brown #14110e background that fills the whole square to every edge, brass #e6b15a, pale brass #f4d7a4, cream #f0e2d2, copper #a86b3c, and one muted teal #3f7f7a accent.",
  "One clear subject in the centre, made of at most eight large shapes, that fills two thirds of the square. No small detail. It must read at 56 pixels.",
].join(" ");

function subjectOf(pattern) {
  const what = `"${pattern.title}". What it is: ${pattern.blurb}`;
  if (pattern.kind === "Pieces") return `Subject: the scene that the title of this handpan piece names: ${what}`;
  return `Subject: one simple object or scene that fits the title of this short handpan drill: ${what}`;
}

function promptFor(pattern, png) {
  return [
    "Use your image generation tool to make one square image.",
    subjectOf(pattern),
    STYLE,
    `Save it as a PNG file at ${png}. Reply with only the file path.`,
  ].join("\n");
}

function run(command, args) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => done({ code: 1, output: error.message }));
    child.on("close", (code) => done({ code, output }));
  });
}

function fileOf(pattern) {
  return join(OUT, `${pattern.id}.webp`);
}

async function make(pattern, work) {
  const png = join(work, `${pattern.id}.png`);
  const drawn = await run(GROK, ["--cwd", work, "--always-approve", "--sandbox", "workspace", "-p", promptFor(pattern, png)]);
  if (!existsSync(png)) return `${pattern.id}: no image. ${drawn.output.trim().slice(-200)}`;
  const packed = await run("cwebp", ["-quiet", "-q", String(QUALITY), "-resize", String(SIZE), String(SIZE), png, "-o", fileOf(pattern)]);
  return packed.code === 0 ? null : `${pattern.id}: cwebp failed. ${packed.output.trim()}`;
}

function drift() {
  const wanted = new Set(PATTERNS.map((pattern) => `${pattern.id}.webp`));
  const found = existsSync(OUT) ? readdirSync(OUT).filter((name) => name.endsWith(".webp")) : [];
  const missing = [...wanted].filter((name) => !found.includes(name)).map((name) => `MISSING ${name}`);
  const orphans = found.filter((name) => !wanted.has(name)).map((name) => `ORPHAN ${name}`);
  return [...missing, ...orphans];
}

async function generate(ids) {
  mkdirSync(OUT, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "handpan-thumbs-"));
  const queue = PATTERNS.filter((pattern) => (ids.length ? ids.includes(pattern.id) : !existsSync(fileOf(pattern))));
  console.log(`${queue.length} to make, work dir ${work}`);
  const failures = [];
  const worker = async () => {
    for (let pattern = queue.shift(); pattern; pattern = queue.shift()) {
      const fault = await make(pattern, work);
      console.log(fault || `${pattern.id}: ok`);
      if (fault) failures.push(fault);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return failures;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "--check") await generate(args);
  const faults = drift();
  faults.forEach((line) => console.log(line));
  console.log(`${faults.length} thumbnail faults`);
  process.exit(faults.length ? 1 : 0);
}

main();
