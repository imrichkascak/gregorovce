// Quests, quest givers, dialogues, side missions and collectibles — the depth
// layer. Every notable village spot gets a quest or an interaction: church, pub,
// shop, town hall, fire station, school, football pitch, playground, septic and
// house 101. Givers are low-poly NPCs with a name tag and a status bubble;
// pressing F (or the touch button) opens a dialogue with choices.
import * as THREE from 'three';
import { labelTexture } from './textures.js';
import { specialKind } from './osm.js';
import { setAvatarShirtColor } from './avatar.js';
import {
  createQuestState,
  findQuest,
  activeQuest,
  startQuest,
  advanceQuest,
  tickQuest,
  unlockQuest,
  questLog,
  questProgress,
} from './quests-core.js';

const GIVER_RADIUS = 3.2;
const PHASE_RADIUS = 3.2;
const SIDE_RADIUS = 2.6;
const PICKUP_RADIUS = 1.8;
const MESSAGE_TIME = 6;
const BOTTLE_COUNT = 10;
const BOTTLE_REWARD = 500;

const BUBBLE_STYLES = {
  available: { text: '!', background: 'rgba(240,197,58,0.95)', foreground: '#1c1408' },
  active: { text: '…', background: 'rgba(60,122,68,0.95)', foreground: '#f4f2ec' },
  failed: { text: '✗', background: 'rgba(181,50,44,0.95)', foreground: '#f4f2ec' },
  completed: { text: '✓', background: 'rgba(90,138,208,0.95)', foreground: '#f4f2ec' },
  locked: { text: '…', background: 'rgba(52,62,74,0.85)', foreground: '#c9c4b8' },
};

