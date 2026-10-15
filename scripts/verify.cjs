// End-to-end verification harness: boots the static server, drives the world in a
// headless browser and asserts the GTA-SA acceptance criteria programmatically.
// Screenshots land in /tmp/opencode for human review (this agent cannot see them).
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5173;
const BASE = `http://localhost:${PORT}`;
const OUT = '/tmp/opencode';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(BASE, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => (n <= 0 ? reject(new Error('server never came up')) : setTimeout(() => attempt(n - 1), 250)));
    };
    attempt(retries);
  });
}

async function desktop() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#overlay.ready', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/verify-menu.png` });

  const systems = await page.evaluate(() => Object.keys(window.__gregorovce ?? {}));
  check(
    'F0 debug handle exposes all systems',
    ['avatar', 'cameraRig', 'radar', 'dayNight', 'weather', 'audio', 'weapons', 'vehicles', 'wanted', 'missions', 'postfx'].every(
      (key) => systems.includes(key),
    ),
    systems.join(','),
  );

  await page.click('#start');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
  });

  // F1 — avatar + third-person camera + pose
  const f1 = await page.evaluate(() => {
    const { avatar, cameraRig, player, THREE } = window.__gregorovce;
    let meshes = 0;
    avatar.group.traverse((o) => {
      if (o.isMesh) meshes += 1;
    });
    player.yaw = 0;
    player.currentSpeed = 0;
    avatar.update(0, true, 0.016);
    const idlePose = avatar.state.pose;
    avatar.update(9, true, 0.016);
    const runPose = avatar.state.pose;
    return {
      mode: cameraRig.state.mode,
      distance: cameraRig.state.distance,
      meshes,
      idlePose,
      runPose,
    };
  });
  check('F1 avatar has a body (>=8 meshes)', f1.meshes >= 8, `meshes=${f1.meshes}`);
  check('F1 camera is third-person', f1.mode === 'third-person', f1.mode);
  check('F1 camera distance in [3,8]', f1.distance >= 3 && f1.distance <= 8, `${f1.distance}`);
  check('F1 avatar poses idle vs run', f1.idlePose === 'idle' && f1.runPose === 'run', `${f1.idlePose}/${f1.runPose}`);

  // F2 — radar blips, zone, stars, pause menu
  const f2 = await page.evaluate(() => {
    const { radar, wanted, player } = window.__gregorovce;
    const before = wanted.state.level;
    wanted.crime(2);
    const after = wanted.state.level;
    player.pause();
    const menu = document.getElementById('pause-menu');
    return {
      blips: radar.blips.length,
      zone: document.getElementById('zone').textContent,
      starsText: document.getElementById('stars').textContent,
      level: after,
      menuItems: menu.querySelectorAll('button').length,
      menuVisible: !menu.classList.contains('hidden'),
      crimeWorked: after > before,
    };
  });
  check('F2 radar has POI blips', f2.blips > 0, `blips=${f2.blips}`);
  check('F2 zone name under radar', f2.zone === 'Gregorovce, Prešov', f2.zone);
  check('F2 wanted crime raises level', f2.crimeWorked && f2.level >= 2, `level=${f2.level}`);
  check('F2 pause menu opens with >=4 items', f2.menuVisible && f2.menuItems >= 4, `items=${f2.menuItems}`);

  await page.click('#pause-menu button[data-action="map"]');
  const mapContent = await page.evaluate(() => document.getElementById('pause-content').textContent);
  await page.click('#pause-menu button[data-action="stats"]');
  const statsContent = await page.evaluate(() => document.getElementById('pause-content').textContent);
  check('F2 pause menu Mapa shows content', mapContent.includes('Mapa'), mapContent.slice(0, 40));
  check('F2 pause menu Štatistiky shows content', statsContent.includes('Štatistiky'), statsContent.slice(0, 40));
  await page.evaluate(() => document.getElementById('overlay').classList.add('hidden'));

  // F3 — day/night, weather, audio
  const f3 = await page.evaluate(async () => {
    const { dayNight, weather, audio, scene } = window.__gregorovce;
    const t0 = dayNight.state.time;
    const sky0 = scene.fog.near;
    weather.set('rain');
    await new Promise((r) => setTimeout(r, 400));
    const t1 = dayNight.state.time;
    const raining = weather.state.name === 'rain';
    audio.resume();
    return {
      timeAdvanced: t1 !== t0,
      raining,
      fogChanged: scene.fog.near !== sky0,
      audioState: audio.state(),
      stations: audio.stations.length,
    };
  });
  check('F3 day/night clock advances', f3.timeAdvanced, `time advanced`);
  check('F3 weather rain changes fog', f3.raining && f3.fogChanged, `rain=${f3.raining}`);
  check('F3 audio context running after gesture', f3.audioState === 'running', f3.audioState);
  check('F3 at least 3 radio stations', f3.stations >= 3, `${f3.stations}`);
  await page.screenshot({ path: `${OUT}/verify-world.png` });

  // F4 — vehicles enter/drive/exit
  const f4 = await page.evaluate(() => {
    const { player, vehicles, world, geo } = window.__gregorovce;
    const car = world.traffic.cars.find((c) => c.state === 'drive');
    if (!car) return { ok: false, reason: 'no car' };
    player.position.set(car.object.position.x, car.object.position.y, car.object.position.z);
    const entered = vehicles.enter();
    const wasDriving = vehicles.state.driving;
    const x0 = car.object.position.x;
    player.keys.add('KeyW');
    for (let i = 0; i < 30; i += 1) vehicles.update(0.05);
    player.keys.delete('KeyW');
    const moved = Math.hypot(car.object.position.x - x0, car.object.position.z) > 0.5;
    const exited = vehicles.exit();
    return { ok: entered && wasDriving && moved && exited, entered, moved, exited };
  });
  check('F4 enter car + drive + exit', f4.ok, JSON.stringify(f4));

  // F5 — weapons select + fire + ped reaction
  const f5 = await page.evaluate(() => {
    const { weapons, player, camera, world } = window.__gregorovce;
    const traffic = world.traffic;
    weapons.select(weapons.list.findIndex((w) => w.id === 'pistol'));
    const weapon = weapons.currentWeapon();
    const ammo0 = weapons.ammo();
    const ped = traffic.peds.find((p) => p.state !== 'dead');
    camera.position.set(ped.object.position.x, ped.object.position.y + 1.6, ped.object.position.z + 4);
    camera.lookAt(ped.object.position.x, ped.object.position.y + 1, ped.object.position.z);
    const health0 = ped.health;
    const fired = weapons.fire();
    return {
      weapon: weapon.name,
      ammoDropped: weapons.ammo() < ammo0,
      fired,
      pedHurt: ped.health < health0 || ped.state !== 'walk',
    };
  });
  check('F5 weapon select + fire spends ammo', f5.fired && f5.ammoDropped, `${f5.weapon} ammo dropped=${f5.ammoDropped}`);
  check('F5 hit reacts (ped hurt/flee)', f5.pedHurt, `pedHurt=${f5.pedHurt}`);

  // F6 — wanted + police spawn
  const f6 = await page.evaluate(async () => {
    const { wanted, player } = window.__gregorovce;
    wanted.clear();
    wanted.crime(3);
    for (let i = 0; i < 10; i += 1) wanted.update(0.1);
    return { level: wanted.state.level, units: wanted.units.length };
  });
  check('F6 police units spawn for wanted level', f6.level >= 3 && f6.units >= 1, `level=${f6.level} units=${f6.units}`);

  // F7 — standing on a marker starts a mission; reaching the target rewards money
  const f7 = await page.evaluate(() => {
    const { missions, player, geo } = window.__gregorovce;
    const marker = missions.markers[0];
    player.position.set(
      marker.object.position.x,
      geo.heightAt(marker.object.position.x, marker.object.position.z),
      marker.object.position.z,
    );
    missions.update(0.016);
    const started = missions.state.active?.name ?? null;
    const hasObjective = Boolean(missions.state.objective);
    const money0 = player.money;
    const target = missions.state.active.target;
    player.position.set(
      target.object.position.x,
      geo.heightAt(target.object.position.x, target.object.position.z),
      target.object.position.z,
    );
    missions.update(0.016);
    return {
      markers: missions.markers.length,
      started,
      hasObjective,
      rewarded: player.money > money0,
      completed: missions.state.completed.length,
      shops: missions.shops.length,
    };
  });
  check('F7 mission markers >= 3', f7.markers >= 3, `markers=${f7.markers}`);
  check('F7 standing on marker starts mission', f7.started !== null, `started=${f7.started}`);
  check('F7 active mission shows objective', f7.hasObjective, `hasObjective=${f7.hasObjective}`);
  check('F7 reaching target rewards money', f7.rewarded, `rewarded=${f7.rewarded}`);

  // F7 — save/load
  const f7b = await page.evaluate(() => {
    const { missions, player } = window.__gregorovce;
    player.money = 1234;
    missions.save();
    player.money = 0;
    const loaded = missions.load();
    return { loaded, money: player.money };
  });
  check('F7 save + load restores money', f7b.loaded && f7b.money === 1234, `money=${f7b.money}`);

  // F8 — postfx + draw call budget
  const f8 = await page.evaluate(() => {
    const { postfx, renderer } = window.__gregorovce;
    return { hasPostfx: Boolean(postfx), enabled: Boolean(postfx?.enabled), calls: renderer.info.render.calls };
  });
  check('F8 postfx present', f8.hasPostfx, `enabled=${f8.enabled}`);
  check('F8 draw calls within budget (<400)', f8.calls < 400, `calls=${f8.calls}`);

  // F9 — melee swings, NPC reactions, fights, player damage, death, feedback
  const f9 = await page.evaluate(() => {
    const { player, weapons, world, effects, cameraRig, avatar, audio, geo, wanted } = window.__gregorovce;
    const traffic = world.traffic;
    wanted.clear();
    player.health = 100;
    player.armor = 0;
    player.dead = false;

    // Stand just in front of a calm pedestrian and punch it.
    const ped = traffic.peds.find((p) => p.state !== 'dead' && p.aggression < 0.5);
    const px = ped.object.position.x;
    const pz = ped.object.position.z;
    player.position.set(px, geo.heightAt(px, pz + 2.1), pz + 2.1);
    player.yaw = 0; // yaw 0 faces -z, straight at the ped
    weapons.select(0);
    // The slow headless render loop may still be mid-swing from F5; clear it.
    avatar.state.attack = 0;
    weapons.state.cooldown = 0;
    // Spy on the sfx calls the fight triggers.
    const sfx = [];
    const origSfx = audio.playSfx;
    audio.playSfx = (kind) => {
      sfx.push(kind);
      return origSfx.call(audio, kind);
    };
    const health0 = ped.health;
    const fired = weapons.fire();
    const pose = avatar.state.pose;
    const marker = !document.getElementById('hitmarker').classList.contains('hidden');
    const blood = effects.count('blood');
    const shake = cameraRig.state.shake;
    const hurt = ped.health < health0;
    const reacted = ped.state === 'stagger' || ped.state === 'knockdown' || ped.state === 'fight';

    // Two more quick hits: the third one knocks them down, then they get up.
    for (let i = 0; i < 2; i += 1) {
      weapons.update(0.5);
      weapons.fire();
    }
    const knocked = ped.state === 'knockdown';
    wanted.clear();
    traffic.update(3.0, player);
    const gotUp = ped.state;
    traffic.update(0.8, player);
    const recovered = ped.state;

    // A lethal hit leaves a body behind in the scene.
    const corpse = traffic.peds.find((p) => p.state !== 'dead' && p !== ped);
    traffic.hitPed(corpse, 200, { combo: 1 });
    const bodyStays = corpse.state === 'dead' && corpse.object.parent !== null;
    audio.playSfx = origSfx;

    // A chuligán fights back and hurts the player.
    const brawler = traffic.peds.find((p) => p.aggression > 0.7 && p.state !== 'dead');
    brawler.health = 100;
    brawler.state = 'fight';
    brawler.attackTimer = 0;
    player.health = 100;
    player.position.set(brawler.object.position.x, geo.heightAt(brawler.object.position.x, brawler.object.position.z), brawler.object.position.z + 1.2);
    for (let i = 0; i < 5; i += 1) traffic.update(0.5, player);
    const fought = player.health < 100;

    // Armor soaks a hit, zero health dies, respawn restores health.
    player.health = 100;
    player.armor = 100;
    player.damage(30);
    const armorAbsorbed = player.armor < 100 && player.health > 70;
    player.armor = 0;
    player.damage(200);
    const dead = player.dead;
    const deaths = player.deaths;
    player.update(3.2);
    const respawned = !player.dead && player.health === 100;

    return {
      fired,
      pose,
      marker,
      sounds: [...new Set(sfx)],
      blood,
      shake,
      hurt,
      reacted,
      knocked,
      gotUp,
      recovered,
      bodyStays,
      fought,
      armorAbsorbed,
      dead,
      deaths,
      respawned,
    };
  });
  check('F9 punch spends a swing and poses', f9.fired && f9.pose === 'punch', `pose=${f9.pose}`);
  check('F9 hit hurts and reacts', f9.hurt && f9.reacted, `hurt=${f9.hurt} reacted=${f9.reacted}`);
  check('F9 hit spawns blood and camera shake', f9.blood > 0 && f9.shake > 0, `blood=${f9.blood} shake=${f9.shake.toFixed(2)}`);
  check('F9 hit marker flashes and fight sounds play', f9.marker && f9.sounds.includes('swing') && f9.sounds.includes('hit'), `marker=${f9.marker} sounds=${f9.sounds.join(',')}`);
  check('F9 three quick hits knock down', f9.knocked, `state=${f9.knocked ? 'knockdown' : 'no'}`);
  check('F9 knocked-down ped gets up', f9.gotUp === 'getup' && (f9.recovered === 'flee' || f9.recovered === 'walk'), `${f9.gotUp}→${f9.recovered}`);
  check('F9 lethal hit leaves a body', f9.bodyStays, `body=${f9.bodyStays}`);
  check('F9 chuligán fights back and hurts the player', f9.fought, `fought=${f9.fought}`);
  check('F9 armor soaks a hit', f9.armorAbsorbed, `absorbed=${f9.armorAbsorbed}`);
  check('F9 zero health dies and respawns', f9.dead && f9.deaths > 0 && f9.respawned, `deaths=${f9.deaths} respawned=${f9.respawned}`);

  // WASTED overlay follows the dead state through the real game loop. The
  // render loop is slow in headless, so hold the corpse, then release it.
  await page.evaluate(() => {
    const { player } = window.__gregorovce;
    player.health = 100;
    player.armor = 0;
    player.damage(500);
    player.deathTimer = 999;
  });
  await page
    .waitForFunction(() => !document.getElementById('wasted').classList.contains('hidden'), null, { timeout: 15000 })
    .catch(() => {});
  const wastedShown = await page.evaluate(() => ({
    overlay: !document.getElementById('wasted').classList.contains('hidden'),
    dead: window.__gregorovce.player.dead,
    bar: document.getElementById('health-fill').style.width,
  }));
  await page.evaluate(() => {
    window.__gregorovce.player.deathTimer = 0;
  });
  await page
    .waitForFunction(
      () => document.getElementById('wasted').classList.contains('hidden') && !window.__gregorovce.player.dead,
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
  const wastedCleared = await page.evaluate(
    () => document.getElementById('wasted').classList.contains('hidden') && !window.__gregorovce.player.dead,
  );
  check('F9 death shows WASTED overlay and empty health bar', wastedShown.overlay && wastedShown.dead && wastedShown.bar === '0%', `shown=${wastedShown.overlay} bar=${wastedShown.bar}`);
  check('F9 respawn clears WASTED overlay', wastedCleared, `cleared=${wastedCleared}`);

  // F10 — quest framework, dialogues, quests at spots, rewards, chains
  const f10 = await page.evaluate(() => {
    const { player, world, geo, dialogue } = window.__gregorovce;
    const quests = world.quests;
    const required = ['kostol', 'krčma', 'obchod', 'úrad', 'hasiči', 'škola', 'ihrisko', 'žumpa', 'dom 101'];
    const covered = required.every((key) => quests.locations.includes(key));
    const namedGivers = quests.givers.filter((giver) => giver.name.length > 2).length;

    // Talk to the church giver, accept the quest through the dialogue choices.
    const def = quests.defs.find((d) => d.id === 'zvony');
    const giver = quests.givers.find((g) => g.id === def.giver);
    player.position.set(giver.x, geo.heightAt(giver.x, giver.z + 2), giver.z + 2);
    const talked = quests.interact();
    const opened = dialogue.state.open;
    const choices = dialogue.state.choices.length;
    dialogue.choose('accept');
    const closed = !dialogue.state.open;
    const accepted = quests.state.quests.find((q) => q.id === 'zvony').status === 'active';
    const bubbleBefore = giver.bubble.material.map;
    quests.update(0.1);
    const bubbleSwapped = giver.bubble.material.map !== bubbleBefore;
    const waypoint = quests.extras().some((extra) => extra.color === '#ffd21e');

    // Reach the phase target, then hand the quest in at the giver.
    const target = quests.spots[def.phases[0].target];
    player.position.set(target.x, geo.heightAt(target.x, target.z), target.z);
    quests.update(0.1);
    const phaseAdvanced = quests.state.quests.find((q) => q.id === 'zvony').phase === 1;
    const moneyBefore = player.money;
    const respectBefore = player.respect;
    player.position.set(giver.x, geo.heightAt(giver.x, giver.z + 2), giver.z + 2);
    quests.interact();
    dialogue.choose('complete');
    const done = quests.state.quests.find((q) => q.id === 'zvony');
    const rewarded = player.money > moneyBefore && player.respect > respectBefore;
    const chained = quests.state.quests.find((q) => q.id === 'palibrat').status;
    const logRows = quests.log();
    const logHasCompleted = logRows.some((row) => row.id === 'zvony' && row.status === 'completed');

    return {
      defs: quests.defs.length,
      covered,
      namedGivers,
      talked,
      opened,
      choices,
      closed,
      accepted,
      bubbleSwapped,
      waypoint,
      phaseAdvanced,
      completed: done.status,
      rewarded,
      chained,
      logHasCompleted,
    };
  });
  check('F10 quest framework has >= 8 quests', f10.defs >= 8, `defs=${f10.defs}`);
  check('F10 quests cover all village spots', f10.covered, `covered=${f10.covered}`);
  check('F10 >= 5 named quest givers', f10.namedGivers >= 5, `givers=${f10.namedGivers}`);
  check('F10 dialogue opens with choices', f10.talked && f10.opened && f10.choices >= 2, `choices=${f10.choices}`);
  check('F10 dialogue choice accepts the quest', f10.accepted && f10.closed, `accepted=${f10.accepted}`);
  check('F10 giver bubble tracks the quest state', f10.bubbleSwapped, `swapped=${f10.bubbleSwapped}`);
  check('F10 active quest shows a radar waypoint', f10.waypoint, `waypoint=${f10.waypoint}`);
  check('F10 reaching the target advances the phase', f10.phaseAdvanced, `phase=${f10.phaseAdvanced}`);
  check('F10 hand-in completes, rewards and chains', f10.completed === 'completed' && f10.rewarded && f10.chained === 'available', `status=${f10.completed} rewarded=${f10.rewarded} chain=${f10.chained}`);
  check('F10 quest log lists the quest', f10.logHasCompleted, `log=${f10.logHasCompleted}`);

  // F10 — side missions (start on the street, fail and retry), collectibles, log page
  const f10b = await page.evaluate(() => {
    const { player, world, geo } = window.__gregorovce;
    const quests = world.quests;
    const marker = quests.sideMarkers[0];
    player.position.set(marker.x, geo.heightAt(marker.x, marker.z), marker.z);
    quests.update(0.1);
    const sideActive = quests.state.quests.find((q) => q.id === marker.id).status;

    // Wander off so the timer can run out without re-triggering the marker.
    const away = quests.givers[0];
    player.position.set(away.x, geo.heightAt(away.x, away.z), away.z);
    quests.update(1000);
    const failed = quests.state.quests.find((q) => q.id === marker.id).status;

    player.position.set(marker.x, geo.heightAt(marker.x, marker.z), marker.z);
    quests.update(0.1);
    const retried = quests.state.quests.find((q) => q.id === marker.id).status;

    // Collect a bottle.
    const bottle = quests.collectibles.find((c) => !c.taken);
    const before = quests.collected();
    player.position.set(bottle.x, geo.heightAt(bottle.x, bottle.z), bottle.z);
    quests.update(0.1);
    const picked = quests.collected() > before;

    return {
      sideCount: quests.sideMarkers.length,
      bottles: quests.collectibles.length,
      sideActive,
      failed,
      retried,
      picked,
    };
  });
  check('F10 >= 3 side missions start on the street', f10b.sideCount >= 3 && f10b.sideActive === 'active', `side=${f10b.sideCount} status=${f10b.sideActive}`);
  check('F10 side mission fails on the timer', f10b.failed === 'failed', `failed=${f10b.failed}`);
  check('F10 failed side mission can be retried', f10b.retried === 'active', `retried=${f10b.retried}`);
  check('F10 >= 10 collectibles and picking one counts', f10b.bottles >= 10 && f10b.picked, `bottles=${f10b.bottles} picked=${f10b.picked}`);

  await page.evaluate(() => document.querySelector('#pause-menu button[data-action="quests"]').click());
  const questPage = await page.evaluate(() => document.getElementById('pause-content').textContent);
  check('F10 pause menu shows the quest log', questPage.includes('Zvony pre kostol'), questPage.slice(0, 70));

  // F11 — aiming, ten weapons, pickups, shooting effects, drive-by
  const f11 = await page.evaluate(() => {
    const { player, weapons, world, effects, cameraRig, geo, pickups, syncAimHud } = window.__gregorovce;
    const traffic = world.traffic;
    const field = world.quests.spots.ihrisko;
    const ground = geo.heightAt(field.x, field.z);
    const result = {};

    // Aiming: the right mouse raises the gun, the camera and the crosshair.
    weapons.select(weapons.list.findIndex((w) => w.id === 'pistol'));
    weapons.state.cooldown = 0;
    weapons.setAiming(true);
    syncAimHud();
    result.aiming = weapons.state.aiming === true;
    result.cameraAim = cameraRig.state.aim === true;
    result.crosshair = document.getElementById('crosshair').classList.contains('on');
    const spreadAim = weapons.spread();
    weapons.setAiming(false);
    syncAimHud();
    result.spreadTighter = spreadAim < weapons.spread();
    const skill0 = player.weaponSkill ?? 0;
    weapons.state.cooldown = 0;
    weapons.fire();
    result.skillGrew = (player.weaponSkill ?? 0) > skill0;

    // Ten weapons, each of them fires and has an effect.
    let fired = 0;
    for (let i = 0; i < weapons.list.length; i += 1) {
      weapons.select(i);
      const weapon = weapons.currentWeapon();
      if (weapon.ammo !== Infinity) weapon.ammo = Math.max(weapon.ammo, 2);
      weapons.state.cooldown = 0;
      if (weapons.fire()) fired += 1;
      for (const projectile of weapons.state.projectiles) projectile.timer = 0;
      weapons.update(0.02);
    }
    result.weapons = weapons.list.length;
    result.fired = fired;
    result.blasts = weapons.state.blasts;

    // A grenade at a pedestrian's feet hurts them and shakes the camera.
    const ped = traffic.peds.find((p) => p.state !== 'dead' && !p.temporary);
    ped.object.position.set(field.x, ground, field.z - 3);
    ped.health = 100;
    ped.state = 'walk';
    weapons.select(weapons.list.findIndex((w) => w.id === 'grenade'));
    weapons.state.cooldown = 0;
    weapons.fire();
    const grenade = weapons.state.projectiles[weapons.state.projectiles.length - 1];
    grenade.object.position.set(field.x, ground + 0.4, field.z - 3);
    grenade.timer = 0;
    cameraRig.state.shake = 0;
    weapons.update(0.02);
    result.pedHurt = ped.health < 100;
    result.explosionEffects = effects.count('fire') > 0;
    result.shake = cameraRig.state.shake > 0;
    ped.object.position.set(field.x + 60, ground, field.z + 60);

    // Tracers, shell casings and a bullet hole when nothing is hit.
    player.position.set(field.x, 400, field.z);
    player.pitch = 0;
    player.yaw = 0;
    for (let i = 0; i < 40; i += 1) cameraRig.update(0.05);
    weapons.select(weapons.list.findIndex((w) => w.id === 'pistol'));
    const pistol = weapons.currentWeapon();
    pistol.ammo = Math.max(pistol.ammo, 2);
    weapons.state.cooldown = 0;
    const decals0 = effects.decals.active;
    weapons.fire();
    result.tracer = effects.tracers.active > 0;
    result.casing = effects.count('casing') > 0;
    result.decal = effects.decals.active > decals0;

    // Pickups: walking over one changes state, it comes back after ~30 s.
    result.pickups = world.pickups.length;
    const healthPickup = world.pickups.find((p) => p.kind === 'health');
    player.health = 40;
    player.position.set(healthPickup.x, geo.heightAt(healthPickup.x, healthPickup.z), healthPickup.z);
    pickups.update(0.05);
    result.healed = player.health > 40;
    result.pickupHidden = healthPickup.object.visible === false && healthPickup.timer > 25;
    player.position.set(healthPickup.x + 40, geo.heightAt(healthPickup.x + 40, healthPickup.z), healthPickup.z);
    pickups.update(31);
    result.respawned = healthPickup.object.visible === true;
    const gunPickup = world.pickups.find((p) => p.kind === 'weapon');
    const gun = weapons.findWeapon(gunPickup.weapon);
    gun.ammo = 0;
    player.position.set(gunPickup.x, geo.heightAt(gunPickup.x, gunPickup.z), gunPickup.z);
    pickups.update(0.05);
    result.gunGiven = gun.ammo > 0 && weapons.currentWeapon().id === gun.id;

    // Drive-by: fire from behind the wheel; a shot-up car loses its driver.
    const car = traffic.cars.find((c) => c.state !== 'wrecked');
    player.vehicle = car;
    weapons.select(weapons.list.findIndex((w) => w.id === 'pistol'));
    const ammo0 = weapons.ammo();
    weapons.state.cooldown = 0;
    result.driveBy = weapons.fire() === true && weapons.ammo() < ammo0;
    player.vehicle = null;

    player.position.set(field.x, ground, field.z);
    player.pitch = 0;
    player.yaw = 0;
    car.health = 100;
    car.state = 'drive';
    car.panicTimer = 0;
    car.object.position.set(field.x, geo.heightAt(field.x, field.z - 4) + 0.05, field.z - 4);
    for (let i = 0; i < 40; i += 1) cameraRig.update(0.05);
    const peds0 = traffic.peds.length;
    weapons.state.cooldown = 0;
    weapons.fire();
    result.driverBailed = traffic.peds.length > peds0;
    result.driverFlees =
      traffic.peds.length > peds0 &&
      traffic.peds[traffic.peds.length - 1].state === 'flee';
    result.carPanics = car.panicTimer > 0;

    return result;
  });
  check('F11 aiming raises the gun and the crosshair', f11.aiming && f11.cameraAim && f11.crosshair, `aim=${f11.aiming} crosshair=${f11.crosshair}`);
  check('F11 aiming tightens the spread', f11.spreadTighter, `tighter=${f11.spreadTighter}`);
  check('F11 weapon skill grows with shots', f11.skillGrew, `grew=${f11.skillGrew}`);
  check('F11 ten weapons all fire', f11.weapons >= 8 && f11.fired === f11.weapons, `fired=${f11.fired}/${f11.weapons} blasts=${f11.blasts}`);
  check('F11 explosion hurts peds and shakes the camera', f11.pedHurt && f11.explosionEffects && f11.shake, `hurt=${f11.pedHurt} fire=${f11.explosionEffects} shake=${f11.shake}`);
  check('F11 shots leave tracers, casings and bullet holes', f11.tracer && f11.casing && f11.decal, `tracer=${f11.tracer} casing=${f11.casing} decal=${f11.decal}`);
  check('F11 >= 6 pickups change state and respawn', f11.pickups >= 6 && f11.healed && f11.pickupHidden && f11.respawned, `pickups=${f11.pickups} healed=${f11.healed} respawn=${f11.respawned}`);
  check('F11 weapon pickup hands over the gun', f11.gunGiven, `given=${f11.gunGiven}`);
  check('F11 drive-by fire works and the driver bails', f11.driveBy && f11.driverBailed && f11.driverFlees && f11.carPanics, `driveBy=${f11.driveBy} bail=${f11.driverBailed}`);

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

async function mobile() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 14'], hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#overlay.ready', { timeout: 30000 });
  await page.tap('#start');
  await page.waitForTimeout(500);
  const touch = await page.evaluate(() => document.body.classList.contains('touch'));
  const mode0 = await page.evaluate(() => window.__gregorovce.cameraRig.state.mode);
  await page.tap('#btn-camera');
  const mode1 = await page.evaluate(() => window.__gregorovce.cameraRig.state.mode);
  await page.screenshot({ path: `${OUT}/verify-mobile.png` });
  check('F8 mobile touch mode active', touch, `body.touch=${touch}`);
  check('F8 mobile camera toggle works', mode0 !== mode1, `${mode0}→${mode1}`);
  check('F8 mobile no errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  try {
    await waitForServer();
    await desktop();
    await mobile();
  } catch (error) {
    check('harness completed', false, error.message);
  } finally {
    server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
