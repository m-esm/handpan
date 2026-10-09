(function () {
  if (location.hostname.endsWith("github.io")) return;
  const files = [
    "index.html",
    "css/app.css",
    "js/main.js",
    "js/score.js",
    "js/sound.js",
    "js/play.js",
    "js/live.js",
  ];
  const marks = new Map();
  async function probe(file) {
    const url = new URL(file, location.href);
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    const mark = response.headers.get("etag") || response.headers.get("last-modified") || "";
    if (!marks.has(file)) {
      marks.set(file, mark);
      return;
    }
    if (marks.get(file) !== mark) location.reload();
  }
  setInterval(() => {
    for (const file of files) {
      probe(file).catch(() => {});
    }
  }, 1500);
})();
