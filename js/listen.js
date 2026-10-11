import { NOTES } from "./score.js";

export const BIG = 8192;
export const SMALL = 1024;
export const TICK_MS = 15;

const SETTLE_MS = 80;
const REST_MS = 95;
const BEFORE_MS = 40;
const FLUX_FLOOR = 0.002;
const FLUX_OVER_USUAL = 3;
const USUAL_RANK = 0.5;
const ECHO_MS = 250;
const AMP_FLOOR = 0.0006;
const TONAL_RATIO = 4;
const WEIGHTS = [1, 0.7, 0.4];
const MIN_FUNDAMENTAL = 0.1;
const MIN_SCORE = 0.9;
const BAND_CENTS = 12;

const power = (db) => 10 ** (db / 10);

export function createDetector(sampleRate) {
  const bigHz = sampleRate / BIG;
  const smallHz = sampleRate / SMALL;
  const fluxLo = Math.ceil(120 / smallHz);
  const fluxHi = Math.floor(4000 / smallHz);
  const meanLo = Math.round(100 / bigHz);
  const meanHi = Math.round(2000 / bigHz);
  const voices = Object.values(NOTES).map((note) => ({
    id: note.id,
    bands: WEIGHTS.map((weight, k) => {
      const hz = note.hz * (k + 1);
      return [
        Math.floor((hz * 2 ** (-BAND_CENTS / 1200)) / bigHz),
        Math.ceil((hz * 2 ** (BAND_CENTS / 1200)) / bigHz),
      ];
    }),
  }));

  const frames = [];
  const fluxes = [];
  let last = null;
  let pending = null;
  let quietUntil = 0;
  let echo = { id: null, at: 0 };

  function measure(at, bigDb) {
    const levels = voices.map((voice) =>
      voice.bands.map(([lo, hi]) => {
        let top = 0;
        for (let i = lo; i <= hi; i += 1) top = Math.max(top, power(bigDb[i]));
        return top;
      }),
    );
    let sum = 0;
    for (let i = meanLo; i <= meanHi; i += 1) sum += power(bigDb[i]);
    return { at, levels, mean: sum / (meanHi - meanLo + 1) };
  }

  function classify(ref, cur) {
    const amps = voices.map((voice, n) =>
      voice.bands.map((band, k) => Math.sqrt(Math.max(0, cur.levels[n][k] - ref.levels[n][k]))),
    );
    const top = Math.max(...amps.flat());
    const spread = Math.sqrt(Math.max(0, cur.mean - ref.mean));
    if (top < AMP_FLOOR || top < TONAL_RATIO * spread) return null;
    const scores = {};
    let best = null;
    voices.forEach((voice, n) => {
      const score = amps[n].reduce((sum, amp, k) => sum + WEIGHTS[k] * amp, 0) / top;
      scores[voice.id] = score;
      if (amps[n][0] < MIN_FUNDAMENTAL * top) return;
      if (!best || score > best.score) best = { id: voice.id, score };
    });
    return best && best.score >= MIN_SCORE ? { id: best.id, scores } : null;
  }

  function fluxOf(smallDb) {
    const mags = new Float32Array(fluxHi - fluxLo + 1);
    let flux = 0;
    for (let i = fluxLo; i <= fluxHi; i += 1) {
      const mag = 10 ** (smallDb[i] / 20);
      mags[i - fluxLo] = mag;
      if (last) flux += Math.max(0, mag - last[i - fluxLo]);
    }
    last = mags;
    return flux;
  }

  function feed(at, smallDb, bigDb) {
    const frame = measure(at, bigDb);
    frames.push(frame);
    if (frames.length > 12) frames.shift();
    const flux = fluxOf(smallDb);
    const sorted = [...fluxes].sort((a, b) => a - b);
    const usual = sorted.length ? sorted[Math.floor(sorted.length * USUAL_RANK)] : 0;
    fluxes.push(flux);
    if (fluxes.length > 40) fluxes.shift();

    let heard = null;
    if (pending && at >= pending.at + SETTLE_MS) {
      heard = classify(pending.ref, frame);
      pending = null;
      if (heard && heard.id === echo.id && at < echo.at + ECHO_MS) heard = null;
      if (heard) echo = { id: heard.id, at };
    }
    if (!pending && at >= quietUntil && flux > FLUX_FLOOR && flux > FLUX_OVER_USUAL * usual) {
      const before = frames.filter((item) => item.at <= at - BEFORE_MS);
      pending = { at, ref: before.length ? before[before.length - 1] : frames[0] };
      quietUntil = at + REST_MS;
    }
    return heard;
  }

  return { feed };
}

export function createListener(onHeard) {
  let ctx = null;
  let stream = null;
  let timer = 0;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const big = ctx.createAnalyser();
    big.fftSize = BIG;
    big.smoothingTimeConstant = 0;
    const small = ctx.createAnalyser();
    small.fftSize = SMALL;
    small.smoothingTimeConstant = 0;
    source.connect(big);
    source.connect(small);
    const bigDb = new Float32Array(big.frequencyBinCount);
    const smallDb = new Float32Array(small.frequencyBinCount);
    const detector = createDetector(ctx.sampleRate);
    timer = setInterval(() => {
      big.getFloatFrequencyData(bigDb);
      small.getFloatFrequencyData(smallDb);
      const heard = detector.feed(performance.now(), smallDb, bigDb);
      if (heard) onHeard(heard);
    }, TICK_MS);
  }

  function stop() {
    clearInterval(timer);
    if (stream) for (const track of stream.getTracks()) track.stop();
    if (ctx) ctx.close();
    stream = null;
    ctx = null;
  }

  return {
    start,
    stop,
    get on() {
      return !!stream;
    },
  };
}

const NEAR_BEST = 0.6;

export function accepts(heard, wanted) {
  return wanted.some((id) => id === heard.id || heard.scores[id] >= NEAR_BEST * heard.scores[heard.id]);
}
