import { NOTES, TAK } from "./score.js";

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let recording = false;

  function recordingMode(enabled) {
    recording = enabled;
    try {
      if (navigator.audioSession) navigator.audioSession.type = recording ? "play-and-record" : "playback";
    } catch (err) {
      void err;
    }
  }

  function roomBuffer(audio) {
    const length = Math.floor(audio.sampleRate * 2.4);
    const buffer = audio.createBuffer(2, length, audio.sampleRate);
    let energy = 0;
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        smooth += (Math.random() * 2 - 1 - smooth) * (0.55 - 0.4 * t);
        data[i] = smooth * Math.pow(1 - t, 2.6);
        energy += data[i] * data[i];
      }
    }
    const scale = 1 / Math.sqrt(energy / 2);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) data[i] *= scale;
    }
    return buffer;
  }

  function context() {
    if (ctx) return ctx;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;
    const room = ctx.createConvolver();
    room.normalize = false;
    room.buffer = roomBuffer(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    master.connect(comp);
    master.connect(room);
    room.connect(wet);
    wet.connect(comp);
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
    recordingMode(recording);
    const audio = context();
    if (audio.state !== "running") await audio.resume();
    return audio;
  }

  function stopper(sources) {
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

  function burst(audio, t, out, hz, q, level) {
    const click = audio.createBufferSource();
    click.buffer = noise(audio);
    const band = audio.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = hz;
    band.Q.value = q;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    click.connect(band);
    band.connect(gain);
    gain.connect(out);
    click.start(t);
    click.stop(t + 0.04);
    return click;
  }

  function partial(audio, t, out, hz, level, ring) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(hz, t);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.005);
    gain.gain.setTargetAtTime(0, t + 0.005, ring / 6.9);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + ring + 0.2);
    return osc;
  }

  function openVowel(audio, t, out) {
    const first = audio.createBiquadFilter();
    first.type = "peaking";
    first.Q.value = 1.6;
    first.gain.value = 7;
    first.frequency.setValueAtTime(430, t);
    first.frequency.exponentialRampToValueAtTime(760, t + 0.1);
    const second = audio.createBiquadFilter();
    second.type = "peaking";
    second.Q.value = 2.4;
    second.gain.value = 3.5;
    second.frequency.setValueAtTime(900, t);
    second.frequency.exponentialRampToValueAtTime(1250, t + 0.1);
    out.connect(first);
    first.connect(second);
    second.connect(master);
  }

  function tak(audio, t, amp) {
    const out = audio.createGain();
    out.gain.value = 0.55 * amp;
    out.connect(master);
    return stopper([
      burst(audio, t, out, 2600, 1.4, 0.9),
      partial(audio, t, out, 1180, 0.07, 0.12),
      partial(audio, t, out, 1760, 0.05, 0.09),
    ]);
  }

  function strike(id, when, amp = 1) {
    const audio = context();
    const t = when ?? audio.currentTime;
    if (id === TAK) return tak(audio, t, amp);
    const note = NOTES[id];
    const ring = note.ding ? 4.6 : 3.3 * Math.pow(220 / note.hz, 0.4);
    const bright = 0.55 + 0.6 * amp;
    const out = audio.createGain();
    out.gain.value = (note.ding ? 0.2 : 0.16) * amp;
    openVowel(audio, t, out);
    return stopper([
      partial(audio, t, out, note.hz, 1, ring),
      partial(audio, t, out, note.hz + 0.7, 0.4, ring * 0.9),
      partial(audio, t, out, note.hz * 2, 0.5 * bright, ring * 0.6),
      partial(audio, t, out, note.hz * 3 + 0.9, 0.28 * bright, ring * 0.4),
      partial(audio, t, out, note.hz * 4.07, 0.07 * bright, 0.5),
      partial(audio, t, out, note.hz * 5.42, 0.045 * bright, 0.28),
      burst(audio, t, out, note.ding ? 1100 : 1500 + note.hz * 2, 0.9, 0.5 * amp),
    ]);
  }

  function strikeChord(ids, when, amps = {}) {
    const share = ids.length > 1 ? 0.8 : 1;
    const cancels = ids.map((id) => strike(id, when, share * (amps[id] ?? 1)));
    return () => {
      for (const cancel of cancels) cancel();
    };
  }

  return {
    recordingMode,
    resume,
    strike,
    strikeChord,
    ready: () => !!ctx,
    now: () => context().currentTime,
  };
}
