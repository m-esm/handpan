import { PATTERNS } from "./score.js";
import { VIEWS, viewFor } from "./environments.js";

export function initExplore({ onOpen } = {}) {
  const entry = document.getElementById("explore-world");
  const wrap = document.querySelector(".wrap");
  const overlay = document.createElement("section");
  overlay.className = "explore-hud";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "explore-title");
  overlay.innerHTML = `<header class="explore-heading"><div><p class="explore-eyebrow">Alamut · A journey in sound</p><h1 id="explore-title"></h1><p id="explore-description">Drag the landscape to look around. Choose a light to find music.</p></div><button type="button" class="explore-return">Return to handpan <span aria-hidden="true">↗</span></button></header><aside class="explore-music" aria-labelledby="explore-music-title"><div class="explore-music-heading"><h2 id="explore-music-title">Sounds of this place</h2><span class="explore-count" role="status"></span></div><div class="explore-pieces"></div></aside><nav class="explore-places" aria-label="Places to explore"></nav>`;
  document.body.append(overlay);
  const title = overlay.querySelector("h1");
  const pieces = overlay.querySelector(".explore-pieces");
  const count = overlay.querySelector(".explore-count");
  const places = overlay.querySelector(".explore-places");
  const exit = overlay.querySelector(".explore-return");
  let selected = "dawn";
  let restoreFocus = entry;

  function signal(open) {
    document.dispatchEvent(new CustomEvent("alamut-explore", { detail: { open, view: selected } }));
  }

  function select(view, notify = true) {
    if (!Object.hasOwn(VIEWS, view)) return;
    selected = view;
    title.textContent = VIEWS[view].name.replace(/^Alamut · /, "");
    for (const button of places.children) button.setAttribute("aria-pressed", String(button.dataset.view === view));
    pieces.replaceChildren();
    const found = PATTERNS.filter((pattern) => viewFor(pattern.id) === view);
    count.textContent = `${found.length} ${found.length === 1 ? "piece" : "pieces"}`;
    for (const pattern of found) {
      const link = document.createElement("a");
      link.href = `#/p/${encodeURIComponent(pattern.id)}`;
      link.className = "explore-piece";
      const cover = document.createElement("img");
      cover.src = `img/thumbs/${pattern.id}.webp`;
      cover.alt = "";
      cover.width = 48;
      cover.height = 48;
      cover.loading = "lazy";
      const text = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = pattern.title;
      const detail = document.createElement("small");
      detail.textContent = `${pattern.kind} · ${pattern.bpm} BPM`;
      text.append(name, detail);
      const arrow = document.createElement("span");
      arrow.className = "explore-piece-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";
      link.append(cover, text, arrow);
      link.addEventListener("click", () => close());
      pieces.append(link);
    }
    if (notify) signal(true);
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove("is-exploring");
    wrap.inert = false;
    entry.setAttribute("aria-expanded", "false");
    signal(false);
    if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  }

  for (const [key, view] of Object.entries(VIEWS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.view = key;
    button.textContent = view.name.replace(/^Alamut · /, "");
    button.addEventListener("click", () => select(key));
    places.append(button);
  }
  entry.setAttribute("aria-haspopup", "dialog");
  entry.setAttribute("aria-expanded", "false");
  entry.addEventListener("click", () => {
    onOpen?.();
    restoreFocus = document.activeElement;
    overlay.hidden = false;
    wrap.inert = true;
    document.body.classList.add("is-exploring");
    entry.setAttribute("aria-expanded", "true");
    select(selected);
    exit.focus({ preventScroll: true });
  });
  exit.addEventListener("click", close);
  document.addEventListener("alamut-place", (event) => {
    if (!overlay.hidden) select(event.detail?.view);
  });
  document.addEventListener("keydown", (event) => {
    if (overlay.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll("button, a[href]")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
}
