// Geographic helpers: converts WGS84 lat/lon into a local metric world and
// samples the elevation heightmap with bilinear interpolation.

const M_PER_DEG_LAT = 111132.92;

export class Geo {
  constructor(heightmap) {
    this.hm = heightmap;
    const { center } = heightmap;
    this.center = center;
    this.mPerDegLon = 111320 * Math.cos((center.lat * Math.PI) / 180);
    this.baseY = heightmap.min;
  }

  /** lat/lon -> local world meters. +x = east, -z = north. */
  toWorld(lat, lon) {
    return {
      x: (lon - this.center.lon) * this.mPerDegLon,
      z: -(lat - this.center.lat) * M_PER_DEG_LAT,
    };
  }

  /**
   * Sample terrain elevation (meters above the lowest point) at world x/z.
   * Matches the triangulation used by PlaneGeometry so roads, water and other
   * flat overlays sit exactly on the rendered surface.
   */
  heightAt(x, z) {
    const { cols, rows, stepX, stepZ, heights } = this.hm;
    const col = x / stepX + (cols - 1) / 2;
    const row = z / stepZ + (rows - 1) / 2;
    const c0 = Math.min(cols - 1, Math.max(0, Math.floor(col)));
    const r0 = Math.min(rows - 1, Math.max(0, Math.floor(row)));
    const c1 = Math.min(cols - 1, c0 + 1);
    const r1 = Math.min(rows - 1, r0 + 1);
    const tx = Math.min(1, Math.max(0, col - c0));
    const tz = Math.min(1, Math.max(0, row - r0));
    const h00 = heights[r0][c0];
    const h10 = heights[r0][c1];
    const h01 = heights[r1][c0];
    const h11 = heights[r1][c1];
    // PlaneGeometry splits each quad along the h01-h10 diagonal.
    const h =
      tx + tz <= 1
        ? h00 + (h10 - h00) * tx + (h01 - h00) * tz
        : h01 + (h11 - h01) * (1 - tz) + (h10 - h01) * (tx + tz - 1);
    return h - this.baseY;
  }

  /** Local world meters -> lat/lon. */
  toLatLon(x, z) {
    return {
      lat: this.center.lat - z / M_PER_DEG_LAT,
      lon: this.center.lon + x / this.mPerDegLon,
    };
  }

  /** True when x/z falls inside the terrain rectangle. */
  contains(x, z) {
    const halfX = ((this.hm.cols - 1) * this.hm.stepX) / 2;
    const halfZ = ((this.hm.rows - 1) * this.hm.stepZ) / 2;
    return x >= -halfX && x <= halfX && z >= -halfZ && z <= halfZ;
  }

  get size() {
    return {
      x: (this.hm.cols - 1) * this.hm.stepX,
      z: (this.hm.rows - 1) * this.hm.stepZ,
    };
  }
}

/** Shoelace area of a polygon given as [{x,z}] points, in square meters. */
export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

/** Ray-casting point-in-polygon test for [{x,z}] points. */
export function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const zi = points[i].z;
    const xj = points[j].x;
    const zj = points[j].z;
    const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Centroid of [{x,z}] points. */
export function centroid(points) {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    z += p.z;
  }
  return { x: x / points.length, z: z / points.length };
}
