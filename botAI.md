# UTF Arena — Bot AI Reference

## Přehled architektury

Bot AI je rozdělena do **3 vrstev** (vrstvy se volají v různých frekvencích):

| Vrstva | Metoda | Frekvence | Zodpovědnost |
|--------|--------|-----------|--------------|
| 1 — Mozek (Macro) | `runMacroTick()` | ~1–2× za sekundu | Strategická rozhodnutí, teamfight detekce, macro assignments |
| 2 — Taktika | `evaluateTactic(dt)` | ~5–10× za sekundu | Výběr cíle / objektu, útěk, volání o pomoc |
| 3 — Operativa (Mikro) | `executeOperative(dt)` | Každý frame (~20 FPS) | Pohyb, basic ataky, casting spellů |

Globální mozek v `GameMode_*.js` (třída Central Brain) koordinuje celý tým, individuální BotPlayer pak jen exekvuje přidělené rozkazy.

---

## Vrstva 1: Makro mozek (Central Brain)

**Umístění:** `GameMode_Arena.js`, `GameMode_ARAM.js`, `GameMode_Classic.js`, resp. `GameMode_Speed.js` — každý mode má vlastní mozek volající metody z `BotBrain.js`.

### Trifázový cyklus strategie

```
EARLY (60s) → EXPLORE (25–35s) → EXPLOIT (90–300s) → EXPLORE znovu...
```

- **EARLY:** Inicializace, rozestavení botů
- **EXPLORE:** Testuje strategie z `buildStrategyOrder()`, vybírá nejlepší dle `scoreMacroSnapshot()`
- **EXPLOIT:** Exekuce zvolené strategie; pokud `panicStreak >= 1.5` nebo strategie selhává >60s → přechod zpět do EXPLORE

### Macro Snapshot (KPI)

Každý tick mozku se měří stav hry jako snapshot. Delta snapshotů slouží ke skórování strategie.

Klíčové metriky:
| Metrika | Popis |
|---------|-------|
| `pointDiff` | Rozdíl skóre (Arena/Dominion) |
| `towerLead` | Počet vlastních věží minus nepřátelských |
| `homeThreat` | Počet nepřátel u domácích věží |
| `towerPressure` | Tlak na vlastní věže |
| `teamKillLead` | Kill lead vůči nepříteli |
| `powerLead` | Celkový combat power rozdíl |
| `enemyDeadCount` | Kolik nepřátel je mrtvých |
| `activePowerupLead` | Kdo drží powerup |
| `objectivePresenceLead` | Přítomnost na věžích |

### Teamfight detekce

```javascript
TEAMFIGHT_RADIUS = 900px
TEAMFIGHT_MIN_COMBATANTS = 5 (celkem hráčů obou stran)
Podmínka: allies >= 2 AND enemies >= 2 AND total >= 5
```

**Focus target priorita (v teamfightu):**
1. Support/Healer (nejdostupnější — nejméně HP + nejblíže centru clumpu)
2. Low-HP carry (SLAYER/FIGHTER pod 55% HP)
3. Největší DPS hrozba (vypočteno z base atk + spell DPS / HP %)

**Rolové assignment v teamfightu:**
- **TANK** → `GUARD_CARRY` (stoj mezi focus targetem a svým nejzraněnějším SLAYER/FIGHTER)
- **SUPPORT** → `PEEL` (jdi k nejzraněnějšímu spojenci pod 70% HP)
- **ostatní** → `HUNT focus_target`

---

## BotBrain.js — Mozky per herní mód

### DominionBrain (Classic / Speed)

8 strategií seřazených dle score:

| Strategie | Základní popis |
|-----------|---------------|
| `TOWER_FIRST` | Priorita obrany věží + 1 bot na útok |
| `TURTLE` | Plná obrana domácích věží |
| `AGGRO_DEF` | 1 obránce, zbytek útočí |
| `META_4_1` | 4 na hlavní věž, 1 splitpusher |
| `META_3_2` | 3 na jednu věž, 2 na druhou |
| `KILL_FIRST` | Priorita zabíjení (SLAYERi) |
| `AGGRO_ALL` | Všichni útočí |
| `SPLIT_ROAM` | Splitpusher crimpuje, zbytek útočí |

