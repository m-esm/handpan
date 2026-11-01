const radians = Math.PI / 180;
const relativeAngle = (value, origin) => ((value - origin + 540) % 360) - 180;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
const validSample = sample => Number.isFinite(sample.beta) && Number.isFinite(sample.gamma);

export function projectOrientation(sample, baseline, screenAngle = 0) {
  if (!validSample(sample) || !validSample(baseline)) return null;
  const angle = screenAngle * radians;
  const pitch = relativeAngle(sample.beta, baseline.beta) * radians;
  const roll = relativeAngle(sample.gamma, baseline.gamma) * radians;
  const yaw = Number.isFinite(sample.alpha) && Number.isFinite(baseline.alpha)
    ? relativeAngle(sample.alpha, baseline.alpha) * radians : 0;
  return {
    x: clamp((pitch * Math.cos(angle) + roll * Math.sin(angle)) * .45, .24),
    y: clamp(yaw * .3, .25),
    z: clamp((roll * Math.cos(angle) - pitch * Math.sin(angle)) * .45, .24),
  };
}

import { t } from "./i18n.js";

export function initMotion({ button, recenter, status, onChange }) {
  let active = false;
  let requested = false;
  let baseline = null;
  let timeout = null;
  let generation = 0;
  const orientation = window.screen?.orientation;
  const message = text => { status.textContent = text; };
  const render = () => {
    button.textContent = requested && !active ? t("motion.cancel") : active ? t("motion.on") : t("motion.enable");
    button.setAttribute('aria-pressed', String(requested));
    recenter.disabled = !active;
    recenter.hidden = !active;
  };
  const clearTimer = () => {
    if (timeout !== null) window.clearTimeout(timeout);
    timeout = null;
  };
  const stop = text => {
    generation++;
    requested = false;
    active = false;
    baseline = null;
    clearTimer();
    window.removeEventListener('deviceorientation', sample);
    window.removeEventListener('orientationchange', reset);
    orientation?.removeEventListener('change', reset);
    document.removeEventListener('visibilitychange', visibility);
    onChange(null);
    render();
    message(text || t("motion.off"));
  };
  const watchForSample = () => {
    clearTimer();
    if (!document.hidden) timeout = window.setTimeout(() => {
      stop(t("motion.noData"));
    }, 5000);
  };
  function reset() {
    if (!active) return;
    baseline = null;
    onChange({ x: 0, y: 0, z: 0 });
    message(t("motion.hold"));
    watchForSample();
  }
  function visibility() {
    if (document.hidden) clearTimer();
    else reset();
  }
  function sample(event) {
    if (!active || document.hidden || !validSample(event)) return;
    clearTimer();
    if (!baseline) {
      baseline = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
      message(t("motion.centered"));
    }
    const angle = Number.isFinite(orientation?.angle) ? orientation.angle : window.orientation || 0;
    onChange(projectOrientation(event, baseline, angle));
  }
  function start(token) {
    if (token !== generation || !requested) return;
    active = true;
    window.addEventListener('deviceorientation', sample);
    window.addEventListener('orientationchange', reset);
    orientation?.addEventListener('change', reset);
    document.addEventListener('visibilitychange', visibility);
    render();
    reset();
  }
  function toggle() {
    if (requested) { stop(); return; }
    if (!window.isSecureContext) {
      message(t("motion.https"));
      return;
    }
    const sensor = window.DeviceOrientationEvent;
    if (!sensor) {
      message(t("motion.unavailable"));
      return;
    }
    requested = true;
    const token = ++generation;
    render();
    if (typeof sensor.requestPermission !== 'function') { start(token); return; }
    message(t("motion.allow"));
    try {
      const permission = sensor.requestPermission();
      Promise.resolve(permission).then(result => {
        if (token !== generation || !requested) return;
        if (result === 'granted') start(token);
        else stop(t("motion.denied"));
      }).catch(() => {
        if (token === generation) stop(t("motion.failed"));
      });
    } catch {
      if (token === generation) stop(t("motion.failed"));
    }
  }
  button.addEventListener('click', toggle);
  recenter.addEventListener('click', reset);
  render();
  return {
    stop: () => stop(),
    recenter: reset,
    destroy() {
      stop();
      button.removeEventListener('click', toggle);
      recenter.removeEventListener('click', reset);
    },
  };
}
