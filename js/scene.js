import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createLandscape } from "./landscape.js";
import { VIEWS } from "./environments.js";

const BRASS = 0xe6b15a;
const CREAM = 0xf0e2d2;
const TEAL = 0x6fcfb0;
const VIOLET = 0x9a7cf0;
const RED = 0xd9735c;
const INK = "#1a140f";
const RADIUS = 1.6;
// Both shells are spherical caps, so they meet at the rim in a sharp edge, as on a real pan.
const DOME = 0.56;
const SHELL = (RADIUS ** 2 + DOME ** 2) / (2 * DOME);
const BELLY = 0.66;
const BELLY_SHELL = (RADIUS ** 2 + BELLY ** 2) / (2 * BELLY);
const GU = 0.37;
const RING_AT = 1.08;
const ALONG = 0.3;
const ACROSS = 0.25;
const DING = 0.44;
const UP = new THREE.Vector3(0, 1, 0);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const profiling = new URLSearchParams(location.search).has("perf");

const LOOKS = {
  idle: { color: BRASS, glow: 0, ring: 0, ink: false },
  next: { color: BRASS, glow: 0, ring: 0.85, ink: false },
  place: { color: BRASS, glow: 0.22, ring: 1, ink: false },
  on: { color: BRASS, glow: 1, ring: 1, ink: true },
  heard: { color: TEAL, glow: 1, ring: 1, ink: true },
  miss: { color: RED, glow: 1, ring: 1, ink: true },
};

const smooth = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

function radialTexture(stops) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const pen = canvas.getContext("2d");
  const fade = pen.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, color] of stops) fade.addColorStop(at, color);
  pen.fillStyle = fade;
  pen.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function labelTexture(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const pen = canvas.getContext("2d");
  pen.font = `600 180px ${getComputedStyle(document.body).fontFamily}`;
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  pen.fillStyle = color;
  pen.fillText(text, 128, 138);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const MOTE_VERTEX = `
attribute vec4 seed;
uniform float uTime;
uniform float uPixelRatio;
uniform float uRise;
uniform float uSwirl;
uniform float uSpeed;
uniform float uScale;
varying float vAlpha;
void main() {
  float life = fract(uTime * uSpeed * (0.6 + seed.w * 0.8) + seed.z);
  vec3 p = position;
  p.x += sin(uTime * 0.6 + seed.z * 40.0) * uSwirl;
  p.z += cos(uTime * 0.5 + seed.z * 23.0) * uSwirl;
  p.y += life * uRise;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAlpha = sin(life * 3.14159) * (0.5 + seed.w * 0.5);
  gl_PointSize = uScale * (0.6 + seed.w) * uPixelRatio / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const SPARK_VERTEX = `
attribute vec4 seed;
uniform float uTime;
uniform float uStart;
uniform vec3 uOrigin;
uniform vec3 uNormal;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  float t = clamp((uTime - uStart) / 1.4, 0.0, 1.0);
  vec3 scatter = normalize(seed.xyz * 2.0 - 1.0);
  vec3 dir = normalize(uNormal * 1.6 + scatter);
  float reach = t * (0.3 + seed.w * 0.8);
  vec3 p = uOrigin + dir * reach + vec3(0.0, t * t * 0.5, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAlpha = (1.0 - t) * (1.0 - t);
  gl_PointSize = (9.0 + seed.w * 12.0) * (1.0 - t * 0.6) * uPixelRatio / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const MOTE_FRAGMENT = `
uniform vec3 uColor;
uniform float uGlow;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.05, d);
  float core = smoothstep(0.2, 0.0, d);
  gl_FragColor = vec4(uColor * (m + core) * uGlow, m * vAlpha);
}`;

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function glowPoints(count, place, vertexShader, uniforms) {
  const random = seededRandom(11 + count);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    positions.set(place(random, i), i * 3);
    seeds.set([random(), random(), random(), random()], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: MOTE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function motes({ count, color, place, rise, swirl, speed, scale, glow = 1, pixelRatio }) {
  return glowPoints(count, place, MOTE_VERTEX, {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uRise: { value: rise },
    uSwirl: { value: swirl },
    uSpeed: { value: speed },
    uScale: { value: scale },
    uColor: { value: new THREE.Color(color) },
    uGlow: { value: glow },
  });
}

function sparks(pixelRatio) {
  return glowPoints(36, (random) => [random(), random(), random()], SPARK_VERTEX, {
    uTime: { value: 0 },
    uStart: { value: -10 },
    uOrigin: { value: new THREE.Vector3() },
    uNormal: { value: new THREE.Vector3(0, 1, 0) },
    uPixelRatio: { value: pixelRatio },
    uColor: { value: new THREE.Color(BRASS) },
    uGlow: { value: 1.4 },
  });
}

function pillarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const pen = canvas.getContext("2d");
  const up = pen.createLinearGradient(0, 256, 0, 0);
  up.addColorStop(0, "rgba(255,255,255,0.95)");
  up.addColorStop(0.45, "rgba(255,255,255,0.35)");
  up.addColorStop(1, "rgba(255,255,255,0)");
  pen.fillStyle = up;
  pen.fillRect(0, 0, 64, 256);
  const across = pen.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, "rgba(0,0,0,1)");
  across.addColorStop(0.5, "rgba(0,0,0,0)");
  across.addColorStop(1, "rgba(0,0,0,1)");
  pen.globalCompositeOperation = "destination-out";
  pen.fillStyle = across;
  pen.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function runeTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d");
  const mid = size / 2;
  const random = seededRandom(23);
  pen.strokeStyle = "#ffffff";
  pen.lineCap = "round";
  const circle = (r, width, dash = []) => {
    pen.setLineDash(dash);
    pen.lineWidth = width;
    pen.beginPath();
    pen.arc(mid, mid, r, 0, Math.PI * 2);
    pen.stroke();
  };
  circle(470, 3);
  circle(432, 1.5);
  circle(352, 2, [16, 26]);
  pen.setLineDash([]);
  for (let n = 0; n < 72; n += 1) {
    const a = (n / 72) * Math.PI * 2;
    const long = n % 6 === 0;
    const from = long ? 436 : 452;
    pen.lineWidth = long ? 2.5 : 1.2;
    pen.beginPath();
    pen.moveTo(mid + Math.cos(a) * from, mid + Math.sin(a) * from);
    pen.lineTo(mid + Math.cos(a) * 466, mid + Math.sin(a) * 466);
    pen.stroke();
  }
  pen.lineWidth = 2.2;
  for (let n = 0; n < 18; n += 1) {
    const a = (n / 18) * Math.PI * 2;
    const cx = mid + Math.cos(a) * 392;
    const cy = mid + Math.sin(a) * 392;
    pen.save();
    pen.translate(cx, cy);
    pen.rotate(a + Math.PI / 2);
    pen.beginPath();
    const strokes = 3 + Math.floor(random() * 3);
    for (let k = 0; k <= strokes; k += 1) {
      const x = (random() - 0.5) * 26;
      const y = (random() - 0.5) * 26;
      if (k) pen.lineTo(x, y);
      else pen.moveTo(x, y);
    }
    pen.stroke();
    if (random() > 0.5) {
      pen.beginPath();
      pen.arc((random() - 0.5) * 14, (random() - 0.5) * 14, 3, 0, Math.PI * 2);
      pen.stroke();
    }
    pen.restore();
  }
  pen.lineWidth = 1.4;
  for (let n = 0; n < 6; n += 1) {
    const a = (n / 6) * Math.PI * 2;
    const b = a + (Math.PI * 2) / 3;
    pen.beginPath();
    pen.moveTo(mid + Math.cos(a) * 330, mid + Math.sin(a) * 330);
    pen.lineTo(mid + Math.cos(b) * 330, mid + Math.sin(b) * 330);
    pen.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function studio(renderer) {
  const room = new THREE.Scene();
  room.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a1c12, side: THREE.BackSide }),
    ),
  );
  const card = (r, g, b, power, width, height, x, y, z) => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.setRGB(r * power, g * power, b * power);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  card(1, 0.9, 0.72, 4.4, 16, 9, -7, 8, 5);
  card(0.75, 0.84, 0.98, 1.5, 10, 12, 8, 3.2, -4);
  card(1, 0.97, 0.9, 2.6, 18, 6, 0, 12, 1);
  card(1, 0.78, 0.48, 1.1, 14, 4, 0, -4, 8);
  card(1, 0.94, 0.8, 3.2, 2.2, 10, 1.5, 4, -9);
  card(0.5, 0.78, 1, 1.4, 9, 10, 9, 1.5, 6);
  card(0.68, 0.5, 1, 0.9, 12, 5, -2, -3, -8);
  const maker = new THREE.PMREMGenerator(renderer);
  const texture = maker.fromScene(room, 0.03).texture;
  maker.dispose();
  return texture;
}

