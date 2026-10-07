# Gregorovce 3D

Interaktívna 3D vizualizácia obce **Gregorovce** (okres Prešov) v prehliadači — voľná
prechádzka svetom ako v hre. Terén, budovy, cesty, potoky a lesy sú postavené
z reálnych otvorených dát.

Vizuálny štýl je ladený do teplej, zahmlenej estetiky klasických akčných hier —
suchá olivová vegetácia, pieskové fasády s terakotovými strechami, jantárové
slnko, smogová hmla a kruhový radar v HUD.

## Spustenie

Potrebuješ Node.js (na obnovu dát) a ľubovoľný statický server. Projekt nemá build krok.

```bash
npm install          # len raz (pngjs pre sťahovanie výšok)
npm start            # spustí http://localhost:5173
```

Otvor `http://localhost:5173` a klikni na **Vstúpiť do sveta**.

## Ovládanie

| Klávesa | Akcia |
| --- | --- |
| `W` `A` `S` `D` | pohyb |
| myš | rozhľad |
| `Shift` | beh |
| `Space` | skok (v lete režime: hore) |
| `Ctrl` | klesanie (v lete režime) |
| `F` | prepni režim chôdza / let |
| `Esc` | uvoľnenie myši |

**Mobil / dotykové zariadenia:** hra sa spustí bez pointer locku — vľavo sa
plávajúcim joystickom pohybuješ, ťahaním po pravej časti obrazovky sa rozhliadaš,
tlačidlá `SKOK` / `↓` / `LET` vpravo dole ovládajú skok a lietanie, `MENU`
vľavo hore sa vráti do menu.

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
   a krížom (veža smeruje k ceste), a tabule pre obchod/krčmu.
6. `traffic.js` — nízko-polygónové autá a chodci, ktorí sa pohybujú po cestách.
7. `labels.js` — plávajúce menovky (kostol, obchod, krčma, obecný úrad…).
8. `world.js` — poskladá terén, cesty s čiarami a chodníkmi, potoky, polia, ihriská,
   lesy, dopravu, štítky, oblohu a slnko.
9. `player.js` — first-person ovládač (pointer lock, gravitácia, kolízia s budovami).
10. `main.js` — poskladá scénu, HUD a minimapu.

Všetko je zlúčené do niekoľkých meshov, takže scéna má okolo 160 draw call-ov a zvládne
aj slabší stroj.

## Licencie a atribúcia

- Mapové dáta: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Výškopis: Mapzen Terrarium tiles, © Mapzen / AWS Open Data (SRTM, EU-DEM a i.).
- 3D knižnica: [three.js](https://threejs.org/) (MIT).
