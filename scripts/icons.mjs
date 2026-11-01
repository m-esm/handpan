import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARK = join(ROOT, "img", "alamut-mark.svg");
const ICONS = [
  ["img/icon-192.png", 192],
  ["img/icon-512.png", 512],
  ["img/apple-touch-icon.png", 180],
];
const OG = "img/og.png";

function card() {
  const mark = readFileSync(MARK, "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="-10%" r="90%"><stop offset="0" stop-color="#d9b77a" stop-opacity="0.22"/><stop offset="0.6" stop-color="#10232b" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#10232b"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g transform="translate(96 175) scale(4.375)">${mark}</g>
  <text x="420" y="268" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="128" letter-spacing="-5" fill="#f3eddf">Alamut</text>
  <text x="424" y="334" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="26" letter-spacing="4" fill="#d9b77a">HANDPAN PRACTICE IN THE BROWSER</text>
  <text x="424" y="410" font-family="Helvetica, Arial, sans-serif" font-size="38" fill="#c9d3d6">Play and learn a 10-note D Kurd handpan</text>
  <text x="424" y="462" font-family="Helvetica, Arial, sans-serif" font-size="38" fill="#c9d3d6">in the browser, with notes for every piece.</text>
  <text x="424" y="556" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#8fa3a9">handpan.moshes.io</text>
</svg>`;
}

function render(svgPath, outPath, width, height) {
  execFileSync("rsvg-convert", ["-w", String(width), "-h", String(height || width), "-o", outPath, svgPath]);
}

const wanted = [...ICONS.map(([file]) => file), OG];
if (process.argv.includes("--check")) {
  const missing = wanted.filter((file) => !existsSync(join(ROOT, file)));
  if (missing.length) {
    missing.forEach((file) => console.log(`missing: ${file}`));
    console.log("run node scripts/icons.mjs");
    process.exit(1);
  }
  console.log(`icons present (${wanted.length} files)`);
} else {
  for (const [file, size] of ICONS) render(MARK, join(ROOT, file), size);
  const work = mkdtempSync(join(tmpdir(), "alamut-og-"));
  const svg = join(work, "og.svg");
  writeFileSync(svg, card());
  render(svg, join(ROOT, OG), 1200, 630);
  console.log(`wrote ${wanted.join(", ")}`);
}