const shellY = (r) => Math.sqrt(SHELL ** 2 - r * r) - (SHELL - DOME);

// Lower notes get larger fields, as on a real pan.
function fieldFrame(deg, ding, pitch = 5) {
  if (ding) {
    const center = new THREE.Vector3(0, DOME, 0);
    return {
      center,
      normal: UP.clone(),
      u: new THREE.Vector3(0, 0, 1),
      v: new THREE.Vector3(1, 0, 0),
      along: DING,
      across: DING,
      ding: true,
    };
  }
  const size = 1.1 - (Math.min(9, Math.max(1, pitch)) - 1) * 0.03;
  const a = (deg * Math.PI) / 180 - Math.PI / 2;
  const x = Math.cos(a) * RING_AT;
  const z = Math.sin(a) * RING_AT;
  const y = shellY(RING_AT);
  const normal = new THREE.Vector3(x, y + SHELL - DOME, z).normalize();
  const out = new THREE.Vector3(x, 0, z).normalize();
  const u = out.clone().addScaledVector(normal, -out.dot(normal)).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u);
  return { center: new THREE.Vector3(x, y, z), normal, u, v, along: ALONG * size, across: ACROSS * size, ding: false };
}

const frameOf = (spec) => fieldFrame(spec.deg, spec.ding, Number(spec.text));

function reach(frame, point) {
  const dx = point.x - frame.center.x;
  const dy = point.y - frame.center.y;
  const dz = point.z - frame.center.z;
  const du = dx * frame.u.x + dy * frame.u.y + dz * frame.u.z;
  const dv = dx * frame.v.x + dy * frame.v.y + dz * frame.v.z;
  return Math.hypot(du / frame.along, dv / frame.across);
}

// Move each note along its own normal. Tangent coordinates, and the hit test that uses them, stay put.
function noteLift(frame, point) {
  const e = reach(frame, point);
  if (frame.ding) {
    if (e > 1.4) return 0;
    const cap = 1 - smooth(0, 1.02, e) ** 1.6;
    const neck = Math.exp(-(((e - 1.04) / 0.07) ** 2));
    return 0.1 * cap - 0.014 * neck;
  }
  if (e > 1.3) return 0;
  // The pressed field is a flat plate at the height of its own border, so it sits just below the shell.
  const off =
    (point.x - frame.center.x) * frame.normal.x +
    (point.y - frame.center.y) * frame.normal.y +
    (point.z - frame.center.z) * frame.normal.z;
  const plate = (off / Math.max(e * e, 1e-4) - off) * (1 - smooth(0.62, 1, e));
  const bowl = Math.max(0, 1 - (e / 0.44) ** 2);
  const crease = Math.exp(-(((e - 1) / 0.05) ** 2));
  const shoulder = Math.exp(-(((e - 1.13) / 0.09) ** 2));
  return plate - 0.05 * bowl ** 0.65 - 0.003 * crease + 0.006 * shoulder;
}

const tone = (hex) => new THREE.Color(hex);
const SKIN = {
  shell: tone(0x5c3f26),
  edge: tone(0x3a281a),
  field: tone(0x8a6238),
  dimple: tone(0x43301f),
  temper: tone(0x4c5266),
  crown: tone(0x93693c),
};

function fieldNoise(x, z) {
  return (
    Math.sin(x * 2.3 + Math.sin(z * 1.7) * 1.6) * 0.5 +
    Math.sin(z * 3.1 - x * 1.2 + Math.sin(x * 4.4) * 0.8) * 0.3 +
    Math.sin((x + z) * 7.3) * 0.2
  );
}

// A tileable map of overlapping hammer dents. Red/green hold the normal; blue holds roughness.
function hammerMaps() {
  const size = 512;
  const height = new Float32Array(size * size);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let n = 0; n < 520; n += 1) {
    const cx = random() * size;
    const cy = random() * size;
    const r = 14 + random() * 26;
    const depth = 0.5 + random() * 0.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
      for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        const i = ((y + size) % size) * size + ((x + size) % size);
        const dent = depth * (1 - d * d) ** 2;
        height[i] = Math.min(height[i], -dent) * 0.6 + height[i] * 0.4 - dent * 0.15;
      }
    }
  }
  const make = (fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const pen = canvas.getContext("2d");
    const image = pen.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) fill(image.data, (y * size + x) * 4, x, y);
    }
    pen.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  const normal = make((data, i, x, y) => {
    const nx = -(at(x + 1, y) - at(x - 1, y)) * 2.2;
    const ny = -(at(x, y + 1) - at(x, y - 1)) * 2.2;
    const len = Math.hypot(nx, ny, 1);
    data[i] = (nx / len * 0.5 + 0.5) * 255;
    data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
    data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    data[i + 3] = 255;
  });
  const rough = make((data, i, x, y) => {
    const slope = Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1));
    const value = Math.min(255, 96 + slope * 200 + (at(x, y) + 0.5) * 24);
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  });
  return { normal, rough };
}

