export const MEDIA_ACTIONS = ["play", "pause", "stop"];
const ICONS = [
  { src: "img/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "img/icon-512.png", sizes: "512x512", type: "image/png" },
];

export function playbackStateOf({ title, playing }) {
  if (!title) return "none";
  return playing ? "playing" : "paused";
}

export function silentWavBytes(seconds = 10, rate = 8000) {
  const samples = seconds * rate;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at, value) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  return bytes;
}

export function positionOf({ duration, progress }) {
  if (!(duration > 0)) return null;
  const share = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return { duration, playbackRate: 1, position: share * duration };
}

export function createMediaSession({ navigator, MediaMetadata, base, artist, onPlay, onPause, carrier = null }) {
  const session = navigator?.mediaSession;
  const supported = !!session && typeof MediaMetadata === "function";
  const artwork = ICONS.map((icon) => ({ ...icon, src: new URL(icon.src, base).href }));
  const actions = { play: onPlay, pause: onPause, stop: onPause };
  let shownTitle = null;
  let shownState = supported ? session.playbackState : null;
  let bound = false;

  function attempt(write) {
    try {
      write();
      return true;
    } catch {
      return false;
    }
  }

  function bind(on) {
    if (bound === on) return;
    bound = on;
    for (const action of MEDIA_ACTIONS) attempt(() => session.setActionHandler(action, on ? actions[action] : null));
  }

  function carry(state) {
    if (!carrier) return;
    if (state === "playing") {
      const started = attempt(() => {
        carrier.attach();
        Promise.resolve(carrier.play()).catch(() => {});
      });
      if (!started) return;
    } else attempt(() => carrier.pause());
    if (state === "none") attempt(() => carrier.release());
  }

  function place(state, duration, progress) {
    if (typeof session.setPositionState !== "function") return;
    const position = state === "none" ? null : positionOf({ duration, progress });
    attempt(() => (position ? session.setPositionState(position) : session.setPositionState()));
  }

  function update({ title, playing, duration, progress }) {
    if (!supported) return;
    const next = title || null;
    if (next !== shownTitle) {
      shownTitle = next;
      attempt(() => {
        session.metadata = next ? new MediaMetadata({ title: next, artist, artwork }) : null;
      });
      bind(!!next);
    }
    const state = playbackStateOf({ title: next, playing });
    if (state !== shownState) {
      shownState = state;
      attempt(() => {
        session.playbackState = state;
      });
      carry(state);
      place(state, duration, progress);
    }
  }

  return { supported, update };
}
