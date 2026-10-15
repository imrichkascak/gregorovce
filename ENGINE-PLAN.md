# GTA Gregorovce — plán ďalšieho vývoja (engine a architektúra)

> **Stav: NÁVRH — nič z tohto dokumentu nie je implementované.** Je to podklad na
> rozhodnutie, kam investovať ďalšie úsilie. Hra dnes beží na three.js a funguje;
> otázka je, či a čím ju nahradiť alebo len modernizovať.

## 1. Kde sme dnes

| Vec | Stav |
| --- | --- |
| Renderer | three.js cez `<script type="importmap">` (CDN), žiadny bundler, žiadny build krok |
| Kód | ~33 vanilla ES modulov v `src/` (`main.js`, `world.js`, `player.js`, `traffic.js`, `vehicles.js`, `weapons.js`, `wanted.js`, `quests.js`, `interiors.js`, `audio.js`, `geo.js`, `effects.js` …) |
| Assety | 100 % procedurálne (canvas textúry, geometria z kódu, WebAudio syntéza) + jedna `assets/loading.jpg` |
| Fyzika | vlastná: výška z výškovej mapy (`geo.heightAt`), AABB kolízie (`world.colliders`), ručné zrážky áut/chodcov |
| Testy | `node --test` (unit) + `scripts/verify.cjs` (Playwright end-to-end, 95+ checkov) |
| Hosting | Vercel static, deploy = `git push` |
| Zvuk | WebAudio syntéza (rádiá, SFX, dedinský tón), všetko vypnuté kým to hráč nezapne |

**Čo reálne bolí (a nie je to „zlý engine“):**

1. Žiadny build krok → žiadny tree-shaking, minifikácia, TypeScript, HMR, verzovanie
   three.js je len odkaz na CDN v importmape.
2. Žiadny fyzikálny engine → zrážky s budovami/autami sú ručné AABB testy; žiadne
   reálne odrazy, šmyk, reťazové havárie.
3. Žiadna scéna/level pipeline → dedina je vygenerovaná z OSM vo `world.js`; ručné
   úpravy znamenajú písať kód, nie klikať v editore.
4. Žiadne LOD/streaming → draw calls rastú lineárne s obsahom (dnes ≤ 200).
5. Žiadna sieť → multiplayer by dnes nebolo možné bez veľkého prepisu.
6. Žiadne typy → refaktoring vo veľkom (napr. `player.position` vs `.x/.z`) je
   náchylný na tiché chyby, ktoré odhalí len verify harness.

## 2. Možnosti (a čo by každá reálne priniesla)

| Možnosť | Čo dostaneš | Bundle / runtime | Editor | Fyzika | Migrácia | Riziko |
| --- | --- | --- | --- | --- | --- | --- |
| **A. three.js + Vite + TypeScript + Rapier** (modernizácia na mieste) | build, HMR, typy, hotová fyzika, LOD/instancing, WebGPU path | three ~185 kB gz; Rapier wasm ~0,7–1,5 MB | nie (level zostáva v kóde) | áno (Rapier) | malá — kód ostáva, menia sa len hranice | nízke |
| **B. Babylon.js** | „batérie v cene“: fyzika (Havok), GUI, audio, animácie, inšpektor, WebGPU | ~1,4–1,8 MB gz (modulárne menej) | áno (web editor) | áno (Havok) | stredná — prepis render/input vrstvy, herná logika ostáva | nízke-stredné |
| **C. PlayCanvas** | cloudový editor, ECS, kolaborácia, hosting | ~615 kB gz | áno (cloud, verejné projekty free) | áno (Ammo/realizmus) | stredná-vyššia — ECS myslenie, iný render | stredné (závislosť na cloude) |
| **D. Godot 4.5 (web export)** | plnohodnotný engine, vizuálny editor, GDScript, animácie, fyzika, multiplatform | export ~8 MB+ (wasm+pck), 4.3+ už nepotrebuje SharedArrayBuffer (single-thread šablóna), 4.5 WASM SIMD | áno (natívny) | áno (Godot Physics/Jolt) | vysoká — celý kód v GDScript/C#, nový pipeline, nový deploy | stredné (web export je najslabšia časť Godotu) |
| **E. Unity WebGL / Unreal** | najväčší ekosystém | desiatky MB, pomalý štart na mobile | áno | áno | vysoká | vysoké (load time, licencie) |
| **F. Bevy (Rust/WASM)** | výkon, typy | wasm ~ niekoľko MB | nie (kód) | áno (Rapier/Avian) | vysoká | vysoké (build toolchain, ekosystém) |

## 3. Odporúčanie

**Neprepočítavať hru do nového enginu. Namiesto toho modernizovať na mieste (A) a spraviť jeden
time-boxovaný spike s Godotom (D) ako poistku.**

Dôvody:

