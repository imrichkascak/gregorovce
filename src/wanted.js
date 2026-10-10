// Wanted level: crimes raise the stars, police cars spawn and chase, and getting
// caught busts you back to the spawn point.
import * as THREE from 'three';
import { buildCar } from './traffic.js';
import { clampWanted } from './rules.js';

export function createWanted({ scene, geo, player, audio }) {
  const state = { level: 0, busted: false };
  const units = [];

  function crime(points = 1) {
    if (state.busted) return;
    state.level = clampWanted(state.level + points);
  }

  function bribe(amount = 2) {
    state.level = clampWanted(state.level - amount);
  }

  function clear() {
    state.level = 0;
    for (const unit of units) scene.remove(unit.object);
    units.length = 0;
  }

  function spawnUnit() {
    const car = buildCar();
    // Cops drive black-and-white cruisers.
    car.traverse((obj) => {
      if (obj.material) obj.material.color.multiplyScalar(0.55);
    });
    const angle = Math.random() * Math.PI * 2;
    const x = player.position.x + Math.cos(angle) * 45;
    const z = player.position.z + Math.sin(angle) * 45;
    car.position.set(x, geo.heightAt(x, z) + 0.05, z);
    scene.add(car);
    units.push({ object: car, speed: 13 });
  }

  function update(dt) {
    while (units.length < state.level && units.length < 6) spawnUnit();
    while (units.length > state.level) scene.remove(units.pop().object);

    for (const unit of units) {
      const dx = player.position.x - unit.object.position.x;
      const dz = player.position.z - unit.object.position.z;
      const length = Math.hypot(dx, dz) || 1;
      if (length > 2.4) {
        unit.object.position.x += (dx / length) * unit.speed * dt;
        unit.object.position.z += (dz / length) * unit.speed * dt;
        unit.object.position.y =
          geo.heightAt(unit.object.position.x, unit.object.position.z) + 0.05;
        unit.object.rotation.y = Math.atan2(dx / length, dz / length);
      } else if (state.level > 0) {
        state.busted = true;
        if (audio) audio.playSfx('hit');
        clear();
        player.dropFromSky();
        state.busted = false;
      }
    }
  }

  return { state, units, crime, bribe, clear, update };
}