Score každé strategie se dynamicky počítá z: `homeThreat`, `towerLead`, `powerLead`, `pointDiff`, `allyRoles`, `enemyDeadCount`, atd.

**Macro assignment logika (DominionBrain):**
1. Záchrana spolubojovníka s win prob < 40%
2. Powerup assignment (SLAYER/SPLITPUSHER přednost)
3. DEFEND věží pod palbou
4. HOLD vlastních věží (budget 2–3 botů)
5. SNEAK CAPTURE prázdných věží
6. Distribuce dle aktuální strategie
7. Záloha: FARM

### AramBrain

3 strategie: `PUSH` / `DIVE` / `HOLD`

Score: `homeThreat`, `powerLead`, `teamHeroCount vs enemyHeroCount`, `allyRoles.SLAYER`

**Assignment:**
1. Záchrana spolubojovníka (win prob < 35%)
2. Obrana věže (max 2 obránci)
3. `HOLD`: všichni brání vlastní věž
4. `DIVE`: hunt low-HP target, zbytek ASSAULT
5. `PUSH`: všichni jdou na nepřátelskou věž

### ArenaBrain

3 strategie: `HOLD_AND_FIGHT` / `DIVE` / `SIEGE`

**Jungle phase logika:**
- Pokud je věž zamčená (`isLocked`) a do odemčení zbývá >10s → **jungle phase**
- Boti jdou do svých kempů (striktně vlastní strana mapy)
- Pořadí preference: SLAYER > FIGHTER > SPLITPUSHER > MAGE > SUPPORT
- Každý bot dostane jiný kemp (jeden kemp per bot)
- Pokud více botů než kempů → jdou čekat na `waitPos` (220px před věží)

**Kempy na vlastní straně: +10000 bonus, na cizí: -5000**

Buff preference per role:
- `TANK` buff → TANK, SUPPORT, FIGHTER role
- `POWER` buff → magical SLAYER, FIGHTER
- `AS_AH` buff → physical SLAYER, SPLITPUSHER, FIGHTER

**PUSH_MINIONS přiřazení v jungle phase:**
- Pokud 4+ botů neassignováno A 3+ kempů A pushable minionů > 0 → 1 FIGHTER/TANK dostane `PUSH_MINIONS`
- SLAYER/MAGE mají nejnižší prioritu na push (zůstávají v kempu)

**Po skončení jungle phase:**
- 1 bot (ten nejdál od věže) dostane `PUSH_MINIONS` (pokud jsou pushable minionové) nebo `FARM` (pokud je camp k dispozici)
- Zbytek drží věž

**REGROUP:** Pokud 2+ spolubojovníci mrtví → všichni se stáhnou na spawn a čekají

**STUCK BOT FIX:** Bot v capture radiusu věže s nepřáteli → okamžitě přepne na HUNT

---

## Vrstva 2: Taktika (evaluateTactic)

Spouští se ~5–10× za sekundu. Vybírá nejlepší kombinaci **cíl + objektiv**.

### Cílování nepřátel

Bot hodnotí všechny nepřátele score systémem (personalWeights):

| Faktor | Base Weight | Popis |
|--------|-------------|-------|
| `heroKillScore` | 425 | Základní skóre za nepřítele |
| `lowHpScore` | 255 | Bonus za každé 1% HP pod 50% |
| `attackVisionRange` | 500px | Maximální vzdálenost vidění |

Teamfight focus target přebíjí individuální hodnocení — pokud je bot v clumpu, dostane macro příkaz `HUNT focusTarget`.

### Hodnocení objektů

| Typ | Base Score | Popis |
|-----|------------|-------|
| `towerBaseScore` | 11 500 | Neutrální věž v dosahu |
| `neutralTowerScore` | 6 900 | Neutrální věž |
| `emptyTowerScore` | 3 450 | Věž bez obrany |
| `minionPushBaseScore` | 20 700 | Push minionů (high priority) |
| `healScore` | 14 000 | Lékárnička (jen pokud HP < healDesireThreshold) |
| `powerupScore` | 16 000 | Powerup |
| `overcrowdedTowerPenalty` | 20 000 | Penalizace za přeplněnou věž |

### PUSH_MINIONS macro order

Makro rozkaz pro eskortu minionů k nepřátelské základně (Arena specifický — každý minion který dosáhne nepřátelské věže = +2 body).

