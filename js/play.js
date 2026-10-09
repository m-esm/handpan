import { eventsOf } from "./score.js";

export function createPlayer(audio, emit) {
  const state = {
    pattern: null,
    events: [],
    bpm: 72,
    loop: true,
    playing: false,
    origin: 0,
    cursor: 0,
    startCursor: 0,
    index: -1,
    timer: 0,
    raf: 0,
    armed: [],
    token: 0,
  };

  function snapshot() {
    const event = state.index >= 0 ? state.events[state.index] : null;
    const following = state.index >= 0 ? state.index + 1 : 0;
    const canShowNext = state.events.length > 0 && (state.loop || following < state.events.length);
    const next = canShowNext ? state.events[following % state.events.length] : null;
    return {
      playing: state.playing,
      patternId: state.pattern ? state.pattern.id : null,
      index: state.index,
      notes: event ? event.notes : [],
      hands: event ? event.hands : {},
      nextIndex: next ? next.index : -1,
      nextNotes: next ? next.notes : [],
      bpm: state.bpm,
      loop: state.loop,
    };
  }

  function emitNow() {
    emit(snapshot());
  }

  function clearFuture() {
    if (!audio.ready()) {
      state.armed = [];
      return;
    }
    const now = audio.now();
    let rewound = null;
    for (const item of state.armed) {
      if (item.time > now + 0.03) {
        item.cancel();
        if (rewound === null || item.ordinal < rewound) rewound = item.ordinal;
      }
    }
    if (rewound !== null) state.cursor = rewound;
    state.armed = state.armed.filter((item) => item.time <= now + 0.03);
  }

  function halt() {
    state.playing = false;
    clearTimeout(state.timer);
    cancelAnimationFrame(state.raf);
    clearFuture();
  }

  function limit() {
    if (state.loop || state.events.length === 0) return Infinity;
    const pass = Math.floor(state.startCursor / state.events.length);
    return (pass + 1) * state.events.length;
  }

  function tick() {
    if (!state.playing) return;
    const now = audio.now();
    const spb = 60 / state.bpm;
    const ahead = now + 0.22;
    const maxOrdinal = limit();
    while (state.cursor < maxOrdinal) {
      const event = state.events[state.cursor % state.events.length];
      const loopN = Math.floor(state.cursor / state.events.length);
      const beat = loopN * state.pattern.loopBeats + event.beat;
      const time = state.origin + beat * spb;
      if (time > ahead) break;
      if (time >= now - 0.05) {
        const when = Math.max(time, now + 0.01);
        const cancel = audio.strikeChord(event.notes, when);
        state.armed.push({
          time: when,
          ordinal: state.cursor,
          index: event.index,
          cancel,
        });
      }
      state.cursor += 1;
    }
    const last = state.armed[state.armed.length - 1];
    if (state.cursor >= maxOrdinal && (!last || last.time < now - 0.4)) {
      halt();
      emitNow();
      return;
    }
    state.timer = setTimeout(tick, 25);
  }

  function frame() {
    if (!state.playing) return;
    const t = audio.now() + 0.04;
    let current = null;
    for (const item of state.armed) {
      if (item.time <= t) current = item;
    }
    if (current) state.index = current.index;
    state.armed = state.armed.filter((item) => item === current || item.time > t - 0.5);
    emitNow();
    state.raf = requestAnimationFrame(frame);
  }

  async function play(pattern, fromBeat = 0, options = {}) {
    const token = ++state.token;
    await audio.resume();
    if (token !== state.token) return;
    const keep = options.keepTempo && state.pattern && state.pattern.id === pattern.id;
    const bpm = keep ? state.bpm : pattern.bpm;
    halt();
    state.pattern = pattern;
    state.events = eventsOf(pattern);
    state.bpm = bpm;
    const found = state.events.findIndex((event) => event.beat >= fromBeat - 0.001);
    const idx = found < 0 ? 0 : found;
    const event = state.events[idx];
    const now = audio.now() + 0.05;
    state.origin = now - event.beat * (60 / state.bpm);
    state.cursor = idx;
    state.startCursor = idx;
    state.index = -1;
    state.playing = true;
    tick();
    frame();
  }

  function load(pattern) {
    halt();
    state.pattern = pattern;
    state.events = eventsOf(pattern);
    state.bpm = pattern.bpm;
    state.loop = true;
    state.index = 0;
    state.cursor = 0;
    state.startCursor = 0;
    emitNow();
  }

  function pause() {
    if (!state.playing) return;
    halt();
    emitNow();
  }

  async function resume() {
    if (state.playing || !state.pattern || state.events.length === 0) return;
    if (!state.loop && state.cursor >= state.events.length) {
      await play(state.pattern, 0, { keepTempo: true });
      return;
    }
    const token = ++state.token;
    await audio.resume();
    if (token !== state.token) return;
    const event = state.events[state.cursor % state.events.length];
    const loopN = Math.floor(state.cursor / state.events.length);
    const beat = loopN * state.pattern.loopBeats + event.beat;
    const now = audio.now() + 0.05;
    state.origin = now - beat * (60 / state.bpm);
    state.startCursor = state.cursor;
    state.playing = true;
    tick();
    frame();
  }

  function seek(index, andPlay) {
    const event = state.events[index];
    if (!event || !state.pattern) return;
    if (andPlay) {
      play(state.pattern, event.beat, { keepTempo: true });
      return;
    }
    halt();
    state.index = index;
    state.cursor = index;
    audio.resume().then(() => audio.strikeChord(event.notes, audio.now() + 0.02));
    emitNow();
  }

  function setTempo(bpm) {
    const next = Math.min(140, Math.max(48, Math.round(bpm)));
    if (state.playing && audio.ready()) {
      const now = audio.now();
      const beatNow = (now - state.origin) / (60 / state.bpm);
      state.bpm = next;
      state.origin = now - beatNow * (60 / next);
      clearFuture();
      clearTimeout(state.timer);
      tick();
    } else {
      state.bpm = next;
    }
    emitNow();
  }

  function setLoop(loop) {
    state.loop = loop;
    if (state.playing) {
      clearFuture();
      clearTimeout(state.timer);
      tick();
    } else {
      emitNow();
    }
  }

  return {
    play,
    load,
    pause,
    resume,
    seek,
    setTempo,
    setLoop,
    snapshot,
    refresh: emitNow,
    get playing() {
      return state.playing;
    },
    get pattern() {
      return state.pattern;
    },
    get index() {
      return state.index;
    },
    get cursor() {
      return state.cursor;
    },
    get bpm() {
      return state.bpm;
    },
    get loop() {
      return state.loop;
    },
    get canResume() {
      return !!state.pattern && state.cursor > 0;
    },
    get length() {
      return state.events.length;
    },
  };
}
