import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NOTES, PATTERNS, TAK, numberOf, pretty, sheetOf } from "../js/score.js";
import { ADDED } from "../js/added.js";
import { PIECES_FA } from "../js/content.fa.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://handpan.moshes.io";
const REPO = "https://github.com/m-esm/handpan";
const PAGES = join(ROOT, "p");
const NAME = "Alamut";
const INSTRUMENT = "Gear4music DISC 10-note D Kurd handpan";
const FONTS = "https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&family=Vazirmatn:wght@400;500;600;700&family=Markazi+Text:wght@500;600;700&display=swap";

const KINDS = {
  Hands: "Short hand-alternation drills that teach where the notes sit and which hand reaches them.",
  Chords: "Two-note chord drills on the fields that ring together on a D Kurd handpan.",
  Grooves: "Repeating rhythmic loops to build steady time and a relaxed strike.",
  Songs: "Riffs and melodies from well-known songs, moved onto the pan's ten notes.",
  Traditional: "Public-domain melodies, carols and folk tunes arranged for the pan's ten notes.",
  "GPT-6 Astra": "Long original pieces written with the GPT-6 Astra model for this instrument.",
  Pieces: "Original pieces with named sections, written for this instrument.",
};

const NOTE_ORDER = Object.keys(NOTES);

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attr(text) {
  return esc(text).replace(/\n/g, " ");
}

function clip(text, max = 155) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function kindOrder() {
  const seen = [];
  for (const pattern of PATTERNS) if (!seen.includes(pattern.kind)) seen.push(pattern.kind);
  return seen;
}

function signature(pattern) {
  const beats = pattern.beatsPerBar || 4;
  const perBeat = pattern.slotsPerBeat || 1;
  if (pattern.count === "slots" || !Number.isInteger(beats)) return `${Math.round(beats * perBeat)}/8`;
  return `${beats}/4`;
}

function bars(pattern) {
  return Math.round(pattern.loopBeats / (pattern.beatsPerBar || 4));
}

function seconds(pattern) {
  return Math.round((pattern.loopBeats * 60) / pattern.bpm);
}

function isoDuration(total) {
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `PT${minutes ? `${minutes}M` : ""}${rest || !minutes ? `${rest}S` : ""}`;
}

function notesUsed(pattern) {
  const ids = new Set(pattern.steps.map((step) => step.note));
  return NOTE_ORDER.filter((id) => ids.has(id));
}

function noteLabel(id) {
  const note = NOTES[id];
  return `${pretty(id)}${note.ding ? " (ding)" : ""}, ${note.hz.toFixed(1)} Hz`;
}

function slotText(event) {
  if (!event) return ".";
  const marks = event.notes.map((note) => (note === TAK ? "\u00d7" : numberOf(note)));
  return marks.length > 1 ? `[${marks.join("")}]` : marks[0];
}

function barText(bar, perBeat) {
  const groups = [];
  for (let i = 0; i < bar.slots.length; i += perBeat) groups.push(bar.slots.slice(i, i + perBeat).map(slotText).join(" "));
  return groups.join("  ");
}

function notation(pattern) {
  const sheet = sheetOf(pattern);
  return sheet.sections.map((section) => ({
    name: section.name,
    bars: section.bars.map((bar) => ({ number: bar.bar + 1, text: barText(bar, sheet.perBeat) })),
  }));
}

function addedDay(id) {
  return ADDED[id] ? ADDED[id].slice(0, 10) : null;
}

function pageUrl(id) {
  return `${SITE}/p/${id}`;
}

function thumb(id) {
  return existsSync(join(ROOT, "img", "thumbs", `${id}.webp`)) ? `img/thumbs/${id}.webp` : null;
}

function card(id) {
  return existsSync(join(ROOT, "img", "cards", `${id}.jpg`)) ? `${SITE}/img/cards/${id}.jpg` : null;
}

