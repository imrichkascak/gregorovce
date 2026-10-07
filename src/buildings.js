// Builds ordinary houses (walls + pitched roof) and the special buildings that
// make the village recognisable: church with tower and cross, shop, pub, town hall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildingHeight, specialKind } from './osm.js';
import { polygonArea, centroid } from './geo.js';
import { orientedRect, gableRoofGeometry } from './roof.js';
import { facadeTexture, signTexture } from './textures.js';

const CHURCH_NAME = 'Kostol narodenia Panny Márie';

const WALL_COLORS = ['#e8dcbf', '#dfcfae', '#e4d4b2', '#d9c9a4', '#efe3c4', '#d4c49e'];
const ROOF_COLORS = ['#a04a30', '#8a4028', '#7a5638', '#6b665c', '#9a8a6a', '#7d3b2a'];

const KIND_COLORS = {
  church: { wall: '#f2e8d0', roof: '#4e5560' },
  shop: { wall: '#e6d9b4', roof: '#96603a' },
  pub: { wall: '#e8d5ad', roof: '#7a4a30' },
  townhall: { wall: '#eae0c4', roof: '#6d6a63' },
  school: { wall: '#ece2c4', roof: '#7a5a44' },
  fire_station: { wall: '#c94f3d', roof: '#8a3a34' },
};

const SIGN_STYLES = {
  shop: { background: '#2e7d4f', foreground: '#ffffff', prefix: '' },
  pub: { background: '#8a5a1f', foreground: '#fff4d6', prefix: '' },
  townhall: { background: '#2f5f9e', foreground: '#ffffff', prefix: '' },
  school: { background: '#c98a1a', foreground: '#ffffff', prefix: '' },
  fire_station: { background: '#b5322c', foreground: '#ffffff', prefix: '' },
};

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
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

function groundAtFootprint(geo, points) {
  let min = Infinity;
  for (const p of points) min = Math.min(min, geo.heightAt(p.x, p.z));
  return min;
}

function boxGeometry(w, h, d, color, x, y, z, rotationY = 0) {
  const geom = new THREE.BoxGeometry(w, h, d);
  geom.rotateY(rotationY);
  geom.translate(x, y, z);
  setUniformColor(geom, color);
  return geom;
}

function nearestBoundaryPoint(points, x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz || 1;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const pz = a.z + t * dz;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = { x: px, z: pz };
    }
  }
  return best;
}

function inward(boundary, center, distance) {
  let ix = center.x - boundary.x;
  let iz = center.z - boundary.z;
  const length = Math.hypot(ix, iz) || 1;
  return { x: boundary.x + (ix / length) * distance, z: boundary.z + (iz / length) * distance };
}

/**
 * Places the church tower on the wall facing the road that leads to it, and the
 * extension at the back (opposite wall).
 */
function churchLayout(geo, points, rect, roads) {
  const size = Math.min(5, Math.max(3.4, rect.width * 0.55));
  let nearest = null;
  let nearestDistance = Infinity;
  for (const road of roads) {
    for (const p of road.latlon) {
      const w = geo.toWorld(p.lat, p.lon);
      const d = (w.x - rect.center.x) ** 2 + (w.z - rect.center.z) ** 2;
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = w;
      }
    }
  }
  if (!nearest) {
    return {
      tower: { x: rect.center.x, z: rect.center.z, size },
      extension: null,
      roadPoint: null,
    };
  }
  const front = nearestBoundaryPoint(points, nearest.x, nearest.z);
  const back = nearestBoundaryPoint(
    points,
    2 * rect.center.x - nearest.x,
    2 * rect.center.z - nearest.z,
  );
  return {
    tower: { ...inward(front, rect.center, size * 0.5), size },
    extension: { ...inward(back, rect.center, size * 0.45), size: size * 0.9 },
    roadPoint: nearest,
  };
}

function buildChurchTower(center, groundY, wallHeight, colors, size) {
  const towerHeight = wallHeight + 7;
  const end = { x: center.x, z: center.z };
  const baseY = groundY;

  const parts = [];
  const towerColor = new THREE.Color(colors.wall);
  parts.push(boxGeometry(size, towerHeight, size, towerColor, end.x, baseY + towerHeight / 2, end.z));

  const spireColor = new THREE.Color(colors.roof);
  const spire = new THREE.ConeGeometry(size * 0.72, 8.5, 4);
  spire.rotateY(Math.PI / 4);
  spire.translate(end.x, baseY + towerHeight + 4.25, end.z);
  setUniformColor(spire, spireColor);
  parts.push(spire);

  const crossColor = new THREE.Color('#d9c46a');
  const crossTop = baseY + towerHeight + 8.5;
  parts.push(boxGeometry(0.16, 1.5, 0.16, crossColor, end.x, crossTop + 0.75, end.z));
  parts.push(boxGeometry(0.85, 0.16, 0.16, crossColor, end.x, crossTop + 1.15, end.z));

  return parts;
}

/** A lower, flat-roofed extension (sacristy) at the back of the church. */
function buildChurchExtension(center, groundY, wallHeight, colors, size) {
  const height = wallHeight * 0.62;
  const parts = [];
  parts.push(
    boxGeometry(
      size,
      height,
      size,
      new THREE.Color(colors.wall),
      center.x,
      groundY + height / 2,
      center.z,
    ),
  );
  parts.push(
    boxGeometry(
      size * 1.08,
      0.3,
      size * 1.08,
      new THREE.Color(colors.roof),
      center.x,
      groundY + height + 0.15,
      center.z,
    ),
  );
  return parts;
}

