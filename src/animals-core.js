// Čistá logika túlania zvierat (bez three.js): sliepka či pes si vyberie cieľ
// okolo svojej kotvy, dokráča k nemu a na chvíľu zastane. Drží sa pritom
// v okruhu kotvy, takže neodíde z dvora.
const TWO_PI = Math.PI * 2;

/** Deterministický hash → [0, 1): rovnaký seed dá rovnakú trasu. */
function noise(seed) {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Tulák okolo kotvy (x, z). `step(dt)` posunie zviera o krok a vráti stav
 * `{ x, z, heading, mode, phase }`; `mode` je `'walk'` alebo `'pause'`.
 */
export function createWanderer({
  x,
  z,
  radius = 6,
  speed = 1.1,
  seed = 1,
  pauseMin = 1,
  pauseMax = 3,
}) {
  const state = {
    x,
    z,
    anchorX: x,
    anchorZ: z,
    targetX: x,
    targetZ: z,
    mode: 'pause',
    timer: 0.4 + noise(seed) * 1.2,
    phase: noise(seed * 2.3) * TWO_PI,
    heading: noise(seed * 3.7) * TWO_PI,
    steps: 0,
    seed,
    radius,
  };

  /** Vyberie nový cieľ v okruhu kotvy a rozbehne sa. */
  function pickTarget() {
    state.steps += 1;
    const angle = noise(state.seed * 5.1 + state.steps * 1.7) * TWO_PI;
    const distance = radius * (0.35 + noise(state.seed * 7.3 + state.steps * 2.1) * 0.65);
    state.targetX = state.anchorX + Math.cos(angle) * distance;
    state.targetZ = state.anchorZ + Math.sin(angle) * distance;
    state.mode = 'walk';
  }

  function step(dt) {
    state.phase += dt * 3.4;
    if (state.mode === 'pause') {
      state.timer -= dt;
      if (state.timer <= 0) pickTarget();
      return state;
    }
    const dx = state.targetX - state.x;
    const dz = state.targetZ - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.2) {
      state.mode = 'pause';
      state.timer = pauseMin + noise(state.seed * 11.7 + state.steps) * (pauseMax - pauseMin);
      return state;
    }
    const move = Math.min(distance, speed * dt);
    state.x += (dx / distance) * move;
    state.z += (dz / distance) * move;
    state.heading = Math.atan2(dx, dz);
    return state;
  }

  return { state, step, pickTarget };
}