function head({ title, description, canonical, image, imageAlt, type, extra = "", depth = 1 }) {
  const up = "../".repeat(depth);
  const share = image || `${SITE}/img/og.png`;
  const alt = imageAlt || "Alamut mark beside the words: play and learn a 10-note D Kurd handpan in the browser";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#10232b">
  <title>${esc(title)}</title>
  <meta name="description" content="${attr(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <link rel="canonical" href="${canonical}">
  <meta property="og:site_name" content="${NAME}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${share}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="${share.endsWith(".png") ? "image/png" : "image/jpeg"}">
  <meta property="og:image:alt" content="${attr(alt)}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:locale:alternate" content="fa_IR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(title)}">
  <meta name="twitter:description" content="${attr(description)}">
  <meta name="twitter:image" content="${share}">
  <meta name="twitter:image:alt" content="${attr(alt)}">
  <link rel="icon" type="image/svg+xml" href="${up}img/alamut-mark.svg">
  <link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png">
  <link rel="manifest" href="${up}site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONTS}">
  <link rel="stylesheet" href="${up}css/app.css">
  <link rel="stylesheet" href="${up}css/site.css">
${extra}</head>`;
}

function jsonLd(data) {
  return `  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>\n`;
}

function header(depth = 1) {
  const up = "../".repeat(depth);
  return `  <header class="site-top">
    <a class="brand" href="${up}" aria-label="${NAME} home"><img src="${up}img/alamut-mark.svg" width="34" height="34" alt=""><span>${NAME}</span></a>
    <nav class="site-nav" aria-label="Site"><a href="${up}p/">All pieces</a><a href="${up}features.html">Features</a><a href="${up}index.html">Open the app</a></nav>
  </header>`;
}

function footer(depth = 1) {
  const up = "../".repeat(depth);
  return `  <footer class="site-foot">
    <p>${NAME} is a free browser practice space for the ${INSTRUMENT}. <a href="${up}">Home</a> · <a href="${up}p/">All pieces</a> · <a href="${up}features.html">Features</a> · <a href="${REPO}">Source on GitHub</a> · <a href="${up}llms.txt">llms.txt</a></p>
  </footer>`;
}

function breadcrumb(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

function website() {
  return { "@type": "WebSite", "@id": `${SITE}/#website`, name: NAME, url: `${SITE}/`, inLanguage: ["en", "fa"] };
}

