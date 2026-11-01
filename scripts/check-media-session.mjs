import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaSession, playbackStateOf, positionOf, projectedPosition, silentWavBytes, MEDIA_ACTIONS } from "../js/media-session.js";
import { createPlayer } from "../js/play.js";

const BASE = "https://handpan.moshes.io/p/let-it-be.html";

class FakeMetadata {
  constructor(init) {
    Object.assign(this, init);
  }
}

function fakeSession({ unsupported = [] } = {}) {
  const log = { metadata: [], state: [], handlers: {}, calls: [] };
  let metadata = null;
  let state = "none";
  const session = {
    get metadata() {
      return metadata;
    },
    set metadata(value) {
      metadata = value;
      log.metadata.push(value);
    },
    get playbackState() {
      return state;
    },
    set playbackState(value) {
      state = value;
      log.state.push(value);
    },
    setActionHandler(action, handler) {
      log.calls.push([action, handler === null ? null : "fn"]);
      if (unsupported.includes(action)) throw new TypeError(`${action} is not supported`);
      log.handlers[action] = handler;
    },
  };
  return { session, log };
}

function make(options = {}) {
  const { session, log } = fakeSession(options);
  const counts = { play: 0, pause: 0 };
  const media = createMediaSession({
    navigator: { mediaSession: session },
    MediaMetadata: FakeMetadata,
    base: BASE,
    artist: "Alamut",
    onPlay: () => counts.play++,
    onPause: () => counts.pause++,
  });
  return { media, log, counts };
}

for (const navigator of [undefined, {}, { mediaSession: fakeSession().session }]) {
  const MediaMetadata = navigator?.mediaSession ? undefined : FakeMetadata;
  const media = createMediaSession({ navigator, MediaMetadata, base: BASE, artist: "Alamut", onPlay() {}, onPause() {} });
  assert.equal(media.supported, false);
  assert.doesNotThrow(() => media.update({ title: "Let It Be", playing: true }));
}

assert.equal(playbackStateOf({ title: null, playing: true }), "none");
assert.equal(playbackStateOf({ title: "A", playing: true }), "playing");
assert.equal(playbackStateOf({ title: "A", playing: false }), "paused");

