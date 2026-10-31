import assert from "node:assert/strict";
import { createAudio } from "../js/sound.js";
import { createListener } from "../js/listen.js";

const sessions = [];
let mode = "auto";
let micRequests = 0;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  audioSession: { get type() { return mode; }, set type(value) { mode = value; sessions.push(value); } },
  mediaDevices: { getUserMedia() { micRequests++; throw new Error("Unexpected microphone request"); } },
} });
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => ({ connect() {}, gain: param(), frequency: param(), Q: param(), start() { starts++; }, stop() {} });
let starts = 0;
let instance;
class Context {
  state = "suspended";
  sampleRate = 100;
  currentTime = 1;
  destination = {};
  resumes = 0;
  constructor() { instance = this; }
  createGain = node;
  createOscillator = node;
  createBufferSource = node;
  createBiquadFilter = node;
  createConvolver = node;
  createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
  createBuffer(channels, length) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: channel => data[channel] }; }
  async resume() { this.resumes++; this.state = "running"; }
}
globalThis.AudioContext = Context;
const audio = createAudio();
assert.equal(audio.ready(), false);
await audio.resume();
assert.equal(mode, "playback", "A fresh note must use music playback without microphone access");
assert.equal(instance.resumes, 1);
audio.strikeChord(["D3"], audio.now());
assert.equal(starts, 7);
assert.equal(micRequests, 0);
instance.state = "interrupted";
await audio.resume();
assert.equal(instance.state, "running");
assert.equal(instance.resumes, 2);
audio.recordingMode(true);
await audio.resume();
assert.equal(mode, "play-and-record");
audio.recordingMode(false);
assert.equal(mode, "playback");
delete navigator.audioSession;
await audio.resume();
Object.defineProperty(navigator, "audioSession", { configurable: true, get() { throw new Error("Unsupported"); } });
await audio.resume();
assert.equal(micRequests, 0);

for (const failAt of ["context", "analyser"]) {
  let stopped = 0;
  let closed = 0;
  const track = { addEventListener() {}, stop() { stopped++; } };
  navigator.mediaDevices.getUserMedia = async () => ({ getAudioTracks: () => [track], getTracks: () => [track] });
  globalThis.AudioContext = class {
    constructor() { if (failAt === "context") throw new Error("Context unavailable"); }
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() { throw new Error("Analyser unavailable"); }
    close() { closed++; return Promise.resolve(); }
  };
  const listener = createListener(() => {});
  await assert.rejects(listener.start(), /unavailable/);
  assert.equal(listener.on, false, "failed microphone setup must not retain the stream");
  assert.equal(stopped, 1, "failed microphone setup must stop every acquired track");
  assert.equal(closed, failAt === "context" ? 0 : 1);
  assert.equal(listener.level(), 0);
  listener.stop();
  assert.equal(stopped, 1);
}
console.log("Audio checks passed: independent playback, synthesis, interrupted resume, recording mode transitions, unsupported API fallback and failed microphone setup cleanup.");
