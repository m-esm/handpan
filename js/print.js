import { NOTES, FIELDS, PATTERNS, sheetOf, numberOf, pretty, beatLabel } from "./score.js";
import { t, digits, pieceText, partName, dir } from "./i18n.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgElement(tag, attributes, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function noteGuide() {
  const svg = svgElement("svg", { viewBox: "0 0 420 420", role: "img", "aria-label": t("print.guide"), class: "print-pan", direction: "ltr" });
  svg.append(svgElement("circle", { cx: 210, cy: 210, r: 198, fill: "#faf8f3", stroke: "#303c3b", "stroke-width": 2 }));
  svg.append(svgElement("circle", { cx: 210, cy: 210, r: 188, fill: "none", stroke: "#a89a7d" }));
  const positions = FIELDS.map(({ id, deg }) => {
    const angle = deg * Math.PI / 180 - Math.PI / 2;
    return { id, x: 210 + Math.cos(angle) * 122, y: 210 + Math.sin(angle) * 122 };
  });
  positions.push(...Object.values(NOTES).filter(note => note.ding).map(note => ({ id: note.id, x: 210, y: 210 })));
  for (const { id, x, y } of positions) {
    const ding = NOTES[id].ding;
    const field = svgElement("g", { transform: `translate(${x} ${y})`, "data-note": id });
    field.append(svgElement("circle", { r: ding ? 54 : 34, fill: "white", stroke: "#465d59", "stroke-width": ding ? 2 : 1 }));
    field.append(svgElement("text", { y: ding ? -8 : -2, "text-anchor": "middle", "font-size": ding ? 38 : 27, "font-weight": 600 }, digits(numberOf(id))));
    field.append(svgElement("text", { y: ding ? 15 : 19, "text-anchor": "middle", "font-size": 14 }, pretty(id)));
    if (ding) field.append(svgElement("text", { y: 35, "text-anchor": "middle", "font-size": 12 }, t("note.ding").trim()));
    svg.append(field);
  }
  return svg;
}

function cover() {
  const page = element("section", "print-cover");
  const heading = element("header", "print-cover-heading");
  heading.append(element("p", "print-brand", t("brand")), element("p", "print-kicker", t("print.instrument")), element("h1", "", t("print.guide")));
  const figure = element("figure", "print-guide");
  figure.append(noteGuide(), element("figcaption", "", t("print.orientation")));
  const reading = element("section", "print-reading");
  reading.append(element("h2", "", t("print.reading")), element("p", "", t("print.legend")));
  page.append(heading, figure, reading);
  return page;
}

function barNode(pattern, sheet, bar) {
  const node = element("div", "print-bar");
  node.dataset.bar = String(bar.bar);
  node.append(element("span", "print-bar-number", digits(bar.bar + 1)));
  const slots = element("div", "print-slots");
  slots.style.setProperty("--print-slots", sheet.perBar);
  bar.slots.forEach((event, index) => {
    const slot = element("div", "print-slot");
    const onBeat = index % sheet.perBeat === 0;
    if (onBeat) slot.classList.add("print-beat");
    const beat = (bar.bar * sheet.perBar + index) / sheet.perBeat;
    const count = beatLabel(beat, pattern).replace(/ (and|e|a)$/, (match, word) => t(`count.${word}`));
    slot.append(element("span", "print-count", onBeat ? digits(count) : "\u00a0"));
    const notes = element("div", "print-notes");
    if (!event) notes.append(element("span", "print-rest", "·"));
    event?.notes.forEach((id, noteIndex) => {
      if (noteIndex) notes.append(element("span", "print-plus", "+"));
      const hit = element("span", "print-hit");
      hit.dataset.note = id;
      const number = element("span", "print-number", digits(numberOf(id)));
      number.style.fontSize = `${10 + 5 * event.amps[id]}pt`;
      hit.append(number, element("span", "print-hand", event.hands[id] === "left" ? "L" : "R"));
      notes.append(hit);
    });
    slot.append(notes);
    slots.append(slot);
  });
  node.append(slots);
  return node;
}

function song(pattern, index) {
  const sheet = sheetOf(pattern);
  const table = element("table", "print-song");
  table.dataset.pattern = pattern.id;
  const header = table.createTHead();
  const titleCell = header.insertRow().insertCell();
  titleCell.append(element("p", "print-song-index", `${t("brand")} · ${t("print.sequence", { at: index + 1, total: PATTERNS.length })}`));
  const title = element("h2", "print-song-title", pieceText(pattern, "title"));
  title.dir = "auto";
  const meta = `${t("bars", { n: pattern.loopBeats / sheet.barBeats })} · ${digits(pattern.bpm)} ${t("bpm")} · ${t("print.beats", { beats: sheet.barBeats, slots: sheet.perBeat })}`;
  titleCell.append(title, element("p", "print-song-meta", meta), element("p", "print-score-legend", t("print.scoreLegend")));
  const body = table.createTBody();
  for (const section of sheet.sections) {
    const perRow = sheet.perBar > 8 ? 1 : 2;
    for (let start = 0; start < section.bars.length; start += perRow) {
      const row = body.insertRow();
      const cell = row.insertCell();
      if (start === 0 && section.name) {
        const heading = element("h3", "print-section", partName(section.name));
        heading.dir = "auto";
        cell.append(heading);
      }
      const system = element("div", "print-system");
      system.style.setProperty("--print-bars", perRow);
      for (const bar of section.bars.slice(start, start + perRow)) system.append(barNode(pattern, sheet, bar));
      cell.append(system);
    }
  }
  return table;
}

export function initPrint() {
  const book = element("section", "print-book");
  book.id = "print-book";
  book.dir = dir;
  book.append(cover(), ...PATTERNS.map(song));
  document.body.append(book);
  document.getElementById("print-library").addEventListener("click", async () => {
    await document.fonts.ready;
    window.print();
  });
}
