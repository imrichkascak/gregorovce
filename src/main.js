// Bootstraps the Gregorovce 3D world: renderer, scene, HUD and game loop.
import * as THREE from 'three';
import { Geo } from './geo.js';
import { loadOsm } from './osm.js';
import { createWorld } from './world.js';
import { Player } from './player.js';

const canvas = document.getElementById('minimap');
const ctx = canvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.3,
  8000,
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const [heightmap, layers] = await Promise.all([
  fetch('data/heightmap.json').then((res) => res.json()),
  loadOsm('data/gregorovce-osm.json'),
]);

const geo = new Geo(heightmap);
const world = createWorld(scene, geo, layers);
const player = new Player(camera, geo, world.colliders);

window.__gregorovce = { THREE, scene, camera, renderer, geo, world, player, layers };

// Spawn on the road nearest the centre of the village, facing that centre.
let centreX = 0;
let centreZ = 0;
let centreCount = 0;
for (const b of layers.buildings) {
  for (const p of b.latlon) {
    const w = geo.toWorld(p.lat, p.lon);
    centreX += w.x;
    centreZ += w.z;
    centreCount += 1;
  }
}
const villageCentre = centreCount
  ? { x: centreX / centreCount, z: centreZ / centreCount }
  : { x: 0, z: 0 };

let spawn = villageCentre;
let best = Infinity;
for (const road of layers.roads) {
  for (const p of road.latlon) {
    const w = geo.toWorld(p.lat, p.lon);
    const d = (w.x - villageCentre.x) ** 2 + (w.z - villageCentre.z) ** 2;
    if (d < best) {
      best = d;
      spawn = w;
    }
  }
}

player.spawn(spawn.x, spawn.z);
player.yaw = Math.atan2(-(villageCentre.x - spawn.x), -(villageCentre.z - spawn.z));

const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const hud = document.getElementById('hud');
const coords = document.getElementById('coords');
const speedLabel = document.getElementById('speed');
const modeLabel = document.getElementById('mode');

startButton.addEventListener('click', () => player.lock());
player.onLockChange = (locked) => {
  overlay.classList.toggle('hidden', locked);
  hud.classList.toggle('hidden', !locked);
};

// Static top-down minimap drawn once, with a live player marker on top.
const minimap = document.createElement('canvas');
minimap.width = canvas.width;
minimap.height = canvas.height;
drawMinimap(minimap.getContext('2d'), geo, layers, 1);
const mapCtx = minimap.getContext('2d');

function drawMinimap(context, geoRef, osm, scale) {
  const { width, height } = context.canvas;
  const size = geoRef.size;
  const project = (x, z) => [
    ((x + size.x / 2) / size.x) * width,
    ((z + size.z / 2) / size.z) * height,
  ];
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#b5b98a';
  context.fillRect(0, 0, width, height);
  context.save();
  context.scale(scale, scale);

  context.strokeStyle = '#6a7540';
  context.fillStyle = '#6a7540';
  for (const forest of osm.forests) {
    context.beginPath();
    forest.latlon.forEach((p, i) => {
      const w = geoRef.toWorld(p.lat, p.lon);
      const [mx, my] = project(w.x, w.z);
      if (i === 0) context.moveTo(mx, my);
      else context.lineTo(mx, my);
    });
    context.fill();
  }

  context.fillStyle = '#96917e';
  for (const building of osm.buildings) {
    context.beginPath();
    building.latlon.forEach((p, i) => {
      const w = geoRef.toWorld(p.lat, p.lon);
      const [mx, my] = project(w.x, w.z);
      if (i === 0) context.moveTo(mx, my);
      else context.lineTo(mx, my);
    });
    context.fill();
  }

  context.strokeStyle = '#e0d9c2';
  context.lineWidth = 1.6;
  for (const road of osm.roads) {
    context.beginPath();
    road.latlon.forEach((p, i) => {
      const w = geoRef.toWorld(p.lat, p.lon);
      const [mx, my] = project(w.x, w.z);
      if (i === 0) context.moveTo(mx, my);
      else context.lineTo(mx, my);
    });
    context.stroke();
  }

  context.strokeStyle = '#5f9a8f';
  context.lineWidth = 1.4;
  for (const water of osm.waterways) {
    context.beginPath();
    water.latlon.forEach((p, i) => {
      const w = geoRef.toWorld(p.lat, p.lon);
      const [mx, my] = project(w.x, w.z);
      if (i === 0) context.moveTo(mx, my);
      else context.lineTo(mx, my);
    });
    context.stroke();
  }

  for (const area of osm.leisure) {
    context.fillStyle = area.tags.leisure === 'pitch' ? '#7a9a4f' : '#c9b26a';
    context.beginPath();
    area.latlon.forEach((p, i) => {
      const w = geoRef.toWorld(p.lat, p.lon);
      const [mx, my] = project(w.x, w.z);
      if (i === 0) context.moveTo(mx, my);
      else context.lineTo(mx, my);
    });
    context.fill();
  }

  context.restore();
}

function drawPlayerMarker() {
  const { width, height } = canvas;
  const size = geo.size;
  const x = ((player.position.x + size.x / 2) / size.x) * width;
  const y = ((player.position.z + size.z / 2) / size.z) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(minimap, 0, 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-player.yaw);
  // GTA radar blip: white arrow with a black outline.
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

const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt);
  world.update(player.position, dt);
  drawPlayerMarker();

  const here = geo.toLatLon(player.position.x, player.position.z);
  coords.textContent = `${here.lat.toFixed(5)}, ${here.lon.toFixed(5)}`;
  speedLabel.textContent = `${player.currentSpeed.toFixed(0)} m/s`;
  modeLabel.textContent = player.flying ? 'Let (F)' : 'Chôdza';

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
