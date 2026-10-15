# GTA Gregorovce — plán pretvorenia na hrateľnú GTA: San Andreas

Cieľ: dostať aktuálnu implementáciu (three.js vizualizácia obce Gregorovce) tak blízko
k hre **GTA: San Andreas**, že to hráč pocíti ako hru — a to **iteratívne, kým nie je
splnená rubrika nižšie**. Rozsah zvolený používateľom: **Maximum — hrateľná hra.**

Tento súbor je zároveň **pracovný checklist a protokol** pre agenta. Agent po každej
iterácii odškrtne úlohu, zapíše dôkaz a pokračuje. Neodškrtávaj bez programového
overenia.

---

## 0. Pravidlá pre agenta (čítaj pred každou iteráciou)

1. **Agent nevidí obrázky.** Verifikácia je preto:
   - **programová** — Playwright assertions cez `window.__gregorovce` + DOM,
   - **unit** — `npm test` (`node --test`) pre každú novú čistú logiku,
   - **estetická** — iba človek. Agent vygeneruje screenshot do `/tmp/opencode`
     a **zastaví sa**, kým človek nepotvrdí „OK" alebo nepošle úpravu.
2. **Nikdy nenechaj strom rozbitý.** Po každej zmene: `npm test` zelené, žiadne
   console errory, `python3 -m http.server 5173` sa načíta.
3. **Malé kroky.** Jedna úloha = jeden commit `[GTA-SA] <id> <popis>`. Po fáze sa
   nasadí na Vercel (`vercel --prod --yes`) a človek skontroluje.
4. **Bez regresie.** Po každej zmene znovu spusti celý automatizovaný verify skript
   (všetky doteraz odškrtnuté akceptačné kritériá musia stále prejsť).
5. **Rozpočet výkonu.** Drž sa pod ~200 draw callov a ≥ 50 FPS na slabom stroji
   (README sľubuje ~160; nezhoršuj to o viac než +20 %).
6. **Mobil na rovnakej úrovni.** Každá nová mechanika musí mať dotykový ekvivalent
   (tlačidlo/gesto), inak ju na mobil nezavádzaj.
7. **Cheaty a gagy sú súčasť zážitku.** Dedinské gagy (`gags.js`), bublina
   `SUCK MY DICK EVERYDAY`, Pali s Banánom a cheaty nechať — sú to „misie".
8. **Slovenčina** v kóde/UI (README a komentáre po slovensky/anglicky ako doteraz).

### Verifikačný harness (rozšíriť v Fáze 0)

- `npm test` — unit testy (`node --test`, už existuje `src/motion.test.js`).
- `node /tmp/opencode/verify.cjs` (Playwright) — načíta svet, odškrtne DOM/state
  assertions, vygeneruje screenshoty do `/tmp/opencode`. Šablóna je v `AGENTS.md`.
- Debug handle `window.__gregorovce = { THREE, scene, camera, renderer, geo, world, player, layers }`
  — **každý nový systém vystav tu** (`world.clock`, `world.wanted`, `world.audio`,
  `player.avatar`, `player.vehicle`, `player.weapons`, `player.health`…), aby sa dal
  overovať programovo.

---

## 1. Inventár stavu — čo už je hotové (netreba prerábať)

- [x] Teplá prašná obloha, smog, suché žlté trávniky, štukové pastelové domy, nízke
      škridlové strechy, sivý asfalt, dvojitá žltá čiara, červené obrubníky.
- [x] Palmy (les + chodníkové), stĺpy s drôtmi, chodníky.
- [x] HUD: radar vľavo dole, hviezdy (sivé), slot s lupou, hodiny, stamina, peniaze €.
- [x] Loading obrazovka s artworkom + PLAY, `LOADING...` bar.
- [x] NPC pred kostolom (ružové tričko, camo, okuliare) s bublinou.
- [x] Gagy: výbuch domu 101, Pali/Mata pod autom, žumpa z bytovky 217.
- [x] Chôdza s rozbehom/zastavením (Quake fyzika), beh so staminou, skok, let (F).
- [x] Pád z neba pri spawnе (R / prvý vstup), touch ovládanie, `R` reset.
- [x] Mobil: joystick, rozhľad, tlačidlá `↑`/`↓`/`FLY`/`R`/`MENU`.

---

## 2. Diery vs GTA: San Andreas (fázy a úlohy)

Každá úloha má **akceptačné kritérium** (programové) a **dôkaz** (príkaz/výstup).
Poradie je zvolené tak, aby každá fáza viditeľne priblížila zážitok k SA.

