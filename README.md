# Gregorovce 3D — GTA San Andreas edícia

Interaktívna 3D hra v prehliadači: obec **Gregorovce** (okres Prešov) pretvorená do
štýlu **GTA: San Andreas** — terén, budovy, cesty, potoky a lesy z reálnych
otvorených dát, ale s hrateľnosťou: postava v 3. osobe, autá, zbrane, wanted level
s políciou, misie, obchody, deň/noc, počasie a rádio.

Vizuál je ladený do GTA San Andreas: pastelový štuk, nízke škridlové strechy,
sivý asfalt s dvojitou žltou čiarou a červenými obrubníkmi, palmy, suchý trávnik
a bledá prašná obloha. Mapa aj ulice ostávajú Gregorovce.

## Spustenie

Potrebuješ Node.js (na obnovu dát) a ľubovoľný statický server. Projekt nemá build krok.

```bash
npm install          # len raz (pngjs pre sťahovanie výšok)
npm start            # spustí http://localhost:5173
```

Otvor `http://localhost:5173` a klikni na **PLAY**.

## Ovládanie

| Klávesa | Akcia |
| --- | --- |
| `W` `A` `S` `D` | chôdza / jazda autom (pohľadom kamery, s rozbehom a zastavením) |
| myš | rozhľad (3. osoba), `klik` = streľba |
| `Shift` | beh, kým vydrží stamina |
| `Space` | skok (v aute brzda) |
| `C` | prepni kameru 3. / 1. osoba |
| `E` | vstúp / vystú z najbližšieho auta |
| `1`–`4` | prepni zbraň (päsť, bejzbal, pištoľ, samopal) |
| `V` | prepni počasie (jasno / zamračené / dážď) |
| `T` | rádio zap/vyp |
| `B` | úplatok (zníž wanted level) |
| `R` | pád zhora na cestu pred kostol |
| `F5` / `F9` | ulož / načítaj hru |
| `Esc` | pauza (menu) |

**Systémy:** viditeľná postava v 3. osobe s animáciami, deň/noc a počasie, rádio,
jazditeľné autá, zbrane a boj, wanted level s políciou, misijné markery a obchody,
save/load, PS2 bloom.

**Mobil / dotykové zariadenia:** hra sa spustí bez pointer locku — vľavo sa
plávajúcim joystickom pohybuješ, ťahaním po pravej časti obrazovky sa rozhliadaš,
tlačidlá `KAM` (kamera), `E` (auto), `🔫` (streľba), `ZB` (zbraň), `↑` / `↓` / `FLY` /
`R` vpravo dole, `MENU` vľavo hore sa vráti do menu.

## Ako to funguje

Dáta sa sťahujú raz a ukladajú do `data/`:

```bash
npm run fetch:osm        # budovy, cesty, potoky, lesy z OpenStreetMap
npm run fetch:elevation  # výškový model z Mapzen/Terrarium dlaždíc
npm run fetch:all        # oboje naraz
```

- **`data/gregorovce-osm.json`** — hranice obce (OSM relation `2320226`) a všetky
  `building`, `highway`, `waterway`, `landuse=forest`, `natural=wood` cesty.
- **`data/heightmap.json`** — pravidelná mriežka výšok (321 × 257 bodov, krok ~9,7 m)
  zložená z dlaždíc `elevation-tiles-prod/terrarium` (Mapzen / AWS Open Data).

Klient (`src/`) potom:

1. `geo.js` — prevedie lat/lon na lokálne metre a bilineárne vzorkuje výšku terénu.
2. `osm.js` — rozdelí OSM dáta na vrstvy, odvodí výšky budov (`height`,
   `building:levels`, alebo rozumný default) a rozpozná významné budovy/POI.
3. `textures.js` — procedurálne textúry: fasáda s oknami, tabule obchodu/krčmy, štítky.
4. `roof.js` — sedlová strecha na minimálnom obdĺžniku budovy (aby domy vyzerali
   ako domy, nie ako hranoly).
5. `buildings.js` — postaví domy (steny + sedlová strecha), kostol s vežou, ihlou
   a krížom (veža smeruje k ceste), a tabule pre obchod/krčmu. Dom č. 101 sa
   do statického mesh-u nedáva — ten rozbíja `gags.js`.
6. `traffic.js` — nízko-polygónové autá a chodci, ktorí sa pohybujú po cestách.
7. `gags.js` — dedinské scény v slučke: výbuch domu 101, Paly pridržiava Banana
   pred kostolom kým ho prejde auto, žumpa z bytovky 217 cez cestu do jarku.
8. `labels.js` — plávajúce menovky (kostol, obchod, krčma, obecný úrad…).
9. `world.js` — poskladá terén, cesty s čiarami a chodníkmi, pouličné lampy, potoky,
   polia, ihriská, palmy, dopravu, štítky, oblohu a slnko.
10. `motion.js` — zdieľaná horizontálna fyzika (rozbeh, trenie, vzduch).
11. `player.js` — first-person/3rd-person ovládač (gravitácia, kolízia, stamina, pád z neba).
12. `avatar.js` — CJ-style postava s procedurálnymi animáciami (idle/chôdza/beh/skok).
13. `camera-rig.js` — kamera 3. osoby s kolíziou, zoomom a mierením.
14. `radar.js` — otáčavý radar s blipmi POI, severkou a zónou.
15. `daynight.js` — cyklus dňa/noci, slnko a pouličné svetlá.
16. `weather.js` — počasie (jasno/zamračené/dážď).
17. `audio.js` — procedurálny WebAudio: ambient, 3 rádiá, kroky/motor/výstrel.
18. `weapons.js` — inventár zbraní, streľba, reakcie chodcov/áut.
19. `vehicles.js` — vstup do auta a jazda.
20. `wanted.js` — wanted level a policajná naháňačka.
21. `missions.js` — misijné markery, obchody, save/load.
22. `postfx.js` — jemný PS2 bloom (EffectComposer).
23. `rules.js` — čisté herné helpery (hodiny, hviezdy, peniaze) + unit testy.
24. `main.js` — poskladá scénu, HUD a herný loop.

Všetko je zlúčené do niekoľkých meshov, takže scéna zvládne aj slabší stroj.

## Overenie

```bash
npm test        # unit testy (motion, rules)
npm run verify  # server + Playwright assertions pre všetky fázy (GTA-SA-PLAN.md)
```

## Licencie a atribúcia

- Mapové dáta: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Výškopis: Mapzen Terrarium tiles, © Mapzen / AWS Open Data (SRTM, EU-DEM a i.).
- 3D knižnica: [three.js](https://threejs.org/) (MIT).
