import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded, worldScale } from "./materials.js";

const SPINE_Z = -31;
const WATER_Y = -3.35;
const SOUTH_SLOPE = Math.tan((56 * Math.PI) / 180);
const NORTH_SLOPE = Math.tan((70 * Math.PI) / 180);
const TOP = [[-41, 6], [-37, 17], [-33, 21.5], [-29, 22.6], [-25, 23.8], [-22.5, 26.8], [-15, 27.5], [-9.5, 26.8], [-8.5, 25.1], [-2, 25.3], [4.5, 24.9], [6.5, 23.2], [8, 22.4], [9.5, 23.6], [12.5, 25], [15.5, 23.8], [18, 19], [21.5, 8]];
const WIDTH = [[-41, 0.3], [-37, 0.7], [-33, 1], [-25, 1.2], [-23, 2.8], [-18, 4.6], [-13, 4.8], [-9, 4.2], [-6, 3.8], [0, 3.7], [4.5, 3.9], [6.5, 2], [8, 1.8], [9.5, 2.7], [12.5, 3.3], [15.5, 2.4], [18, 1.2], [21.5, 0.3]];

const lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function value(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), sx), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), sx), sz);
}
function fbm(x, z, octaves = 4) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * value(x * frequency + i * 17.3, z * frequency - i * 9.1);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}
function piecewise(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    if (x <= points[i][0]) {
      const t = smooth((x - points[i - 1][0]) / (points[i][0] - points[i - 1][0]), 0, 1);
      return lerp(points[i - 1][1], points[i][1], t);
    }
  }
  return points.at(-1)[1];
}

const riverZ = (x) => 21 + Math.sin(x * 0.031) * 7 + Math.sin(x * 0.011 + 2) * 4;
const spineZ = (x) => SPINE_Z + Math.sin((x + 10) * 0.09) * 1.1 + (x < -25 ? (x + 25) * 0.14 : 0);

function ground(x, z) {
  const dz = z - riverZ(x);
  let y = -2.4;
  const north = Math.max(0, -dz);
  y += Math.pow(north / 44, 1.7) * 4.5;
  const south = Math.max(0, dz);
  y += Math.pow(south / 28, 1.7) * 9;
  y += (fbm(x * 0.022 + 5, z * 0.022) - 0.5) * 5 * smooth(Math.abs(dz), 6, 30);
  const back = Math.max(0, -(z + 42));
  y += Math.pow(back / 26, 1.5) * 13 + (fbm(x * 0.05, z * 0.05 + 9) - 0.5) * 4 * smooth(back, 0, 20);
  const hill = Math.hypot((x + 15) / 11, (z + 53) / 8.5);
  y += 9.5 * Math.max(0, 1 - hill * hill) ** 1.3;
  const ravine = Math.exp(-(((x - 23.5) / 4.2) ** 2)) * smooth(26 - Math.abs(z + 31), 0, 14);
  y -= 4.5 * ravine;
  const far = Math.max(0, x - 30);
  y += Math.pow(far / 30, 1.4) * 7 * smooth(26 - Math.abs(z + 31), 0, 14);
  y -= 2.3 * Math.exp(-((dz / 5.5) ** 2));
  const terraceMask = smooth(x, -64, -58) * (1 - smooth(x, -24, -18)) * smooth(-dz, 8, 13) * (1 - smooth(-dz, 36, 44));
  if (terraceMask > 0) y = lerp(y, Math.floor(y / 0.55) * 0.55 + 0.12, terraceMask);
  return y;
}
function terraceIndex(x, z) {
  const dz = z - riverZ(x);
  const mask = smooth(x, -64, -58) * (1 - smooth(x, -24, -18)) * smooth(-dz, 8, 13) * (1 - smooth(-dz, 36, 44));
  return mask > 0.5 ? Math.floor(ground(x, z) / 0.55) : -1;
}