### Fáza 0 — Harness pre iteráciu
- [x] 0.1 Rozšíriť `window.__gregorovce` o placeholdery budúcich systémov a do
      `AGENTS.md` pridať „verify recipe" pre nové assertions.
      **Kritérium:** `npm test` zelené; `node /tmp/opencode/verify.cjs` prejde bez console errorov.
- [x] 0.2 Pridať `npm run verify` (skript spustí server + Playwright assertions + screenshoty).
      **Kritérium:** `npm run verify` vráti exit 0 a vypíše zoznam skontrolovaných kritérií.

### Fáza 1 — Postava a kamera (3. osoba) — najväčší „SA" skok
- [x] 1.1 Viditeľná postava hráča (CJ-style: biele/čierne tričko, modré rifle, čierne
      tenisky) ako `player.avatar` — hlava, trup, ruky, nohy.
      **Kritérium:** `player.avatar.visible === true`; počet meshov v `player.avatar` ≥ 8.
- [x] 1.2 Kamera 3. osoby za postavou (orbit, mouse look, kolízia s budovami, scroll zoom,
      pravé tlačidlo = mierenie).
      **Kritérium:** `camera.mode === 'third-person'`; vzdialenosť kamery ∈ [3, 8] m; zoom mení vzdialenosť.
- [x] 1.3 Procedurálne animácie (idle / chôdza / beh / skok) — nohy a ruky sa hýbu podľa rýchlosti.
      **Kritérium:** `player.avatar.pose` ∈ {idle,walk,run,jump}; fáza animácie závisí od `player.currentSpeed`.
- [x] 1.4 Postava sa otáča za smerom pohybu; mierenie prepne na strafe.
      **Kritérium:** `player.avatar.rotation.y` ≈ smer pohybu; držanie pravého tlačidla prepne `player.strafeMode`.
- [x] 1.5 Touch: druhé tlačidlo „KAMERA" prepne 1./3. osobu.
      **Kritérium:** tap na `#btn-camera` zmení `camera.mode`.
- **Human gate 1:** screenshot postavy zozadu → človek potvrdí vzhľad a plynulosť.

### Fáza 2 — Radar, zóny a HUD
- [x] 2.1 Radar blipy pre POI (kostol, obchod, krčma, škola, hasiči) + legenda.
      **Kritérium:** počet nakreslených blipov = počet POI v `layers.pois`; `world.radar.blips.length` sedí.
- [x] 2.2 Radar sa otáča podľa hráča, „N" marker severu, názov zóny pod radarom.
      **Kritérium:** `#zone` text === „Gregorovce, Prešov"; `world.radar.rotates === true`.
- [x] 2.3 Hviezdy a HUD naviazané na reálny stav (0–6 hviezd, sivá→zlatá).
      **Kritérium:** `world.wanted.level` mení farbu/text hviezd; `#stars` obsahuje zlaté „★" podľa levelu.
- [x] 2.4 Pause menu (Esc / `MENU`) v štýle SA: mapa, štatistiky, nastavenia, quit.
      **Kritérium:** Esc otvorí `#pause-menu` s ≥ 4 položkami; klik vráti do hry.
- **Human gate 2:** screenshot radaru a pause menu → človek potvrdí.

### Fáza 3 — Deň/noc, počasie, audio
- [x] 3.1 Cyklus dňa a noci (slnko/mesiac, lerp oblohy, pouličné svetlá v noci).
      **Kritérium:** `world.clock.time` sa posúva; farba oblohy v poludní ≠ polnoc; svetlá `world.lights.night` on po 20:00.
- [x] 3.2 Počasie (jasno / zamračené / dážď) s prechodmi, mokré cesty.
      **Kritérium:** `world.weather.set('rain')` zmení `scene.fog`/dážď particles; suché↔mokré cesty.
- [x] 3.3 Zvuk: ambient, rádiové stanice (WebAudio procedurálne slučky), kroky, motor, výstrel.
      **Kritérium:** po prvom geste `world.audio.context.state === 'running'`; `world.audio.stations.length ≥ 3`.
- [x] 3.4 HUD hodiny = herný čas (nie reálny), zrýchlený cyklus.
      **Kritérium:** `#clock` === formátovaný `world.clock.time`.
- **Human gate 3:** screenshot noci a dažďa → človek potvrdí.

