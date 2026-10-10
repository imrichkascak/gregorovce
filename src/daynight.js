// Day/night cycle: moves the sun, tints the sky and turns streetlights on at dusk.
import * as THREE from 'three';

const DAY_TOP = new THREE.Color('#7eafd6');
const NIGHT_TOP = new THREE.Color('#0b1426');
const DAY_HORIZON = new THREE.Color('#e7d3b0');
const NIGHT_HORIZON = new THREE.Color('#111a28');
const DUSK_HORIZON = new THREE.Color('#e8a468');
const DAY_SUN = new THREE.Color('#fff4dd');
const DUSK_SUN = new THREE.Color('#ffb066');

export function createDayNight({ scene, sky, sun, hemi, streetlightMaterial, sunDirection }) {
  // Game time in minutes; 6 game-minutes pass per real second.
  const state = { time: 8 * 60, speed: 6, night: 0 };
  const top = new THREE.Color();
  const horizon = new THREE.Color();
  const sunColor = new THREE.Color();

  function setTime(minutes) {
    state.time = ((minutes % 1440) + 1440) % 1440;
  }

  function update(dt) {
    state.time = (state.time + dt * state.speed) % 1440;
    const t = state.time / 1440;
    const angle = (t - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle);
    sunDirection.set(Math.cos(angle) * 0.6, elevation, 0.55).normalize();

    const day = THREE.MathUtils.clamp(elevation * 1.6 + 0.15, 0, 1);
    state.night = 1 - day;
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elevation) * 3, 0, 1) * (elevation > -0.25 ? 1 : 0);

    top.copy(NIGHT_TOP).lerp(DAY_TOP, day);
    horizon.copy(NIGHT_HORIZON).lerp(DAY_HORIZON, day).lerp(DUSK_HORIZON, dusk * 0.8);
    sunColor.copy(DUSK_SUN).lerp(DAY_SUN, day);

    const uniforms = sky.material.uniforms;
    uniforms.topColor.value.copy(top);
    uniforms.horizonColor.value.copy(horizon);
    uniforms.sunColor.value.copy(sunColor);
    uniforms.sunDirection.value.copy(sunDirection);

    scene.background.copy(horizon);
    scene.fog.color.copy(horizon);

    sun.color.copy(sunColor);
    sun.intensity = 0.15 + day * 2.55;
    hemi.intensity = 0.22 + day * 0.4;
    streetlightMaterial.emissiveIntensity = state.night * 1.6;
  }

  return { state, setTime, update };
}
