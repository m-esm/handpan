import * as THREE from "three";
import { PATTERNS, numberOf } from "./score.js";
import { VIEWS, viewFor } from "./environments.js";

export function createWorldInterface({ onAction }) {
  const host = document.createElement("section");
  host.className = "world-interface";
  host.setAttribute("aria-label", "Alamut music world");
  const heading = document.createElement("h1");
  heading.className = "sr";
  host.append(heading);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  document.body.append(host);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 16);
  scene.add(new THREE.HemisphereLight(0xffedcf, 0x21374a, 2.4));
  const sun = new THREE.DirectionalLight(0xffd392, 3);
  sun.position.set(-4, 8, 10);
  scene.add(sun);
  let objects = [];
  let page = 0;
  let place = "all";
  let snapshot = {};
  let pattern = null;
  let previousKey = "";
  let width = 1;
  let height = 1;
  let wide = 10;
  let tall = 10;
  let tools = false;
  let previousPatternId = "";
  let objectCursor = 0;
  let lastSongId = "";
  let noticeText = "";
  let noticeTimer;
  const brass = new THREE.MeshStandardMaterial({ color: 0xb9924f, metalness: 0.75, roughness: 0.36 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x223b43, roughness: 0.85, metalness: 0.12 });
  const pale = new THREE.MeshStandardMaterial({ color: 0x81968c, roughness: 0.75 });
  const mark = document.createElement("div");
  mark.className = "world-whisper";
  mark.setAttribute("role", "status");
  host.append(mark);

  function inscription(lines, size, panelHeight, pixelHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(256, Math.round(256 * size / panelHeight));
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#071217";
    ctx.shadowBlur = 10;
    lines.forEach((line, i) => {
      const fontSize = (i ? 10 : pixelHeight > 70 ? 25 : 17) * 256 / pixelHeight;
      ctx.font = `${i ? "400" : "600"} ${fontSize}px ${i ? "Sora, sans-serif" : "Georgia, serif"}`;
      ctx.fillStyle = i ? "#d5be91" : "#fff0d2";
      const words = String(line).split(" ");
      const rows = [""];
      for (const word of words) {
        const candidate = `${rows.at(-1)} ${word}`.trim();
        if (ctx.measureText(candidate).width > canvas.width - 32 && rows.at(-1)) rows.push(word);
        else rows[rows.length - 1] = candidate;
      }
      const lineHeight = fontSize * 1.08;
      const center = lines.length === 1 ? 128 : i ? 204 : 86;
      rows.slice(0, 2).forEach((row, rowIndex, visible) => ctx.fillText(row, canvas.width / 2, center + (rowIndex - (visible.length - 1) / 2) * lineHeight, canvas.width - 32));
    });
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, panelHeight), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    mesh.userData.ownedMap = true;
    return mesh;
  }

  function object(label, subtitle, x, y, w, h, action, pedestal = false) {
    const slot = objectCursor++;
    const signature = JSON.stringify([label, subtitle, x, y, w, h, action, pedestal, width, height]);
    if (objects[slot]?.signature === signature) return;
    if (objects[slot]) dispose(objects[slot]);
    const group = new THREE.Group();
    group.position.set((x - 0.5) * wide, (0.5 - y) * tall, 0);
    const medallion = action && !["song", "home"].includes(action.type);
    const body = new THREE.Mesh(medallion ? new THREE.CylinderGeometry(1, 1, 0.2, 48) : new THREE.BoxGeometry(w * wide, h * tall, 0.2), stone);
    if (medallion) { body.rotation.x = Math.PI / 2; body.scale.set(w * wide / 2, 1, h * tall / 2); }
    group.add(body);
    const edge = new THREE.Mesh(medallion ? new THREE.CylinderGeometry(1, 1, 0.09, 48) : new THREE.BoxGeometry(w * wide * 1.035, h * tall * 1.09, 0.09), brass);
    if (medallion) { edge.rotation.x = Math.PI / 2; edge.scale.set(w * wide * 0.525, 1, h * tall * 0.56); }
    edge.position.z = -0.08;
    group.add(edge);
    body.visible = !!action;
    edge.visible = !!action;
    const visibleSubtitle = height < 540 && width > height && action && action.type !== "play" ? "" : subtitle;
    const text = inscription(visibleSubtitle ? [label, visibleSubtitle] : [label], w * wide * 0.94, h * tall * 0.90, h * height * 0.90);
    text.position.z = 0.14;
    group.add(text);
    if (pedestal) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(w * wide * 0.27, w * wide * 0.4, h * tall * 1.1, 8), pale);
      column.position.set(0, -h * tall * 1.08, -0.22);
      group.add(column);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(w * wide * 0.19, 0.035, 6, 40), brass);
      ring.position.set(0, h * tall * 1.35, 0);
      ring.rotation.x = 0.36;
      group.add(ring);
      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(w * wide * 0.105), new THREE.MeshStandardMaterial({ color: VIEWS[viewFor(action.id)].sky, emissive: 0x9c753b, emissiveIntensity: 0.65, metalness: 0.7, roughness: 0.2 }));
      jewel.position.copy(ring.position);
      group.add(jewel);
    }
    scene.add(group);
    const item = { group, body, action, signature, button: null };
    objects[slot] = item;
    if (!action) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-target";
    button.dataset.action = JSON.stringify(action);
    item.button = button;
    button.setAttribute("aria-label", subtitle ? `${label}, ${subtitle}` : label);
    group.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    const projected = [];
    for (const px of [bounds.min.x, bounds.max.x]) for (const py of [bounds.min.y, bounds.max.y]) for (const pz of [bounds.min.z, bounds.max.z]) projected.push(new THREE.Vector3(px, py, pz).project(camera));
    const left = Math.min(...projected.map((point) => (point.x + 1) * 50));
    const right = Math.max(...projected.map((point) => (point.x + 1) * 50));
    const top = Math.min(...projected.map((point) => (1 - point.y) * 50));
    const bottom = Math.max(...projected.map((point) => (1 - point.y) * 50));
    const targetWidth = Math.max(44, (right - left) * width / 100);
    const targetHeight = Math.max(44, (bottom - top) * height / 100);
    button.style.cssText = `left:${(left + right) * width / 200 - targetWidth / 2}px;top:${(top + bottom) * height / 200 - targetHeight / 2}px;width:${targetWidth}px;height:${targetHeight}px;`;
    button.disabled = !!action.disabled;
    if (button.disabled) group.traverse((node) => {
      if (!node.isMesh) return;
      node.material = node.material.clone();
      node.material.transparent = true;
      node.material.opacity = 0.4;
    });
    button.addEventListener("click", () => activate(action));
    if (!button.disabled) {
      button.addEventListener("pointerenter", () => { body.material = brass; render(); });
      button.addEventListener("pointerleave", () => { body.material = stone; render(); });
    }
    host.append(button);
  }

  function activate(action) {
    if (action.disabled) return;
    if (action.type === "page") page += action.delta;
    else if (action.type === "place") {
      const keys = ["all", ...Object.keys(VIEWS)];
      place = keys[(keys.indexOf(place) + 1) % keys.length];
      page = 0;
      onAction({ type: "environment", id: place === "all" ? "courtyard" : place });
    } else if (action.type === "tools") tools = !tools;
    else onAction(action);
    previousKey = "";
    update(snapshot);
  }

  function dispose(item) {
      scene.remove(item.group);
      item.group.traverse((node) => {
        node.geometry?.dispose();
        if (node.userData.ownedMap) { node.material.map.dispose(); node.material.dispose(); }
        else if (node.material && ![stone, brass, pale].includes(node.material)) node.material.dispose();
      });
      item.button?.remove();
  }

  function render() {
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
  }

  function update(next) {
    snapshot = next;
    pattern = PATTERNS.find((item) => `#/p/${item.id}` === location.hash);
    if ((pattern?.id || "") !== previousPatternId) {
      tools = false;
      previousPatternId = pattern?.id || "";
    }
    document.body.classList.toggle("world-song", !!pattern);
    document.body.classList.toggle("world-tools", tools);
    const key = JSON.stringify([pattern?.id, next.playing, next.bpm, next.loop, next.notes, next.nextNotes, page, place, tools, width, height, next.practice, next.hasPractice, next.practiceIndex, next.practiceCount, next.practiceDone, next.canRecenter, next.mirrored, next.listening, next.motion]);
    if (key === previousKey) return;
    previousKey = key;
    const activeAction = document.activeElement?.classList.contains("world-target") ? document.activeElement.dataset.action : "";
    objectCursor = 0;
    const compact = height < 540 && width > height;
    const portrait = width < 700 && !compact;
    if (!pattern) {
      const available = place === "all" ? PATTERNS : PATTERNS.filter((item) => viewFor(item.id) === place);
      const count = portrait ? 1 : width < 1000 ? 2 : 3;
      const pages = Math.max(1, Math.ceil(available.length / count));
      page = (page + pages) % pages;
      heading.textContent = "Alamut. Discover music in the landscape.";
      object("ALAMUT", "A world to listen to", 0.5, 0.105, portrait ? 0.72 : 0.34, 0.10, null);
      object(place === "all" ? "All paths" : VIEWS[place].name.replace("Alamut · ", ""), "Touch to travel", 0.5, 0.25, portrait ? 0.76 : 0.32, 0.10, { type: "place" });
      available.slice(page * count, page * count + count).forEach((item, i) => {
        object(item.title, compact ? "" : item.kind, portrait ? 0.5 : (i + 0.5) / count, 0.60, portrait ? 0.78 : 0.82 / count, Math.max(0.12, 64 / height), { type: "song", id: item.id }, true);
      });
      object("←", "Previous path", 0.18, 0.89, portrait ? 0.22 : 0.13, Math.max(0.07, 44 / height), { type: "page", delta: -1 });
      object("→", "Next path", 0.82, 0.89, portrait ? 0.22 : 0.13, Math.max(0.07, 44 / height), { type: "page", delta: 1 });
      mark.textContent = `${page + 1} / ${pages} · Choose a melody stone`;
    } else {
      heading.textContent = pattern.title;
      object("← Alamut", "Return to the paths", portrait ? 0.21 : 0.12, compact ? 0.09 : 0.055, portrait ? 0.35 : 0.18, Math.max(0.06, 44 / height), { type: "home" });
      object(tools ? "×" : "✧", tools ? "Close tools" : "Tools", portrait ? 0.89 : 0.93, compact ? 0.09 : 0.055, portrait ? 0.14 : 0.09, Math.max(0.06, 44 / height), { type: "tools" });
      object(pattern.title, compact ? "" : VIEWS[viewFor(pattern.id)].name.replace("Alamut · ", ""), 0.5, compact ? 0.10 : 0.16, portrait ? 0.88 : 0.5, Math.max(0.105, 44 / height), null);
      const now = (next.notes || []).map(numberOf).join(" · ") || "Listen";
      const upcoming = (next.nextNotes || []).map(numberOf).join(" · ");
      if (!tools && compact) {
        object(now, upcoming ? `Then ${upcoming}` : "Touch the handpan", 0.35, 0.86, 0.35, 0.15, null);
        object(next.playing ? "Ⅱ Pause" : "▷ Play", `${next.bpm} bpm`, 0.78, 0.32, 0.28, 0.16, { type: "play" });
        object("‹", "Previous note", 0.67, 0.52, 0.12, 0.12, { type: "step", delta: -1 });
        object("›", "Next note", 0.89, 0.52, 0.12, 0.12, { type: "step", delta: 1 });
        object("−", "Slower", 0.67, 0.72, 0.12, 0.12, { type: "tempo", delta: -4, disabled: next.bpm <= 48 });
        object("+", "Faster", 0.89, 0.72, 0.12, 0.12, { type: "tempo", delta: 4, disabled: next.bpm >= 140 });
        object(next.loop ? "∞ Loop on" : "∞ Loop off", "Repeat the melody", 0.78, 0.89, 0.27, 0.12, { type: "loop" });
      } else if (!tools) {
      object(now, upcoming ? `Then ${upcoming}` : "Touch the handpan", 0.5, 0.68, portrait ? 0.56 : 0.25, 0.085, null);
      object("‹", "Previous note", 0.22, 0.80, portrait ? 0.19 : 0.11, 0.08, { type: "step", delta: -1 });
      object(next.playing ? "Ⅱ Pause" : "▷ Play", `${next.bpm} bpm`, 0.5, 0.80, portrait ? 0.30 : 0.18, 0.09, { type: "play" });
      object("›", "Next note", 0.78, 0.80, portrait ? 0.19 : 0.11, 0.08, { type: "step", delta: 1 });
      object("−", "Slower", 0.18, 0.92, portrait ? 0.18 : 0.10, 0.065, { type: "tempo", delta: -4, disabled: next.bpm <= 48 });
      object(next.loop ? "∞ Loop on" : "∞ Loop off", "Repeat the melody", 0.5, 0.92, portrait ? 0.32 : 0.21, 0.07, { type: "loop" });
      object("+", "Faster", 0.82, 0.92, portrait ? 0.18 : 0.10, 0.065, { type: "tempo", delta: 4, disabled: next.bpm >= 140 });
      }
      if (tools) {
        const actions = [[next.motion ? "Tilt on" : "Tilt off", "Phone motion", "motion"]];
        if (next.canRecenter) actions.push(["Center", "Recenter motion", "center"]);
        actions.push([next.mirrored ? "Mirror on" : "Mirror off", "Swap hands", "mirror"], [next.listening ? "Listening" : "Listen", "Use microphone", "listen"]);
        if (next.hasPractice) actions.push([next.practice ? next.practiceIndex === next.practiceCount - 1 ? "Finish practice" : "Got it, next" : next.practiceDone ? "Continue" : "Practice", "Learn in steps", "practice"]);
        if (next.practiceIndex > 0) actions.push(["Previous step", "Repeat this part", "practice-back"]);
        if (next.practice) actions.push(["Leave practice", "Keep your progress", "practice-exit"]);
        const cols = compact ? 3 : 2;
        actions.forEach(([label, sub, type], i) => object(label, sub, (i % cols + 0.5) / cols, compact ? 0.32 + Math.floor(i / cols) * 0.23 : 0.32 + Math.floor(i / cols) * 0.15, compact ? 0.28 : 0.40, Math.max(compact ? 0.14 : 0.09, 48 / height), { type }));
      }
      mark.textContent = next.practice || "Brass · left hand     Ivory · right hand";
    }
    if (noticeText) mark.textContent = noticeText;
    for (let i = objectCursor; i < objects.length; i += 1) dispose(objects[i]);
    objects.length = objectCursor;
    render();
    if (activeAction) [...host.querySelectorAll("button")].find((node) => node.dataset.action === activeAction)?.focus({ preventScroll: true });
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    tall = 2 * Math.tan(THREE.MathUtils.degToRad(19)) * 16;
    wide = tall * camera.aspect;
    renderer.setSize(width, height);
    previousKey = "";
    update(snapshot);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Escape" || !pattern) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (tools) {
      tools = false;
      update(snapshot);
      host.querySelector('[data-action=\'{"type":"tools"}\']')?.focus({ preventScroll: true });
    } else {
      onAction({ type: "home" });
      requestAnimationFrame(() => host.querySelector("button")?.focus({ preventScroll: true }));
    }
  }, true);
  document.body.classList.add("world-mode");
  resize();
  return {
    update,
    galleryEnvironment() { return place === "all" ? "courtyard" : place; },
    focusRoute(previousSongId) {
      const action = pattern ? { type: "play" } : { type: "song", id: previousSongId || lastSongId };
      if (pattern) lastSongId = pattern.id;
      const target = [...host.querySelectorAll("button")].find((button) => button.dataset.action === JSON.stringify(action));
      (target || host.querySelector("button"))?.focus({ preventScroll: true });
    },
    notice(text) {
      clearTimeout(noticeTimer);
      noticeText = text;
      mark.textContent = text;
      noticeTimer = setTimeout(() => { noticeText = ""; previousKey = ""; update(snapshot); }, 7000);
    }
  };
}
