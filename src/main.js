// Bootstraps the Gregorovce 3D world: renderer, scene, HUD, all gameplay systems
// (avatar, camera, radar, day/night, weather, audio, weapons, vehicles, wanted,
// missions) and the game loop.
import * as THREE from 'three';
import { Geo } from './geo.js';
import { loadOsm } from './osm.js';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { createAvatar } from './avatar.js';
import { createCameraRig } from './camera-rig.js';
import { createRadar } from './radar.js';
import { createDayNight } from './daynight.js';
import { createWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createWeapons } from './weapons.js';
import { createEffects } from './effects.js';
import { createVehicles } from './vehicles.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createQuests } from './quests.js';
import { createInteriors } from './interiors.js';
import { createStatsTracker } from './stats.js';
import { createCheats } from './cheats.js';
import { createPickups } from './pickups.js';
import { createDialogue } from './dialogue.js';
import { createPostFX } from './postfx.js';
import { formatClock, formatMoney, stars as starString } from './rules.js';

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

const [heightmap, layers] = await Promise.all([
  fetch('data/heightmap.json').then((res) => res.json()),
  loadOsm('data/gregorovce-osm.json'),
]);

const geo = new Geo(heightmap);
const world = createWorld(scene, geo, layers);
const player = new Player(camera, geo, world.colliders);
const avatar = createAvatar();
avatar.group.visible = false;
scene.add(avatar.group);
player.avatar = avatar;

const cameraRig = createCameraRig(camera, player, world.colliders);
const radar = createRadar(geo, layers);
const dayNight = createDayNight({
  scene,
  sky: world.sky,
  sun: world.sun,
  hemi: world.hemi,
  streetlightMaterial: world.streetlightMaterial,
  sunDirection: world.sunDirection,
});
const weather = createWeather({ scene });
const audio = createAudio();
const effects = createEffects({ scene });
const weapons = createWeapons({
  camera,
  cameraRig,
  geo,
  scene,
  player,
  traffic: world.traffic,
  audio,
  effects,
  onCrime: (points) => wanted.crime(points),
  onAttack: (kind) => {
    avatar.attack(kind);
    if (kind === 'shoot') cameraRig.shake(0.1);
  },
  onHit: (target, info) => {
    effects.spawn(
      'blood',
      target.object.position.x,
      target.object.position.y + 0.9,
      target.object.position.z,
    );
    flashHitMarker();
    if (info?.melee) cameraRig.shake(0.22);
    statsTracker.noteFight();
    if (target.state === 'dead' || target.state === 'knockdown') statsTracker.noteKO(target);
  },
});
// Getting hit shakes the camera and grunts; death adds a heavier thud.
player.onDamage = (info) => {
  audio.playSfx('hurt');
  cameraRig.shake(Math.min(0.6, 0.12 + info.amount * 0.012));
  if (info.fatal) cameraRig.shake(0.5);
};
const vehicles = createVehicles({ geo, player, traffic: world.traffic, audio });
const missions = createMissions({ scene, geo, player, world, layers, avatar, audio });
player.weapons = weapons;
player.missions = missions;
// Questy: givers with dialogues, side missions and collectible bottles. The
// dialogue module needs the quests module for its choice bridge, so it goes first.
let quests = null;
const dialogue = createDialogue({ onChoice: (choiceId, info) => quests?.choose(choiceId, info) });
quests = createQuests({ scene, geo, player, world, layers, avatar, audio, dialogue });
player.quests = quests;
world.quests = quests;
world.collectibles = quests.collectibles;
const pickups = createPickups({ scene, geo, player, weapons, audio, spots: quests.spots });
world.pickups = pickups.list;
// Interiéry: vstupy do kostola, krčmy, obchodu a úradu (+ obsah a výstup).
const interiors = createInteriors({
  scene,
  geo,
  player,
  audio,
  spots: quests.spots,
  colliders: world.colliders,
});
world.interiors = interiors.list;
// Polícia: hliadky, peší policajti, zátarasy a lakovacia garáž pri obchode.
const wanted = createWanted({
  scene,
  geo,
  player,
  audio,
  effects,
  traffic: world.traffic,
  layers,
  spots: quests.spots,
});
// Štatistiky hráča: čas, vzdialenosti, peniaze, zločiny, questy, bitky.
const statsTracker = createStatsTracker({
  player,
  wanted,
  quests,
  missions,
  vehicleSpeed: () => vehicles.state.speed,
});
// Cheaty: písané kódy na klávesnici (+ dotyková stránka „Cheaty“ v pauze).
const cheats = createCheats({
  player,
  weapons,
  wanted,
  weather,
  dayNight,
  traffic: world.traffic,
  audio,
});
// Doprava: trúbenie a výbuch auta rieši main.js (traffic nevie o efektoch).
world.traffic.hooks.onHorn = () => audio.playSfx('horn');
world.traffic.hooks.onCarWrecked = (car) => {
  const p = car.object.position;
  effects.spawn('fire', p.x, p.y + 0.6, p.z, 1.6);
  effects.spawn('smoke', p.x, p.y + 1.1, p.z, 1.4);
  audio.playSfx('boom');
  if (player.position.distanceTo(p) < 18) cameraRig.shake(0.4);
};
const postfx = await createPostFX({ renderer, scene, camera });

