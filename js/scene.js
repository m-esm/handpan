import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

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
  const RINGS = 120;
  const SPOKES = 320;
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
  return new THREE.LatheGeometry(points, 160);
}

function createDrum(host, onHit, onStrike) {
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
    roughness: 0.29,
    roughnessMap: grain,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.95,
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

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 7.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture([
        [0, "rgba(0,0,0,0.85)"],
        [0.45, "rgba(0,0,0,0.5)"],
        [1, "rgba(0,0,0,0)"],
      ]),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.66;
  scene.add(shadow);

  const floor = new THREE.Group();
  floor.position.y = -0.64;
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
  const halo = line(2.02, 0.016, TEAL, 0.55, 0, Math.PI * 2);
  line(2.3, 0.006, BRASS, 0.35, 0, Math.PI * 2);
  const dial = new THREE.Group();
  floor.add(dial);
  for (let k = 0; k < 24; k += 1) {
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(2.12, 2.17, 6, 1, (k / 24) * Math.PI * 2, 0.07),
      new THREE.MeshBasicMaterial({
        color: k % 6 === 0 ? BRASS : TEAL,
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
    specs = next;
    if (!dome && specs.length) {
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
    const width = host.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const back = 1.17 * Math.max(1, 1.3 / camera.aspect);
    camera.position.set(0, 5.3 * back, 4.3 * back);
    camera.lookAt(0, -0.12, 0.2);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  new ResizeObserver(resize).observe(host);
  resize();

  const ray = new THREE.Raycaster();
  const point = new THREE.Vector2();
  const tilt = new THREE.Vector2();
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
    canvas.style.cursor = noteAt(event) ? "pointer" : "default";
    const box = canvas.getBoundingClientRect();
    tilt.set((event.clientX - box.left) / box.width - 0.5, (event.clientY - box.top) / box.height - 0.5);
  });
  canvas.addEventListener("pointerleave", () => tilt.set(0, 0));

  const white = new THREE.Color(0xffffff);

  function frame(time) {
    const active = document.activeElement;
    const target = active && active.closest && active.matches(":focus-visible") ? active.closest(".field") : null;
    const focused = target ? target.dataset.note : "";
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
    }
    strike.intensity *= 0.88;
    if (waveAt < 1) {
      waveAt = Math.min(1, waveAt + 0.02);
      const grow = 1 + waveAt * 0.9;
      wave.scale.set(grow, grow, 1);
      wave.material.opacity = (1 - waveAt) ** 2 * 0.9;
    }
    lip.material.emissiveIntensity += ((tak ? 2 : 0) - lip.material.emissiveIntensity) * 0.3;
    if (!still) {
      drum.position.y = Math.sin(time / 1500) * 0.014;
      drum.rotation.z += (-tilt.x * 0.06 - drum.rotation.z) * 0.06;
      drum.rotation.x += (tilt.y * 0.06 - drum.rotation.x) * 0.06;
      dial.rotation.z = time / 9000;
      halo.material.opacity = 0.45 + Math.sin(time / 900) * 0.12;
    }
    renderer.render(scene, camera);
  }

  document.fonts.ready.then(() => layout(specs));

  return {
    layout,
    set,
    frame,
    setTak(on) {
      tak = on;
    },
    visible() {
      const box = canvas.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    },
  };
}

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int k = 0; k < 5; k++) {
    sum += amp * noise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}`;

function createWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "world";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080605, 0.022);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);

  const clock = { value: 0 };
  const flash = { value: 0 };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(140, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { time: clock, flash },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float time;
        uniform float flash;
        varying vec3 vDir;
        ${NOISE}
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float az = atan(d.x, -d.z);
          vec3 base = mix(vec3(0.045, 0.03, 0.024), vec3(0.008, 0.007, 0.01), smoothstep(-0.05, 0.55, h));
          float veil = fbm(vec2(az * 2.4 + time * 0.012, h * 6.0 - time * 0.02));
          float pick = fbm(vec2(az * 1.2 - time * 0.006, h * 2.5 + 7.0));
          vec3 copper = vec3(0.8, 0.36, 0.14);
          vec3 teal = vec3(0.12, 0.58, 0.52);
          vec3 tone = mix(copper, teal, smoothstep(0.38, 0.66, pick));
          float band = smoothstep(-0.02, 0.06, h) * exp(-h * 4.2);
          float curtain = pow(veil, 2.2) * band;
          float stars = step(0.9988, hash(floor(vec2(az * 220.0, h * 220.0)))) * smoothstep(0.1, 0.5, h);
          vec3 color = base + tone * curtain * (0.55 + flash * 0.5) + vec3(0.9, 0.85, 0.8) * stars * 0.5;
          gl_FragColor = vec4(color, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  const pulse = { value: 1 };
  const pulseColor = { value: new THREE.Color(BRASS) };
  const eye = { value: new THREE.Vector3() };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: { time: clock, pulse, pulseColor, eye },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float time;
        uniform float pulse;
        uniform vec3 pulseColor;
        uniform vec3 eye;
        varying vec3 vWorld;
        float grid(vec2 p, float size) {
          vec2 q = p / size;
          vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
          return 1.0 - min(min(g.x, g.y), 1.0);
        }
        void main() {
          vec2 p = vWorld.xz;
          float far = length(p - eye.xz);
          float fade = exp(-far * 0.038);
          vec3 brass = vec3(0.9, 0.62, 0.28);
          vec3 teal = vec3(0.2, 0.72, 0.62);
          float fine = grid(p, 1.0);
          float coarse = grid(p, 6.0);
          float sweep = 0.6 + 0.4 * sin(far * 0.35 - time * 0.9);
          vec3 color = vec3(0.012, 0.009, 0.008);
          color += teal * fine * 0.16 * sweep;
          color += brass * coarse * 0.55;
          float ring = length(p - vec2(0.0, -6.0));
          float front = smoothstep(1.6, 0.0, abs(ring - pulse * 46.0)) * (1.0 - pulse) * (1.0 - pulse);
          color += pulseColor * front * (0.25 + fine * 1.4 + coarse * 1.2);
          gl_FragColor = vec4(color * fade, 1.0);
        }`,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const pillars = Array.from({ length: 10 }, (_, k) => {
    const angle = ((-58.5 + k * 13) * Math.PI) / 180;
    const height = 5 + ((k * 7) % 4) * 1.7 + k * 0.3;
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, height, 0.2), material);
    mesh.position.set(Math.sin(angle) * 26, height / 2, -6 - Math.cos(angle) * 26);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05), material);
    cap.position.set(mesh.position.x, height + 0.4, mesh.position.z);
    cap.rotation.y = -angle;
    scene.add(mesh, cap);
    return { material, power: 0, tone: new THREE.Color(k % 2 ? CREAM : BRASS), rest: 0.07 + (k % 3) * 0.02 };
  });

  const rings = [
    { size: 10, color: BRASS, power: 1.1 },
    { size: 11.2, color: TEAL, power: 0.7 },
    { size: 13, color: BRASS, power: 0.35 },
  ].map((spec, i) => {
    const material = new THREE.MeshBasicMaterial({ fog: false });
    material.color.setHex(spec.color).multiplyScalar(spec.power);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.size, 0.035, 8, 200), material);
    ring.position.set(0, 8.5, -44);
    ring.rotation.y = i * 0.6;
    scene.add(ring);
    return ring;
  });

  const COUNT = 520;
  const spots = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    spots[i * 3] = (Math.random() - 0.5) * 60;
    spots[i * 3 + 1] = Math.random() * 14;
    spots[i * 3 + 2] = -Math.random() * 46 + 8;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const dustMaterial = new THREE.PointsMaterial({ size: 0.07, transparent: true, opacity: 0.8, depthWrite: false });
  dustMaterial.color.setHex(CREAM).multiplyScalar(0.8);
  scene.add(new THREE.Points(dustGeometry, dustMaterial));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.75, 0.32));
  composer.addPass(new OutputPass());

  const look = new THREE.Vector2();
  const ease = new THREE.Vector2();
  let tick = 0;

  function draw(time) {
    clock.value = time / 1000;
    ease.lerp(look, 0.05);
    camera.position.set(ease.x * 1.4, 2.7 - ease.y * 0.5 + Math.min(1.6, scrollY * 0.0008), 11);
    camera.lookAt(ease.x * 0.4, 3.2, -14);
    eye.value.copy(camera.position);
    for (const pillar of pillars) {
      pillar.power *= 0.95;
      pillar.material.color.copy(pillar.tone).multiplyScalar(pillar.rest + pillar.power * 2.6);
    }
    if (!still) {
      rings.forEach((ring, i) => {
        ring.rotation.y = time / (11000 + i * 4000) + i * 0.6;
        ring.rotation.x = Math.sin(time / (8000 + i * 2500)) * 0.3;
      });
      for (let i = 0; i < COUNT; i += 1) {
        const at = i * 3 + 1;
        spots[at] += 0.005 + (i % 5) * 0.0014;
        if (spots[at] > 14) spots[at] = 0;
      }
      dustGeometry.attributes.position.needsUpdate = true;
    }
    composer.render();
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    draw(performance.now());
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", (event) => {
    look.set(event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5);
  });
  resize();

  return {
    frame(time) {
      flash.value *= 0.93;
      pulse.value = Math.min(1, pulse.value + 0.012);
      tick += 1;
      if (tick % 2 === 0) draw(time);
    },
    strike(pitch, color) {
      flash.value = 1;
      pulse.value = 0;
      pulseColor.value.setHex(color);
      const pillar = pillars[pitch];
      if (pillar) {
        pillar.power = 1;
        pillar.tone.setHex(color);
      }
    },
    redraw() {
      draw(performance.now());
    },
  };
}

export function createStage({ pan, onHit }) {
  const world = createWorld();
  const drum = createDrum(pan, onHit, (pitch, color) => world.strike(pitch, color));

  function loop(time) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    if (drum.visible()) drum.frame(time);
    if (!still) world.frame(time);
  }

  requestAnimationFrame(loop);
  if (still) addEventListener("scroll", () => world.redraw(), { passive: true });

  return { layout: drum.layout, set: drum.set, setTak: drum.setTak };
}
