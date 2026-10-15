// Weapon inventory and shooting. Melee weapons swing in a cone in front of the
// player (three quick hits knock the target down); ranged weapons raycast from the
// camera. Hits react, spend ammo, raise the wanted level and ping the HUD.
import * as THREE from 'three';
import { comboHits, inMeleeArc } from './combat.js';

const WEAPONS = [
  { id: 'fist', name: 'Päsť', icon: '✊', melee: true, range: 2.4, damage: 14, ammo: Infinity },
  { id: 'bat', name: 'Bejzbal', icon: '🏏', melee: true, range: 3, damage: 26, ammo: Infinity },
  { id: 'pistol', name: 'Pištoľ', icon: '🔫', range: 48, damage: 30, ammo: 34 },
  { id: 'smg', name: 'Samopal', icon: '🔫', range: 70, damage: 18, ammo: 90 },
];

const HIT_RADIUS = 0.9;
const MELEE_HALF_ANGLE = 0.95;
const COMBO_WINDOW = 2;
const COMBO_BONUS = 16;

export function createWeapons({ camera, player, traffic, audio, effects, onCrime, onAttack, onHit }) {
  const state = { current: 0, cooldown: 0 };
  const direction = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  function select(index) {
    state.current = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
  }
  const next = () => select(state.current + 1);
  const prev = () => select(state.current - 1);
  const currentWeapon = () => WEAPONS[state.current];
  const ammo = () => WEAPONS[state.current].ammo;
  const icon = () => WEAPONS[state.current].icon;

  function aimFrom() {
    camera.getWorldDirection(direction);
    origin.copy(camera.position);
  }

  /** Along-ray distance to a target point, or Infinity if off-axis / behind. */
  function hitDistance(target) {
    toTarget.copy(target).sub(origin);
    const along = toTarget.dot(direction);
    if (along <= 0) return Infinity;
    const perpendicular = Math.sqrt(Math.max(0, toTarget.lengthSq() - along * along));
    return perpendicular <= HIT_RADIUS ? along : Infinity;
  }

  /** Swing a melee weapon: the nearest pedestrian inside the arc gets hit. */
  function swing(weapon) {
    if (audio) audio.playSfx('swing');
    let best = null;
    let bestDistance = Infinity;
    for (const ped of traffic.peds) {
      if (ped.state === 'dead') continue;
      const distance = Math.hypot(
        ped.object.position.x - player.position.x,
        ped.object.position.z - player.position.z,
      );
      if (distance >= bestDistance) continue;
      if (
        !inMeleeArc(
          player.position.x,
          player.position.z,
          player.yaw,
          ped.object.position.x,
          ped.object.position.z,
          weapon.range,
          MELEE_HALF_ANGLE,
        )
      ) {
        continue;
      }
      bestDistance = distance;
      best = ped;
    }
    if (!best) return true;

    const now = performance.now() / 1000;
    const combo = comboHits(best.hitTimes ?? [], now, COMBO_WINDOW) + 1;
    best.hitTimes = [...(best.hitTimes ?? []), now].slice(-8);
    traffic.panic(best.object.position.x, best.object.position.z, 14, best);
    traffic.hitPed(best, weapon.damage + (combo >= 3 ? COMBO_BONUS : 0), { combo });
    if (audio) audio.playSfx('hit');
    if (onHit) onHit(best, { combo, melee: true });
    if (onCrime) onCrime(1);
    return true;
  }

  /** Fire the current weapon: melee swings, guns raycast from the camera. */
  function fire() {
    if (state.cooldown > 0) return false;
    if (player.dead) return false;
    const weapon = currentWeapon();
    if (weapon.melee && player.vehicle) return false;
    if (weapon.ammo !== Infinity && weapon.ammo <= 0) return false;
    if (weapon.ammo !== Infinity) weapon.ammo -= 1;
    state.cooldown = weapon.melee ? 0.4 : 0.16;
    if (onAttack) onAttack(weapon.melee ? 'punch' : 'shoot');
    if (weapon.melee) return swing(weapon);
    if (audio) audio.playSfx('gunshot');

    aimFrom();
    let bestDistance = weapon.range;
    let bestPed = null;
    let bestCar = null;
    const aimPoint = new THREE.Vector3();

    for (const ped of traffic.peds) {
      if (ped.state === 'dead') continue;
      aimPoint.copy(ped.object.position);
      aimPoint.y += 0.9;
      const distance = hitDistance(aimPoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPed = ped;
        bestCar = null;
      }
    }
    for (const car of traffic.cars) {
      aimPoint.copy(car.object.position);
      aimPoint.y += 0.7;
      const distance = hitDistance(aimPoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCar = car;
        bestPed = null;
      }
    }

    if (bestPed) {
      traffic.panic(bestPed.object.position.x, bestPed.object.position.z, 18, bestPed);
      traffic.hitPed(bestPed, weapon.damage, { combo: 1 });
      if (audio) audio.playSfx('hit');
      if (onHit) onHit(bestPed, { combo: 1, melee: false });
      if (onCrime) onCrime(1);
      return true;
    }
    if (bestCar) {
      traffic.hitCar(bestCar, weapon.damage);
      if (effects) {
        effects.spawn(
          'smoke',
          bestCar.object.position.x,
          bestCar.object.position.y + 0.8,
          bestCar.object.position.z,
          0.6,
        );
      }
      if (audio) audio.playSfx('hit');
      if (onHit) onHit(bestCar, { combo: 1, melee: false });
      if (onCrime) onCrime(1);
      return true;
    }
    return true;
  }

  function update(dt) {
    if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
  }

  return {
    list: WEAPONS,
    state,
    select,
    next,
    prev,
    currentWeapon,
    ammo,
    icon,
    fire,
    update,
  };
}