function domeGeometry(frames) {
  const RINGS = 150;
  const SPOKES = 300;
  const spots = [];
  const colors = [];
  const flat = [];
  const index = [];
  const point = new THREE.Vector3();
  const base = new THREE.Vector3();
  const shift = new THREE.Vector3();
  const paint = new THREE.Color();
  const reachEdge = Math.asin(RADIUS / SHELL);
  for (let i = 0; i <= RINGS; i += 1) {
    const a = (i / RINGS) * reachEdge;
    const r = SHELL * Math.sin(a);
    for (let j = 0; j <= SPOKES; j += 1) {
      const t = (j / SPOKES) * Math.PI * 2;
      base.set(r * Math.cos(t), shellY(r), r * Math.sin(t));
      flat.push(base.x / RADIUS, base.z / RADIUS);
      shift.set(0, 0, 0);
      let field = 0;
      let dimple = 0;
      let temper = 0;
      let crown = 0;
      for (const frame of frames) {
        const lift = noteLift(frame, base);
        if (!lift) continue;
        shift.addScaledVector(frame.normal, lift);
        const e = reach(frame, base);
        if (frame.ding) {
          crown = Math.max(crown, 1 - smooth(0.5, 1.05, e));
        } else {
          field = Math.max(field, 1 - smooth(0.85, 1.08, e));
          dimple = Math.max(dimple, 1 - smooth(0.36, 0.46, e));
          temper = Math.max(temper, Math.exp(-(((e - 0.62) / 0.2) ** 2)));
        }
      }
      point.copy(base).add(shift);
      const mottle = fieldNoise(base.x, base.z);
      paint.copy(SKIN.shell).lerp(SKIN.edge, smooth(0.8, 1, r / RADIUS) * 0.8);
      paint.lerp(SKIN.field, field * 0.55);
      paint.lerp(SKIN.temper, temper * field * 0.14);
      paint.lerp(SKIN.dimple, dimple * 0.6);
      paint.lerp(SKIN.crown, crown * 0.6);
      paint.multiplyScalar(1 + mottle * 0.12);
      spots.push(point.x, point.y, point.z);
      colors.push(paint.r, paint.g, paint.b);
    }
  }
  const row = SPOKES + 1;
  for (let i = 0; i < RINGS; i += 1) {
    for (let j = 0; j < SPOKES; j += 1) {
      const a = i * row + j;
      const b = a + row;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(flat, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const seam = new THREE.Vector3();
  for (let i = 0; i <= RINGS; i += 1) {
    const first = i * row;
    const last = first + SPOKES;
    seam.fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, seam.x, seam.y, seam.z);
    normals.setXYZ(last, seam.x, seam.y, seam.z);
  }
  for (let j = 0; j <= SPOKES; j += 1) normals.setXYZ(j, 0, 1, 0);
  return geometry;
}

// The lower shell, from the rim to the gu, which rolls inward into a short neck.
function bowlGeometry() {
  const points = [];
  const drop = (r) => -(Math.sqrt(BELLY_SHELL ** 2 - r * r) - (BELLY_SHELL - BELLY));
  for (let i = 0; i <= 40; i += 1) {
    const r = RADIUS - (i / 40) * (RADIUS - GU - 0.03);
    points.push(new THREE.Vector2(r, drop(r)));
  }
  const floor = drop(GU + 0.03);
  for (let i = 1; i <= 8; i += 1) {
    const a = -Math.PI / 2 - (i / 8) * (Math.PI / 2);
    points.push(new THREE.Vector2(GU + 0.03 + Math.cos(a) * 0.03, floor + 0.03 + Math.sin(a) * 0.03));
  }
  points.push(new THREE.Vector2(GU, floor + 0.12));
  return new THREE.LatheGeometry(points.reverse(), 128);
}

function createDrum(host, onHit, onStrike) {
  let pendingFrames = 40;
  let inView = true;
  let lastFocused = "";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const canvas = renderer.domElement;
  canvas.className = "pan-3d";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  renderer.setClearColor(0x000000, 0);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const key = new THREE.DirectionalLight(0xfff3e2, 1.45);
  key.position.set(-3.4, 7.2, 2.4);
  const fill = new THREE.DirectionalLight(0xd5e2f2, 0.22);
  fill.position.set(5.5, 2.6, -2.2);
  const kicker = new THREE.DirectionalLight(0xffe2b8, 0.28);
  kicker.position.set(0.8, 3.4, -6);
  const strike = new THREE.PointLight(BRASS, 0, 3.4, 1.5);
  const moonRim = new THREE.DirectionalLight(0x8fb8ff, 0.35);
  moonRim.position.set(4, 1.2, -5);
  scene.add(key, fill, kicker, strike, moonRim);
  const pixelRatio = renderer.getPixelRatio();

  const drum = new THREE.Group();
  scene.add(drum);
  const hammer = hammerMaps();
  for (const map of [hammer.normal, hammer.rough]) {
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    map.repeat.set(1.8, 1.8);
  }
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 1,
    roughness: 1,
    roughnessMap: hammer.rough,
    envMapIntensity: 1.25,
    normalMap: hammer.normal,
    normalScale: new THREE.Vector2(0.3, 0.3),
    iridescence: 0.1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 420],
  });
  const bellyNormal = hammer.normal.clone();
  const bellyRough = hammer.rough.clone();
  for (const map of [bellyNormal, bellyRough]) map.repeat.set(10, 1.4);
  const under = metal.clone();
  under.vertexColors = false;
  under.color.setHex(0x4a3320);
  under.normalMap = bellyNormal;
  under.roughnessMap = bellyRough;
  under.side = THREE.DoubleSide;
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS + 0.004, 0.022, 14, 220),
    new THREE.MeshStandardMaterial({ color: 0x5e4129, metalness: 1, roughness: 0.38, emissive: BRASS, emissiveIntensity: 0, envMapIntensity: 1.1 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.scale.z = 0.65;
  const cushion = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.09, 16, 96),
    new THREE.MeshStandardMaterial({ color: 0x241914, roughness: 0.86, metalness: 0 }),
  );
  cushion.rotation.x = Math.PI / 2;
  cushion.position.y = -0.67;
  drum.add(new THREE.Mesh(bowlGeometry(), under), lip);
  scene.add(cushion);
  let dome = null;

  const pedestal = new THREE.Group();
  const pedestalStone = new THREE.MeshStandardMaterial({ color: 0x34302b, roughness: 0.92, metalness: 0 });
  const pedestalProfile = [[0, -1.07], [2.08, -1.07], [2.14, -1.055], [2.18, -1.02], [2.18, -0.82], [2.16, -0.785], [2.12, -0.76], [0, -0.76]];
  pedestal.add(new THREE.Mesh(new THREE.LatheGeometry(pedestalProfile.map(([r, y]) => new THREE.Vector2(r, y)), 96), pedestalStone));
  scene.add(pedestal);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.26, 4.26),
    new THREE.MeshBasicMaterial({
      map: radialTexture([
        [0, "rgba(0,0,0,0.8)"],
        [0.74, "rgba(0,0,0,0.6)"],
        [0.9, "rgba(0,0,0,0.18)"],
        [1, "rgba(0,0,0,0)"],
      ]),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.75;
  scene.add(shadow);

  const floor = new THREE.Group();
  floor.position.y = -0.74;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const line = (inner, width, color, opacity, from, span) => {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(inner, inner + width, 160, 1, from, span),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    floor.add(mesh);
    return mesh;
  };
  const halo = line(2.02, 0.009, BRASS, 0.3, 0, Math.PI * 2);
  const wave = line(1.7, 0.03, BRASS, 0, 0, Math.PI * 2);
  let waveAt = 1;
  const flat = (size, map, color, opacity, z) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mesh.position.z = z;
    floor.add(mesh);
    return mesh;
  };
  const aurora = flat(5.6, radialTexture([
    [0, "rgba(111,207,176,0.55)"],
    [0.42, "rgba(154,124,240,0.3)"],
    [0.75, "rgba(154,124,240,0.08)"],
    [1, "rgba(0,0,0,0)"],
  ]), 0xffffff, 0.16, 0.001);
  const runes = flat(4.6, runeTexture(), BRASS, 0.22, 0.003);
  const innerRunes = flat(3.2, runeTexture(), TEAL, 0.14, 0.004);
  const ambientMotes = motes({
    count: 110,
    color: BRASS,
    rise: 2.4,
    swirl: 0.09,
    speed: 0.05,
    scale: 34,
    glow: 0.9,
    pixelRatio,
    place: (random) => {
      const a = random() * Math.PI * 2;
      const r = 1.35 + random() * 1.4;
      return [Math.cos(a) * r, -0.7 + random() * 0.4, Math.sin(a) * r];
    },
  });
  const coolMotes = motes({
    count: 40,
    color: TEAL,
    rise: 1.8,
    swirl: 0.14,
    speed: 0.035,
    scale: 26,
    glow: 0.7,
    pixelRatio,
    place: (random) => {
      const a = random() * Math.PI * 2;
      const r = 0.6 + random() * 1.8;
      return [Math.cos(a) * r, -0.4 + random() * 0.6, Math.sin(a) * r];
    },
  });
  scene.add(ambientMotes, coolMotes);
  const bursts = Array.from({ length: 6 }, () => {
    const burst = sparks(pixelRatio);
    burst.visible = false;
    drum.add(burst);
    return burst;
  });
  let nextBurst = 0;
  const pillarMap = pillarTexture();
  const pillarGeometry = new THREE.PlaneGeometry(0.42, 1.5);
  pillarGeometry.translate(0, 0.75, 0);

  const glowMap = radialTexture([
    [0, "rgba(255,255,255,1)"],
    [0.55, "rgba(255,255,255,0.75)"],
    [0.82, "rgba(255,255,255,0.28)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const flareMap = radialTexture([
    [0, "rgba(255,255,255,0.9)"],
    [0.3, "rgba(255,255,255,0.3)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const ringGeometry = new THREE.RingGeometry(0.95, 1.03, 72);
  const discGeometry = new THREE.PlaneGeometry(2.5, 2.5);

  const marks = new THREE.Group();
  drum.add(marks);
  const fields = new Map();
  const states = new Map();
  let specs = [];
  let tak = false;

  function build(spec) {
    const frame = frameOf(spec);
    const group = new THREE.Group();
    const lift = noteLift(frame, frame.center) + (spec.ding ? 0.042 : 0.016);
    group.position.copy(frame.center).addScaledVector(frame.normal, lift);
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.u, frame.v, frame.normal));
    const additive = (map) =>
      new THREE.MeshBasicMaterial({
        map,
        color: BRASS,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
    const glow = new THREE.Mesh(discGeometry, additive(glowMap));
    glow.scale.set(frame.along, frame.across, 1);
    const ring = new THREE.Mesh(ringGeometry, additive(null));
    ring.scale.set(frame.along, frame.across, 1);
    ring.position.z = 0.004;
    const ripple = new THREE.Mesh(ringGeometry, additive(null));
    ripple.position.z = 0.008;
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flareMap,
        color: BRASS,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    flare.scale.set(1.5, 1.5, 1);
    const pillarMaterial = new THREE.MeshBasicMaterial({
      map: pillarMap,
      color: BRASS,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const pillar = new THREE.Group();
    for (const turn of [0, Math.PI / 2]) {
      const sheet = new THREE.Mesh(pillarGeometry, pillarMaterial);
      sheet.rotation.y = turn;
      pillar.add(sheet);
    }
    pillar.position.copy(frame.center).addScaledVector(frame.normal, 0.02);
    pillar.scale.set(1, 0.2, 1);
    pillar.visible = false;
    marks.add(pillar);
    const styles = getComputedStyle(document.documentElement);
    const tint = styles.getPropertyValue(spec.hand === "left" ? "--brass-2" : "--mist").trim();
    const plain = new THREE.SpriteMaterial({ map: labelTexture(spec.text, tint), depthTest: false, transparent: true, toneMapped: false });
    const dark = new THREE.SpriteMaterial({ map: labelTexture(spec.text, INK), depthTest: false, transparent: true, toneMapped: false });
    const label = new THREE.Sprite(plain);
    const size = spec.ding ? 0.56 : 0.44;
    label.scale.set(size, size, 1);
    label.position.z = 0.05;
    label.renderOrder = 6;
    group.add(glow, ring, ripple, flare, label);
    marks.add(group);
    fields.set(spec.id, {
      frame,
      glow,
      ring,
      ripple,
      flare,
      pillar,
      label,
      plain,
      dark,
      pitch: Number(spec.text),
      spot: frame.center.clone().addScaledVector(frame.normal, 0.55),
      state: "idle",
      wave: 1,
      echo: 1,
      flash: 0,
      rise: 1,
      goal: new THREE.Color(BRASS),
    });
  }

  function layout(next) {
    pendingFrames = 40;
    specs = next;
    if (specs.length) {
      if (dome) {
        drum.remove(dome);
        dome.geometry.dispose();
      }
      dome = new THREE.Mesh(domeGeometry(specs.map(frameOf)), metal);
      drum.add(dome);
    }
    for (const item of fields.values()) {
      for (const material of [item.plain, item.dark]) {
        material.map.dispose();
        material.dispose();
      }
      for (const part of [item.glow, item.ring, item.ripple, item.flare]) part.material.dispose();
      item.pillar.children[0].material.dispose();
    }
    marks.clear();
    fields.clear();
    for (const spec of specs) build(spec);
    for (const [id, state] of states) set(id, state);
  }

  function set(id, state) {
    const before = states.get(id);
    if (before !== state) pendingFrames = 40;
    states.set(id, state);
    const item = fields.get(id);
    if (!item) return;
    item.state = state;
    const look = LOOKS[state] || LOOKS.idle;
    item.goal.setHex(look.color);
    item.label.material = look.ink ? item.dark : item.plain;
    const struck = state === "on" || state === "heard" || state === "miss";
    if (!struck || before === state) return;
    item.wave = 0;
    item.echo = -0.3;
    item.rise = 0;
    item.flash = 1;
    item.ripple.material.color.setHex(look.color);
    item.flare.material.color.setHex(look.color);
    item.pillar.children[0].material.color.setHex(look.color);
    const burst = bursts[nextBurst];
    nextBurst = (nextBurst + 1) % bursts.length;
    burst.material.uniforms.uStart.value = lastSeconds;
    burst.material.uniforms.uOrigin.value.copy(item.frame.center).addScaledVector(item.frame.normal, 0.03);
    burst.material.uniforms.uNormal.value.copy(item.frame.normal);
    burst.material.uniforms.uColor.value.setHex(look.color);
    burst.visible = true;
    energy = 1;
    strike.color.setHex(look.color);
    strike.position.copy(item.spot);
    strike.intensity = 10;
    wave.material.color.setHex(look.color);
    waveAt = 0;
    onStrike(item.pitch, look.color);
  }

  function resize() {
    pendingFrames = 40;
    const width = host.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const back = 1.13 * Math.max(1, 1.3 / camera.aspect);
    camera.position.set(0, 5.3 * back, 4.3 * back);
    camera.lookAt(0, -0.4, 0.2);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  new ResizeObserver(resize).observe(host);
  resize();

  const ray = new THREE.Raycaster();
  const point = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  const motionTarget = new THREE.Vector3();
  let motionActive = false;
  const local = new THREE.Vector3();

  function noteAt(event) {
    if (!dome) return "";
    const box = canvas.getBoundingClientRect();
    point.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(point, camera);
    const found = ray.intersectObject(dome, false)[0];
    if (!found) return "";
    drum.worldToLocal(local.copy(found.point));
    let best = "";
    let near = 1.3;
    for (const [id, item] of fields) {
      const e = reach(item.frame, local);
      if (e < near) {
        near = e;
        best = id;
      }
    }
    return best;
  }

  canvas.addEventListener("pointerdown", (event) => {
    const id = noteAt(event);
    if (id) onHit(id);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!still) pendingFrames = 40;
    canvas.style.cursor = noteAt(event) ? "pointer" : "default";
    const box = canvas.getBoundingClientRect();
    tilt.set((event.clientX - box.left) / box.width - 0.5, (event.clientY - box.top) / box.height - 0.5);
  });
  canvas.addEventListener("pointerleave", () => { tilt.set(0, 0); pendingFrames = 40; });

  const white = new THREE.Color(0xffffff);
  let lastSeconds = 0;
  let lastDraw = -1000;
  let energy = 0;

  function frame(time) {
    const active = document.activeElement;
    const target = active && active.closest && active.matches(":focus-visible") ? active.closest(".field") : null;
    const focused = target ? target.dataset.note : "";
    if (focused !== lastFocused) { pendingFrames = 40; lastFocused = focused; }
    const ambient = !still && time - lastDraw >= 33;
    if (!pendingFrames && !ambient) return;
    if (pendingFrames) pendingFrames -= 1;
    lastDraw = time;
    const seconds = time / 1000;
    lastSeconds = seconds;
    renderer.info.reset();
    energy *= 0.94;
    for (const points of [ambientMotes, coolMotes]) {
      points.material.uniforms.uTime.value = seconds;
      points.material.uniforms.uGlow.value = (points === coolMotes ? 0.7 : 0.9) + energy * 0.8;
    }
    for (const burst of bursts) {
      if (!burst.visible) continue;
      burst.material.uniforms.uTime.value = seconds;
      if (seconds - burst.material.uniforms.uStart.value > 1.4) burst.visible = false;
    }
    const breath = still ? 0 : Math.sin(seconds * 0.5);
    aurora.material.opacity = 0.13 + breath * 0.04 + energy * 0.3;
    aurora.rotation.z = seconds * 0.03;
    aurora.scale.setScalar(1 + breath * 0.03 + energy * 0.08);
    runes.material.opacity = 0.2 + breath * 0.05 + energy * 0.55;
    runes.rotation.z = seconds * 0.02;
    innerRunes.material.opacity = 0.12 + energy * 0.4;
    innerRunes.rotation.z = -seconds * 0.045;
    for (const [id, item] of fields) {
      const look = LOOKS[item.state] || LOOKS.idle;
      const lit = id === focused;
      item.glow.material.color.lerp(item.goal, 0.35);
      item.glow.material.opacity += (look.glow * 0.95 - item.glow.material.opacity) * 0.3;
      item.ring.material.color.lerp(lit ? white : item.goal, 0.35);
      item.ring.material.opacity += ((lit ? 1 : look.ring) - item.ring.material.opacity) * 0.3;
      item.flash *= 0.9;
      item.flare.material.opacity = item.flash * 0.85;
      if (item.wave < 1) {
        item.wave = Math.min(1, item.wave + 0.024);
        const grow = 1 + item.wave * 2.4;
        item.ripple.scale.set(item.frame.along * grow, item.frame.across * grow, 1);
        item.ripple.material.opacity = (1 - item.wave) ** 2;
      }
      if (item.echo < 1) {
        item.echo = Math.min(1, item.echo + 0.02);
        if (item.echo > 0 && item.wave >= 1) {
          const grow = 1 + item.echo * 1.6;
          item.ripple.scale.set(item.frame.along * grow, item.frame.across * grow, 1);
          item.ripple.material.opacity = (1 - item.echo) ** 2 * 0.5;
        }
      }
      if (item.rise < 1) {
        item.rise = Math.min(1, item.rise + 0.018);
        const lift = 0.2 + smooth(0, 0.6, item.rise) * 0.8;
        item.pillar.scale.set(1 + item.rise * 0.6, lift, 1 + item.rise * 0.6);
        item.pillar.children[0].material.opacity = (1 - item.rise) ** 1.5 * 0.7;
        item.pillar.visible = item.rise < 1;
      }
      for (const mesh of [item.glow, item.ring, item.ripple, item.flare]) mesh.visible = mesh.material.opacity > 0.005;
    }
    strike.intensity *= 0.88;
    if (waveAt < 1) {
      waveAt = Math.min(1, waveAt + 0.02);
      const grow = 1 + waveAt * 0.9;
      wave.scale.set(grow, grow, 1);
      wave.material.opacity = (1 - waveAt) ** 2 * 0.9;
    }
    lip.material.emissiveIntensity += ((tak ? 2 : 0) + energy * 0.5 - lip.material.emissiveIntensity) * 0.3;
    const sway = still ? 0 : 1;
    const targetX = (motionActive ? motionTarget.x : still ? 0 : tilt.y * 0.06) + Math.sin(seconds * 0.37) * 0.012 * sway;
    const targetY = (motionActive ? motionTarget.y : 0) + Math.sin(seconds * 0.23) * 0.035 * sway;
    const targetZ = (motionActive ? motionTarget.z : still ? 0 : -tilt.x * 0.06) + Math.cos(seconds * 0.31) * 0.012 * sway;
    drum.rotation.x += (targetX - drum.rotation.x) * 0.12;
    drum.rotation.y += (targetY - drum.rotation.y) * 0.12;
    drum.rotation.z += (targetZ - drum.rotation.z) * 0.12;
    drum.position.y = Math.sin(seconds * 0.6) * 0.035 * sway + energy * 0.02;
    halo.material.opacity = 0.24 + breath * 0.06 + energy * 0.4;
    if (profiling) host.dataset.rotation = JSON.stringify([drum.rotation.x, drum.rotation.y, drum.rotation.z]);
    renderer.render(scene, camera);
  }

  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) pendingFrames = 40; }).observe(host);

  return {
    layout,
    set,
    frame,
    motion(value) {
      const next = value ? new THREE.Vector3(value.x, value.y, value.z) : new THREE.Vector3();
      if (motionActive !== !!value || motionTarget.distanceToSquared(next) > 0.000004) pendingFrames = 40;
      motionActive = !!value;
      motionTarget.copy(next);
    },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    setTak(on) {
      if (tak !== on) pendingFrames = 40;
      tak = on;
    },
    visible: () => inView,
  };
}

function mosaicTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const pen = canvas.getContext("2d");
  pen.fillStyle = "#173d43";
  pen.fillRect(0, 0, 512, 512);
  for (let y = 0; y <= 512; y += 128) {
    for (let x = 0; x <= 512; x += 128) {
      pen.beginPath();
      for (let n = 0; n < 16; n += 1) {
        const angle = n * Math.PI / 8;
        const r = n % 2 ? 24 : 51;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (!n) pen.moveTo(px, py);
        else pen.lineTo(px, py);
      }
      pen.closePath();
      pen.fillStyle = "#32656a";
      pen.fill();
      pen.lineWidth = 3;
      pen.strokeStyle = "#b99458";
      pen.stroke();
      pen.strokeStyle = "#688482";
      pen.lineWidth = 1;
      pen.strokeRect(x + 44, y + 44, 40, 40);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function batchArchitecture(scene) {
  scene.updateMatrixWorld(true);
  const batches = new Map();
  scene.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.userData.keepSeparate || !object.material.isMeshStandardMaterial) return;
    const key = object.material.uuid;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  });
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrixWorld);
    });
    const geometry = mergeGeometries(geometries, false);
    for (const item of geometries) item.dispose();
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, meshes[0].material);
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    for (const mesh of meshes) mesh.removeFromParent();
    for (const original of new Set(meshes.map((mesh) => mesh.geometry))) original.dispose();
    scene.add(merged);
  }
}

function createWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "world";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x142c3c);
  scene.fog = new THREE.FogExp2(0x142c3c, 0.015);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
  const skyLight = new THREE.HemisphereLight(0x9dbdd4, 0x322517, 2);
  scene.add(skyLight);
  const moonlight = new THREE.DirectionalLight(0xb9d7ed, 2.5);
  moonlight.position.set(-12, 24, -5);
  moonlight.castShadow = true;
  moonlight.shadow.mapSize.set(2048, 2048);
  moonlight.shadow.camera.left = -32;
  moonlight.shadow.camera.right = 32;
  moonlight.shadow.camera.top = 32;
  moonlight.shadow.camera.bottom = -32;
  moonlight.shadow.camera.far = 90;
  moonlight.shadow.normalBias = 0.07;
  scene.add(moonlight);
  const amber = new THREE.DirectionalLight(0xe9b16f, 1.2);
  amber.position.set(12, 6, 10);
  scene.add(amber);
  const stoneCanvas = document.createElement("canvas");
  stoneCanvas.width = stoneCanvas.height = 256;
  const stonePen = stoneCanvas.getContext("2d");
  const pixels = stonePen.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const i = (y * 256 + x) * 4;
      const cloud = Math.sin(x * 0.08 + Math.sin(y * 0.05) * 2) * 6 + Math.sin(y * 0.12) * 4;
      const value = 198 + cloud * 0.5;
      pixels.data[i] = value;
      pixels.data[i + 1] = value - 9;
      pixels.data[i + 2] = value - 21;
      pixels.data[i + 3] = 255;
    }
  }
  stonePen.putImageData(pixels, 0, 0);
  const stoneMap = new THREE.CanvasTexture(stoneCanvas);
  stoneMap.colorSpace = THREE.SRGBColorSpace;
  const stone = new THREE.MeshStandardMaterial({ color: 0xa89b85, map: stoneMap, roughness: 0.94 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xc4b99d, map: stoneMap, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x374749, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x897455, metalness: 0.72, roughness: 0.6 });
  const tile = new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.76, metalness: 0, color: 0xadc7c2 });
  const box = (w, h, d, x, y, z, material = stone, parent = scene) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const arch = (x, z, width, spring, rise, depth, rotation = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    scene.add(group);
    const half = width / 2;
    for (const side of [-1, 1]) {
      box(0.65, spring, depth, side * (half + 0.32), spring / 2, 0, stone, group);
      box(0.94, 0.24, depth + 0.24, side * (half + 0.32), 0.18, 0, pale, group);
      box(0.86, 0.22, depth + 0.22, side * (half + 0.32), spring - 0.08, 0, pale, group);
      box(0.15, spring - 0.8, depth + 0.02, side * (half + 0.32), spring / 2, 0, tile, group);
      const shape = new THREE.Shape();
      shape.moveTo(0, spring + rise);
      shape.bezierCurveTo(side * half * 0.45, spring + rise * 0.83, side * half, spring + rise * 0.48, side * half, spring);
      shape.lineTo(side * (half + 0.63), spring);
      shape.bezierCurveTo(side * (half + 0.65), spring + rise * 0.58, side * half * 0.55, spring + rise + 0.45, 0, spring + rise + 0.64);
      shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, steps: 1, curveSegments: 24 }), pale);
      mesh.position.z = -depth / 2;
      group.add(mesh);
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, spring + rise + 0.27, depth / 2 + 0.025),
        new THREE.Vector3(side * half * 0.53, spring + rise * 0.98, depth / 2 + 0.025),
        new THREE.Vector3(side * (half + 0.27), spring + rise * 0.5, depth / 2 + 0.025),
        new THREE.Vector3(side * (half + 0.27), spring, depth / 2 + 0.025),
      );
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.07, 6, false), tile));
    }
    return group;
  };
  box(70, 0.5, 90, 0, -0.28, -20, dark);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x858c86, map: stoneMap, roughness: 0.65 });
  const paving = new THREE.InstancedMesh(new THREE.BoxGeometry(3.16, 0.06, 3.16), floorMaterial, 240);
  const pavingTransform = new THREE.Matrix4();
  let pavingIndex = 0;
  for (let z = 7; z > -38; z -= 3.2) {
    for (let x = -24; x <= 24; x += 3.2) {
      pavingTransform.makeTranslation(x, 0, z);
      paving.setMatrixAt(pavingIndex, pavingTransform);
      paving.setColorAt(pavingIndex, new THREE.Color().setScalar(0.87 + Math.sin(pavingIndex * 9.7) * 0.07));
      pavingIndex += 1;
    }
  }
  paving.count = pavingIndex;
  scene.add(paving);
  const runnerMap = mosaicTexture();
  runnerMap.repeat.set(2, 12);
  const runner = new THREE.MeshStandardMaterial({ map: runnerMap, roughness: 0.8, metalness: 0 });
  box(4.5, 0.08, 28, 3, 0.07, -9, runner);
  for (const x of [0.65, 5.35]) box(0.08, 0.1, 28, x, 0.07, -9, gold);
  for (let i = 0; i < 3; i += 1) box(18 - i * 0.7, 0.18, 9 - i * 0.7, 1, i * 0.18 + 0.06, -22, stone);
  for (let x = -20; x <= 22; x += 7) arch(x, -23, 5.6, 5.5, 4.4, 1.6);
  box(50, 1.1, 2, 0, 10.8, -23, stone);
  box(50, 0.22, 2.35, 0, 10.15, -23, tile);
  box(50, 0.2, 2.5, 0, 11.4, -23, pale);
  for (let x = -24; x <= 24; x += 1.5) box(0.65, 0.65, 1.9, x, 11.7, -23, stone);
  for (let x = -17; x <= 18; x += 7) {
    const medallion = new THREE.Mesh(new THREE.CircleGeometry(0.42, 8), tile);
    medallion.position.set(x, 8.2, -22.08);
    medallion.rotation.z = Math.PI / 8;
    scene.add(medallion);
  }
  for (const side of [-1, 1]) {
    for (const z of side === -1 ? [-18] : [-18, -10, -2]) arch(side * 15, z, 6.5, 6.2, 4.8, 1.7, Math.PI / 2);
    box(2, 1.2, 30, side * 15, 12, -7, stone);
    box(2.1, 0.25, 30, side * 15, 11.2, -7, tile);
  }
  const nicheMaterial = new THREE.MeshStandardMaterial({ color: 0x103b43, roughness: 0.48 });
  for (const x of [-17, -10, -3, 4, 11, 18]) {
    box(0.9, 7.2, 0.3, x, 4.6, -21.95, tile);
    box(5.3, 5.5, 0.3, x + 3.5, 2.9, -29, nicheMaterial);
  }
  const cloth = new THREE.MeshStandardMaterial({ color: 0x683a38, side: THREE.DoubleSide, roughness: 0.9 });
  for (const x of [-12.4, 12.4]) {
    const geometry = new THREE.PlaneGeometry(2, 5.3, 16, 24);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) p.setZ(i, Math.sin(p.getX(i) * 12) * 0.11);
    geometry.computeVertexNormals();
    const banner = new THREE.Mesh(geometry, cloth);
    banner.position.set(x, 6.6, -8);
    scene.add(banner);
    box(2.3, 0.08, 0.1, x, 9.3, -8, gold);
  }
  const lamps = [];
  const lantern = (x, y, z, scale = 1) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    scene.add(group);
    const glass = new THREE.MeshStandardMaterial({ color: 0xffca78, emissive: 0xffa64c, emissiveIntensity: 2.5, roughness: 0.4 });
    const lightbody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 0.62, 6), glass);
    group.add(lightbody);
    for (const at of [-0.38, 0.4]) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.25, 6), gold);
      cap.position.y = at;
      cap.rotation.z = at < 0 ? Math.PI : 0;
      group.add(cap);
    }
    for (let n = 0; n < 6; n += 1) {
      const a = n * Math.PI / 3;
      box(0.025, 0.74, 0.025, Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23, gold, group);
    }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.5, 5), gold);
    chain.position.y = 1.85;
    group.add(chain);
    const light = new THREE.PointLight(0xffb660, 22 * scale, 10 * scale, 2);
    light.position.set(x, y, z);
    scene.add(light);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture([[0, "rgba(255,193,110,0.32)"], [0.3, "rgba(255,166,61,0.1)"], [1, "rgba(255,166,61,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(x, y, z);
    halo.scale.set(2.5 * scale, 2.5 * scale, 1);
    scene.add(halo);
    lamps.push({ light, base: 22 * scale, glass });
  };
  for (const x of [-10.5, 10.5]) {
    lantern(x, 5, -1, 1.2);
    lantern(x, 4.5, -13, 1);
    lantern(x, 4.2, -23, 0.9);
  }
  for (const x of [-5, 6]) lantern(x, 2, -19, 0.8);
  const ridge = new THREE.MeshStandardMaterial({ color: 0x1e3441, roughness: 1 });
  for (let k = 0; k < 18; k += 1) {
    const height = 6 + Math.sin(k * 2.1) * 2 + k % 3;
    box(4.5, height, 5, k * 5 - 42, height / 2 + 6, -48 - k % 3 * 2, ridge);
    if (k % 3 === 0) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ridge);
      dome.position.set(k * 5 - 42, height + 6, -48);
      scene.add(dome);
    }
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffe8bf, fog: false }));
  moon.position.set(46, 35, -64);
  scene.add(moon);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture([[0, "rgba(214,230,245,0.22)"], [0.3, "rgba(165,197,227,0.08)"], [1, "rgba(165,197,227,0)"]]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  moonHalo.position.copy(moon.position);
  moonHalo.scale.set(20, 20, 1);
  scene.add(moonHalo);
  scene.traverse((object) => {
    if (object.isMesh && object.material.isMeshStandardMaterial) {
      object.castShadow = !object.isInstancedMesh && object.material.emissiveIntensity <= 1;
      object.receiveShadow = true;
    }
  });
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  batchArchitecture(scene);
  const courtyard = new THREE.Group();
  for (const child of [...scene.children]) {
    if (!child.isLight || child.isPointLight) courtyard.add(child);
  }
  scene.add(courtyard);
  const pixelRatio = renderer.getPixelRatio();
  const dust = motes({
    count: 420,
    color: 0xf3d7a2,
    rise: 7,
    swirl: 0.7,
    speed: 0.02,
    scale: 110,
    glow: 0.8,
    pixelRatio,
    place: (random) => [random() * 64 - 32, random() * 16 - 2, random() * 50 - 40],
  });
  const fireflies = motes({
    count: 70,
    color: 0xffc46a,
    rise: 2.2,
    swirl: 1.1,
    speed: 0.09,
    scale: 220,
    glow: 1.3,
    pixelRatio,
    place: (random) => {
      const side = random() > 0.5 ? 1 : -1;
      return [side * (6 + random() * 7), 1 + random() * 5, -random() * 24];
    },
  });
  const wisps = motes({
    count: 90,
    color: 0x8fd8c8,
    rise: 3,
    swirl: 1.6,
    speed: 0.05,
    scale: 160,
    glow: 0.6,
    pixelRatio,
    place: (random) => [random() * 50 - 25, random() * 6, random() * 30 - 30],
  });
  scene.add(dust, fireflies, wisps);
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture([[0, "rgba(255,255,255,1)"], [0.25, "rgba(220,235,255,0.5)"], [1, "rgba(220,235,255,0)"]]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0,
  }));
  streak.scale.set(6, 0.16, 1);
  streak.material.rotation = 0.3;
  scene.add(streak);
  const streakFrom = new THREE.Vector3();
  const streakDir = new THREE.Vector3(-1, -0.32, 0).normalize();
  let streakAt = -1;
  let nextStreak = 5;
  const landscape = createLandscape();
  batchArchitecture(landscape.group);
  landscape.group.visible = false;
  scene.add(landscape.group);
  let view = VIEWS.courtyard;
  let viewKey = "courtyard";
  let exploring = false;
  let savedView = "courtyard";
  let orbit = 0;
  let dragging = null;
  const beacons = new THREE.Group();
  beacons.visible = false;
  const pickTargets = [];
  const pickVolumes = [];
  Object.keys(VIEWS).forEach((key, index) => {
    const angle = (index / Object.keys(VIEWS).length) * Math.PI * 2;
    const beacon = new THREE.Group();
    beacon.position.set(Math.cos(angle) * 24, 0, Math.sin(angle) * 18 - 15);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x97764d, metalness: 0.5, roughness: 0.45 }));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: 0xffd898, emissive: 0xe6b15a, emissiveIntensity: 1.8, metalness: 0.4, roughness: 0.3 }));
    gem.position.y = 2.8;
    gem.userData.view = key;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.035, 6, 36), new THREE.MeshBasicMaterial({ color: 0xf4d29b }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    beacon.add(base, gem, ring);
    const hitArea = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hitArea.position.y = 2.8;
    hitArea.userData.view = key;
    beacon.add(hitArea);
    beacons.add(beacon);
    pickTargets.push(gem);
    pickVolumes.push(hitArea);
  });
  scene.add(beacons);
  const look = new THREE.Vector2();
  const ease = new THREE.Vector2();
  let last = 0;
  let energy = 0;
  let pendingFrames = 30;
  function draw(time) {
    renderer.info.reset();
    ease.lerp(look, 0.035);
    const seconds = time / 1000;
    const drift = still ? 0 : 1;
    if (exploring) {
      camera.position.set(Math.sin(orbit) * 58, 23, Math.cos(orbit) * 58 - 12);
      camera.lookAt(-3, 7, -22);
    } else {
      camera.position.set(
        view.eye[0] + ease.x * 0.65 + Math.sin(seconds * 0.21) * 0.35 * drift,
        view.eye[1] - ease.y * 0.3 + Math.sin(seconds * 0.3) * 0.22 * drift,
        view.eye[2],
      );
      camera.lookAt(...view.target);
    }
    lamps.forEach(({ light, base, glass }, i) => {
      const flicker = (Math.sin(seconds * 13 + i * 2.1) + Math.sin(seconds * 31 + i * 5.3)) * 0.03 * drift;
      light.intensity = base * (1 + energy * 0.15 + flicker);
      glass.emissiveIntensity = 2.1 + energy * 0.5 + flicker * 4;
    });
    skyLight.intensity = 2 + energy * 0.5;
    moonHalo.scale.setScalar(20 + Math.sin(seconds * 0.4) * 1.2 * drift + energy * 2);
    for (const points of [dust, fireflies, wisps]) points.material.uniforms.uTime.value = seconds;
    fireflies.material.uniforms.uGlow.value = 1.3 + energy * 1.2;
    wisps.material.uniforms.uGlow.value = 0.6 + energy * 0.9;
    if (streakAt < 0 && seconds > nextStreak && drift) {
      streakAt = seconds;
      streakFrom.set(Math.sin(seconds * 7.3) * 38, 30 + Math.cos(seconds * 3.1) * 8, -72);
    }
    if (streakAt >= 0) {
      const progress = (seconds - streakAt) / 0.9;
      if (progress >= 1) {
        streakAt = -1;
        nextStreak = seconds + 8 + Math.abs(Math.sin(seconds * 2.7)) * 10;
        streak.material.opacity = 0;
      } else {
        streak.position.copy(streakFrom).addScaledVector(streakDir, progress * 26);
        streak.material.opacity = Math.sin(progress * Math.PI) * 0.9;
      }
    }
    energy *= 0.96;
    renderer.render(scene, camera);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    draw(performance.now());
  }
  addEventListener("resize", resize);
  if (!still) addEventListener("pointermove", (event) => {
    if (!event.target.closest("#pan")) return;
    look.set(event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5);
    pendingFrames = 30;
  });
  resize();
  function environment(key) {
      if (!VIEWS[key] || key === viewKey) return;
      viewKey = key;
      view = VIEWS[key];
      if (exploring) orbit = Math.atan2(view.eye[0], view.eye[2] + 25) * 0.7;
      pickTargets.forEach((gem) => {
        const selected = gem.userData.view === key;
        gem.material.color.setHex(selected ? 0x8be4d4 : 0xffd898);
        gem.material.emissive.setHex(selected ? 0x469c94 : 0xe6b15a);
      });
      courtyard.visible = key === "courtyard";
      landscape.group.visible = key !== "courtyard";
      landscape.set(key);
      scene.background.setHex(view.sky);
      scene.fog.color.setHex(view.sky);
      scene.fog.density = key === "courtyard" ? 0.015 : 0.006;
      moonlight.color.setHex(key === "dawn" ? 0xffc28b : key === "valley" ? 0xffeed2 : 0xb9d7ed);
      moonlight.intensity = key === "lake" ? 1.2 : 2.5;
      renderer.shadowMap.needsUpdate = true;
      pendingFrames = 30;
      draw(performance.now());
  }
  document.addEventListener("alamut-explore", (event) => {
    if (event.detail.open && !exploring) savedView = viewKey;
    exploring = event.detail.open;
    beacons.visible = exploring;
    if (exploring) {
      environment(event.detail.view || "dawn");
    } else {
      environment(savedView);
    }
    pendingFrames = 30;
    draw(performance.now());
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!exploring) return;
    dragging = { x: event.clientX, start: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !exploring) return;
    orbit = THREE.MathUtils.clamp(orbit - (event.clientX - dragging.x) * 0.005, -0.8, 0.8);
    dragging.x = event.clientX;
    pendingFrames = 30;
    if (still) draw(performance.now());
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    const click = Math.abs(event.clientX - dragging.start) < 6 && Math.abs(event.clientY - dragging.y) < 6;
    dragging = null;
    if (!click) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2), camera);
    const hit = ray.intersectObjects(pickVolumes)[0];
    if (hit) document.dispatchEvent(new CustomEvent("alamut-place", { detail: { view: hit.object.userData.view } }));
  });
  canvas.addEventListener("pointercancel", () => { dragging = null; });
  return {
    environment,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    frame(time) {
      if (time - last < 40) return;
      if (!pendingFrames && still) return;
      if (pendingFrames) pendingFrames -= 1;
      last = time;
      draw(time);
    },
    strike() { energy = 1; pendingFrames = 30; },
    redraw() { draw(performance.now()); },
  };
}

export function createStage({ pan, onHit }) {
  const world = createWorld();
  const drum = createDrum(pan, onHit, (pitch, color) => world.strike(pitch, color));

  let lastFrame = 0;
  const timings = [];
  const submissions = [];
  function loop(time) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const start = profiling ? performance.now() : 0;
    if (drum.visible()) drum.frame(time);
    if (!still) world.frame(time);
    if (profiling) {
      if (lastFrame) timings.push(time - lastFrame);
      lastFrame = time;
      submissions.push(performance.now() - start);
      if (timings.length >= 90) {
        const sorted = [...timings].sort((a, b) => a - b);
        pan.dataset.profile = JSON.stringify({ frameMs: timings.reduce((a, b) => a + b, 0) / timings.length, p95Ms: sorted[Math.floor(sorted.length * 0.95)], submitMs: submissions.reduce((a, b) => a + b, 0) / submissions.length, drum: drum.stats(), world: world.stats() });
        timings.length = 0;
        submissions.length = 0;
      }
    }
  }

  requestAnimationFrame(loop);
  if (still) addEventListener("scroll", () => world.redraw(), { passive: true });

  return { layout: drum.layout, set: drum.set, setTak: drum.setTak, environment: world.environment, motion: drum.motion };
}
