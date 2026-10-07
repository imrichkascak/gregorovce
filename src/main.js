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
renderer.toneMappingExposure = 1.12;
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

const drop = world.dropSpawn;
const spawnYaw = drop
  ? Math.atan2(-(drop.faceX - drop.x), -(drop.faceZ - drop.z))
  : Math.atan2(-(villageCentre.x - spawn.x), -(villageCentre.z - spawn.z));
player.setSpawn(drop ? drop.x : spawn.x, drop ? drop.z : spawn.z, spawnYaw);

const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const hud = document.getElementById('hud');
const coords = document.getElementById('coords');
const speedLabel = document.getElementById('speed');
const modeLabel = document.getElementById('mode');
const clockLabel = document.getElementById('clock');
const staminaFill = document.getElementById('stamina-fill');

// World data and scene are built — enable PLAY and finish the loading bar.
startButton.disabled = false;
overlay.classList.add('ready');

startButton.addEventListener('click', () => {
  if (!player.started) player.dropFromSky();
  player.lock();
});
player.onLockChange = (locked) => {
  overlay.classList.toggle('hidden', locked);
  hud.classList.toggle('hidden', !locked);
};

// Touch controls (phones/tablets): floating joystick on the left, look drag on
// the right, action buttons bottom-right.
if (player.touchMode) {
  document.body.classList.add('touch');
  const layer = document.getElementById('touch-layer');
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  const btnDown = document.getElementById('btn-down');
  player.onFlyingChange = (flying) => btnDown.classList.toggle('hidden', !flying);
  const joystickRadius = 55;
  let moveId = null;
  let moveOrigin = null;
  let lookId = null;
  let lookLast = null;

  const capture = (element, event) => {
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-released pointer — not fatal.
    }
  };

  layer.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.tb')) return;
    capture(layer, event);
    if (moveId === null && event.clientX < window.innerWidth * 0.45) {
      moveId = event.pointerId;
      moveOrigin = { x: event.clientX, y: event.clientY };
      base.style.display = 'block';
      base.style.left = `${event.clientX - base.offsetWidth / 2}px`;
      base.style.top = `${event.clientY - base.offsetHeight / 2}px`;
      knob.style.transform = 'translate(-50%, -50%)';
    } else if (lookId === null) {
      lookId = event.pointerId;
      lookLast = { x: event.clientX, y: event.clientY };
    }
  });
  layer.addEventListener('pointermove', (event) => {
    if (event.pointerId === moveId && moveOrigin) {
      let dx = event.clientX - moveOrigin.x;
      let dy = event.clientY - moveOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > joystickRadius) {
        dx = (dx / len) * joystickRadius;
        dy = (dy / len) * joystickRadius;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      let jx = dx / joystickRadius;
      let jy = -dy / joystickRadius;
      if (Math.hypot(jx, jy) < 0.15) {
        jx = 0;
        jy = 0;
      }
      player.touchMove.x = jx;
      player.touchMove.y = jy;
    } else if (event.pointerId === lookId && lookLast) {
      const sens = player.sensitivity * 1.7;
      player.yaw -= (event.clientX - lookLast.x) * sens;
      player.pitch = THREE.MathUtils.clamp(
        player.pitch - (event.clientY - lookLast.y) * sens,
        -1.45,
        1.45,
      );
      lookLast = { x: event.clientX, y: event.clientY };
    }
  });
  const releasePointer = (event) => {
    if (event.pointerId === moveId) {
      moveId = null;
      moveOrigin = null;
      player.touchMove.x = 0;
      player.touchMove.y = 0;
      base.style.display = 'none';
    }
    if (event.pointerId === lookId) {
      lookId = null;
      lookLast = null;
    }
  };
  layer.addEventListener('pointerup', releasePointer);
  layer.addEventListener('pointercancel', releasePointer);

  const bindHold = (id, onDown, onUp) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      capture(el, event);
      onDown();
    });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };
  bindHold(
    'btn-jump',
    () => {
      player.touchUp = 1;
    },
    () => {
      player.touchUp = 0;
    },
  );
  bindHold(
    'btn-down',
    () => {
      player.touchUp = -1;
    },
    () => {
      player.touchUp = 0;
    },
  );
  document.getElementById('btn-fly').addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    player.setFlying(!player.flying);
  });
  document.getElementById('btn-menu').addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    player.pause();
  });
  document.getElementById('btn-r').addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    player.respawn();
  });
}

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
  context.fillStyle = '#c9c07a';
  context.fillRect(0, 0, width, height);
  context.save();
  context.scale(scale, scale);

  context.strokeStyle = '#5c7340';
  context.fillStyle = '#5c7340';
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

  context.fillStyle = '#d2c2a4';
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

  context.strokeStyle = '#8e8a82';
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

  context.strokeStyle = '#6a90a6';
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

let lastMinute = -1;

function updateHudStats() {
  const now = new Date();
  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes();
    clockLabel.textContent = now.toLocaleTimeString('sk-SK', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  staminaFill.style.width = `${player.stamina * 100}%`;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt);
  world.update(player.position, dt);
  drawPlayerMarker();
  updateHudStats();
  const targetFov = player.flying ? 80 : player.sprinting ? 76 : 70;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
  camera.updateProjectionMatrix();

  const here = geo.toLatLon(player.position.x, player.position.z);
  coords.textContent = `${here.lat.toFixed(5)}, ${here.lon.toFixed(5)}`;
  speedLabel.textContent = `${player.currentSpeed.toFixed(0)} m/s`;
  modeLabel.textContent = player.flying ? 'Let (F)' : 'Chôdza';

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
