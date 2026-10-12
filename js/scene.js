import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createLandscape } from "./landscape.js";
import { VIEWS } from "./environments.js";

const BRASS = 0xe6b15a;
const CREAM = 0xf0e2d2;
const TEAL = 0x6fcfb0;
const RED = 0xd9735c;
const INK = "#1a140f";
const RADIUS = 1.6;
const DOME = 0.44;
const RING_AT = 1.1;
const ACROSS = 0.3;
const ALONG = 0.245;
const DING = 0.47;
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

function labelTexture(text, color, outline) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const pen = canvas.getContext("2d");
  pen.font = '600 104px Sora, "Avenir Next", sans-serif';
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  if (outline) {
    pen.lineWidth = 14;
    pen.lineJoin = "round";
    pen.strokeStyle = "rgba(10, 7, 5, 0.6)";
    pen.strokeText(text, 80, 86);
  }
  pen.fillStyle = color;
  pen.fillText(text, 80, 86);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function grainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const pen = canvas.getContext("2d");
  const image = pen.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = 150 + Math.random() * 90;
    image.data[i] = shade;
    image.data[i + 1] = shade;
    image.data[i + 2] = shade;
    image.data[i + 3] = 255;
  }
  pen.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 4);
  return texture;
}

function studio(renderer) {
  const room = new THREE.Scene();
  room.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 24, 12),
      new THREE.MeshBasicMaterial({ color: 0x0b0907, side: THREE.BackSide }),
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
  card(1, 0.74, 0.44, 7, 6, 5, -5, 6, 3);
  card(0.24, 0.82, 0.72, 5, 3, 7, 6, 2, -5);
  card(1, 0.95, 0.88, 2.2, 8, 8, 0, 9, 0);
  card(1, 1, 1, 9, 0.5, 6, 3, 5, 6);
  card(0.9, 0.42, 0.2, 3, 5, 2, 0, 1.2, 8);
  const maker = new THREE.PMREMGenerator(renderer);
  const texture = maker.fromScene(room, 0.03).texture;
  maker.dispose();
  return texture;
}

function fieldFrame(deg, ding) {
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
  const a = (deg * Math.PI) / 180 - Math.PI / 2;
  const x = Math.cos(a) * RING_AT;
  const z = Math.sin(a) * RING_AT;
  const y = DOME * Math.sqrt(1 - (RING_AT / RADIUS) ** 2);
  const normal = new THREE.Vector3(x / RADIUS ** 2, y / DOME ** 2, z / RADIUS ** 2).normalize();
  const out = new THREE.Vector3(x, 0, z).normalize();
  const u = out.clone().addScaledVector(normal, -out.dot(normal)).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u);
  return { center: new THREE.Vector3(x, y, z), normal, u, v, along: ALONG, across: ACROSS, ding: false };
}

function reach(frame, point) {
  const dx = point.x - frame.center.x;
  const dy = point.y - frame.center.y;
  const dz = point.z - frame.center.z;
  const du = dx * frame.u.x + dy * frame.u.y + dz * frame.u.z;
  const dv = dx * frame.v.x + dy * frame.v.y + dz * frame.v.z;
  return Math.hypot(du / frame.along, dv / frame.across);
}

