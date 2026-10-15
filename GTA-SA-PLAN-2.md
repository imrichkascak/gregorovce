# GTA Gregorovce 2 — hĺbka: maximálna funkčná podobnosť s GTA: San Andreas

Druhá iterácia. `GTA-SA-PLAN.md` (Fázy 0–8) postavil **kostru** hry — postava,
kamera, radar, deň/noc, počasie, rádio, autá, zbrane, wanted, polícia, misie,
obchody, save/load. Všetko to beží (`npm run verify` 30/30), ale hĺbka je malá:
misie sú „prejdi z bodu A do bodu B“, NPC len chodia/utekajú/ležia, hráč nikdy
nemôže dostať poškodenie, cheaty v kóde neexistujú. Táto iterácia ide po **zážitku**:
keď hráč príde na miesto, má tam čo robiť; NPC sa dajú zmlátiť a vedia sa brániť;
streľba je naplno použiteľná; svet žije. Cieľ je **maximálny možný výsledok** —
ukázať, čo dnešné modely dokážu.

Tento súbor je zároveň **pracovný checklist a protokol**. Agent po každej iterácii
odškrtne úlohu, zapíše dôkaz a pokračuje. **Neodškrtávaj bez programového
overenia.**

---

## 0. Ako spustiť (prompt pre `/goal` + gates)

Skopíruj tento blok do Hermesa spusteného v tomto repozitári:

```text
GTA Gregorovce → maximálna funkčná podobnosť s GTA: San Andreas. Iteruj podľa `GTA-SA-PLAN-2.md`, kým nie je splnená celá rubrika V2 a všetky fázy 9–14 odškrtnuté s programovým dôkazom. Ide o hĺbku, nie kostru: každé významné miesto v obci má quest alebo interaktivitu; NPC sa dajú zmlátiť a vedia sa brániť (reakcie, knockdown, krv, smrť); hráč vie dostať poškodenie a zomrieť (WASTED → respawn); streľba je naplno použiteľná (mierenie, zásahy, efekty, pickupy, drive-by); pribudne quest log s dialógmi, interiéry, štatistiky a cheaty.

verify: `npm test` a `npm run verify` (scripts/verify.cjs rozšírený o assertions pre každú novú fázu) prejdú na 100 % s exit 0 a bez console errorov; v `GTA-SA-PLAN-2.md` je každá úloha odškrtnutá s dôkazom v Progress logu a rubrika V2 je na prahu (všetky znaky ≥ 1, ≥ 80 % znakov = 2); `git log` obsahuje commit `[GTA-SA-2] …` pre každú fázu.

constraints: Nič nerozbíjaj — všetkých 30 starých verify checkov a 8 unit testov ostáva zelených; rozpočet výkonu ≤ ~200 draw callov a ≥ 50 FPS; každá nová mechanika má dotykový ekvivalent; štýl ostáva PS2 (žiadny fotorealizmus), dedinské gagy a slovenčina ostávajú; žiadne nové npm závislosti ani externé assety (všetko procedurálne ako doteraz); estetika neblokuje loop — screenshoty do `/tmp/opencode` a pokračuj.

boundaries: Repozitár `/Users/imrichkascak/repositories/gregorovce` — `src/`, `index.html`, `scripts/`, `data/`, `AGENTS.md`, `README.md`, `GTA-SA-PLAN-2.md`; malé commity `[GTA-SA-2] <fáza> <popis>`; deploy `npx vercel --prod --yes` len ak je CLI dostupné, inak preskoč.

stop when: Zastav sa len ak rozhodnutie mení rozsah alebo smer (externé assety, licencie, multiplayer), alebo sa niečo nedá overiť programovo ani unit testom, alebo si 3 kolá po sebe bez pokroku na tej istej úlohe, alebo človek pošle správu. Inak pokračuj sám.
```

Hneď po nastavení cieľa pridaj deterministické brány (musia prejsť, kým sa cieľ
môže vyhlásiť za hotový):

```text
/goal gate add npm test
/goal gate add npm run verify
```

Poznámky:

- `/goal` (nie `/loop`) je správna voľba: cieľ je jedna objektívna úloha s
  definíciou hotovo, ktorú sudca vyhodnocuje po každom ťahu. `/loop` je
  timer-driven (polling/monitoring) — sem sa nehodí.
- Rozpočet je 20 ťahov na jedno spustenie (`goals.max_turns`). Keď sa minie a
  cieľ sa pauzne, pokračuj `/goal resume` (vynuluje počítadlo). Dá sa aj zvýšiť:
  `hermes config set goals.max_turns 60`.
- Keď počas behu zistíš, že niečo chýba, pridaj kritérium za behu:
  `/subgoal <text>` — sudca ho musí tiež splniť.

---

## 1. Pravidlá pre agenta (čítaj pred každou iteráciou)

1. **Agent nevidí obrázky.** Verifikácia je **programová** (Playwright assertions
   cez `window.__gregorovce` + DOM), **unit** (`npm test`) a pre človeka
   **screenshoty** do `/tmp/opencode`. Estetické brány **neblokujú loop** —
   vygeneruj screenshoty, poznamenaj ich v odpovedi a pokračuj; človek ich
   skontroluje, keď bude chcieť, a jeho úprava má prednosť.
