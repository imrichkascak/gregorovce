// Cheaty: kódy sa píšu na klávesnici (ako v GTA) a na mobile sa dajú ťuknúť
// v pauze na stránke „Cheaty“. Každý kód má programový efekt a HUD potvrdenie
// „CHEAT: …“. Kódy sú bez diakritiky a píšu sa malými písmenami.
export const CODES = [
  { id: 'zdravie', code: 'ZDRAVIE', label: 'Zdravie + vesta', hint: 'Doplní zdravie a vestu.' },
  { id: 'zbrane', code: 'ZBRANE', label: 'Všetky zbrane', hint: 'Dá všetky zbrane aj muníciu.' },
  { id: 'auto', code: 'AUTO', label: 'Auto', hint: 'Postaví auto na cestu pred teba.' },
  { id: 'pocasie', code: 'POCASIE', label: 'Počasie', hint: 'Prehodí počasie.' },
  { id: 'hodiny', code: 'HODINY', label: 'Čas +6 h', hint: 'Posunie hodiny o 6 hodín.' },
  { id: 'policia', code: 'POLICIA', label: 'Policia dole', hint: 'Zmaže hviezdy.' },
  { id: 'peniaze', code: 'PENIAZE', label: '+10 000 €', hint: 'Pridá peniaze.' },
  { id: 'let', code: 'LET', label: 'Lietanie', hint: 'Zapne alebo vypne lietanie.' },
];

/** Do bufferu sa ukladajú len písmená a číslice (max 12 znakov). */
export function pushKey(buffer, key) {
  const clean = String(key ?? '').toLowerCase();
  if (!/^[a-z0-9]$/.test(clean)) return buffer;
  return (buffer + clean).slice(-12);
}

/** Vráti id kódu, ktorého sekvencia je na konci bufferu, inak null. */
export function matchCode(buffer, codes = CODES) {
  const text = String(buffer ?? '').toLowerCase();
  if (!text) return null;
  for (const entry of codes) {
    if (text.endsWith(entry.code.toLowerCase())) return entry.id;
  }
  return null;
}

/**
 * Cheaty napojené na hru. Efekty menia stav hry (zdravie, zbrane, auto, počasie,
 * čas, hviezdy, peniaze, lietanie) a vracajú text potvrdenia pre HUD.
 */
export function createCheats({ player, weapons, wanted, weather, dayNight, traffic, audio }) {
  const state = { buffer: '', toast: '', toastTimer: 0, used: 0, lastId: null };

  const effects = {
    zdravie() {
      player.health = 100;
      player.armor = 100;
      return 'CHEAT: ZDRAVIE + VESTA';
    },
    zbrane() {
      for (const weapon of weapons.list) {
        if (weapon.ammo !== Infinity) weapons.addAmmo(weapon.id, 400);
      }
      const index = weapons.list.findIndex((weapon) => weapon.id === 'ak');
      if (index >= 0) weapons.select(index);
      return 'CHEAT: VŠETKY ZBRANE';
    },
    auto() {
      const unit = traffic.spawnCar(player.position.x, player.position.z);
      return unit ? 'CHEAT: AUTO NA CESTE' : 'CHEAT: AUTO — NENAŠIEL CESTU';
    },
    pocasie() {
      weather.cycle();
      return `CHEAT: POČASIE ${String(weather.state.name).toUpperCase()}`;
    },
    hodiny() {
      dayNight.setTime(dayNight.state.time + 360);
      return 'CHEAT: ČAS +6 HODÍN';
    },
    policia() {
      wanted.clear();
      return 'CHEAT: POLÍCIA DOLE';
    },
    peniaze() {
      player.money += 10000;
      return 'CHEAT: +10 000 €';
    },
    let() {
      player.setFlying(!player.flying);
      return player.flying ? 'CHEAT: LIETANIE ZAP' : 'CHEAT: LIETANIE VYP';
    },
  };

  /** Spustí cheat podľa id (napr. z klávesnice alebo z pauzy na mobile). */
  function activate(id) {
    const effect = effects[id];
    if (!effect) return false;
    state.toast = effect();
    state.toastTimer = 3;
    state.lastId = id;
    state.used += 1;
    if (audio) audio.playSfx('pickup');
    return true;
  }

  /** Písmená z klávesnice: keď buffer skončí kódom, cheat sa spustí. */
  function handleKey(key) {
    const next = pushKey(state.buffer, key);
    if (next === state.buffer) return null;
    state.buffer = next;
    const id = matchCode(state.buffer, CODES);
    if (!id) return null;
    state.buffer = '';
    activate(id);
    return id;
  }

  function update(dt) {
    if (state.toastTimer > 0) state.toastTimer -= dt;
  }

  /** Riadky pre stránku „Cheaty“ v pauze (dotykový ekvivalent). */
  function rows() {
    return CODES.map((entry) => ({ ...entry }));
  }

  return { state, codes: CODES, activate, handleKey, update, rows };
}