- **Cíl:** Bot se pohybuje za vybraným minionem a eskortuje ho k enemy base (`x: 3180/220, y: 670`)
- **Aktualizace cíle:** Každý frame — přepne na miniona nejblíže enemy base z livingých pushable minionů
- **Skóre v minion evaluaci:** `+50000 + (2000 - distToEnemyBase) × 20` (přímočará priorita)
- **Bonus za vybraného miniona:** `+15000` (pokud je to aktuální `macroOrder.target`)
- **Minion podmínky:** živý, vlastní tým, ne jungle monster, >350px od enemy base (ještě potřebuje escort)
- **Stale check:** Pokud nejsou žádní živí pushable minionové → `macroOrder = null`

### Útěk (Terrified)

Spouštěče útěku:
- HP < `panicThreshold` (10–25% — náhodné per bot)
- Win prob < 20% (viz `predictFightOutcome`)
- Dlouhý stalemate při nevýhodném souboji

Priorita cíle útěku:
1. Nejbližší aktivní lékárnička (pokud do 1500px)
2. Nejbližší živý spojenec
3. Vlastní spawn

### Volání o pomoc

- Cooldown: 5 sekund
- Podmínka: `winProb < 0.45` NEBO stalemate
- Šance: 100% při stalemate, 50% jinak
- Dosah: SUPPORT slyší na 2000px, ostatní na 1200px
- SUPPORT zahodí aktuální úkol a jde pomoct (pokud má >35% HP)

---

## Vrstva 3: Operativa (executeOperative)

### Anti-stuck mechanismus

Každých 0.25s bot kontroluje zda se pohnul o >5px. Pokud ne a je u zdi:
1. Zkusí dash spell kolmo na směr cíle
2. Pokud není dash → force-dash vlastní rychlostí (200px)

### Wave Clear (AoE kouzla na miniony)

Každé 1–2.5s bot vyhodnotí: pokud 3+ nepřátelských minionů v AoE radiusu → castuje (65% šance). Neprobíhá v teamfightu.

### Powerup Contest

Každé 1–2s: pokud je nepřítel <500px od powerupu a chystá se ho sebrat → 60% šance přepnout na ATTACK (pouze pokud win prob >= 50%).

### Combat pohyb (ATTACK state)

**Trade tracking (3s okno):**
```
_tradeRatio = HP ztraceno / HP způsobeno targetu
_badTrade = tradeRatio > 2.2 AND ztraceno > 33% max HP
```

**CD Window:** Pokud enemy castoval spell v posledních 1.8s → bezpečné okno → agresivnější pohyb

**Pohybová logika:**

| Situace | Akce |
|---------|------|
| `_badTrade` + mimo safe window | Backoff: ranged kite, melee krok zpět |
| `_goodTrade` (ratio < 0.8) | Aggro chase: atkRange × 1.25, strafe × 1.4 |
| V útoku, v range | Strafe (alt. strana dle ID parity) |
| Mimo range | Chase k cíli |
| Ranged a příliš blízko | Move away (kiting pozice) |

**Tower pull:** Pokud je věž v dosahu, bot se přitahuje k věži i při souboji (capture priority).

**Predikce míření (Leading):**
- Šance: `0.46 + level × 0.04` (Lvl 1 = 50%, Lvl 10 = 90%)
- Rychlost střely: 800 (ranged AA) / 1000 (spell)
- Error mod: 0.8–1.2 (lidský faktor)

### Spell casting logika

**Q spell (per typ):**

| Typ | Podmínka castování |
|-----|--------------------|
| `heal_self` / `hana_q` | HP < 70% |
| `dash` | Range: d < 250 (útěk); Melee: d > atkRange + 250 (gap close) |
| `buff_ms` | d < 600 |
| `aoe` / `aoe_knockback` | bestAoePos hits >= 2, v dosahu |
| `flamethrower` | bestAoePos v dosahu NEBO d < range |
| `spin_to_win` | 2+ nepřátelé v radiusu NEBO teamfight hit |
| `reaper_q` | d < 350 a charge = 0 |
| `volstrov_q` | d < 400 a buff není aktivní |
| `heal_beam` | Injured ally < 95% HP v dosahu |
| ostatní | d < 450 |

