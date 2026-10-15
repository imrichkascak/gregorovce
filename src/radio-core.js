// Čistá logika rádia: stanice so žánrom, plán skladieb a DJ/reklamné vstupy.
// Bez DOM a bez WebAudio, aby sa dala testovať unit testami (rádio si ju len
// prehráva: noty cez oscilátor, hlásenia cez „reč“ a HUD popis).
export const TALK_EVERY = 24; // beatov na jednu „skladbu“, potom DJ alebo reklama

export const STATIONS = [
  {
    id: 'playback',
    name: 'Playback FM',
    genre: 'west coast',
    root: 220,
    scale: [0, 2, 4, 7, 9],
    tempo: 3.2,
    wave: 'triangle',
    dj: [
      'Tu je Playback FM — Gregorovce, kde každá skladba vonia po hnoji.',
      'Sused, dnes hráme pre celú dedinu aj pre Palyho kravín.',
    ],
    ads: [
      'Reklama: Krčma u Palyho — pivo o dve koruny lacnejšie, keď prinesieš vlastnú fľašu.',
      'Reklama: Hasiči Gregorovce — prídeme vždy, keď už nehorí.',
    ],
  },
  {
    id: 'kdst',
    name: 'K-DST',
    genre: 'klasický rock',
    root: 174,
    scale: [0, 3, 5, 7, 10],
    tempo: 2.4,
    wave: 'sawtooth',
    dj: [
      'K-DST — rock, ktorý prehluší aj cirkulárku za humnom.',
      'Drž sa, ide riff, čo prebudí aj kohúta na dvore.',
    ],
    ads: [
      'Reklama: Obchod u Baču — vesta z druhej ruky, ešte po dedovi, len za 100 eur.',
      'Reklama: Žumpa 217 — vývoz, ktorý nezapácha, lebo je v tom fľaša.',
    ],
  },
  {
    id: 'rls',
    name: 'Radio Los Santos',
    genre: 'gangsta rap',
    root: 262,
    scale: [0, 2, 3, 7, 8],
    tempo: 4.2,
    wave: 'square',
    dj: [
      'Los Santos v Gregovciach — rap z betónu aj z dvora.',
      'Tu je tvoj chlapec z ulice, čo pozná každú žumpu.',
    ],
    ads: [
      'Reklama: Fľaše u Mata — dve za cenu jednej, tretia zadarmo.',
      'Reklama: Autoservis Banán — opravíme aj to, čo už sused vzdal.',
    ],
  },
  {
    id: 'gregorovce',
    name: 'Rádio Gregorovce',
    genre: 'dedinská ľudovka',
    root: 196,
    scale: [0, 2, 4, 5, 7, 9],
    tempo: 2.6,
    wave: 'triangle',
    dj: [
      'Hrá Rádio Gregorovce — ľudovky, pri ktorých sa tancuje aj pri žumpe.',
      'Susedia, dnes hráme pre tancovačku v kultúrnom dome.',
    ],
    ads: [
      'Reklama: Kultúrny dom — tancovačka v sobotu, aj pre tých, čo len prizerajú.',
      'Reklama: Zvonár Kostolník — zvoní presne, aj keď je vietor.',
    ],
  },
  {
    id: 'hornad',
    name: 'Hornád Country',
    genre: 'country',
    root: 233,
    scale: [0, 2, 4, 7, 9],
    tempo: 2.2,
    wave: 'sine',
    dj: [
      'Toto je Hornád Country, kde sa pesničky nesú dolinou.',
      'Country, pri ktorom sa aj kone na paši upokoja.',
    ],
    ads: [
      'Reklama: Krčma pri moste — guláš, čo udrží aj traktoristu.',
      'Reklama: Obchod u Baču — soľ, ocot a fľaše pre celú rodinu.',
    ],
  },
  {
    id: 'kosicky',
    name: 'Košický dych',
    genre: 'dychovka',
    root: 207,
    scale: [0, 3, 5, 7, 10],
    tempo: 3.6,
    wave: 'square',
    dj: [
      'Košický dych — dychovka, čo rozozvučí aj umieráčik.',
      'Pripravte sa, dychovka ide ako cez kostolný zvon.',
    ],
    ads: [
      'Reklama: Púť v Gregovciach — klobásy aj pre tých, čo len prišli.',
      'Reklama: Obecný úrad — otvorené vždy, keď úradník nie je na poli.',
    ],
  },
];

/** Vráti stanicu na danom indexe (index sa zacyklí na obe strany). */
export function stationAt(index) {
  return STATIONS[((index % STATIONS.length) + STATIONS.length) % STATIONS.length];
}

/** Plán rádia: ktorá stanica hrá, koľký beat a koľká „skladba“ beží. */
export function createRadioPlan({ talkEvery = TALK_EVERY } = {}) {
  return {
    station: 0,
    beat: 0,
    song: 0,
    talks: 0,
    line: { dj: 0, ad: 0 },
    talkEvery,
    kind: 'note',
    text: null,
    lastTalk: null,
    lastText: null,
  };
}

/**
 * Posunie plán o jeden beat a vráti, čo sa má hrať: buď nota (frekvencia
 * podľa stupnice stanice), alebo vstup — DJ hlásenie a reklama sa striedajú.
 */
export function advance(plan) {
  plan.beat += 1;
  const station = stationAt(plan.station);
  if (plan.beat % plan.talkEvery === 0) {
    const kind = plan.song % 2 === 0 ? 'dj' : 'ad';
    const lines = kind === 'dj' ? station.dj : station.ads;
    // DJ aj reklamy majú vlastný počítadlo riadkov, inak by parita vždy
    // vybrala ten istý text (každý druhý vstup).
    const index = plan.line[kind];
    const text = lines[index % lines.length];
    plan.talks += 1;
    plan.song += 1;
    plan.line[kind] += 1;
    plan.kind = kind;
    plan.text = text;
    // Posledné hlásenie prežíva aj ďalšie noty (HUD ho ešte chvíľu ukazuje).
    plan.lastTalk = kind;
    plan.lastText = text;
    return {
      kind,
      text,
      station: plan.station,
      name: station.name,
      genre: station.genre,
      song: plan.song,
      talk: plan.talks,
    };
  }
  const semi = station.scale[plan.beat % station.scale.length];
  plan.kind = 'note';
  plan.text = null;
  return {
    kind: 'note',
    frequency: station.root * Math.pow(2, semi / 12),
    station: plan.station,
    name: station.name,
    genre: station.genre,
    beat: plan.beat,
  };
}

/** Prepne stanicu (index sa zacyklí) a vynuluje beat — skladba začína odznova. */
export function setStation(plan, index) {
  plan.station = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
  plan.beat = 0;
  plan.line = { dj: 0, ad: 0 };
  plan.kind = 'note';
  plan.text = null;
  plan.lastTalk = null;
  plan.lastText = null;
  return stationAt(plan.station);
}

/** Ďalšia stanica v poradí. */
export function nextStation(plan) {
  return setStation(plan, plan.station + 1);
}

/** Riadky pre dotykovú stránku „Rádio“ v pauze. */
export function stationRows() {
  return STATIONS.map((station, index) => ({ index, name: station.name, genre: station.genre }));
}
