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
| `W` `A` `S` `D` | chôdza / jazda autom v smere kamery (vpravo = vpravo, svetlá napred) |
| myš | rozhľad (3. osoba), `ľavé` = úder / streľba, `pravé` = mierenie (crosshair, kamera cez rameno) |
| `Shift` | beh, kým vydrží stamina |
| `Space` | skok (v aute brzda) |
| `C` | prepni kameru 3. / 1. osoba |
| `E` | vstúp / vystúp z najbližšieho auta |
| `1`–`0` | prepni zbraň (päsť, nôž, bejzbal, pištoľ, brokovnica, samopal, AK-47, ostreľovačka, granát, molotov) |
| `V` | prepni počasie (jasno / zamračené / dážď) |
| `T` | rádio zap/vyp (predvolene ticho) |
| `Q` | ďalšia stanica (6 rádií so žánrom) |
| `Z` | **úplné vypnutie zvuku** (master mute, predvolene stlmené) |
| `M` | dedinský tón zap/vyp (predvolene ticho) |
| `B` | úplatok (zníž wanted level) |
| `R` | pád zhora na cestu pred kostol |
| `F` | rozhovor / prijmi quest (voľby aj `1`–`9`), vstup do budovy a výstup z nej |
| `F5` / `F9` | ulož / načítaj hru |
| `Esc` | pauza (menu, questy, štatistiky, cheaty) |
| písanie kódov | cheaty: `ZDRAVIE`, `ZBRANE`, `AUTO`, `POCASIE`, `HODINY`, `POLICIA`, `PENIAZE`, `LET` |

**Systémy:** viditeľná postava v 3. osobe s animáciami, deň/noc a počasie, **úplné
vypnutie zvuku (master mute — hra začína v úplnom tichu, `Z` / `🔊` ho zapne)**,
**rádio
(6 staníc so žánrom — Playback FM, K-DST, Radio Los Santos, Rádio Gregorovce,
Hornád Country, Košický dych — DJ hlásenia a reklamy medzi skladbami, prepínanie
klávesou `Q` a dotykovou stránkou „Rádio“ v pauze, popis v HUD)**,
jazditeľné autá, zbrane a boj (melee kombo, knockdown, krv), bitky s NPC
(chuligáni sa bránia), **10 zbraní** (päsť, nôž, bejzbal, pištoľ, brokovnica,
samopal, AK-47, ostreľovačka, granát, molotov) s mierením, crosshairom a kamerou
cez rameno a **vlastným zvukom pre každú strelnú zbraň**, **efekty streľby** (tracery, nábojnice, diery po guľkách, výbuchy),
**pickupy** zbraní/munície/zdravia/armoru s respawnom, **drive-by** z auta
(zasiahnutý vodič vyskočí a utečie), zdravie a armor hráča, WASTED smrť
s respawnom v nemocnici, **polícia** (hliadky s blikajúcou sirénou, peší policajti
strieľajú a zatknú ťa s pokutou a BUSTED overlayom, zátarasy od 4 hviezd, hviezdy
chladnú v úkryte, lakovacia garáž pri obchode zmaže wanted, motorky a bicykle
v doprave, carjacking), misijné markery a obchody, **questy a dialógy** (12 questov,
10 pomenovaných postáv, quest log v pauze, waypoint na radare, rešpekt, reťaze,
3 uličné misie, 10 fliaš), **interiéry** (kostol, krčma, obchod a úrad — vstup
cez `F` pri budove, vlastná miestnosť s NPC a interakciou, výstup späť von),
**štatistiky hráča** (14 počítadiel — čas, km pešo/autom, questy, misie, bitky, KO,
zločiny, hviezdy, zatknutia, smrti, autá, zárobok/útrata — stránka v pauze so
živými hodnotami), **cheaty** (8 kódov písaných na klávesnici — `ZDRAVIE`,
`ZBRANE`, `AUTO`, `POCASIE`, `HODINY`, `POLICIA`, `PENIAZE`, `LET` — s HUD
potvrdením „CHEAT: …“ a dotykovou stránkou „Cheaty“ v pauze), **živý svet**
(48 áut a 61 chodcov v dedine, **12 zvierat — sliepky a psy**, ktoré sa túlajú
okolo kotiev, a **skupinky NPC** — chuligáni pri krčme, babky pred kostolom —
s vlastnou animáciou), **výkon** (draw calls v dedine pod 200 a FPS ≥ 50 aj s touto
hustotou: autá, chodci a zvieratá sú zlúčené či inštancované, efekty poolované),
save/load, PS2 bloom.