function ridge(x, z) {
  const top = piecewise(TOP, x);
  const width = piecewise(WIDTH, x);
  const d = z - spineZ(x);
  const over = Math.max(0, Math.abs(d) - width);
  const onion = smooth(x, 8.5, 10) * (1 - smooth(x, 16, 18));
  const slope = d > 0 ? lerp(SOUTH_SLOPE, 0.95, onion) : lerp(NORTH_SLOPE, 1.1, onion);
  const round = over < 1.6 ? over * over / 1.6 : over - 0.8;
  const plain = top - round * slope;
  let h = plain;
  const sideness = smooth(over, 0, 1.4);
  h += Math.sin(x * 0.52 + d * 0.3) * Math.sin(x * 0.21 - 1) * 0.35 * sideness;
  h += (fbm(x * 0.28, z * 0.28) - 0.5) * 0.5 * sideness;
  const dip = (plain - d * 0.42 + x * 0.12) * 0.22;
  const ledge = dip - Math.floor(dip);
  h += smooth(ledge, 0.62, 0.92) * 0.42 * sideness;
  if (d > 0) {
    const level = h / top;
    const groove = smooth(level, 0.4, 0.45) * (1 - smooth(level, 0.5, 0.56)) * smooth(x, -25, -19) * (1 - smooth(x, 5, 9));
    h -= groove * 1.05;
  }
  return h;
}
function isRock(x, z) {
  return ridge(x, z) > ground(x, z) + 0.4;
}
export function heightAt(x, z) {
  return Math.max(ground(x, z), ridge(x, z));
}

function warpedPlane(segmentsX, segmentsZ, centre, spanX, spanZ, concentrate) {
  const geometry = new THREE.PlaneGeometry(1, 1, segmentsX, segmentsZ);
  geometry.rotateX(-Math.PI / 2);
  const points = geometry.attributes.position;
  const bend = (t, span) => {
    const s = Math.min(1, Math.abs(t) * 2);
    const g = concentrate * s + (1 - concentrate) * s ** 2.3;
    return Math.sign(t) * g * (t < 0 ? span[0] : span[1]);
  };
  for (let i = 0; i < points.count; i += 1) {
    points.setX(i, centre[0] + bend(points.getX(i), spanX));
    points.setZ(i, centre[1] + bend(points.getZ(i), spanZ));
  }
  return geometry;
}

