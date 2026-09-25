// Loads the raw Overpass export and splits it into the layers we render.

export async function loadOsm(url) {
  const data = await fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Nepodarilo sa načítať ${url} (${res.status})`);
    return res.json();
  });

  const layers = {
    buildings: [],
    roads: [],
    waterways: [],
    forests: [],
    farmland: [],
    leisure: [],
    pois: [],
  };

  for (const el of data.elements) {
    const tags = el.tags ?? {};

    if (el.type === 'node') {
      if (tags.amenity || tags.shop || tags.tourism || tags.historic) {
        layers.pois.push({ id: el.id, tags, lat: el.lat, lon: el.lon });
      }
      continue;
    }

    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const latlon = el.geometry.map((g) => ({ lat: g.lat, lon: g.lon }));

    if (tags.building) layers.buildings.push({ id: el.id, tags, latlon });
    else if (tags.highway) layers.roads.push({ id: el.id, tags, latlon });
    else if (tags.waterway) layers.waterways.push({ id: el.id, tags, latlon });
    else if (tags.landuse === 'forest' || tags.natural === 'wood')
      layers.forests.push({ id: el.id, tags, latlon });
    else if (tags.landuse === 'farmland') layers.farmland.push({ id: el.id, tags, latlon });
    else if (tags.leisure === 'pitch' || tags.leisure === 'playground')
      layers.leisure.push({ id: el.id, tags, latlon });
  }

  return layers;
}

/** Classifies a building/POI into a special structure we render differently. */
export function specialKind(tags) {
  if (tags.amenity === 'place_of_worship' || tags.building === 'church' || tags.building === 'chapel')
    return 'church';
  if (tags.shop || tags.building === 'retail' || tags.building === 'commercial') return 'shop';
  if (tags.amenity === 'pub' || tags.amenity === 'bar' || tags.building === 'pub') return 'pub';
  if (tags.amenity === 'townhall' || tags.building === 'civic') return 'townhall';
  if (tags.amenity === 'school' || tags.building === 'school') return 'school';
  if (tags.amenity === 'fire_station') return 'fire_station';
  return null;
}

const DEFAULT_HEIGHTS = {
  apartments: 12,
  residential: 7,
  house: 6.5,
  detached: 6.5,
  semidetached_house: 6.5,
  terrace: 6.5,
  church: 14,
  chapel: 9,
  school: 9,
  kindergarten: 7,
  commercial: 9,
  retail: 7,
  industrial: 9,
  warehouse: 8,
  garage: 2.8,
  garages: 2.8,
  shed: 2.6,
  hut: 2.6,
  barn: 6,
  farm_auxiliary: 5,
  roof: 3,
  carport: 2.8,
};

export function buildingHeight(tags) {
  const explicit = Number.parseFloat(tags.height);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const levels = Number.parseFloat(tags['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return levels * 3;
  return DEFAULT_HEIGHTS[tags.building] ?? 6.5;
}

export function roadWidth(tags) {
  const widths = {
    motorway: 12,
    trunk: 11,
    primary: 9,
    secondary: 8,
    tertiary: 7,
    unclassified: 5.5,
    residential: 6,
    living_street: 5,
    service: 4,
    track: 3.5,
    path: 2,
    footway: 2,
    cycleway: 2.5,
    steps: 1.6,
    bridleway: 2,
  };
  return widths[tags.highway] ?? 4;
}

export function isPaved(tags) {
  const surface = tags.surface ?? '';
  if (['ground', 'dirt', 'grass', 'gravel', 'sand', 'earth', 'mud', 'unpaved'].includes(surface))
    return false;
  return ['track', 'path', 'footway', 'bridleway', 'steps'].includes(tags.highway)
    ? tags.surface === 'asphalt' || tags.surface === 'paved'
    : true;
}
