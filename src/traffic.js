// Low-poly cars and pedestrians that move along the road network.
// Rozpočet draw callov: autá sú zlúčené do dvoch meshov (karoséria + svetlá)
// a všetci chodci dediny sú instancovaní v šiestich instancovaných meshcoch
// (torso, hlava, nohy, ruky), takže desiatky áut a chodcov stoja pár callov.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadWidth, specialKind } from './osm.js';

// Muted, dusty palette straight out of Los Santos.
const CAR_COLORS = ['#f4f1ea', '#6aadd4', '#c43830', '#2c2e32', '#e6d2a4', '#3c7a44', '#e08a34'];
const SHIRT_COLORS = ['#c43830', '#3f6e9e', '#e6d2a4', '#6e4a7a', '#e08a34', '#2c2e32', '#3c7a44'];
const PANTS_COLORS = ['#4a4a3e', '#3a4250', '#5d4632', '#464e44'];
const SKIN_COLOR = '#e0ac82';
const WHEEL_COLOR = '#15171a';
const CABIN_COLOR = '#20262c';

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

// Hustota: koľko áut stojí na cestách pri dedine a koľko na vzdialených cestách,
// koľko chodcov chodí po chodníkoch pri dedine a koľko na vzdialených.
const NEAR_RADIUS = 300;
const CAR_NEAR = 3;
const CAR_FAR = 1;
const PED_NEAR = 5;
const PED_FAR = 1;
const PED_CAPACITY = 192;
const CAR_CAPACITY = 128;

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

/** Obohatí geometriu o jednoliatu farbu (vertex colors pre zlúčenie). */
function paint(geometry, color) {
  const count = geometry.attributes.position.count;
  const arr = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

/** Zlúči diely [{geom, color}] do jednej geometrie s farbami — 1 draw call. */
function mergePainted(parts) {
  return mergeGeometries(
    parts.map((part) => paint(part.geom, part.color)),
    false,
  );
}

const CAR_BODY_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.45,
  metalness: 0.25,
});
const CAR_LIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#fff6c8',
  emissive: '#fff0b0',
  emissiveIntensity: 0.8,
});

function wheelGeometry(radius = 0.32, width = 0.24) {
  const geom = new THREE.CylinderGeometry(radius, radius, width, 10);
  geom.rotateZ(Math.PI / 2);
  return geom;
}

/** Karoséria auta: zlúčená geometria s farbou karosérie (bez svetiel). */
function carBodyGeometry(bodyColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]) {
  const parts = [];
  const add = (geom, color, x, y, z) => {
    geom.translate(x, y, z);
    parts.push({ geom, color });
  };
  add(new THREE.BoxGeometry(1.7, 0.55, 4), bodyColor, 0, 0.62, 0);
  add(new THREE.BoxGeometry(1.5, 0.5, 1.9), CABIN_COLOR, 0, 1.12, -0.2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(wheelGeometry(), WHEEL_COLOR, sx * 0.86, 0.32, sz * 1.3);
    }
  }
  return mergePainted(parts);
}

// Svetlá auta: dve krabice, zdieľaná geometria pre všetky autá dopravy.
const CAR_LIGHT_GEOM = (() => {
  const lights = [];
  for (const sx of [-0.55, 0.55]) {
    const light = new THREE.BoxGeometry(0.3, 0.16, 0.08);
    light.translate(sx, 0.65, 2.0);
    lights.push(light);
  }
  return mergeGeometries(lights, false);
})();

// Karoséria pre instancie: biela = farbu auta dodá instanceColor.
const CAR_BODY_GEO = carBodyGeometry('#ffffff');

/** Auto pre políciu a hráča: karoséria v jednom meshi, svetlá v druhom. */
export function buildCar() {
  const group = new THREE.Group();
  // Materiál je klonovaný, aby si policajný cruiser mohol stmaviť farbu sám.
  const body = new THREE.Mesh(carBodyGeometry(), CAR_BODY_MATERIAL.clone());
  body.castShadow = true;
  group.add(body);
  group.add(new THREE.Mesh(CAR_LIGHT_GEOM, CAR_LIGHT_MATERIAL.clone()));
  return group;
}