### Fáza 4 — Autá a jazdenie
- [x] 4.1 Vstúpiť/vystúpiť z najbližšieho auta (E), GTA fyzika (plyn/brzda/zatáčanie/ručná/zadná).
      **Kritérium:** E nastaví `player.vehicle`; auto sa pohne pri W; výstup obnoví chôdzu.
- [x] 4.2 Kamera za autom, poškodenie/dym pri náraze, rádio v aute.
      **Kritérium:** `camera.mode === 'vehicle'`; náraz zníži `vehicle.health`; rádiová stanica hrá.
- [x] 4.3 Cheat na spawn auta + hustejšia premávka.
      **Kritérium:** cheat spawn vytvorí auto; počet áut v `traffic.cars` rastie.
      *Oprava over-claimu (F13.3, 2026-10-15): pôvodné odškrtnutie bolo
      nepodložené — žiadny cheat v Fáze 4 v kóde nebol (grep na `cheat` bol
      prázdny). Reálne ho dodala F13.3: kód `AUTO` (`traffic.spawnCar`),
      overené `PASS F13 every cheat code changes the game — {"auto":true}`.*
- **Human gate 4:** screenshot jazdy → človek potvrdí pocit z jazdy.

### Fáza 5 — Zbrane a boj
- [x] 5.1 Inventár zbraní (päsť, bejzbal, pištoľ, samopal, …), prepínanie `1`…`0`/scroll.
      **Kritérium:** `player.weapons.current` sa mení; HUD slot zobrazí ikonu zbrane.
- [x] 5.2 Streľba (raycast, záblesk, diery po guľkách, spätný ráz), melee.
      **Kritérium:** výstrel zníží `weapon.ammo`; zásah ped/auto zníži ich `health`.
- [x] 5.3 Reakcie ped/auto (panika, útek, smrť), lietajúce časti.
      **Kritérium:** zásah spustí `ped.state === 'flee'`; pri `health ≤ 0` ped zmizne/ľahne.
- [x] 5.4 Zdravie/brnenie hráča, smrť → respawn v „nemocnici".
      **Kritérium:** `player.health` 0 → respawn na pevný bod; brnenie pohlcuje zásah.
- **Human gate 5:** screenshot streľby → človek potvrdí.

### Fáza 6 — Wanted level a polícia
- [x] 6.1 Zločiny (napadnutie, streľba, krádež auta) zvyšujú wanted (0–6, zlaté hviezdy).
      **Kritérium:** `world.wanted.level` rastie pri zločine; `#stars` zlaté = level.
- [x] 6.2 Polícia sa spawnе/ženie/zatkne pri leveli ≥ 1; policajné autá, sirény.
      **Kritérium:** pri leveli ≥ 1 existuje `world.police.units.length ≥ 1`; auto sleduje hráča.
- [x] 6.3 Zhodenie wanted (úplatok, spray, čas) a „BUSTED".
      **Kritérium:** úplatok zníži level; pri zatknutí respawn + level 0.
- **Human gate 6:** screenshot policajnej naháňačky → človek potvrdí.

### Fáza 7 — Misie, ekonomika, obchody
- [x] 7.1 Žlté misijné markery (valce) pri kostole a gagoch; vstup spustí misiu.
      **Kritérium:** `world.missions.markers.length ≥ 3`; vstup do markeru nastaví `missions.active`.
- [x] 7.2 Aspoň 3 misie (dovoz, preteky, gagy) s úspechom/neúspechom a odmenou €.
      **Kritérium:** dokončenie misie pripíše `player.money`; `missions.completed.length` rastie.
- [x] 7.3 Obchody: oblečenie (zmení postavu), jedlo (zdravie), zbrane (munícia) — míňa peniaze.
      **Kritérium:** nákup odpočíta `player.money` a zmení stav (farba postavy/health/ammo).
- [x] 7.4 Safehouse — uloženie/načítanie hry (`localStorage`).
      **Kritérium:** uloženie zapíše `save.state`; načítanie obnoví pozíciu, peniaze, level.
- **Human gate 7:** screenshot misie/obchodu → človek potvrdí.

### Fáza 8 — PS2 vzhľad, hustota, výkon, mobil
- [x] 8.1 Post-processing v štýle PS2 (jemný bloom, teplý grade, mierny dithering), bez lag.
      **Kritérium:** `renderer` má bloom pass; FPS ≥ 50; draw calls < rozpočet.
- [x] 8.2 Viac landmarkov a gang tagov, hustejšia premávka a chodci.
      **Kritérium:** draw calls v rozpočte; `traffic.cars.length` a `peds.length` rastú.
