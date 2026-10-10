// Drivable cars: press E next to a traffic car to take it over, drive with a
// GTA-style arcade model, and get out to leave it.
import * as THREE from 'three';

export function createVehicles({ geo, player, traffic, audio }) {
  const state = { driving: false, speed: 0, heading: 0 };
  let car = null;
  const forward = new THREE.Vector3();

  function nearestCar(maxDistance) {
    let best = null;
    let bestDistanceSq = maxDistance * maxDistance;
    for (const candidate of traffic.cars) {
      if (candidate.state === 'stolen') continue;
      const dx = candidate.object.position.x - player.position.x;
      const dz = candidate.object.position.z - player.position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        best = candidate;
      }
    }
    return best;
  }

  function enter() {
    if (player.vehicle) return false;
    const target = nearestCar(9);
    if (!target) return false;
    target.state = 'stolen';
    car = target;
    player.vehicle = target;
    state.driving = true;
    state.speed = 0;
    state.heading = target.object.rotation.y;
    if (audio) audio.playSfx('engine');
    return true;
  }

  function exit() {
    if (!player.vehicle) return false;
    const parked = car.object.position;
    player.vehicle = null;
    player.position.set(
      parked.x + Math.cos(state.heading) * 2,
      geo.heightAt(parked.x + Math.cos(state.heading) * 2, parked.z - Math.sin(state.heading) * 2),
      parked.z - Math.sin(state.heading) * 2,
    );
    car.state = 'drive';
    car = null;
    state.driving = false;
    state.speed = 0;
    return true;
  }

  function update(dt) {
    if (!player.vehicle || !car) return;
    const keys = player.keys;
    const throttle =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const steer =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const handbrake = keys.has('Space');

    state.speed += throttle * 14 * dt;
    state.speed *= 1 - (handbrake ? 4 : 1.1) * dt;
    state.speed = THREE.MathUtils.clamp(state.speed, -8, 26);

    state.heading += steer * 1.9 * dt * THREE.MathUtils.clamp(Math.abs(state.speed) / 8, 0, 1) * Math.sign(state.speed || 1);

    forward.set(-Math.sin(state.heading), 0, -Math.cos(state.heading));
    const x = car.object.position.x + forward.x * state.speed * dt;
    const z = car.object.position.z + forward.z * state.speed * dt;
    car.object.position.set(x, geo.heightAt(x, z) + 0.05, z);
    car.object.rotation.y = state.heading;

    player.position.copy(car.object.position);
    player.yaw = state.heading;
    if (audio && Math.abs(state.speed) > 1) audio.playSfx('engine');
  }

  return {
    state,
    enter,
    exit,
    update,
    car: () => car,
    nearestCar,
  };
}
