import { NOTES } from "./score.js";

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  function context() {
    if (ctx) return ctx;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  function noise(audio) {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(audio.sampleRate * 0.035);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const env = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    noiseBuffer = buffer;
    return buffer;
  }

  async function resume() {
    const audio = context();
    if (audio.state === "suspended") await audio.resume();
    return audio;
  }

  function strike(id, when, amp = 1) {
    const audio = context();
    const note = NOTES[id];
    const t = when ?? audio.currentTime;
    const dur = note.ding ? 3.5 : 2.05;
    const env = audio.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime((note.ding ? 0.5 : 0.38) * amp, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(master);

    const partials = note.ding
      ? [
          [1, 0.62, 0],
          [2, 0.36, 0],
          [3, 0.08, 1.2],
          [4.02, 0.035, 3],
        ]
      : [
          [1, 0.55, 0],
          [2, 0.3, 0.3],
          [2.995, 0.08, 1.5],
          [5.03, 0.04, 4],
        ];

    const sources = [];
    for (const [ratio, gain, detune] of partials) {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.hz * ratio + detune, t);
      const level = audio.createGain();
      level.gain.value = gain;
      osc.connect(level);
      level.connect(env);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      sources.push(osc);
    }

    const click = audio.createBufferSource();
    click.buffer = noise(audio);
    const band = audio.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = note.ding ? 900 : 1800;
    band.Q.value = 0.7;
    const clickGain = audio.createGain();
    clickGain.gain.setValueAtTime(note.ding ? 0.22 : 0.28, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    click.connect(band);
    band.connect(clickGain);
    clickGain.connect(env);
    click.start(t);
    click.stop(t + 0.04);
    sources.push(click);

    return () => {
      for (const source of sources) {
        try {
          source.stop();
        } catch (err) {
          void err;
        }
      }
    };
  }

  function strikeChord(ids, when) {
    const amp = ids.length > 1 ? 0.78 : 1;
    const cancels = ids.map((id) => strike(id, when, amp));
    return () => {
      for (const cancel of cancels) cancel();
    };
  }

  return {
    resume,
    strike,
    strikeChord,
    ready: () => !!ctx,
    now: () => context().currentTime,
  };
}