2. **Nikdy nenechaj strom rozbitý.** Po každej zmene: `npm test` zelené, žiadne
   console errory, `npm run verify` prejde.
3. **Malé kroky.** Jedna úloha = jedna najmenšia zmena, ktorá splní kritérium,
   + commit `[GTA-SA-2] <fáza> <popis>`.
4. **Bez regresie.** Po každej zmene znovu celý `npm run verify` — všetkých 30
   starých checkov musí stále prejsť (a pribúdajú nové).
5. **Rozpočet výkonu.** ≤ ~200 draw callov, ≥ 50 FPS na slabom stroji.
6. **Mobil na rovnakej úrovni.** Každá nová mechanika má dotykový ekvivalent
   (tlačidlo/gesto), inak ju na mobil nezavádzaj.
7. **Cheaty a gagy sú súčasť zážitku.** Dedinské gagy (`gags.js`), bublina
   `SUCK MY DICK EVERYDAY`, Pali s Banánom a cheaty nechať.
8. **Slovenčina** v kóde/UI, README a komentáre ako doteraz.
9. **Dôveruj kódu, nie checkom.** Plán 1 miestami nadhodnocuje (viď § 2 nižšie).
   Každé staré kritérium over programovo; čo v kóde nie je, je diera.
10. **Vystav každý nový systém na `window.__gregorovce`** (napr. `world.combat`,
    `world.quests`, `world.dialogue`, `world.pickups`, `world.interiors`,
    `world.animals`, `player.stats`…), aby sa dal overiť programovo. Každá nová
    čistá logika dostane unit test (`src/*.test.js`).
11. **Každé akceptačné kritérium = aspoň jeden check v `scripts/verify.cjs`.**
    Over, že kritérium naozaj platí — nestačí, že systém existuje; musí aj
    reagovať (zásah uberie health, quest sa dokončí a pripíše peniaze…).
12. **V každej odpovedi** (ťahu) zhrň: čo pribudlo + dôkaz (výstup príkazu) +
    stav rubriky V2 + ďalší krok. Sudca vidí len odpoveď — bez dôkazu v odpovedi
    nebude vedieť, že si pokročil.

### Verifikačný harness (rozšíriť)

- `npm test` — unit testy (`node --test`).
- `npm run verify` (`scripts/verify.cjs`) — server + headless Chrome + programové
  assertions + screenshoty do `/tmp/opencode`. **Rozšír o assertions pre každú novú
  úlohu fázy 9–14** (aspoň 1 check na úlohu; kritérium hotovo = check zelený).
- Debug handle `window.__gregorovce` — každý nový systém vystav tu.

---

## 2. Východiská a známe diery

**Hotové (Fáza 0–8 plánu 1):** postava 3. osoby s animáciami, kamera s kolíziou,
radar s blipmi, deň/noc, počasie, rádio (3 stanice), jazditeľné autá, zbrane
(päsť, bejzbal, pištoľ, samopal), wanted 0–6 s policajnými autami, misijné markery
+ obchody + save/load, PS2 bloom, mobil. `npm test` 8/8, `npm run verify` 30/30.

**Over-claimy plánu 1 (over v kóde a oprav v rámci fáz 9–14):**

- F4.3 „cheat na spawn auta“ — v kóde **žiadny cheat neexistuje** (žiadny kód,
  žiadny keydown handler). Kryje to Fáza 13.3.
- F5.4 „zdravie/brnenie hráča, smrť → respawn“ — `player.health` sa inicializuje
  na 100, ale **nikdy neklesá** (nič ho neznižuje, armor sa nikdy nepoužije).
  Kryje to Fáza 9.4.
- F6.3 „spray, čas“ — spray ani časový pokles wanted v kóde nie sú. Kryje to
  Fáza 12.2.
- F8.2 „gang tagy“ — v kóde nie sú. Pokry to Fáza 14.1 (alebo vynechať).

**Konkrétne diery, ktoré táto iterácia zatvára:**

- NPC nemajú útočné animácie hráča, nedajú sa knockdownúť, nebránia sa.
- Hráč nemá damage, smrť, WASTED, respawn za smrť, armor.
- Misie sú len „prejdi k markeru“ — žiadne fázy, dialógy, quest giveri, quest log,
  fail/retry, vedľajšie misie, zberateľské predmety.
- Streľba bez mierenia, bez pickupov, bez granátov/ostreľovačky/brokovnice, bez
  drive-by, bez efektov (tracer, nábojnice, krv, výbuchy).
- Polícia len autá bez peších, bez streľby, bez roadblockov, bez hľadania.
- Vozidlá bez motorky/bicykla, bez carjackingu (vodič v aute nemá AI).
- Žiadne interiéry, žiadne štatistiky hráča (rešpekt/skilly), žiadne cheaty.
- Rádio 3 stanice bez DJ/reklám, málo NPC/áut, žiadne zvieratá.

