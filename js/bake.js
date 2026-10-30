const blank = () => (typeof document === "undefined" ? new OffscreenCanvas(1, 1) : blank());

const SRGB = "srgb";
const LINEAR = "";

export function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const step = (lo, hi, x) => ease(clamp01((x - lo) / (hi - lo)));

export function fbm(size, seed, { period = 4, octaves = 5, gain = 0.5, stretch = 1 } = {}) {
  const random = seeded(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  for (let o = 0; o < octaves; o += 1) {
    const px = period << o;
    const py = Math.max(1, Math.round(px / stretch));
    if (px > size) break;
    const grid = new Float32Array(px * py);
    for (let n = 0; n < grid.length; n += 1) grid[n] = random() * 2 - 1;
    const cx = size / px;
    const cy = size / py;
    for (let y = 0; y < size; y += 1) {
      const gy = y / cy;
      const y0 = Math.floor(gy);
      const ty = ease(gy - y0);
      const r0 = (y0 % py) * px;
      const r1 = ((y0 + 1) % py) * px;
      for (let x = 0; x < size; x += 1) {
        const gx = x / cx;
        const x0 = Math.floor(gx);
        const tx = ease(gx - x0);
        const a = x0 % px;
        const b = (x0 + 1) % px;
        const top = grid[r0 + a] + (grid[r0 + b] - grid[r0 + a]) * tx;
        const bottom = grid[r1 + a] + (grid[r1 + b] - grid[r1 + a]) * tx;
        out[y * size + x] += (top + (bottom - top) * ty) * amp;
      }
    }
    amp *= gain;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of out) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] - lo) / span;
  return out;
}

const toLinear = (c) => (c < 0.04045 ? c * 0.0773993808 : ((c * 0.9478672986 + 0.0521327014) ** 2.4));
const toSrgb = (c) => (c < 0.0031308 ? c * 12.92 : 1.055 * (c ** 0.41666) - 0.055);

function hslOf(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => toLinear(parseInt(hex.slice(at, at + 2), 16) / 255));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (min + max) / 2;
  if (min === max) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
  let h;
  if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  return { h: h / 6, s, l };
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}