window.__gregorovce = {
  THREE,
  scene,
  camera,
  renderer,
  geo,
  world,
  player,
  layers,
  avatar,
  cameraRig,
  radar,
  dayNight,
  weather,
  audio,
  weapons,
  effects,
  pickups,
  vehicles,
  wanted,
  missions,
  quests,
  dialogue,
  interiors,
  stats: statsTracker,
  cheats,
  postfx,
  syncAimHud,
};

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
missions.load();

const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const hud = document.getElementById('hud');
const coords = document.getElementById('coords');
const speedLabel = document.getElementById('speed');
const modeLabel = document.getElementById('mode');
const clockLabel = document.getElementById('clock');
const staminaFill = document.getElementById('stamina-fill');
const moneyLabel = document.getElementById('money');
const starsLabel = document.getElementById('stars');
const weaponSlot = document.getElementById('weapon-slot');
const weaponIcon = document.getElementById('weapon-icon');
const weaponAmmo = document.getElementById('weapon-ammo');
const crosshair = document.getElementById('crosshair');
const zoneLabel = document.getElementById('zone');
const missionLabel = document.getElementById('mission-message');
const healthFill = document.getElementById('health-fill');
const armorFill = document.getElementById('armor-fill');
const hitMarker = document.getElementById('hitmarker');
const wastedOverlay = document.getElementById('wasted');
const bustedOverlay = document.getElementById('busted');
const bustedFine = document.getElementById('busted-fine');
const cheatToast = document.getElementById('cheat-toast');
const radioCaption = document.getElementById('radio-caption');
const btnTalk = document.getElementById('btn-talk');
const pauseMenu = document.getElementById('pause-menu');
const pauseContent = document.getElementById('pause-content');

let pausePage = null;
let statsRefresh = 0;
let radioCaptionTimer = 0;

/** Ukáže v HUD popis stanice alebo hlásenie DJ-a / reklamu. */
function showRadioCaption(text, seconds = 4) {
  radioCaption.textContent = text;
  radioCaption.classList.remove('hidden');
  radioCaptionTimer = seconds;
}

/** Krátky popis stanice po prepnutí (dotyk aj klávesa Q). */
function announceStation() {
  const radio = audio.radioState();
  showRadioCaption(`📻 ${radio.name} — ${radio.genre}`, 3);
}

const btnAmbience = document.getElementById('btn-ambience');

/** Tlačidlo 🔊/🔇 ukazuje, či je zvuk zapnutý. */
function syncSoundButton() {
  btnAmbience.textContent = audio.isMuted() ? '🔊' : '🔇';
  btnAmbience.title = audio.isMuted() ? 'Zapnúť zvuk (Z)' : 'Vypnúť zvuk (Z)';
}

/** Úplné stlmenie zvuku (klávesa Z aj dotykové tlačidlo). */
function toggleSound() {
  const muted = audio.toggleMute();
  syncSoundButton();
  showRadioCaption(muted ? '🔇 Zvuk je vypnutý — Z ho zapne' : '🔊 Zvuk je zapnutý', 3);
}

syncSoundButton();

audio.onTalk((event) => showRadioCaption(`${event.kind === 'ad' ? '📢' : '🎙️'} ${event.text}`, 4));

let hitMarkerTimer = null;

/** Show the crosshair while aiming or right after a shot. */
function syncAimHud() {
  crosshair.classList.toggle('on', weapons.state.aiming || weapons.state.shotFlash > 0);
}

