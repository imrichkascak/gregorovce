// Builds the whole 3D world: terrain, buildings, roads, streams, fields, forests,
// traffic, sky and lights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadWidth, isPaved } from './osm.js';
import { pointInPolygon, centroid } from './geo.js';
import { orientedRect } from './roof.js';
import { buildBuildings } from './buildings.js';
import { buildLabels } from './labels.js';
import { createTraffic } from './traffic.js';
import { createVillageGags } from './gags.js';
import { asphaltTexture, speechBubbleTexture } from './textures.js';

// San Andreas daylight: pale blue sky, dusty warm horizon, dry yellow lawns.
const HORIZON = new THREE.Color('#e7d3b0');
const SUN_DIR = new THREE.Vector3(-0.35, 0.72, 0.55).normalize();

const GRASS_LOW = new THREE.Color('#c2b86e');
const GRASS_HIGH = new THREE.Color('#6f8f38');
const ROCK = new THREE.Color('#b5a48c');
const FOREST_FLOOR = new THREE.Color('#6d7a3c');
const FIELD = new THREE.Color('#d4c06e');

const PALM_COLORS = ['#2f6b34', '#3d7a3c', '#4a8a46', '#356838'];

function hash(n) {
  let x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function setUniformColor(geometry, color) {
  const count = geometry.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

function buildTerrain(geo) {
  const { cols, rows, stepX, stepZ, heights } = geo.hm;
  const size = geo.size;
  const geom = new THREE.PlaneGeometry(size.x, size.z, cols - 1, rows - 1);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      const h = heights[row][col] - geo.baseY;
      pos.setY(i, h);

      const hx =
        (heights[row][Math.min(cols - 1, col + 1)] - heights[row][Math.max(0, col - 1)]) /
        (2 * stepX);
      const hz =
        (heights[Math.min(rows - 1, row + 1)][col] - heights[Math.max(0, row - 1)][col]) /
        (2 * stepZ);
      const slope = Math.sqrt(hx * hx + hz * hz);

      const elevation = (h - (geo.hm.min - geo.baseY)) / Math.max(1, geo.hm.max - geo.hm.min);
      tmp.copy(GRASS_LOW).lerp(GRASS_HIGH, THREE.MathUtils.clamp(elevation * 1.4, 0, 1));
      tmp.lerp(ROCK, THREE.MathUtils.smoothstep(slope, 0.45, 1.1));
      const n = (hash(col * 12.9898 + row * 78.233) - 0.5) * 0.06;
      colors[i * 3] = THREE.MathUtils.clamp(tmp.r + n, 0, 1);
      colors[i * 3 + 1] = THREE.MathUtils.clamp(tmp.g + n, 0, 1);
      colors[i * 3 + 2] = THREE.MathUtils.clamp(tmp.b + n, 0, 1);
    }
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function buildRibbon(geo, points, width, yOffset) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const half = width / 2;
  let travelled = 0;

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const px = -dz;
    const pz = dx;

    const lx = points[i].x + px * half;
    const lz = points[i].z + pz * half;
    const rx = points[i].x - px * half;
    const rz = points[i].z - pz * half;
    if (i > 0) {
      travelled += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    }
    const v = travelled / 6;
    positions.push(lx, geo.heightAt(lx, lz) + yOffset, lz);
    positions.push(rx, geo.heightAt(rx, rz) + yOffset, rz);
    uvs.push(0, v, 1, v);

    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Inserts a vertex wherever a segment crosses a terrain grid line or a cell
 * diagonal. Between the resulting points the terrain is linear, so a ribbon built
 * on them follows the surface exactly and is never swallowed by the mesh.
 */
function conformToTerrainGrid(geo, points) {
  const { cols, rows, stepX, stepZ } = geo.hm;
  const halfX = ((cols - 1) * stepX) / 2;
  const halfZ = ((rows - 1) * stepZ) / 2;
  const out = [points[0]];

  for (let s = 0; s < points.length - 1; s += 1) {
    const a = points[s];
    const b = points[s + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const ts = [];

    if (Math.abs(dx) > 1e-9) {
      const i0 = Math.ceil((Math.min(a.x, b.x) + halfX) / stepX);
      const i1 = Math.floor((Math.max(a.x, b.x) + halfX) / stepX);
      for (let i = i0; i <= i1; i += 1) {
        const t = (i * stepX - halfX - a.x) / dx;
        if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
      }
    }
    if (Math.abs(dz) > 1e-9) {
      const j0 = Math.ceil((Math.min(a.z, b.z) + halfZ) / stepZ);
      const j1 = Math.floor((Math.max(a.z, b.z) + halfZ) / stepZ);
      for (let j = j0; j <= j1; j += 1) {
        const t = (j * stepZ - halfZ - a.z) / dz;
        if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
      }
    }

    const slope = dx / stepX + dz / stepZ;
    if (Math.abs(slope) > 1e-9) {
      const i0 = Math.floor((Math.min(a.x, b.x) + halfX) / stepX);
      const i1 = Math.floor((Math.max(a.x, b.x) + halfX) / stepX);
      const j0 = Math.floor((Math.min(a.z, b.z) + halfZ) / stepZ);
      const j1 = Math.floor((Math.max(a.z, b.z) + halfZ) / stepZ);
      for (let i = i0; i <= i1; i += 1) {
        for (let j = j0; j <= j1; j += 1) {
          const x0 = i * stepX - halfX;
          const z0 = j * stepZ - halfZ;
          const t = (1 - (a.x - x0) / stepX - (a.z - z0) / stepZ) / slope;
          if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
        }
      }
    }

    ts.push(1);
    ts.sort((p, q) => p - q);
    let previous = 0;
    for (const t of ts) {
      if (t - previous < 1e-6) continue;
      out.push({ x: a.x + dx * t, z: a.z + dz * t });
      previous = t;
    }
  }
  return out;
}

function offsetPolyline(points, distance) {
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    out.push({ x: points[i].x - dz * distance, z: points[i].z + dx * distance });
  }
  return out;
}

function dashGeometry(geo, points, dashLength, gapLength, width, yOffset) {
  const positions = [];
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segment = Math.hypot(b.x - a.x, b.z - a.z);
    if (segment < 0.01) continue;
    const tx = (b.x - a.x) / segment;
    const tz = (b.z - a.z) / segment;
    const px = -tz * (width / 2);
    const pz = tx * (width / 2);

    let local = 0;
    while (local < segment) {
      const phase = (travelled + local) % (dashLength + gapLength);
      if (phase < dashLength) {
        const s0 = local;
        const s1 = Math.min(segment, local + (dashLength - phase));
        const x0 = a.x + tx * s0;
        const z0 = a.z + tz * s0;
        const x1 = a.x + tx * s1;
        const z1 = a.z + tz * s1;
        const p0 = [x0 + px, geo.heightAt(x0 + px, z0 + pz) + yOffset, z0 + pz];
        const p1 = [x0 - px, geo.heightAt(x0 - px, z0 - pz) + yOffset, z0 - pz];
        const p2 = [x1 + px, geo.heightAt(x1 + px, z1 + pz) + yOffset, z1 + pz];
        const p3 = [x1 - px, geo.heightAt(x1 - px, z1 - pz) + yOffset, z1 - pz];
        positions.push(...p0, ...p2, ...p1, ...p1, ...p2, ...p3);
      }
      local += dashLength + gapLength - phase;
    }
    travelled += segment;
  }

  if (!positions.length) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

const STREET = ['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified'];

function buildRoads(geo, roads) {
  const paved = [];
  const unpaved = [];
  const sidewalks = [];
  const markings = [];
  const curbs = [];

  for (const r of roads) {
    const points = conformToTerrainGrid(
      geo,
      r.latlon.map((g) => geo.toWorld(g.lat, g.lon)),
    );
    if (points.length < 2) continue;
    const width = roadWidth(r.tags);
    (isPaved(r.tags) ? paved : unpaved).push(buildRibbon(geo, points, width, 0.1));

    const kind = r.tags.highway;
    const length = points.reduce(
      (sum, p, i) => (i ? sum + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) : 0),
      0,
    );

    const isMain = ['primary', 'secondary', 'tertiary'].includes(kind);
    if (STREET.includes(kind) && length > 30) {
      const offset = width / 2 + (isMain ? 1.15 : 0.85);
      const sidewalkWidth = isMain ? 1.8 : 1.5;
      sidewalks.push(
        buildRibbon(geo, offsetPolyline(points, offset), sidewalkWidth, 0.115),
        buildRibbon(geo, offsetPolyline(points, -offset), sidewalkWidth, 0.115),
      );
    }
    // Double yellow center line and red curbs, the Grove Street read.
    if (isPaved(r.tags) && STREET.includes(kind) && length > 40) {
      for (const side of [0.16, -0.16]) {
        const line = dashGeometry(geo, offsetPolyline(points, side), 80, 0, 0.11, 0.14);
        if (line) markings.push(line);
      }
      const edge = width / 2 - 0.14;
      curbs.push(
        buildRibbon(geo, offsetPolyline(points, edge), 0.26, 0.125),
        buildRibbon(geo, offsetPolyline(points, -edge), 0.26, 0.125),
      );
    }
  }

  const group = new THREE.Group();
  group.name = 'roads';
  const add = (geoms, material) => {
    if (!geoms.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(geoms, false), material);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const overlay = (options) => ({
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    ...options,
  });
  add(
    paved,
    new THREE.MeshStandardMaterial(
      overlay({ map: asphaltTexture(), color: '#ffffff', roughness: 0.92, metalness: 0.02 }),
    ),
  );
  add(
    unpaved,
    new THREE.MeshStandardMaterial(overlay({ color: '#b89a6e', roughness: 1, metalness: 0 })),
  );
  add(
    sidewalks,
    new THREE.MeshStandardMaterial(
      overlay({ color: '#d5cfc3', roughness: 0.95, metalness: 0 }),
    ),
  );
  add(
    curbs,
    new THREE.MeshStandardMaterial(
      overlay({ color: '#d25532', roughness: 0.85, metalness: 0 }),
    ),
  );
  add(
    markings,
    new THREE.MeshStandardMaterial(
      overlay({
        color: '#e6c84a',
        roughness: 0.7,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
      }),
    ),
  );
  return group;
}

function buildWater(geo, waterways) {
  const geoms = [];
  for (const w of waterways) {
    const points = conformToTerrainGrid(
      geo,
      w.latlon.map((g) => geo.toWorld(g.lat, g.lon)),
    );
    if (points.length < 2) continue;
    geoms.push(buildRibbon(geo, points, 4.5, 0.08));
  }
  const group = new THREE.Group();
  group.name = 'water';
  if (geoms.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(geoms, false),
      new THREE.MeshStandardMaterial({
        color: '#6a90a6',
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function buildGroundPatches(geo, areas, color) {
  const patches = [];
  const polygons = [];
  for (const area of areas) {
    const points = area.latlon.map((g) => geo.toWorld(g.lat, g.lon));
    if (points.length < 3) continue;
    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, -p.z);
      else shape.lineTo(p.x, -p.z);
    });
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setY(i, geo.heightAt(pos.getX(i), pos.getZ(i)) + 0.05);
    }
    setUniformColor(geom, color);
    patches.push(geom);
    polygons.push(points);
  }
  return { patches, polygons };
}

function buildLeisure(geo, areas, roads) {
  const group = new THREE.Group();
  group.name = 'leisure';
  const patches = [];
  const lines = [];
  const paths = [];

  for (const area of areas) {
    const points = area.latlon.map((g) => geo.toWorld(g.lat, g.lon));
    if (points.length < 3) continue;
    const isPitch = area.tags.leisure === 'pitch';

    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, -p.z);
      else shape.lineTo(p.x, -p.z);
    });
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setY(i, geo.heightAt(pos.getX(i), pos.getZ(i)) + 0.07);
    }
    setUniformColor(geom, new THREE.Color(isPitch ? '#4f7a3a' : '#c9b06a'));
    patches.push(geom);

    if (isPitch) {
      const rect = orientedRect(points);
      const dx = Math.cos(rect.angle);
      const dz = Math.sin(rect.angle);
      const half = Math.max(1, rect.length / 2 - 1.5);
      lines.push(
        buildRibbon(
          geo,
          [
            { x: rect.center.x - dx * half, z: rect.center.z - dz * half },
            { x: rect.center.x + dx * half, z: rect.center.z + dz * half },
          ],
          0.3,
          0.09,
        ),
      );
    }

    const c = centroid(points);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const road of roads) {
      for (const p of road.latlon) {
        const w = geo.toWorld(p.lat, p.lon);
        const d = (w.x - c.x) ** 2 + (w.z - c.z) ** 2;
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = w;
        }
      }
    }
    if (nearest && nearestDistance > 100) {
      paths.push(
        buildRibbon(
          geo,
          conformToTerrainGrid(geo, [{ x: c.x, z: c.z }, { x: nearest.x, z: nearest.z }]),
          2.2,
          0.1,
        ),
      );
    }
  }

  const add = (geoms, material) => {
    if (!geoms.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(geoms, false), material);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(
    patches,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  add(
    lines,
    new THREE.MeshStandardMaterial({
      color: '#efe6c8',
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  add(
    paths,
    new THREE.MeshStandardMaterial({
      color: '#96805f',
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  return group;
}

function buildTrees(geo, forestPolygons) {
  const spots = [];
  for (const poly of forestPolygons) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of poly) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const step = 13;
    for (let z = minZ; z < maxZ; z += step) {
      for (let x = minX; x < maxX; x += step) {
        const jx = x + (hash(x * 3.1 + z * 1.7) - 0.5) * step * 0.9;
        const jz = z + (hash(x * 1.3 + z * 4.9) - 0.5) * step * 0.9;
        if (!pointInPolygon(jx, jz, poly)) continue;
        spots.push({
          x: jx,
          y: geo.heightAt(jx, jz),
          z: jz,
          s: 0.7 + hash(jx * 0.7 + jz) * 0.8,
          r: hash(jx + jz * 2.3) * Math.PI * 2,
        });
        if (spots.length >= 7000) break;
      }
      if (spots.length >= 7000) break;
    }
    if (spots.length >= 7000) break;
  }

  const group = new THREE.Group();
  group.name = 'trees';
  if (!spots.length) return group;

  const trunkGeom = new THREE.CylinderGeometry(0.13, 0.2, 5.4, 5);
  trunkGeom.translate(0, 2.7, 0);
  const foliageGeom = palmCrownGeometry();

  const trunks = new THREE.InstancedMesh(
    trunkGeom,
    new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 1 }),
    spots.length,
  );
  const foliage = new THREE.InstancedMesh(
    foliageGeom,
    new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }),
    spots.length,
  );
  trunks.castShadow = true;
  foliage.castShadow = true;
  foliage.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(spots.length * 3),
    3,
  );

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  spots.forEach((spot, i) => {
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.r);
    const height = 0.75 + hash(i + 3) * 0.55;
    scale.set(spot.s, height, spot.s);
    matrix.compose(new THREE.Vector3(spot.x, spot.y, spot.z), quat, scale);
    trunks.setMatrixAt(i, matrix);
    foliage.setMatrixAt(i, matrix);
    color.set(PALM_COLORS[Math.floor(hash(i * 2.7) * PALM_COLORS.length)]);
    foliage.setColorAt(i, color);
  });

  group.add(trunks, foliage);
  return group;
}

