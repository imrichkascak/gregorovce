// Weather states (clear / overcast / rain) with a falling rain point cloud and
// fog that thickens as the sky closes in.
import * as THREE from 'three';

export function createWeather({ scene }) {
  const states = ['clear', 'overcast', 'rain'];
  const state = { name: 'clear', wetness: 0 };
  const count = 1500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 140;
    positions[i * 3 + 1] = Math.random() * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.Points(
    geom,
    new THREE.PointsMaterial({ color: '#c3d3e2', size: 0.5, transparent: true, opacity: 0.6 }),
  );
  rain.visible = false;
  scene.add(rain);

  const baseFogNear = scene.fog.near;
  const baseFogFar = scene.fog.far;

  function set(name) {
    if (!states.includes(name)) return;
    state.name = name;
    rain.visible = name === 'rain';
    if (name === 'clear') {
      scene.fog.near = baseFogNear;
      scene.fog.far = baseFogFar;
    } else if (name === 'overcast') {
      scene.fog.near = baseFogNear * 0.6;
      scene.fog.far = baseFogFar * 0.7;
    } else {
      scene.fog.near = baseFogNear * 0.4;
      scene.fog.far = baseFogFar * 0.5;
    }
  }

  function cycle() {
    set(states[(states.indexOf(state.name) + 1) % states.length]);
  }

  function update(dt, anchor) {
    const targetWet = state.name === 'rain' ? 1 : state.name === 'overcast' ? 0.3 : 0;
    state.wetness += (targetWet - state.wetness) * Math.min(1, dt * 0.6);
    if (state.name !== 'rain') return;

    const pos = geom.attributes.position;
    for (let i = 0; i < count; i += 1) {
      let y = pos.getY(i) - dt * 30;
      if (y < 0) {
        y += 60;
        pos.setX(i, anchor.x + (Math.random() - 0.5) * 140);
        pos.setZ(i, anchor.z + (Math.random() - 0.5) * 140);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  return { states, state, set, cycle, update };
}