**E spell (per typ):**

| Typ | Podmínka castování |
|-----|--------------------|
| `heal_self` | HP < 60% |
| `heal_aoe` | HP < 70% |
| `summon_healers` | HP < 80% nebo d < 400 |
| `reaper_e` | d 100–350 NEBO Q CD > 35% base a d < 200 — **pouze pokud reaperCharge === 0** |
| `volstrov_e` | Q CD > 35% base a d < 350 NEBO HP < 55% |
| `shield_aoe` | 1+ nepřítel v radiusu NEBO HP < 80% |
| `ubercharge` | Timer >= 5s a (HP < 40% nebo target HP < 50%) |
| `omnislash` | d < E.distance + 60, target < 55% HP NEBO spinActive NEBO 1v1 NEBO Q.cd > 4s |
| `tamer_e` | Pet HP < 50% nebo spawning mimo combat |

### Per-hero operative hooks

Speciální logika nad rámec generického spell castingu — aplikuje se per-hero v executeOperative.

#### Jailer (TANK, magical)
- **Q hook-engage:** `projectile_pull` Q se castuje pouze pokud `d > 160 && d < hookRange × 0.95` (min. mezera 160px, aby hook netrefil bota stojícího přímo na cíli)
- **Pre-hook slowdown:** Pokud Q je ready a target v hookRange → pohyb zpomalí na 15% (přednabíjení pozice pro hook)

#### Pyromancer (SLAYER, magical ranged)
- **Flamethrower cast podmínka:** E se castuje jen pokud je cíl v kuželu ±cone×1.2 (bot se předtím dotočí)
- **Smooth aim tracking:** Pokud `flamethrowerTimer > 0` → bot plynule trackuje cíl (`aimAngle += angleDiff × min(1.0, dt × 6.0)`)

#### Doctor (SUPPORT, physical melee)
- **Q heal beam — stabilita při uber nabíjení:** Pokud `uberChargeTimer > 2.5` → beam se nepřepíná na jiný spojenec (ochrana nabíjení)
- **Pre-uber bloodlust** (po `computePlayStyle()`): Od 3.5s do 5s nabíjení lineárně zvyšuje `backoffAggression +0.55` a snižuje `panicHpMod -0.6`, `strafeIntensity -0.3`
- **Post-uber restart:** Když `beamUberTimer` přejde na 0 → resetuje beam, okamžitě ho znovu zapne na nejlepšího live spojence (SLAYER/FIGHTER priority, nízké HP priority)
- **E cone_slow_shield:** Castuje jen pokud `recentAttackers` je neprázdný NEBO HP < 65%

#### Reaper (SPLITPUSHER, magical)
- **E reaper_e:** Castuje jen pokud `reaperCharge === 0` (čeká na spotřebování Q nabití před reshotem)

#### Wanderer (SLAYER, physical)
- **E omnislash podmínky:** `d < (E.distance + 60)` A (`targetLowHp < 55%` NEBO `spinTimer > 0` NEBO 1v1 situation NEBO `Q.cd > 4s`)
- 1v1 situation = méně než 2 nepřátelé v 350px (zabraňuje spouštění do velké skupiny)

#### Volstrov (MAGE, magical ranged)
- **Q lock:** Pokud `volstrovQTimer > 0` (buff aktivní) → pohyb se nezastaví pro kiting (udržuje pozici pro výstřely)

#### Fusilier (SLAYER, physical ranged)
- **E cone_knockback jako peel:** Castuje E pokud nepřítel < 75px NEBO je aktivní `_badTrade` situace (knockback jako obrana)

---

### Heal pickup invalidace (anti-freeze fix)

Boti se mohli zaseknout u již sebraného heal packu. Třívrstvá oprava:

1. **Po taktickém rozhodnutí:** Pokud `objectiveTarget` je heal a `game.heals &&` je prázdný nebo heal má `active === false` → `objectiveTarget = null`
2. **V executeOperative SEARCHING state:** Kontrola stale objective před výběrem akce
3. **V CAPTURE/PUSH/PICKUP bloku:** Při přiblížení k heal packu — pokud `!liveHeal || !liveHeal.active` → vymaz objective a přepni na SEARCHING

