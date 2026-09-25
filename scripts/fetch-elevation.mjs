// Fetches a real digital elevation model (Mapzen/Terrarium tiles) for a bbox
// and stores it as a regular lat/lon height grid the browser can consume.
//
// Terrarium encoding: height_m = (R * 256 + G + B / 256) - 32768
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ZOOM = 15; // ~5 m/px at this latitude
const COLS = 321; // grid resolution handed to the browser
const ROWS = 257;

// Village of Gregorovce (okres Prešov) with ~600 m padding around the buildings.
const BBOX = {
  north: 49.0870,
  south: 49.0465,
  west: 21.1930,
  east: 21.2355,
};

const outPath = process.argv[2] ?? 'data/heightmap.json';
const userAgent = 'gregorovce-3d/0.1 (personal hobby project)';

const lon2tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2tileY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
};

const lon2pixelX = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z;
const lat2pixelY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 256 * 2 ** z;
};

const x0 = lon2tileX(BBOX.west, ZOOM);
const x1 = lon2tileX(BBOX.east, ZOOM);
const y0 = lat2tileY(BBOX.north, ZOOM);
const y1 = lat2tileY(BBOX.south, ZOOM);

const tiles = [];
for (let y = y0; y <= y1; y += 1) {
  for (let x = x0; x <= x1; x += 1) {
    tiles.push({ x, y });
  }
}
console.log(`zoom ${ZOOM}: fetching ${tiles.length} tiles (${x0}..${x1}, ${y0}..${y1})`);

const mosaicW = (x1 - x0 + 1) * 256;
const mosaicH = (y1 - y0 + 1) * 256;
const mosaic = new Float32Array(mosaicW * mosaicH);

for (const tile of tiles) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tile.x}/${tile.y}.png`;
  const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new Error(`tile ${url} -> ${res.status}`);
  const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  const ox = (tile.x - x0) * 256;
  const oy = (tile.y - y0) * 256;
  for (let py = 0; py < 256; py += 1) {
    for (let px = 0; px < 256; px += 1) {
      const i = (py * 256 + px) * 4;
      const h = png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
      mosaic[(oy + py) * mosaicW + (ox + px)] = h;
    }
  }
  process.stdout.write('.');
}
process.stdout.write('\n');

// Sample the mosaic into a regular lat/lon grid.
const heights = [];
let min = Infinity;
let max = -Infinity;
for (let row = 0; row < ROWS; row += 1) {
  const lat = BBOX.north + ((BBOX.south - BBOX.north) * row) / (ROWS - 1);
  const line = [];
  const worldY = lat2pixelY(lat, ZOOM) - y0 * 256;
  for (let col = 0; col < COLS; col += 1) {
    const lon = BBOX.west + ((BBOX.east - BBOX.west) * col) / (COLS - 1);
    const worldX = lon2pixelX(lon, ZOOM) - x0 * 256;
    const mx = Math.min(mosaicW - 1, Math.max(0, Math.round(worldX)));
    const my = Math.min(mosaicH - 1, Math.max(0, Math.round(worldY)));
    const h = mosaic[my * mosaicW + mx];
    line.push(Math.round(h * 10) / 10);
    if (h < min) min = h;
    if (h > max) max = h;
  }
  heights.push(line);
}

const centerLat = (BBOX.north + BBOX.south) / 2;
const centerLon = (BBOX.west + BBOX.east) / 2;
const mPerDegLat = 111132.92;
const mPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

const payload = {
  source: 'Mapzen Terrarium (AWS Open Data)',
  attribution: 'Elevation tiles © Mapzen / AWS, data from SRTM, ETOPO1, EU-DEM, GMTED, NED',
  zoom: ZOOM,
  bbox: BBOX,
  center: { lat: centerLat, lon: centerLon },
  cols: COLS,
  rows: ROWS,
  stepX: ((BBOX.east - BBOX.west) * mPerDegLon) / (COLS - 1),
  stepZ: ((BBOX.north - BBOX.south) * mPerDegLat) / (ROWS - 1),
  min,
  max,
  heights,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload));
console.log(`wrote ${outPath}: ${COLS}x${ROWS}, elevation ${min}..${max} m, step ~${payload.stepX.toFixed(1)}m`);