{
  const { media, log, counts } = make();
  assert.equal(media.supported, true);
  media.update({ title: null, playing: false });
  assert.deepEqual(log.metadata, []);
  assert.deepEqual(log.calls, []);
  assert.deepEqual(log.state, []);

  media.update({ title: "Let It Be", playing: false });
  assert.equal(log.metadata.length, 1);
  const shown = log.metadata[0];
  assert.equal(shown.title, "Let It Be");
  assert.equal(shown.artist, "Alamut");
  assert.deepEqual(shown.artwork, [
    { src: "https://handpan.moshes.io/p/img/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "https://handpan.moshes.io/p/img/icon-512.png", sizes: "512x512", type: "image/png" },
  ]);
  assert.deepEqual(log.state, ["paused"]);
  assert.deepEqual(Object.keys(log.handlers).sort(), [...MEDIA_ACTIONS].sort());

  for (let n = 0; n < 50; n += 1) media.update({ title: "Let It Be", playing: true });
  assert.equal(log.metadata.length, 1);
  assert.deepEqual(log.state, ["paused", "playing"]);
  assert.equal(log.calls.length, MEDIA_ACTIONS.length);

  log.handlers.play();
  log.handlers.pause();
  log.handlers.stop();
  assert.deepEqual(counts, { play: 1, pause: 2 });

  media.update({ title: "Let It Be", playing: false });
  assert.deepEqual(log.state, ["paused", "playing", "paused"]);

  media.update({ title: "Feeling Good", playing: false });
  assert.equal(log.metadata.length, 2);
  assert.equal(log.metadata[1].title, "Feeling Good");
  assert.equal(log.calls.length, MEDIA_ACTIONS.length);

  media.update({ title: null, playing: false });
  assert.equal(log.metadata.at(-1), null);
  assert.equal(log.state.at(-1), "none");
  for (const action of MEDIA_ACTIONS) assert.equal(log.handlers[action], null);
  for (const action of ["seekto", "seekbackward", "seekforward", "previoustrack", "nexttrack"]) {
    assert.equal(log.calls.some(([name]) => name === action), false, `${action} must stay unregistered`);
  }
}

{
  const { media, log } = make({ unsupported: ["stop"] });
  assert.doesNotThrow(() => media.update({ title: "Let It Be", playing: true }));
  assert.equal(typeof log.handlers.play, "function");
  assert.equal(typeof log.handlers.pause, "function");
  assert.equal("stop" in log.handlers, false);
  assert.deepEqual(log.state, ["playing"]);
}

{
  const { session, log } = fakeSession();
  const media = createMediaSession({
    navigator: { mediaSession: session },
    MediaMetadata: class {
      constructor() {
        throw new TypeError("bad artwork");
      }
    },
    base: BASE,
    artist: "Alamut",
    onPlay() {},
    onPause() {},
  });
  assert.doesNotThrow(() => media.update({ title: "Let It Be", playing: true }));
  assert.deepEqual(log.state, ["playing"]);
  assert.equal(typeof log.handlers.play, "function");
}

{
  const wav = silentWavBytes(10, 8000);
  const view = new DataView(wav.buffer);
  const text = (at, n) => String.fromCharCode(...wav.slice(at, at + n));
  assert.equal(text(0, 4), "RIFF");
  assert.equal(text(8, 8), "WAVEfmt ");
  assert.equal(text(36, 4), "data");
  assert.equal(view.getUint32(24, true), 8000);
  assert.equal(view.getUint32(40, true), 80000);
  assert.equal(wav.length, 44 + 80000);
  assert.ok(wav.slice(44).every((byte) => byte === 128), "carrier must be digital silence");
}

assert.equal(positionOf({ duration: 0, progress: 0.5 }), null);
assert.deepEqual(positionOf({ duration: 20, progress: 0.25 }), { duration: 20, playbackRate: 1, position: 5 });
assert.deepEqual(positionOf({ duration: 20, progress: 3 }), { duration: 20, playbackRate: 1, position: 20 });
assert.deepEqual(positionOf({ duration: 20, progress: Number.NaN }), { duration: 20, playbackRate: 1, position: 0 });

{
  const { session, log } = fakeSession();
  const positions = [];
  session.setPositionState = (value) => positions.push(value ?? null);
  const carrier = { calls: [], attach() { this.calls.push("attach"); }, play() { this.calls.push("play"); return Promise.reject(new Error("NotAllowedError")); }, pause() { this.calls.push("pause"); }, release() { this.calls.push("release"); } };
  let at = 0;
  const media = createMediaSession({ navigator: { mediaSession: session }, MediaMetadata: FakeMetadata, base: BASE, artist: "Alamut", onPlay() {}, onPause() {}, carrier, now: () => at });
  media.update({ title: "Let It Be", playing: false, duration: 20, progress: 0 });
  assert.deepEqual(carrier.calls, ["pause"]);
  for (let n = 0; n < 20; n += 1) {
    at = n * 0.5;
    media.update({ title: "Let It Be", playing: true, duration: 20, progress: at / 20 });
  }
  assert.deepEqual(carrier.calls, ["pause", "attach", "play"], "carrier follows state changes only");
  at = 10;
  media.update({ title: "Let It Be", playing: false, duration: 20, progress: 0.5 });
  media.update({ title: null, playing: false, duration: 0, progress: 0 });
  assert.deepEqual(carrier.calls, ["pause", "attach", "play", "pause", "pause", "release"]);
  assert.deepEqual(positions, [
    { duration: 20, playbackRate: 1, position: 0 },
    { duration: 20, playbackRate: 1, position: 0 },
    { duration: 20, playbackRate: 1, position: 10 },
    null,
  ]);
  assert.deepEqual(log.state, ["paused", "playing", "paused", "none"]);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

{
  const { session, log } = fakeSession();
  const carrier = { attach() { throw new Error("no media"); }, play() {}, pause() { throw new Error("no media"); }, release() {} };
  const media = createMediaSession({ navigator: { mediaSession: session }, MediaMetadata: FakeMetadata, base: BASE, artist: "Alamut", onPlay() {}, onPause() {}, carrier });
  assert.doesNotThrow(() => media.update({ title: "Let It Be", playing: true, duration: 20, progress: 0 }));
  assert.doesNotThrow(() => media.update({ title: "Let It Be", playing: false, duration: 20, progress: 0 }));
  assert.deepEqual(log.state, ["playing", "paused"]);
}

assert.equal(projectedPosition({ duration: 8, position: 6, rate: 1, at: 10 }, 13), 8);
assert.equal(projectedPosition({ duration: 8, position: 6, rate: 0, at: 10 }, 13), 6);
assert.equal(projectedPosition({ duration: 8, position: 2, rate: 1, at: 10 }, 9), 2);

{
  const saved = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let clock = 100;
  let frame = null;
  let serial = 0;
  globalThis.requestAnimationFrame = (fn) => {
    frame = fn;
    return ++serial;
  };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.setTimeout = () => ++serial;
  globalThis.clearTimeout = () => {};
  try {
    const { session } = fakeSession();
    const positions = [];
    session.setPositionState = (value) => positions.push(value ?? null);
    const media = createMediaSession({ navigator: { mediaSession: session }, MediaMetadata: FakeMetadata, base: BASE, artist: "Alamut", onPlay() {}, onPause() {}, now: () => clock });
    const sound = { ready: () => true, resume: async () => {}, now: () => clock, latency: () => 0, strikeChord: () => () => {} };
    let piece = { id: "first", bpm: 60, loopBeats: 8, steps: [{ beat: 0, note: "D3" }, { beat: 6, note: "A3" }] };
    const player = createPlayer(sound, (snap) => media.update({ title: piece.id, playing: snap.playing, duration: (piece.loopBeats * 60) / snap.bpm, progress: snap.progress }));
    const near = (value, expected, label) => assert.ok(Math.abs(value - expected) < 0.1, `${label}: ${value} vs ${expected}`);

    player.load(piece);
    near(positions.at(-1).position, 0, "loaded");
    player.seek(1, false, true);
    assert.equal(player.snapshot().progress, 0.75);
    near(positions.at(-1).position, 6, "paused seek moves the OS position");
    assert.equal(positions.at(-1).duration, 8);

    await player.resume();
    near(positions.at(-1).position, 6, "resume anchors at the paused position");

    const beforeSteady = positions.length;
    for (let step = 1; step <= 10; step += 1) {
      clock += 0.15;
      frame?.();
    }
    assert.equal(positions.length, beforeSteady, "steady playback writes no position");

    player.seek(0, true, true);
    await Promise.resolve();
    near(positions.at(-1).position, 0, "seek while playing re-anchors");

    const wrapStart = clock;
    clock = wrapStart + 8.06;
    frame?.();
    assert.ok(player.snapshot().progress < 0.02, "player wrapped");
    assert.ok(positions.at(-1).position < 0.2, `loop wrap re-anchors at ${positions.at(-1).position}`);

    player.pause();
    const pausedAt = positions.at(-1);
    piece = { ...piece, id: "second", loopBeats: 16 };
    player.load(piece);
    assert.equal(session.metadata.title, "second");
    assert.equal(positions.at(-1).duration, 16, "piece change while paused updates the duration");
    near(positions.at(-1).position, 0, "piece change while paused resets the position");
    assert.notEqual(positions.at(-1), pausedAt);

    player.setTempo(120);
    assert.equal(positions.at(-1).duration, 8, "tempo change updates the duration");

    const quiet = positions.length;
    for (let step = 0; step < 5; step += 1) player.refresh();
    assert.equal(positions.length, quiet, "repeated paused paints write no position");
  } finally {
    Object.assign(globalThis, saved);
  }
}

const main = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
const paintAt = main.indexOf("function paint(snap) {");
assert.ok(paintAt >= 0);
assert.ok(main.slice(paintAt, paintAt + 300).includes("mediaSession.update("), "paint must update the media session");
const wiring = main.slice(main.indexOf("const mediaSession = createMediaSession("), main.indexOf("const listener = createListener("));
assert.ok(wiring.includes('document.getElementById("play")?.click()'), "OS play must reuse the Play button path");
assert.ok(wiring.includes("pausePractice()"), "OS controls must go through practice when it is active");
assert.equal(/setActionHandler|seekto|nexttrack|previoustrack/.test(wiring), false);
assert.ok(wiring.includes('"mediaSession" in navigator ? mediaCarrier() : null'), "the silent carrier is created only where Media Session exists");
const carrierCode = main.slice(main.indexOf("function mediaCarrier()"), main.indexOf("const mediaSession = createMediaSession("));
assert.ok(carrierCode.includes("element.loop = true") && carrierCode.includes("silentWavBytes()"), "carrier is a looping silent element");
assert.equal(/connect|createMediaStreamDestination|srcObject/.test(carrierCode), false, "Web Audio output stays on its own path");

console.log("media session ok");
