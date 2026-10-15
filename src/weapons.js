// Weapon inventory and shooting. Melee weapons swing in a cone in front of the
// player (three quick hits knock the target down); ranged weapons raycast from the
// camera with spread that tightens while aiming and as the skill grows. Grenades
// and molotovs fly as projectiles and explode, damaging everyone nearby. Shots
// leave tracers, shell casings and bullet holes, and work from a car (drive-by).
import * as THREE from 'three';
import { comboHits, inMeleeArc } from './combat.js';

const WEAPONS = [
  { id: 'fist', name: 'Päsť', icon: '✊', melee: true, range: 2.4, damage: 14, ammo: Infinity },
  { id: 'knife', name: 'Nôž', icon: '🔪', melee: true, range: 2.2, damage: 40, ammo: Infinity },
  { id: 'bat', name: 'Bejzbal', icon: '🏏', melee: true, range: 3, damage: 26, ammo: Infinity },
  { id: 'pistol', name: 'Pištoľ', icon: '🔫', range: 48, damage: 30, ammo: 34, spread: 0.022, cooldown: 0.22, sfx: 'pistol' },
  { id: 'shotgun', name: 'Brokovnica', icon: '🔫', range: 22, damage: 46, ammo: 20, spread: 0.08, cooldown: 0.85, sfx: 'shotgun' },
  { id: 'smg', name: 'Samopal', icon: '🔫', range: 70, damage: 18, ammo: 90, spread: 0.05, cooldown: 0.11, sfx: 'smg' },
  { id: 'ak', name: 'AK-47', icon: '🔫', range: 62, damage: 26, ammo: 120, spread: 0.034, cooldown: 0.13, sfx: 'ak' },
  { id: 'sniper', name: 'Ostreľovačka', icon: '🎯', range: 130, damage: 95, ammo: 12, spread: 0.004, cooldown: 1.1, sfx: 'sniper' },
  { id: 'grenade', name: 'Granát', icon: '💣', throw: true, range: 26, damage: 85, ammo: 8, cooldown: 0.9, blast: 6 },
  { id: 'molotov', name: 'Molotov', icon: '🔥', throw: true, range: 22, damage: 55, ammo: 8, cooldown: 0.9, blast: 4.6, fire: true },
];

const HIT_RADIUS = 0.9;
const MELEE_HALF_ANGLE = 0.95;
const COMBO_WINDOW = 2;
const COMBO_BONUS = 16;

