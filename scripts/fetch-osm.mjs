// Downloads the OpenStreetMap ways we render for Gregorovce (okres Prešov).
// Source: Overpass API, data © OpenStreetMap contributors (ODbL).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const AREA_ID = 3602320226; // OSM relation 2320226 (administrative boundary)
const QUERY = `[out:json][timeout:180];
area(${AREA_ID})->.a;
(
  way["building"](area.a);
  way["highway"](area.a);
  way["waterway"](area.a);
  way["natural"="water"](area.a);
  way["landuse"="forest"](area.a);
  way["natural"="wood"](area.a);
  way["landuse"="meadow"](area.a);
  way["landuse"="farmland"](area.a);
  way["barrier"="wall"](area.a);
  way["barrier"="fence"](area.a);
  node["amenity"](area.a);
  node["shop"](area.a);
  node["tourism"](area.a);
  node["historic"](area.a);
  way["amenity"](area.a);
  way["shop"](area.a);
  way["tourism"](area.a);
  way["historic"](area.a);
  way["leisure"](area.a);
  way["man_made"](area.a);
);
out geom;`;

const outPath = process.argv[2] ?? 'data/gregorovce-osm.json';

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: {
    'User-Agent': 'gregorovce-3d/0.1 (personal hobby project)',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ data: QUERY }),
});

if (!res.ok) throw new Error(`Overpass API -> ${res.status} ${res.statusText}`);
const text = await res.text();
const data = JSON.parse(text);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data));
console.log(`wrote ${outPath}: ${data.elements.length} elements`);
