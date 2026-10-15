// Floating pickups around the village: guns, ammo, health and armor. Walk over
// one and it changes the player's state, disappears, and respawns after ~30 s.
import * as THREE from 'three';
import { labelTexture } from './textures.js';

const RESPAWN_TIME = 30;
const PICK_RADIUS = 1.8;

const DEFS = [
  { id: 'health-kostol', kind: 'health', at: 'kostol', dx: 3.4, dz: -2.6, amount: 40, label: '❤ +40' },
  { id: 'armor-obchod', kind: 'armor', at: 'obchod', dx: -3.2, dz: 2.4, amount: 40, label: '🛡 +40' },
  { id: 'shotgun-krcma', kind: 'weapon', at: 'krčma', dx: 3.2, dz: 2.2, weapon: 'shotgun', ammo: 10, label: '🔫 Brokovnica' },
  { id: 'pistol-urad', kind: 'weapon', at: 'úrad', dx: -3.4, dz: -2.2, weapon: 'pistol', ammo: 17, label: '🔫 Pištoľ' },
  { id: 'ak-skola', kind: 'weapon', at: 'škola', dx: 3.4, dz: 2.4, weapon: 'ak', ammo: 60, label: '🔫 AK-47' },
  { id: 'sniper-ihrisko', kind: 'weapon', at: 'ihrisko', dx: -3.2, dz: 2.6, weapon: 'sniper', ammo: 6, label: '🎯 Ostreľovačka' },
  { id: 'ammo-hasici', kind: 'ammo', at: 'hasiči', dx: 3.2, dz: -2.4, amount: 12, label: '📦 Munícia' },
  { id: 'molotov-zumpa', kind: 'weapon', at: 'žumpa', dx: -3.4, dz: 2.2, weapon: 'molotov', ammo: 4, label: '🔥 Molotov' },
];

const COLORS = {
  health: '#3fae5a',
  armor: '#8f9aa8',
  weapon: '#d8b23a',
  ammo: '#c98a1a',
};

export function createPickups({ scene, geo, player, weapons, audio, spots }) {
  const group = new THREE.Group();
  group.name = 'pickups';
  scene.add(group);
  const list = [];

  DEFS.forEach((def, index) => {
    const spot = spots?.[def.at];
    if (!spot) return;
    const x = spot.x + def.dx;
    const z = spot.z + def.dz;
    const ground = geo.heightAt(x, z);
    const color = COLORS[def.kind] ?? '#d8b23a';
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.3,
        emissive: color,
        emissiveIntensity: 0.3,
      }),
    );
    mesh.position.set(x, ground + 1.05, z);
    const { texture, aspect } = labelTexture(def.label, 'rgba(0,0,0,0.7)', '#ffe08a');
    const tag = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    tag.scale.set(0.85 * aspect, 0.85, 1);
    tag.position.set(x, ground + 2.05, z);
    group.add(mesh, tag);
    list.push({
      ...def,
      object: mesh,
      tag,
      x,
      z,
      ground,
      phase: index * 1.7,
      timer: 0,
    });
  });

  /** Apply a pickup to the player; false when there is nothing to gain. */
  function collect(pickup) {
    if (pickup.kind === 'health') {
      if (player.health >= 100) return false;
      player.health = Math.min(100, player.health + pickup.amount);
    } else if (pickup.kind === 'armor') {
      if (player.armor >= 100) return false;
      player.armor = Math.min(100, player.armor + pickup.amount);
    } else if (pickup.kind === 'weapon') {
      const weapon = weapons.findWeapon(pickup.weapon);
      if (!weapon) return false;
      weapons.select(weapons.list.indexOf(weapon));
      if (weapon.ammo !== Infinity) weapon.ammo += pickup.ammo;
    } else if (pickup.kind === 'ammo') {
      for (const weapon of weapons.list) {
        if (weapon.ammo === Infinity) continue;
        weapon.ammo += pickup.amount;
      }
    }
    if (audio) audio.playSfx('pickup');
    return true;
  }

  function update(dt) {
    if (player.dead) return;
    const time = performance.now() / 1000;
    for (const pickup of list) {
      if (pickup.timer > 0) {
        pickup.timer -= dt;
        if (pickup.timer <= 0) {
          pickup.object.visible = true;
          pickup.tag.visible = true;
        }
        continue;
      }
      pickup.object.rotation.y += dt * 1.7;
      pickup.object.position.y = pickup.ground + 1.05 + Math.sin(time * 2 + pickup.phase) * 0.15;
      const dx = player.position.x - pickup.x;
      const dz = player.position.z - pickup.z;
      if (dx * dx + dz * dz > PICK_RADIUS * PICK_RADIUS) continue;
      if (!collect(pickup)) continue;
      pickup.timer = RESPAWN_TIME;
      pickup.object.visible = false;
      pickup.tag.visible = false;
    }
  }

  return { group, list, update, collect };
}