- Hra je hotová a overená (95+ e2e checkov, 31 unit testov). Prepis do Godotu/Babylonu by zahodil
  funkčnú hernú logiku (questy, wanted, doprava, cheaty) a priniesol by mesiace práce s nejasným
  ziskom — jediné, čo dnes naozaj chýba, sú *systémy* (fyzika, build, level pipeline), nie renderer.
- three.js je najľahšia cesta (185 kB gz) a už ju máme; jej slabiny (fyzika, editor) sa dajú doplniť
  knižnicami bez straty kódu.
- Babylon.js by dal fyziku a editor „zadarmo“, ale znamenal by prepis render/input vrstvy a 8× väčší
  bundle — návratnosť nie je zjavná pri hre, ktorá je zámerne PS2-lowpoly.
- Godot dáva najviac „engine feelingu“ (editor, animácie, Jolt fyzika), ale web export je jeho najslabšia
  časť: ~8 MB+ wasm, single-thread obmedzenia, slabší výkon na mobile a strata možnosti ladiť hru cez
  `verify.cjs`. Preto len ako spike s jasnými go/no-go kritériami.

## 4. Fázy modernizácie na mieste (A)

| Fáza | Čo | Prečo | Odhad |
| --- | --- | --- | --- |
| E1 | Vite + `npm run dev/build`, minifikácia, hashované assety, HMR | build krok bez zmeny logiky; importmap → `import 'three'` | 0,5–1 deň |
| E2 | TypeScript (postupne, `allowJs`), typy pre `player`, `world`, `traffic` | chyby ako `within(marker.object)` sa odhalia v editore | 1–2 dni |
| E3 | Vitest + prevod `node --test` | testy v jednom nástroji, watch mode | 0,5 dňa |
| E4 | Rapier fyzika pre autá/nárazníky a budovy (kolízie), zvyšok ostáva ručný | reálne nárazy, šmyk, prevrátenie; draw calls ostávajú | 2–4 dni |
| E5 | Systémová vrstva: fixný timestep + event bus + entity registrácia | determinizmus, jednoduchšie nové mechaniky, menej `main.js` | 1–2 dni |
| E6 | LOD + instancing + frustum tuning (cieľ: 40 áut / 50 chodcov pri ≥ 50 FPS) | splní F14 bez zmeny štýlu | 1–2 dni |
| E7 (voliteľné) | WebGPU renderer path s fallbackom na WebGL2 | vyšší výkon na novších zariadeniach | 1–2 dni |

**Go/no-go kritériá pre E4 (fyzika):** ak Rapier zdvihne bundle nad ~2 MB alebo FPS pod 50 na
mobile, ostávame pri vlastnej fyzike a investujeme do E6.

## 5. Godot spike (D) — ako by vyzeral a kedy ho zrušiť

1. **Vertikálny rez (2–3 dni):** dedina z OSM (statická geometria), chôdza + auto + jedno NPC auto,
   wanted hviezdy, jedna budova s interiérom, rádiové stanice.
2. **Merania:** veľkosť exportu, čas do prvého framu na 4G, FPS na strednom mobile, veľkosť repa.
3. **Go ak:** export ≤ 15 MB, prvý frame < 4 s na 4G, ≥ 50 FPS na strednom mobile a súčasne
   zachovaný PS2 look (žiadne defaultné PBR).
4. **No-go ak:** čokoľvek z toho zlyhá, alebo si spike vyžiada viac než 5 dní.
5. Pri no-go ostáva celý kód v three.js a investuje sa do E1–E6; nič sa nestratí, pretože spike žije
   v samostatnej vetve `spike/godot`.

## 6. Čo by sa stratilo pri prepise (a čo nie)

**Stratilo by sa:** `verify.cjs` (95+ checkov je písaných proti DOM/three.js API), procedurálne textúry
a WebAudio syntéza (v Godote by sa robili inak), priama kontrola nad draw callmi, jednoduchý deploy
(push = deploy) a celý test harness.

**Zostalo by:** dáta z OSM a výšková mapa, dizajn questov/misií/cheatov, PS2 estetika, dedinské gagy,
slovenčina, samotné mechaniky (prepis, nie redesign).

## 7. Odporúčaný ďalší krok

1. E1 (Vite) — najmenšia investícia, najväčší okamžitý zisk (build, minify, HMR).
2. E5 (systémová vrstva) — pripraviť pôdu pre E4 aj pre multiplayer.
3. E4 (Rapier) — až keď je E5 hotová, inak sa fyzika zamotá do `main.js`.
4. E6 (výkon) pred F14 finále, aby rubrika V2 mohla dať B14 = 2.
5. Godot spike (D) paralelne, time-boxovaný na 3 dni, s jasným go/no-go.

> Poznámka: tento dokument je návrh, nie záväzok. Poradie E1 → E5 → E4 → E6 je zvolené tak, aby
> každá fáza priniesla úžitok aj keby sa ďalšie nikdy nespravili.