/** Flash the little ✕ at the crosshair when a hit lands. */
function flashHitMarker() {
  hitMarker.classList.remove('hidden');
  clearTimeout(hitMarkerTimer);
  hitMarkerTimer = setTimeout(() => hitMarker.classList.add('hidden'), 150);
}

// World data and scene are built — enable PLAY and finish the loading bar.
startButton.disabled = false;
overlay.classList.add('ready');

startButton.addEventListener('click', () => {
  audio.resume();
  if (!player.started) player.dropFromSky();
  player.lock();
  // Hra začína v tichu — hráč sa dozvie, čím si zvuk zapne.
  if (audio.isMuted()) showRadioCaption('🔇 Zvuk je vypnutý — Z ho zapne, rádio T', 5);
});
player.onLockChange = (locked) => {
  overlay.classList.toggle('hidden', locked);
  hud.classList.toggle('hidden', !locked);
  pauseMenu.classList.toggle('hidden', locked || !player.started);
};

// Keyboard: dialogue choices, camera mode, enter/exit car, weapons, weather, radio, bribe, save.
document.addEventListener('keydown', (event) => {
  if (dialogue.handleKey(event.code)) return;
  if (event.code === 'KeyC') cameraRig.toggleMode();
  if (event.code === 'KeyE') {
    if (player.vehicle) vehicles.exit();
    else vehicles.enter();
  }
  if (event.code === 'KeyF') {
    if (!interiors.interact()) quests.interact();
  }
  if (event.code === 'KeyV') weather.cycle();
  if (event.code === 'KeyT') audio.toggleRadio();
  if (event.code === 'KeyQ') {
    audio.nextStation();
    announceStation();
  }
  if (event.code === 'KeyM') audio.toggleAmbience();
  if (event.code === 'KeyZ') toggleSound();
  if (event.code === 'KeyB') wanted.bribe();
  if (event.code === 'F5') {
    missions.save();
    quests.save();
    statsTracker.save();
  }
  if (event.code === 'F9') {
    missions.load();
    quests.load();
    statsTracker.load();
  }
  if (/^Digit[1-9]$/.test(event.code)) weapons.select(Number(event.code.slice(5)) - 1);
  if (event.code === 'Digit0') weapons.select(9);
  if (player.locked) cheats.handleKey(event.key);
});
document.addEventListener('mousedown', (event) => {
  if (!player.locked) return;
  if (event.button === 0) weapons.fire();
  if (event.button === 2) weapons.setAiming(true);
});
document.addEventListener('mouseup', (event) => {
  if (event.button === 2) weapons.setAiming(false);
});
document.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener(
  'wheel',
  (event) => cameraRig.zoom(Math.sign(event.deltaY) * 0.6),
  { passive: true },
);
window.addEventListener('beforeunload', () => {
  missions.save();
  quests.save();
  statsTracker.save();
});

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
    audio.resume();
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
  const tap = (id, action) => {
    document.getElementById(id).addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      action();
    });
  };
  tap('btn-fly', () => player.setFlying(!player.flying));
  tap('btn-ambience', () => {
    audio.toggleMute();
    syncSoundButton();
  });
  tap('btn-menu', () => player.pause());
  tap('btn-r', () => player.respawn());
  tap('btn-camera', () => cameraRig.toggleMode());
  tap('btn-enter', () => {
    if (player.vehicle) vehicles.exit();
    else vehicles.enter();
  });
  tap('btn-fire', () => weapons.fire());
  tap('btn-aim', () => weapons.setAiming(!weapons.state.aiming));
  tap('btn-weapon', () => weapons.next());
  tap('btn-talk', () => {
    if (!interiors.interact()) quests.interact();
  });
}

/** Stránka „Štatistiky“ v pauze — živé hodnoty zo hry. */
function statsPageHtml() {
  return (
    '<b>Štatistiky</b><br>' +
    statsTracker
      .rows()
      .map((row) => `${row.label}: ${row.value}`)
      .join('<br>')
  );
}

