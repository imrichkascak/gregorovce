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

function buildCar() {
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
    });
    group.add(person);
  }

  const up = new THREE.Vector3(0, 1, 0);

  return {
    group,
    update(dt) {
      for (const car of cars) {
        car.distance += car.speed * dt;
        if (car.distance > car.path.length) car.distance -= car.path.length;
        const s = samplePath(geo, car.path, car.distance, car.lateral);
        car.object.position.set(s.x, geo.heightAt(s.x, s.z) + 0.05, s.z);
        car.object.rotation.y = s.heading;
      }
      for (const person of pedestrians) {
        person.distance += person.direction * person.speed * dt;
        if (person.distance > person.path.length) person.distance -= person.path.length;
        if (person.distance < 0) person.distance += person.path.length;
        const s = samplePath(geo, person.path, person.distance, person.lateral);
        const ground = geo.heightAt(s.x, s.z);
        const step = Math.sin((person.phase += dt * person.speed * 4));
        person.object.position.set(s.x, ground, s.z);
        person.object.rotation.y = s.heading + (person.direction < 0 ? Math.PI : 0);
        const { legs, arms } = person.object.userData.limbs;
        legs[0].rotation.x = step * 0.55;
        legs[1].rotation.x = -step * 0.55;
        arms[0].rotation.x = -step * 0.5;
        arms[1].rotation.x = step * 0.5;
        person.object.position.y = ground + Math.abs(step) * 0.03;
      }
    },
  };
}
