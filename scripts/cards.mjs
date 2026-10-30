import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PATTERNS } from "../js/score.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "img", "cards");
const MARK = readFileSync(join(ROOT, "img", "alamut-mark.svg"), "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const HOST = "handpan.moshes.io";
const QUALITY = "82";

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(text, width, maxLines) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.;:]?\s*\S*$/, "")}…`;
  }
  return lines;
}

function signature(pattern) {
  const beats = pattern.beatsPerBar || 4;
  const perBeat = pattern.slotsPerBeat || 1;
  if (pattern.count === "slots" || !Number.isInteger(beats)) return `${Math.round(beats * perBeat)}/8`;
  return `${beats}/4`;
}

function coverData(pattern, work) {
  const webp = join(ROOT, "img", "thumbs", `${pattern.id}.webp`);
  if (!existsSync(webp)) return null;
  const png = join(work, `${pattern.id}.png`);
  execFileSync("dwebp", ["-quiet", webp, "-o", png]);
  return `data:image/png;base64,${readFileSync(png).toString("base64")}`;
}

function card(pattern, cover) {
  const titleSize = pattern.title.length > 18 ? 60 : 78;
  const titleLines = wrap(pattern.title, pattern.title.length > 18 ? 22 : 16, 2);
  const blurbLines = wrap(pattern.blurb, 44, 3);
  const titleTop = 230;
  const lineGap = titleSize * 1.05;
  const blurbTop = titleTop + lineGap * (titleLines.length - 1) + 64;
  const facts = `${pattern.kind.toUpperCase()}  ·  ${pattern.bpm} BPM  ·  ${signature(pattern)}  ·  ${Math.round(pattern.loopBeats / (pattern.beatsPerBar || 4))} BARS`;
  const art = cover
    ? `<image href="${cover}" x="80" y="115" width="400" height="400" clip-path="url(#round)" preserveAspectRatio="xMidYMid slice"/>`
    : `<g transform="translate(130 165) scale(4.6875)">${MARK}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="20%" cy="0%" r="90%"><stop offset="0" stop-color="#d9b77a" stop-opacity="0.26"/><stop offset="0.65" stop-color="#10232b" stop-opacity="0"/></radialGradient>
    <clipPath id="round"><rect x="80" y="115" width="400" height="400" rx="36"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#10232b"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="80" y="115" width="400" height="400" rx="36" fill="#14110e"/>
  ${art}
  <rect x="80" y="115" width="400" height="400" rx="36" fill="none" stroke="#d9b77a" stroke-opacity="0.35" stroke-width="2"/>
  <text x="540" y="150" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="22" letter-spacing="3" fill="#d9b77a">${esc(facts)}</text>
  ${titleLines.map((line, i) => `<text x="536" y="${titleTop + i * lineGap}" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${titleSize}" letter-spacing="-2" fill="#f3eddf">${esc(line)}</text>`).join("\n  ")}
  ${blurbLines.map((line, i) => `<text x="540" y="${blurbTop + i * 40}" font-family="Helvetica, Arial, sans-serif" font-size="29" fill="#c9d3d6">${esc(line)}</text>`).join("\n  ")}
  <g transform="translate(540 520) scale(0.75)">${MARK}</g>
  <text x="600" y="545" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="24" fill="#f3eddf">Alamut</text>
  <text x="700" y="545" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#8fa3a9">${HOST}</text>
</svg>`;
}

function render(pattern, work) {
  const svg = join(work, `${pattern.id}.svg`);
  const png = join(work, `${pattern.id}.card.png`);
  const jpg = join(work, `${pattern.id}.jpg`);
  writeFileSync(svg, card(pattern, coverData(pattern, work)));
  execFileSync("rsvg-convert", ["-w", "1200", "-h", "630", "-o", png, svg]);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", QUALITY, png, "--out", jpg], { stdio: "ignore" });
  return readFileSync(jpg);
}

function fileOf(pattern) {
  return join(OUT, `${pattern.id}.jpg`);
}

function orphans() {
  if (!existsSync(OUT)) return [];
  const wanted = new Set(PATTERNS.map((pattern) => `${pattern.id}.jpg`));
  return readdirSync(OUT).filter((name) => !wanted.has(name));
}

const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
const targets = only ? PATTERNS.filter((pattern) => pattern.id === only) : PATTERNS;
const work = mkdtempSync(join(tmpdir(), "alamut-cards-"));
mkdirSync(OUT, { recursive: true });

if (process.argv.includes("--check")) {
  const stale = targets.filter((pattern) => !existsSync(fileOf(pattern)) || !render(pattern, work).equals(readFileSync(fileOf(pattern)))).map((pattern) => pattern.id);
  const extra = orphans();
  rmSync(work, { recursive: true, force: true });
  if (stale.length || extra.length) {
    stale.forEach((id) => console.log(`stale: img/cards/${id}.jpg`));
    extra.forEach((name) => console.log(`orphan: img/cards/${name}`));
    console.log("run node scripts/cards.mjs");
    process.exit(1);
  }
  console.log(`share cards are current (${targets.length} files)`);
} else {
  for (const pattern of targets) writeFileSync(fileOf(pattern), render(pattern, work));
  orphans().forEach((name) => console.log(`orphan, delete by hand: img/cards/${name}`));
  rmSync(work, { recursive: true, force: true });
  console.log(`wrote ${targets.length} share cards to img/cards/`);
}