export function createLandscape(textures) {
  const group = new THREE.Group();
  const random = seeded(71);
  const strata = textures("strata");
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, ...strata, normalScale: new THREE.Vector2(0.9, 0.9) });
  const steppeSet = textures("meadow");
  const steppe = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, ...steppeSet, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4d6e3c, roughness: 1, ...textures("foliage", [6, 7]), normalScale: new THREE.Vector2(1.4, 1.4) });
  const plaster = worldScale(new THREE.MeshStandardMaterial({ color: 0xd8c3a0, roughness: 1, ...textures("limestone"), normalScale: new THREE.Vector2(0.6, 0.6) }), 1.7);
  const rubble = worldScale(new THREE.MeshStandardMaterial({ color: 0xa27d66, roughness: 1, ...textures("ashlar"), normalScale: new THREE.Vector2(1, 1) }), 1.9);
  const mud = worldScale(new THREE.MeshStandardMaterial({ color: 0xb8926a, roughness: 1, ...textures("limestone"), normalScale: new THREE.Vector2(0.5, 0.5) }), 2.2);
  const turquoise = new THREE.MeshStandardMaterial({ color: 0x2f9d9a, roughness: 0.55, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1511, roughness: 1 });
  const ripples = textures("ripples", [2, 14]);
  const water = new THREE.MeshPhysicalMaterial({ color: 0x3f6b74, vertexColors: true, metalness: 0, roughness: 0.16, ...ripples, normalScale: new THREE.Vector2(0.6, 0.6), specularIntensity: 0.5, envMapIntensity: 0.9 });

  const mesh = (geometry, material, position = [0, 0, 0], rotation = 0) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(...position);
    item.rotation.y = rotation;
    item.receiveShadow = true;
    item.castShadow = geometry.type === "BoxGeometry" || geometry.type === "CylinderGeometry" || geometry.type === "SphereGeometry";
    group.add(item);
    return item;
  };

  const terrain = warpedPlane(250, 190, [-9, -31], [150, 150], [115, 105], 0.13);
  const terrainPoints = terrain.attributes.position;
  const terrainUv = terrain.attributes.uv;
  const seasonColours = new Float32Array(terrainPoints.count * 3);
  const snowColours = new Float32Array(terrainPoints.count * 3);
  const colour = new THREE.Color();
  const tintA = new THREE.Color();
  const tintB = new THREE.Color();
  for (let i = 0; i < terrainPoints.count; i += 1) {
    const x = terrainPoints.getX(i);
    const z = terrainPoints.getZ(i);
    const y = ground(x, z);
    terrainPoints.setY(i, y);
    terrainUv.setXY(i, x / 9, z / 9);
    const dz = z - riverZ(x);
    const wet = 1 - smooth(Math.abs(dz), 6, 16);
    const high = smooth(y, 1, 9);
    const far = smooth(-(z + 40), 0, 30);
    const streak = fbm(x * 0.03 + 1, z * 0.03 + 7, 3);
    const grain = fbm(x * 0.6, z * 0.6, 3);
    tintA.setHex(0xa8977a).lerp(tintB.setHex(0xbcae8e), grain);
    if (streak > 0.56) tintA.lerp(tintB.setHex(0xa98a92), (streak - 0.56) * 3);
    if (streak < 0.42) tintA.lerp(tintB.setHex(0xa97d64), (0.42 - streak) * 3);
    if (hash(Math.floor(x * 1.7), Math.floor(z * 1.7)) > 0.62) tintA.lerp(tintB.setHex(0x8e9d7a), 0.4);
    colour.copy(tintA);
    colour.lerp(tintB.setHex(0x6c8f44), wet * 0.85);
    colour.lerp(tintB.setHex(0x7f8c74), high * far * 0.5);
    const terrace = terraceIndex(x, z);
    if (terrace >= 0) {
      const crop = terrace % 3;
      colour.setHex(crop === 0 ? 0xc8ab5e : crop === 1 ? 0x86a04a : 0xa98f66).lerp(tintB.setHex(0xffffff), (grain - 0.5) * 0.2);
    }
    if (Math.abs(dz) < 5) colour.setHex(0x9c9484).lerp(tintB.setHex(0x6c8f44), smooth(Math.abs(dz), 3.2, 5));
    colour.multiplyScalar(1.1);
    seasonColours.set([colour.r, colour.g, colour.b], i * 3);
    const snow = smooth(y, -1.5, 3) * (0.75 + grain * 0.25);
    colour.lerp(tintB.setHex(0xe9eef2), snow);
    if (Math.abs(dz) < 5) colour.setHex(0xb6b9b4);
    snowColours.set([colour.r, colour.g, colour.b], i * 3);
  }
  terrain.setAttribute("color", new THREE.Float32BufferAttribute(seasonColours, 3));
  terrain.computeVertexNormals();
  const land = mesh(terrain, steppe);
  land.castShadow = false;

  const rock = new THREE.PlaneGeometry(1, 1, 200, 120);
  rock.rotateX(-Math.PI / 2);
  const rockPoints = rock.attributes.position;
  const rockUv = rock.attributes.uv;
  const rockSeason = new Float32Array(rockPoints.count * 3);
  const rockSnow = new Float32Array(rockPoints.count * 3);
  for (let i = 0; i < rockPoints.count; i += 1) {
    const x = -9 + rockPoints.getX(i) * 70;
    const z = -31 + rockPoints.getZ(i) * 46;
    const floor = ground(x, z);
    const h = ridge(x, z);
    const y = Math.max(h, floor - 0.7);
    rockPoints.setXYZ(i, x, y, z);
    const d = z - spineZ(x);
    rockUv.setXY(i, x / 11 + z / 30, (y - d * 0.42 + x * 0.12) / 11);
    const band = fbm((y - d * 0.42 + x * 0.12) * 0.3, x * 0.06, 3);
    const grit = fbm(x * 0.9, z * 0.9, 2);
    tintA.setHex(0x87685a).lerp(tintB.setHex(0x7f7876), smooth(band, 0.4, 0.62));
    tintA.lerp(tintB.setHex(0xa98b80), Math.max(0, grit - 0.58) * 1.4);
    const top = piecewise(TOP, x);
    const summit = smooth(y, top - 0.9, top - 0.15) * (1 - smooth(Math.abs(d), piecewise(WIDTH, x) - 0.4, piecewise(WIDTH, x) + 0.6));
    tintA.lerp(tintB.setHex(0x8f8a62), summit * 0.75);
    if (d > 0) {
      const level = h / top;
      const groove = smooth(level, 0.4, 0.45) * (1 - smooth(level, 0.5, 0.56)) * smooth(x, -25, -19) * (1 - smooth(x, 5, 9));
      tintA.lerp(tintB.setHex(0x3c3230), groove * 0.8);
    }
    if (h < floor + 0.6) tintA.lerp(tintB.setHex(0xa8977a), 0.7);
    rockSeason.set([tintA.r, tintA.g, tintA.b], i * 3);
    const ledgeSnow = smooth(1 - Math.min(1, Math.abs(h - ridge(x, z + 0.4)) / 0.4), 0.35, 0.9);
    tintA.lerp(tintB.setHex(0xe9eef2), Math.max(summit, ledgeSnow * 0.8) * 0.9);
    rockSnow.set([tintA.r, tintA.g, tintA.b], i * 3);
  }
  rock.setAttribute("color", new THREE.Float32BufferAttribute(rockSeason, 3));
  rock.computeVertexNormals();
  const crag = mesh(rock, rockMaterial);
  crag.castShadow = true;

  const ranges = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, ...textures("strata"), normalScale: new THREE.Vector2(2, 2) });
  const rangeSeason = [];
  const rangeSnow = [];
  for (let layer = 0; layer < 4; layer += 1) {
    const geometry = new THREE.PlaneGeometry(300, 70, 240, 56);
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const season = [];
    const snow = [];
    for (let i = 0; i < vertices.count; i += 1) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      const curve = Math.abs(x) * 0.09 * (1 - layer * 0.15);
      const spine = Math.max(0, 1 - Math.abs(z + Math.sin(x * 0.07) * 7) / 36);
      const ridges = Math.abs(Math.sin(x * 0.27 + z * 0.15 + layer)) * 2 + Math.abs(Math.sin(x * 0.8 - z * 0.4)) * 0.7;
      const peak = (fbm(x * 0.04 + layer * 13, z * 0.04, 3) - 0.3) * 18;
      const height = Math.pow(spine, 1.35) * (18 + layer * 9 + curve + peak + ridges);
      vertices.setY(i, height - 5);
      uv.setXY(i, x / 20 + layer * 0.37, height / 10);
      const streak = fbm(x * 0.05 + layer, z * 0.05, 3);
      tintA.setHex(layer === 0 ? 0xa88a6a : layer === 1 ? 0x9b8a86 : 0x8a8d98).lerp(tintB.setHex(layer === 0 ? 0xb0795c : 0xa99aa3), smooth(streak, 0.45, 0.65));
      tintA.multiplyScalar(0.85 + fbm(x * 0.2, z * 0.2, 2) * 0.25);
      const snowline = 20 + layer * 4 + fbm(x * 0.3, z * 0.3, 2) * 4;
      const cap = layer === 0 ? 0 : smooth(height, snowline - 2, snowline + 2);
      tintB.setHex(0xe6ecef);
      season.push(...colour.copy(tintA).lerp(tintB, cap).toArray());
      snow.push(...colour.copy(tintA).lerp(tintB, Math.max(cap, smooth(height, 4, 12))).toArray());
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(season, 3));
    geometry.computeVertexNormals();
    rangeSeason.push(new Float32Array(season));
    rangeSnow.push(new Float32Array(snow));
    mesh(geometry, ranges, [0, 0, -70 - layer * 27]).userData.layer = layer;
  }

  const riverSteps = 150;
  const riverGeometry = new THREE.PlaneGeometry(1, 1, riverSteps, 1);
  const riverPoints = riverGeometry.attributes.position;
  const riverColours = [];
  for (let i = 0; i < riverPoints.count; i += 1) {
    const x = -160 + (riverPoints.getX(i) + 0.5) * 320;
    const side = riverPoints.getY(i) > 0 ? 1 : -1;
    const half = 4.6 + Math.sin(x * 0.07) * 1.1 + Math.sin(x * 0.19) * 0.5;
    riverPoints.setXYZ(i, x, WATER_Y, riverZ(x) + side * half);
    const shallow = 0.5 + Math.sin(x * 0.11 + side) * 0.35;
    riverColours.push(1 + shallow * 0.9, 1 + shallow * 1, 1 + shallow * 0.6);
  }
  riverGeometry.setAttribute("color", new THREE.Float32BufferAttribute(riverColours, 3));
  riverGeometry.computeVertexNormals();
  const river = mesh(riverGeometry, water);
  river.userData.keepSeparate = true;
  river.castShadow = false;

  const bar = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0xaaa394, roughness: 1 }), 26);
  const matrix = new THREE.Matrix4();
  const spin = new THREE.Quaternion();
  const unit = new THREE.Quaternion();
  for (let i = 0; i < 26; i += 1) {
    const x = -90 + i * 7 + random() * 4;
    matrix.compose(new THREE.Vector3(x, WATER_Y - 0.35, riverZ(x) + (random() - 0.5) * 3), unit, new THREE.Vector3(2 + random() * 2.5, 0.5, 0.9 + random() * 0.8));
    bar.setMatrixAt(i, matrix);
  }
  bar.receiveShadow = true;
  group.add(bar);

  const topAt = (x, z) => ridge(x, z);
  const block = (x, z, w, h, d, material = plaster, lift = 0, rotation = 0) => mesh(new THREE.BoxGeometry(w, h, d), material, [x, topAt(x, z) + lift + h / 2, z], rotation);
  const tower = (x, z, radius, height, material = rubble) => {
    const base = topAt(x, z);
    const drum = mesh(new THREE.CylinderGeometry(radius * 0.92, radius, height, 20), material, [x, base + height / 2 - 0.3, z]);
    mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 0.92, 0.35, 20), plaster, [x, base + height - 0.3, z]);
    for (let k = 0; k < 8; k += 1) {
      const angle = (k / 8) * Math.PI * 2;
      mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), material, [x + Math.cos(angle) * radius * 0.9, base + height - 0.1, z + Math.sin(angle) * radius * 0.9]);
    }
    return drum;
  };
  const wallAlong = (x0, x1, side, height, thickness = 0.5, inset = 0.25, material = plaster) => {
    const steps = Math.max(2, Math.round((x1 - x0) / 1.6));
    for (let k = 0; k < steps; k += 1) {
      const a = x0 + (k / steps) * (x1 - x0);
      const b = x0 + ((k + 1) / steps) * (x1 - x0);
      const xm = (a + b) / 2;
      const z = spineZ(xm) + side * (piecewise(WIDTH, xm) - inset);
      const angle = -Math.atan2(spineZ(b) + side * (piecewise(WIDTH, b) - inset) - (spineZ(a) + side * (piecewise(WIDTH, a) - inset)), b - a);
      const length = Math.hypot(b - a, 0.4) + 0.08;
      block(xm, z, length, height, thickness, material, -0.25, angle);
      for (let m = -1; m <= 1; m += 1) block(xm + Math.cos(angle) * m * 0.5, z - Math.sin(angle) * m * 0.5, 0.3, 0.3, thickness + 0.04, material, height - 0.25, angle);
    }
  };
  const wallAcross = (x, z0, z1, height, thickness = 0.6, material = plaster) => {
    const zm = (z0 + z1) / 2;
    block(x, zm, thickness, height, Math.abs(z1 - z0), material, -0.3);
    for (let z = Math.min(z0, z1) + 0.3; z < Math.max(z0, z1); z += 0.6) block(x, z, thickness + 0.04, 0.32, 0.3, material, height - 0.3);
  };
  const opening = (x, z, w, h, d, rotation = 0) => mesh(new THREE.BoxGeometry(w, h, d), dark, [x, topAt(x, z) + h / 2 - 0.05, z], rotation);

  wallAlong(-24.5, -9.5, 1, 2.2);
  wallAlong(-24.5, -9.5, -1, 2.2);
  wallAlong(-33, -25, 1, 0.5, 0.35, 0.15, rubble);
  wallAlong(-33, -25, -1, 0.5, 0.35, 0.15, rubble);
  block(-29.5, spineZ(-29.5) - 1.05, 1.1, 1.1, 1.1, rubble, -0.6);
  tower(-24.8, spineZ(-24.8), 0.85, 3.1);
  tower(-16, spineZ(-16) - piecewise(WIDTH, -16) + 0.3, 0.75, 2.9);
  tower(-21, spineZ(-21) + piecewise(WIDTH, -21) - 0.4, 0.9, 3.2);
  wallAcross(-9.4, spineZ(-9.4) - piecewise(WIDTH, -9.4) + 0.2, spineZ(-9.4) + piecewise(WIDTH, -9.4) - 0.2, 2.6, 0.7);
  tower(-9.2, spineZ(-9.2) - piecewise(WIDTH, -9.2) + 0.9, 0.8, 3.4);
  opening(-9.4, spineZ(-9.4) + 1.6, 0.85, 1.3, 0.9);
  block(-14.5, spineZ(-14.5) + 0.4, 4.2, 1.9, 3.2);
  const drum = mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.5, 24), plaster, [-14.5, topAt(-14.5, spineZ(-14.5) + 0.4) + 2.15, spineZ(-14.5) + 0.4]);
  mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 24), turquoise, [-14.5, drum.position.y + 0.3, spineZ(-14.5) + 0.4]);
  const dome = mesh(new THREE.SphereGeometry(1.45, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), plaster, [-14.5, drum.position.y + 0.33, spineZ(-14.5) + 0.4]);
  dome.castShadow = true;
  block(-19.5, spineZ(-19.5) - 1.6, 4.6, 2.3, 2.1);
  block(-19.5, spineZ(-19.5) - 1.6, 4.8, 0.22, 2.3, rubble, 2.3);
  block(-12, spineZ(-12) - 2.2, 2.4, 2.4, 2.2);
  for (const dz of [-0.6, 0, 0.6]) opening(-10.78, spineZ(-12) - 2.2 + dz, 0.1, 0.5, 0.22);
  block(-21.5, spineZ(-21.5) + 2.6, 5.2, 1.1, 1.3);
  block(-15.5, spineZ(-15.5) + 3.4, 6, 1.05, 1.1);
  block(-17.5, spineZ(-17.5) - 3.6, 5, 1.2, 1.2);
  block(-13, spineZ(-13) + 1.6, 1.4, 0.08, 1.2, dark, 0.02);
  block(-17.8, spineZ(-17.8) + 0.6, 1.1, 0.08, 1.8, dark, 0.02);

  wallAlong(-8.5, 5.5, 1, 1.3, 0.45);
  wallAlong(-8.5, 5.5, -1, 1.3, 0.45);
  wallAcross(-1.5, spineZ(-1.5) - piecewise(WIDTH, -1.5) + 0.4, spineZ(-1.5) + piecewise(WIDTH, -1.5) - 0.4, 1.1, 0.45);
  block(1.6, spineZ(1.6) - 1.4, 5, 1.9, 1.7);
  block(1.6, spineZ(1.6) - 1.4, 5.2, 0.2, 1.9, rubble, 1.9);
  block(2.4, spineZ(2.4) + 1.9, 3.6, 1.2, 1.5);
  for (const dx of [-0.9, 0.4, 1.7]) block(3 + dx, spineZ(3) + 0.3, 0.9, 0.08, 0.7, dark, 0.02);
  wallAcross(6, spineZ(6) - piecewise(WIDTH, 6) - 0.3, spineZ(6) + piecewise(WIDTH, 6) + 0.1, 3.8, 0.85, rubble);
  tower(6.1, spineZ(6.1) - piecewise(WIDTH, 6.1) - 0.4, 0.95, 4.4);
  tower(6.1, spineZ(6.1) + piecewise(WIDTH, 6.1), 0.95, 4.4);
  opening(6.1, spineZ(6.1) - piecewise(WIDTH, 6.1) + 0.75, 1, 1.25, 0.8);
  block(7.4, spineZ(7.4) - 1.4, 1.6, 0.9, 1.4, rubble, 0.05);
  block(12.5, spineZ(12.5) + 0.4, 3.4, 1, 1.6, rubble, -0.1);
  block(12.5, spineZ(12.5) - 1.9, 2.6, 0.9, 1.1, rubble, -0.1);
  opening(10.4, spineZ(10.4) + 2.6, 0.9, 1.1, 0.7);
  opening(10.4, spineZ(10.4) - 2.5, 0.9, 1.1, 0.7);
  for (const [x, dz] of [[14.6, 2.1], [15.6, 0.3], [15.2, -1.6]]) block(x, spineZ(x) + dz, 1.1, 0.5, 1, rubble, -0.1);
  for (const x of [-27.5, -26.2]) mesh(new THREE.BoxGeometry(0.9, 0.7, 0.5), dark, [x, ridge(x, spineZ(x) + 1.3) - 3.4, spineZ(x) + 1.3 + 3.4 / SOUTH_SLOPE + 0.7]);
  const guard = spineZ(-4) + piecewise(WIDTH, -4) + 2.2;
  mesh(new THREE.BoxGeometry(1.1, 0.8, 0.6), dark, [-4, ridge(-4, guard) + 0.2, guard]);

  const channel = new THREE.PlaneGeometry(1, 1, 60, 1);
  const channelPoints = channel.attributes.position;
  for (let i = 0; i < channelPoints.count; i += 1) {
    const x = -22 + (channelPoints.getX(i) + 0.5) * 29;
    const side = channelPoints.getY(i) > 0 ? 0.05 : 0.55;
    const top = piecewise(TOP, x);
    const level = top * 0.46;
    const z = spineZ(x) + piecewise(WIDTH, x) + (top - level) / SOUTH_SLOPE + 0.55 + side;
    channelPoints.setXYZ(i, x, ridge(x, z) + 0.12, z);
  }
  channel.computeVertexNormals();
  const still = new THREE.MeshStandardMaterial({ color: 0x1f2d33, roughness: 0.25, metalness: 0 });
  const qanat = mesh(channel, still);
  qanat.castShadow = false;

  const house = (x, z, w, h, d, rotation) => {
    const y = ground(x, z);
    block(x, z, w, h, d, mud, y - topAt(x, z) - 0.35, rotation);
    block(x, z, w + 0.1, 0.12, d + 0.1, rubble, y - topAt(x, z) - 0.35 + h, rotation);
  };
  const village = (cx, cz, count, spread) => {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * spread;
      const x = cx + Math.cos(angle) * r;
      const z = cz + Math.sin(angle) * r * 0.6;
      if (isRock(x, z) || Math.abs(z - riverZ(x)) < 9) continue;
      house(x, z, 1.2 + random() * 1.3, 0.8 + random() * 0.7, 1.1 + random() * 1.1, random() * 0.6 - 0.3);
    }
  };
  village(-43, -9, 44, 9);
  village(22, 0, 16, 5.5);
  const planeTree = (x, z, size) => {
    const y = ground(x, z);
    mesh(new THREE.CylinderGeometry(0.16 * size, 0.24 * size, 1.3 * size, 10), rubble, [x, y + 0.6 * size, z]);
    const canopy = mesh(lump(mergeVertices(new THREE.IcosahedronGeometry(1, 3)), 0.2, 2.2), leaf, [x, y + 1.9 * size, z]);
    canopy.scale.set(size * 1.5, size * 1.1, size * 1.5);
    canopy.castShadow = true;
  };
  function lump(geometry, amount, seedShift) {
    const points = geometry.attributes.position;
    for (let i = 0; i < points.count; i += 1) {
      const x = points.getX(i);
      const y = points.getY(i);
      const z = points.getZ(i);
      const k = 1 + Math.sin(x * 3.1 + seedShift) * Math.sin(y * 2.7 - seedShift) * Math.sin(z * 3.4 + 1) * amount + Math.sin(x * 9 + y * 7 + z * 8) * amount * 0.25;
      points.setXYZ(i, x * k, y * k, z * k);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  planeTree(-41, -7.5, 1.6);
  planeTree(22.5, -1, 1.1);

  const poplarCrown = new THREE.SphereGeometry(1, 10, 14);
  const poplarCount = 220;
  const poplars = new THREE.InstancedMesh(poplarCrown, leaf, poplarCount);
  const bark = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 1, ...textures("bark", [2, 3]) });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.1, 1, 8), bark, poplarCount);
  poplars.castShadow = true;
  poplars.receiveShadow = true;
  trunks.castShadow = true;
  const poplarSeason = [];
  let placed = 0;
  const poplar = (x, z) => {
    if (placed >= poplarCount || isRock(x, z) || Math.abs(z - riverZ(x)) < 5.6) return;
    const y = ground(x, z);
    const height = 2.6 + random() * 1.8;
    const width = 0.28 + random() * 0.1;
    spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 6.3);
    matrix.compose(new THREE.Vector3(x, y + height * 0.62 + 0.3, z), spin, new THREE.Vector3(width * height, height * 0.62, width * height));
    poplars.setMatrixAt(placed, matrix);
    const tone = new THREE.Color().setHSL(0.22 + random() * 0.04, 0.42, 0.52 + random() * 0.14);
    poplars.setColorAt(placed, tone);
    poplarSeason.push(tone);
    matrix.compose(new THREE.Vector3(x, y + 0.5, z), unit, new THREE.Vector3(1, 1.4, 1));
    trunks.setMatrixAt(placed, matrix);
    placed += 1;
  };
  for (let x = -110; x < 100; x += 2.3 + random() * 1.6) {
    for (const side of [-1, 1]) {
      if (random() < 0.3) continue;
      poplar(x + random(), riverZ(x) + side * (6.4 + random() * 2.2));
    }
  }
  for (let i = 0; i < 26; i += 1) poplar(-52 + i * 0.9 + random() * 0.5, -1 - i * 0.55 + random());
  for (let i = 0; i < 22; i += 1) poplar(-36 + random() * 3 - i * 0.2, -16 + i * 1.15 + random() * 0.6);
  for (let i = 0; i < 18; i += 1) poplar(14 + i * 1.1 + random(), 5 + random() * 1.5);
  for (let i = 0; i < 20; i += 1) poplar(-60 + random() * 30, -4 + random() * 10);
  poplars.count = placed;
  trunks.count = placed;

  const shrub = new THREE.InstancedMesh(lump(mergeVertices(new THREE.IcosahedronGeometry(1, 2)), 0.3, 1.1), leaf, 160);
  shrub.castShadow = true;
  shrub.receiveShadow = true;
  let shrubs = 0;
  for (let i = 0; i < 3000 && shrubs < 160; i += 1) {
    const x = (random() - 0.5) * 150 - 10;
    const z = -70 + random() * 85;
    if (isRock(x, z) || Math.abs(z - riverZ(x)) < 7 || terraceIndex(x, z) >= 0) continue;
    const size = 0.35 + random() ** 2 * 0.7;
    spin.setFromEuler(new THREE.Euler(0, random() * 6.3, 0));
    matrix.compose(new THREE.Vector3(x, ground(x, z) + size * 0.55, z), spin, new THREE.Vector3(size * (1 + random() * 0.5), size * 0.8, size));
    shrub.setMatrixAt(shrubs, matrix);
    shrub.setColorAt(shrubs, new THREE.Color().setHSL(0.24 + random() * 0.05, 0.22, 0.38 + random() * 0.1));
    shrubs += 1;
  }
  shrub.count = shrubs;

  const scree = new THREE.MeshStandardMaterial({ color: 0x96705c, roughness: 1, ...textures("strata", [2, 1]), normalScale: new THREE.Vector2(1.6, 1.6) });
  const stones = new THREE.InstancedMesh(lump(new THREE.IcosahedronGeometry(1, 2), 0.3, 4.1), scree, 48);
  stones.castShadow = true;
  stones.receiveShadow = true;
  let placedStones = 0;
  for (let i = 0; i < 3000 && placedStones < 48; i += 1) {
    const x = -40 + random() * 66;
    const z = spineZ(x) + (random() < 0.7 ? 1 : -1) * (piecewise(WIDTH, x) + 4 + random() * 14);
    if (isRock(x, z) || Math.abs(z - riverZ(x)) < 8) continue;
    const size = 0.35 + random() ** 2 * 1.6;
    spin.setFromEuler(new THREE.Euler(random() * 0.6, random() * 6.3, random() * 0.6));
    matrix.compose(new THREE.Vector3(x, ground(x, z) + size * 0.3, z), spin, new THREE.Vector3(size * (1 + random() * 0.6), size * 0.7, size));
    stones.setMatrixAt(placedStones, matrix);
    placedStones += 1;
  }
  stones.count = placedStones;
  group.add(poplars, trunks, shrub, stones);

  const sun = mesh(new THREE.SphereGeometry(2, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffd29a, fog: false }), [35, 31, -100]);
  sun.castShadow = false;
  const swapColours = (snowy) => {
    terrain.setAttribute("color", new THREE.Float32BufferAttribute(snowy ? snowColours : seasonColours, 3));
    rock.setAttribute("color", new THREE.Float32BufferAttribute(snowy ? rockSnow : rockSeason, 3));
    group.traverse((item) => {
      if (item.userData.layer !== undefined) item.geometry.setAttribute("color", new THREE.Float32BufferAttribute((snowy ? rangeSnow : rangeSeason)[item.userData.layer], 3));
    });
    for (let i = 0; i < placed; i += 1) poplars.setColorAt(i, snowy ? colour.setHex(0x9b8f80) : poplarSeason[i]);
    poplars.instanceColor.needsUpdate = true;
  };
  return {
    group,
    sun,
    heightAt,
    update(seconds) {
      ripples.normalMap.offset.set(seconds * 0.004, seconds * 0.011);
    },
    set(key) {
      const cold = key === "winter";
      swapColours(cold);
      steppe.color.setHex(cold ? 0xf2f4f6 : key === "valley" ? 0xf6f3e6 : key === "dawn" ? 0xf6dcc0 : key === "storm" ? 0xcfd3d0 : 0xd8dde6);
      rockMaterial.color.setHex(cold ? 0xe8e9ec : key === "dawn" ? 0xecd5c3 : key === "storm" ? 0xc8c8c8 : key === "lake" ? 0xc9d4e6 : 0xece8e2);
      ranges.color.setHex(cold ? 0xffffff : key === "dawn" ? 0xffd2b8 : key === "lake" ? 0xb8c4dc : 0xf2eee8);
      scree.color.copy(rockMaterial.color).multiplyScalar(0.62);
      leaf.color.setHex(cold ? 0x8a8378 : key === "dawn" ? 0x6a7a3a : key === "storm" ? 0x3f5a38 : key === "lake" ? 0x3d5a4a : 0x4d6e3c);
      plaster.color.setHex(cold ? 0xe6e2da : key === "dawn" ? 0xf0c79a : 0xd8c3a0);
      mud.color.setHex(cold ? 0xd9cfbf : 0xb8926a);
      water.color.setHex(key === "lake" ? 0x12263a : cold ? 0x4a5d66 : key === "storm" ? 0x3f4d52 : 0x3f6b74);
      sun.visible = key !== "storm" && key !== "winter";
      sun.material.color.setHex(key === "lake" || cold ? 0xe1edfa : 0xffd29a);
      sun.position.x = key === "lake" ? -25 : 35;
    },
  };
}
