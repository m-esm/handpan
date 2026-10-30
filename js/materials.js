import * as THREE from "three";
import { bake } from "./bake.js";

export { seeded, fbm } from "./bake.js";

function toTexture(image) {
  const bytes = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const texture = new THREE.DataTexture(bytes, image.width, image.height);
  texture.colorSpace = image.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = image.wrap === "clamp" ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const made = new Map();

export function materialKit(renderer, prepared) {
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  return function textures(name, repeat) {
    if (!made.has(name)) {
      const images = prepared?.pack.get(name) || bake(name);
      const set = {};
      for (const [key, image] of Object.entries(images)) {
        set[key] = toTexture(image);
        set[key].anisotropy = anisotropy;
      }
      made.set(name, set);
    }
    const set = made.get(name);
    if (!repeat) return { ...set };
    const copy = {};
    for (const [key, texture] of Object.entries(set)) {
      copy[key] = texture.clone();
      copy[key].repeat.set(...repeat);
    }
    return copy;
  };
}

export function worldScale(material, metres) {
  material.userData.worldScale = 1 / metres;
  return material;
}

export function boxProject(geometry, scale) {
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i + 2 < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);
    for (let k = 0; k < 3; k += 1) {
      const p = [a, b, c][k];
      const [u, v] = ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y];
      uv[(i + k) * 2] = u * scale;
      uv[(i + k) * 2 + 1] = v * scale;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}`;

const SKY_FRAGMENT = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uGlow;
uniform vec3 uCloud;
uniform vec3 uSun;
uniform float uCover;
uniform float uStars;
uniform float uTime;
uniform float uMagic;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 color = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.75, h), 0.65));
  color = mix(color, uGround, smoothstep(0.0, -0.2, h));
  float sun = max(dot(dir, normalize(uSun)), 0.0);
  color += uGlow * (pow(sun, 6.0) * 0.32 + pow(sun, 48.0) * 0.5);
  float shade = 0.0;
  if (h > -0.02) {
    vec2 p = dir.xz / (h + 0.12) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
    float body = fbm(p * vec2(1.0, 2.2));
    float cloud = smoothstep(1.0 - uCover, 1.0 - uCover + 0.32, body);
    float lit = fbm(p * vec2(1.0, 2.2) + normalize(uSun.xz) * 0.08);
    vec3 tone = mix(uCloud * 0.62, uCloud * 1.12 + uGlow * 0.35 * pow(sun, 3.0), smoothstep(0.35, 0.75, body - lit + 0.5));
    shade = cloud * smoothstep(-0.02, 0.16, h) * 0.9;
    color = mix(color, tone, shade);
  }
  float starlight = max(uStars, uMagic * 0.9);
  if (starlight > 0.0 && h > 0.0) {
    vec3 cell = floor(dir * 260.0);
    float pick = hash3(cell);
    vec3 local = fract(dir * 260.0) - 0.5;
    float star = step(0.986 - uMagic * 0.014, pick) * smoothstep(0.32, 0.0, length(local));
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.0 + pick * 3.0) + pick * 40.0);
    color += vec3(0.9, 0.95, 1.0) * star * twinkle * starlight * (1.0 + uMagic * 1.2) * smoothstep(0.02, 0.3, h) * (1.0 - shade) * (0.5 + fract(pick * 97.0));
  }
  if (uMagic > 0.0 && h > 0.0) {
    float band = fbm(vec2(dir.x * 2.6 + uTime * 0.03, h * 7.0 - uTime * 0.012));
    float curtain = smoothstep(0.42, 0.78, band) * smoothstep(0.03, 0.22, h) * smoothstep(0.95, 0.45, h);
    vec3 veil = mix(vec3(0.24, 0.72, 0.58), vec3(0.52, 0.36, 0.95), smoothstep(0.1, 0.6, h + sin(dir.x * 3.0 + uTime * 0.05) * 0.15));
    color += veil * curtain * uMagic * 0.55 * (1.0 - shade);
    color = mix(color, color + vec3(0.1, 0.04, 0.22), uMagic * smoothstep(0.1, 0.8, h));
  }
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uCloud: { value: new THREE.Color() },
    uSun: { value: new THREE.Vector3(0, 0.3, -1) },
    uCover: { value: 0.4 },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uMagic: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.userData.keepSeparate = true;
  return {
    mesh,
    uniforms,
    set(palette, sun) {
      uniforms.uZenith.value.setHex(palette.zenith);
      uniforms.uHorizon.value.setHex(palette.horizon);
      uniforms.uGround.value.setHex(palette.ground);
      uniforms.uGlow.value.setHex(palette.glow);
      uniforms.uCloud.value.setHex(palette.cloud);
      uniforms.uCover.value = palette.cover;
      uniforms.uStars.value = palette.stars;
      uniforms.uSun.value.copy(sun).normalize();
    },
  };
}