Všechny kontroly jsou wrappované `game.heals && game.heals.length > 0` pro bezpečnost v módech bez healů.

---

### Jungle kiting exclusion (Arena)

Jungle monstra (team = -1) splňují podmínku `m.team !== this.team`, takže se dostávala do kiting scanu a způsobovala, že boti utíkali od kempů které farmili.

Fix: Pokud `macroOrder.junglePhase === true` → jungle monstra se přeskočí v kiting smyčce:
```javascript
const _farmingJungle = this.macroOrder && this.macroOrder.junglePhase;
for (let m of game.minions) {
    if (m.isJungleMonster && _farmingJungle) continue;
    ...
}
```

---

### GUARD_CARRY state

Tank stojí 120px mezi carry a nejbližším nepřítelem. Útočí na nepřátele v atkRange + 60px.

### PEEL state

Support jde k chráněnému hráči (do 100px). Castuje heal/shield/buff kouzla. Útočí na útočníky chráněného.

### Kiting při přesunu

I mimo ATTACK state bot střílí na nepřátele v atkRange:
- Ranged: vždy
- Melee: jen pokud d <= attackRange + 20
- Kiting spelly (za sebe) každé 0.8–1.6s

---

## predictFightOutcome

Vrací win probability (0.0–1.0) na základě:
- **TTK** (time-to-kill) obou stran — calc z DPS vs EHP
- Healing factor (heal power, lifesteal)
- Cooldown estimates
- Modifikace dle `confidenceMod` (0.8–1.2, náhodné per bot)
- Role awareness: TANK táhne TTD, SLAYER zvyšuje burst

Používá se pro:
- `shouldAttack` rozhodnutí v evaluateTactic
- `terrified` state spuštění
- Volání o pomoc
- Záchrana spolubojovníka v macro brain

---

## evaluateCombatProfile

Statický composite score používaný pro **shop rozhodování** i **teamfight power estimation**.

```
score = burst × weight.burst + dps × weight.dps + ttd × weight.ttd
```

**Role váhy:**

| Role | Burst | DPS | TTD |
|------|-------|-----|-----|
| TANK | 0.18 | 0.24 | 0.58 |
| SUPPORT | 0.20 | 0.22 | 0.58 |
| SLAYER | 0.50 | 0.30 | 0.20 |
| FIGHTER | 0.34 | 0.42 | 0.24 |
| SPLITPUSHER | 0.28 | 0.48 | 0.24 |

**Burst** (magical): `AP × 1.6 × magMult × 2.0 + (haste + AS_AH_bonus) × 0.45`
**Burst** (physical): `AD × 1.6 × physMult × 2.0 + attackSpeed × 12`
**TTD**: `HP × EHP_mult + regen × 70 + speed × 6 + shield × 0.8 + lifesteal + healPower + utility`

---

## Shop AI (scoreShopItem)

### Fázová priorita:

| Fáze | Podmínka | Priority bonusy |
|------|----------|----------------|
| Early | Level ≤3, items ≤1 | powerPct ×1.3, hpPct ×1.2, ahFlat ×1.25 (magic/support) |
| Mid | jinak | bez extra bonusů |
| Late | Level ≥10 nebo items ≥5 | penPct ×1.3, burn ×1.2, lifesteal ×1.2 |

### Role-specific modifikátory:
- Lifesteal: ×0.3 pro TANK/SUPPORT
- Move speed: ×0.6 ranged, ×1.3 melee non-TANK
- Ability haste: ×1.4 pro magic/support
- Slow on-hit: ×1.2 pro melee non-support

### Counter-build logika:
- Avg enemy armor > 55 → Pen ×1.8+
- Healing factor > 0.3 → GW ×2.5+
- Max enemy HP > 1400 → Burn ×1.5+
- Phys threat > 60% → armorPct ×1.4+
- Mag threat > 60% → mrPct ×1.4+

### Stack penalty:
- 2.+ stejný item: score ×0.3–0.6

### Náhoda: ±12% noise (0.88–1.12)

---

## Build archetypes

Každý bot náhodně dostane archetyp při spawnu (`rollBuildArchetype`). Archetyp multiplikuje score konkrétních stat kategorií.

