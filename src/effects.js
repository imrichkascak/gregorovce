// Pooled particle effects for combat feedback: blood on hits, smoke on
// knockdowns and wrecks. One THREE.Points cloud per kind, so all live particles
// of a kind cost a single draw call.
import * as THREE from 'three';

const KINDS = {
  blood: { color: '#a31212', size: 0.13, count: 48, life: 0.8, speed: 3.2, gravity: -16, drag: 2.4, burst: 12 },
  smoke: { color: '#8f8a82', size: 0.5, count: 24, life: 1.5, speed: 1.3, gravity: 0.5, drag: 1.2, burst: 6 },
};

export function createEffects({ scene }) {
  const systems = {};

  for (const [kind, def] of Object.entries(KINDS)) {
    const positions = new Float32Array(def.count * 3);
    for (let i = 0; i < def.count; i += 1) positions[i * 3 + 1] = -9999;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: def.color,
      size: def.size,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `effects-${kind}`;
    points.frustumCulled = false;
    scene.add(points);
    const particles = [];
    for (let i = 0; i < def.count; i += 1) particles.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    systems[kind] = { def, positions, particles, cursor: 0, active: 0, geometry };
  }

  /** Fire a small burst of `kind` at (x, y, z). */
  function spawn(kind, x, y, z, spread = 1) {
    const system = systems[kind];
    if (!system) return false;
    const { def, particles, positions } = system;
    for (let i = 0; i < def.burst; i += 1) {
      const index = system.cursor;
      system.cursor = (system.cursor + 1) % def.count;
      const particle = particles[index];
      particle.life = def.life * (0.6 + Math.random() * 0.4);
      particle.vx = (Math.random() - 0.5) * def.speed * spread;
      particle.vy = Math.random() * def.speed * 0.8 * spread;
      particle.vz = (Math.random() - 0.5) * def.speed * spread;
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
      system.active += 1;
    }
    system.geometry.attributes.position.needsUpdate = true;
    return true;
  }

  function update(dt) {
    for (const system of Object.values(systems)) {
      const { def, particles, positions } = system;
      let active = 0;
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (particle.life <= 0) continue;
        particle.life -= dt;
        if (particle.life <= 0) {
          positions[i * 3 + 1] = -9999;
          continue;
        }
        active += 1;
        particle.vy += def.gravity * dt;
        const drag = 1 - Math.min(1, def.drag * dt);
        particle.vx *= drag;
        particle.vz *= drag;
        positions[i * 3] += particle.vx * dt;
        positions[i * 3 + 1] += particle.vy * dt;
        positions[i * 3 + 2] += particle.vz * dt;
      }
      system.active = active;
      system.geometry.attributes.position.needsUpdate = true;
    }
  }

  /** Live particles of a kind — exposed for the verify harness. */
  const count = (kind) => systems[kind]?.active ?? 0;

  return { systems, spawn, update, count };
}
