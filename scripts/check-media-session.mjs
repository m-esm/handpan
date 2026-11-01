import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaSession, playbackStateOf, MEDIA_ACTIONS } from "../js/media-session.js";

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

const main = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
const paintAt = main.indexOf("function paint(snap) {");
assert.ok(paintAt >= 0);
assert.ok(main.slice(paintAt, paintAt + 300).includes("mediaSession.update("), "paint must update the media session");
const wiring = main.slice(main.indexOf("const mediaSession = createMediaSession("), main.indexOf("const listener = createListener("));
assert.ok(wiring.includes('document.getElementById("play")?.click()'), "OS play must reuse the Play button path");
assert.ok(wiring.includes("pausePractice()"), "OS controls must go through practice when it is active");
assert.equal(/setActionHandler|seekto|nexttrack|previoustrack/.test(wiring), false);

console.log("media session ok");
