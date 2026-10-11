(function () {
  if (location.hostname.endsWith("github.io")) return;
  const marks = new Map();
  const loaded = new Set();
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (new URL(entry.name).origin === location.origin) loaded.add(entry.name);
    }
  }).observe({ type: "resource", buffered: true });
  async function probe(url) {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    const mark = response.headers.get("etag") || response.headers.get("last-modified") || "";
    if (!marks.has(url)) {
      marks.set(url, mark);
      return;
    }
    if (marks.get(url) !== mark) location.reload();
  }
  setInterval(() => {
    const page = location.origin + location.pathname + location.search;
    for (const url of new Set([page, ...loaded])) {
      probe(url).catch(() => {});
    }
  }, 1500);
})();