// Pause menu buttons (Esc / MENU shows it once the game has started).
for (const button of document.querySelectorAll('#pause-menu button')) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    pausePage = action;
    if (action === 'resume') player.lock();
    else if (action === 'map') {
      pauseContent.innerHTML =
        '<b>Mapa — Gregorovce, Prešov</b><br>Kostol · Obchod · Krčma · Žumpa 217<br>Misie: žlté žiary, obchody: zelené.';
    } else if (action === 'stats') {
      pauseContent.innerHTML = statsPageHtml();
    } else if (action === 'quests') {
      const labels = {
        available: 'k dispozícii',
        active: 'aktívny',
        completed: 'splnený',
        failed: 'zlyhal',
      };
      const rows = quests.log();
      pauseContent.innerHTML =
        '<b>Questy</b><br>' +
        (rows.length
          ? rows
              .map((row) => {
                const time = row.timeLeft === null ? '' : ` (${Math.ceil(row.timeLeft)} s)`;
                const phase = row.status === 'active' ? ` — ${row.phaseText}${time}` : '';
                return `${row.name} [${row.location}]: ${labels[row.status] ?? row.status}${phase}`;
              })
              .join('<br>')
          : 'Zatiaľ žiadne questy. Postavy s ! nad hlavou čakajú na dedine.');
    } else if (action === 'radio') {
      const rows = audio.stations.map(
        (station, index) =>
          `<button class="cheat-row" data-station="${index}">${station.name} — ${station.genre}</button>`,
      );
      pauseContent.innerHTML =
        `<b>Rádio</b><br>Staníc je ${rows.length}, DJ hlásenia a reklamy sa striedajú medzi skladbami:<br>` +
        rows.join('') +
        `<button class="cheat-row" data-station="off">${
          audio.isRadioOn() ? 'Vypnúť rádio' : 'Zapnúť rádio'
        }</button>` +
        `<button class="cheat-row" data-sound="toggle">${
          audio.isMuted() ? '🔊 Zapnúť zvuk (Z)' : '🔇 Vypnúť zvuk (Z)'
        }</button>` +
        `<button class="cheat-row" data-sound="ambience">${
          audio.isAmbienceOn() ? 'Vypnúť dedinský tón' : 'Zapnúť dedinský tón (M)'
        }</button>`;
      for (const stationButton of pauseContent.querySelectorAll('[data-station]')) {
        stationButton.addEventListener('click', () => {
          if (stationButton.dataset.station === 'off') audio.toggleRadio();
          else audio.setStation(Number(stationButton.dataset.station));
          announceStation();
          pauseContent.querySelector('[data-station="off"]').textContent = audio.isRadioOn()
            ? 'Vypnúť rádio'
            : 'Zapnúť rádio';
        });
      }
      pauseContent.querySelector('[data-sound="toggle"]').addEventListener('click', () => {
        toggleSound();
        const button = pauseContent.querySelector('[data-sound="toggle"]');
        button.textContent = audio.isMuted() ? '🔊 Zapnúť zvuk (Z)' : '🔇 Vypnúť zvuk (Z)';
      });
      pauseContent.querySelector('[data-sound="ambience"]').addEventListener('click', () => {
        audio.toggleAmbience();
        const button = pauseContent.querySelector('[data-sound="ambience"]');
        button.textContent = audio.isAmbienceOn()
          ? 'Vypnúť dedinský tón'
          : 'Zapnúť dedinský tón (M)';
      });
    } else if (action === 'cheats') {
      pauseContent.innerHTML =
        '<b>Cheaty</b><br>Kódy sa píšu na klávesnici (na mobile ťukni na kód):<br>' +
        cheats
          .rows()
          .map((row) => `<button class="cheat-row" data-cheat="${row.id}">${row.code} — ${row.label}</button>`)
          .join('');
      for (const cheatButton of pauseContent.querySelectorAll('[data-cheat]')) {
        cheatButton.addEventListener('click', () => cheats.activate(cheatButton.dataset.cheat));
      }
    } else if (action === 'quit') location.reload();
  });
}

const clock = new THREE.Clock();
let wasDead = false;
let wasBusted = false;