// --- chodec ako dáta: šesť dielov, ktoré vedia animovať končatiny -----------
const PED_TORSO_GEOM = new THREE.BoxGeometry(0.42, 0.62, 0.24);
const PED_HEAD_GEOM = new THREE.SphereGeometry(0.17, 12, 10);
const PED_LEG_GEOM = new THREE.BoxGeometry(0.15, 0.55, 0.16);
PED_LEG_GEOM.translate(0, -0.275, 0);
const PED_ARM_GEOM = new THREE.BoxGeometry(0.12, 0.5, 0.13);
PED_ARM_GEOM.translate(0, -0.25, 0);

const PED_PARTS = [
  { id: 'torso', geometry: PED_TORSO_GEOM, x: 0, y: 1.05, z: 0, color: 'shirt' },
  { id: 'head', geometry: PED_HEAD_GEOM, x: 0, y: 1.52, z: 0, color: 'skin' },
  { id: 'legL', geometry: PED_LEG_GEOM, x: -0.11, y: 0.74, z: 0, color: 'pants', limb: 'legs', slot: 0 },
  { id: 'legR', geometry: PED_LEG_GEOM, x: 0.11, y: 0.74, z: 0, color: 'pants', limb: 'legs', slot: 1 },
  { id: 'armL', geometry: PED_ARM_GEOM, x: -0.29, y: 1.3, z: 0, color: 'shirt', limb: 'arms', slot: 0 },
  { id: 'armR', geometry: PED_ARM_GEOM, x: 0.29, y: 1.3, z: 0, color: 'shirt', limb: 'arms', slot: 1 },
];

const PED_MATERIALS = {
  cloth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
  skin: new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 1 }),
};

/** Náhodný vzhľad chodca (tričko a nohavice). */
function pedLook() {
  return {
    shirt: new THREE.Color(SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)]),
    pants: new THREE.Color(PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)]),
  };
}

/** Diely chodca ako geometrie s farbami (jazdec na motorke/bicykli). */
function pedestrianParts(look) {
  return PED_PARTS.map((part) => {
    const geom = part.geometry.clone();
    geom.translate(part.x, part.y, part.z);
    return { geom, color: part.color === 'skin' ? SKIN_COLOR : look[part.color] };
  });
}

