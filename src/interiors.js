// Interiéry: pri dverách kostola, krčmy, obchodu a úradu sa dá vojsť dnu.
// Každá budova má vlastnú miestnosť postavenú na samote za dedinou (aby sa dala
// schovať pred dažďom a aby nezasahovala do dediny), s obsahom (NPC + interakcia)
// a výstupom späť pred budovu. Hráč sa vráti presne tam, odkiaľ vošiel.
import * as THREE from 'three';
import { labelTexture } from './textures.js';

const ROOM = 7; // šírka miestnosti (14 × 14 m)
const HALF = ROOM / 2;
const WALL_H = 3.2;
const DOOR_GAP = 2.4; // koľko metrov steny chýba vpredu
const SPACING = 22;
const ENTER_RADIUS = 2.6;
const EXIT_RADIUS = 2.2;
const INTERACT_RADIUS = 2.6;
const MESSAGE_TIME = 5;
const COOLDOWN = 12;

/** Jednoduchý domáci/úradník/duchovný/frajer v interiéri. */
function buildKeeper({ shirt, pants, cap = null }) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac82', roughness: 1 });
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.62, 0.24),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 }),
  );
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 1.52;
  group.add(head);
  if (cap) {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: cap, roughness: 0.8 }),
    );
    hat.position.y = 1.66;
    group.add(hat);
  }
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.55, 0.16),
      new THREE.MeshStandardMaterial({ color: pants, roughness: 1 }),
    );
    leg.geometry.translate(0, -0.275, 0);
    leg.position.set(sx * 0.11, 0.74, 0);
    group.add(leg);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.13),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 }),
    );
    arm.geometry.translate(0, -0.25, 0);
    arm.position.set(sx * 0.29, 1.3, 0);
    group.add(arm);
  }
  return group;
}

/** Plávajúci zlatý marker (rovnaký ako pri pickupoch). */
function buildMarker() {
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshStandardMaterial({ color: '#f0c53a', emissive: '#c99a12', emissiveIntensity: 0.9 }),
  );
  marker.position.y = 3.4;
  return marker;
}

/**
 * Interiéry pre štyri budovy. Každý má dvere (trigger v dedine), vlastnú miestnosť
 * postavenú na samote, obsah (props + NPC + interakcia) a výstup pri dverách.
 */
const DEFS = [
  {
    id: 'kostol',
    spot: 'kostol',
    name: 'Kostol',
    label: '⛪ Kostol — F vstup',
    colors: { floor: '#cfc4ae', wall: '#efe7d6', accent: '#c99a12' },
    keeper: { shirt: '#3b3b46', pants: '#2c2c34', cap: null },
    interaction: {
      label: 'Zapáľ sviečku',
      message: 'Zapálil si sviečku. Pán Boh zaplať!',
      health: 25,
    },
  },
  {
    id: 'krčma',
    spot: 'krčma',
    name: 'Krčma',
    label: '🍺 Krčma — F vstup',
    colors: { floor: '#8a6a44', wall: '#b08a5a', accent: '#7a4a1e' },
    keeper: { shirt: '#e6d2a4', pants: '#4a4a3e', cap: null },
    interaction: {
      label: 'Daj si pivo',
      message: 'Pivo za 5 $ — na zdravie!',
      health: 10,
      money: -5,
    },
  },
  {
    id: 'obchod',
    spot: 'obchod',
    name: 'Obchod',
    label: '🛒 Obchod — F vstup',
    colors: { floor: '#c8c8c0', wall: '#dfd8c8', accent: '#3f6e9e' },
    keeper: { shirt: '#3f6e9e', pants: '#3a4250', cap: null },
    interaction: {
      label: 'Kúp vestu',
      message: 'Vesta za 100 $ — teraz vydržíš viac!',
      armor: 50,
      money: -100,
    },
  },
  {
    id: 'úrad',
    spot: 'úrad',
    name: 'Obecný úrad',
    label: '🏛️ Úrad — F vstup',
    colors: { floor: '#b9b3a4', wall: '#d6d0c0', accent: '#2c4a6e' },
    keeper: { shirt: '#d6d0c0', pants: '#2c2c34', cap: '#14213d' },
    interaction: {
      label: 'Vybav potvrdenie',
      message: 'Potvrdenie o pobyte máš v kapse. Rešpekt +5!',
      respect: 5,
    },
  },
];

