// GTA-style rotating radar: base village map, POI blips, north marker and a fixed
// player arrow in the middle.
import { specialKind } from './osm.js';

const BLIP_COLORS = {
  church: '#e8d24a',
  shop: '#4fd06a',
  pub: '#e0952f',
  townhall: '#5a8ad0',
  school: '#e0a83a',
  fire_station: '#d0483a',
  house: '#e6dcc4',
  poi: '#e6dcc4',
};

export function createRadar(geo, layers, size = 200) {
  const base = document.createElement('canvas');
  base.width = size;
  base.height = size;
  const bctx = base.getContext('2d');
  const project = (x, z) => [
    ((x + geo.size.x / 2) / geo.size.x) * size,
    ((z + geo.size.z / 2) / geo.size.z) * size,
  ];

  const tracePolygon = (ctx, latlon) => {
    ctx.beginPath();
    latlon.forEach((p, i) => {
      const w = geo.toWorld(p.lat, p.lon);
      const [mx, my] = project(w.x, w.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
  };

  bctx.fillStyle = '#c9c07a';
  bctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#5c7340';
  bctx.strokeStyle = '#5c7340';
  for (const forest of layers.forests) {
    tracePolygon(bctx, forest.latlon);
    bctx.fill();
  }

  bctx.fillStyle = '#d2c2a4';
  for (const building of layers.buildings) {
    tracePolygon(bctx, building.latlon);
    bctx.fill();
  }

  bctx.strokeStyle = '#8e8a82';
  bctx.lineWidth = 1.6;
  for (const road of layers.roads) {
    tracePolygon(bctx, road.latlon);
    bctx.stroke();
  }

  bctx.strokeStyle = '#6a90a6';
  bctx.lineWidth = 1.4;
  for (const water of layers.waterways) {
    tracePolygon(bctx, water.latlon);
    bctx.stroke();
  }

  const blips = (layers.pois ?? []).map((poi) => {
    const w = geo.toWorld(poi.lat, poi.lon);
    const kind = specialKind(poi.tags);
    const [bx, by] = project(w.x, w.z);
    return { x: bx, y: by, color: BLIP_COLORS[kind] ?? BLIP_COLORS.poi };
  });

  const state = { rotates: true, zoom: 3.6 };

  function draw(ctx, player, extras = []) {
    const { width, height } = ctx.canvas;
    const px = ((player.position.x + geo.size.x / 2) / geo.size.x) * size;
    const py = ((player.position.z + geo.size.z / 2) / geo.size.z) * size;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(width / 2, height / 2);
    ctx.rotate(state.rotates ? player.yaw : 0);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-px, -py);
    ctx.drawImage(base, 0, 0, size, size);

    for (const blip of blips) {
      ctx.fillStyle = blip.color;
      ctx.beginPath();
      ctx.arc(blip.x, blip.y, 1.6 / state.zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    // Quest waypoint (blinking) and collectibles ride on top of the blips.
    for (const extra of extras) {
      const [ex, ey] = project(extra.x, extra.z);
      const blink = extra.color === '#ffd21e' ? 0.6 + Math.sin(extra.x + Date.now() * 0.006) * 0.4 : 1;
      ctx.globalAlpha = blink;
      ctx.fillStyle = extra.color;
      ctx.beginPath();
      ctx.arc(ex, ey, (extra.radius ?? 1.4) / state.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // North marker follows the map rotation.
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(state.rotates ? player.yaw : 0);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('N', 0, -height / 2 + 14);
    ctx.fillText('N', 0, -height / 2 + 14);
    ctx.restore();

    // Player blip: white arrow, fixed pointing up.
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return { state, blips, draw, base };
}