/** Fan of drooping fronds sitting on top of a palm trunk. */
function palmCrownGeometry() {
  const fronds = [];
  for (let i = 0; i < 8; i += 1) {
    const frond = new THREE.BoxGeometry(0.9, 0.04, 3.1);
    frond.translate(0, 0, 1.45);
    frond.rotateX(0.7);
    frond.rotateY((i / 8) * Math.PI * 2);
    fronds.push(frond);
    const inner = new THREE.BoxGeometry(0.55, 0.04, 2.1);
    inner.translate(0, 0.05, 0.95);
    inner.rotateX(0.35);
    inner.rotateY((i / 8) * Math.PI * 2 + 0.35);
    fronds.push(inner);
  }
  const cap = new THREE.SphereGeometry(0.32, 6, 4);
  cap.scale(1, 0.5, 1);
  fronds.push(cap);
  const geom = mergeGeometries(fronds, false);
  geom.translate(0, 5.35, 0);
  return geom;
}

function walkPolyline(points, spacing, start, visit) {
  let travelled = 0;
  let next = start;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (seg < 0.05) continue;
    const tx = (b.x - a.x) / seg;
    const tz = (b.z - a.z) / seg;
    while (next <= travelled + seg) {
      const t = (next - travelled) / seg;
      visit({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        tx,
        tz,
      });
      next += spacing;
    }
    travelled += seg;
  }
}

