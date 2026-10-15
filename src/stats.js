// Štatistiky hráča: čistá logika (počítadlá a formátovanie) + tracker napojený
// na hru. Čisté funkcie nemajú three.js ani DOM, takže sa dajú unit-testovať.
export function createStats() {
  return {
    playTime: 0, // sekundy hry
    walked: 0, // metre pešo
    driven: 0, // metre autom
    quests: 0,
    missions: 0,
    fights: 0, // údery do NPC
    kos: 0, // poslané na zem / dole
    crimes: 0,
    maxStars: 0,
    arrests: 0,
    deaths: 0,
    carsStolen: 0,
    moneyEarned: 0,
    moneySpent: 0,
  };
}

/** Zapíše prejdenú vzdialenosť (pešo alebo autom). */
export function trackDistance(stats, dt, { onFoot, speed }) {
  const metres = Math.max(0, speed) * Math.max(0, dt);
  if (onFoot) stats.walked += metres;
  else stats.driven += metres;
  return metres;
}

/** Zapíše zmenu peňazí (kladná = zárobok, záporná = útrata). */
export function addMoney(stats, delta) {
  if (delta > 0) stats.moneyEarned += delta;
  else if (delta < 0) stats.moneySpent -= delta;
  return stats.moneyEarned - stats.moneySpent;
}

/** Zapíše zločin a najvyšší dosiahnutý wanted level. */
export function noteCrime(stats, level) {
  stats.crimes += 1;
  if (level > stats.maxStars) stats.maxStars = level;
  return stats.crimes;
}

/** „320 m“ / „1,4 km“. */
export function formatDistance(metres) {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(metres)} m`;
}

/** „45 s“ / „12 min“ / „1 h 05 min“. */
export function formatPlayTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

/** Riadky stránky „Štatistiky“ v pauze — s živými hodnotami zo hry. */
export function statsRows(stats, live = {}) {
  return [
    { label: 'Čas hry', value: formatPlayTime(stats.playTime) },
    { label: 'Odchodené', value: formatDistance(stats.walked) },
    { label: 'Najazdené', value: formatDistance(stats.driven) },
    { label: 'Questy', value: `${stats.quests} splnených` },
    { label: 'Misie', value: `${stats.missions} splnených` },
    { label: 'Bitky', value: `${stats.fights} úderov, ${stats.kos} KO` },
    { label: 'Zločiny', value: `${stats.crimes} (max ${stats.maxStars}★)` },
    { label: 'Zatknutia', value: String(stats.arrests) },
    { label: 'Smrti', value: String(stats.deaths) },
    { label: 'Ukradnuté autá', value: String(stats.carsStolen) },
    { label: 'Zarobil', value: `${Math.round(stats.moneyEarned)} €` },
    { label: 'Minul', value: `${Math.round(stats.moneySpent)} €` },
    { label: 'Rešpekt', value: String(live.respect ?? 0) },
    { label: 'Peniaze', value: `${Math.floor(live.money ?? 0)} €` },
    { label: 'Hviezdy', value: `${live.stars ?? 0}/6` },
    { label: 'Zdravie', value: `${Math.round(live.health ?? 100)}` },
  ];
}

/**
 * Tracker napojený na hru: sleduje čas, vzdialenosť, peniaze, zločiny, zatknutia,
 * smrti a počet splnených questov/misií. Ukladá sa do localStorage.
 */
export function createStatsTracker({
  player,
  wanted,
  quests,
  missions,
  vehicleSpeed = () => 0,
  storageKey = 'gregorovce.stats',
}) {
  const stats = createStats();
  const koTargets = new WeakSet();
  const stolenCars = new WeakSet();
  let lastMoney = null;
  let lastStars = 0;
  let lastBusted = false;
  let lastDead = false;
  let scanTimer = 0;

  function update(dt) {
    stats.playTime += dt;

    const onFoot = !player.vehicle;
    const speed = onFoot ? (player.currentSpeed ?? 0) : Math.abs(vehicleSpeed() ?? 0);
    trackDistance(stats, dt, { onFoot, speed });

    // Peniaze: odmeny, nákupy, pokuty, úplatky — všetko prejde cez rozdiel.
    if (lastMoney === null) lastMoney = player.money;
    const delta = player.money - lastMoney;
    if (Math.abs(delta) >= 0.5) {
      addMoney(stats, delta);
      lastMoney = player.money;
    }

    // Zločiny: každé zvýšenie wanted levelu.
    const stars = wanted.state.level;
    if (stars > lastStars) noteCrime(stats, stars);
    lastStars = stars;

    const busted = !!wanted.state.busted;
    if (busted && !lastBusted) stats.arrests += 1;
    lastBusted = busted;

    const dead = !!player.dead;
    if (dead && !lastDead) stats.deaths += 1;
    lastDead = dead;

    // Ukradnuté auto (po carjackingu) — každé len raz.
    const ride = player.vehicle;
    if (ride && ride.state === 'stolen' && !stolenCars.has(ride)) {
      stolenCars.add(ride);
      stats.carsStolen += 1;
    }

    // Questy a misie stačí prepočítať raz za sekundu.
    scanTimer -= dt;
    if (scanTimer <= 0) {
      scanTimer = 1;
      const done = quests.log().filter((row) => row.status === 'completed').length;
      stats.quests = done;
      stats.missions = missions.state.completed.length;
    }
  }

  /** Úder do NPC — počíta sa do bitiek. */
  function noteFight() {
    stats.fights += 1;
    return stats.fights;
  }

  /** Poslaný NPC na zem: +1 KO a +1 rešpekt. Každý cieľ len raz. */
  function noteKO(target) {
    if (target && koTargets.has(target)) return false;
    if (target) koTargets.add(target);
    stats.kos += 1;
    player.respect += 1;
    return true;
  }

  function rows() {
    return statsRows(stats, {
      money: player.money,
      respect: player.respect,
      stars: wanted.state.level,
      health: player.health,
    });
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(stats));
    } catch {
      /* súkromný režim — štatistiky sa proste neuložia */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      Object.assign(stats, createStats(), JSON.parse(raw));
      return true;
    } catch {
      return false;
    }
  }

  return { stats, update, noteFight, noteKO, rows, save, load };
}