**Lokácie, ktoré musia mať obsah** (z OSM dát a gagov): kostol (sv. Márie),
Prima bar (krčma), Coop Jednota (obchod), Obecný úrad, DHZO (hasiči), škola,
ihriská (leisure=pitch ×3), detské ihrisko (playground), dom 101 (gag), žumpa 217
(gag), Pali a Mata (gag). Cieľ: každé z nich má quest alebo interaktivitu.

---

## 3. Fázy 9–14 (úlohy a akceptačné kritériá)

Každá úloha má **akceptačné kritérium** (programové) a **dôkaz** (príkaz/výstup
zapísaný do Progress logu). Poradie je zvolené tak, aby každá fáza viditeľne
priblížila zážitok k SA.

### Fáza 9 — Bitky a živé NPC

- [x] 9.1 Melee útoky hráča: animácie úderov avatara (ľavý hák, pravý hák, kop),
      hitbox podľa uhla a dosahu, 3-úderové combo, úder funguje aj počas behu.
      **Kritérium:** `avatar` má stav útoku (napr. `avatar.state.pose === 'punch'`);
      NPC v dosahu stratí `health`; 3 rýchle údery → `ped.state === 'knockdown'`.
      **Dôkaz:** verify → `PASS F9 punch spends a swing and poses — pose=punch`;
      `PASS F9 hit hurts and reacts — hurt=true reacted=true`;
      `PASS F9 three quick hits knock down — state=knockdown`; unit testy
      `combat.test.js` (inMeleeArc kužeľ, comboHits okno) 14/14.
- [x] 9.2 Reakcie NPC na zásah: flinch (odskočenie), knockdown (spadne, chvíľu
      leží), vstane (~2–4 s) alebo sa vzdiali; krvavé častice; smrť = telo ostane
      (fade). **Kritérium:** po zásahu `ped.state === 'stagger'` alebo
      `'knockdown'`; po knockdowne sa vráti `walk`; pri 0 health `dead` telo ostane.
      **Dôkaz:** `PASS F9 hit hurts and reacts — hurt=true reacted=true`;
      `PASS F9 knocked-down ped gets up — getup→flee`;
      `PASS F9 lethal hit leaves a body — body=true`;
      `PASS F9 hit spawns blood and camera shake — blood=24`.
- [x] 9.3 NPC sa bránia: typ NPC (napr. chuligáni pri krčme), pri útoku sa
      rozbehnú k hráčovi, udierajú; hráč stráca `health`; dá sa vyhrať (NPC
      knockdown) aj prehrať (hráč KO). **Kritérium:** `ped.state === 'fight'`;
      `player.health` klesá pri zásahu od NPC.
      **Dôkaz:** `PASS F9 chuligán fights back and hurts the player — fought=true`;
      agresivita `hash(i * 3.1) > 0.72 ? 0.9 : 0.15` v `traffic.js`.
- [x] 9.4 Hráčove zdravie a smrť: pád z výšky, náraz auta, zásah → `health`
      klesá; `armor` pohlcuje časť zásahu; pri 0 → WASTED obrazovka → respawn
      (nemocnica) so stratou peňazí; HUD bar pre health/armor.
      **Kritérium:** `player.health` klesne po zásahu; pri 0 → WASTED flow +
      respawn; armor absorbuje ≥ 50 %.
      **Dôkaz:** `PASS F9 armor soaks a hit — absorbed=true` (2/3 pohltenie);
      `PASS F9 zero health dies and respawns — deaths=1 respawned=true`;
      `PASS F9 death shows WASTED overlay and empty health bar — shown=true bar=0%`;
      `PASS F9 respawn clears WASTED overlay — cleared=true`;
      `respawnFromDeath()` = nemocnica −10 % peňazí (`player.js`).
- [x] 9.5 Feedback boja: kamera shake pri údere/výstrele, krv, zvuky úderov
      (punch/hurt/KO), hit marker. **Kritérium:** `world.effects.blood > 0` po
      zásahu; `cameraRig.state.shake ≠ 0`; nové zvuky hrajú.
      **Dôkaz:** `PASS F9 hit spawns blood and camera shake — blood=24 shake=0.22`;
      `PASS F9 hit marker flashes and fight sounds play — marker=true sounds=swing,hit`;
      nové sfx `swing`/`hurt`/`ko`/`wasted` v `audio.js`.

### Fáza 10 — Questy, dialógy a interaktivita na miestach

- [x] 10.1 Quest framework: definície questov (id, fázy, ciele, časové limity,
      odmeny, fail/retry), stav `world.quests`, quest log v pause menu, waypoint
      na radare pre aktívny cieľ. **Kritérium:** `world.quests` má ≥ 1 definíciu;
      quest log zobrazí aktívny quest; radar blip cieľa.
      **Dôkaz:** `PASS F10 quest framework has >= 8 quests — defs=12`;
      `PASS F10 quest log lists the quest — log=true`;
      `PASS F10 active quest shows a radar waypoint — waypoint=true`;
      `PASS F10 pause menu shows the quest log`; čistý stavový automat
      `quests-core.js` (10 funkcií) so 6 unit testami.
