// Low-poly cars and pedestrians that move along the road network.
import * as THREE from 'three';
import { roadWidth, isPaved } from './osm.js';

// Muted, dusty palette straight out of Los Santos.
const CAR_COLORS = ['#f4f1ea', '#6aadd4', '#c43830', '#2c2e32', '#e6d2a4', '#3c7a44', '#e08a34'];
const SHIRT_COLORS = ['#c43830', '#3f6e9e', '#e6d2a4', '#6e4a7a', '#e08a34', '#2c2e32', '#3c7a44'];
const PANTS_COLORS = ['#4a4a3e', '#3a4250', '#5d4632', '#464e44'];

const DRIVABLE = new Set([
  'residential',
  'unclassified',
  'tertiary',
  'secondary',
  'primary',
  'living_street',
  'service',
]);
const WALKABLE = new Set([
  'footway',
  'path',
  'cycleway',
  'residential',
  'living_street',
  'unclassified',
  'steps',
]);

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function makePath(geo, latlon) {
  const pts = latlon.map((g) => geo.toWorld(g.lat, g.lon));
  const cumulative = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
    );
  }
  return { pts, cumulative, length: cumulative[cumulative.length - 1] };
}

function samplePath(geo, path, distance, lateral) {
  const { pts, cumulative } = path;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < distance) i += 1;
  const t = (distance - cumulative[i - 1]) / Math.max(0.001, cumulative[i] - cumulative[i - 1]);
  const a = pts[i - 1];
  const b = pts[i];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const tx = dx / len;
  const tz = dz / len;
  const x = a.x + dx * t + -tz * lateral;
  const z = a.z + dz * t + tx * lateral;
  return { x, z, heading: Math.atan2(tx, tz) };
}

export function buildCar() {
  const group = new THREE.Group();
  const bodyColor = new THREE.Color(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 4),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.25 }),
  );
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.5, 1.9),
    new THREE.MeshStandardMaterial({ color: '#20262c', roughness: 0.25, metalness: 0.1 }),
  );
  cabin.position.set(0, 1.12, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  wheelGeom.rotateZ(Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.9 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeom, wheelMaterial);
      wheel.position.set(sx * 0.86, 0.32, sz * 1.3);
      group.add(wheel);
    }
  }

  const lightMaterial = new THREE.MeshStandardMaterial({
    color: '#fff6c8',
    emissive: '#fff0b0',
    emissiveIntensity: 0.8,
  });
  for (const sx of [-0.55, 0.55]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), lightMaterial);
    light.position.set(sx, 0.65, 2.0);
    group.add(light);
  }

  return group;
}

function buildPedestrian() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac82', roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({
    color: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
    roughness: 1,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)],
    roughness: 1,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.24), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 1.52;
  head.castShadow = true;
  group.add(head);

  const limbs = { legs: [], arms: [] };
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.16), pants);
    leg.geometry.translate(0, -0.275, 0);
    leg.position.set(sx * 0.11, 0.74, 0);
    leg.castShadow = true;
    group.add(leg);
    limbs.legs.push(leg);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.13), shirt);
    arm.geometry.translate(0, -0.25, 0);
    arm.position.set(sx * 0.29, 1.3, 0);
    arm.castShadow = true;
    group.add(arm);
    limbs.arms.push(arm);
  }

  group.userData.limbs = limbs;
  return group;
}

