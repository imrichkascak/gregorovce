// Drivable cars, motorbikes and bicycles: press E next to a vehicle to take it
// over (the driver bails out and runs), drive with a GTA-style arcade model, and
// get out to leave it. Each type has its own pace and handling.
import * as THREE from 'three';

const SPECS = {
  car: { accel: 14, top: 26, reverse: -8, steer: 1.9, grip: 1.1 },
  moto: { accel: 20, top: 34, reverse: -6, steer: 2.4, grip: 1.6 },
  bike: { accel: 7, top: 12, reverse: -3, steer: 2.7, grip: 3.2 },
};

export function createVehicles({ geo, player, traffic, audio }) {
  const state = { driving: false, speed: 0, heading: 0 };
  let car = null;
  const forward = new THREE.Vector3();

  function nearestCar(maxDistance) {
    let best = null;
    let bestDistanceSq = maxDistance * maxDistance;
    for (const candidate of traffic.cars) {
      if (candidate.state === 'stolen' || candidate.state === 'wrecked') continue;
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
    if (player.vehicle || player.dead) return false;
    const target = nearestCar(9);
    if (!target) return false;
    // Carjack: the driver jumps out and legs it down the road.
    if (traffic.carjack) traffic.carjack(target, player.position.x, player.position.z);
    else target.state = 'stolen';
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
    // Vystúp vpravo od auta (pravá strana = (-cos, sin) pri smere jazdy).
    const outX = parked.x - Math.cos(state.heading) * 2;
    const outZ = parked.z + Math.sin(state.heading) * 2;
    player.position.set(outX, geo.heightAt(outX, outZ), outZ);
    car.state = 'drive';
    car = null;
    state.driving = false;
    state.speed = 0;
    return true;
  }

  function update(dt) {
    if (!player.vehicle || !car) return;
    const specs = SPECS[car.type] ?? SPECS.car;
    const keys = player.keys;
    const throttle =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const steer =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const handbrake = keys.has('Space');

    state.speed += throttle * specs.accel * dt;
    state.speed *= 1 - (handbrake ? 4 : specs.grip) * dt;
    state.speed = THREE.MathUtils.clamp(state.speed, specs.reverse, specs.top);

    // Doprava (steer > 0) musí na obrazovke točiť doprava: kamera sa pozerá
    // v smere jazdy, takže uhol klesá. Pri spiatočke sa smer obráti.
    state.heading -= steer * specs.steer * dt * THREE.MathUtils.clamp(Math.abs(state.speed) / 8, 0, 1) * Math.sign(state.speed || 1);

    // Predok auta (svetlá) je +z, teda v smere jazdy — auto jazdí dopredu.
    forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    const x = car.object.position.x + forward.x * state.speed * dt;
    const z = car.object.position.z + forward.z * state.speed * dt;
    car.object.position.set(x, geo.heightAt(x, z) + 0.05, z);
    car.object.rotation.y = state.heading;

    player.position.copy(car.object.position);
    // Kamera sa pozerá v smere jazdy (yaw kamery je opačný k smeru pohľadu).
    player.yaw = state.heading + Math.PI;
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
