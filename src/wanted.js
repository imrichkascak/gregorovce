// Polícia: hliadky s blikajúcou sirénou ťa naháňajú, pri dvoch hviezdach
// vystúpia policajti a strieľajú, pri štyroch pribudnú zátarasy; keď sa
// stratíš z dohľadu, hviezdy chladnú, a lakovacia garáž pri obchode zmaže
// wanted úplne. Zatknutie = pokuta + BUSTED.
import * as THREE from 'three';
import { buildCar } from './traffic.js';
import { clampWanted } from './rules.js';

const SIGHT = 38; // koľko metrov polícia vidí
const HIDE_TIME = 30; // koľko sekúnd v úkryte zhodí jednu hviezdu
const ROADBLOCK_LEVEL = 4;
const FINE_PER_STAR = 120;
const COP_SPEED = 3.6;
const COP_RANGE = 24;
const COP_SHOOT_TIME = 1.3;
const COP_SHOOT_DAMAGE = 8;
const MAX_CARS = 6;
const MAX_COPS = 6;
const GARAGE_RADIUS = 3.6;

/** Policajt v tmavomodrej uniforme s čiapkou. */
function buildOfficer() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac82', roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#22406e', roughness: 1 });
  const pants = new THREE.MeshStandardMaterial({ color: '#1b2536', roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.26), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 1.52;
  group.add(head);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: '#14213d', roughness: 0.8 }),
  );
  cap.position.y = 1.67;
  group.add(cap);

  const limbs = { legs: [], arms: [] };
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.17), pants);
    leg.geometry.translate(0, -0.275, 0);
    leg.position.set(sx * 0.12, 0.74, 0);
    group.add(leg);
    limbs.legs.push(leg);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), shirt);
    arm.geometry.translate(0, -0.25, 0);
    arm.position.set(sx * 0.3, 1.3, 0);
    group.add(arm);
    limbs.arms.push(arm);
  }
  group.userData.limbs = limbs;
  return group;
}

/** Zátaras: červeno-biele pruhy naprieč cestou + maják. */
function buildRoadblock() {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#c43830', roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.7 });
  for (let i = 0; i < 4; i += 1) {
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.34, 0.34),
      i % 2 === 0 ? red : white,
    );
    barrier.position.set(0, 0.5, -3.4 + i * 2.2);
    barrier.castShadow = true;
    group.add(barrier);
  }
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#f0c53a', emissive: '#f0c53a', emissiveIntensity: 1 }),
  );
  lamp.position.set(0, 1.15, -3.4);
  group.add(lamp);
  return group;
}

/** Lakovacia garáž: tri steny, strecha a zelený marker. */
function buildGarage() {
  const wall = new THREE.MeshStandardMaterial({ color: '#3f6e9e', roughness: 0.85 });
  const group = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(6, 2.8, 0.3), wall);
  back.position.set(0, 1.4, 2.6);
  group.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 5.5), wall);
    side.position.set(sx * 2.85, 1.4, 0);
    group.add(side);
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.25, 5.9),
    new THREE.MeshStandardMaterial({ color: '#c43830', roughness: 0.8 }),
  );
  roof.position.set(0, 2.9, 0);
  group.add(roof);

  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8),
    new THREE.MeshStandardMaterial({ color: '#f0c53a', emissive: '#c99a12', emissiveIntensity: 0.9 }),
  );
  marker.position.set(0, 4.1, 0);
  group.add(marker);
  return group;
}