/** Nájde najplochšiu oblasť výškovej mapy pre rad miestností (9 × 3 bunky). */
function findFlatBase(geo) {
  const { cols, rows, stepX, stepZ, heights } = geo.hm;
  const blockC = 9;
  const blockR = 3;
  let best = null;
  for (let r0 = 1; r0 + blockR < rows - 1; r0 += 3) {
    for (let c0 = 1; c0 + blockC < cols - 1; c0 += 3) {
      let min = Infinity;
      let max = -Infinity;
      for (let r = r0; r <= r0 + blockR; r += 1) {
        for (let c = c0; c <= c0 + blockC; c += 1) {
          const h = heights[r][c];
          if (h < min) min = h;
          if (h > max) max = h;
        }
      }
      const range = max - min;
      if (!best || range < best.range) {
        best = { c: c0 + blockC / 2, r: r0 + blockR / 2, range };
      }
    }
  }
  const spot = best ?? { c: (cols - 1) / 2, r: (rows - 1) / 2 };
  return {
    x: (spot.c - (cols - 1) / 2) * stepX,
    z: (spot.r - (rows - 1) / 2) * stepZ,
    flatness: best?.range ?? 0,
  };
}

export function createInteriors({ scene, geo, player, audio, spots, colliders = null }) {
  const state = {
    inside: null,
    nearDoor: null,
    message: '',
    messageTimer: 0,
    visits: 0,
    interactions: 0,
    outside: null,
  };
  const list = [];

  // Miestnosti stoja na najplochšej časti mapy, aby podlaha nelámala terén.
  const flat = findFlatBase(geo);
  const base = { x: flat.x - (DEFS.length - 1) * SPACING * 0.5, z: flat.z };
  state.flatness = flat.flatness;

  function addWall(group, cx, cz, sx, sz, material) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_H, sz), material);
    wall.position.set(cx, WALL_H / 2, cz);
    group.add(wall);
    return wall;
  }

  function addCollider(cx, cz, sx, sz) {
    if (!colliders) return;
    const hx = sx / 2;
    const hz = sz / 2;
    colliders.push([
      { x: cx - hx, z: cz - hz },
      { x: cx + hx, z: cz - hz },
      { x: cx + hx, z: cz + hz },
      { x: cx - hx, z: cz + hz },
    ]);
  }

  DEFS.forEach((def, index) => {
    const spot = spots[def.spot];
    if (!spot) return;
    const center = { x: base.x + index * SPACING, z: base.z };
    const ground = geo.heightAt(center.x, center.z);
    const group = new THREE.Group();
    group.position.set(center.x, ground, center.z);

    const floorMat = new THREE.MeshStandardMaterial({ color: def.colors.floor, roughness: 0.95 });
    const wallMat = new THREE.MeshStandardMaterial({ color: def.colors.wall, roughness: 0.9 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: def.colors.accent,
      emissive: def.colors.accent,
      emissiveIntensity: 0.25,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM + 0.6, 0.3, ROOM + 0.6), floorMat);
    floor.position.y = 0.15;
    group.add(floor);
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(ROOM + 0.6, 0.25, ROOM + 0.6), wallMat);
    ceiling.position.y = WALL_H;
    group.add(ceiling);

    // Steny: zadná (-z), boky, predná (+z) s dierou (dvere).
    addWall(group, 0, -HALF, ROOM + 0.6, 0.3, wallMat);
    addWall(group, -HALF, 0, 0.3, ROOM + 0.6, wallMat);
    addWall(group, HALF, 0, 0.3, ROOM + 0.6, wallMat);
    const segment = (ROOM + 0.6 - DOOR_GAP) / 2;
    addWall(group, -(DOOR_GAP + segment) / 2, HALF, segment, 0.3, wallMat);
    addWall(group, (DOOR_GAP + segment) / 2, HALF, segment, 0.3, wallMat);
    addCollider(center.x, center.z - HALF, ROOM + 0.6, 0.3);
    addCollider(center.x - HALF, center.z, 0.3, ROOM + 0.6);
    addCollider(center.x + HALF, center.z, 0.3, ROOM + 0.6);
    addCollider(center.x - (DOOR_GAP + segment) / 2, center.z + HALF, segment, 0.3);
    addCollider(center.x + (DOOR_GAP + segment) / 2, center.z + HALF, segment, 0.3);

    // Obsah miestnosti: pult/oltár/stôl + NPC + interakčný bod.
    const prop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 0.7), accentMat);
    prop.position.set(0, 0.68, -HALF + 1.4);
    group.add(prop);

    const keeper = buildKeeper(def.keeper);
    keeper.position.set(0.9, 0, -HALF + 2.6);
    keeper.rotation.y = Math.PI;
    group.add(keeper);

    const marker = buildMarker();
    marker.position.set(0, 3.4, -HALF + 2.6);
    group.add(marker);

    scene.add(group);

    // Menovka pri dverách v dedine, aby hráč videl, kam sa dá vojsť.
    const { texture, aspect } = labelTexture(def.label, 'rgba(20,16,12,0.85)', '#ffe08a');
    const sign = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    sign.scale.set(2.2 * aspect, 2.2, 1);
    const signX = spot.x;
    const signZ = spot.z + 1.6;
    sign.position.set(signX, geo.heightAt(signX, signZ) + 3.6, signZ);
    scene.add(sign);

    list.push({
      ...def,
      center,
      ground,
      door: { x: spot.x, z: spot.z },
      exit: { x: center.x, z: center.z + HALF - 1.1 },
      interact: { x: center.x, z: center.z - HALF + 2.6 },
      object: group,
      sign,
      interactions: [{ label: def.interaction.label, message: def.interaction.message }],
      cooldown: 0,
      marker,
    });
  });

  function byId(id) {
    return list.find((room) => room.id === id) ?? null;
  }

  function say(text) {
    state.message = text;
    state.messageTimer = MESSAGE_TIME;
  }

  function enter(id) {
    const room = byId(id);
    if (!room || state.inside) return false;
    state.outside = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
    };
    // Vojdeš vnútri pri dverách a pozeráš sa do miestnosti (-z).
    player.position.set(room.center.x, room.ground + 0.2, room.exit.z);
    player.yaw = 0;
    player.velocity?.set?.(0, 0, 0);
    state.inside = id;
    state.visits += 1;
    if (audio) audio.playSfx('hit');
    say(`Vošiel si dovnútra — ${room.name}. F východ.`);
    return true;
  }

  function exit() {
    if (!state.inside) return false;
    const back = state.outside;
    state.inside = null;
    state.outside = null;
    if (back) {
      player.position.set(back.x, back.y, back.z);
      player.yaw = back.yaw;
    }
    if (audio) audio.playSfx('hit');
    say('Späť vonku.');
    return true;
  }

  /** F: vstúp/dnu, interaguj s obsahom, alebo vystúp. */
  function interact() {
    if (state.inside) {
      const room = byId(state.inside);
      if (!room) return false;
      const dx = player.position.x - room.interact.x;
      const dz = player.position.z - room.interact.z;
      if (dx * dx + dz * dz < INTERACT_RADIUS * INTERACT_RADIUS && room.cooldown <= 0) {
        room.cooldown = COOLDOWN;
        state.interactions += 1;
        const effect = room.interaction;
        if (effect.health) player.health = Math.min(100, player.health + effect.health);
        if (effect.armor) player.armor = Math.min(100, player.armor + effect.armor);
        if (effect.respect) player.respect = (player.respect ?? 0) + effect.respect;
        if (effect.money && player.money + effect.money >= 0) player.money += effect.money;
        if (audio) audio.playSfx('pickup');
        say(effect.message);
        return true;
      }
      const ex = player.position.x - room.exit.x;
      const ez = player.position.z - room.exit.z;
      if (ex * ex + ez * ez < EXIT_RADIUS * EXIT_RADIUS) return exit();
      return false;
    }
    const door = state.nearDoor ? byId(state.nearDoor) : null;
    if (door) return enter(door.id);
    return false;
  }

  function update(dt) {
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    for (const room of list) {
      if (room.cooldown > 0) room.cooldown -= dt;
    }
    if (state.inside) {
      state.nearDoor = null;
      const room = byId(state.inside);
      if (!room) {
        state.inside = null;
        return;
      }
      // Keby hráč vyšiel stenou (bez kolízie), vráť ho do miestnosti.
      const dx = player.position.x - room.center.x;
      const dz = player.position.z - room.center.z;
      if (dx * dx + dz * dz > (ROOM + 6) * (ROOM + 6)) {
        player.position.set(room.exit.x, room.ground + 0.2, room.exit.z);
      }
      return;
    }
    let near = null;
    for (const room of list) {
      const dx = player.position.x - room.door.x;
      const dz = player.position.z - room.door.z;
      const d = Math.hypot(dx, dz);
      if (d < ENTER_RADIUS && (!near || d < near.d)) near = { id: room.id, d };
    }
    state.nearDoor = near ? near.id : null;
  }

  return {
    list,
    state,
    update,
    enter,
    exit,
    interact,
    byId,
    inside: () => (state.inside ? byId(state.inside) : null),
  };
}