- [x] 10.2 Dialógový systém: UI dialógu s voľbami (prijať/odmietnuť/pokračovať),
      rečnícke postavy (quest giveri) ako 3D NPC s menovkou a bublinou, dialóg sa
      dá zavrieť. **Kritérium:** dialóg sa otvorí pri postave; voľba mení stav
      questu; ≥ 5 pomenovaných postáv v svete.
      **Dôkaz:** `PASS F10 >= 5 named quest givers — givers=10`;
      `PASS F10 dialogue opens with choices — choices=2`;
      `PASS F10 dialogue choice accepts the quest — accepted=true`;
      `PASS F10 giver bubble tracks the quest state — swapped=true`; kláves F,
      klik/tap a mobilné tlačidlo 💬; voľby aj cez Digit1..9.
- [x] 10.3 Questy na miestach: ≥ 8 questov, každý ≥ 2 fázy (získať → urobiť →
      vrátiť sa), aspoň 1 quest alebo interaktivita na každom mieste (kostol,
      krčma, obchod, úrad, hasiči, škola, ihrisko, žumpa/dom 101); fail/retry.
      **Kritérium:** `world.quests.length ≥ 8`; `world.quests.locations` pokrýva
      všetky miesta; fail + retry overený.
      **Dôkaz:** `PASS F10 quests cover all village spots — covered=true` (9 miest:
      kostol, krčma, obchod, úrad, hasiči, škola, ihrisko, žumpa, dom 101);
      `PASS F10 reaching the target advances the phase — phase=true`;
      `PASS F10 side mission fails on the timer — failed=failed`;
      `PASS F10 failed side mission can be retried — retried=active`; giveri a
      ciele sa automaticky posúvajú k najbližšej ceste (`nearRoad`), aby boli
      dostupné pešo a nie v strede budovy.
- [x] 10.4 Odmeny, rešpekt a reťazenie: dokončenie questu mení `player.money`
      a `player.respect` (nová štatistika); aspoň 1 reťaz (quest B sa odomkne po
      dokončení A); odmeny sa líšia (peniaze/zbraň/oblečenie/odomknutie).
      **Kritérium:** `player.respect` rastie za quest; reťaz overená programovo.
      **Dôkaz:** `PASS F10 hand-in completes, rewards and chains — status=completed
      rewarded=true chain=available`; odmeny: peniaze + rešpekt, náboje (Pištoľ),
      oblečenie (tričko), odomknutie reťaze; reťaze `nakup → oheň` a
      `zvony → palibrat` (`locked: true`).
- [x] 10.5 Vedľajšie misie a zberateľské predmety: SA-style side-misie
      spustiteľné z ulice (napr. hasiči — hasenie, taxík — odvoz, strážca zákona
      — naháňačka) s úrovňami a odmenami; ≥ 10 zberateľských predmetov na mape
      s blipmi po objavení a odmenou za všetky. **Kritérium:** side-misia sa dá
      spustiť a dokončiť; `world.collectibles` ≥ 10 a zobranie mení počítadlo.
      **Dôkaz:** `PASS F10 >= 3 side missions start on the street — side=3
      status=active`; `PASS F10 >= 10 collectibles and picking one counts —
      bottles=10 picked=true`; 3 uličné misie (taxík, hasenie, naháňačka) so
      štartovacím kruhom a časovým limitom; 10 fliaš s HUD počítadlom a odmenou
      500 € za všetky.

### Fáza 11 — Streľba, zbrane, pickupy

- [x] 11.1 Mierenie: držanie pravého tlačidla myši prepne aim mód (kamera cez
      rameno, spomalenie, crosshair), streľba presnejšia; `player.weaponSkill`
      rastie streľbou a ovplyvňuje spread/cooldown. **Kritérium:**
      `weapons.state.aiming === true`; crosshair viditeľný; skill rastie.
      **Dôkaz:** `PASS F11 aiming raises the gun and the crosshair — aim=true
      crosshair=true`; `PASS F11 aiming tightens the spread — tighter=true`;
      `PASS F11 weapon skill grows with shots — grew=true`; kamera cez rameno
      (offset 0.85 m, vzdialenosť 2.6 m), chôdza pri mierení × 0.45.
- [x] 11.2 Nové zbrane: brokovnica, AK-47, ostreľovačka (zoom), nôž, granát a
      molotov; prepínanie 1–0, HUD ikona + munícia. **Kritérium:**
      `weapons.list.length ≥ 8`; každá zbraň sa dá použiť (fire) a má efekt.
      **Dôkaz:** `PASS F11 ten weapons all fire — fired=10/10 blasts=2`
      (päsť, nôž, bejzbal, pištoľ, brokovnica, samopal, AK-47, ostreľovačka,
      granát, molotov); HUD `#weapon-ammo` (∞ alebo počet), klávesy 1–0, mobilné
      `ZB`/🎯.
- [x] 11.3 Pickupy: plávajúce pickupy zbraní, munície, zdravia a armoru na mape,
      zobranie mení stav (inventár/health/armor), respawn po ~30 s.
      **Kritérium:** `world.pickups.length ≥ 6`; zobranie mení stav; respawn.
      **Dôkaz:** `PASS F11 >= 6 pickups change state and respawn —
      pickups=8 healed=true respawn=true`; `PASS F11 weapon pickup hands over
      the gun — given=true`; 8 pickupov (kostol, obchod, krčma, úrad, škola,
      ihrisko, hasiči, žumpa) s otáčaním, bobbingom a menovkou.