function piecePage(pattern, index) {
  const fa = PIECES_FA[pattern.id];
  const used = notesUsed(pattern);
  const sections = notation(pattern);
  const added = addedDay(pattern.id);
  const image = thumb(pattern.id);
  const title = `${pattern.title} on handpan: D Kurd notes and tabs | ${NAME}`;
  const description = clip(`${pattern.title} for a 10-note D Kurd handpan, ${pattern.bpm} BPM in ${signature(pattern)}, ${bars(pattern)} bars with number notation and a browser player. ${pattern.blurb}`, 160);
  const canonical = pageUrl(pattern.id);
  const siblings = PATTERNS.filter((item) => item.kind === pattern.kind);
  const at = siblings.indexOf(pattern);
  const previous = siblings[at - 1];
  const next = siblings[at + 1];
  const resource = {
    "@type": "LearningResource",
    "@id": `${canonical}#resource`,
    name: pattern.title,
    alternateName: fa && fa.title !== pattern.title ? fa.title : undefined,
    description: pattern.blurb,
    abstract: pattern.about,
    url: canonical,
    inLanguage: ["en", "fa"],
    learningResourceType: `handpan ${pattern.kind === "Pieces" || pattern.kind === "GPT-6 Astra" ? "piece" : pattern.kind === "Songs" || pattern.kind === "Traditional" ? "song arrangement" : "drill"}`,
    educationalLevel: "beginner",
    teaches: `Playing ${pattern.title} on a ${INSTRUMENT}`,
    timeRequired: isoDuration(seconds(pattern)),
    about: { "@type": "MusicComposition", name: pattern.title, musicalKey: "D minor", inLanguage: "en" },
    image: image ? `${SITE}/${image}` : undefined,
    datePublished: added || undefined,
    genre: pattern.kind,
    keywords: ["handpan", "D Kurd", "handpan notes", "handpan tabs", pattern.title, pattern.kind],
    isPartOf: { "@id": `${SITE}/#website` },
    isAccessibleForFree: true,
    license: `${REPO}#readme`,
  };
  const data = { "@context": "https://schema.org", "@graph": [website(), resource, breadcrumb([{ name: NAME, url: `${SITE}/` }, { name: "All pieces", url: `${SITE}/p/` }, { name: pattern.title, url: canonical }])] };
  const facts = [
    ["Kind", pattern.kind],
    ["Tempo", `${pattern.bpm} BPM`],
    ["Time signature", signature(pattern)],
    ["Length", `${bars(pattern)} bars, about ${seconds(pattern)} seconds`],
    ["Notes used", used.map(pretty).join(", ")],
    added ? ["Added", added] : null,
  ].filter(Boolean);
  const legend = NOTE_ORDER.map((id) => `<li><code>${numberOf(id)}</code> ${esc(noteLabel(id))}</li>`).join("");
  const body = `
<body class="site">
${header()}
  <main class="site-page piece-page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../">${NAME}</a> › <a href="./">All pieces</a> › <span>${esc(pattern.title)}</span></nav>
    <p class="site-kicker">${esc(pattern.kind)} · handpan ${pattern.kind === "Songs" || pattern.kind === "Traditional" ? "arrangement" : pattern.kind === "Pieces" || pattern.kind === "GPT-6 Astra" ? "piece" : "drill"} for D Kurd</p>
    <h1>${esc(pattern.title)}</h1>
    <p class="site-lead">${esc(pattern.blurb)}</p>
    <div class="piece-hero">
      ${image ? `<img class="piece-cover" src="../${image}" width="320" height="320" alt="Cover illustration for ${attr(pattern.title)}">` : ""}
      <dl class="facts">${facts.map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
    </div>
    <p class="site-actions"><a class="site-primary" href="../index.html#/p/${pattern.id}">Play in ${NAME}</a><a class="site-secondary" href="../index.html#/p/${pattern.id}/learn">Learn bar by bar</a></p>

    <h2>About this ${pattern.kind === "Songs" || pattern.kind === "Traditional" ? "arrangement" : "pattern"}</h2>
    <p class="prose">${esc(pattern.about)}</p>

    <h2>Notation</h2>
    <p class="site-note">Each line is one bar in ${signature(pattern)}. Numbers are the pan's fields, a dot is a rest, brackets hold notes struck together, and × is a tak on the shoulder. Read the number legend below.</p>
${sections.map((section) => `    <section class="tab-section">
      ${section.name ? `<h3>${esc(section.name)}</h3>` : ""}
      <ol class="tab">${section.bars.map((bar) => `<li value="${bar.number}"><code>${esc(bar.text)}</code></li>`).join("")}</ol>
    </section>`).join("\n")}
    <h3>Number legend</h3>
    <ul class="legend">${legend}<li><code>×</code> tak, a rim or shoulder tap</li></ul>

${fa ? `    <section class="fa" lang="fa" dir="rtl">
      <h2>${esc(fa.title)}</h2>
      <p class="site-lead">${esc(fa.blurb)}</p>
      <p class="prose">${esc(fa.about)}</p>
    </section>
` : ""}
    <h2>More ${esc(pattern.kind)}</h2>
    <p class="site-note">${esc(KINDS[pattern.kind] || "")}</p>
    <nav class="siblings" aria-label="More of the same kind">
      ${previous ? `<a href="${previous.id}">← ${esc(previous.title)}</a>` : "<span></span>"}
      ${next ? `<a href="${next.id}">${esc(next.title)} →</a>` : "<span></span>"}
    </nav>
  </main>
${footer()}
</body>
</html>
`;
  return head({ title, description, canonical, image: card(pattern.id), imageAlt: `${pattern.title}: ${pattern.kind}, ${pattern.bpm} BPM, ${signature(pattern)}, cover illustration beside the title and the Alamut mark`, type: "article", extra: jsonLd(data) }) + body;
}