/** Motorka: úzke telo, dve kolesá, riadidlá a jazdec v jednom meshi. */
function buildMoto() {
  const group = new THREE.Group();
  const bodyColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const parts = [];
  const add = (geom, color, x, y, z) => {
    geom.translate(x, y, z);
    parts.push({ geom, color });
  };
  add(new THREE.BoxGeometry(0.46, 0.42, 2), bodyColor, 0, 0.74, 0);
  for (const sz of [-0.78, 0.78]) add(wheelGeometry(0.3, 0.14), WHEEL_COLOR, 0, 0.3, sz);
  add(new THREE.BoxGeometry(0.62, 0.06, 0.06), CABIN_COLOR, 0, 1.05, -0.62);
  // Jazdec sedí na motorke — zmenšený a posunutý chodec.
  const look = pedLook();
  for (const part of pedestrianParts(look)) {
    part.geom.scale(0.9, 0.9, 0.9);
    part.geom.translate(0, 0.62, 0.12);
    parts.push(part);
  }
  const mesh = new THREE.Mesh(mergePainted(parts), CAR_BODY_MATERIAL.clone());
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

/** Bicykel: tenký rám, dve špicaté kolesá a pomalý jazdec v jednom meshi. */
function buildBike() {
  const group = new THREE.Group();
  const frameColor = CAR_COLORS[2];
  const parts = [];
  const add = (geom, color, x, y, z) => {
    geom.translate(x, y, z);
    parts.push({ geom, color });
  };
  for (const sz of [-0.62, 0.62]) {
    const wheel = new THREE.TorusGeometry(0.32, 0.035, 6, 14);
    add(wheel, WHEEL_COLOR, 0, 0.33, sz);
  }
  const frame = new THREE.BoxGeometry(0.08, 0.08, 1.2);
  frame.rotateX(0.12);
  add(frame, frameColor, 0, 0.62, 0);
  add(new THREE.BoxGeometry(0.5, 0.05, 0.05), frameColor, 0, 0.95, -0.55);
  const look = pedLook();
  for (const part of pedestrianParts(look)) {
    part.geom.scale(0.85, 0.85, 0.85);
    part.geom.translate(0, 0.55, 0.05);
    parts.push(part);
  }
  const mesh = new THREE.Mesh(mergePainted(parts), CAR_BODY_MATERIAL.clone());
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

/**
 * Chodec: prázdna skupina — telo kreslia instancované meshe dediny a končatiny
 * sú iba prázdne uzly, ktoré animácia otáča (rovnaké API ako predtým).
 */
function buildPedestrian() {
  const group = new THREE.Group();
  group.userData.limbs = {
    legs: [new THREE.Object3D(), new THREE.Object3D()],
    arms: [new THREE.Object3D(), new THREE.Object3D()],
  };
  return group;
}

/** Stred dediny = centroid budov (rovnako ako spawn hráča). */
function villageCentre(geo, layers) {
  let x = 0;
  let z = 0;
  let count = 0;
  for (const building of layers.buildings) {
    for (const point of building.latlon) {
      const w = geo.toWorld(point.lat, point.lon);
      x += w.x;
      z += w.z;
      count += 1;
    }
  }
  return count ? { x: x / count, z: z / count } : { x: 0, z: 0 };
}

/** Posunie bod k najbližšej ceste, aby skupinka stála na ulici, nie v budove. */
function nearRoad(geo, layers, spot, fraction = 0.8, maxStep = 14) {
  let best = null;
  let bestDistance = maxStep;
  for (const road of layers.roads ?? []) {
    for (const point of road.latlon) {
      const w = geo.toWorld(point.lat, point.lon);
      const distance = Math.hypot(w.x - spot.x, w.z - spot.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = w;
      }
    }
  }
  if (!best) return { x: spot.x, z: spot.z };
  return {
    x: spot.x + (best.x - spot.x) * fraction,
    z: spot.z + (best.z - spot.z) * fraction,
  };
}

/** Nájde kotvu skupinky: POI alebo budovu daného druhu (krčma, kostol). */
function findAnchor(geo, layers, kind, centre) {
  const poi = layers.pois.find((p) => specialKind(p.tags) === kind);
  let spot = null;
  if (poi) {
    spot = geo.toWorld(poi.lat, poi.lon);
  } else {
    const building = layers.buildings.find((b) => specialKind(b.tags) === kind);
    if (building) {
      let x = 0;
      let z = 0;
      for (const point of building.latlon) {
        const w = geo.toWorld(point.lat, point.lon);
        x += w.x;
        z += w.z;
      }
      spot = { x: x / building.latlon.length, z: z / building.latlon.length };
    }
  }
  if (spot) return nearRoad(geo, layers, spot);
  // Záloha: kúsok od stredu dediny, aby skupinka existovala vždy.
  return { x: centre.x + 40, z: centre.z + 40 };
}

export function createTraffic(geo, layers) {
  const group = new THREE.Group();
  group.name = 'traffic';
  const cars = [];
  const pedestrians = [];
  const groups = [];
  // Main.js si pripojí zvuk trúbenia a výbuch auta (traffic nevie o efektoch).
  const hooks = { onHorn: null, onCarWrecked: null };
  const centre = villageCentre(geo, layers);

  // --- chodci: šesť instancovaných dielov pre celú dedinu -------------------
  let layer = null;

  function createPedLayer(capacity) {
    const meshes = {};
    for (const part of PED_PARTS) {
      const material = part.color === 'skin' ? PED_MATERIALS.skin : PED_MATERIALS.cloth;
      const mesh = new THREE.InstancedMesh(part.geometry, material, capacity);
      mesh.name = `peds-${part.id}`;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      group.add(mesh);
      meshes[part.id] = mesh;
    }
    return { capacity, meshes };
  }

  function applyPedColors(index, look) {
    layer.meshes.torso.setColorAt(index, look.shirt);
    layer.meshes.armL.setColorAt(index, look.shirt);
    layer.meshes.armR.setColorAt(index, look.shirt);
    layer.meshes.legL.setColorAt(index, look.pants);
    layer.meshes.legR.setColorAt(index, look.pants);
    for (const mesh of Object.values(layer.meshes)) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function ensurePedCapacity() {
    if (pedestrians.length <= layer.capacity) return;
    const old = layer;
    layer = createPedLayer(Math.max(pedestrians.length, old.capacity * 2));
    for (let i = 0; i < pedestrians.length; i += 1) applyPedColors(i, pedestrians[i].look);
    for (const mesh of Object.values(old.meshes)) {
      group.remove(mesh);
      mesh.dispose();
    }
  }

  layer = createPedLayer(PED_CAPACITY);

  const _pedMatrix = new THREE.Matrix4();
  const _pedQuat = new THREE.Quaternion();
  const _pedEuler = new THREE.Euler();
  const _one = new THREE.Vector3(1, 1, 1);
  const _partMatrix = new THREE.Matrix4();
  const _rotMatrix = new THREE.Matrix4();

  /** Zapíše polohy a animáciu všetkých chodcov do instancovaných meshov. */
  function syncPeds() {
    const count = pedestrians.length;
    for (const part of PED_PARTS) layer.meshes[part.id].count = count;
    for (let i = 0; i < count; i += 1) {
      const person = pedestrians[i];
      const object = person.object;
      _pedEuler.set(object.rotation.x, object.rotation.y, object.rotation.z);
      _pedMatrix.compose(object.position, _pedQuat.setFromEuler(_pedEuler), _one);
      for (const part of PED_PARTS) {
        _partMatrix.makeTranslation(part.x, part.y, part.z);
        if (part.limb) {
          const limb = object.userData.limbs[part.limb][part.slot];
          if (limb.rotation.x !== 0) _partMatrix.multiply(_rotMatrix.makeRotationX(limb.rotation.x));
        }
        _partMatrix.premultiply(_pedMatrix);
        layer.meshes[part.id].setMatrixAt(i, _partMatrix);
      }
    }
    for (const part of PED_PARTS) layer.meshes[part.id].instanceMatrix.needsUpdate = true;
  }

  function addPedestrian(record) {
    ensurePedCapacity();
    applyPedColors(pedestrians.length, record.look);
    pedestrians.push(record);
    group.add(record.object);
    return record;
  }

  /** Nový chodec s náhodným vzhľadom na (x, z). */
  function makePedestrian(x, z) {
    const person = buildPedestrian();
    person.position.set(x, geo.heightAt(x, z), z);
    return {
      object: person,
      look: pedLook(),
      path: null,
      distance: 0,
      speed: 1.2,
      lateral: 0,
      phase: 0,
      direction: 1,
      health: 100,
      state: 'walk',
      aggression: 0.15,
      hitTimes: [],
      stateTimer: 0,
      attackTimer: 0,
      swingPhase: 0,
      dodging: 0,
      dodgeShift: 0,
    };
  }

  // --- autá na cestách -------------------------------------------------------
  const drivable = layers.roads
    .filter((r) => DRIVABLE.has(r.tags.highway))
    .map((r) => ({ road: r, path: makePath(geo, r.latlon) }))
    .filter((r) => r.path.length > 60)
    .sort((a, b) => b.path.length - a.path.length);

  const distanceToCentre = (path) => {
    let min = Infinity;
    for (const point of path.pts) {
      min = Math.min(min, Math.hypot(point.x - centre.x, point.z - centre.z));
    }
    return min;
  };

  // Cars, motorbikes and bicycles share the road, each with its own pace.
  const TYPE_CYCLE = ['car', 'car', 'moto', 'bike'];
  // Vizuál áut kreslia dva spoločné instancované meshe (karoséria + svetlá) —
  // 2 draw cally za všetky autá. `car.object` je prázdny objekt, ktorý drží
  // polohu a rotáciu (zvyšok hry číta len tie).
  const BUILDERS = { car: makeCarProxy, moto: buildMoto, bike: buildBike };
  const PACE = { car: [6, 5], moto: [9, 6], bike: [2.4, 1.6] };
  const LATERAL = { car: 1, moto: 0.6, bike: 0.75 };

  /** Prázdny objekt auta — vizuál kreslia instancované meshe. */
  function makeCarProxy() {
    return new THREE.Group();
  }

  const carColors = [];
  let carBodies = new THREE.InstancedMesh(CAR_BODY_GEO, CAR_BODY_MATERIAL, CAR_CAPACITY);
  let carLights = new THREE.InstancedMesh(CAR_LIGHT_GEOM, CAR_LIGHT_MATERIAL, CAR_CAPACITY);
  for (const mesh of [carBodies, carLights]) {
    mesh.frustumCulled = false;
    mesh.count = 0;
    group.add(mesh);
  }
  carBodies.name = 'car-bodies';
  carLights.name = 'car-lights';
  carBodies.castShadow = true;

  /** Zväčší instancované meshe, keď pribudne auto (cheat AUTO, spawn). */
  function ensureCarCapacity() {
    if (cars.length <= carBodies.instanceMatrix.count) return;
    const next = Math.max(cars.length, carBodies.instanceMatrix.count * 2);
    for (const [mesh, geom, material, name] of [
      [carBodies, CAR_BODY_GEO, CAR_BODY_MATERIAL, 'car-bodies'],
      [carLights, CAR_LIGHT_GEOM, CAR_LIGHT_MATERIAL, 'car-lights'],
    ]) {
      const grown = new THREE.InstancedMesh(geom, material, next);
      grown.name = name;
      grown.frustumCulled = false;
      grown.castShadow = mesh.castShadow;
      grown.count = 0;
      group.remove(mesh);
      mesh.dispose();
      group.add(grown);
      if (name === 'car-bodies') carBodies = grown;
      else carLights = grown;
    }
    applyCarColors();
  }

  /** Farby áut do instanceColor — jedna farba na auto (motorky majú vlastný mesh). */
  function applyCarColors() {
    for (let i = 0; i < carColors.length; i += 1) {
      if (carColors[i]) carBodies.setColorAt(i, carColors[i]);
    }
    if (carBodies.instanceColor) carBodies.instanceColor.needsUpdate = true;
  }

  /** Pridá auto do zoznamu, nastaví mu farbu a pridá objekt do scény. */
  function pushCar(unit) {
    cars.push(unit);
    if (unit.type === 'car') {
      carColors[cars.length - 1] = new THREE.Color(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
      ensureCarCapacity();
      carBodies.setColorAt(cars.length - 1, carColors[cars.length - 1]);
      if (carBodies.instanceColor) carBodies.instanceColor.needsUpdate = true;
    }
    group.add(unit.object);
    return unit;
  }

  const _carMatrix = new THREE.Matrix4();
  const _carQuat = new THREE.Quaternion();
  const _carEuler = new THREE.Euler();
  const _carOne = new THREE.Vector3(1, 1, 1);
  const _carHidden = new THREE.Matrix4().makeScale(0, 0, 0);

  /** Zapíše polohy áut do instancovaných meshov (karoséria + svetlá). */
  function syncCars() {
    carBodies.count = cars.length;
    carLights.count = cars.length;
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i];
      if (car.type !== 'car') {
        // Motorky a bicykle majú vlastný mesh — ich slot v instancii je skrytý.
        carBodies.setMatrixAt(i, _carHidden);
        carLights.setMatrixAt(i, _carHidden);
        continue;
      }
      const object = car.object;
      _carEuler.set(0, object.rotation.y, 0);
      _carMatrix.compose(object.position, _carQuat.setFromEuler(_carEuler), _carOne);
      carBodies.setMatrixAt(i, _carMatrix);
      carLights.setMatrixAt(i, _carMatrix);
    }
    carBodies.instanceMatrix.needsUpdate = true;
    carLights.instanceMatrix.needsUpdate = true;
  }

  let carSeed = 0;
  drivable.forEach((entry) => {
    const count = distanceToCentre(entry.path) < NEAR_RADIUS ? CAR_NEAR : CAR_FAR;
    for (let k = 0; k < count; k += 1) {
      const type = TYPE_CYCLE[(carSeed + k) % TYPE_CYCLE.length];
      const car = BUILDERS[type]();
      const half = Math.max(0.6, roadWidth(entry.road.tags) / 2 - 1.1) * LATERAL[type];
      const [base, spread] = PACE[type];
      const distance = ((k + hash(carSeed * 7.7 + k)) / count) * entry.path.length;
      // Postav auto hneď na cestu (nie na 0,0) — prvý frame tak nie je prázdny.
      const start = samplePath(geo, entry.path, distance, half);
      car.position.set(start.x, geo.heightAt(start.x, start.z) + 0.05, start.z);
      car.rotation.y = start.heading;
      pushCar({
        object: car,
        type,
        path: entry.path,
        distance,
        speed: base + hash(carSeed * 3 + k) * spread,
        lateral: half,
        health: 100,
        state: 'drive',
        hitCooldown: 0,
        brakeTimer: 0,
        hornTimer: 0,
      });
    }
    carSeed += count;
  });
  syncCars();

  // --- chodci na chodníkoch ------------------------------------------------
  const walkable = layers.roads
    .filter((r) => WALKABLE.has(r.tags.highway))
    .map((r) => ({ road: r, path: makePath(geo, r.latlon) }))
    .filter((r) => r.path.length > 25);

  let pedSeed = 0;
  walkable.forEach((entry) => {
    const count = distanceToCentre(entry.path) < NEAR_RADIUS ? PED_NEAR : PED_FAR;
    for (let k = 0; k < count; k += 1) {
      const record = makePedestrian(0, 0);
      record.path = entry.path;
      record.distance = hash(pedSeed * 5.1) * entry.path.length;
      record.speed = 1.1 + hash(pedSeed * 2.3) * 0.7;
      record.lateral = (hash(pedSeed * 7.7) - 0.5) * 3;
      record.phase = hash(pedSeed * 9.1) * Math.PI * 2;
      record.direction = hash(pedSeed * 1.3) > 0.5 ? 1 : -1;
      // Roughly a quarter of the village are hot-headed chuligáni who swing
      // back instead of running away.
      record.aggression = hash(pedSeed * 3.1) > 0.72 ? 0.9 : 0.15;
      // Postav ho hneď na jeho miesto na chodníku (nie na 0,0).
      const start = samplePath(geo, record.path, record.distance, record.lateral);
      record.object.position.set(start.x, geo.heightAt(start.x, start.z), start.z);
      record.object.rotation.y = start.heading;
      addPedestrian(record);
      pedSeed += 1;
    }
  });

  // --- skupinky NPC: chuligáni pri krčme, babky pred kostolom ---------------
  const GROUP_DEFS = [
    { id: 'krčma', kind: 'pub', count: 3, aggression: 0.9, radius: 1.9 },
    { id: 'kostol', kind: 'church', count: 3, aggression: 0.15, radius: 2.1 },
  ];

  for (const def of GROUP_DEFS) {
    const anchor = findAnchor(geo, layers, def.kind, centre);
    const members = [];
    for (let i = 0; i < def.count; i += 1) {
      const angle = (i / def.count) * Math.PI * 2 + hash(i * 3.3);
      const x = anchor.x + Math.cos(angle) * def.radius;
      const z = anchor.z + Math.sin(angle) * def.radius;
      const record = makePedestrian(x, z);
      record.state = 'chat';
      record.aggression = def.aggression;
      record.anchor = { x: anchor.x, z: anchor.z };
      record.chatPhase = hash(i * 7.1) * Math.PI * 2;
      // Úniková cesta z kruhu von — keby skupinku niečo vyplašilo.
      record.path = {
        pts: [
          { x, z },
          { x: x + Math.cos(angle) * 26, z: z + Math.sin(angle) * 26 },
        ],
        cumulative: [0, 26],
        length: 26,
      };
      record.distance = 0;
      record.speed = 1.3;
      record.direction = 1;
      record.object.rotation.y = Math.atan2(anchor.x - x, anchor.z - z);
      addPedestrian(record);
      members.push(record);
    }
    groups.push({ id: def.id, x: anchor.x, z: anchor.z, members });
  }

  /** The driver bails out of a shot-up car and legs it down the road. */
  function bailOut(car, fromX, fromZ) {
    const cx = car.object.position.x;
    const cz = car.object.position.z;
    let awayX = cx - (fromX ?? cx - 1);
    let awayZ = cz - (fromZ ?? cz);
    const length = Math.hypot(awayX, awayZ) || 1;
    awayX /= length;
    awayZ /= length;
    const startX = cx - awayX * 1.7;
    const startZ = cz - awayZ * 1.7;
    const record = makePedestrian(startX, startZ);
    record.path = {
      pts: [
        { x: startX, z: startZ },
        { x: startX + awayX * 18, z: startZ + awayZ * 18 },
      ],
      cumulative: [0, 18],
      length: 18,
    };
    record.distance = 0;
    record.speed = 4.6;
    record.state = 'flee';
    record.aggression = 0.1;
    record.temporary = true;
    record.life = 14;
    addPedestrian(record);
    return true;
  }

  /** Je v jazdnom pruhu pred autom prekážka (hráč alebo iné auto)? */
  function laneBlocked(car, player) {
    const fx = -Math.sin(car.object.rotation.y);
    const fz = -Math.cos(car.object.rotation.y);
    const ahead = (x, z, range) => {
      const dx = x - car.object.position.x;
      const dz = z - car.object.position.z;
      const distance = Math.hypot(dx, dz);
      return distance > 0.05 && distance < range && (dx * fx + dz * fz) / distance > 0.6;
    };
    if (player && !player.dead && !player.vehicle && ahead(player.position.x, player.position.z, 8)) {
      return true;
    }
    for (const other of cars) {
      if (other === car || other.state === 'stolen' || other.state === 'wrecked') continue;
      if (ahead(other.object.position.x, other.object.position.z, 5.5)) return true;
    }
    return false;
  }

  /** Chodec uskočí nabok, keď sa k nemu blíži auto. */
  function updateDodge(person, dt) {
    let awayX = 0;
    let awayZ = 0;
    for (const car of cars) {
      if (car.state === 'wrecked') continue;
      const dx = person.object.position.x - car.object.position.x;
      const dz = person.object.position.z - car.object.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 4.2) {
        awayX += dx / (distance || 1);
        awayZ += dz / (distance || 1);
      }
    }
    if (awayX !== 0 || awayZ !== 0) {
      person.dodging = 0.9;
      person.dodgeShift = Math.sign(awayX + awayZ || 1) * 1.7;
    }
    if (person.dodging > 0) person.dodging -= dt;
    else person.dodgeShift = 0;
  }

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

  /** Skupinka stojí v kruhu a debatí — pohupuje sa a gestikuluje rukami. */
  function updateChat(person, dt) {
    person.chatPhase = (person.chatPhase ?? 0) + dt;
    const step = Math.sin(person.chatPhase * 2.1);
    const { arms, legs } = person.object.userData.limbs;
    arms[0].rotation.x = -0.4 + step * 0.22;
    arms[1].rotation.x = -0.25 - step * 0.3;
    legs[0].rotation.x = 0;
    legs[1].rotation.x = 0;
    const ground = geo.heightAt(person.object.position.x, person.object.position.z);
    person.object.position.y = ground + Math.abs(step) * 0.02;
  }

  /** Walk/flee movement along the path network (the original behaviour). */
  function updateWalking(person, dt) {
    const speed = person.state === 'flee' ? person.speed * 2.4 : person.speed;
    person.distance += person.direction * speed * dt;
    if (person.distance > person.path.length) person.distance -= person.path.length;
    if (person.distance < 0) person.distance += person.path.length;
    const s = samplePath(geo, person.path, person.distance, person.lateral + (person.dodgeShift ?? 0));
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
    groups,
    hooks,
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
     * bullet through the bodywork) the driver jumps out and runs away. A car at
     * zero HP explodes: the wreck burns and main.js adds fire, smoke and boom.
     */
    hitCar(car, damage, { bail = false, fromX, fromZ } = {}) {
      car.health = Math.max(0, car.health - damage);
      if (car.health <= 0) {
        car.state = 'wrecked';
        car.speed = 0;
        car.exploded = true;
        if (hooks.onCarWrecked) hooks.onCarWrecked(car);
        return true;
      }
      if (bail) {
        car.panicTimer = 2.5;
        bailOut(car, fromX, fromZ);
      }
      return true;
    },
    /**
     * Carjack: the driver bails out and legs it, the car is ready to be driven.
     * Returns false for wrecks and cars that are already stolen.
     */
    carjack(car, fromX, fromZ) {
      if (!car || car.state === 'stolen' || car.state === 'wrecked') return false;
      bailOut(car, fromX, fromZ);
      car.state = 'stolen';
      return true;
    },
    /**
     * Cheat `AUTO`: postaví auto na najbližší bod cesty pri (x, z). Vráti nové
     * vozidlo alebo null, keď je hráč príliš ďaleko od ciest.
     */
    spawnCar(x, z, type = 'car') {
      let best = null;
      for (const entry of drivable) {
        for (let d = 0; d < entry.path.length; d += 8) {
          const point = samplePath(geo, entry.path, d, 0);
          const dist = Math.hypot(point.x - x, point.z - z);
          if (!best || dist < best.dist) best = { entry, d, dist };
        }
      }
      if (!best) return null;
      const car = BUILDERS[type]();
      const half = Math.max(0.6, roadWidth(best.entry.road.tags) / 2 - 1.1) * LATERAL[type];
      const [base, spread] = PACE[type];
      const spawn = samplePath(geo, best.entry.path, best.d, half);
      car.position.set(spawn.x, geo.heightAt(spawn.x, spawn.z), spawn.z);
      car.rotation.y = spawn.heading;
      const unit = {
        object: car,
        type,
        path: best.entry.path,
        distance: best.d,
        speed: base + spread * 0.5,
        lateral: half,
        health: 100,
        state: 'drive',
        hitCooldown: 0,
        brakeTimer: 0,
        hornTimer: 0,
      };
      pushCar(unit);
      syncCars();
      return unit;
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
        if (car.hornTimer > 0) car.hornTimer -= dt;
        if (car.state === 'stolen' || car.state === 'wrecked') continue;
        // A shot-up driver slams the brakes for a moment before driving on.
        if (car.panicTimer > 0) {
          car.panicTimer -= dt;
          continue;
        }

        // Vodiči spomalia a zatrúbia, keď im v pruhu stojí hráč alebo iné auto.
        car.blocked = laneBlocked(car, player);
        if (car.blocked) {
          car.brakeTimer = 0.7;
          if (car.hornTimer <= 0) {
            car.hornTimer = 1.6;
            car.honked = true;
            if (hooks.onHorn) hooks.onHorn(car);
          }
        }
        const pace = car.brakeTimer > 0 ? 0.25 : 1;
        if (car.brakeTimer > 0) car.brakeTimer -= dt;

        car.distance += car.speed * pace * dt;
        if (car.distance > car.path.length) car.distance -= car.path.length;
        const s = samplePath(geo, car.path, car.distance, car.lateral);
        car.object.position.set(s.x, geo.heightAt(s.x, s.z) + 0.05, s.z);
        car.object.rotation.y = s.heading;

        // Moving traffic hurts a player who stands in the road.
        if (player && !player.vehicle && !player.dead && car.speed * pace > 6 && car.hitCooldown <= 0) {
          const dx = player.position.x - s.x;
          const dz = player.position.z - s.z;
          if (dx * dx + dz * dz < 1.6 * 1.6) {
            car.hitCooldown = 2;
            player.damage(26, s.x, s.z);
          }
        }
      }
      syncCars();
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
        if (person.state === 'chat') {
          updateChat(person, dt);
          continue;
        }
        if (person.state === 'walk' || person.state === 'flee') updateDodge(person, dt);
        updateWalking(person, dt);
      }
      syncPeds();
    },
  };
}
