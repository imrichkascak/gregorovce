# Gregorovce 3D — GTA: San Andreas edícia — finálny report (Fáza 14)

Dátum: 2026-10-18 · repo: `gregorovce` · vetva `main`

Hra je hotová: všetky fázy z `GTA-SA-PLAN.md` a `GTA-SA-PLAN-2.md`
(F0–F14) sú odškrtnuté a programovo overené. Tento report je záver
druhého plánu (GTA-SA-2).

---

## 1. Čo je hotové

| Fáza | Obsah |
| --- | --- |
| F9 | Bitky na blízko (animácie, combo, knockdown, get-up), živé NPC (stagger, telá, chuligáni sa bijú) |
| F10 | 12 questov, 10 quest giverov s menovkou a bublinou, dialógy s voľbami, quest log, waypoint, fail/retry, odmeny, reťaze, 3 uličné misie, 10 fliaš |
| F11 | 10 zbraní (melee 3, strelné 5, projektily 2), mierenie s crosshairom a kamerou cez rameno, pickupy s respawnom, tracery/nábojnice/diery, výbuchy, drive-by |
| F12 | Polícia (hliadky so sirénou, peší policajti strieľajú a zatknú ťa s pokutou a BUSTED, zátarasy od 4 hviezd, úkryt, lakovacia garáž), vozidlá hlbšie (motorky, bicykle, carjacking, poškodenie aj výbuch) |
| F13.1 | 4 interiéry (kostol, krčma, obchod, úrad) s vlastnou miestnosťou, NPC, interakciou a výstupom |
| F13.2 | Štatistiky hráča — 14 počítadiel, stránka „Štatistiky“ v pauze, uloženie do localStorage |
| F13.3 | 8 cheatov (`ZDRAVIE`, `ZBRANE`, `AUTO`, `POCASIE`, `HODINY`, `POLICIA`, `PENIAZE`, `LET`) s HUD potvrdením a dotykovou stránkou |
| F13.4 | Rádio a zvuk hlbšie — 6 staníc so žánrom, DJ hlásenia a reklamy, vlastný zvuk pre každú zbraň a motor podľa typu vozidla |
| F13.5 | Opravy podľa spätnej väzby (riadenie, ticho po štarte, overlay, favicon) |
| F13.6 | Úplné vypnutie zvuku (master mute predvolene, `Z` / `🔊`) |
| **F14.1** | **Živý svet:** 48 áut, 61 chodcov, 12 zvierat (6 sliepok, 6 psov), skupinky NPC (krčma — chuligáni, kostol — babky) |
| **F14.2** | **Výkon:** draw calls v dedine ≤ 200 (`max=164`), FPS ≥ 50 (`fps≈59`), efekty poolované, doprava inštancovaná |
| **F14.3** | **Mobil:** dotyková parita pre každý systém (mierenie, dialóg, pickupy, interiéry, cheaty) na emulácii iPhone 14 |
| **F14.4** | **Finále:** rubrika V2 vyplnená (všetko 2), README aktualizovaný, tento report |

---

## 2. Rubrika V2 — finálne skóre

| B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 | B9 | B10 | B11 | B12 | B13 | B14 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |

**Všetkých 14 znakov = 2 (100 %)** — prah „každý znak ≥ 1 a aspoň 80 % = 2“ je splnený.

Kľúčové body: B2 = 2 (skupinky NPC + zvieratá + obranné správanie),
B14 = 2 (hustota sveta + AI reakcie + zvieratá + FPS/draw calls check).

---

## 3. Zoznam questov

### Hlavné questy (10)

| # | Quest | Kto ho dáva | Kde |
| --- | --- | --- | --- |
| 1 | Zvony pre kostol | Farár Jozef | kostol |
| 2 | Pivo pre krčmu | Krčmár Miro | krčma |
| 3 | Nákup pre úrad | Vedúca Zuza | obchod |
| 4 | Papiere zo školy | Starosta Ondrej | úrad |
| 5 | Kontrola žumpy | Hasič Palo | hasiči |
| 6 | Deti z ihriska | Učiteľka Zuzana | škola |
| 7 | Lopta do krčmy | Tréner Laco | ihrisko |
| 8 | Západ od 217 | Susedka Babka | žumpa |
| 9 | Banán domov | Mata | Pali a Mata |
| 10 | Hasičská skúška | — (uličná misia) | hasiči |

### Vedľajšie questy a zberateľské (4)

| # | Quest | Kde |
| --- | --- | --- |
| 11 | Taxík po dedine (45 s) | obchod |
| 12 | Naháňačka za zlodejom (40 s) | úrad |
| — | 3 uličné misie (markery) | kostol, dom 101, žumpa 217, Pali a Mata |
| — | 10 fliaš (zberateľské) | po dedine |

### Quest giveri s menovkou (10)