function hubPage() {
  const kinds = kindOrder();
  const total = PATTERNS.length;
  const title = `Handpan pieces, songs and drills for D Kurd, with notes and tabs | ${NAME}`;
  const description = clip(`${total} handpan patterns for a 10-note D Kurd: ${kinds.map((kind) => `${PATTERNS.filter((item) => item.kind === kind).length} ${kind.toLowerCase()}`).join(", ")}. Every one has number notation, tempo, time signature and a browser player.`);
  const canonical = `${SITE}/p/`;
  const list = {
    "@type": "ItemList",
    "@id": `${canonical}#list`,
    name: `All ${NAME} patterns`,
    numberOfItems: total,
    itemListElement: PATTERNS.map((pattern, index) => ({ "@type": "ListItem", position: index + 1, name: pattern.title, url: pageUrl(pattern.id) })),
  };
  const page = { "@type": "CollectionPage", "@id": canonical, name: title, description, url: canonical, isPartOf: { "@id": `${SITE}/#website` }, mainEntity: { "@id": `${canonical}#list` } };
  const data = { "@context": "https://schema.org", "@graph": [website(), page, list, breadcrumb([{ name: NAME, url: `${SITE}/` }, { name: "All pieces", url: canonical }])] };
  const body = `
<body class="site">
${header()}
  <main class="site-page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../">${NAME}</a> › <span>All pieces</span></nav>
    <p class="site-kicker">The whole library</p>
    <h1>Handpan pieces, songs and drills for D Kurd</h1>
    <p class="site-lead">${total} patterns for the ${INSTRUMENT}. Each page has the number notation bar by bar, the tempo and time signature, the notes it uses, and a link to play or learn it in the browser.</p>
    <p class="site-note">The pan's notes are ${NOTE_ORDER.map(pretty).join(", ")}, with the ding on D3 and A at 440 Hz. Melodies from other keys are moved so that every note lands on these ten.</p>
${kinds.map((kind) => {
    const items = PATTERNS.filter((item) => item.kind === kind);
    return `    <section>
      <h2 id="${kind.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${esc(kind)} <small>${items.length}</small></h2>
      <p class="site-note">${esc(KINDS[kind] || "")}</p>
      <ul class="piece-grid">${items.map((item) => {
        const image = thumb(item.id);
        return `<li><a href="${item.id}">${image ? `<img src="../${image}" width="96" height="96" loading="lazy" alt="">` : ""}<strong>${esc(item.title)}</strong><span>${esc(item.blurb)}</span><small>${item.bpm} BPM · ${signature(item)} · ${bars(item)} bars</small></a></li>`;
      }).join("")}</ul>
    </section>`;
  }).join("\n")}
  </main>
${footer()}
</body>
</html>
`;
  return head({ title, description, canonical, image: null, type: "website", extra: jsonLd(data) }) + body;
}

