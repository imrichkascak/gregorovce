// Procedural WebAudio: village ambience, six radio stations with DJ breaks and
// gameplay SFX. The context is created lazily on the first user gesture (browser
// policy) and every sound bed starts silent until the player switches it on.
import { STATIONS, advance, createRadioPlan, nextStation as planNextStation, setStation as planSetStation, stationAt } from './radio-core.js';

// Each kind is a small table of noise bursts and notes, so every weapon and every
// vehicle type has its own sound and verify can compare the profiles.
const SFX = {
  footstep: { noise: [{ duration: 0.08, level: 0.12, frequency: 900 }] },
  swing: { noise: [{ duration: 0.09, level: 0.12, frequency: 1400 }] },
  hit: { noise: [{ duration: 0.1, level: 0.3, frequency: 1200 }] },
  hurt: { notes: [{ f: 170, d: 0.16, type: 'sawtooth', level: 0.22 }] },
  ko: {
    noise: [{ duration: 0.3, level: 0.45, frequency: 500 }],
    notes: [{ f: 65, d: 0.4, type: 'square', level: 0.22 }],
  },
  wasted: {
    notes: [
      { f: 180, d: 0.5, type: 'sawtooth', level: 0.25 },
      { f: 110, d: 0.8, type: 'sawtooth', level: 0.25, delay: 0.38 },
    ],
  },
  gunshot: {
    noise: [{ duration: 0.18, level: 0.5, frequency: 3200 }],
    notes: [{ f: 90, d: 0.12, type: 'square', level: 0.2 }],
  },
  pistol: {
    noise: [{ duration: 0.15, level: 0.45, frequency: 3000 }],
    notes: [{ f: 130, d: 0.1, type: 'square', level: 0.22 }],
  },
  smg: {
    noise: [{ duration: 0.09, level: 0.32, frequency: 2600 }],
    notes: [{ f: 175, d: 0.07, type: 'square', level: 0.16 }],
  },
  ak: {
    noise: [{ duration: 0.26, level: 0.55, frequency: 2200 }],
    notes: [{ f: 70, d: 0.2, type: 'square', level: 0.24 }],
  },
  shotgun: {
    noise: [{ duration: 0.42, level: 0.55, frequency: 900 }],
    notes: [{ f: 80, d: 0.3, type: 'square', level: 0.25 }],
  },
  sniper: {
    noise: [{ duration: 0.5, level: 0.5, frequency: 2600 }],
    notes: [{ f: 120, d: 0.45, type: 'sawtooth', level: 0.2 }],
  },
  boom: {
    noise: [{ duration: 0.85, level: 0.7, frequency: 300 }],
    notes: [{ f: 48, d: 0.7, type: 'square', level: 0.3 }],
  },
  pickup: {
    notes: [
      { f: 880, d: 0.08, level: 0.18 },
      { f: 1320, d: 0.1, level: 0.18, delay: 0.09 },
    ],
  },
  horn: {
    notes: [
      { f: 420, d: 0.22, type: 'square', level: 0.14 },
      { f: 330, d: 0.24, type: 'square', level: 0.14, delay: 0.22 },
    ],
  },
  engine: { noise: [{ duration: 0.05, level: 0.06, frequency: 400 }] },
  'engine-car': {
    noise: [{ duration: 0.06, level: 0.07, frequency: 300 }],
    notes: [{ f: 48, d: 0.06, type: 'square', level: 0.05 }],
  },
  'engine-moto': {
    noise: [{ duration: 0.04, level: 0.08, frequency: 700 }],
    notes: [{ f: 110, d: 0.05, type: 'sawtooth', level: 0.04 }],
  },
  'engine-bike': { noise: [{ duration: 0.03, level: 0.03, frequency: 1400 }] },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let radioTimer = null;
  let talkHandler = null;
  let ambience = null;
  const plan = createRadioPlan();
  const MASTER_LEVEL = 0.5;
  // Hra začína úplne v tichu: master je stlmený, rádio aj dedinský tón sa
  // zapínajú až na pokyn hráča.
  const state = { radioOn: false, ambienceOn: false, muted: true };

  function applyMaster() {
    if (master) master.gain.value = state.muted ? 0 : MASTER_LEVEL;
  }

  /** Úplné stlmenie celého zvuku (SFX, rádio aj dedinský tón). */
  function setMuted(flag) {
    state.muted = !!flag;
    applyMaster();
    return state.muted;
  }

  function toggleMute() {
    return setMuted(!state.muted);
  }

  function resume() {
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = MASTER_LEVEL;
      master.connect(ctx.destination);
      applyMaster();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  /** Dedinský tón (nízky huk) — zapnutý len keď si ho hráč zapne. */
  function startAmbience() {
    if (!ctx || ambience) return;
    setMuted(false);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const gain = ctx.createGain();
    gain.gain.value = 0.015;
    osc.connect(filter).connect(gain).connect(master);
    osc.start();
    ambience = osc;
    state.ambienceOn = true;
  }

  function stopAmbience() {
    if (!ambience) return;
    try {
      ambience.stop();
    } catch {
      /* už zastavený */
    }
    ambience.disconnect();
    ambience = null;
    state.ambienceOn = false;
  }

  function toggleAmbience() {
    if (state.ambienceOn) stopAmbience();
    else startAmbience();
  }

  function note(frequency, duration, type = 'triangle', level = 0.25, target = null) {
    if (!ctx || state.muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(target ?? radioGain ?? master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /** DJ hovorí: pár krátkych slabík cez bandpass, aby to znelo ako hlásenie. */
  function speak(text) {
    if (!ctx || state.muted) return;
    const target = radioGain ?? master;
    const syllables = Math.max(3, Math.min(10, Math.round(String(text ?? '').length / 10)));
    const start = ctx.currentTime;
    for (let i = 0; i < syllables; i += 1) {
      const at = start + i * 0.13;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110 + (i % 4) * 18, at);
      osc.frequency.linearRampToValueAtTime(140 + ((i + 1) % 3) * 20, at + 0.1);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800 + (i % 3) * 250;
      filter.Q.value = 3;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(filter).connect(gain).connect(target);
      osc.start(at);
      osc.stop(at + 0.14);
    }
  }

  /** Znelka reklamy: krátky svetlý arpeggio pred hlasom. */
  function adJingle() {
    note(660, 0.1, 'triangle', 0.2, radioGain ?? master);
    setTimeout(() => note(880, 0.12, 'triangle', 0.2, radioGain ?? master), 110);
    setTimeout(() => note(1320, 0.16, 'triangle', 0.2, radioGain ?? master), 230);
  }

  /**
   * Posunie rádio o jeden beat. Noty hrá podľa stupnice stanice, každý
   * `talkEvery`-tý beat patrí DJ hláseniu alebo reklame (striedajú sa).
   */
  function step() {
    const event = advance(plan);
    if (event.kind === 'note') {
      const station = stationAt(plan.station);
      note(event.frequency, 0.3, station.wave, 0.25);
    } else {
      if (event.kind === 'ad') adJingle();
      speak(event.text);
      if (talkHandler) talkHandler(event);
    }
    return event;
  }

  function startRadio() {
    if (!ctx || state.radioOn) return;
    setMuted(false);
    radioGain = ctx.createGain();
    radioGain.gain.value = 0.5;
    radioGain.connect(master);
    state.radioOn = true;
    const station = stationAt(plan.station);
    step();
    radioTimer = setInterval(() => {
      if (!state.radioOn) return;
      step();
    }, (60 / station.tempo / 2) * 1000);
  }

  function stopRadio() {
    if (radioTimer) clearInterval(radioTimer);
    radioTimer = null;
    state.radioOn = false;
    if (radioGain) {
      radioGain.disconnect();
      radioGain = null;
    }
  }

  function toggleRadio() {
    if (state.radioOn) stopRadio();
    else startRadio();
  }

  /** Prepne stanicu a začne od začiatku (iné tempo znamená aj nový interval). */
  function setStation(index) {
    const station = planSetStation(plan, index);
    if (state.radioOn) {
      stopRadio();
      startRadio();
    }
    return station;
  }

  function nextStation() {
    return setStation(plan.station + 1);
  }

  function noiseBurst({ duration = 0.12, level = 0.3, frequency = 1800, type = 'lowpass' }) {
    if (!ctx || state.muted) return;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  function playSfx(kind) {
    if (!ctx || state.muted) return;
    const profile = SFX[kind] ?? SFX.gunshot;
    for (const burst of profile.noise ?? []) noiseBurst(burst);
    for (const tone of profile.notes ?? []) {
      const type = tone.type ?? 'triangle';
      const level = tone.level ?? 0.25;
      if (tone.delay) setTimeout(() => note(tone.f, tone.d, type, level), tone.delay * 1000);
      else note(tone.f, tone.d, type, level);
    }
  }

  return {
    stations: STATIONS,
    resume,
    state: () => ctx?.state ?? 'suspended',
    context: () => ctx,
    startRadio,
    stopRadio,
    toggleRadio,
    setStation,
    nextStation,
    currentStation: () => plan.station,
    isRadioOn: () => state.radioOn,
    step,
    radioState: () => ({
      on: state.radioOn,
      station: plan.station,
      name: stationAt(plan.station).name,
      genre: stationAt(plan.station).genre,
      beat: plan.beat,
      song: plan.song,
      talks: plan.talks,
      talk: plan.lastTalk,
      talkText: plan.lastText,
    }),
    onTalk: (handler) => {
      talkHandler = handler;
    },
    sfxKinds: () => Object.keys(SFX),
    sfxProfile: (kind) => SFX[kind] ?? null,
    startAmbience,
    stopAmbience,
    toggleAmbience,
    isAmbienceOn: () => state.ambienceOn,
    setMuted,
    toggleMute,
    isMuted: () => state.muted,
    masterGain: () => (master ? master.gain.value : null),
    playSfx,
  };
}