**Mobil / dotykové zariadenia:** hra sa spustí bez pointer locku — vľavo sa
plávajúcim joystickom pohybuješ, ťahaním po pravej časti obrazovky sa rozhliadaš,
tlačidlá `KAM` (kamera), `E` (auto), `🔫` (úder / streľba), `🎯` (mierenie),
`ZB` (zbraň), `💬` (rozhovor / vstup do budovy), `↑` / `↓` / `FLY` / `🔊` (zvuk zap/vyp) / `R` vpravo dole, `MENU`
vľavo hore sa vráti do menu. V pauze je aj stránka **„Rádio“** s tlačidlom pre každú
stanicu (a zapnutím/vypnutím rádia), takže sa stanice dajú prepínať aj na mobile.
Dotyková parita je overená pre **každý systém** — mierenie, voľby dialógu, pickupy,
interiéry aj cheaty (verify beží na emulácii iPhone 14); voľby dialógu sú kvôli tomu
nad dotykovou vrstvou (`z-index: 6`), inak by sa na mobile nedali ťuknúť.

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
6. `traffic.js` — nízko-polygónové autá, motorky a bicykle, ktoré sa pohybujú po
   cestách (spomaľujú a trúbia pred hráčom, chodci uskakujú), chodci reagujú na
   útoky (stagger, knockdown, vstanú), chuligáni sa bijú, autá zrážajú hráča a
   pri 0 HP vybuchnú. Hustota je sústredená do dediny (48 áut, 61 chodcov) a
   vizuál je **inštancovaný** — autá kreslia dva spoločné meshe (karoséria s
   `instanceColor` + svetlá), chodci šesť (`InstancedMesh` po dieloch: torso,
   hlava, nohy, ruky), takže celá doprava stojí pár draw callov. Skupinky NPC
   stoja v kruhu pri krčme (chuligáni) a pred kostolom (babky) a debatia;
   `animals.js` (+ `animals-core.js` s unit testami) pridáva **12 zvierat** —
   sliepky pri žumpe a kostole, psy pri obchode, krčme, škole, hasičoch, ihrisku
   a úrade — ako zlúčené low-poly meshe s vertex colors, ktoré sa túlajú okolo
   svojej kotvy.
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
17. `audio.js` — procedurálny WebAudio: **hra začína s úplne stlmeným zvukom**
    (`Z` / tlačidlo `🔊` zapne celý zvuk, zapnutie rádia či dedinského tónu ho
    odtlní), dedinský tón (`M`),
    **6 rádií** (Playback FM, K-DST, Radio Los Santos, Rádio Gregorovce, Hornád
    Country, Košický dych) s DJ hláseniami a reklamami medzi skladbami, vlastný
    zvuk pre každú strelnú zbraň a motor podľa typu vozidla.
18. `radio-core.js` — čistá logika rádia (stanice so žánrom, plán beatov, DJ
    hlásenia a reklamy, prepínanie staníc) + unit testy.
19. `combat.js` — čistá logika boja (armor pohltenie, melee kužeľ, combo okno) + unit testy.
20. `weapons.js` — 10 zbraní (melee, strelné, granát/molotov), mierenie, spread,
    projektily a výbuchy, drive-by, vlastný zvuk pre každú strelnú zbraň.
21. `effects.js` — poolované častice (krv, dym, oheň, iskry, nábojnice), tracery,
    diery po guľkách (InstancedMesh), 1 draw call na druh.
