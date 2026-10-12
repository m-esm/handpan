import * as THREE from "three";

export function createLandscape() {
  const group = new THREE.Group();
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = textureCanvas.height = 256;
  const pen = textureCanvas.getContext("2d");
  pen.fillStyle = "#a99e8e";
  pen.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    for (let x = -24; x < 256; x += 48) {
      const shade = 172 + (Math.sin(x * 9 + y * 5) + 1) * 9;
      pen.fillStyle = `rgb(${shade},${shade - 5},${shade - 12})`;
      pen.fillRect(x + (y % 32 ? 24 : 0), y, 47, 15);
    }
  }
  const masonry = new THREE.CanvasTexture(textureCanvas);
  masonry.colorSpace = THREE.SRGBColorSpace;
  masonry.wrapS = masonry.wrapT = THREE.RepeatWrapping;
  masonry.repeat.set(2, 2);
  const rock = new THREE.MeshStandardMaterial({ color: 0x80634e, roughness: 1 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x5b7141, roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x304b32, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xb6a58e, roughness: 0.94, map: masonry });
  const water = new THREE.MeshStandardMaterial({ color: 0x315d6b, metalness: 0.12, roughness: 0.42 });
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
  for (let layer = 0; layer < 4; layer += 1) {
    const geometry = new THREE.PlaneGeometry(260, 65, 140, 32);
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    const colors = [];
    for (let i = 0; i < vertices.count; i += 1) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      const spine = Math.max(0, 1 - Math.abs(z + Math.sin(x * 0.08) * 8) / 34);
      const height = Math.pow(spine, 1.4) * (22 + layer * 7 + noise(x + layer * 43, z) * 16);
      vertices.setY(i, height - 4);
      const cap = height > 23 + layer * 5;
      const tint = new THREE.Color(cap ? 0xcad4d2 : layer ? 0x7b8c94 : 0x968273);
      tint.multiplyScalar(0.84 + noise(x, z) * 0.15);
      colors.push(tint.r, tint.g, tint.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    mesh(geometry, material, [0, 0, -64 - layer * 27]);
  }
  mesh(new THREE.PlaneGeometry(300, 250), grass, [0, -1.8, -45]).rotation.x = -Math.PI / 2;
  const waterGeometry = new THREE.PlaneGeometry(31, 110, 12, 32);
  const waterPoints = waterGeometry.attributes.position;
  for (let i = 0; i < waterPoints.count; i += 1) {
    const y = waterPoints.getY(i);
    waterPoints.setX(i, waterPoints.getX(i) * (0.65 + Math.cos(y * 0.055) * 0.18) + Math.sin(y * 0.04) * 6);
  }
  const lake = mesh(waterGeometry, water, [4, -1.62, 2]);
  lake.rotation.x = -Math.PI / 2;
  const cliff = new THREE.CylinderGeometry(8, 14, 20, 48, 24);
  const cliffPoints = cliff.attributes.position;
  for (let i = 0; i < cliffPoints.count; i += 1) {
    const x = cliffPoints.getX(i);
    const y = cliffPoints.getY(i);
    const z = cliffPoints.getZ(i);
    const erosion = 1 + noise(x * 2, z * 2 + y * 0.4) * 0.12;
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
  const trees = new THREE.InstancedMesh(new THREE.LatheGeometry(crown.map(([r, y]) => new THREE.Vector2(r, y)), 12), leaf, 100);
  const bark = new THREE.MeshStandardMaterial({ color: 0x665c49, roughness: 1 });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.12, 1, 6), bark, 100);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trees.castShadow = true;
  trees.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  for (let i = 0; i < 100; i += 1) {
    const side = i % 2 ? -1 : 1;
    const x = side * (18 + (Math.sin(i * 3.7) + 1) * 16);
    const z = 22 - (i % 50) * 1.8;
    const height = 2.5 + (Math.sin(i * 13) + 1) * 1.6;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i * 2.3) * 0.045);
    const width = 0.72 + (Math.cos(i * 7) + 1) * 0.12;
    matrix.compose(new THREE.Vector3(x, height - 0.95, z), rotation, new THREE.Vector3(width, height * 0.88, width));
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
  const sun = mesh(new THREE.SphereGeometry(2, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffd29a, fog: false }), [35, 31, -100]);
  return {
    group,
    set(key) {
      const cold = key === "winter";
      grass.color.setHex(cold ? 0xc6d6dc : key === "valley" ? 0x648047 : 0x5b6448);
      rock.color.setHex(cold ? 0x82949e : key === "dawn" ? 0x9b6549 : 0x756d60);
      leaf.color.setHex(cold ? 0x718b83 : 0x304b32);
      water.color.setHex(key === "lake" ? 0x274e68 : 0x547f86);
      sun.visible = key !== "storm";
      sun.material.color.setHex(key === "lake" || cold ? 0xe1edfa : 0xffd29a);
      sun.position.x = key === "lake" ? -25 : 35;
    },
  };
}