/** Wooden poles, sagging wires and sidewalk palms along the village streets. */
function buildStreetKit(geo, roads) {
  const group = new THREE.Group();
  group.name = 'street-kit';

  const polePost = new THREE.BoxGeometry(0.16, 6.4, 0.16);
  polePost.translate(0, 3.2, 0);
  const poleArm = new THREE.BoxGeometry(1.5, 0.08, 0.08);
  poleArm.translate(0, 5.9, 0);
  const poleShape = mergeGeometries([polePost, poleArm], false);

  const poles = [];
  const wire = [];
  const palms = [];

  for (const road of roads) {
    if (!['primary', 'secondary', 'tertiary', 'residential'].includes(road.tags.highway)) continue;
    const points = conformToTerrainGrid(
      geo,
      road.latlon.map((g) => geo.toWorld(g.lat, g.lon)),
    );
    if (points.length < 2) continue;
    const side = roadWidth(road.tags) / 2 + 2.6;
    let previous = null;

    walkPolyline(points, 36, 14, (p) => {
      if (poles.length >= 200) return;
      const x = p.x - p.tz * side;
      const z = p.z + p.tx * side;
      const y = geo.heightAt(x, z);
      const pole = { x, y, z, tx: p.tx, tz: p.tz };
      if (previous && Math.hypot(x - previous.x, z - previous.z) < 50) {
        for (const sway of [-0.55, 0.55]) {
          const ax = previous.x + previous.tz * sway;
          const az = previous.z - previous.tx * sway;
          const bx = x + p.tz * sway;
          const bz = z - p.tx * sway;
          const ay = previous.y + 5.85;
          const by = y + 5.85;
          wire.push(ax, ay, az, (ax + bx) / 2, (ay + by) / 2 - 0.4, (az + bz) / 2);
          wire.push((ax + bx) / 2, (ay + by) / 2 - 0.4, (az + bz) / 2, bx, by, bz);
        }
      }
      poles.push(pole);
      previous = pole;
    });

    walkPolyline(points, 24, 8, (p) => {
      if (palms.length >= 260) return;
      const x = p.x + p.tz * side;
      const z = p.z - p.tx * side;
      palms.push({
        x,
        y: geo.heightAt(x, z),
        z,
        s: 0.9 + hash(x * 0.3 + z) * 0.35,
        r: hash(x + z * 1.7) * Math.PI * 2,
      });
    });
  }

  if (poles.length) {
    const mesh = new THREE.InstancedMesh(
      poleShape,
      new THREE.MeshStandardMaterial({ color: '#6e5844', roughness: 1 }),
      poles.length,
    );
    mesh.castShadow = true;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    poles.forEach((pole, i) => {
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(pole.tx, pole.tz));
      matrix.compose(new THREE.Vector3(pole.x, pole.y, pole.z), quat, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, matrix);
    });
    group.add(mesh);
  }

  if (wire.length) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const lines = new THREE.LineSegments(
      geom,
      new THREE.LineBasicMaterial({ color: '#2c2c2c' }),
    );
    group.add(lines);
  }

  if (palms.length) {
    const trunkGeom = new THREE.CylinderGeometry(0.12, 0.18, 5.2, 5);
    trunkGeom.translate(0, 2.6, 0);
    const crownGeom = palmCrownGeometry();
    const trunks = new THREE.InstancedMesh(
      trunkGeom,
      new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 1 }),
      palms.length,
    );
    const crowns = new THREE.InstancedMesh(
      crownGeom,
      new THREE.MeshStandardMaterial({ color: '#3d7a3c', roughness: 1 }),
      palms.length,
    );
    trunks.castShadow = true;
    crowns.castShadow = true;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    palms.forEach((palm, i) => {
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), palm.r);
      scale.set(palm.s, 0.85 + hash(i + 4) * 0.35, palm.s);
      matrix.compose(new THREE.Vector3(palm.x, palm.y, palm.z), quat, scale);
      trunks.setMatrixAt(i, matrix);
      crowns.setMatrixAt(i, matrix);
    });
    group.add(trunks, crowns);
  }

  return group;
}