- [x] 11.4 Efekty streľby: tracer, nábojnice, dym, diery po guľkách ostávajú,
      krv, výbuch granátu/molotova poškodí okolie (NPC/autá), zvuk podľa zbrane.
      **Kritérium:** efekty majú stav; výbuch zníži `health` v okruhu; zvuky.
      **Dôkaz:** `PASS F11 shots leave tracers, casings and bullet holes —
      tracer=true casing=true decal=true`; `PASS F11 explosion hurts peds and
      shakes the camera — hurt=true fire=true shake=true`; sfx `shotgun`/`sniper`/
      `boom`/`pickup` v `audio.js`; diery = InstancedMesh (40, život 45 s).
- [x] 11.5 Drive-by: streľba z auta (aj počas jazdy), zásah NPC/auta z vozidla,
      zasiahnutý vodič panikuje/vystúpi. **Kritérium:** `weapons.fire()`
      funguje počas `player.vehicle`; zásah z vozidla mení stav cieľa.
      **Dôkaz:** `PASS F11 drive-by fire works and the driver bails —
      driveBy=true bail=true`; zásah auta (`hitCar` s `bail: true`) → vodič
      vyskočí (`bailOut`, nový chodec `flee`, život 14 s) a auto spomalí
      (`panicTimer`).

### Fáza 12 — Polícia a vozidlá hlbšie

- [x] 12.1 Pešia polícia: pri wanted ≥ 2 policajti vystúpia z áut, naháňajú a
      strieľajú → `player.health` klesá; pri ≥ 4 roadblocky na cestách; zatknutie
      → pokuta + existujúci BUSTED flow. **Kritérium:** `wanted.units` obsahuje
      peších; streľba policajtov uberá `player.health`; roadblock existuje.
      **Dôkaz:** `PASS F12 foot police deploy and shoot the player — cops=6
      health=25`; `PASS F12 arrest fines the player and shows BUSTED —
      fine=360`; `PASS F12 roadblocks spawn at four stars — roadblock=true`;
      BUSTED overlay (`#busted`, pokuta v HUD), `state.busted`/`state.fine`/
      `state.copShots`; peší policajti sa vystrelia z hliadky (2 na auto, max 6),
      strieľajú po 1,3 s z 24 m (8 + level × 1,5 dmg) a zatknú do 2,2 m.
- [x] 12.2 Stratenie polície: keď ťa polícia nevidí (napr. ~30 s mimo dohľad),
      wanted klesá; spray/lakovacia garáž (nový objekt, napr. pri obchode) zníži
      level na 0; úplatok (B) existuje. **Kritérium:** skrytie zníži level;
      spray garáž vynuluje wanted; flow overený programovo.
      **Dôkaz:** `PASS F12 hiding out of sight cools the wanted level —
      level=1` (po 30 s bez dohľadu do 38 m klesne level o 1);
      `PASS F12 spray garage wipes the wanted level — resprays=1` (garáž pri
      obchode + zlatý marker, vjazd = wanted 0); úplatok `B` existuje
      (`wanted.bribe()`).
- [x] 12.3 Vozidlá: motorka a bicykel (nové typy s inou fyzikou), carjacking —
      pri krádeži auta vodič vystúpi a panikuje/utečie; auto pri 0 HP vybuchne
      (dym existuje). **Kritérium:** `traffic.cars` má typy; carjack flow mení
      stav vodiča; výbuch auta overený.
      **Dôkaz:** `PASS F12 traffic has motorbikes and bicycles —
      moto=true bike=true` (24 vozidiel: car/moto/bike, každý typ s vlastnou
      rýchlosťou a fyzikou jazdy); `PASS F12 carjacking makes the driver bail
      and flee — jack=true driver=true` (`traffic.carjack()` → vodič vyskočí ako
      `flee` chodec); `PASS F12 a wrecked car explodes — exploded=true`
      (`hitCar` pri 0 HP → `wrecked` + `exploded` + oheň/dym/boom v main.js).
- [x] 12.4 Dopravná AI: autá spomaľujú/trúbia/obchádzajú hráča aj seba, chodci
      uskakujú pred autami; policajné auto má sirénu a blikajúce svetlá.
      **Kritérium:** reakcie áut/chodcov overené; siréna + blikanie stav.
      **Dôkaz:** `PASS F12 traffic brakes and honks for the player —
      brake=true horn=true` (`laneBlocked` → `brakeTimer`, trúbenie `horn`
      zvuk); `PASS F12 pedestrians dodge cars — dodge=true` (`updateDodge` →
      `dodging` + `dodgeShift`); `PASS F12 police siren flashes —
      flash=1.6,1.6,0.2` (striedavé modré/červené svetlá na hliadke).

### Fáza 13 — Interiéry, štatistiky, cheaty, rádio

