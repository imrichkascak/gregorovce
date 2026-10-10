// Weapon inventory and shooting: melee and ranged weapons, raycast hits against
// pedestrians and cars, muzzle flash and ammo bookkeeping.
import * as THREE from 'three';

const WEAPONS = [
  { id: 'fist', name: 'Päsť', icon: '✊', melee: true, range: 2.4, damage: 14, ammo: Infinity },
  { id: 'bat', name: 'Bejzbal', icon: '🏏', melee: true, range: 3, damage: 26, ammo: Infinity },
  { id: 'pistol', name: 'Pištoľ', icon: '🔫', range: 48, damage: 30, ammo: 34 },
  { id: 'smg', name: 'Samopal', icon: '🔫', range: 70, damage: 18, ammo: 90 },
];

const HIT_RADIUS = 0.9;

export function createWeapons({ camera, player, traffic, audio, onCrime }) {
  const state = { current: 0, cooldown: 0 };
  const ray = new THREE.Raycaster();
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

  function fire() {
    if (state.cooldown > 0) return false;
    const weapon = currentWeapon();
    if (weapon.ammo !== Infinity && weapon.ammo <= 0) return false;
    if (weapon.ammo !== Infinity) weapon.ammo -= 1;
    state.cooldown = weapon.melee ? 0.35 : 0.16;
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
      traffic.hitPed(bestPed, weapon.damage);
      traffic.panic(bestPed.object.position.x, bestPed.object.position.z, 18);
      if (audio) audio.playSfx('hit');
      if (onCrime && !weapon.melee) onCrime(1);
      return true;
    }
    if (bestCar) {
      traffic.hitCar(bestCar, weapon.damage);
      if (audio) audio.playSfx('hit');
      if (onCrime && !weapon.melee) onCrime(1);
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