/**
 * Static character standing on the road in front of the church — the guy from
 * the loading artwork (pink tee, camo shorts, sunglasses) with a speech bubble.
 */
function buildChurchNpc(geo, spawn) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac82', roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#e0798f', roughness: 1 });
  const camo = new THREE.MeshStandardMaterial({ color: '#7d7a4c', roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#181818', roughness: 0.8 });

  const addPart = (geom, material, x, y, z) => {
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  };

  addPart(new THREE.BoxGeometry(0.46, 0.62, 0.26), shirt, 0, 1.06, 0);
  addPart(new THREE.BoxGeometry(0.13, 0.52, 0.14), shirt, -0.31, 1.28, 0);
  addPart(new THREE.BoxGeometry(0.13, 0.52, 0.14), shirt, 0.31, 1.28, 0);
  addPart(new THREE.SphereGeometry(0.17, 12, 10), skin, 0, 1.53, 0);
  addPart(new THREE.BoxGeometry(0.3, 0.07, 0.06), dark, 0, 1.55, 0.14);
  addPart(new THREE.BoxGeometry(0.16, 0.34, 0.17), camo, -0.11, 0.6, 0);
  addPart(new THREE.BoxGeometry(0.16, 0.34, 0.17), camo, 0.11, 0.6, 0);
  addPart(new THREE.BoxGeometry(0.13, 0.32, 0.14), skin, -0.11, 0.28, 0);
  addPart(new THREE.BoxGeometry(0.13, 0.32, 0.14), skin, 0.11, 0.28, 0);
  addPart(new THREE.BoxGeometry(0.16, 0.1, 0.28), dark, -0.11, 0.06, 0.04);
  addPart(new THREE.BoxGeometry(0.16, 0.1, 0.28), dark, 0.11, 0.06, 0.04);

  const ground = geo.heightAt(spawn.x, spawn.z);
  group.position.set(spawn.x, ground + 0.02, spawn.z);
  group.rotation.y = Math.atan2(spawn.face.x - spawn.x, spawn.face.z - spawn.z);

  const { texture, aspect } = speechBubbleTexture('SUCK MY DICK EVERYDAY');
  const bubbleHeight = 1.3;
  const bubble = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }),
  );
  bubble.scale.set(bubbleHeight * aspect, bubbleHeight, 1);
  bubble.position.set(spawn.x, ground + 3.1, spawn.z);

  return { npc: group, bubble };
}