function hexOf(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const q = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => Math.round(clamp01(toSrgb(hueToRgb(p, q, t))) * 255).toString(16).padStart(2, "0");
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`;
}

const wrap = (v, size) => ((Math.round(v) % size) + size) % size;
const sample = (field, size, x, y) => field[wrap(y, size) * size + wrap(x, size)];

function pixels(width, height, fill, colorSpace) {
  const canvas = blank();
  canvas.width = width;
  canvas.height = height;
  const pen = canvas.getContext("2d");
  const image = pen.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) fill(image.data, (y * width + x) * 4, x, y);
  }
  return finish({ width, height, data: image.data }, colorSpace);
}

function finish(image, colorSpace) {
  image.colorSpace = colorSpace;
  image.wrap = "repeat";
  return image;
}

function normalFrom(height, width, rows, strength) {
  const at = (x, y) => height[((y + rows) % rows) * width + ((x + width) % width)];
  return pixels(width, rows, (data, i, x, y) => {
    const nx = -(at(x + 1, y) - at(x - 1, y)) * strength;
    const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(nx, ny, 1);
    data[i] = (nx / len * 0.5 + 0.5) * 255;
    data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
    data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    data[i + 3] = 255;
  }, LINEAR);
}

function surface(size, height, strength, albedo, detail, rows = size) {
  const color = [0, 0, 0];
  const map = pixels(size, rows, (data, i, x, y) => {
    albedo(color, x, y, height[y * size + x]);
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = 255;
  }, SRGB);
  const roughnessMap = pixels(size, rows, (data, i, x, y) => {
    const [rough, metal = 0] = detail(x, y, height[y * size + x]);
    data[i] = 0;
    data[i + 1] = clamp01(rough) * 255;
    data[i + 2] = clamp01(metal) * 255;
    data[i + 3] = 255;
  }, LINEAR);
  return { map, normalMap: normalFrom(height, size, rows, strength), roughnessMap };
}

function fromCanvas(canvas, colorSpace) {
  const { width, height } = canvas;
  const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  return finish({ width, height, data }, colorSpace);
}

function canvasNormal(canvas, strength) {
  const { width, height } = canvas;
  const source = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const field = new Float32Array(width * height);
  for (let i = 0; i < field.length; i += 1) field[i] = source[i * 4] / 255;
  return normalFrom(field, width, height, strength);
}

function ashlar(seed) {
  const size = 512;
  const random = seeded(seed);
  const grain = fbm(size, seed + 1, { period: 8, octaves: 6 });
  const mottle = fbm(size, seed + 2, { period: 2, octaves: 4 });
  const streak = fbm(size, seed + 3, { period: 16, octaves: 4, stretch: 12 });
  const rows = 4;
  const rowHeight = size / rows;
  const courses = [];
  for (let r = 0; r < rows; r += 1) {
    const count = 2 + Math.floor(random() * 2);
    const cuts = [0];
    for (let n = 1; n < count; n += 1) cuts.push((n / count + (random() - 0.5) * 0.18) * size);
    const shift = random() * size;
    courses.push({ cuts, shift, tones: cuts.map(() => 0.86 + random() * 0.26), warm: cuts.map(() => random() - 0.5) });
  }
  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const warmth = new Float32Array(size * size);
  const edge = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const row = courses[Math.floor(y / rowHeight)];
    const dy = Math.min(y % rowHeight, rowHeight - 1 - (y % rowHeight));
    for (let x = 0; x < size; x += 1) {
      const sx = (x + row.shift) % size;
      let block = row.cuts.length - 1;
      while (block > 0 && sx < row.cuts[block]) block -= 1;
      const left = row.cuts[block];
      const right = block + 1 < row.cuts.length ? row.cuts[block + 1] : size;
      const dx = Math.min(sx - left, right - 1 - sx);
      const i = y * size + x;
      const wobble = (grain[i] - 0.5) * 7;
      const d = Math.min(dx, dy) + wobble;
      const face = step(2, 12, d);
      height[i] = face * (0.72 + grain[i] * 0.22) + (mottle[i] - 0.5) * 0.1;
      tone[i] = row.tones[block];
      warmth[i] = row.warm[block];
      edge[i] = face;
    }
  }
  return surface(size, height, 3.2, (out, x, y) => {
    const i = y * size + x;
    const f = edge[i];
    const t = tone[i] * (0.84 + mottle[i] * 0.28) * (0.94 + grain[i] * 0.12);
    const rain = 1 - Math.max(0, streak[i] - 0.55) * 0.55;
    const w = warmth[i] * 16;
    const stone = [210 + w, 184 + w * 0.4, 146 - w * 0.6].map((c) => c * t * rain);
    const mortar = [148, 136, 118].map((c) => c * (0.9 + grain[i] * 0.2));
    for (let c = 0; c < 3; c += 1) out[c] = mortar[c] + (stone[c] - mortar[c]) * f;
  }, (x, y) => {
    const i = y * size + x;
    return [0.78 + grain[i] * 0.16 + (1 - edge[i]) * 0.08];
  });
}

function limestone(seed) {
  const size = 512;
  const grain = fbm(size, seed, { period: 16, octaves: 6, gain: 0.55 });
  const cloud = fbm(size, seed + 1, { period: 2, octaves: 5 });
  const vein = fbm(size, seed + 2, { period: 4, octaves: 5 });
  const random = seeded(seed + 3);
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i += 1) height[i] = grain[i] * 0.5 + cloud[i] * 0.3;
  for (let n = 0; n < 900; n += 1) {
    const cx = random() * size;
    const cy = random() * size;
    const r = 0.8 + random() * 2.4;
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
      for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d < 1) height[wrap(y, size) * size + wrap(x, size)] -= 0.25 * (1 - d * d);
      }
    }
  }
  return surface(size, height, 2.2, (out, x, y, h) => {
    const i = y * size + x;
    const line = Math.exp(-(((vein[i] - 0.5) / 0.012) ** 2)) * 0.12;
    const t = (0.86 + cloud[i] * 0.2 + h * 0.06) * (1 - line);
    out[0] = 232 * t;
    out[1] = 216 * t;
    out[2] = 186 * t * (0.97 + cloud[i] * 0.05);
  }, (x, y, h) => [0.62 + (1 - h) * 0.3]);
}

function flagstone(seed) {
  const size = 512;
  const grain = fbm(size, seed, { period: 8, octaves: 6 });
  const mottle = fbm(size, seed + 1, { period: 2, octaves: 5 });
  const crackField = fbm(size, seed + 2, { period: 4, octaves: 5 });
  const crackMask = fbm(size, seed + 3, { period: 2, octaves: 3 });
  const height = new Float32Array(size * size);
  const crack = new Float32Array(size * size);
  const border = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const d = Math.min(x, y, size - 1 - x, size - 1 - y) + (grain[i] - 0.5) * 12;
      const rim = step(0, 22, d);
      const c = Math.exp(-(((crackField[i] - 0.5) / 0.006) ** 2)) * step(0.55, 0.7, crackMask[i]);
      crack[i] = c;
      border[i] = rim;
      height[i] = rim * (0.75 + grain[i] * 0.18 + mottle[i] * 0.1) - c * 0.5;
    }
  }
  return surface(size, height, 3, (out, x, y) => {
    const i = y * size + x;
    const t = (0.78 + mottle[i] * 0.34) * (0.92 + grain[i] * 0.14) * (1 - crack[i] * 0.55) * (0.82 + border[i] * 0.18);
    out[0] = 150 * t;
    out[1] = 150 * t;
    out[2] = 140 * t;
  }, (x, y) => {
    const i = y * size + x;
    const wear = Math.min(1, Math.hypot(x - size / 2, y - size / 2) / (size * 0.62));
    return [0.3 + wear * 0.35 + grain[i] * 0.18 + crack[i] * 0.4 + (1 - border[i]) * 0.3];
  });
}

const ZELLIGE = ["#1f6f78", "#2b8a8a", "#16525e", "#1d4f8a", "#e7dcc1", "#c79a4a"];

function zellige(seed) {
  const size = 512;
  const cell = 128;
  const random = seeded(seed);
  const layers = ["color", "height", "rough"].map(() => {
    const canvas = blank();
    canvas.width = canvas.height = size;
    return canvas;
  });
  const [color, height, rough] = layers.map((canvas) => canvas.getContext("2d"));
  color.fillStyle = "#cfc5ad";
  color.fillRect(0, 0, size, size);
  height.fillStyle = "#000";
  height.fillRect(0, 0, size, size);
  rough.fillStyle = "#fff";
  rough.fillRect(0, 0, size, size);
  const jitter = (hex, amount) => {
    const hsl = hslOf(hex);
    return hexOf(hsl.h + (random() - 0.5) * 0.02, hsl.s * (0.85 + random() * 0.3), clamp01(hsl.l + (random() - 0.5) * amount));
  };
  const star = (cx, cy, r) => {
    const path = new Path2D();
    for (let n = 0; n < 16; n += 1) {
      const angle = n * Math.PI / 8 + Math.PI / 8;
      const radius = n % 2 ? r * 0.62 : r;
      path[n ? "lineTo" : "moveTo"](cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    path.closePath();
    return path;
  };
  const cross = (cx, cy, arm, width) => {
    const path = new Path2D();
    const w = width / 2;
    const points = [[-w, -arm], [w, -arm], [w, -w], [arm, -w], [arm, w], [w, w], [w, arm], [-w, arm], [-w, w], [-arm, w], [-arm, -w], [-w, -w]];
    points.forEach(([px, py], n) => path[n ? "lineTo" : "moveTo"](cx + px, cy + py));
    path.closePath();
    return path;
  };
  const piece = (path, cx, cy, r, hex) => {
    const glaze = color.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.2);
    const base = jitter(hex, 0.12);
    glaze.addColorStop(0, jitter(base, 0.08));
    glaze.addColorStop(1, base);
    color.fillStyle = glaze;
    color.fill(path);
    const angle = random() * Math.PI * 2;
    const tilt = height.createLinearGradient(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cx - Math.cos(angle) * r, cy - Math.sin(angle) * r);
    const top = 190 + random() * 50;
    tilt.addColorStop(0, `rgb(${top},${top},${top})`);
    tilt.addColorStop(1, `rgb(${top - 40},${top - 40},${top - 40})`);
    height.fillStyle = tilt;
    height.fill(path);
    const gloss = 20 + random() * 50;
    rough.fillStyle = `rgb(0,${gloss},0)`;
    rough.fill(path);
  };
  const gap = 3.5;
  for (let y = -cell; y <= size + cell; y += cell) {
    for (let x = -cell; x <= size + cell; x += cell) {
      const pick = ZELLIGE[Math.floor(random() * 3)];
      piece(star(x, y, cell * 0.42 - gap), x, y, cell * 0.42, pick);
      const inner = star(x, y, cell * 0.17);
      piece(inner, x, y, cell * 0.17, ZELLIGE[5]);
      piece(cross(x + cell / 2, y + cell / 2, cell * 0.3 - gap, cell * 0.14), x + cell / 2, y + cell / 2, cell * 0.3, ZELLIGE[3]);
      for (const [ox, oy] of [[cell / 2, 0], [0, cell / 2]]) {
        const bead = new Path2D();
        bead.arc(x + ox, y + oy, cell * 0.08, 0, Math.PI * 2);
        piece(bead, x + ox, y + oy, cell * 0.08, ZELLIGE[4]);
      }
    }
  }
  const field = fbm(size, seed + 9, { period: 16, octaves: 4 });
  const grime = color.getImageData(0, 0, size, size);
  for (let i = 0; i < field.length; i += 1) {
    const k = 0.88 + field[i] * 0.2;
    for (let c = 0; c < 3; c += 1) grime.data[i * 4 + c] *= k;
  }
  color.putImageData(grime, 0, 0);
  return { map: fromCanvas(layers[0], SRGB), normalMap: canvasNormal(layers[1], 2.5), roughnessMap: fromCanvas(layers[2], LINEAR) };
}

function kilim(seed) {
  const width = 256;
  const rows = 512;
  const fuzz = fbm(512, seed, { period: 32, octaves: 4 });
  const abrash = fbm(512, seed + 1, { period: 2, octaves: 3, stretch: 0.25 });
  const madder = [146, 38, 34];
  const indigo = [34, 46, 92];
  const ivory = [226, 210, 178];
  const ochre = [196, 142, 58];
  const teal = [42, 104, 100];
  const pick = (x, y) => {
    const fromEdge = Math.min(x, width - 1 - x);
    if (fromEdge < 10) return indigo;
    if (fromEdge < 16) return ivory;
    if (fromEdge < 40) {
      const zig = Math.abs(((y + fromEdge * 2) % 32) - 16);
      return zig < 6 ? ochre : fromEdge < 22 || fromEdge > 34 ? madder : indigo;
    }
    if (fromEdge < 46) return ivory;
    const cy = ((y % 128) + 128) % 128 - 64;
    const cx = x - width / 2;
    const d = Math.floor((Math.abs(cx) * 1.1 + Math.abs(cy)) / 10);
    if (d > 8) return (Math.floor(y / 8) + Math.floor(x / 8)) % 7 === 0 ? ochre : madder;
    return [indigo, ivory, madder, ochre, teal, ivory, indigo, madder, ivory][d];
  };
  const height = new Float32Array(width * rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const weft = Math.sin(y * Math.PI / 2) * 0.5 + 0.5;
      const warp = Math.sin(x * Math.PI / 3 + (y % 4 < 2 ? 0 : Math.PI)) * 0.5 + 0.5;
      height[y * width + x] = weft * 0.5 + warp * 0.3 + fuzz[(y % 512) * 512 + x] * 0.4;
    }
  }
  return surface(width, height, 1.6, (out, x, y, h) => {
    const base = pick(x, y);
    const shade = (0.82 + abrash[(y % 512) * 512 + x] * 0.24) * (0.88 + h * 0.18);
    for (let c = 0; c < 3; c += 1) out[c] = base[c] * shade;
  }, () => [0.95], rows);
}

function velvet() {
  const width = 256;
  const rows = 680;
  const canvas = blank();
  canvas.width = width;
  canvas.height = rows;
  const pen = canvas.getContext("2d");
  const detail = blank();
  detail.width = width;
  detail.height = rows;
  const mask = detail.getContext("2d");
  const field = pen.createLinearGradient(0, 0, width, rows);
  field.addColorStop(0, "#7a1f27");
  field.addColorStop(0.5, "#5e1820");
  field.addColorStop(1, "#73202a");
  pen.fillStyle = field;
  pen.fillRect(0, 0, width, rows);
  mask.fillStyle = "rgb(0,230,0)";
  mask.fillRect(0, 0, width, rows);
  const gold = (draw) => {
    pen.fillStyle = "#c99a48";
    pen.strokeStyle = "#c99a48";
    mask.fillStyle = "rgb(0,110,210)";
    mask.strokeStyle = "rgb(0,110,210)";
    draw(pen);
    draw(mask);
  };
  gold((g) => {
    g.lineWidth = 6;
    g.strokeRect(14, 14, width - 28, rows - 28);
    g.lineWidth = 2;
    g.strokeRect(26, 26, width - 52, rows - 52);
    for (let y = 40; y < rows - 30; y += 14) {
      g.beginPath();
      g.arc(20, y, 2, 0, Math.PI * 2);
      g.arc(width - 20, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  });
  const cx = width / 2;
  const cy = rows * 0.48;
  gold((g) => {
    g.beginPath();
    for (let n = 0; n < 32; n += 1) {
      const angle = n * Math.PI / 16;
      const r = n % 2 ? 52 : 84;
      g[n ? "lineTo" : "moveTo"](cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    g.closePath();
    g.fill();
  });
  pen.fillStyle = "#1e5a5c";
  pen.beginPath();
  pen.arc(cx, cy, 40, 0, Math.PI * 2);
  pen.fill();
  mask.fillStyle = "rgb(0,180,0)";
  mask.beginPath();
  mask.arc(cx, cy, 40, 0, Math.PI * 2);
  mask.fill();
  gold((g) => {
    g.lineWidth = 3;
    for (let n = 0; n < 8; n += 1) {
      const angle = n * Math.PI / 4;
      g.beginPath();
      g.ellipse(cx + Math.cos(angle) * 22, cy + Math.sin(angle) * 22, 13, 5, angle, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 3;
    for (const top of [70, rows - 150]) {
      g.beginPath();
      g.moveTo(40, top + 80);
      g.lineTo(40, top + 40);
      g.quadraticCurveTo(40, top, cx, top - 10);
      g.quadraticCurveTo(width - 40, top, width - 40, top + 40);
      g.lineTo(width - 40, top + 80);
      g.stroke();
    }
  });
  const nap = fbm(256, 41, { period: 64, octaves: 3 });
  const image = pen.getImageData(0, 0, width, rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = 0.9 + nap[(y % 256) * 256 + x] * 0.2;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) image.data[i + c] *= k;
    }
  }
  pen.putImageData(image, 0, 0);
  const map = fromCanvas(canvas, SRGB);
  const roughnessMap = fromCanvas(detail, LINEAR);
  for (const image of [map, roughnessMap]) image.wrap = "clamp";
  return { map, roughnessMap };
}

function brass(seed) {
  const size = 256;
  const tarnish = fbm(size, seed, { period: 4, octaves: 5 });
  const hammer = fbm(size, seed + 1, { period: 16, octaves: 3 });
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i += 1) height[i] = hammer[i] * 0.6 + tarnish[i] * 0.2;
  return surface(size, height, 1.5, (out, x, y) => {
    const i = y * size + x;
    const t = tarnish[i];
    const verdigris = step(0.74, 0.86, t);
    const bright = 0.55 + (1 - t) * 0.5;
    out[0] = (214 * bright) * (1 - verdigris) + 92 * verdigris;
    out[1] = (168 * bright) * (1 - verdigris) + 150 * verdigris;
    out[2] = (92 * bright) * (1 - verdigris) + 128 * verdigris;
  }, (x, y) => {
    const i = y * size + x;
    const verdigris = step(0.74, 0.86, tarnish[i]);
    return [0.22 + tarnish[i] * 0.42 + verdigris * 0.4, 1 - verdigris];
  });
}

function strata(seed) {
  const size = 512;
  const warp = fbm(size, seed, { period: 2, octaves: 5 });
  const grain = fbm(size, seed + 1, { period: 16, octaves: 5 });
  const cracks = fbm(size, seed + 2, { period: 8, octaves: 4, stretch: 0.2 });
  const iron = fbm(size, seed + 3, { period: 4, octaves: 4, stretch: 6 });
  const height = new Float32Array(size * size);
  const band = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const v = y / size * 9 + warp[i] * 2.4;
      const layer = v - Math.floor(v);
      band[i] = Math.floor(v) % 3;
      const ledge = step(0, 0.15, layer) * (1 - layer * 0.5);
      const crack = Math.exp(-(((cracks[i] - 0.5) / 0.02) ** 2));
      height[i] = ledge * 0.7 + grain[i] * 0.4 - crack * 0.35;
    }
  }
  return surface(size, height, 4, (out, x, y, h) => {
    const i = y * size + x;
    const t = (0.62 + band[i] * 0.09 + h * 0.3) * (0.9 + grain[i] * 0.2);
    const rust = Math.max(0, iron[i] - 0.6) * 1.3;
    out[0] = 228 * t * (1 + rust * 0.25);
    out[1] = 214 * t * (1 - rust * 0.05);
    out[2] = 196 * t * (1 - rust * 0.3);
  }, (x, y, h) => [0.84 + (1 - h) * 0.16]);
}

function meadow(seed) {
  const size = 512;
  const patch = fbm(size, seed, { period: 2, octaves: 5 });
  const strokes = fbm(size, seed + 1, { period: 16, octaves: 4, stretch: 0.3 });
  const blades = fbm(size, seed + 2, { period: 64, octaves: 3, stretch: 0.25 });
  const dry = fbm(size, seed + 3, { period: 4, octaves: 4 });
  const random = seeded(seed + 4);
  const flowers = new Float32Array(size * size);
  for (let n = 0; n < 1600; n += 1) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    if (patch[y * size + x] < 0.45) continue;
    const kind = random() < 0.6 ? 1 : 2;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) flowers[wrap(y + dy, size) * size + wrap(x + dx, size)] = kind;
  }
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i += 1) height[i] = blades[i] * 0.6 + strokes[i] * 0.4;
  return surface(size, height, 2.2, (out, x, y) => {
    const i = y * size + x;
    const v = 0.72 + patch[i] * 0.28 + (strokes[i] - 0.5) * 0.22 + (blades[i] - 0.5) * 0.16;
    const sun = Math.max(0, dry[i] - 0.55) * 1.6;
    out[0] = 222 * v * (1 + sun * 0.22);
    out[1] = 230 * v;
    out[2] = 206 * v * (1 - sun * 0.3);
    if (flowers[i] === 1) out.splice(0, 3, 252, 236, 170);
    if (flowers[i] === 2) out.splice(0, 3, 246, 238, 236);
  }, (x, y) => [0.86 + blades[y * size + x] * 0.14]);
}

function foliage(seed) {
  const size = 256;
  const clumps = fbm(size, seed, { period: 16, octaves: 4 });
  const leaves = fbm(size, seed + 1, { period: 64, octaves: 2 });
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i += 1) height[i] = step(0.25, 0.8, clumps[i]) * 0.6 + leaves[i] * 0.4;
  return surface(size, height, 2.6, (out, x, y, h) => {
    const v = 0.6 + h * 0.45;
    const tip = Math.max(0, h - 0.8) * 1.2;
    out[0] = 205 * v * (1 + tip * 0.3);
    out[1] = 225 * v;
    out[2] = 190 * v * (1 - tip * 0.2);
  }, (x, y, h) => [0.7 + (1 - h) * 0.3]);
}

function bark(seed) {
  const size = 256;
  const fissures = fbm(size, seed, { period: 16, octaves: 4, stretch: 0.15 });
  const grain = fbm(size, seed + 1, { period: 32, octaves: 3 });
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i += 1) height[i] = step(0.25, 0.6, fissures[i]) * 0.8 + grain[i] * 0.2;
  return surface(size, height, 3, (out, x, y, h) => {
    const v = 0.45 + h * 0.6;
    out[0] = 200 * v;
    out[1] = 188 * v;
    out[2] = 170 * v;
  }, () => [0.95]);
}

function ripples(seed) {
  const size = 256;
  const a = fbm(size, seed, { period: 8, octaves: 4, stretch: 2.5 });
  const b = fbm(size, seed + 1, { period: 16, octaves: 3 });
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i += 1) height[i] = a[i] * 0.7 + b[i] * 0.3;
  return { normalMap: normalFrom(height, size, size, 2.2) };
}

function moonFace(seed) {
  const size = 256;
  const maria = fbm(size, seed, { period: 2, octaves: 5 });
  const dust = fbm(size, seed + 1, { period: 32, octaves: 3 });
  const random = seeded(seed + 2);
  const craters = new Float32Array(size * size);
  for (let n = 0; n < 90; n += 1) {
    const cx = random() * size;
    const cy = random() * size;
    const r = 2 + random() ** 3 * 18;
    for (let y = Math.floor(cy - r * 1.3); y <= cy + r * 1.3; y += 1) {
      for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x += 1) {
        const d = Math.hypot(x - cx, y - cy) / r;
        const i = wrap(y, size) * size + wrap(x, size);
        if (d < 1) craters[i] -= 0.18 * (1 - d);
        else if (d < 1.3) craters[i] += 0.12 * (1.3 - d) / 0.3;
      }
    }
  }
  return pixels(size, size, (data, i, x, y) => {
    const k = y * size + x;
    const v = 0.72 + step(0.45, 0.62, maria[k]) * -0.2 + dust[k] * 0.12 + craters[k];
    data[i] = 255 * clamp01(v);
    data[i + 1] = 248 * clamp01(v);
    data[i + 2] = 232 * clamp01(v);
    data[i + 3] = 255;
  }, SRGB);
}

function lanternScreen() {
  const size = 256;
  const layers = [0, 1].map(() => {
    const canvas = blank();
    canvas.width = canvas.height = size;
    return canvas;
  });
  const [metal, glow] = layers.map((canvas) => canvas.getContext("2d"));
  const plate = metal.createLinearGradient(0, 0, 0, size);
  plate.addColorStop(0, "#4a3418");
  plate.addColorStop(0.5, "#6b4c22");
  plate.addColorStop(1, "#3e2c14");
  metal.fillStyle = plate;
  metal.fillRect(0, 0, size, size);
  glow.fillStyle = "#000";
  glow.fillRect(0, 0, size, size);
  const holes = new Path2D();
  const star = (cx, cy, r) => {
    for (let n = 0; n < 16; n += 1) {
      const angle = n * Math.PI / 8;
      const radius = n % 2 ? r * 0.55 : r;
      holes[n ? "lineTo" : "moveTo"](cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    holes.closePath();
  };
  const dot = (cx, cy, r) => {
    holes.moveTo(cx + r, cy);
    holes.arc(cx, cy, r, 0, Math.PI * 2);
  };
  for (let y = 32; y < size; y += 64) {
    for (let x = 0; x <= size; x += 64) {
      const cx = x + (y % 128 === 32 ? 0 : 32);
      star(cx, y, 20);
      for (let n = 0; n < 8; n += 1) dot(cx + Math.cos(n * Math.PI / 4) * 28, y + Math.sin(n * Math.PI / 4) * 28, 2.6);
    }
  }
  for (let x = 0; x < size; x += 12) {
    dot(x + 6, 4, 2);
    dot(x + 6, size - 4, 2);
  }
  metal.fillStyle = "#ffe0a8";
  metal.fill(holes);
  glow.shadowColor = "#ffb468";
  glow.shadowBlur = 10;
  glow.fillStyle = "#fff";
  glow.fill(holes);
  return { map: fromCanvas(layers[0], SRGB), emissiveMap: fromCanvas(layers[1], SRGB) };
}

function contactShadow() {
  const size = 128;
  const canvas = blank();
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d");
  pen.fillStyle = "#000";
  pen.fillRect(0, 0, size, size);
  pen.filter = "blur(14px)";
  pen.fillStyle = "#fff";
  pen.fillRect(34, 34, size - 68, size - 68);
  const image = fromCanvas(canvas, LINEAR);
  image.wrap = "clamp";
  return image;
}

const RECIPES = { ashlar: () => ashlar(17), limestone: () => limestone(23), flagstone: () => flagstone(31), zellige: () => zellige(11), kilim: () => kilim(5), velvet, brass: () => brass(13), strata: () => strata(29), meadow: () => meadow(37), foliage: () => foliage(43), bark: () => bark(47), ripples: () => ripples(53), moon: () => moonFace(61), lantern: lanternScreen, contact: contactShadow };

export const NAMES = Object.keys(RECIPES);

export function bake(name) {
  const result = RECIPES[name]();
  return result.data ? { map: result } : result;
}