export function createWanted({
  scene,
  geo,
  player,
  audio,
  effects = null,
  traffic = null,
  layers = null,
  spots = null,
}) {
  const state = {
    level: 0,
    busted: false,
    bustedTimer: 0,
    hidden: 0,
    resprays: 0,
    fine: 0,
    copShots: 0,
  };
  const units = [];
  const garage = { x: 0, z: 0, radius: GARAGE_RADIUS, object: null };

  // Lakovacia garáž stojí vedľa obchodu.
  if (spots?.obchod) {
    const gx = spots.obchod.x + 6;
    const gz = spots.obchod.z + 4;
    const object = buildGarage();
    object.position.set(gx, geo.heightAt(gx, gz), gz);
    scene.add(object);
    garage.x = gx;
    garage.z = gz;
    garage.object = object;
  }

  function crime(points = 1) {
    if (state.busted) return;
    state.level = clampWanted(state.level + points);
  }

  function bribe(amount = 2) {
    state.level = clampWanted(state.level - amount);
  }

  function removeUnit(unit) {
    scene.remove(unit.object);
    const index = units.indexOf(unit);
    if (index >= 0) units.splice(index, 1);
  }

  function clear() {
    state.level = 0;
    state.hidden = 0;
    state.busted = false;
    state.bustedTimer = 0;
    for (const unit of units) scene.remove(unit.object);
    units.length = 0;
  }

  /** Hliadka: čierno-biely cruiser s blikajúcimi svetlami. */
  function spawnUnit() {
    const car = buildCar();
    car.traverse((obj) => {
      if (obj.material) obj.material.color.multiplyScalar(0.55);
    });
    const lights = [];
    ['#3f6eff', '#ff3f3f'].forEach((color, i) => {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.16, 0.3),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }),
      );
      light.position.set(i === 0 ? -0.35 : 0.35, 1.42, -0.2);
      car.add(light);
      lights.push(light);
    });
    const angle = Math.random() * Math.PI * 2;
    const x = player.position.x + Math.cos(angle) * 45;
    const z = player.position.z + Math.sin(angle) * 45;
    car.position.set(x, geo.heightAt(x, z) + 0.05, z);
    scene.add(car);
    const unit = { kind: 'car', object: car, speed: 13, lights, siren: true, flashPhase: 0, deployed: false };
    units.push(unit);
    return unit;
  }

  /** Z hliadky vystúpia dvaja policajti a naháňajú ťa pešo. */
  function deployCops(unit) {
    for (let i = 0; i < 2; i += 1) {
      if (units.filter((u) => u.kind === 'cop').length >= MAX_COPS) return;
      const officer = buildOfficer();
      const ox = unit.object.position.x + (i === 0 ? 1.5 : -1.5);
      const oz = unit.object.position.z + (i === 0 ? 1.3 : -1.3);
      officer.position.set(ox, geo.heightAt(ox, oz), oz);
      scene.add(officer);
      units.push({ kind: 'cop', object: officer, speed: COP_SPEED, shootTimer: 0.8, phase: 0 });
    }
  }

  /** Nájde bod na ceste 24–70 m od hráča pre zátaras. */
  function roadAnchor() {
    if (!layers) return null;
    let best = null;
    for (const road of layers.roads) {
      for (const point of road.latlon) {
        const w = geo.toWorld(point.lat, point.lon);
        const d = Math.hypot(w.x - player.position.x, w.z - player.position.z);
        if (d > 24 && d < 70 && (!best || d < best.d)) best = { x: w.x, z: w.z, d };
      }
    }
    return best;
  }

  /** Zátaras naprieč cestou otočený k hráčovi. */
  function spawnRoadblock() {
    const anchor = roadAnchor() ?? {
      x: player.position.x + 30,
      z: player.position.z + 30,
    };
    const object = buildRoadblock();
    object.position.set(anchor.x, geo.heightAt(anchor.x, anchor.z), anchor.z);
    object.rotation.y = Math.atan2(player.position.x - anchor.x, player.position.z - anchor.z);
    scene.add(object);
    units.push({ kind: 'roadblock', object });
    return object;
  }

  /** Zatknutie: pokuta, BUSTED a respawn. */
  function arrest() {
    if (state.busted) return;
    state.fine = FINE_PER_STAR * state.level;
    player.money = Math.max(0, player.money - state.fine);
    clear();
    state.busted = true;
    state.bustedTimer = 2.6;
    if (audio) audio.playSfx('ko');
    player.dropFromSky();
  }

  function update(dt) {
    // 1. Hliadky podľa wanted levelu.
    const cruisers = units.filter((u) => u.kind === 'car');
    const wantedCars = Math.min(state.level, MAX_CARS);
    while (cruisers.length < wantedCars) cruisers.push(spawnUnit());
    while (cruisers.length > wantedCars) removeUnit(cruisers.pop());

    // 2. Zátarasy od štyroch hviezd.
    const blocks = units.filter((u) => u.kind === 'roadblock');
    if (state.level >= ROADBLOCK_LEVEL && blocks.length === 0) {
      spawnRoadblock();
      spawnRoadblock();
    } else if (state.level < ROADBLOCK_LEVEL) {
      for (const block of [...blocks]) removeUnit(block);
    }

    // 3. Bez hviezd sa policajti stiahnu.
    if (state.level === 0) {
      for (const cop of units.filter((u) => u.kind === 'cop')) removeUnit(cop);
    }

    // 4. BUSTED overlay zhasne.
    if (state.bustedTimer > 0) {
      state.bustedTimer -= dt;
      if (state.bustedTimer <= 0) state.busted = false;
    }

    // 5. Keď ťa nikto nevidí, hviezdy chladnú.
    let seen = false;
    for (const unit of units) {
      const dx = player.position.x - unit.object.position.x;
      const dz = player.position.z - unit.object.position.z;
      if (Math.hypot(dx, dz) < SIGHT) {
        seen = true;
        break;
      }
    }
    if (seen) {
      state.hidden = 0;
    } else if (state.level > 0) {
      state.hidden += dt;
      if (state.hidden >= HIDE_TIME) {
        state.hidden = 0;
        state.level = clampWanted(state.level - 1);
      }
    }

    // 6. Hliadky naháňajú hráča a blikajú.
    for (const unit of cruisers) {
      unit.flashPhase += dt * 6;
      const on = Math.sin(unit.flashPhase) > 0;
      unit.lights[0].material.emissiveIntensity = on ? 1.6 : 0.2;
      unit.lights[1].material.emissiveIntensity = on ? 0.2 : 1.6;

      const dx = player.position.x - unit.object.position.x;
      const dz = player.position.z - unit.object.position.z;
      const length = Math.hypot(dx, dz) || 1;
      if (length > 2.4) {
        unit.object.position.x += (dx / length) * unit.speed * dt;
        unit.object.position.z += (dz / length) * unit.speed * dt;
        unit.object.position.y =
          geo.heightAt(unit.object.position.x, unit.object.position.z) + 0.05;
        unit.object.rotation.y = Math.atan2(dx / length, dz / length);
      }
      // Od dvoch hviezd vystúpia policajti a pokračujú pešo.
      if (state.level >= 2 && !unit.deployed && length < 26) {
        unit.deployed = true;
        deployCops(unit);
      }
    }

    // 7. Peší policajti: naháňajú, strieľajú a zatknú.
    for (const cop of units.filter((u) => u.kind === 'cop')) {
      const dx = player.position.x - cop.object.position.x;
      const dz = player.position.z - cop.object.position.z;
      const distance = Math.hypot(dx, dz) || 1;
      cop.object.rotation.y = Math.atan2(dx, dz);
      if (distance > 1.6) {
        const x = cop.object.position.x + (dx / distance) * cop.speed * dt;
        const z = cop.object.position.z + (dz / distance) * cop.speed * dt;
        cop.object.position.set(x, geo.heightAt(x, z), z);
        const step = Math.sin((cop.phase += dt * cop.speed * 5));
        const { legs, arms } = cop.object.userData.limbs;
        legs[0].rotation.x = step * 0.6;
        legs[1].rotation.x = -step * 0.6;
        arms[0].rotation.x = -step * 0.55;
        arms[1].rotation.x = step * 0.55;
      }
      cop.shootTimer -= dt;
      if (distance < COP_RANGE && !player.dead && cop.shootTimer <= 0) {
        cop.shootTimer = COP_SHOOT_TIME;
        state.copShots += 1;
        const { arms } = cop.object.userData.limbs;
        arms[1].rotation.x = -1.6;
        if (audio) audio.playSfx('gunshot');
        if (effects) {
          effects.spawn('spark', cop.object.position.x, cop.object.position.y + 1.2, cop.object.position.z, 0.7);
        }
        player.damage(COP_SHOOT_DAMAGE + state.level * 1.5, cop.object.position.x, cop.object.position.z);
      }
      if (distance < 2.2 && !player.vehicle && !player.dead) arrest();
    }

    // 8. Lakovacia garáž zmaže wanted.
    if (state.level > 0) {
      const dx = player.position.x - garage.x;
      const dz = player.position.z - garage.z;
      if (dx * dx + dz * dz < garage.radius * garage.radius) {
        state.resprays += 1;
        state.level = 0;
        clear();
        if (audio) audio.playSfx('pickup');
      }
    }
  }

  return {
    state,
    units,
    garage,
    crime,
    bribe,
    clear,
    update,
    deployCops,
    spawnRoadblock,
    roadAnchor,
  };
}