- [x] 13.1 Interiéry: vstupy do aspoň 4 budov (kostol, krčma, obchod, úrad),
      interiér scéna s obsahom (NPC/dialóg/minihra), výstup späť pred budovu.
      **Kritérium:** `world.interiors.length ≥ 4`; vstup/výstup flow overený;
      každý interiér má aspoň 1 interakciu.
      **Dôkaz:** `PASS F13 interiors >= 4 each with an interaction —
      interiors=4`; `PASS F13 entering a building puts the player inside —
      inside=true`; `PASS F13 interior interaction changes the player —
      health=65` (sviečka v kostole +25); `PASS F13 exiting returns the
      player to the door — doorDistance=0.0`; `PASS F13 standing at a door
      offers entry — nearDoor=true`. `src/interiors.js`: 4 miestnosti
      (kostol/krčma/obchod/úrad) na najplochšej časti mapy
      (`findFlatBase`, 9×3 bunky výškovej mapy), každá má steny
      s kolíziami, pult/oltár, NPC a zlatý marker; v dedine je pri každej
      budove menovka „F vstup“ (sprite), vstup cez `F`/💬 a výstup pri
      dverách; interakcie: sviečka (+25 zdravie), pivo (+10 zdravie, −5 $),
      vesta (+50 armor, −100 $), potvrdenie (+5 rešpekt), cooldown 12 s.
- [x] 13.2 Štatistiky hráča: stránka „Štatistiky“ v pause menu — rešpekt, skilly,
      najazdené/odchodené km, questy, zločiny, peniaze, hviezdy, čas hry;
      rešpekt rastie za questy/bitky; štatistiky sa ukladajú.
      **Kritérium:** `player.stats` má ≥ 6 hodnôt; stránka zobrazí živé hodnoty.
      **Dôkaz:** `PASS F13 player stats track >= 6 values — keys=14`;
      `PASS F13 walking grows the distance stat — walked=2.0`;
      `PASS F13 money changes are counted — earned=true`;
      `PASS F13 crimes and top wanted level are counted — crimes=true`;
      `PASS F13 deaths are counted — deaths=true`; `PASS F13 knockouts give
      respect once per target — respect=true`; `PASS F13 stats page shows live
      rows — rows=16`; `PASS F13 stats save and load — saved=true`.
      `src/stats.js` (čisté funkcie + tracker): 14 počítadiel (čas hry,
      odchodené, najazdené, questy, misie, bitky, KO, zločiny, max hviezdy,
      zatknutia, smrti, ukradnuté autá, zarobil, minul); rešpekt +1 za KO
      (ten istý cieľ len raz, `WeakSet`); vzdialenosť podľa rýchlosti
      (`player.currentSpeed` / `vehicleSpeed()`), peniaze cez rozdiel
      (`addMoney` → zarobil/minul), uloženie `gregorovce.stats`; stránka
      „Štatistiky“ v pauze sa obnovuje každých 0,5 s (živé hodnoty);
      screenshot `/tmp/opencode/f13-stats.png` (16 riadkov: čas 1 h 02 min,
      1,5 km pešo, 32,4 km autom, 6 questov, 3 misie, 41 úderov/7 KO,
      zločiny 6 max 3★, zatknutia 1, smrti 2, autá 4, zarobil 5820 €,
      minul 2180 €, rešpekt 58, peniaze 1350 €, hviezdy 2/6, zdravie 82).
- [ ] 13.3 Cheaty: ≥ 6 kódov (zdravie+armor, zbrane+munícia, spawn auta,
      počasie, čas, wanted dole, …) zapísaných na klávesnici, HUD potvrdenie
      „CHEAT“, a oprav starý over-claim F4.3 (plán 1 tvrdí cheat na auto).
      **Kritérium:** každý cheat má programový efekt; F4.3 overený.
- [ ] 13.4 Rádio a zvuk hlbšie: ≥ 5 staníc (žánre), DJ hlásenia medzi
      skladbami a reklamy (procedurálne), sfx podľa zbrane (brokovnica/AK/
      ostreľovačka znejú inak), motor podľa typu. **Kritérium:**
      `audio.stations.length ≥ 5`; DJ/reklama stav; rozdielne sfx.

### Fáza 14 — Hustota, výkon, mobil, finále

- [ ] 14.1 Živý svet: viac áut (≥ 40), viac chodcov (≥ 50), zvieratá
      (sliepky/psy ≥ 10), skupinky NPC (pri krčme, pred kostolom).
      **Kritérium:** počty rastú; bez regresie starých checkov.
- [ ] 14.2 Výkon: draw calls ≤ 200 a FPS ≥ 50 (verify meria rAF counter za
      ~2 s); efekty poolované (žiadne alokácie v ticku). **Kritérium:** verify
      FPS/draw calls check zelený.
- [ ] 14.3 Mobil: dotykové ovládanie pre každý nový systém (aim, voľby
      dialógu, pickupy, interiéry, cheaty); parity test na iPhone emulácii.
      **Kritérium:** touch flow prejde pre každý systém.
- [ ] 14.4 Finále: rubrika V2 vyplnená (všetky znaky ≥ 1, ≥ 80 % = 2), README
      a AGENTS.md aktualizované, finálny report so screenshotmi a zoznamom
      questov, čo je hotové a čo nie. **Kritérium:** rubrika + README + report.