Farár Jozef (kostol) · Krčmár Miro (krčma) · Vedúca Zuza (obchod) ·
Starosta Ondrej (úrad) · Hasič Palo (hasiči) · Učiteľka Zuzana (škola) ·
Tréner Laco (ihrisko) · Teta Anka (detské ihrisko) · Susedka Babka (žumpa) ·
Mata (Pali a Mata)

---

## 4. Overenie (dôkazy)

```bash
npm test        # 44/44 zelené (unit testy vrátane animals-core.test.js)
npm run verify  # 121/121 checkov (F0–F14), exit 0
```

- **F14.1:** `cars=48 peds=61 animals=12 {"chicken":6,"dog":6}`
  `krčma=3 chat kostol=3 chat` (predtým 24 áut / 34 chodcov / 0 zvierat)
- **F14.2:** `max=164` draw callov, `fps=58.7` (rAF counter za 4 s zo stredu
  dediny), efekty poolované (`particles=48 positions=144`)
- **F14.3:** aim `aiming=true`, dialóg `choices=2` + ťuknuteľná voľba,
  pickup `healed=true`, interiér `inside=kostol`,
  cheaty `rows=8 money=350→10350 toast=CHEAT: +10 000 €`
- **Screenshoty:** `/tmp/opencode/f14-village.png`, `f14-church.png`,
  `f14-pub.png`, `verify-mobile-f14.png`, `verify-menu.png`, `verify-world.png`

### Výkonové meranie (draw calls)

| Miesto | max draw calls |
| --- | --- |
| dedina (stred) | 164 |
| kostol | 132 |
| krčma | 101 |
| obchod | 90 |
| dom 101 | 59 |

Rozpočet je ≤ 200 — dedina má rezervu ~36 callov.

---

## 5. Čo nie je hotové / mimo rozsah

Podľa plánu (`GTA-SA-PLAN-2.md`, sekcia 6) zámerne **nie je** implementované:

- Multiplayer / online.
- Fotorealizmus nad PS2 éru (ray tracing, PBR textúry vo vysokom rozlíšení).
- Celá mapa San Andreas (ostávame Gregorovce).
- Dabing a licencovaná hudba (rádio je procedurálne).
- Plnohodnotný ragdoll engine a deštruktívna fyzika budov (gagy stačia ako skript).
- Nové npm závislosti a externé assety — všetko je procedurálne.

Ďalšie obmedzenia prostredia:

- **Deploy na Vercel sa nespustil** — `vercel` / `npx vercel` v prostredí nie je
  k dispozícii (plán ho má ako podmienený krok: „ak je dostupné“). Hru vieš
  nasadiť ručne: `npx vercel --prod --yes` v koreni repa.
- **Estetiku potvrdzuje človek** — agent nevidí obrázky; všetky vizuálne zmeny sú
  overené len programovo (draw calls, pozície, farby v kóde) + screenshotmi pre
  človeka v `/tmp/opencode`.
- **`AGENTS.md` nebol aktualizovaný** — je to chránený súbor (agent-instruction
  file), zápis si vyžiadal schválenie používateľa a to vypršalo. Poznámky k rozpočtu
  výkonu a novému debug handle sú zatiaľ len v tomto reporte a v `README.md`.

---

## 6. Ako si to spustiť a overiť

```bash
npm install          # len raz
npm start            # http://localhost:5173 → PLAY
npm test             # 44/44 unit testov
npm run verify       # 121/121 checkov + screenshoty do /tmp/opencode
```

**Ovládanie:** `WASD` chôdza/jazda, myš rozhľad, `Shift` beh, `Space` skok,
`E` auto, `F` rozhovor/vstup do budovy, `1`–`0` zbrane, `Q` stanica rádia,
`Z` zvuk, `M` dedinský tón, `B` úplatok, `R` respawn, `Esc` pauza,
`F5`/`F9` ulož/načítaj, cheaty písané na klávesnici.
Na mobile: joystick vľavo, ťahanie vpravo, tlačidlá `KAM` `E` `🎯` `🔫` `ZB` `💬` `↑` `↓` `FLY` `🔊` `R` a `MENU`.

---

## 7. Technické poznámky k výkonu (F14.2)

- Autá dopravy: dve spoločné `InstancedMesh` (karoséria `CAR_BODY_GEO` v šedej +
  `instanceColor` na farbu auta, druhá svetlá). `car.object` je prázdny objekt,
  ktorý drží len polohu a rotáciu.
- Chodci: šesť `InstancedMesh` po dieloch (torso, hlava, nohy, ruky) — animácia
  končatín sa počíta do matíc instancií.
- Zvieratá: zlúčené low-poly meshe s vertex colors (1 draw call na zviera).
- Neviditeľné sprity (dym/oheň výbuchu): `visible = false`, keď je opacity ~0.
- Efekty: poolované (fixné polia, žiadne alokácie v ticku).
- Meranie FPS: headless Chromium na macOS musí bežať s `--use-angle=metal`,
  inak renderuje softvérovo (~3 FPS) a check nemá zmysel.