function domeGeometry(frames) {
  const RINGS = 64;
  const SPOKES = 192;
  const spots = [];
  const colors = [];
  const flat = [];
  const index = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= RINGS; i += 1) {
    const a = (i / RINGS) * (Math.PI / 2);
    const r = RADIUS * Math.sin(a);
    for (let j = 0; j <= SPOKES; j += 1) {
      const t = (j / SPOKES) * Math.PI * 2;
      point.set(r * Math.cos(t), DOME * Math.cos(a), r * Math.sin(t));
      flat.push(point.x / RADIUS, point.z / RADIUS);
      const rim = r / RADIUS;
      let red = 0.66 - rim * 0.24;
      let green = 0.42 - rim * 0.18;
      let blue = 0.2 - rim * 0.07;
      for (const frame of frames) {
        const e = reach(frame, point);
        if (e > 1.45) continue;
        const n = frame.normal;
        let lift = 0;
        let shade = 1;
        if (frame.ding) {
          const inside = e < 1 ? Math.cos((e * Math.PI) / 2) ** 2 : 0;
          lift = 0.1 * inside + 0.012 * Math.exp(-(((e - 1.08) / 0.07) ** 2));
          shade = 1 - 0.2 * smooth(1.05, 0.7, e) + 0.3 * Math.exp(-(((e - 1.08) / 0.06) ** 2));
        } else {
          const w = 1 - smooth(0.82, 1.16, e);
          const dx = point.x - frame.center.x;
          const dy = point.y - frame.center.y;
          const dz = point.z - frame.center.z;
          const off = dx * n.x + dy * n.y + dz * n.z;
          lift =
            -off * w -
            0.014 * w +
            0.016 * Math.exp(-(((e - 1.04) / 0.085) ** 2)) -
            0.034 * Math.exp(-((e / 0.24) ** 2));
          shade = 1 - 0.3 * w + 0.34 * Math.exp(-(((e - 1.04) / 0.07) ** 2));
        }
        point.addScaledVector(n, lift);
        red *= shade;
        green *= shade;
        blue *= shade;
      }
      spots.push(point.x, point.y, point.z);
      colors.push(red, green, blue);
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
  return geometry;
}

function bowlGeometry() {
  const points = [new THREE.Vector2(RADIUS, 0), new THREE.Vector2(RADIUS + 0.05, -0.035), new THREE.Vector2(RADIUS, -0.1)];
  for (let i = 1; i <= 20; i += 1) {
    const a = (i / 20) * (Math.PI / 2);
    points.push(new THREE.Vector2(0.3 + (RADIUS - 0.3) * Math.cos(a), -0.1 - 0.52 * Math.sin(a)));
  }
  return new THREE.LatheGeometry(points, 96);
}

function createDrum(host, onHit, onStrike) {
  let pendingFrames = 40;
  let inView = true;
  let lastFocused = "";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const canvas = renderer.domElement;
  canvas.className = "pan-3d";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  renderer.setClearColor(0x000000, 0);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const key = new THREE.DirectionalLight(0xffdcb0, 1.6);
  key.position.set(-3, 6, 2.5);
  const strike = new THREE.PointLight(BRASS, 0, 3.4, 1.5);
  scene.add(key, strike);

  const drum = new THREE.Group();
  scene.add(drum);
  const grain = grainTexture();
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 1,
    roughness: 0.62,
    roughnessMap: grain,
    bumpMap: grain,
    bumpScale: 0.014,
    clearcoat: 0.16,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.85,
  });
  const under = new THREE.MeshPhysicalMaterial({
    color: 0x7a4c28,
    metalness: 1,
    roughness: 0.34,
    roughnessMap: grain,
    envMapIntensity: 1.1,
  });
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS + 0.035, 0.026, 14, 160),
    new THREE.MeshStandardMaterial({ color: 0x5c3b20, metalness: 1, roughness: 0.26, emissive: BRASS, emissiveIntensity: 0 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.035;
  drum.add(new THREE.Mesh(bowlGeometry(), under), lip);
  let dome = null;

  const pedestal = new THREE.Group();
  const pedestalStone = new THREE.MeshStandardMaterial({ color: 0x4c5e5c, roughness: 0.82, metalness: 0.08, bumpMap: grain, bumpScale: 0.02 });
  const pedestalTrim = new THREE.MeshStandardMaterial({ color: 0xa68852, roughness: 0.46, metalness: 0.78 });
  for (const [radius, height, y, material] of [[2.15, 0.22, -0.92, pedestalStone], [2.22, 0.055, -0.79, pedestalTrim], [2.18, 0.055, -1.05, pedestalTrim]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 96), material);
    base.position.y = y;
    pedestal.add(base);
  }
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(2.13, 96), new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.58, metalness: 0.18 }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = -0.759;
  pedestal.add(inlay);
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
  line(2.09, 0.006, BRASS, 0.35, 0, Math.PI * 2);
  const dial = new THREE.Group();
  floor.add(dial);
  for (let k = 0; k < 24; k += 1) {
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(1.95, 2, 6, 1, (k / 24) * Math.PI * 2, 0.03),
      new THREE.MeshBasicMaterial({
        color: BRASS,
        transparent: true,
        opacity: k % 6 === 0 ? 0.8 : 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    dial.add(arc);
  }
  const wave = line(1.7, 0.03, BRASS, 0, 0, Math.PI * 2);
  let waveAt = 1;

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
    const frame = fieldFrame(spec.deg, spec.ding);
    const group = new THREE.Group();
    const lift = spec.ding ? 0.115 : 0.006;
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
    const tint = spec.hand === "left" ? "#f0bd68" : "#fbefe0";
    const plain = new THREE.SpriteMaterial({ map: labelTexture(spec.text, tint, true), depthTest: false, transparent: true });
    const dark = new THREE.SpriteMaterial({ map: labelTexture(spec.text, INK, false), depthTest: false, transparent: true });
    const label = new THREE.Sprite(plain);
    const size = spec.ding ? 0.56 : 0.4;
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
      label,
      plain,
      dark,
      pitch: Number(spec.text),
      spot: frame.center.clone().addScaledVector(frame.normal, 0.55),
      state: "idle",
      wave: 1,
      flash: 0,
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
      dome = new THREE.Mesh(domeGeometry(specs.map((spec) => fieldFrame(spec.deg, spec.ding))), metal);
      drum.add(dome);
    }
    for (const item of fields.values()) {
      for (const material of [item.plain, item.dark]) {
        material.map.dispose();
        material.dispose();
      }
      for (const part of [item.glow, item.ring, item.ripple, item.flare]) part.material.dispose();
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
    item.flash = 1;
    item.ripple.material.color.setHex(look.color);
    item.flare.material.color.setHex(look.color);
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

  function frame(time) {
    const active = document.activeElement;
    const target = active && active.closest && active.matches(":focus-visible") ? active.closest(".field") : null;
    const focused = target ? target.dataset.note : "";
    if (focused !== lastFocused) { pendingFrames = 40; lastFocused = focused; }
    if (!pendingFrames) return;
    pendingFrames -= 1;
    renderer.info.reset();
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
        item.wave = Math.min(1, item.wave + 0.03);
        const grow = 1 + item.wave * 1.9;
        item.ripple.scale.set(item.frame.along * grow, item.frame.across * grow, 1);
        item.ripple.material.opacity = (1 - item.wave) ** 2;
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
    lip.material.emissiveIntensity += ((tak ? 2 : 0) - lip.material.emissiveIntensity) * 0.3;
    const targetX = motionActive ? motionTarget.x : still ? 0 : tilt.y * 0.06;
    const targetY = motionActive ? motionTarget.y : 0;
    const targetZ = motionActive ? motionTarget.z : still ? 0 : -tilt.x * 0.06;
    drum.rotation.x += (targetX - drum.rotation.x) * 0.12;
    drum.rotation.y += (targetY - drum.rotation.y) * 0.12;
    drum.rotation.z += (targetZ - drum.rotation.z) * 0.12;
    halo.material.opacity = 0.28;
    if (profiling) host.dataset.rotation = JSON.stringify([drum.rotation.x, drum.rotation.y, drum.rotation.z]);
    renderer.render(scene, camera);
  }

  document.fonts.ready.then(() => layout(specs));
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
  scene.add(new THREE.HemisphereLight(0x9dbdd4, 0x322517, 2));
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
  const grain = grainTexture();
  const stoneCanvas = document.createElement("canvas");
  stoneCanvas.width = stoneCanvas.height = 256;
  const stonePen = stoneCanvas.getContext("2d");
  const pixels = stonePen.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const i = (y * 256 + x) * 4;
      const cloud = Math.sin(x * 0.08 + Math.sin(y * 0.05) * 2) * 6 + Math.sin(y * 0.12) * 4;
      const value = 188 + cloud + Math.random() * 22;
      pixels.data[i] = value;
      pixels.data[i + 1] = value - 9;
      pixels.data[i + 2] = value - 21;
      pixels.data[i + 3] = 255;
    }
  }
  stonePen.putImageData(pixels, 0, 0);
  const stoneMap = new THREE.CanvasTexture(stoneCanvas);
  stoneMap.colorSpace = THREE.SRGBColorSpace;
  const stone = new THREE.MeshStandardMaterial({ color: 0xa89b85, map: stoneMap, roughness: 0.94, bumpMap: grain, bumpScale: 0.04 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xc4b99d, map: stoneMap, roughness: 0.87, bumpMap: grain, bumpScale: 0.025 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x374749, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xa9874a, metalness: 0.75, roughness: 0.43 });
  const tile = new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.4, metalness: 0.15, color: 0xadc7c2 });
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
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }), pale);
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
  const runner = new THREE.MeshStandardMaterial({ map: runnerMap, roughness: 0.48, metalness: 0.18 });
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
  const spots = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    spots[i * 3] = Math.sin(i * 127.1) * 25;
    spots[i * 3 + 1] = (i % 31) / 2;
    spots[i * 3 + 2] = Math.cos(i * 311.7) * 26 - 13;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xf3d7a2, size: 0.035, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(dust);
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
    if (exploring) {
      camera.position.set(Math.sin(orbit) * 58, 23, Math.cos(orbit) * 58 - 12);
      camera.lookAt(-3, 7, -22);
    } else {
      camera.position.set(view.eye[0] + ease.x * 0.65, view.eye[1] - ease.y * 0.3, view.eye[2]);
      camera.lookAt(...view.target);
    }
    lamps.forEach(({ light, base, glass }, i) => {
      light.intensity = base * (1 + energy * 0.15);
      glass.emissiveIntensity = 2.1 + energy * 0.5;
    });
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
      if (!pendingFrames || time - last < 40) return;
      pendingFrames -= 1;
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