function updateHudStats() {
  clockLabel.textContent = formatClock(dayNight.state.time);
  staminaFill.style.width = `${player.stamina * 100}%`;
  healthFill.style.width = `${Math.max(0, player.health)}%`;
  armorFill.style.width = `${Math.max(0, player.armor)}%`;
  moneyLabel.textContent = formatMoney(player.money);
  starsLabel.textContent = starString(wanted.state.level);
  starsLabel.style.color = wanted.state.level > 0 ? '#f0c53a' : '#9a9a9a';
  weaponSlot.dataset.weapon = weapons.currentWeapon().name;
  weaponIcon.textContent = weapons.icon();
  const ammoNow = weapons.ammo();
  weaponAmmo.textContent = ammoNow === Infinity ? '∞' : String(ammoNow);
  zoneLabel.textContent = 'Gregorovce, Prešov';
  const questMessage = quests.state.messageTimer > 0 ? quests.state.message : '';
  const interiorMessage = interiors.state.messageTimer > 0 ? interiors.state.message : '';
  const questObjective = quests.state.objective;
  const missionObjective = missions.state.objective;
  if (interiorMessage) {
    missionLabel.textContent = interiorMessage;
  } else if (questMessage) {
    missionLabel.textContent = questMessage;
  } else if (questObjective) {
    const time =
      questObjective.timeLeft === null ? '' : ` (${Math.ceil(questObjective.timeLeft)} s)`;
    missionLabel.textContent =
      `Misia: ${questObjective.name} — ${questObjective.phaseText}${time}` +
      ` → Cieľ: ${questObjective.distance.toFixed(0)} m`;
  } else if (missionObjective) {
    missionLabel.textContent =
      `${missions.state.message} → Cieľ: ${missionObjective.name} (${missionObjective.distance.toFixed(0)} m)`;
  } else {
    missionLabel.textContent = missions.state.message;
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt);
  vehicles.update(dt);
  world.update(player, dt);
  dayNight.update(dt);
  weather.update(dt, player.position);
  wanted.update(dt);
  weapons.update(dt);
  effects.update(dt);
  pickups.update(dt);
  syncAimHud();
  missions.update(dt);
  quests.update(dt);
  interiors.update(dt);
  statsTracker.update(dt);
  cheats.update(dt);
  if (cheats.state.toastTimer > 0) {
    if (cheatToast.textContent !== cheats.state.toast) cheatToast.textContent = cheats.state.toast;
    cheatToast.classList.remove('hidden');
  } else {
    cheatToast.classList.add('hidden');
  }
  // Popis rádia (stanica, DJ hlásenie, reklama) zmizne po pár sekundách.
  if (radioCaptionTimer > 0) {
    radioCaptionTimer -= dt;
    if (radioCaptionTimer <= 0) radioCaption.classList.add('hidden');
  }
  // Stránka „Štatistiky“ v pauze sa obnovuje, aby ukazovala živé hodnoty.
  if (pausePage === 'stats' && !pauseMenu.classList.contains('hidden')) {
    statsRefresh -= dt;
    if (statsRefresh <= 0) {
      statsRefresh = 0.5;
      pauseContent.innerHTML = statsPageHtml();
    }
  }
  btnTalk.classList.toggle(
    'hidden',
    !(quests.state.nearGiver || interiors.state.nearDoor || interiors.state.inside) ||
      dialogue.state.open,
  );

  if (player.dead !== wasDead) {
    wasDead = player.dead;
    wastedOverlay.classList.toggle('hidden', !player.dead);
    if (player.dead) audio.playSfx('wasted');
  }
  if (wanted.state.busted !== wasBusted) {
    wasBusted = wanted.state.busted;
    bustedOverlay.classList.toggle('hidden', !wasBusted);
    if (wasBusted) bustedFine.textContent = `Pokuta $${wanted.state.fine}`;
  }

  avatar.group.position.copy(player.position);
  avatar.face(player.yaw);
  avatar.update(player.currentSpeed, player.grounded, dt);
  avatar.group.visible = cameraRig.state.mode === 'third-person' && !player.vehicle;

  cameraRig.update(dt);
  radar.draw(ctx, player, quests.extras());
  updateHudStats();

  const here = geo.toLatLon(player.position.x, player.position.z);
  coords.textContent = `${here.lat.toFixed(5)}, ${here.lon.toFixed(5)}`;
  speedLabel.textContent = `${player.currentSpeed.toFixed(0)} m/s`;
  modeLabel.textContent = player.vehicle
    ? 'Auto'
    : player.flying
      ? 'Let (F)'
      : cameraRig.state.mode === 'first-person'
        ? 'Chôdza (1. os.)'
        : 'Chôdza';

  postfx.render();
  requestAnimationFrame(tick);
}

tick();