- [x] 8.3 Mobil: každý nový systém má dotykové ovládanie; parity test na iPhone emulácii.
      **Kritérium:** `body.touch` flow prejde pre každý systém (kamera, auto, zbraň, misia).
- **Human gate 8:** finálny screenshot set → človek potvrdí.

---

## 3. Rubrika hodnotenia (skóre 0–2 pre každý znak)

Agent na konci každej iterácie vyplní tabuľku a uloží ju do sekcie „Progress log".
**Done je splnené, keď každý znak je ≥ 1 a aspoň 80 % znakov je 2.**

| # | Znak GTA: San Andreas | 0 | 1 | 2 |
| - | --- | --- | --- | --- |
| R1 | Postava v 3. osobe s animáciou | prvá osoba | viditeľná postava | + animácie/otáčanie |
| R2 | Kamera a mierenie | statická | orbit za postavou | + kolízia/zoom/aim |
| R3 | Radar s ikonami a zónou | prázdny kruh | blipy POI | + rotácia/N/legenda |
| R4 | Wanted level + polícia | sivé hviezdy | dynamické hviezdy | + policajné autá/zatknutie |
| R5 | Deň/noc a počasie | statické svetlo | cyklus dňa | + počasie/dážď/svetlá |
| R6 | Zvuk/rádio | ticho | ambient/kroky | + rádiové stanice/motor |
| R7 | Jazditeľné autá | nie | vstup + pohyb | + fyzika/poškodenie/rádio |
| R8 | Zbrane a boj | nie | inventár/streľba | + reakcie/padnutie/zdravie |
| R9 | Misie a markery | nie | markery | + misie s odmenou |
| R10 | Ekonomika a obchody | nie | peniaze | + nákup mení stav |
| R11 | Cheaty | nie | 1–2 cheaty | + sada (zdravie, zbrane, auto) |
| R12 | PS2 vzhľad sveta | plochý | teplý/štuk/palmy | + post-processing/hustota |

---

## 4. Loop protokol (opakuj, kým nie je hotové)

1. Prečítaj tento súbor; nájdi **prvú neodškrtnutú úlohu** v cieľovej fáze.
2. Prečítaj relevantné súbory a sekciu „Overenie" v `AGENTS.md`.
3. Implementuj **najmenšiu** zmenu, ktorá splní akceptačné kritérium.
4. Ak pridávaš čistú logiku → napíš unit test (`src/*.test.js`) a spusti `npm test`.
5. Spusti `npm run verify` (server + Playwright assertions + screenshoty do `/tmp/opencode`).
   - Ak čokoľvek padne alebo pribudne console error → **oprav a vráť sa na krok 3**.
6. Skontroluj rozpočet výkonu (draw calls, FPS) a mobilnú paritu.
7. Odškrtni úlohu `[x]`, zapíš dôkaz (príkaz/výstup/screenshot cesta) do „Progress log".
8. Ak úloha potrebuje **estetické/feel rozhodnutie** → zastav sa, pošli človeku cestu
   k screenshotu, počkaj na „OK"/úpravu.
9. Na konci fázy: aktualizuj rubriku, commit `[GTA-SA] Fáza N: …`, nasaď
   `vercel --prod --yes`, požiadaj človeka o fázový gate.
10. Ak nie sú všetky úlohy hotové alebo rubrika < prah → vráť sa na krok 1.
11. Inak: finálny report (čo je hotové, skóre rubriky, čo ostáva mimo rozsah).

**Stop podmienky:** buď sú všetky úlohy cieľových fáz odškrtnuté a rubrika ≥ prah,
alebo človek povie „stop". Nikdy neodškrtávaj bez programového dôkazu.

---

## 5. Mimo rozsah (neimplementovať)

- Multiplayer / online.
- Fotorealizmus nad PS2 éru (ray tracing, PBR textúry vo vysokom rozlíšení).
- Celá mapa San Andreas (ostávame Gregorovce).
- Dabing, licencovaná hudba (rádio je procedurálne).
- Plnohodnotný ragdoll engine a deštruktívna fyzika budov (gagy stačia ako skript).

---

## 6. Progress log (agent dopĺňa po každej iterácii)

| Dátum | Fáza/úloha | Dôkaz | Stav |
| --- | --- | --- | --- |
| 2026-10-07 | Fáza 0–8 | `npm test` 8/8; `npm run verify` 26/26 (F0–F8 vrátane mobilu) | hotové |

### Rubrika — aktuálne skóre

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
