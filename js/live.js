(function () {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
  const marks = new Map();
  const watched = [];
  const seen = new Set();
  const watch = (url) => {
    if (seen.has(url) || !/\.(html|css|js)$|\/$/.test(new URL(url).pathname)) return;
    seen.add(url);
    watched.push(url);
  };
  watch(location.origin + location.pathname);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.initiatorType !== "fetch" && new URL(entry.name).origin === location.origin) watch(entry.name);
    }
  }).observe({ type: "resource", buffered: true });
  let cursor = 0;
  let busy = false;
  async function probe(url) {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    const mark = response.headers.get("etag") || response.headers.get("last-modified") || "";
    if (!marks.has(url)) {
      marks.set(url, mark);
      return;
    }
    if (marks.get(url) !== mark) location.reload();
  }
  setInterval(async () => {
    if (busy || document.hidden || !watched.length) return;
    busy = true;
    cursor = (cursor + 1) % watched.length;
    await probe(watched[cursor]).catch(() => {});
    busy = false;
  }, 120);
})();