function buildSign(text, kind, x, z, groundY, rotationY) {
  const style = SIGN_STYLES[kind] ?? SIGN_STYLES.shop;
  const group = new THREE.Group();
  group.position.set(x, groundY, z);
  group.rotation.y = rotationY;

  const postGeom = new THREE.BoxGeometry(0.14, 2.6, 0.14);
  postGeom.translate(0, 1.3, 0);
  const post = new THREE.Mesh(
    postGeom,
    new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 }),
  );
  post.castShadow = true;
  group.add(post);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.05),
    new THREE.MeshStandardMaterial({
      map: signTexture(text, style.background, style.foreground),
      side: THREE.DoubleSide,
      roughness: 0.7,
    }),
  );
  board.position.y = 2.6;
  group.add(board);
  return group;
}

export function buildBuildings(geo, buildings, pois, roads) {
  const facade = facadeTexture();
  const wallGeoms = [];
  const roofGeoms = [];
  const towerGeoms = [];
  const colliders = [];
  const labels = [];
  const towerPositions = [];
  let npcSpawn = null;
  let explosion = null;
  let septic = null;
  const group = new THREE.Group();
  group.name = 'buildings';

  for (const b of buildings) {
    const points = b.latlon.map((g) => geo.toWorld(g.lat, g.lon));
    if (points.length < 3 || polygonArea(points) < 4) continue;

    const kind = specialKind(b.tags);
    const isChurch = kind === 'church';
    const height = isChurch ? 7 : buildingHeight(b.tags);
    const groundY = groundAtFootprint(geo, points);
    const rect = orientedRect(points);
    const palette = KIND_COLORS[kind] ?? {
      wall: WALL_COLORS[Math.floor(hash(b.id) * WALL_COLORS.length)],
      roof: ROOF_COLORS[Math.floor(hash(b.id * 1.7) * ROOF_COLORS.length)],
    };
    const houseNumber = String(b.tags['addr:housenumber'] ?? '');

    // Gregorovce 101 is rebuilt every few seconds as an explosion in gags.js,
    // so it must not also be baked into the static village mesh.
    if (houseNumber === '101') {
      explosion = { rect, groundY, height, wall: palette.wall, roof: palette.roof };
      colliders.push(points);
      continue;
    }
    // Bytovka the village empties into the ditch across the road.
    if (houseNumber === '217') septic = { points, rect, groundY };

    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, -p.z);
      else shape.lineTo(p.x, -p.z);
    });

    const wallGeom = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    wallGeom.rotateX(-Math.PI / 2);
    wallGeom.translate(0, groundY, 0);
    setUniformColor(wallGeom, new THREE.Color(palette.wall));
    wallGeoms.push(wallGeom);
    colliders.push(points);

    const roofGeom = gableRoofGeometry(rect, 0.45);
    roofGeom.translate(0, groundY + height, 0);
    setUniformColor(roofGeom, new THREE.Color(palette.roof));
    roofGeoms.push(roofGeom);

    if (isChurch) {
      // Tower on the wall facing the road, extension (sacristy) at the back.
      const layout = churchLayout(geo, points, rect, roads);
      towerGeoms.push(...buildChurchTower(layout.tower, groundY, height, palette, layout.tower.size));
      towerPositions.push({ x: layout.tower.x, z: layout.tower.z });
      if (layout.roadPoint) {
        // Shift him a few metres away from the church so he stands on the
        // road itself, not inside the tower geometry.
        const dx = layout.roadPoint.x - layout.tower.x;
        const dz = layout.roadPoint.z - layout.tower.z;
        const len = Math.hypot(dx, dz) || 1;
        npcSpawn = {
          x: layout.roadPoint.x + (dx / len) * 3,
          z: layout.roadPoint.z + (dz / len) * 3,
          face: layout.tower,
        };
      }
      if (layout.extension) {
        towerGeoms.push(
          ...buildChurchExtension(
            layout.extension,
            groundY,
            height,
            palette,
            layout.extension.size,
          ),
        );
      }
      labels.push({
        text: CHURCH_NAME,
        x: rect.center.x,
        y: groundY + height + 14,
        z: rect.center.z,
        kind: 'church',
      });
    } else if (b.tags.name) {
      labels.push({
        text: b.tags.name,
        x: rect.center.x,
        y: groundY + height + 3.5,
        z: rect.center.z,
        kind: kind ?? 'house',
      });
    }

    if (kind === 'shop' || kind === 'pub') {
      group.add(buildSign(b.tags.name ?? '', kind, rect.center.x, rect.center.z, groundY, rect.angle));
    }
  }

  // Standalone POIs (shops, pubs, offices) are mapped as nodes, not buildings.
  for (const p of pois) {
    const kind = specialKind(p.tags);
    const w = geo.toWorld(p.lat, p.lon);
    const groundY = geo.heightAt(w.x, w.z);
    if (kind === 'shop' || kind === 'pub' || kind === 'townhall' || kind === 'school' || kind === 'fire_station') {
      group.add(buildSign(p.tags.name ?? '', kind, w.x, w.z, groundY, 0));
    }
    if (p.tags.name) {
      labels.push({ text: p.tags.name, x: w.x, y: groundY + 5, z: w.z, kind: kind ?? 'poi' });
    }
  }

  if (wallGeoms.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(wallGeoms, false),
      new THREE.MeshStandardMaterial({
        map: facade,
        vertexColors: true,
        roughness: 0.92,
        metalness: 0,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (roofGeoms.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(roofGeoms, false),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (towerGeoms.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(towerGeoms, false),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  group.userData.towers = towerPositions;
  group.userData.labels = labels;
  return { group, colliders, labels, npcSpawn, explosion, septic };
}