| Archetyp | Klíčové priority |
|----------|-----------------|
| `glass_cannon` | power ×1.9, pen ×2.2, hp ×0.3 |
| `full_power` | power ×1.7, haste ×1.4, pen ×1.9 |
| `bruiser_power` | power ×1.4, hp ×1.5, armor ×1.2, pen ×1.6 |
| `full_tank` | hp ×2.0, armor ×1.8, mr ×1.8, power ×0.3 |
| `anti_tank` | pen ×2.8, burnMaxHp ×2.5, strikeBurn ×2.3, GW ×1.8 |
| `lifesteal` | lifesteal ×2.2, power ×1.4, pen ×1.6 |
| `haste_mage` | haste ×2.0, power ×1.5, pen ×1.8 |
| `support_healer` | healPower ×2.5, haste ×1.6, hp ×1.3 |
| `support_tank` | hp ×1.8, armor ×1.7, mr ×1.7 |
| `support_gw` | GW ×2.5, haste ×1.5 |
| `kite_slow` | slowOnHit ×2.0, ms ×1.5, pen ×1.8 |
| `splitpush_ms` | ms ×1.8, power ×1.4, pen ×1.9 |
| `burn_tank` | burnMaxHp ×2.0, hp ×1.5, armor ×1.3 |
| `as_carry` | attackSpeed ×2.0, power ×1.5, pen ×1.9, lifesteal ×1.4 |

### Per-class distribuce (výběr):

| Třída | Hlavní archetype (% šance) |
|-------|---------------------------|
| Vanguard | anti_tank 45%, bruiser_power 35% |
| Ironclad | full_tank 50%, burn_tank 30% |
| Lynx | anti_tank 40%, glass_cannon 35% |
| Healer | support_healer 50%, haste_mage 30% |
| Mage | anti_tank 45%, haste_mage 35% |
| Quiller | anti_tank 45%, glass_cannon 35%, kite_slow 20% |

---

## Personality traits (náhodné per bot)

| Vlastnost | Rozsah | Popis |
|-----------|--------|-------|
| `panicThreshold` | 10–25% HP | Kdy začne panikařit a utíkat |
| `healDesireThreshold` | 70–95% HP | Kdy hledá lékárničku |
| `confidenceMod` | 0.8–1.2 | Ochota bojovat v nevýhodě |
| `microDodgeMod` | 0.8–1.2 | Schopnost mikro-uhýbání |
| `maxGroupSize` | 2 nebo 3 | Počet nepřátel u věže kterých se nebojí |
| `personalWeights` | ±10% BOT_WEIGHTS | Individuální hodnotové odchylky |

---

## Difficulty modifier

Aplikuje se při spawnu bota jako absolutní bonus ke stats:
- `diffBonusHP = maxHp × (diffMod - 1.0)`
- Analogicky pro AD, AP, Armor, MR
- Neztrácí se přes `recalcPlayerItemStats` (jsou absolutní offsety)

---

## Sumoner spells (bot logika)

| Spell | Podmínka castování |
|-------|-------------------|
| Heal | HP < 50% NEBO ally < 50% HP v dosahu |
| Ghost | ATTACK state a target HP < 50% a d > 400 |
| Boost | ATTACK state a d < 300 |
| Exhaust | ATTACK state a d < 250 |
| Revive | Automaticky při smrti (cooldown 0) |

---

## Bestow AoE hint systém

`game.teamAoeHint[team]` — sdílený pointer na nejlepší AoE pozici (platný 800ms).

Pokud hint v dosahu a hits >= 1 → použij hint pozici s combo bonusem (dosah +350px).
Jinak hledej vlastní bestAoePos — nejlepší anchor nepřítel kde hits > minHits-1.

Notifikace: po každém nalezení vlastní AoE pozice bot zapíše hint pro tým.

---

## BOT_WEIGHTS (výchozí hodnoty)

```javascript
attackVisionRange:         500
enemyBaseScore:            850
heroKillScore:             425
lowHpScore:                255
towerBaseScore:          11500
laneMatchScore:           5750
neutralTowerScore:        6900
emptyTowerScore:          3450
overcrowdedTowerPenalty: 20000
minionPushBaseScore:     20700
objectiveHysteresis:      1500
objectiveFocusThreshold: 14950
healScore:               14000
powerupScore:            16000
enemyBasePenalty:       100000
```