export function createWeapons({
  camera,
  cameraRig,
  player,
  traffic,
  audio,
  effects,
  geo,
  scene,
  onCrime,
  onAttack,
  onHit,
}) {
  const state = { current: 0, cooldown: 0, aiming: false, shotFlash: 0, projectiles: [], blasts: 0 };
  const direction = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const impact = new THREE.Vector3();
  const aimPoint = new THREE.Vector3();

  const grenadeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#2f3a2a', roughness: 0.8 }),
  );
  const molotovMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: '#7a4a1a', roughness: 0.6, transparent: true, opacity: 0.9 }),
  );

  function select(index) {
    state.current = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
  }
  const next = () => select(state.current + 1);
  const prev = () => select(state.current - 1);
  const currentWeapon = () => WEAPONS[state.current];
  const ammo = () => WEAPONS[state.current].ammo;
  const icon = () => WEAPONS[state.current].icon;
  const findWeapon = (id) => WEAPONS.find((w) => w.id === id);

  /** Aim mode: over-shoulder camera, slower walk, tighter spread. */
  function setAiming(on) {
    state.aiming = on === true;
    player.aiming = state.aiming;
    if (cameraRig) cameraRig.state.aim = state.aiming;
  }

  /** Current spread in radians: tighter while aiming and as the skill grows. */
  function spread() {
    const weapon = currentWeapon();
    const base = weapon.spread ?? 0;
    const aimFactor = state.aiming ? 0.35 : 1;
    const skill = player.weaponSkill ?? 0;
    return base * aimFactor * (1 - (skill / 100) * 0.55);
  }

  function aimFrom() {
    camera.getWorldDirection(direction);
    origin.copy(camera.position);
    muzzle.copy(origin).addScaledVector(direction, 0.6);
    muzzle.y -= 0.12;
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

  /** Blow up (x, y, z): hurts peds, cars and the player in the blast radius. */
  function explode(x, y, z, weapon) {
    const radius = weapon.blast ?? 5;
    const damage = weapon.damage ?? 60;
    state.blasts += 1;
    if (effects) {
      effects.spawn('fire', x, y + 0.5, z, 1.7);
      effects.spawn('smoke', x, y + 0.8, z, 1.9);
      effects.spawn('spark', x, y + 0.4, z, 1.6);
      if (weapon.fire) effects.spawn('fire', x, y + 0.25, z, 2.6);
    }
    if (audio) audio.playSfx('boom');
    if (cameraRig) cameraRig.shake(0.6);
    for (const ped of traffic.peds) {
      if (ped.state === 'dead') continue;
      const distance = Math.hypot(ped.object.position.x - x, ped.object.position.z - z);
      if (distance > radius) continue;
      traffic.panic(ped.object.position.x, ped.object.position.z, radius * 2, ped);
      traffic.hitPed(ped, Math.round(damage * (0.4 + (1 - distance / radius) * 0.6)), { combo: 3 });
    }
    for (const car of traffic.cars) {
      const distance = Math.hypot(car.object.position.x - x, car.object.position.z - z);
      if (distance > radius) continue;
      traffic.hitCar(car, Math.round(damage * (1 - distance / radius)), { bail: true });
    }
    if (!player.dead) {
      const distance = Math.hypot(player.position.x - x, player.position.z - z);
      if (distance <= radius) player.damage(Math.round(damage * 0.5 * (1 - distance / radius)), x, z);
    }
    if (onCrime) onCrime(3);
    return true;
  }

  /** Throw a grenade (fuse) or molotov (explodes on impact). */
  function throwProjectile(weapon) {
    aimFrom();
    const mesh = (weapon.id === 'molotov' ? molotovMesh : grenadeMesh).clone();
    mesh.position.copy(muzzle);
    if (scene) scene.add(mesh);
    state.projectiles.push({
      weapon,
      object: mesh,
      velocity: new THREE.Vector3(direction.x * 17, direction.y * 17 + 3.4, direction.z * 17),
      timer: weapon.fire ? 2.4 : 1.9,
    });
    return true;
  }

  /** Fire the current weapon: melee swings, guns raycast, grenades fly. */
  function fire() {
    if (state.cooldown > 0) return false;
    if (player.dead) return false;
    const weapon = currentWeapon();
    if ((weapon.melee || weapon.throw) && player.vehicle) return false;
    if (weapon.ammo !== Infinity && weapon.ammo <= 0) return false;
    if (weapon.ammo !== Infinity) weapon.ammo -= 1;
    state.cooldown = weapon.cooldown ?? 0.16;
    state.shotFlash = 0.25;
    player.weaponSkill = Math.min(100, (player.weaponSkill ?? 0) + 0.5);
    if (onAttack) onAttack(weapon.melee ? 'punch' : 'shoot');
    if (weapon.melee) return swing(weapon);
    if (weapon.throw) return throwProjectile(weapon);
    if (audio) audio.playSfx(weapon.sfx ?? 'gunshot');
    return shoot(weapon);
  }

  /** Raycast a bullet from the camera; hits leave blood, sparks and holes. */
  function shoot(weapon) {
    aimFrom();
    const jitter = spread();
    if (jitter > 0) {
      direction.x += (Math.random() - 0.5) * jitter * 2;
      direction.y += (Math.random() - 0.5) * jitter * 2;
      direction.z += (Math.random() - 0.5) * jitter * 2;
      direction.normalize();
    }

    let bestDistance = weapon.range;
    let bestPed = null;
    let bestCar = null;
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
      impact.copy(aimPoint);
      traffic.panic(bestPed.object.position.x, bestPed.object.position.z, 18, bestPed);
      traffic.hitPed(bestPed, weapon.damage, { combo: 1 });
      if (audio) audio.playSfx('hit');
      if (onHit) onHit(bestPed, { combo: 1, melee: false });
      if (onCrime) onCrime(1);
    } else if (bestCar) {
      impact.copy(aimPoint);
      traffic.hitCar(bestCar, weapon.damage, { bail: true, fromX: origin.x, fromZ: origin.z });
      if (effects) effects.spawn('spark', impact.x, impact.y, impact.z, 0.8);
      if (audio) audio.playSfx('hit');
      if (onHit) onHit(bestCar, { combo: 1, melee: false });
      if (onCrime) onCrime(1);
    } else {
      // Nothing hit: the round lands on the ground behind the aim point.
      impact.copy(origin).addScaledVector(direction, weapon.range);
      if (geo) impact.y = geo.heightAt(impact.x, impact.z) + 0.06;
      if (effects) {
        effects.spawn('smoke', impact.x, impact.y + 0.08, impact.z, 0.45);
        effects.addDecal(impact.x, impact.y, impact.z, 0, 1, 0);
      }
    }

    if (effects) {
      effects.addTracer(muzzle, impact);
      effects.spawn('casing', muzzle.x, muzzle.y, muzzle.z, 0.6);
    }
    return true;
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = state.projectiles[i];
      projectile.velocity.y -= 22 * dt;
      projectile.object.position.addScaledVector(projectile.velocity, dt);
      projectile.object.rotation.x += dt * 9;
      projectile.timer -= dt;
      const ground = geo ? geo.heightAt(projectile.object.position.x, projectile.object.position.z) : 0;
      const landed = projectile.object.position.y <= ground + 0.14;
      if (landed) {
        projectile.object.position.y = ground + 0.14;
        if (projectile.weapon.fire) {
          // Molotov: the bottle breaks on impact.
          explode(projectile.object.position.x, projectile.object.position.y, projectile.object.position.z, projectile.weapon);
          if (scene) scene.remove(projectile.object);
          state.projectiles.splice(i, 1);
          continue;
        }
        projectile.velocity.set(0, 0, 0);
      }
      if (projectile.timer <= 0) {
        explode(projectile.object.position.x, projectile.object.position.y, projectile.object.position.z, projectile.weapon);
        if (scene) scene.remove(projectile.object);
        state.projectiles.splice(i, 1);
      }
    }
  }

  function update(dt) {
    if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
    if (state.shotFlash > 0) state.shotFlash = Math.max(0, state.shotFlash - dt);
    updateProjectiles(dt);
  }

  /** Pickup helper: top up a weapon and hand it back. */
  function addAmmo(id, amount) {
    const weapon = findWeapon(id);
    if (!weapon || weapon.ammo === Infinity) return false;
    weapon.ammo = Math.min(weapon.ammo + amount, (weapon.maxAmmo ?? weapon.ammo) * 2);
    return true;
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
    findWeapon,
    addAmmo,
    setAiming,
    spread,
    fire,
    explode,
    update,
  };
}
