# Poznámky pre agentov (Gregorovce 3D)

## Overenie (automatické)

```bash
npm test           # node --test (unit testy: motion.js, rules.js)
npm run verify     # spustí server + Playwright assertions pre všetky fázy
```

`npm run verify` (`scripts/verify.cjs`) naštartuje `python3 -m http.server 5173`,
prejde svet v headless Chrome, **programovo** overí akceptačné kritériá z
`GTA-SA-PLAN.md` cez `window.__gregorovce` a vygeneruje screenshoty do
`/tmp/opencode` (`verify-menu.png`, `verify-world.png`, `verify-mobile.png`).
Exit 0 = všetko prešlo. Agent **nevidí obrázky** — estetiku potvrdzuje človek.

Debug handle `window.__gregorovce` obsahuje: `THREE, scene, camera, renderer, geo,
world, player, layers, avatar, cameraRig, radar, dayNight, weather, audio, weapons,
effects, pickups, vehicles, wanted, missions, quests, dialogue, interiors, stats,
cheats, postfx, syncAimHud`. Každý nový systém vystav tu.

## Rozpočet výkonu (F14.2)

Dedina musí ostať plynulá — po každej zmene, ktorá pridáva meshe, over rozpočet:

| Metrika | Rozpočet | Ako sa meria |
| --- | --- | --- |
| Draw calls | **≤ 200** v dedine | `renderer.info.render.calls` po `render()` |
| FPS | **≥ 50** | rAF counter za 4 s |
| Alokácie v ticku | žiadne | efekty poolované, sprity `visible = false` |

- Stred dediny je `(-650, -400)` — odtiaľ meraj draw calls vo všetkých smeroch
  (najhorší pohľad je pri krčme a kostole).
- Kamera po teleporte **lerpuje** — pred meraním počkaj ~0,7 s, inak čísla
  kolíšu (napr. krčma 87 → 204 → 101).
- Veľa meshov = málo callov: autá (`carBodies` + `carLights`), chodci
  (6 InstancedMesh) aj zvieratá sú inštancované/zlúčené. Neviditeľné sprity
  (`visible = false`) sa nekreslia.

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
5. **FPS meraj s GPU**: predvolený headless Chromium renderuje softvérom
   (~3 FPS) — spúšťaj `chromium.launch({ args: ['--use-angle=metal'] })` (macOS),
   inak FPS check v `verify.cjs` padá. `scripts/verify.cjs` to má v `GPU_ARGS`.
6. Na konci server vždy vypni.