export function createQuests({ scene, geo, player, world, layers, avatar, audio, dialogue }) {
  const anchors = world.gagAnchors ?? {};
  const state = createQuestState([]);
  const givers = [];
  const sideMarkers = [];
  const collectibles = [];
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.0, 28),
    new THREE.MeshBasicMaterial({
      color: '#ffd21e',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  let collected = 0;
  let time = 0;

  // --- spots -----------------------------------------------------------------
  function poiWorld(kind) {
    for (const poi of layers.pois ?? []) {
      if (specialKind(poi.tags) === kind) return geo.toWorld(poi.lat, poi.lon);
    }
    return null;
  }

  function leisureWorld(want) {
    for (const way of layers.leisure ?? []) {
      if (want.includes(way.tags?.leisure)) {
        const avg = way.latlon.reduce(
          (acc, p) => ({ lat: acc.lat + p.lat / way.latlon.length, lon: acc.lon + p.lon / way.latlon.length }),
          { lat: 0, lon: 0 },
        );
        return geo.toWorld(avg.lat, avg.lon);
      }
    }
    return null;
  }

  const spots = {
    kostol: world.npcSpawn,
    'krčma': poiWorld('pub'),
    obchod: poiWorld('shop'),
    'úrad': poiWorld('townhall'),
    'hasiči': poiWorld('fire_station'),
    'škola': poiWorld('school'),
    ihrisko: leisureWorld(['pitch']),
    'detské ihrisko': leisureWorld(['playground']),
    'žumpa': anchors.septic,
    'dom 101': anchors.explosion,
    'Pali a Mata': anchors.church,
  };

  // POI nodes sit at building centroids — pull every spot toward the nearest road
  // so quest givers and targets are reachable on foot instead of inside a wall.
  function nearRoad(x, z, fraction = 0.72, maxStep = 12) {
    let best = null;
    let bestDistance = maxStep;
    for (const road of layers.roads ?? []) {
      for (const p of road.latlon) {
        const w = geo.toWorld(p.lat, p.lon);
        const distance = Math.hypot(w.x - x, w.z - z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = w;
        }
      }
    }
    if (!best) return { x, z };
    return { x: x + (best.x - x) * fraction, z: z + (best.z - z) * fraction };
  }

  for (const [key, spot] of Object.entries(spots)) {
    if (spot) spots[key] = nearRoad(spot.x, spot.z);
  }

  // --- quest definitions -----------------------------------------------------
  const giverDefs = [
    { id: 'farar', name: 'Farár Jozef', location: 'kostol', shirt: '#3a4450', dx: 2.6, dz: 0.6 },
    { id: 'krcmar', name: 'Krčmár Miro', location: 'krčma', shirt: '#8a5a1f' },
    { id: 'veduca', name: 'Vedúca Zuza', location: 'obchod', shirt: '#2e7d4f' },
    { id: 'starosta', name: 'Starosta Ondrej', location: 'úrad', shirt: '#2f5f9e' },
    { id: 'hasic', name: 'Hasič Palo', location: 'hasiči', shirt: '#b5322c' },
    { id: 'ucitelka', name: 'Učiteľka Zuzana', location: 'škola', shirt: '#c98a1a' },
    { id: 'trener', name: 'Tréner Laco', location: 'ihrisko', shirt: '#3c7a44' },
    { id: 'teta', name: 'Teta Anka', location: 'detské ihrisko', shirt: '#c43830' },
    { id: 'babka', name: 'Susedka Babka', location: 'žumpa', shirt: '#6e4a7a' },
    { id: 'mata', name: 'Mata', location: 'Pali a Mata', shirt: '#e08a34', dx: -2.6, dz: 0.6 },
  ];

  const defs = [
    {
      id: 'zvony',
      name: 'Zvony pre kostol',
      giver: 'farar',
      location: 'kostol',
      intro: 'Zvony odzvonili, ale výzdoba chýba. Priniesol by si kvety z ihriska?',
      thanks: 'Už máš tie kvety?',
      done: 'Pán Boh zaplať! Zvony budú znieť ešte krajšie.',
      chain: 'palibrat',
      phases: [
        { text: 'Nájdi kvety pri ihrisku', target: 'ihrisko', timeLimit: 90 },
        { text: 'Vráť sa k farárovi', target: 'giver' },
      ],
      reward: { money: 150, respect: 5 },
    },
    {
      id: 'pivo',
      name: 'Pivo pre krčmu',
      giver: 'krcmar',
      location: 'krčma',
      intro: 'Došlo pivo, chýba basa. Skoč do obchodu po bedňu!',
      thanks: 'Máš tú basu?',
      done: 'Konečne pivo! Nech sa páči, aj pre teba.',
      phases: [
        { text: 'Zober pivo z obchodu', target: 'obchod', timeLimit: 90 },
        { text: 'Vráť sa do krčmy', target: 'giver' },
      ],
      reward: { money: 120, respect: 4, ammo: 30 },
    },
    {
      id: 'nakup',
      name: 'Nákup pre úrad',
      giver: 'veduca',
      location: 'obchod',
      intro: 'Úrad objednal nákup, ale nikto ho neodniesol. Pomôžeš?',
      thanks: 'Nákup je hotový?',
      done: 'Si šikovný, ďakujeme!',
      chain: 'ohen',
      phases: [
        { text: 'Odnes nákup na úrad', target: 'úrad', timeLimit: 90 },
        { text: 'Vráť sa do obchodu', target: 'giver' },
      ],
      reward: { money: 140, respect: 4 },
    },
    {
      id: 'papiere',
      name: 'Papiere zo školy',
      giver: 'starosta',
      location: 'úrad',
      intro: 'V škole ostali papiere pre úrad. Skoč po ne!',
      thanks: 'Máš tie papiere?',
      done: 'Úrad môže fungovať ďalej.',
      phases: [
        { text: 'Zober papiere zo školy', target: 'škola', timeLimit: 90 },
        { text: 'Vráť sa na úrad', target: 'giver' },
      ],
      reward: { money: 160, respect: 6 },
    },
    {
      id: 'ohen',
      name: 'Kontrola žumpy',
      giver: 'hasic',
      location: 'hasiči',
      locked: true,
      intro: 'Teta Anka volala, že žumpa 217 preteká. Skontroluj to!',
      thanks: 'Bol si pri žumpe?',
      done: 'Dobrá práca, hasič!',
      phases: [
        { text: 'Skontroluj žumpu 217', target: 'žumpa', timeLimit: 120 },
        { text: 'Vráť sa k hasičom', target: 'giver' },
      ],
      reward: { money: 180, respect: 6 },
    },
    {
      id: 'susedia',
      name: 'Deti z ihriska',
      giver: 'ucitelka',
      location: 'škola',
      intro: 'Deti sa rozutekali na detské ihrisko. Doveď ich!',
      thanks: 'Našiel si ich?',
      done: 'Ďakujem, deti sú späť v škole.',
      phases: [
        { text: 'Nájdi deti na detskom ihrisku', target: 'detské ihrisko', timeLimit: 90 },
        { text: 'Vráť sa do školy', target: 'giver' },
      ],
      reward: { money: 130, respect: 5 },
    },
    {
      id: 'futbal',
      name: 'Lopta do krčmy',
      giver: 'trener',
      location: 'ihrisko',
      intro: 'Tréning skončil, lopta musí do krčmy. Odnesieš ju?',
      thanks: 'Lopta je v krčme?',
      done: 'Zajtra tréning, makaj!',
      phases: [
        { text: 'Odnes loptu do krčmy', target: 'krčma', timeLimit: 90 },
        { text: 'Vráť sa na ihrisko', target: 'giver' },
      ],
      reward: { money: 150, respect: 5, shirt: '#3f6e9e' },
    },
    {
      id: 'zumpa',
      name: 'Zápach od 217',
      giver: 'babka',
      location: 'žumpa',
      locked: true,
      intro: 'Zase to smrdí... skontroluj, čo robia pri dome 101!',
      thanks: 'Bol si sa pozrieť?',
      done: 'Konečne môžem vetrať.',
      phases: [
        { text: 'Skontroluj dom 101', target: 'dom 101', timeLimit: 120 },
        { text: 'Vráť sa k žumpe', target: 'giver' },
      ],
      reward: { money: 170, respect: 6 },
    },
    {
      id: 'palibrat',
      name: 'Banán domov',
      giver: 'mata',
      location: 'Pali a Mata',
      locked: true,
      intro: 'Pali a Banán sa zatúlali. Dones Banán domov, prosím!',
      thanks: 'Kde je Banán?',
      done: 'Brat je doma! Si frajer.',
      phases: [
        { text: 'Dones Banán domov (dom 101)', target: 'dom 101', timeLimit: 90 },
        { text: 'Vráť sa k Matovi', target: 'giver' },
      ],
      reward: { money: 200, respect: 8 },
    },
  ];

  // SA-style side missions: no giver, they start when you step on the marker.
  const sideDefs = [
    {
      id: 'hasenie',
      name: 'Hasičská skúška',
      side: true,
      location: 'hasiči',
      phases: [{ text: 'Dobehni k žumpe 217 (60 s)', target: 'žumpa', timeLimit: 60 }],
      reward: { money: 100, respect: 3 },
    },
    {
      id: 'taxik',
      name: 'Taxík po dedine',
      side: true,
      location: 'obchod',
      phases: [{ text: 'Odvez sa na ihrisko (45 s)', target: 'ihrisko', timeLimit: 45 }],
      reward: { money: 120, respect: 3 },
    },
    {
      id: 'nahanka',
      name: 'Naháňačka za zlodejom',
      side: true,
      location: 'úrad',
      phases: [{ text: 'Chyť zlodeja pri dome 101 (40 s)', target: 'dom 101', timeLimit: 40 }],
      reward: { money: 150, respect: 5 },
    },
  ];

  const allDefs = [...defs, ...sideDefs];
  state.quests.push(...createQuestState(allDefs).quests);
  // A spot counts as covered when it hosts a giver or is a phase target.
  const locations = [
    ...new Set([
      ...allDefs.map((def) => def.location),
      ...allDefs
        .flatMap((def) => def.phases.map((phase) => phase.target))
        .filter((target) => target !== 'giver'),
    ]),
  ];

  function message(text) {
    state.message = text;
    state.messageTimer = MESSAGE_TIME;
  }

  function targetSpot(def, quest) {
    const phase = def.phases[quest.phase];
    if (!phase) return null;
    if (phase.target === 'giver') {
      const giver = givers.find((g) => g.id === def.giver);
      return giver ? { x: giver.x, z: giver.z } : null;
    }
    return spots[phase.target] ?? null;
  }

  function within(spot, radius) {
    const dx = spot.x - player.position.x;
    const dz = spot.z - player.position.z;
    return dx * dx + dz * dz < radius * radius;
  }

  // --- quest givers as 3D NPCs with a name tag and a status bubble -----------
  const bodyGeometry = new THREE.BoxGeometry(0.5, 0.62, 0.28);
  const headGeometry = new THREE.SphereGeometry(0.16, 10, 8);
  const legsGeometry = new THREE.BoxGeometry(0.4, 0.9, 0.24);
  const skinMaterial = new THREE.MeshStandardMaterial({ color: '#c98a5a', roughness: 0.95 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: '#3a5a8c', roughness: 0.95 });
  const bubbleStyles = {};
  for (const [key, style] of Object.entries(BUBBLE_STYLES)) {
    bubbleStyles[key] = labelTexture(style.text, style.background, style.foreground);
  }

  for (const def of giverDefs) {
    const spot = spots[def.location];
    if (!spot) continue;
    const gx = spot.x + (def.dx ?? 0);
    const gz = spot.z + (def.dz ?? 0);
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({ color: def.shirt, roughness: 0.95 }));
    body.position.y = 1.16;
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.position.y = 1.63;
    const legs = new THREE.Mesh(legsGeometry, pantsMaterial);
    legs.position.y = 0.45;
    const ground = geo.heightAt(gx, gz);
    group.add(body, head, legs);
    group.position.set(gx, ground, gz);
    group.rotation.y = Math.atan2((world.npcSpawn?.x ?? gx) - gx, (world.npcSpawn?.z ?? gz) - gz);

    const { texture: tagTexture, aspect: tagAspect } = labelTexture(
      def.name,
      'rgba(52,62,74,0.9)',
      '#ffffff',
    );
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture, transparent: true }));
    tag.scale.set(2.1 * tagAspect, 2.1, 1);
    tag.position.y = 2.55;
    const bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: bubbleStyles.available.texture, transparent: true }),
    );
    bubble.scale.set(1.1 * bubbleStyles.available.aspect, 1.1, 1);
    bubble.position.y = 3.35;
    group.add(tag, bubble);
    scene.add(group);
    givers.push({ ...def, object: group, bubble, x: gx, z: gz, ground });
  }

  function setBubble(giver, status) {
    const style = bubbleStyles[status] ?? bubbleStyles.available;
    if (giver.bubble.material.map !== style.texture) {
      giver.bubble.material.map = style.texture;
      giver.bubble.scale.set(1.1 * style.aspect, 1.1, 1);
    }
  }

  // --- side mission markers (red beams) ---------------------------------------
  const sideMaterial = new THREE.MeshBasicMaterial({
    color: '#d23c30',
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const def of sideDefs) {
    const spot = spots[def.location];
    if (!spot) continue;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 18, 1, true), sideMaterial.clone());
    const ground = geo.heightAt(spot.x, spot.z);
    mesh.position.set(spot.x, ground + 2.5, spot.z);
    scene.add(mesh);
    sideMarkers.push({ id: def.id, object: mesh, x: spot.x, z: spot.z, ground });
  }

  // --- collectible bottles ---------------------------------------------------
  const bottleMaterial = new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.7 });
  const bottleGeometry = new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8);
  const bottleSpots = [];
  for (const anchor of [anchors.explosion, anchors.septic, anchors.church, world.npcSpawn, spots.obchod]) {
    if (!anchor) continue;
    bottleSpots.push({ x: anchor.x + 2.4, z: anchor.z + 2.4 });
    bottleSpots.push({ x: anchor.x - 2.4, z: anchor.z - 2.4 });
  }
  for (const spot of bottleSpots.slice(0, BOTTLE_COUNT)) {
    const mesh = new THREE.Mesh(bottleGeometry, bottleMaterial);
    const ground = geo.heightAt(spot.x, spot.z);
    mesh.position.set(spot.x, ground + 0.55, spot.z);
    scene.add(mesh);
    collectibles.push({
      id: `flasa-${collectibles.length + 1}`,
      object: mesh,
      x: spot.x,
      z: spot.z,
      ground,
      taken: false,
    });
  }

  // --- flow ------------------------------------------------------------------
  function reward(def) {
    const { money = 0, respect = 0, ammo = 0, shirt = null } = def.reward ?? {};
    player.money += money;
    player.respect += respect;
    if (ammo) {
      for (const weapon of player.weapons?.list ?? []) {
        if (weapon.id === 'smg') weapon.ammo += ammo;
      }
    }
    if (shirt && avatar) setAvatarShirtColor(avatar, shirt);
    message(`Misia splnená: ${def.name} (+${money} €, +${respect} rešpekt)`);
    if (audio) audio.playSfx('hit');
  }

  function completeQuest(def) {
    const result = advanceQuest(state, def.id, allDefs);
    if (!result) return;
    if (result.status === 'completed') {
      reward(def);
      if (result.chain) {
        const chained = allDefs.find((d) => d.id === result.chain);
        if (chained && unlockQuest(state, result.chain)) {
          message(`Odomknuté: ${chained.name} (${chained.location})`);
        }
      }
    } else {
      message(`Nová fáza: ${result.phase.text}`);
    }
  }

  /** Press F near a giver (or tap the touch button) to talk. */
  function interact() {
    if (dialogue.state.open) {
      dialogue.hide();
      return true;
    }
    let best = null;
    let bestDistance = GIVER_RADIUS;
    for (const giver of givers) {
      const distance = Math.hypot(giver.x - player.position.x, giver.z - player.position.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = giver;
      }
    }
    if (!best) return false;
    const def = allDefs.find((d) => d.giver === best.id);
    if (!def) return false;
    const quest = findQuest(state, def.id);
    if (quest.status === 'locked') {
      dialogue.show({
        speaker: best.name,
        text: 'Ešte nemám pre teba prácu. Vráť sa neskôr.',
        choices: [{ id: 'close', label: 'Zavrieť' }],
      });
      return true;
    }
    if (quest.status === 'completed') {
      dialogue.show({
        speaker: best.name,
        text: def.done,
        choices: [{ id: 'close', label: 'Zavrieť' }],
      });
      return true;
    }
    if (quest.status === 'failed') {
      dialogue.show({
        speaker: best.name,
        text: 'Nevadí, skús to znova.',
        choices: [
          { id: 'accept', label: 'Skúsiť znova' },
          { id: 'close', label: 'Neskôr' },
        ],
        questId: def.id,
      });
      return true;
    }
    if (quest.status === 'available') {
      dialogue.show({
        speaker: best.name,
        text: def.intro,
        choices: [
          { id: 'accept', label: 'Prijať' },
          { id: 'close', label: 'Neskôr' },
        ],
        questId: def.id,
      });
      return true;
    }
    const phase = def.phases[quest.phase];
    if (phase && phase.target === 'giver') {
      dialogue.show({
        speaker: best.name,
        text: def.thanks,
        choices: [
          { id: 'complete', label: 'Odovzdať' },
          { id: 'close', label: 'Neskôr' },
        ],
        questId: def.id,
      });
      return true;
    }
    dialogue.show({
      speaker: best.name,
      text: `Ako to ide? ${phase ? phase.text : ''}`,
      choices: [{ id: 'close', label: 'Zavrieť' }],
    });
    return true;
  }

  /** Dialogue choice bridge: accept, complete or just close. */
  function choose(choiceId, { questId } = {}) {
    if (choiceId === 'close' || !questId) return false;
    const def = allDefs.find((d) => d.id === questId);
    if (!def) return false;
    if (choiceId === 'accept') {
      const quest = startQuest(state, questId, allDefs);
      if (quest) {
        message(`Misia prijatá: ${def.name}`);
        if (audio) audio.playSfx('hit');
      }
      return Boolean(quest);
    }
    if (choiceId === 'complete') {
      completeQuest(def);
      return true;
    }
    return false;
  }

  function update(dt) {
    time += dt;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }

    // Active quest: tick its timer, then check the current phase target.
    const active = activeQuest(state);
    if (active) {
      const def = allDefs.find((d) => d.id === active.id);
      if (tickQuest(state, active.id, dt)) {
        message(`Misia zlyhala: ${def?.name ?? active.id}`);
        if (audio) audio.playSfx('ko');
      } else {
        const phase = def?.phases[active.phase];
        const target = def ? targetSpot(def, active) : null;
        if (phase && phase.target !== 'giver' && target && within(target, PHASE_RADIUS)) {
          completeQuest(def);
        }
      }
    }

    // Side missions start (and retry) by stepping on their red marker.
    for (const marker of sideMarkers) {
      const quest = findQuest(state, marker.id);
      const def = allDefs.find((d) => d.id === marker.id);
      const visible = quest.status === 'available' || quest.status === 'failed';
      marker.object.visible = visible;
      if (visible && within(marker, SIDE_RADIUS) && startQuest(state, marker.id, allDefs)) {
        message(`Bočná misia: ${def.name}`);
      }
    }

    // Collectible bottles spin, bob and get picked up on touch.
    for (const collectible of collectibles) {
      if (collectible.taken) continue;
      collectible.object.rotation.y += dt * 2.2;
      collectible.object.position.y = collectible.ground + 0.55 + Math.sin(time * 2 + collectible.x) * 0.08;
      if (within(collectible, PICKUP_RADIUS)) {
        collectible.taken = true;
        collectible.object.visible = false;
        collected += 1;
        if (collected >= collectibles.length) {
          player.money += BOTTLE_REWARD;
          message(`Všetky fľaše! +${BOTTLE_REWARD} €`);
        } else {
          message(`Fľaša ${collected}/${collectibles.length}`);
        }
        if (audio) audio.playSfx('hit');
      }
    }

    // Giver bubbles follow the quest status; remember the closest one.
    let near = null;
    for (const giver of givers) {
      const def = allDefs.find((d) => d.giver === giver.id);
      const quest = def ? findQuest(state, def.id) : null;
      setBubble(giver, quest?.status ?? 'available');
      const distance = Math.hypot(giver.x - player.position.x, giver.z - player.position.z);
      if (distance < GIVER_RADIUS) near = giver;
    }
    state.nearGiver = near ? { name: near.name, x: near.x, z: near.z } : null;

    // Ring on the active quest's phase target + objective for the HUD.
    const current = activeQuest(state);
    if (current) {
      const def = allDefs.find((d) => d.id === current.id);
      const phase = def?.phases[current.phase];
      const target = def ? targetSpot(def, current) : null;
      if (target) {
        ring.visible = true;
        ring.position.set(target.x, geo.heightAt(target.x, target.z) + 0.08, target.z);
        state.objective = {
          name: def.name,
          phaseText: phase.text,
          timeLeft: current.timeLeft,
          distance: Math.hypot(target.x - player.position.x, target.z - player.position.z),
        };
      }
    } else {
      ring.visible = false;
      state.objective = null;
    }
  }

  /** Radar extras: quest waypoint + undiscovered bottles. */
  function extras() {
    const list = [];
    const current = activeQuest(state);
    if (current) {
      const def = allDefs.find((d) => d.id === current.id);
      const target = def ? targetSpot(def, current) : null;
      if (target) list.push({ x: target.x, z: target.z, color: '#ffd21e', radius: 2.4 });
    }
    for (const collectible of collectibles) {
      if (!collectible.taken) list.push({ x: collectible.x, z: collectible.z, color: '#f4f2ec', radius: 1.1 });
    }
    return list;
  }

  /** Pause-menu quest log rows. */
  function log() {
    return questLog(allDefs, state);
  }

  function save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      'gregorovce-quests',
      JSON.stringify({
        respect: player.respect,
        quests: state.quests.map(({ id, status, phase }) => ({ id, status, phase })),
        collected: collectibles.filter((c) => c.taken).map((c) => c.id),
      }),
    );
  }

  function load() {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('gregorovce-quests');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      player.respect = data.respect ?? player.respect;
      for (const row of data.quests ?? []) {
        const quest = findQuest(state, row.id);
        if (!quest) continue;
        quest.status = row.status;
        quest.phase = row.phase;
        const def = allDefs.find((d) => d.id === row.id);
        quest.timeLeft =
          quest.status === 'active' ? def?.phases[quest.phase]?.timeLimit ?? null : null;
      }
      const taken = new Set(data.collected ?? []);
      for (const collectible of collectibles) {
        collectible.taken = taken.has(collectible.id);
        collectible.object.visible = !collectible.taken;
      }
      collected = collectibles.filter((c) => c.taken).length;
      return true;
    } catch {
      return false;
    }
  }

  return {
    defs: allDefs,
    locations,
    spots,
    state,
    givers,
    sideMarkers,
    collectibles,
    interact,
    choose,
    log,
    extras,
    save,
    load,
    progress: () => questProgress(allDefs.find((d) => d.id === activeQuest(state)?.id), activeQuest(state)),
    collected: () => collected,
    update,
  };
}