---

## 4. Rubrika hodnotenia V2 (skóre 0–2 pre každý znak)

Agent na konci každej fázy vyplní tabuľku a uloží ju do sekcie „Progress log“.
**Done je splnené, keď každý znak je ≥ 1 a aspoň 80 % znakov je 2.**

| # | Znak | 0 | 1 | 2 |
| --- | --- | --- | --- | --- |
| B1 | Boj na blízko | len číslo damage | animácie úderov | + combo, knockdown, get-up, dopady |
| B2 | NPC správanie | chodia po ceste | utekajú pred hráčom | + bránia sa, dialógy, telá, skupinky |
| B3 | Hráč: zdravie a smrť | health v HUD | zásahy uberajú | + WASTED, respawn, armor, nemocnica |
| B4 | Questy na miestach | 1–2 markery | questy s fázami | + ≥ 8 miest s questom/interaktivitou |
| B5 | Dialógy a postavy | žiadne | bubliny nad NPC | + UI s voľbami, quest giveri s menovkou |
| B6 | Quest log a progres | žiadny | zoznam questov v pauze | + waypoint, fail/retry, odmeny, reťaz |
| B7 | Streľba | puky bez efektu | mierenie + zásahy | + zbrane, pickupy, drive-by, efekty |
| B8 | Polícia | autá naháňajú | peší policajti + streľba | + roadblocky, pokuty, spray, hľadanie |
| B9 | Vozidlá | autá | ukradnutie aj s vodičom | + motorky, bicykle, poškodenie, výbuch |
| B10 | Interiéry | nie | 1–2 vstupy | + ≥ 4 s obsahom a výstupom |
| B11 | Štatistiky hráča | peniaze | zdravie/armor | + rešpekt, skilly, stránka v pauze |
| B12 | Cheaty | nie | 2–3 kódy | + ≥ 6 (zdravie, zbrane, auto, čas, počasie, wanted) |
| B13 | Rádio a zvuk | ticho | stanice | + DJ, reklamy, sfx podľa zbrane |
| B14 | Živý svet a výkon | prázdne ulice | viac NPC/áut | + AI reakcie, zvieratá, FPS/draw calls |

---

## 5. Loop protokol (opakuj, kým nie je hotové)

1. Prečítaj tento plán + `AGENTS.md` + `GTA-SA-PLAN.md` (pravidlá, verify recipe).
2. Urob **audit starých kritérií**: over programovo, či Fáza 0–8 naozaj platí.
   Známe over-claimy (viď § 2) oprav. Ak nájdeš ďalšie, oprav ich.
3. Nájdi **prvú neodškrtnutú úlohu** vo fázach 9–14.
4. Prečítaj relevantné súbory (`src/*.js`, `index.html`, `scripts/verify.cjs`).
5. Implementuj **najmenšiu** zmenu, ktorá splní akceptačné kritérium. Nový systém
   vystav na `window.__gregorovce`.
6. Ak pridávaš čistú logiku → napíš unit test (`src/*.test.js`) a spusti `npm test`.
7. Rozšír `scripts/verify.cjs` o assertions pre novú úlohu (aspoň 1 check).
8. Spusti `npm test` a `npm run verify` — všetko zelené, žiadne console errory.
   Ak čokoľvek padne → **oprav a vráť sa na krok 5**.
9. Skontroluj rozpočet výkonu (draw calls, FPS) a mobilnú paritu.
10. Odškrtni úlohu `[x]`, zapíš dôkaz (príkaz/výstup) do „Progress log“.
11. V odpovedi zhrň: čo pribudlo + dôkaz + stav rubriky + ďalší krok.
12. Commit `[GTA-SA-2] <fáza> <popis>`.
13. Screenshoty do `/tmp/opencode` pre človeka (neblokuj loop).
14. Na konci fázy: vyplň rubriku V2, aktualizuj README/AGENTS.md; ak je
    `vercel`/`npx vercel` dostupné, nasaď `--prod --yes`.
15. Ak nie sú všetky úlohy hotové alebo rubrika < prah → vráť sa na krok 2.
16. Inak: finálny report (čo je hotové, skóre rubriky, čo ostáva mimo rozsah).

**Stop podmienky:** buď sú všetky úlohy fáz 9–14 odškrtnuté a rubrika V2 ≥ prah,
alebo človek povie „stop“. Nikdy neodškrtávaj bez programového dôkazu.

---

## 6. Mimo rozsah (neimplementovať)

- Multiplayer / online.
- Fotorealizmus nad PS2 éru (ray tracing, PBR textúry vo vysokom rozlíšení).
- Celá mapa San Andreas (ostávame Gregorovce).
- Dabing, licencovaná hudba (rádio je procedurálne).
- Plnohodnotný ragdoll engine a deštruktívna fyzika budov (gagy stačia ako skript).
- Nové npm závislosti a externé assety — všetko procedurálne (textúry, zvuky,
  modely), ako doteraz.

---

## 7. Progress log (agent dopĺňa po každej iterácii)

