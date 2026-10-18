// Sliepky a psy na dedine: zlúčené low-poly meshe (1 draw call na zviera),
// ktoré sa túlajú okolo svojej kotvy — sliepky pri žumpe a kostole, psy pri
// obchode, krčme, škole, hasičoch, ihrisku a úrade.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWanderer } from './animals-core.js';

const CHICKEN = {
  body: '#f2efe6',
  comb: '#c43830',
  beak: '#e08a34',
  legs: '#d8a034',
};
const DOG_COLORS = ['#8a5a34', '#5d4632', '#c9a67a', '#3a3a3a'];
const DOG_BELLY = '#c9a67a';
const DOG_NOSE = '#2c2e32';

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

/** Zlúči diely [{geom, color}] do jednej geometrie s farbami. */
function mergePainted(parts) {
  return mergeGeometries(
    parts.map((part) => paint(part.geom, part.color)),
    false,
  );
}

/** Sliepka: telo, hlava, hrebeň, zobák a nohy v jednom meshi. */
function chickenGeometry() {
  const parts = [];
  const add = (geom, color, x, y, z) => {
    geom.translate(x, y, z);
    parts.push({ geom, color });
  };
  add(new THREE.BoxGeometry(0.22, 0.26, 0.36), CHICKEN.body, 0, 0.24, 0);
  add(new THREE.BoxGeometry(0.13, 0.14, 0.13), CHICKEN.body, 0, 0.42, 0.2);
  add(new THREE.BoxGeometry(0.04, 0.09, 0.12), CHICKEN.comb, 0, 0.51, 0.2);
  add(new THREE.BoxGeometry(0.05, 0.04, 0.09), CHICKEN.beak, 0, 0.41, 0.3);
  add(new THREE.BoxGeometry(0.08, 0.18, 0.12), CHICKEN.body, 0, 0.4, -0.21);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.03, 0.12, 0.03), CHICKEN.legs, sx * 0.06, 0.06, 0.02);
  }
  return mergePainted(parts);
}

/** Pes: telo, hlava, papuľa, uši, chvost a štyri nohy v jednom meshi. */
function dogGeometry(color) {
  const parts = [];
  const add = (geom, c, x, y, z) => {
    geom.translate(x, y, z);
    parts.push({ geom, color: c });
  };
  add(new THREE.BoxGeometry(0.26, 0.28, 0.62), color, 0, 0.4, 0);
  add(new THREE.BoxGeometry(0.26, 0.16, 0.3), DOG_BELLY, 0, 0.28, 0.02);
  add(new THREE.BoxGeometry(0.2, 0.2, 0.24), color, 0, 0.56, 0.36);
  add(new THREE.BoxGeometry(0.1, 0.09, 0.12), DOG_BELLY, 0, 0.52, 0.5);
  add(new THREE.BoxGeometry(0.04, 0.04, 0.05), DOG_NOSE, 0, 0.53, 0.57);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.05, 0.12, 0.06), color, sx * 0.09, 0.66, 0.32);
    for (const sz of [-1, 1]) {
      add(new THREE.BoxGeometry(0.05, 0.26, 0.05), color, sx * 0.09, 0.13, sz * 0.22);
    }
  }
  add(new THREE.BoxGeometry(0.05, 0.05, 0.2), color, 0, 0.5, -0.34);
  return mergePainted(parts);
}

export function createAnimals({ scene, geo, spots = {} }) {
  const group = new THREE.Group();
  group.name = 'animals';
  scene.add(group);
  const list = [];

  const chickenMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  const dogMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  const chickenGeom = chickenGeometry();

  const addAnimal = ({ kind, anchor, x, z, radius, speed, seed, geometry, material }) => {
    const wanderer = createWanderer({ x, z, radius, speed, seed });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(x, geo.heightAt(x, z), z);
    mesh.rotation.y = wanderer.state.heading;
    group.add(mesh);
    list.push({ kind, object: mesh, wanderer, anchor: { x: anchor.x, z: anchor.z }, radius });
  };

  // --- sliepky: dve kŕdle po tri pri žumpe a kostole ----------------------
  const chickenSpots = [spots['žumpa'], spots.kostol, spots['dom 101']].filter(Boolean);
  chickenSpots.slice(0, 2).forEach((spot, flock) => {
    for (let i = 0; i < 3; i += 1) {
      const seed = flock * 17 + i * 3 + 1;
      const angle = (i / 3) * Math.PI * 2 + seed;
      const x = spot.x + Math.cos(angle) * 2.2;
      const z = spot.z + Math.sin(angle) * 2.2;
      addAnimal({
        kind: 'chicken',
        anchor: spot,
        x,
        z,
        radius: 5.5,
        speed: 0.75,
        seed,
        geometry: chickenGeom,
        material: chickenMaterial,
      });
    }
  });

  // --- psy: pri obchode, krčme, škole, hasičoch, ihrisku a úrade -----------
  const dogSpots = [
    spots.obchod,
    spots['krčma'],
    spots['škola'],
    spots.hasiči,
    spots.ihrisko,
    spots['úrad'],
  ].filter(Boolean);
  dogSpots.slice(0, 6).forEach((spot, index) => {
    const seed = 61 + index * 5;
    const angle = seed * 1.7;
    const x = spot.x + Math.cos(angle) * 2.6;
    const z = spot.z + Math.sin(angle) * 2.6;
    addAnimal({
      kind: 'dog',
      anchor: spot,
      x,
      z,
      radius: 8.5,
      speed: 1.7,
      seed,
      geometry: dogGeometry(DOG_COLORS[index % DOG_COLORS.length]),
      material: dogMaterial,
    });
  });

  return {
    group,
    list,
    /** Počet kusov podľa druhu — pre verify harness. */
    kinds() {
      const counts = { chicken: 0, dog: 0 };
      for (const animal of list) counts[animal.kind] += 1;
      return counts;
    },
    update(dt) {
      for (const animal of list) {
        const state = animal.wanderer.step(dt);
        const ground = geo.heightAt(state.x, state.z);
        animal.object.position.set(state.x, ground, state.z);
        animal.object.rotation.y = state.heading;
        if (animal.kind === 'chicken') {
          // Zobákom ďobne, keď postojí.
          animal.object.rotation.x =
            state.mode === 'pause' ? Math.max(0, Math.sin(state.phase * 1.6)) * 0.3 : 0;
        } else {
          animal.object.rotation.x = 0;
          animal.object.position.y = ground + Math.abs(Math.sin(state.phase * 2.2)) * 0.03;
        }
      }
    },
  };
}
