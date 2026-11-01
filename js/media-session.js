export const MEDIA_ACTIONS = ["play", "pause", "stop"];
export const SEEK_ACTIONS = ["seekto", "seekbackward", "seekforward", "previoustrack", "nexttrack"];
export const SKIP_SECONDS = 10;
export const RESTART_AFTER = 3;
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

export const POSITION_TOLERANCE = 0.25;

const secondsNow = () => globalThis.performance.now() / 1000;

export function projectedPosition(anchor, at) {
  return Math.min(anchor.duration, anchor.position + anchor.rate * Math.max(0, at - anchor.at));
}

export function createMediaSession({
  navigator,
  MediaMetadata,
  base,
  artist,
  onPlay,
  onPause,
  onStop = onPause,
  onSeek = null,
  onTrack = null,
  carrier = null,
  now = secondsNow,
}) {
  const session = navigator?.mediaSession;
  const supported = !!session && typeof MediaMetadata === "function";
  const artwork = ICONS.map((icon) => ({ ...icon, src: new URL(icon.src, base).href }));
  let shownTitle = null;
  let shownState = supported ? session.playbackState : null;
  let bound = new Set();
  let anchor;
  let length = 0;
  let lastPosition = 0;

  function seekBy(offset) {
    onSeek(Math.min(length, Math.max(0, currentPosition() + offset)));
  }

  function currentPosition() {
    return anchor ? projectedPosition(anchor, now()) : lastPosition;
  }

  const actions = {
    play: () => onPlay(),
    pause: () => onPause(),
    stop: () => onStop(),
    seekto: (details) => {
      if (Number.isFinite(details?.seekTime)) onSeek(Math.min(length, Math.max(0, details.seekTime)));
    },
    seekbackward: (details) => seekBy(-(details?.seekOffset || SKIP_SECONDS)),
    seekforward: (details) => seekBy(details?.seekOffset || SKIP_SECONDS),
    previoustrack: () => {
      if (currentPosition() > RESTART_AFTER) onSeek(0);
      else onTrack(-1);
    },
    nexttrack: () => onTrack(1),
  };

  function attempt(write) {
    try {
      write();
      return true;
    } catch {
      return false;
    }
  }

  function wantedActions(titled, seekable) {
    if (!titled) return [];
    return seekable && onSeek && onTrack ? [...MEDIA_ACTIONS, ...SEEK_ACTIONS] : MEDIA_ACTIONS;
  }

  function bind(wanted) {
    const next = new Set(wanted);
    for (const action of bound) if (!next.has(action)) attempt(() => session.setActionHandler(action, null));
    for (const action of next) if (!bound.has(action)) attempt(() => session.setActionHandler(action, actions[action]));
    bound = next;
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
    const wanted = state === "none" ? null : positionOf({ duration, progress });
    if (!wanted) {
      if (anchor !== undefined && anchor !== null) attempt(() => session.setPositionState());
      anchor = null;
      return;
    }
    const at = now();
    const rate = state === "playing" ? 1 : 0;
    const stale =
      !anchor ||
      anchor.duration !== wanted.duration ||
      anchor.rate !== rate ||
      Math.abs(projectedPosition(anchor, at) - wanted.position) > POSITION_TOLERANCE;
    if (!stale) return;
    if (attempt(() => session.setPositionState(wanted))) anchor = { ...wanted, rate, at };
  }

  function update({ title, playing, duration, progress, seekable = false }) {
    if (!supported) return;
    const next = title || null;
    length = duration > 0 ? duration : 0;
    lastPosition = positionOf({ duration, progress })?.position ?? 0;
    if (next !== shownTitle) {
      shownTitle = next;
      attempt(() => {
        session.metadata = next ? new MediaMetadata({ title: next, artist, artwork }) : null;
      });
    }
    bind(wantedActions(!!next, seekable));
    const state = playbackStateOf({ title: next, playing });
    if (state !== shownState) {
      shownState = state;
      attempt(() => {
        session.playbackState = state;
      });
      carry(state);
    }
    place(state, duration, progress);
  }

  return { supported, update };
}
