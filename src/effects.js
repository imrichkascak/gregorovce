// Pooled particle effects for combat feedback: blood on hits, smoke on
// knockdowns and wrecks, fire for molotovs and explosions, sparks off metal,
// spent shell casings. One THREE.Points cloud per kind, so all live particles
// of a kind cost a single draw call. Bullet holes are an InstancedMesh ring
// buffer that lingers on walls and ground, tracers are one LineSegments.
import * as THREE from 'three';

const KINDS = {
  blood: { color: '#a31212', size: 0.13, count: 48, life: 0.8, speed: 3.2, gravity: -16, drag: 2.4, burst: 12 },
  smoke: { color: '#8f8a82', size: 0.5, count: 24, life: 1.5, speed: 1.3, gravity: 0.5, drag: 1.2, burst: 6 },
  fire: { color: '#ff8a1e', size: 0.42, count: 48, life: 0.85, speed: 2.6, gravity: 3.4, drag: 1.6, burst: 10 },
  spark: { color: '#ffd27a', size: 0.08, count: 32, life: 0.3, speed: 5.2, gravity: -14, drag: 2.2, burst: 8 },
  casing: { color: '#c9a227', size: 0.07, count: 24, life: 0.7, speed: 3.4, gravity: -18, drag: 1.4, burst: 4 },
};

const DECAL_COUNT = 40;
const DECAL_LIFE = 45;
const TRACER_COUNT = 10;
const TRACER_LIFE = 0.09;

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

  // --- bullet holes: a ring buffer of small dark quads that stick around -------
  const decals = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.17, 0.17),
    new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.85, depthWrite: false }),
    DECAL_COUNT,
  );
  decals.name = 'effects-decals';
  decals.frustumCulled = false;
  const decalLives = new Array(DECAL_COUNT).fill(0);
  const decalInfo = { active: 0 };
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const decalUp = new THREE.Vector3(0, 1, 0);
  const decalNormal = new THREE.Vector3();
  const decalQuat = new THREE.Quaternion();
  const decalPos = new THREE.Vector3();
  const decalScale = new THREE.Vector3(1, 1, 1);
  const decalMatrix = new THREE.Matrix4();
  let decalCursor = 0;
  for (let i = 0; i < DECAL_COUNT; i += 1) decals.setMatrixAt(i, hiddenMatrix);
  decals.instanceMatrix.needsUpdate = true;
  scene.add(decals);

  /** Stick a bullet hole on a surface with normal (nx, ny, nz). */
  function addDecal(x, y, z, nx = 0, ny = 1, nz = 0) {
    decalNormal.set(nx, ny, nz).normalize();
    decalPos.set(x + decalNormal.x * 0.04, y + decalNormal.y * 0.04, z + decalNormal.z * 0.04);
    decalQuat.setFromUnitVectors(decalUp, decalNormal);
    decalMatrix.compose(decalPos, decalQuat, decalScale);
    if (decalLives[decalCursor] <= 0) decalInfo.active += 1;
    decalLives[decalCursor] = DECAL_LIFE;
    decals.setMatrixAt(decalCursor, decalMatrix);
    decals.instanceMatrix.needsUpdate = true;
    decalCursor = (decalCursor + 1) % DECAL_COUNT;
    return true;
  }

  // --- tracers: one LineSegments, a fading line per shot ----------------------
  const tracerPositions = new Float32Array(TRACER_COUNT * 6);
  for (let i = 0; i < TRACER_COUNT; i += 1) tracerPositions[i * 6 + 1] = -9999;
  const tracerGeometry = new THREE.BufferGeometry();
  tracerGeometry.setAttribute('position', new THREE.BufferAttribute(tracerPositions, 3));
  const tracers = new THREE.LineSegments(
    tracerGeometry,
    new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }),
  );
  tracers.name = 'effects-tracers';
  tracers.frustumCulled = false;
  scene.add(tracers);
  const tracerLives = new Array(TRACER_COUNT).fill(0);
  const tracerInfo = { active: 0 };
  let tracerCursor = 0;

  /** Draw a short-lived tracer line from the muzzle to the impact point. */
  function addTracer(from, to) {
    const i = tracerCursor;
    tracerPositions[i * 6 + 0] = from.x;
    tracerPositions[i * 6 + 1] = from.y;
    tracerPositions[i * 6 + 2] = from.z;
    tracerPositions[i * 6 + 3] = to.x;
    tracerPositions[i * 6 + 4] = to.y;
    tracerPositions[i * 6 + 5] = to.z;
    if (tracerLives[i] <= 0) tracerInfo.active += 1;
    tracerLives[i] = TRACER_LIFE;
    tracerGeometry.attributes.position.needsUpdate = true;
    tracerCursor = (tracerCursor + 1) % TRACER_COUNT;
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

    for (let i = 0; i < DECAL_COUNT; i += 1) {
      if (decalLives[i] <= 0) continue;
      decalLives[i] -= dt;
      if (decalLives[i] <= 0) {
        decalInfo.active -= 1;
        decals.setMatrixAt(i, hiddenMatrix);
        decals.instanceMatrix.needsUpdate = true;
      }
    }

    for (let i = 0; i < TRACER_COUNT; i += 1) {
      if (tracerLives[i] <= 0) continue;
      tracerLives[i] -= dt;
      if (tracerLives[i] <= 0) {
        tracerInfo.active -= 1;
        tracerPositions[i * 6 + 1] = -9999;
        tracerPositions[i * 6 + 4] = -9999;
        tracerGeometry.attributes.position.needsUpdate = true;
      }
    }
  }

  /** Live particles of a kind — exposed for the verify harness. */
  const count = (kind) => systems[kind]?.active ?? 0;

  return { systems, spawn, update, count, decals: decalInfo, addDecal, tracers: tracerInfo, addTracer };
}