function sitemap() {
  const urls = [`${SITE}/`, `${SITE}/features`, `${SITE}/p/`, ...PATTERNS.map((pattern) => pageUrl(pattern.id))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`;
}

function llmsSummary() {
  return [
    `# ${NAME}`,
    "",
    `> ${NAME} is a free browser app for playing and learning a ${INSTRUMENT}. It has ${PATTERNS.length} patterns with number notation, a 3D handpan that plays by tap, keyboard or phone motion, microphone note detection, and bar-by-bar practice. The interface is in English and Persian.`,
    "",
    `The instrument has ten notes: ${NOTE_ORDER.map(noteLabel).join("; ")}. Number notation maps 0 to the ding and 1 to 9 to the tone fields from low A3 to high C5. Songs from other keys are transposed so that every note lands on these ten; the pages say which notes were substituted.`,
    "",
    "## Pages",
    "",
    `- [The app](${SITE}/): library, Play and Learn. Piece routes are /#/p/<id>, /#/p/<id>/play and /#/p/<id>/learn`,
    `- [All pieces](${SITE}/p/): every pattern with notation, grouped by kind`,
    `- [Features and limits](${SITE}/features): what the app does today`,
    `- [Source on GitHub](${REPO}): the code, piece data and checks`,
    "",
    ...kindOrder().flatMap((kind) => [
      `## ${kind}`,
      "",
      KINDS[kind] || "",
      "",
      ...PATTERNS.filter((item) => item.kind === kind).map((item) => `- [${item.title}](${pageUrl(item.id)}): ${item.blurb} ${item.bpm} BPM, ${signature(item)}, ${bars(item)} bars.`),
      "",
    ]),
    "## Optional",
    "",
    `- [Full text of every pattern](${SITE}/llms-full.txt): notation and descriptions in one file`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    "",
  ].join("\n");
}

function llmsFull() {
  const parts = [llmsSummary(), "---", ""];
  for (const pattern of PATTERNS) {
    const fa = PIECES_FA[pattern.id];
    parts.push(`# ${pattern.title}`, "");
    parts.push(`URL: ${pageUrl(pattern.id)}`);
    parts.push(`Kind: ${pattern.kind}. Tempo: ${pattern.bpm} BPM. Time signature: ${signature(pattern)}. Length: ${bars(pattern)} bars. Notes used: ${notesUsed(pattern).map(pretty).join(", ")}.${addedDay(pattern.id) ? ` Added: ${addedDay(pattern.id)}.` : ""}`, "");
    parts.push(pattern.blurb, "", pattern.about, "");
    parts.push("## Notation", "");
    for (const section of notation(pattern)) {
      if (section.name) parts.push(`### ${section.name}`, "");
      for (const bar of section.bars) parts.push(`${String(bar.number).padStart(3)} | ${bar.text}`);
      parts.push("");
    }
    if (fa) parts.push("## فارسی", "", fa.title, "", fa.blurb, "", fa.about, "");
    parts.push("---", "");
  }
  return parts.join("\n");
}

function outputs() {
  const files = new Map();
  files.set(join(PAGES, "index.html"), hubPage());
  PATTERNS.forEach((pattern, index) => files.set(join(PAGES, `${pattern.id}.html`), piecePage(pattern, index)));
  files.set(join(ROOT, "sitemap.xml"), sitemap());
  files.set(join(ROOT, "llms.txt"), llmsSummary());
  files.set(join(ROOT, "llms-full.txt"), llmsFull());
  return files;
}

function current(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function extraPages(files) {
  if (!existsSync(PAGES)) return [];
  return readdirSync(PAGES).map((name) => join(PAGES, name)).filter((path) => !files.has(path));
}

const files = outputs();
const stale = [...files].filter(([path, text]) => current(path) !== text).map(([path]) => path);
const extra = extraPages(files);

if (process.argv.includes("--check")) {
  if (!stale.length && !extra.length) {
    console.log(`SEO files are current (${files.size} files)`);
  } else {
    for (const path of stale) console.log(`stale: ${path.slice(ROOT.length + 1)}`);
    for (const path of extra) console.log(`orphan: ${path.slice(ROOT.length + 1)}`);
    console.log("run node scripts/seo.mjs");
    process.exit(1);
  }
} else {
  mkdirSync(PAGES, { recursive: true });
  for (const [path, text] of files) writeFileSync(path, text);
  for (const path of extra) console.log(`orphan, delete by hand: ${path.slice(ROOT.length + 1)}`);
  console.log(`wrote ${files.size} files: p/ (${PATTERNS.length + 1} pages), sitemap.xml, llms.txt, llms-full.txt`);
}
