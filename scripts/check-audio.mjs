import assert from "node:assert/strict";
import { createAudio } from "../js/sound.js";

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
console.log("Audio checks passed: independent playback, synthesis, interrupted resume, recording mode transitions and unsupported API fallback.");
