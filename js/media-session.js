export const MEDIA_ACTIONS = ["play", "pause", "stop"];
const ICONS = [
  { src: "img/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "img/icon-512.png", sizes: "512x512", type: "image/png" },
];

export function playbackStateOf({ title, playing }) {
  if (!title) return "none";
  return playing ? "playing" : "paused";
}

export function createMediaSession({ navigator, MediaMetadata, base, artist, onPlay, onPause }) {
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

  function update({ title, playing }) {
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
    }
  }

  return { supported, update };
}
