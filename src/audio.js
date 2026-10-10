// Procedural WebAudio: village ambience, three radio stations and gameplay SFX.
// The context is created lazily on the first user gesture (browser policy).
const STATIONS = [
  { name: 'Playback FM', root: 220, scale: [0, 2, 4, 7, 9], tempo: 3.2 },
  { name: 'K-DST', root: 174, scale: [0, 3, 5, 7, 10], tempo: 2.4 },
  { name: 'Radio Los Santos', root: 262, scale: [0, 2, 3, 7, 8], tempo: 4.2 },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let radioTimer = null;
  let radioStep = 0;
  let current = 0;
  const state = { radioOn: false };

  function resume() {
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startAmbience();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function startAmbience() {
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
  }

  function note(frequency, duration, type = 'triangle', level = 0.25, target = null) {
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

  function startRadio() {
    if (!ctx || state.radioOn) return;
    radioGain = ctx.createGain();
    radioGain.gain.value = 0.5;
    radioGain.connect(master);
    state.radioOn = true;
    radioStep = 0;
    const station = STATIONS[current];
    const period = 60 / station.tempo / 2;
    radioTimer = setInterval(() => {
      if (!state.radioOn) return;
      const semi = station.scale[radioStep % station.scale.length];
      note(station.root * Math.pow(2, semi / 12), 0.3);
      radioStep += 1;
    }, period * 1000);
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

  function setStation(index) {
    current = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
    if (state.radioOn) {
      stopRadio();
      startRadio();
    }
  }

  function noiseBurst({ duration = 0.12, level = 0.3, frequency = 1800, type = 'lowpass' }) {
    if (!ctx) return;
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
    if (!ctx) return;
    if (kind === 'footstep') noiseBurst({ duration: 0.08, level: 0.12, frequency: 900 });
    else if (kind === 'gunshot') {
      noiseBurst({ duration: 0.18, level: 0.5, frequency: 3200 });
      note(90, 0.12, 'square', 0.2);
    } else if (kind === 'engine') noiseBurst({ duration: 0.05, level: 0.06, frequency: 400 });
    else if (kind === 'hit') noiseBurst({ duration: 0.1, level: 0.3, frequency: 1200 });
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
    currentStation: () => current,
    isRadioOn: () => state.radioOn,
    playSfx,
  };
}
