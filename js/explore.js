import { t } from "./i18n.js";

const KEY_X = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
const KEY_Z = { KeyW: 1, ArrowUp: 1, KeyS: -1, ArrowDown: -1 };

function flightMove(keys, stick, lift) {
  let x = stick.x;
  let z = stick.z;
  for (const code of keys) {
    if (Object.hasOwn(KEY_X, code)) x += KEY_X[code];
    if (Object.hasOwn(KEY_Z, code)) z += KEY_Z[code];
  }
  const y = lift + (keys.has("Space") ? 1 : 0) + (keys.has("ShiftLeft") || keys.has("ShiftRight") ? -1 : 0);
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, y: Math.max(-1, Math.min(1, y)), z };
}

function releaseCapture(node, pointerId) {
  try {
    node.releasePointerCapture(pointerId);
  } catch (err) {
    void err;
  }
}

function applyExploreCopy(overlay, touch) {
  overlay.querySelector("#explore-title").textContent = t("explore.title");
  overlay.querySelector("#explore-description").textContent = t(touch ? "explore.controlsTouch" : "explore.controls");
  overlay.querySelector(".explore-return").textContent = t("explore.return");
  overlay.querySelector(".explore-rise").textContent = t("explore.rise");
  overlay.querySelector(".explore-sink").textContent = t("explore.sink");
}

function trackFlightKey(event, keys) {
  if (event.code === "Space" && event.target.closest("button")) {
    keys.delete("Space");
    return;
  }
  if (event.code === "Space" || event.code.startsWith("Arrow") || event.code.startsWith("Shift") || Object.hasOwn(KEY_X, event.code) || Object.hasOwn(KEY_Z, event.code)) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "keydown") keys.add(event.code);
    else keys.delete(event.code);
  }
}

