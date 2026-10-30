import * as THREE from "three";
import { worldScale } from "./materials.js";

export function createLandscape(textures) {
  const group = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: 0x80634e, roughness: 1, ...textures("strata", [10, 2.4]), normalScale: new THREE.Vector2(1.4, 1.4) });
  const meadowSet = textures("meadow");
  const meadow = new THREE.MeshStandardMaterial({ color: 0x5b7141, vertexColors: true, ...meadowSet, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1 });
  const grass = worldScale(new THREE.MeshStandardMaterial({ color: 0x5b7141, ...meadowSet, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1 }), 7);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x304b32, roughness: 1, ...textures("foliage", [6, 7]), normalScale: new THREE.Vector2(1.6, 1.6) });
  const stone = worldScale(new THREE.MeshStandardMaterial({ color: 0xd2c2aa, roughness: 1, ...textures("ashlar"), normalScale: new THREE.Vector2(0.8, 0.8) }), 2.6);
  const ripples = textures("ripples", [3, 10]);
  const water = new THREE.MeshPhysicalMaterial({ color: 0x315d6b, metalness: 0, roughness: 0.14, ...ripples, normalScale: new THREE.Vector2(0.7, 0.7), specularIntensity: 0.5, envMapIntensity: 0.9 });
  const mesh = (geometry, material, position, scale = [1, 1, 1]) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(...position);
    item.scale.set(...scale);
    item.receiveShadow = true;
    item.castShadow = geometry.type === "BoxGeometry" || geometry.type === "CylinderGeometry";
    group.add(item);
    return item;
  };
  const block = (x, y, z, w, h, d) => mesh(new THREE.BoxGeometry(w, h, d), stone, [x, y, z]);
  const noise = (x, z) => Math.sin(x * 0.19 + Math.sin(z * 0.11) * 2) * 0.45 + Math.sin(x * 0.47 + z * 0.29) * 0.22 + Math.cos(x * 1.13 - z * 0.61) * 0.1;
  const ranges = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, ...textures("strata"), normalScale: new THREE.Vector2(2.2, 2.2) });
  for (let layer = 0; layer < 4; layer += 1) {
    const geometry = new THREE.PlaneGeometry(260, 65, 260, 65);
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const colors = [];
    for (let i = 0; i < vertices.count; i += 1) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      const spine = Math.max(0, 1 - Math.abs(z + Math.sin(x * 0.08) * 8) / 34);
      const ridges = Math.abs(Math.sin(x * 0.31 + z * 0.17 + layer)) * 1.6 + Math.abs(Math.sin(x * 0.9 - z * 0.4)) * 0.6;
      const height = Math.pow(spine, 1.4) * (22 + layer * 7 + noise(x + layer * 43, z) * 16 + ridges);
      vertices.setY(i, height - 4);
      uv.setXY(i, x / 22 + layer * 0.37, height / 11 + noise(x * 0.5, z) * 0.15);
      const snowline = 23 + layer * 5 + noise(x * 3, z * 2) * 2.5;
      const snow = THREE.MathUtils.smoothstep(height, snowline - 1.5, snowline + 1.5);
      const tint = new THREE.Color(layer ? 0x7b8c94 : 0x968273).lerp(new THREE.Color(0xe4ecee), snow);
      tint.multiplyScalar(0.84 + noise(x, z) * 0.15);
      colors.push(tint.r, tint.g, tint.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    mesh(geometry, ranges, [0, 0, -64 - layer * 27]);
  }
  const ground = new THREE.PlaneGeometry(300, 250, 150, 125);
  const groundPoints = ground.attributes.position;
  const groundColors = [];
  for (let i = 0; i < groundPoints.count; i += 1) {
    const x = groundPoints.getX(i);
    const y = groundPoints.getY(i);
    const shade = new THREE.Color().setHSL(0.17 + noise(x * 0.9, y * 0.7) * 0.07, 0.3 + noise(y * 1.3, x * 0.8) * 0.18, 0.6 + noise(x * 2.1, y * 1.7) * 0.2 + noise(x * 5.3, y * 4.1) * 0.08);
    groundColors.push(shade.r * 1.25, shade.g * 1.25, shade.b * 1.25);
  }
  ground.setAttribute("color", new THREE.Float32BufferAttribute(groundColors, 3));
  const groundUv = ground.attributes.uv;
  for (let i = 0; i < groundUv.count; i += 1) groundUv.setXY(i, groundUv.getX(i) * 300 / 7, groundUv.getY(i) * 250 / 7);
  mesh(ground, meadow, [0, -1.8, -45]).rotation.x = -Math.PI / 2;
  const waterGeometry = new THREE.PlaneGeometry(31, 110, 36, 96);
  const waterPoints = waterGeometry.attributes.position;
  for (let i = 0; i < waterPoints.count; i += 1) {
    const y = waterPoints.getY(i);
    waterPoints.setX(i, waterPoints.getX(i) * (0.65 + Math.cos(y * 0.055) * 0.18) + Math.sin(y * 0.04) * 6);
  }
  const lake = mesh(waterGeometry, water, [4, -1.62, 2]);
  lake.rotation.x = -Math.PI / 2;
  lake.userData.keepSeparate = true;
  const cliff = new THREE.CylinderGeometry(8, 14, 20, 128, 48);
  const cliffPoints = cliff.attributes.position;
  for (let i = 0; i < cliffPoints.count; i += 1) {
    const x = cliffPoints.getX(i);
    const y = cliffPoints.getY(i);
    const z = cliffPoints.getZ(i);
    const ledge = Math.round(y * 0.6) / 0.6 - y;
    const erosion = 1 + noise(x * 2, z * 2 + y * 0.4) * 0.12 + Math.sin(y * 2.4 + x * 0.8) * 0.02 + ledge * 0.035 + noise(z * 5, y * 3) * 0.03;
    cliffPoints.setXYZ(i, x * erosion, y, z * erosion);
  }
  cliff.computeVertexNormals();
  mesh(cliff, rock, [-8, 7, -31], [1, 1, 2]);
  block(-8, 16.8, -31, 8, 0.8, 26);
  for (let i = 0; i < 12; i += 1) {
    const z = -44 + i * 2.1;
    const y = 17.6;
    block(-8, y, z, 7.3, 2.2, 2.3);
    for (const side of [-1, 1]) {
      block(-8 + side * 3.5, y + 1.4, z, 0.8, 1.2, 0.8);
    }
  }
  for (const [x, z, h] of [[-8, -44, 6], [-5, -29, 4], [-9, -22, 3]]) {
    block(x, 17 + h / 2, z, 4.2, h, 4.6);
    for (const dx of [-1.7, 0, 1.7]) for (const dz of [-1.9, 1.9]) block(x + dx, 17 + h + 0.5, z + dz, 0.7, 1, 0.8);
  }
  const crown = [[0, -1], [0.45, -0.9], [0.78, -0.65], [0.96, -0.3], [1, 0], [0.87, 0.35], [0.62, 0.66], [0.3, 0.9], [0, 1.08]];
  const crownGeometry = new THREE.LatheGeometry(crown.map(([r, y]) => new THREE.Vector2(r, y)), 32, 0, Math.PI * 2);
  const crownPoints = crownGeometry.attributes.position;
  for (let i = 0; i < crownPoints.count; i += 1) {
    const x = crownPoints.getX(i);
    const y = crownPoints.getY(i);
    const z = crownPoints.getZ(i);
    const angle = Math.atan2(z, x);
    const tuft = 1 + Math.sin(angle * 5 + y * 7) * 0.07 + Math.sin(angle * 11 - y * 13) * 0.05 + Math.sin(y * 21 + angle * 3) * 0.04;
    crownPoints.setXYZ(i, x * tuft, y, z * tuft);
  }
  crownGeometry.computeVertexNormals();
  const trees = new THREE.InstancedMesh(crownGeometry, leaf, 100);
  const bark = new THREE.MeshStandardMaterial({ color: 0x665c49, roughness: 1, ...textures("bark", [2, 3]) });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.12, 1, 12), bark, 100);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trees.castShadow = true;
  trees.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  for (let i = 0; i < 100; i += 1) {
    const side = i % 2 ? -1 : 1;
    const x = side * (18 + (Math.sin(i * 3.7) + 1) * 16);
    const z = 22 - (i % 50) * 1.8;
    const height = 2.5 + (Math.sin(i * 13) + 1) * 1.6;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i * 2.3) * 0.045);
    spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.4);
    const width = 0.72 + (Math.cos(i * 7) + 1) * 0.12;
    matrix.compose(new THREE.Vector3(x, height - 0.95, z), rotation.clone().multiply(spin), new THREE.Vector3(width, height * 0.88, width));
    trees.setMatrixAt(i, matrix);
    trees.setColorAt(i, new THREE.Color().setHSL(0.24 + Math.sin(i) * 0.03, 0.25, 0.55 + Math.cos(i * 4) * 0.12));
    matrix.compose(new THREE.Vector3(x, -0.7, z), rotation, new THREE.Vector3(1, 2.2, 1));
    trunks.setMatrixAt(i, matrix);
  }
  group.add(trees, trunks);
  for (let i = 0; i < 9; i += 1) {
    const terrace = mesh(new THREE.BoxGeometry(18, 0.6, 3), grass, [-30, i * 0.55 - 1, -14 - i * 3.3]);
    terrace.rotation.y = -0.16;
  }
  const sun = mesh(new THREE.SphereGeometry(2, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffd29a, fog: false }), [35, 31, -100]);
  return {
    group,
    sun,
    update(seconds) {
      ripples.normalMap.offset.set(seconds * 0.004, seconds * 0.011);
    },
    set(key) {
      const cold = key === "winter";
      const grassTint = cold ? 0xc6d6dc : key === "valley" ? 0x6c8a4a : key === "dawn" ? 0x7a7a4c : 0x5b6448;
      meadow.color.setHex(grassTint);
      grass.color.setHex(grassTint);
      rock.color.setHex(cold ? 0x8e9ea8 : key === "dawn" ? 0x9a755e : 0x7f7668);
      leaf.color.setHex(cold ? 0x7f9a90 : key === "dawn" ? 0x587040 : 0x47703f);
      water.color.setHex(key === "lake" ? 0x0e2638 : cold ? 0x2f4a55 : 0x1d3c44);
      sun.visible = key !== "storm" && key !== "winter";
      sun.material.color.setHex(key === "lake" || cold ? 0xe1edfa : 0xffd29a);
      sun.position.x = key === "lake" ? -25 : 35;
    },
  };
}