| Dátum | Fáza/úloha | Dôkaz | Stav |
| --- | --- | --- | --- |
| 2026-10-15 | F9.1–9.5 Bitky a živé NPC | `npm test` 14/14; `npm run verify` 42/42 (12 nových F9 checkov); screenshoty `/tmp/opencode/combat-fight.png`, `/tmp/opencode/combat-wasted.png`; commit `[GTA-SA-2] F9 …` | ✅ |
| 2026-10-15 | F10.1–10.5 Questy, dialógy, interaktivita | `npm test` 20/20 (6 nových testov `quests-core.test.js`); `npm run verify` 57/57 (15 nových F10 checkov); 12 questov, 10 giverov, 9 miest, 3 uličné misie, 10 fliaš; screenshoty `/tmp/opencode/quest-giver.png`, `quest-dialogue.png`, `quest-log.png`; commit `[GTA-SA-2] F10 …` | ✅ |
| 2026-10-15 | F11.1–11.5 Streľba, zbrane, pickupy | `npm test` 20/20; `npm run verify` 66/66 (9 nových F11 checkov); 10 zbraní (melee 3, strelné 5, projektily 2), mierenie s kamerou cez rameno, 8 pickupov s respawnom, tracery/nábojnice/diery po guľkách, výbuchy, drive-by s vyskakujúcim vodičom; screenshoty `/tmp/opencode/f11-aim.png`, `f11-boom.png`, `f11-pickup.png`; commit `[GTA-SA-2] F11 …` | ✅ |
| 2026-10-15 | F12.1–12.4 Polícia a vozidlá hlbšie | `npm test` 20/20; `npm run verify` 77/77 (11 nových F12 checkov); peší policajti (2 na hliadku, max 6) strieľajú a zatknú s pokutou + BUSTED overlay, roadblocky od 4 hviezd, úkryt 30 s bez dohľadu zhodí hviezdu, lakovacia garáž pri obchode vynuluje wanted, motorky/bicykle medzi 24 vozidlami, carjacking s vyskakujúcim vodičom, výbuch auta (oheň/dym/boom), dopravná AI (spomalenie + trúbenie, chodci uskakujú), blikajúca siréna; screenshoty `/tmp/opencode/f12-police.png`, `f12-roadblock.png`, `f12-garage.png`; commit `[GTA-SA-2] F12 …` | ✅ |
| 2026-10-15 | F13.1 Interiéry (kostol, krčma, obchod, úrad) | `npm test` 20/20; `npm run verify` 82/82 (5 nových F13 checkov); 4 miestnosti s obsahom + NPC + interakciou, menovky „F vstup“ pri budovách, vstup/výstup overený (`inside=true`, `doorDistance=0.0`); `src/interiors.js` | ✅ |
| 2026-10-15 | F13.2 Štatistiky hráča | `npm test` 26/26 (6 nových testov `stats.test.js`); `npm run verify` 90/90 (8 nových F13 checkov); 14 počítadiel, rešpekt +1 za KO, živé riadky stránky „Štatistiky“ v pauze, uloženie `gregorovce.stats`; screenshot `/tmp/opencode/f13-stats.png` (16 riadkov) | ✅ |

### Rubrika V2 — aktuálne skóre

| B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 | B9 | B10 | B11 | B12 | B13 | B14 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 0 | 1 | 1 |

Poznámky k skóre (po F12): B1–B3 = 2 (animácie + combo/knockdown/get-up; NPC sa
bránia + telá; WASTED + respawn + armor + nemocnica). B2 = 1 → bránia sa, telá a
dialógy máme, chýbajú **skupinky** NPC (F14). B4 = 2 (9 miest s questom alebo
interaktivitou: kostol, krčma, obchod, úrad, hasiči, škola, ihrisko, žumpa, dom
101; fail + retry). B5 = 2 (bubliny + UI s voľbami + 10 giverov s menovkou).
B6 = 2 (quest log, waypoint, fail/retry, odmeny, 2 reťaze). B7 = 2 (10 zbraní,
mierenie s crosshairom a kamerou cez rameno, zásahy NPC/áut, pickupy, drive-by,
tracery/nábojnice/diery, výbuchy, zvuk podľa zbrane). B8 = 2 (pešia polícia +
streľba + roadblocky + pokuty + lakovacia garáž + hľadanie/úkryt + úplatok).
B9 = 2 (carjacking s vodičom, motorky, bicykle, poškodenie aj výbuch áut).
B10 = 2 (4 interiéry — kostol, krčma, obchod, úrad — s vlastnou
miestnosťou, NPC, interakciou a výstupom späť pred budovu; F13.1).
B11 = 2 (peniaze + health/armor + rešpekt + 14 počítadiel štatistík —
čas, km pešo/autom, questy, misie, bitky, KO, zločiny, hviezdy, zatknutia,
smrti, autá, zárobok/útrata — a stránka „Štatistiky“ v pauze so živými
hodnotami, uložená v localStorage; F13.2). B12 = 0 → cheaty F13.3. B13 = 1 (3 stanice + sfx podľa
zbrane) → DJ/reklámy F13.4. B14 = 1 → zvieratá/skupinky/AI reakcie/FPS check F14.