export function initExplore({ world, onOpen } = {}) {
  const entry = document.getElementById("explore-world");
  const wrap = document.querySelector(".wrap");
  if (!entry || !wrap) {
    return { open() {}, close() {}, active: () => false };
  }
  const overlay = document.createElement("section");
  overlay.id = "explore-hud";
  overlay.className = "explore-hud";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "explore-title");
  overlay.setAttribute("tabindex", "-1");
  const touch = matchMedia("(pointer: coarse)").matches;
  const heading = document.createElement("header");
  heading.className = "explore-heading";
  const headingText = document.createElement("div");
  const title = document.createElement("h1");
  title.id = "explore-title";
  const description = document.createElement("p");
  description.id = "explore-description";
  const exitButton = document.createElement("button");
  exitButton.type = "button";
  exitButton.className = "explore-return";
  headingText.append(title, description);
  heading.append(headingText, exitButton);
  const pads = document.createElement("div");
  pads.className = "explore-touch";
  pads.hidden = !touch;
  const movePad = document.createElement("div");
  movePad.className = "explore-stick";
  movePad.setAttribute("data-stick", "move");
  movePad.setAttribute("aria-hidden", "true");
  const moveKnob = document.createElement("span");
  moveKnob.className = "explore-knob";
  movePad.append(moveKnob);
  const liftPad = document.createElement("div");
  liftPad.className = "explore-lift";
  const rise = document.createElement("button");
  rise.type = "button";
  rise.className = "explore-rise";
  const sink = document.createElement("button");
  sink.type = "button";
  sink.className = "explore-sink";
  liftPad.append(rise, sink);
  const lookPad = document.createElement("div");
  lookPad.className = "explore-stick";
  lookPad.setAttribute("data-stick", "look");
  lookPad.setAttribute("aria-hidden", "true");
  const lookKnob = document.createElement("span");
  lookKnob.className = "explore-knob";
  lookPad.append(lookKnob);
  pads.append(movePad, liftPad, lookPad);
  overlay.append(heading, pads);
  applyExploreCopy(overlay, touch);
  document.body.append(overlay);
  const exit = overlay.querySelector(".explore-return");
  const keys = new Set();
  const moveStick = { x: 0, z: 0 };
  const lookStick = { x: 0, y: 0 };
  let lift = 0;
  let restoreFocus = entry;
  let raf = 0;
  const listeners = [];

  function stage() {
    return typeof world === "function" ? world() : world;
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function clearMotion() {
    keys.clear();
    moveStick.x = 0;
    moveStick.z = 0;
    lookStick.x = 0;
    lookStick.y = 0;
    lift = 0;
    for (const stick of overlay.querySelectorAll(".explore-stick")) {
      stick.classList.remove("is-held");
      const knob = stick.querySelector(".explore-knob");
      if (knob) knob.style.transform = "";
    }
    stage()?.steer({ x: 0, y: 0, z: 0 }, null);
  }

  function tick() {
    if (overlay.hidden) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
    const look = lookStick.x || lookStick.y ? lookStick : null;
    stage()?.steer(flightMove(keys, moveStick, lift), look);
  }

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("is-exploring");
    wrap.inert = false;
    entry.setAttribute("aria-expanded", "false");
    if (document.pointerLockElement) document.exitPointerLock();
    clearMotion();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const drop of listeners.splice(0)) drop();
    stage()?.fly(false);
    const focusTarget = restoreFocus?.isConnected && restoreFocus.getClientRects().length
      ? restoreFocus : document.getElementById("tools-toggle");
    focusTarget?.focus({ preventScroll: true });
  }

  function onKey(event) {
    if (overlay.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...overlay.querySelectorAll("button")].filter((button) => button.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      const atDialog = document.activeElement === overlay;
      if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || atDialog || !overlay.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.target.closest("input, textarea, select")) return;
    trackFlightKey(event, keys);
  }

  function onMouse(event) {
    if (overlay.hidden) return;
    if (document.pointerLockElement) {
      stage()?.steer(null, { x: event.movementX * 0.0022, y: event.movementY * 0.0022 });
      return;
    }
    if (event.buttons !== 1 || event.target.closest("button, .explore-stick")) return;
    stage()?.steer(null, { x: event.movementX * 0.0022, y: event.movementY * 0.0022 });
  }

  function bindPad(el, look) {
    let pointer = 0;
    function vector(event) {
      const box = el.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (box.width * 0.5)));
      const ny = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / (box.height * 0.5)));
      if (look) {
        lookStick.x = nx * 0.045;
        lookStick.y = ny * 0.045;
      } else {
        moveStick.x = nx;
        moveStick.z = -ny;
      }
      el.querySelector(".explore-knob").style.transform = `translate(${nx * 18}px, ${ny * 18}px)`;
    }
    function release(event) {
      if (event.pointerId !== pointer) return;
      pointer = 0;
      el.classList.remove("is-held");
      el.querySelector(".explore-knob").style.transform = "";
      releaseCapture(el, event.pointerId);
      if (look) {
        lookStick.x = 0;
        lookStick.y = 0;
      } else {
        moveStick.x = 0;
        moveStick.z = 0;
      }
    }
    listen(el, "pointerdown", (event) => {
      if (event.button) return;
      event.preventDefault();
      pointer = event.pointerId;
      el.classList.add("is-held");
      el.setPointerCapture(event.pointerId);
      vector(event);
    });
    listen(el, "pointermove", (event) => {
      if (event.pointerId !== pointer) return;
      vector(event);
    });
    listen(el, "pointerup", release);
    listen(el, "pointercancel", release);
  }

  function holdLift(button, dir) {
    function start(event) {
      if (event.button) return;
      event.preventDefault();
      lift = dir;
      button.classList.add("is-held");
      button.setPointerCapture(event.pointerId);
    }
    function end(event) {
      if (!button.classList.contains("is-held")) return;
      button.classList.remove("is-held");
      releaseCapture(button, event.pointerId);
      lift = 0;
    }
    function isActivation(event) {
      return event.key === "Enter" || event.key === " " || event.code === "Space";
    }
    function keyStart(event) {
      if (!isActivation(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      lift = dir;
      button.classList.add("is-held");
    }
    function keyEnd(event) {
      if (!isActivation(event) || !button.classList.contains("is-held")) return;
      event.preventDefault();
      button.classList.remove("is-held");
      lift = 0;
    }
    listen(button, "pointerdown", start);
    listen(button, "pointerup", end);
    listen(button, "pointercancel", end);
    listen(button, "keydown", keyStart);
    listen(button, "keyup", keyEnd);
    listen(button, "blur", () => keyEnd({ key: "Enter", preventDefault() {} }));
  }

  function open() {
    const scene = stage();
    if (!scene?.fly || !overlay.hidden) return;
    onOpen?.();
    applyExploreCopy(overlay, touch);
    restoreFocus = document.activeElement;
    overlay.hidden = false;
    wrap.inert = true;
    document.body.classList.add("is-exploring");
    entry.setAttribute("aria-expanded", "true");
    scene.fly(true);
    clearMotion();
    listen(window, "keydown", onKey, true);
    listen(window, "keyup", onKey, true);
    listen(window, "mousemove", onMouse);
    listen(window, "blur", clearMotion);
    listen(document, "visibilitychange", () => { if (document.hidden) clearMotion(); });
    listen(window, "hashchange", close);
    listen(document, "pointerdown", (event) => {
      if (touch || event.target.closest("button, .explore-stick")) return;
      const lockOn = document.querySelector(".world") || overlay;
      lockOn.requestPointerLock?.();
    });
    for (const stick of overlay.querySelectorAll(".explore-stick")) bindPad(stick, stick.dataset.stick === "look");
    holdLift(overlay.querySelector(".explore-rise"), 1);
    holdLift(overlay.querySelector(".explore-sink"), -1);
    listen(exit, "click", close);
    if (!raf) raf = requestAnimationFrame(tick);
    overlay.focus({ preventScroll: true });
  }

  entry.setAttribute("aria-haspopup", "dialog");
  entry.setAttribute("aria-expanded", "false");
  entry.setAttribute("aria-controls", "explore-hud");
  entry.addEventListener("click", () => open());
  return {
    open,
    close: () => { if (!overlay.hidden) close(); },
    active: () => !overlay.hidden,
  };
}