export function createTraffic(geo, layers) {
  const group = new THREE.Group();
  group.name = 'traffic';
  const cars = [];
  const pedestrians = [];

  const drivable = layers.roads
    .filter((r) => DRIVABLE.has(r.tags.highway))
    .map((r) => ({ road: r, path: makePath(geo, r.latlon) }))
    .filter((r) => r.path.length > 60)
    .sort((a, b) => b.path.length - a.path.length)
    .slice(0, 12);

  drivable.forEach((entry, index) => {
    for (let k = 0; k < 2; k += 1) {
      const car = buildCar();
      const half = Math.max(0.6, roadWidth(entry.road.tags) / 2 - 1.1);
      cars.push({
        object: car,
        path: entry.path,
        distance: ((index + k * 0.5) / (drivable.length * 2)) * entry.path.length,
        speed: 6 + hash(index * 3 + k) * 5,
        lateral: half,
        health: 100,
        state: 'drive',
        hitCooldown: 0,
      });
      group.add(car);
    }
  });

  const walkable = layers.roads
    .filter((r) => WALKABLE.has(r.tags.highway))
    .map((r) => ({ road: r, path: makePath(geo, r.latlon) }))
    .filter((r) => r.path.length > 25);

  for (let i = 0; i < Math.min(34, walkable.length * 3); i += 1) {
    const entry = walkable[i % walkable.length];
    const person = buildPedestrian();
    pedestrians.push({
      object: person,
      path: entry.path,
      distance: hash(i * 5.1) * entry.path.length,
      speed: 1.1 + hash(i * 2.3) * 0.7,
      lateral: (hash(i * 7.7) - 0.5) * 3,
      phase: hash(i * 9.1) * Math.PI * 2,
      direction: hash(i * 1.3) > 0.5 ? 1 : -1,
      health: 100,
      state: 'walk',
      // Roughly a quarter of the village are hot-headed chuligáni who swing
      // back instead of running away.
      aggression: hash(i * 3.1) > 0.72 ? 0.9 : 0.15,
      hitTimes: [],
      stateTimer: 0,
      attackTimer: 0,
      swingPhase: 0,
    });
    group.add(person);
  }

  /** The driver bails out of a shot-up car and legs it down the road. */
  function bailOut(car, fromX, fromZ) {
    const person = buildPedestrian();
    const cx = car.object.position.x;
    const cz = car.object.position.z;
    let awayX = cx - (fromX ?? cx - 1);
    let awayZ = cz - (fromZ ?? cz);
    const length = Math.hypot(awayX, awayZ) || 1;
    awayX /= length;
    awayZ /= length;
    const startX = cx - awayX * 1.7;
    const startZ = cz - awayZ * 1.7;
    const heading = Math.atan2(awayX, awayZ);
    const path = [
      { x: startX, z: startZ, heading, length: 0 },
      { x: startX + awayX * 18, z: startZ + awayZ * 18, heading, length: 18 },
    ];
    person.position.set(startX, geo.heightAt(startX, startZ), startZ);
    group.add(person);
    pedestrians.push({
      object: person,
      path,
      distance: 0,
      speed: 4.6,
      lateral: 0,
      phase: 0,
      direction: 1,
      health: 100,
      state: 'flee',
      aggression: 0.1,
      hitTimes: [],
      stateTimer: 0,
      attackTimer: 0,
      swingPhase: 0,
      temporary: true,
      life: 14,
    });
    return true;
  }

  const up = new THREE.Vector3(0, 1, 0);

  /** Knockdown / get-up bookkeeping shared by pedestrians. */
  function updateDowned(person, dt) {
    if (person.state === 'knockdown') {
      person.stateTimer -= dt;
      person.object.rotation.z = Math.PI / 2;
      if (person.stateTimer <= 0) {
        person.state = 'getup';
        person.stateTimer = 0.6;
      }
      return true;
    }
    if (person.state === 'getup') {
      person.stateTimer = Math.max(0, person.stateTimer - dt);
      person.object.rotation.z = (Math.PI / 2) * (person.stateTimer / 0.6);
      if (person.stateTimer <= 0) {
        person.object.rotation.z = 0;
        person.state = person.aggression > 0.7 ? 'fight' : 'flee';
      }
      return true;
    }
    return false;
  }

  /** Flinch after a hit, then run away or swing back. */
  function updateStagger(person, dt) {
    person.stateTimer -= dt;
    person.object.rotation.z = Math.sin(person.stateTimer * 42) * 0.18;
    if (person.stateTimer <= 0) {
      person.object.rotation.z = 0;
      person.state = person.aggression > 0.7 ? 'fight' : 'flee';
    }
  }

  /** Chase the player on foot and throw punches when close enough. */
  function updateFight(person, dt, player) {
    const dx = player.position.x - person.object.position.x;
    const dz = player.position.z - person.object.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    person.object.rotation.y = Math.atan2(dx, dz);

    if (distance > 1.5) {
      const speed = 2.8;
      const x = person.object.position.x + (dx / distance) * speed * dt;
      const z = person.object.position.z + (dz / distance) * speed * dt;
      person.object.position.set(x, geo.heightAt(x, z), z);
      const step = Math.sin((person.phase += dt * speed * 5));
      const { legs, arms } = person.object.userData.limbs;
      legs[0].rotation.x = step * 0.6;
      legs[1].rotation.x = -step * 0.6;
      arms[0].rotation.x = -step * 0.55;
      arms[1].rotation.x = step * 0.55;
      return;
    }

    // In reach: swing, and land a hit roughly once a second.
    const swing = Math.sin((person.swingPhase += dt * 9));
    const { arms, legs } = person.object.userData.limbs;
    arms[1].rotation.x = -1.7 + swing * 0.7;
    arms[0].rotation.x = -0.6;
    legs[0].rotation.x = 0;
    legs[1].rotation.x = 0;
    person.attackTimer -= dt;
    if (person.attackTimer <= 0) {
      person.attackTimer = 1.1;
      player.damage(8 + person.aggression * 4, person.object.position.x, person.object.position.z);
    }
  }

  /** Walk/flee movement along the path network (the original behaviour). */
  function updateWalking(person, dt) {
    const speed = person.state === 'flee' ? person.speed * 2.4 : person.speed;
    person.distance += person.direction * speed * dt;
    if (person.distance > person.path.length) person.distance -= person.path.length;
    if (person.distance < 0) person.distance += person.path.length;
    const s = samplePath(geo, person.path, person.distance, person.lateral);
    const ground = geo.heightAt(s.x, s.z);
    const step = Math.sin((person.phase += dt * speed * 4));
    person.object.position.set(s.x, ground, s.z);
    person.object.rotation.y = s.heading + (person.direction < 0 ? Math.PI : 0);
    person.object.rotation.z = 0;
    const { legs, arms } = person.object.userData.limbs;
    legs[0].rotation.x = step * 0.55;
    legs[1].rotation.x = -step * 0.55;
    arms[0].rotation.x = -step * 0.5;
    arms[1].rotation.x = step * 0.5;
    person.object.position.y = ground + Math.abs(step) * 0.03;
  }

  return {
    group,
    cars,
    peds: pedestrians,
    /**
     * Damage a pedestrian. Small hits make them flinch (and hot-heads fight
     * back), three quick hits or one heavy hit knock them down, zero health
     * leaves a body behind.
     */
    hitPed(person, damage, { combo = 1 } = {}) {
      if (person.state === 'dead') return false;
      person.health = Math.max(0, person.health - damage);
      if (person.health <= 0) {
        person.state = 'dead';
        person.object.rotation.z = Math.PI / 2;
        person.object.position.y += 0.15;
      } else if (combo >= 3 || damage >= 40) {
        person.state = 'knockdown';
        person.stateTimer = 2.4;
        person.object.rotation.z = Math.PI / 2;
        person.object.position.y += 0.12;
      } else if (person.aggression > 0.7) {
        person.state = 'fight';
        person.attackTimer = 0.9;
      } else {
        person.state = 'stagger';
        person.stateTimer = 0.4;
      }
      return true;
    },
    /**
     * Damage a car; wrecked cars stop dead. When `bail` is set (a drive-by or a
     * bullet through the bodywork) the driver jumps out and runs away.
     */
    hitCar(car, damage, { bail = false, fromX, fromZ } = {}) {
      car.health = Math.max(0, car.health - damage);
      if (car.health <= 0) {
        car.state = 'wrecked';
        car.speed = 0;
        return true;
      }
      if (bail) {
        car.panicTimer = 2.5;
        bailOut(car, fromX, fromZ);
      }
      return true;
    },
    /** Everyone within `radius` of (x, z) runs away; `exclude` is spared. */
    panic(x, z, radius, exclude = null) {
      for (const person of pedestrians) {
        if (person.state === 'dead' || person === exclude) continue;
        const dx = person.object.position.x - x;
        const dz = person.object.position.z - z;
        if (dx * dx + dz * dz < radius * radius) {
          person.state = 'flee';
          person.direction = dx + dz > 0 ? 1 : -1;
        }
      }
    },
    update(dt, player = null) {
      for (const car of cars) {
        if (car.hitCooldown > 0) car.hitCooldown -= dt;
        if (car.state === 'stolen' || car.state === 'wrecked') continue;
        // A shot-up driver slams the brakes for a moment before driving on.
        if (car.panicTimer > 0) {
          car.panicTimer -= dt;
          continue;
        }
        car.distance += car.speed * dt;
        if (car.distance > car.path.length) car.distance -= car.path.length;
        const s = samplePath(geo, car.path, car.distance, car.lateral);
        car.object.position.set(s.x, geo.heightAt(s.x, s.z) + 0.05, s.z);
        car.object.rotation.y = s.heading;

        // Moving traffic hurts a player who stands in the road.
        if (player && !player.vehicle && !player.dead && car.speed > 6 && car.hitCooldown <= 0) {
          const dx = player.position.x - s.x;
          const dz = player.position.z - s.z;
          if (dx * dx + dz * dz < 1.6 * 1.6) {
            car.hitCooldown = 2;
            player.damage(26, s.x, s.z);
          }
        }
      }
      for (let i = pedestrians.length - 1; i >= 0; i -= 1) {
        const person = pedestrians[i];
        // Drivers who bailed out clear off after a while.
        if (person.temporary) {
          person.life -= dt;
          if (person.life <= 0) {
            group.remove(person.object);
            pedestrians.splice(i, 1);
            continue;
          }
        }
        if (person.state === 'dead') continue;
        if (updateDowned(person, dt)) continue;
        if (person.state === 'stagger') {
          updateStagger(person, dt);
          continue;
        }
        if (person.state === 'fight' && player && !player.dead) {
          updateFight(person, dt, player);
          continue;
        }
        updateWalking(person, dt);
      }
    },
  };
}
