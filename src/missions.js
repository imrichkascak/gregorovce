// Mission markers, simple jobs, shops and save/load. Yellow cylinders mark
// missions (church + the village gags), green ones are shops.
import * as THREE from 'three';
import { specialKind } from './osm.js';
import { setAvatarShirtColor } from './avatar.js';

const SHIRT_SHOP_COLORS = ['#f4f4f0', '#c43830', '#3f6e9e', '#3c7a44', '#e08a34', '#6e4a7a'];

export function createMissions({ scene, geo, player, world, layers, avatar, audio }) {
  const state = { active: null, completed: [], message: '', objective: null };
  const markers = [];
  const shops = [];
  const missionMaterial = new THREE.MeshBasicMaterial({
    color: '#ffd21e',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shopMaterial = new THREE.MeshBasicMaterial({
    color: '#43a13c',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  function addMarker({ x, z, name, reward, kind }) {
    // A tall, bright beam so it is easy to walk into.
    const geometry = new THREE.CylinderGeometry(1.8, 1.8, 6, 20, 1, true);
    const material = (kind === 'shop' ? shopMaterial : missionMaterial).clone();
    const mesh = new THREE.Mesh(geometry, material);
    const ground = geo.heightAt(x, z);
    mesh.position.set(x, ground + 3, z);
    scene.add(mesh);
    const record = { object: mesh, material, x, z, name, reward, kind };
    (kind === 'shop' ? shops : markers).push(record);
    return record;
  }

  const church = world.npcSpawn;
  if (church) {
    addMarker({ x: church.x, z: church.z, name: 'Kostol', reward: 250, kind: 'mission' });
  }
  const anchors = world.gagAnchors ?? {};
  if (anchors.explosion) {
    addMarker({ ...anchors.explosion, name: 'Dom 101', reward: 500, kind: 'mission' });
  }
  if (anchors.septic) {
    addMarker({ ...anchors.septic, name: 'Žumpa 217', reward: 400, kind: 'mission' });
  }
  if (anchors.church) {
    addMarker({ ...anchors.church, name: 'Pali a Mata', reward: 300, kind: 'mission' });
  }

  for (const poi of layers.pois ?? []) {
    const kind = specialKind(poi.tags);
    if (kind !== 'shop' && kind !== 'pub') continue;
    const w = geo.toWorld(poi.lat, poi.lon);
    addMarker({ x: w.x, z: w.z, name: poi.tags.name ?? 'Obchod', reward: 0, kind: 'shop' });
  }

  // Each mission's target is the next mission marker, so runs always resolve.
  const missions = markers.map((marker, i) => ({
    name: marker.name,
    reward: marker.reward,
    start: marker,
    target: markers[(i + 1) % markers.length],
  }));

  const prices = { clothes: 300, food: 50, weapons: 200 };
  let shopCooldown = 0;

  function start(mission) {
    state.active = mission;
    state.message = `Misia: ${mission.name}`;
    if (audio) audio.playSfx('hit');
  }

  function complete() {
    const mission = state.active;
    if (!mission) return;
    player.money += mission.reward;
    state.completed.push(mission.name);
    state.message = `Misia splnená: ${mission.name} (+${mission.reward} €)`;
    state.active = null;
  }

  function buy(shop) {
    if (shopCooldown > 0) return false;
    const kind = shop.name ? 'clothes' : 'food';
    const price = prices[kind];
    if (player.money < price) return false;
    player.money -= price;
    if (kind === 'clothes' && avatar) {
      const color = SHIRT_SHOP_COLORS[Math.floor(Math.random() * SHIRT_SHOP_COLORS.length)];
      setAvatarShirtColor(avatar, color);
    } else {
      player.health = 100;
    }
    shopCooldown = 3;
    state.message = `Nákup: ${kind} (-${price} €)`;
    return true;
  }

  function buyWeapons() {
    if (shopCooldown > 0) return false;
    const price = prices.weapons;
    if (player.money < price) return false;
    player.money -= price;
    for (const weapon of player.weapons?.list ?? []) {
      if (weapon.ammo !== Infinity) weapon.ammo += 20;
    }
    shopCooldown = 3;
    state.message = `Nákup: zbrane (-${price} €)`;
    return true;
  }

  function save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      'gregorovce-save',
      JSON.stringify({
        money: player.money,
        wanted: player.wanted,
        health: player.health,
        x: player.position.x,
        z: player.position.z,
        completed: state.completed,
      }),
    );
  }

  function load() {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('gregorovce-save');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      player.money = data.money ?? player.money;
      player.wanted = data.wanted ?? player.wanted;
      player.health = data.health ?? player.health;
      if (typeof data.x === 'number' && typeof data.z === 'number') {
        player.position.set(data.x, geo.heightAt(data.x, data.z), data.z);
      }
      state.completed = data.completed ?? [];
      return true;
    } catch {
      return false;
    }
  }

  function within(object, distance) {
    const dx = object.position.x - player.position.x;
    const dz = object.position.z - player.position.z;
    return dx * dx + dz * dz < distance * distance;
  }

  function distanceTo(object) {
    return Math.hypot(object.position.x - player.position.x, object.position.z - player.position.z);
  }

  const TRIGGER = 3.2;
  let time = 0;

  function update(dt) {
    time += dt;
    if (shopCooldown > 0) shopCooldown = Math.max(0, shopCooldown - dt);

    if (state.active) {
      if (within(state.active.target.object, TRIGGER)) complete();
    } else {
      for (const mission of missions) {
        if (state.completed.includes(mission.name)) continue;
        if (within(mission.start.object, TRIGGER)) {
          start(mission);
          break;
        }
      }
      if (!state.active) {
        for (const shop of shops) {
          if (within(shop.object, TRIGGER)) {
            buy(shop);
            break;
          }
        }
      }
    }

    // Markers pulse; the active objective glows green.
    for (const marker of markers) {
      const isTarget = state.active && state.active.target === marker;
      marker.material.opacity = 0.34 + Math.sin(time * 3 + marker.x) * 0.12;
      marker.material.color.set(isTarget ? '#43e05a' : '#ffd21e');
    }

    state.objective = state.active
      ? { name: state.active.target.name, distance: distanceTo(state.active.target.object) }
      : null;
  }

  return {
    markers,
    shops,
    missions,
    state,
    start,
    complete,
    buy,
    buyWeapons,
    save,
    load,
    update,
  };
}