22. `pickups.js` — plávajúce pickupy zbraní/munície/zdravia/armoru s respawnom.
23. `quests-core.js` — čistý stavový automat questov (fázy, fail/retry, reťaze) + unit testy.
24. `dialogue.js` — dialógové okno s číslovanými voľbami (klik/tap/`1`–`9`).
25. `quests.js` — 12 questov, 10 quest giverov s menovkou a bublinou, quest log,
    radar waypoint, rešpekt, 3 uličné misie, 10 fliaš.
26. `interiors.js` — interiéry: kostol, krčma, obchod a úrad (vlastná miestnosť
    s NPC a interakciou, menovka „F vstup“ pri budove, výstup späť pred budovu).
27. `stats.js` — štatistiky hráča: 14 počítadiel (čas, km pešo/autom, questy,
    misie, bitky, KO, zločiny, hviezdy, zatknutia, smrti, autá, zárobok/útrata)
    + unit testy, uloženie do localStorage.
28. `cheats.js` — 8 cheatov písaných na klávesnici (ZDRAVIE, ZBRANE, AUTO,
    POCASIE, HODINY, POLICIA, PENIAZE, LET) s HUD potvrdením „CHEAT: …“
    a dotykovou stránkou „Cheaty“ v pauze.
29. `vehicles.js` — vstup do auta/motorky/bicykla (carjack — vodič vyskočí a utečie)
    a jazda s fyzikou podľa typu.
30. `wanted.js` — wanted level: hliadky s blikajúcou sirénou, peší policajti (streľba,
    zatknutie s pokutou a BUSTED overlayom), zátarasy od 4 hviezd, chladenie hviezd
    v úkryte a lakovacia garáž pri obchode.
31. `missions.js` — misijné markery, obchody, save/load.
32. `postfx.js` — jemný PS2 bloom (EffectComposer).
33. `rules.js` — čisté herné helpery (hodiny, hviezdy, peniaze) + unit testy.
34. `main.js` — poskladá scénu, HUD a herný loop.

Všetko je zlúčené do niekoľkých meshov, takže scéna zvládne aj slabší stroj.

## Ďalší vývoj

`ENGINE-PLAN.md` — návrh (zatiaľ len plán, nič z neho nie je implementované), čo ďalej
s enginom a architektúrou: modernizácia na mieste (Vite + TypeScript + Rapier + fixný
timestep), porovnanie s Babylon.js / PlayCanvas / Godot 4 web exportom, odporúčanie
a go/no-go kritériá pre prípadný Godot spike.

## Overenie

```bash
npm test        # unit testy (motion, rules, combat, quests-core, stats, cheats, radio-core, animals-core)
npm run verify  # server + Playwright assertions pre všetky fázy (GTA-SA-PLAN.md, GTA-SA-PLAN-2.md)
```

`npm run verify` prejde všetkých **121 checkov** (F0–F14) — od sveta a ovládania cez
questy, interiéry, cheaty a rádio až po hustotu sveta a výkon: dedina má 48 áut a
61 chodcov, 12 zvierat a dve skupinky NPC, drží sa pod 200 draw callov
(`max=164`) a nad 50 FPS (`fps≈59`, merané rAF counterom za 4 s). Na macOS sa
headless Chromium spúšťa s `--use-angle=metal`, inak renderuje softvérovo (~3 FPS) a
FPS check by nemal zmysel. Dotyková časť beží na emulácii iPhone 14 a overuje
paritu pre mierenie, dialóg, pickupy, interiéry a cheaty.

Záverečný prehľad (čo je hotové, rubrika V2, zoznam questov, čo ostáva mimo
rozsah) je v `FINAL-REPORT.md`.

## Licencie a atribúcia

- Mapové dáta: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Výškopis: Mapzen Terrarium tiles, © Mapzen / AWS Open Data (SRTM, EU-DEM a i.).
- 3D knižnica: [three.js](https://threejs.org/) (MIT).
