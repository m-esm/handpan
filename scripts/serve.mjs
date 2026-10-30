import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8765);
const host = process.env.HOST ?? "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".glb": "model/gltf-binary",
  ".webmanifest": "application/manifest+json",
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null;
  try {
    const info = statSync(target);
    if (info.isDirectory()) return resolveFile(join(decoded, "index.html"));
    return { path: target, size: info.size, mtime: info.mtime };
  } catch {
    return null;
  }
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url ?? "/");
  if (!file) {
    res.writeHead(404, { "Cache-Control": "no-store" });
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[extname(file.path).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": file.size,
    "Last-Modified": file.mtime.toUTCString(),
    "Cache-Control": "no-store",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file.path).pipe(res);
});

server.listen(port, host, () => {
  console.log(`serving ${root} at http://${host}:${port}`);
});
