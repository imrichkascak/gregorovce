// Third-person orbit camera that trails the player, with first-person fallback,
// wheel zoom, aim mode and simple building collision.
import * as THREE from 'three';
import { pointInPolygon } from './geo.js';

export function createCameraRig(camera, player, colliders) {
  const state = {
    mode: 'third-person',
    distance: 5.4,
    min: 2.6,
    max: 9.5,
    aim: false,
    shake: 0,
  };
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const right = new THREE.Vector3();

  function distanceLimited(from, to, distance) {
    const steps = 14;
    let good = 1;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      let hit = false;
      for (const poly of colliders) {
        if (pointInPolygon(x, z, poly)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        good = (i - 1) / steps;
        break;
      }
    }
    return distance * good;
  }

  /** Kick the camera — hits and shots feel heavier. */
  function shake(amount = 0.25) {
    state.shake = Math.min(0.9, state.shake + amount);
  }

  /** Random jitter while `shake` decays; called after the camera is placed. */
  function applyShake(dt) {
    if (state.shake <= 0) return;
    const amount = state.shake;
    camera.position.x += (Math.random() - 0.5) * amount;
    camera.position.y += (Math.random() - 0.5) * amount;
    camera.position.z += (Math.random() - 0.5) * amount;
    state.shake = Math.max(0, state.shake - dt * 1.9);
  }

  function update(dt = 0.016) {
    const { x, y, z } = player.position;
    const head = player.vehicle ? 1.1 : 1.5;
    target.set(x, y + head, z);

    if (state.mode === 'first-person') {
      camera.position.set(x, y + 1.7, z);
      camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
      applyShake(dt);
      return;
    }

    const cosPitch = Math.cos(player.pitch);
    const sinPitch = Math.sin(player.pitch);
    direction.set(
      -cosPitch * Math.sin(player.yaw),
      sinPitch,
      -cosPitch * Math.cos(player.yaw),
    );

    let distance = player.vehicle ? Math.max(state.distance, 8) : state.distance;
    if (state.aim) {
      // Over-the-shoulder aim camera, GTA style: close in.
      distance = Math.min(distance, 2.6);
    }
    // Postava nesmie stáť v terči: kamera hľadí nad hlavu a kúsok dopredu,
    // takže stred obrazovky — terč — ukazuje voľný priestor pred hráčom
    // a postava ostáva vľavo pod ním (rovnako ako v GTA).
    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);
    const forward = state.aim ? 1.1 : 0.45;
    target.x += -sinYaw * forward;
    target.z += -cosYaw * forward;
    target.y += 0.55;
    // Kamera je mierne vpravo od hráča, takže postava nezakrýva terč.
    right.set(cosYaw, 0, -sinYaw);
    const lean = state.aim ? 0.85 : 0.4;
    const dirY = player.vehicle ? 0.34 : 0.26;
    desired.set(target.x, target.y + distance * dirY, target.z).addScaledVector(direction, -distance);
    desired.addScaledVector(right, lean);

    const clamped = distanceLimited(target, desired, distance);
    const pull = clamped < distance ? clamped : distance;
    desired.set(target.x, target.y + pull * dirY, target.z).addScaledVector(direction, -pull);
    desired.addScaledVector(right, lean);

    camera.position.lerp(desired, 0.35);
    camera.lookAt(target);
    applyShake(dt);
  }

  function toggleMode() {
    state.mode = state.mode === 'third-person' ? 'first-person' : 'third-person';
  }

  function zoom(delta) {
    state.distance = THREE.MathUtils.clamp(state.distance + delta, state.min, state.max);
  }

  return { state, update, toggleMode, zoom, shake };
}