function buildSky() {
  const geom = new THREE.SphereGeometry(6000, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#7eafd6') },
      horizonColor: { value: HORIZON.clone() },
      sunDirection: { value: SUN_DIR.clone() },
      sunColor: { value: new THREE.Color('#fff2d0') },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 color = mix(horizonColor, topColor, pow(h, 0.45));
        float sunDot = max(dot(dir, normalize(sunDirection)), 0.0);
        float sun = pow(sunDot, 160.0);
        float glow = pow(sunDot, 9.0);
        color += sunColor * (sun * 1.0 + glow * 0.28);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'sky';
  return mesh;
}

export function createWorld(scene, geo, layers) {
  scene.background = HORIZON.clone();
  scene.fog = new THREE.Fog(HORIZON.clone(), 700, 4800);

  scene.add(buildSky());

  const hemi = new THREE.HemisphereLight('#d5e2f2', '#c2ae88', 0.62);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff4dd', 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 3500;
  const span = 700;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  scene.add(buildTerrain(geo));
  scene.add(buildRoads(geo, layers.roads));
  scene.add(buildStreetKit(geo, layers.roads));
  scene.add(buildWater(geo, layers.waterways));

  const forest = buildGroundPatches(geo, layers.forests, FOREST_FLOOR);
  if (forest.patches.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(forest.patches, false),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  scene.add(buildTrees(geo, forest.polygons));

  const fields = buildGroundPatches(geo, layers.farmland, FIELD);
  if (fields.patches.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(fields.patches, false),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const built = buildBuildings(geo, layers.buildings, layers.pois, layers.roads);
  scene.add(built.group);
  scene.add(buildLabels(built.labels));

  if (built.npcSpawn) {
    const { npc, bubble } = buildChurchNpc(geo, built.npcSpawn);
    scene.add(npc);
    scene.add(bubble);
    // Small collider so the player cannot walk through him.
    const c = built.npcSpawn;
    built.colliders.push([
      { x: c.x - 0.35, z: c.z - 0.35 },
      { x: c.x + 0.35, z: c.z - 0.35 },
      { x: c.x + 0.35, z: c.z + 0.35 },
      { x: c.x - 0.35, z: c.z + 0.35 },
    ]);
  }

  scene.add(buildLeisure(geo, layers.leisure, layers.roads));

  const gags = createVillageGags(
    geo,
    { explosion: built.explosion, septic: built.septic, church: built.npcSpawn },
    layers.roads,
  );
  scene.add(gags.group);

  const traffic = createTraffic(geo, layers);
  scene.add(traffic.group);

  return {
    colliders: built.colliders,
    sun,
    npcSpawn: built.npcSpawn,
    gagAnchors: gags.anchors,
    dropSpawn: gags.anchors.drop ?? null,
    update(anchor, dt) {
      sun.position.copy(anchor).addScaledVector(SUN_DIR, 1400);
      sun.target.position.copy(anchor);
      sun.target.updateMatrixWorld();
      traffic.update(dt);
      gags.update(dt);
    },
  };
}
