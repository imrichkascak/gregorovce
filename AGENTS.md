# Poznámky pre agentov (Gregorovce 3D)

## Mapa vizuálneho štýlu

Farby a atmosféra sú rozhádzané do viacerých súborov — pri zmene vizuálu prejdi
všetky tieto miesta, inak svet pôsobí nekonzistentne:

| Súbor | Čo sa tam ladí |
| --- | --- |
| `src/world.js` | Konštanty `HORIZON`, `GRASS_LOW/HIGH`, `ROCK`, `FOREST_FLOOR`, `FIELD`, `TREE_COLORS`; `buildSky()` (uniformy `topColor`/`horizonColor`/`sunColor`, sun + glow halo); `createWorld()` — `scene.fog`, hemisphere a slnečné svetlo; farby ciest, vody a ihrísk |
| `src/buildings.js` | `WALL_COLORS`, `ROOF_COLORS`, `KIND_COLORS` (kostol, obchod, krčma…) |
| `src/textures.js` | `facadeTexture()` — základná farba fasády, sklo okien, rámy |
| `src/main.js` | `drawMinimap()` (paleta radaru), `drawPlayerMarker()` (blip hráča); tone mapping renderera (ACESFilmic) |
| `index.html` | HUD a overlay štýly, kruhový radar (`#minimap`), Google fonty (Anton, Barlow Condensed) |
| `src/traffic.js` | `CAR_COLORS`, `SHIRT_COLORS`, `PANTS_COLORS` |
| `src/labels.js` | `KIND_STYLES` — farby plávajúcich menoviek |

## Overenie vizuálnych zmien

Statický server + Node Playwright (Python playwright nie je nainštalovaný, ale
`playwright` je v projekte `node_modules`):

```bash
python3 -m http.server 5173 &          # alebo npm start
node -e "require('playwright')"        # z koreňa projektu — musí prejsť
NODE_PATH=$PWD/node_modules node /tmp/opencode/verify.cjs
kill %1
```

Tipy pre headless overenie (port 5173, viewport aspoň 1440×900):

1. `page.goto(...)` → `wait_for_selector('#start')` + pár sekúnd (svet sa skladá
   až po načítaní `heightmap.json` a OSM dát).
2. Pointer lock v headless režime nefunguje — po kliknutí na `#start` vynúť
   HUD cez `page.evaluate`:
   ```js
   document.getElementById('overlay').classList.add('hidden');
   document.getElementById('hud').classList.remove('hidden');
   ```
3. Uhol kamery sa dá nastaviť cez debug handle:
   `window.__gregorovce.player.pitch` / `.yaw` (debug handle je v `src/main.js`).
4. Screenshoty (`page.screenshot`) načítaj späť do konverzácie nástrojom Read a
   vizuálne skontroluj — žiadne console errory neznamená, že to vyzerá dobre.
5. Na konci server vždy vypni.
