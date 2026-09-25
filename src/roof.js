// Roof geometry helpers. Buildings get a pitched (gable) roof fitted to their
// minimum-area bounding rectangle so they read as houses, not plain boxes.
import * as THREE from 'three';

/** Convex hull (monotone chain) of [{x,z}] points, counter-clockwise. */
function convexHull(points) {
  const pts = points
    .map((p) => ({ x: p.x, z: p.z }))
    .sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function rotate(p, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.z * s, z: p.x * s + p.z * c };
}

/** Minimum-area bounding rectangle of [{x,z}]: {center, angle, length, width}. */
export function orientedRect(points) {
  const hull = convexHull(points);
  if (hull.length < 3) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    return {
      center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
      angle: 0,
      length: maxX - minX,
      width: maxZ - minZ,
    };
  }

  let best = null;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of hull) {
      const r = rotate(p, -angle);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x);
      minZ = Math.min(minZ, r.z);
      maxZ = Math.max(maxZ, r.z);
    }
    const area = (maxX - minX) * (maxZ - minZ);
    if (!best || area < best.area) {
      best = { area, angle, minX, maxX, minZ, maxZ };
    }
  }

  const localCenter = {
    x: (best.minX + best.maxX) / 2,
    z: (best.minZ + best.maxZ) / 2,
  };
  return {
    center: rotate(localCenter, best.angle),
    angle: best.angle,
    length: best.maxX - best.minX,
    width: best.maxZ - best.minZ,
  };
}

/**
 * Gable roof over an oriented rectangle, in the rectangle's local frame
 * (length along X, width along Z). Origin sits at the eave height.
 */
export function gableRoofGeometry(rect, overhang = 0.45) {
  const hL = rect.length / 2 + overhang;
  const hW = rect.width / 2 + overhang;
  const rise = Math.min(3.2, Math.max(1.1, rect.width * 0.42));
  const e1 = [-hL, 0, -hW];
  const e2 = [hL, 0, -hW];
  const e3 = [hL, 0, hW];
  const e4 = [-hL, 0, hW];
  const r1 = [-hL, rise, 0];
  const r2 = [hL, rise, 0];

  const triangles = [
    e1, e2, r2, e1, r2, r1, // north slope
    e4, r1, r2, e4, r2, e3, // south slope
    e1, r1, e4, // west gable
    e2, e3, r2, // east gable
  ];

  const positions = new Float32Array(triangles.length * 3);
  triangles.forEach((v, i) => {
    positions[i * 3] = v[0];
    positions[i * 3 + 1] = v[1];
    positions[i * 3 + 2] = v[2];
  });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  geom.rotateY(-rect.angle);
  geom.translate(rect.center.x, 0, rect.center.z);
  return geom;
}
