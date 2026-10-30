import { eventsOf } from "./score.js";

export function createPlayer(audio, emit) {
  const state = {
    pattern: null,
    all: [],
    events: [],
    range: null,
    from: 0,
    span: 0,
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
    ended: false,
  };

  function heardNow() {
    return audio.now() - audio.latency() + 0.04;
  }

  function posOf(index) {
    return state.events.findIndex((event) => event.index === index);
  }

  function setWindow(range) {
    const inside = range
      ? state.all.filter((event) => event.beat >= range.from - 0.001 && event.beat < range.to - 0.001)
      : [];
    if (!range) {
      state.range = null;
      state.events = state.all;
      state.from = 0;
      state.span = state.pattern.loopBeats;
      return;
    }
    state.range = range;
    state.events = inside;
    state.from = range.from;
    state.span = range.to - range.from;
  }

  function adopt(pattern) {
    state.pattern = pattern;
    state.all = eventsOf(pattern);
    setWindow(null);
  }

  function snapshot() {
    const event = state.index >= 0 ? state.all[state.index] : null;
    const following = posOf(state.index) + 1;
    const canShowNext = state.events.length > 0 && (state.loop || following < state.events.length);
    const next = canShowNext ? state.events[following % state.events.length] : null;
    return {
      playing: state.playing,
      ended: state.ended,
      patternId: state.pattern ? state.pattern.id : null,
      index: state.index,
      notes: event ? event.notes : [],
      hands: event ? event.hands : {},
      nextIndex: next ? next.index : -1,
      nextNotes: next ? next.notes : [],
      bpm: state.bpm,
      loop: state.loop,
      range: state.range,
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

  function dropArmed() {
    if (audio.ready()) {
      const now = audio.now();
      for (const item of state.armed) {
        if (item.time > now + 0.03) item.cancel();
      }
    }
    state.armed = [];
  }

  function halt() {
    state.playing = false;
    clearTimeout(state.timer);
    cancelAnimationFrame(state.raf);
    dropArmed();
  }

  function soundingOrdinal() {
    if (audio.ready() && state.armed.length) {
      const t = heardNow();
      let current = null;
      for (const item of state.armed) {
        if (item.time <= t) current = item;
      }
      if (current) return current.ordinal;
    }
    return Math.max(state.cursor - 1, 0);
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
      const beat = loopN * state.span + event.beat - state.from;
      const time = state.origin + beat * spb;
      if (time > ahead) break;
      if (time >= now - 0.05) {
        const when = Math.max(time, now + 0.01);
        const cancel = audio.strikeChord(event.notes, when, event.amps);
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
    const endTime = state.origin + (Math.floor(state.startCursor / state.events.length) + 1) * state.span * spb;
    const finished = state.range ? now >= endTime : (!last || last.time < now - 0.4);
    if (state.cursor >= maxOrdinal && finished) {
      state.ended = true;
      halt();
      emitNow();
      return;
    }
    state.timer = setTimeout(tick, 25);
  }

  function frame() {
    if (!state.playing) return;
    const t = heardNow();
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
    state.ended = false;
    if (!state.pattern || state.pattern.id !== pattern.id) adopt(pattern);
    state.bpm = bpm;
    if (!state.events.length) {
      emitNow();
      return;
    }
    const found = state.events.findIndex((event) => event.beat >= fromBeat - 0.001);
    const idx = found < 0 ? 0 : found;
    const event = state.events[idx];
    const now = audio.now() + 0.05;
    const startBeat = state.range && fromBeat <= state.range.from ? state.range.from : event.beat;
    state.origin = now - (startBeat - state.from) * (60 / state.bpm);
    state.cursor = idx;
    state.startCursor = idx;
    state.index = event.index;
    state.playing = true;
    tick();
    frame();
  }

  function load(pattern) {
    state.token += 1;
    halt();
    state.ended = false;
    adopt(pattern);
    state.bpm = pattern.bpm;
    state.loop = pattern.loop !== false;
    state.index = 0;
    state.cursor = 0;
    state.startCursor = 0;
    emitNow();
  }

  function pause() {
    state.token += 1;
    if (!state.playing) return;
    state.ended = false;
    halt();
    emitNow();
  }

  async function resume() {
    if (state.playing || !state.pattern || state.events.length === 0) return;
    if (state.ended || state.index < 0) {
      await play(state.pattern, 0, { keepTempo: true });
      return;
    }
    const event = state.all[state.index];
    await play(state.pattern, event.beat, { keepTempo: true });
  }

  function seek(index, andPlay, silent) {
    const event = state.all[index];
    if (!event || !state.pattern) return;
    if (posOf(index) < 0) {
      setWindow(null);
      state.loop = state.pattern.loop !== false;
    }
    if (andPlay) {
      play(state.pattern, event.beat, { keepTempo: true });
      return;
    }
    const token = ++state.token;
    halt();
    state.ended = false;
    state.index = index;
    state.cursor = posOf(index);
    if (!silent) audio.resume().then(() => {
      if (token === state.token) audio.strikeChord(event.notes, audio.now() + 0.02, event.amps);
    });
    emitNow();
  }

  function step(dir, silent) {
    const total = state.events.length;
    if (!total) return;
    const at = posOf(state.index);
    const next = at < 0 ? 0 : (at + dir + total) % total;
    seek(state.events[next].index, state.playing, silent);
  }

  function setRange(range) {
    if (!state.pattern) return;
    state.token += 1;
    halt();
    state.ended = false;
    setWindow(range);
    state.loop = state.range ? true : state.pattern.loop !== false;
    if (posOf(state.index) < 0) state.index = state.events[0]?.index ?? -1;
    state.cursor = posOf(state.index);
    state.startCursor = state.cursor;
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
    if (!loop && state.events.length > 0) {
      const lap = Math.floor(soundingOrdinal() / state.events.length);
      state.startCursor = lap * state.events.length;
    }
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
    step,
    setRange,
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
    get range() {
      return state.range;
    },
  };
}
