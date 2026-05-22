# UTF Arena — Gameplay Reference

## Herní módy

### Classic (Dominion)
- **Mapa:** Kruhová, 5 věží
- **Cíl:** Snižuj soupeřův Nexus na 0 HP
- **Starting Nexus HP:** 500
- **Nexus drain:** Dle tower lead — čím více věží držíš, tím rychleji soupeři teče Nexus
- **Domácí věže** (tým 0): indexy 0, 4 | (tým 1): indexy 2, 3
- **Minionové:** Spawnují z kontrolovaných věží směrem k sousední nepřátelské věži (4 per pulse: 2 melee + 2 ranged)
- **Gold:** Standardní rate

### Speed
- Identické s Classic, ale:
  - Starting Nexus HP: **350** (místo 500)
  - Pasivní gold/exp rate: **3× rychlejší**
  - Hry trvají výrazně kratší dobu

### ARAM
- **Mapa:** Lineární 1-linková
- **Cíl:** Zničit nepřátelskou base věž (HP 2500)
- **Tower HP:** Outer 1500 → Inner 2000 → Base 2500
- **Tower útok:** 150 damage
- **Minionové:** Spawn každých 15s — 3 melee + 2 ranged per tým
- **Pohyb:** Jen jedna linka, čelní střet
- **Žádné jungle kempy, žádný powerup**

### Arena
- **Mapa:** Elliptická arena, 4v4
- **Cíl:** První tým na **150 bodů** vítězí
- **Bodování:**
  - Držení centrální věže: +3 body každých 6s
  - Kill: +1 bod
  - **Minion dosažení nepřátelské věže: +2 body** (minion musí fyzicky dosáhnout k enemy base tower)
- **1 neutrální věž** uprostřed (zamčená prvních ~20s)
- **Jungle kempy:** 6 kempů s buffy (2× AS_AH, 2× POWER, 2× TANK)
  - Respawn: 60s po zabití (150s po prvním spawnu)
  - HP: 1000, AD: 42
- **Jungle buffy (trvání 120s):**
  - POWER: +power boost
  - AS_AH: +attack speed & ability haste
  - TANK: +tank stats
- **4 heal pickupy** rozmístěné na mapě
- **Fáze hry:**
  1. **Jungle phase** (věž zamčená): Boti farmí jungle kempy na vlastní straně; 1 FIGHTER/TANK eskortuje miniony
  2. **Tower phase** (věž odemčena): Boj o střední věž; 1 bot farmí/eskortuje miniony, zbytek drží věž
  3. Věž přiděluje miniony vlastnímu týmu každých 20s (melee + ranged)

---

## Hrdinové

### Základní stats přehled

| Hrdina | Role | Typ | HP | Armor | MR | Speed |
|--------|------|-----|----|-------|----|-------|
| Vanguard | FIGHTER | physical | 820 | 35 | 30 | 120 |
| Jirina | FIGHTER | magical | 780 | 38 | 38 | 118 |
| Bruiser | FIGHTER | physical | 760 | 33 | 28 | 120 |
| Ironclad | TANK | physical | 780 | 36 | 32 | 110 |
| Hana | TANK | magical | 760 | 29 | 29 | 118 |
| Jailer | TANK | magical | 820 | 34 | 34 | 105 |
| Goliath | TANK | physical | 800 | 34 | 36 | 106 |
| Lynx | SLAYER | physical | 680 | 28 | 28 | 130 |
| Zephyr | SPLITPUSHER | magical | 750 | 31 | 31 | 135 |
| Reaper | SPLITPUSHER | magical | 650 | 28 | 30 | 120 |
| Wanderer | SLAYER | physical | 700 | 31 | 31 | 125 |
| Kratoma | SLAYER | physical ranged | 650 | 28 | 28 | 115 |
| Quiller | SLAYER | physical ranged | 620 | 25 | 27 | 110 |
| Fusilier | SLAYER | physical ranged | 670 | 27 | 28 | 115 |
| Volstrov | MAGE | magical ranged | 720 | 32 | 34 | 118 |
| Mage | MAGE | magical ranged | 720 | 34 | 36 | 112 |
| Summoner | MAGE | magical ranged | 710 | 31 | 28 | 108 |
| Pyromancer | SLAYER | magical ranged | 660 | 28 | 31 | 115 |
| Tamer | MAGE | magical ranged | 600 | 21 | 26 | 110 |
| Healer | SUPPORT | magical ranged | 700 | 40 | 35 | 104 |
| Cleric | SUPPORT | magical ranged | 680 | 27 | 30 | 108 |
| Eggchanter | SUPPORT | magical ranged | 690 | 27 | 30 | 105 |
| Oracle | MAGE | physical ranged | 670 | 28 | 31 | 110 |
| Doctor | SUPPORT | physical melee | 650 | 27 | 27 | 118 |

### Level scaling (per level)

| Hrdina typ | HP/lvl | Armor/lvl | MR/lvl | Power/lvl |
|------------|--------|-----------|--------|-----------|
| FIGHTER | +28–35 | +1.0 | +0.7–0.8 | +1.8–2.2 |
| TANK | +35–42 | +0.9–1.4 | +1.3–1.7 | +2.0–2.3 |
| SLAYER/MAGE | +10–11 | +0.2–0.3 | +0.2–0.4 | +1.4–1.5 |
| SUPPORT | +12 | +0.5–0.7 | +0.5–0.6 | +1.2 |

### Útočný dosah

- **Melee:** ~50px (`MELEE_ATTACK_RANGE`)
- **Ranged:** ~160–205px (`RANGED_ATTACK_RANGE`) — liší se per hrdina

---

## Kouzla (Spelly)

### Q kouzla per hrdina

| Hrdina | Q typ | CD | Efekt |
|--------|-------|-----|-------|
| Vanguard | dash + slow | 6.0s | Dash 170px, dmg 75 (AD 0.20), slow 40% 1.5s |
| Jirina | aoe_knockback | 5.5s | Knockback 145px, dmg 65 (AP 0.60) |
| Bruiser | projectile + slow | 6.0s | Piercing projektil, dmg 60 (AD 0.40), slow 25% 1s |
| Ironclad | shield | 9.5s | Shield 125 na 4s, exploduje při přerušení (8% bonus MaxHP dmg) |
| Hana | hana_q (buff) | 12.0s | 5s buff: ataky způsobují +2.7% max HP dmg, AS ×1.25 |
| Jailer | projectile_pull | 10.0s | Hook, dmg 55 (AP 0.50), přitáhne nepřítele (9% bonus MaxHP dmg) |
| Goliath | dash (unstoppable) | 7.5s | Nestopovatelný dash 180px, dmg 25 (AD 0.35 + 3.75% current HP) |
| Lynx | cone (3 daggers) | 5.0s | 3 dýky v kuželu, dmg 45 (AD 0.20) |
| Zephyr | buff_ms | 10.0s | +20% MS na 3s |
| Reaper | reaper_q (buff) | 10.0s | 4s buff, 3 nabité útoky: extended range +70, slow 40% 1s |
| Wanderer | spin_to_win | 9.0s | Spin 2s, dmg 25/tick (AD 0.30), radius 80 |
| Kratoma | projectile + summon | 13.0s | Projektil + Pheasant (50 HP, 30 AD, 6s lifetime) |
| Quiller | long bolt | 6.5s | Dálkový výstřel, dmg 40 (AD 0.40) |
| Fusilier | cone (5 shots) | 6.0s | 5 výstřelů v kuželu, dmg 25 (AD 0.20) |
| Volstrov | volstrov_q (buff) | 13.0s | 3s buff: range +80, pierce all, +50% AS, -50% MS |
| Mage | projectile | 3.9s | Projektil, dmg 95 (AP 0.65) |
| Summoner | projectile + silence | 6.0s | Shadow bolt, dmg 55 (AP 0.80), silence 1s, slow 60% 1s |
| Pyromancer | flamethrower | 8.0s | 3s flamethrower, range 160, kužel 40°, dmg 250 (AP 1.07) |
| Tamer | tamer_q (mark) | 7.0s | Magická sféra, dmg 76 (AP 0.45), označí nepřítele |
| Healer | projectile + slow | 5.5s | Paprsek světla, dmg 65 (AP 0.60), slow 50% 1.5s |
| Cleric | heal_aoe | 6.0s | Léčivá vlna AoE 120px, heal 80 (AP 0.65) |
| Eggchanter | projectile_egg | 8.0s | Vejce, dmg 30 (AP 0.83), heal 6.6, slow 20% 0.5s |
| Oracle | aoe_pull_stun | 13.0s | Orb AoE 120px, dmg 90 (AD 0.30), pull + stun 1.2s |
| Doctor | heal_beam | 6.2s | Léčivý paprsek (toggle), heal 2.6/tick (AD 0.065), range 200 |

### E kouzla per hrdina

| Hrdina | E typ | CD | Efekt |
|--------|-------|-----|-------|
| Vanguard | aoe | 8.0s | AoE slam 140px, dmg 90 (AD 0.25) |
| Jirina | heal_aoe | 9.0s | Heal AoE 200px, heal 60 (AP 0.45), léčí i sebe |
| Bruiser | dash | 9.0s | Dash 150px, dmg 45 (AD 0.35), radius 110 |
| Ironclad | aoe_stun | 10.5s | AoE slam 135px, dmg 70 (AD 0.25), stun 1s |
| Hana | dash + slow | 7.5s | Dash 180px, dmg 65 (AP 0.50), slow 70% 1.5s |
| Jailer | aoe_slow | 8.0s | AoE slam 120px, dmg 70 (AP 0.40), slow 55% 2s |
| Goliath | dash_heal_silence | 11.0s | Krátký dash 50px, heal 80, silence 1.5s (AoE 120px) |
| Lynx | dash (short AoE) | 8.0s | Krátký dash 50px, dmg 75 (AD 0.35), +10% MS 1s |
| Zephyr | aoe_knockback | 5.0s | Air burst 90px, dmg 70 (AP 0.80 + AD 0.20), knockback |
| Reaper | reaper_e (dash+reset) | 14.0s | Dash 75px, shield, +40% MS 1.5s, resetuje Q |
| Wanderer | omnislash | 16.0s | 5 blinků k nepřátelům, dmg 40 (AD 0.40) za blink |
| Kratoma | buff_ad_as | 12.0s | 4s buff: +25% AD+AS, shield 40 |
| Quiller | long dash | 13.0s | Dlouhý dash 250px |
| Fusilier | cone_knockback | 12.0s | Obloukovitý AoE knockback 80px, dmg 68 (AD 0.35) |
| Volstrov | volstrov_e (dash+shield) | 10.0s | Dash 60px, shield (AP 0.30), snižuje Q CD o 50% |
| Mage | aoe_slow | 8.0s | AoE exploze 200px, dmg 95 (AP 0.70), slow 80% 0.5s |
| Summoner | summon (2 ghoulové) | 12.0s | 2 ghoulings, 8s lifetime, způsobují 15% maxHP/sec |
| Pyromancer | cone_knockback | 10.0s | Ohnivá exploze 140px, dmg 60 (AP 0.55), knockback |
| Tamer | tamer_e (heal pet) | 12.0s | Heal/revive Wolf, heal 195 (AP 0.60) |
| Healer | heal_aoe | 8.0s | Léčivá vlna 200px, heal 150 (AP 0.80) |
| Cleric | cone (3 bolts) | 6.5s | 3 blesky v kuželu, dmg 45 (AP 0.65), silence 1s |
| Eggchanter | summon_healers | 18.0s | Spawn 3 kuřátek, léčí každé 2s (AP 0.46) |
| Oracle | shield_aoe | 14.0s | Štít sebe + allies AoE 250px, shield 80 (AD 0.50), 5s |
| Doctor | cone_slow_shield | 12.0s | Slash vpřed, dmg 60 (AD 0.20), slow 60% 1.5s, shield 90 |

---

## Itemy

### Basic itemy (250g base, +25g za každý stejný)

| Item ID | Efekt |
|---------|-------|
| `basic_power` | +8% base power (adaptive AD/AP), +7 flat power |
| `basic_hp` | +5% base HP, +55 flat HP |
| `basic_armor` | +10% base armor, +3 flat armor |
| `basic_mr` | +10% base MR, +3 flat MR |
| `basic_haste` | +13 flat ability haste |
| `basic_as` | +0.12 flat attack speed |

### Special itemy (500g base, +40g za každý stejný)

| Item ID | Efekt | Max stack |
|---------|-------|-----------|
| `special_lifesteal` | +5% lifesteal | 25% |
| `special_heal_power` | +15% heal power | 45% |
| `special_movespeed` | +4% move speed | 20% |
| `special_pen` | +18% adaptive penetration | 60% |
| `special_burn` | +1.5% max HP AoE burn | 4.5% |
| `special_strike_burn` | +1.5% max HP strike burn | 4.5% |
| `special_slow` | +6% on-hit slow | 30% |
| `special_gw` | +20% grievous wounds (anti-heal) | 60% |

### Upgrade systém

Každý item lze koupit vícekrát (stack). Cena roste o 25g/50g za každý stack.  
Boti mají stack penalty při opakovaném nákupu stejného itemu (score ×0.3–0.6).

### Zlaté příjmy

- Minion kill: standardní odměna
- Hero kill: standardní odměna
- Pasivní gold: každý tick (Speed mód: 3× vyšší)

---

## Herní mechaniky

### Damage typy
- **Physical** — redukován Armor
- **Magical** — redukován MR
- **True damage** — neovlivněn resistencemi

### Damage výpočet
```
effectiveDamage = rawDamage × (100 / (100 + resistance × (1 - penetration)))
```

### CC efekty
| CC | Popis |
|----|-------|
| **Stun** | Zastaví veškerý pohyb a casting |
| **Slow** | Snižuje pohybovou rychlost (% modifier) |
| **Silence** | Blokuje kouzla (ale ne basic ataky) |
| **Knockback** | Fyzicky odhodí jednotku |
| **Terrified** | Bot panicky prchá (interní AI stav) |

### HP Regenerace
- Každý hrdina má `hpRegen` stat (~2.0/s base)
- Regenový buff: přidatelný z itemů a spellů

### Shield
- Absorbuje damage před HP
- Vyprší časovačem nebo se spotřebuje
- Ironclad shield: Exploduje (bonus max HP dmg) při přerušení

### Powerup (Classic/Speed/Arena)
- Silný buff pro tým který ho drží
- Dává velkou combat výhodu
- Boti jej aktivně prioritizují (priorityScore 16 000)

### Heal pickupy (Classic/Speed/ARAM/Arena)
- Ležící lékárničky na mapě
- Arena má 4 heal pickupy
- Boti je hledají při HP < healDesireThreshold (70–95%)
- Po sebrání jsou dočasně neaktivní; boti automaticky invalidují sebrané heal objetivy (anti-freeze)

### Respawn
- Fixní `respawnTime = 5s` (base)
- Summoner spell `Revive`: okamžitá revivifikace (s CD)

---

## Summoner spelly

| Spell | Efekt |
|-------|-------|
| **Heal** | Léčí sebe i blízkého spojence |
| **Ghost** | +MS buff na čas |
| **Boost** | Dočasný silový boost (nestopovatelný) |
| **Exhaust** | Zpomalí a oslabí nepřítele |
| **Revive** | Okamžitě oživí při smrti (dlouhý CD) |
| **Flash** | Krátký blink (teleport) |

---

## Věže (Towers)

### Typy věží per mód
- **Classic/Speed:** 5 věží v kruhu, 2 domácí per tým
- **ARAM:** 3 věže per tým v řadě (outer → inner → base)
- **Arena:** 1 centrální neutrální věž

### Tower capture
- Hráč/bot musí stát v `captureRadius` věže
- Kontrola se postupně mění (hodnota `control`)
- Vlastnění věže spouští minion spawn (Classic) nebo dává body (Arena)

### Tower útok (ARAM)
- Útočí automaticky na nepřátele v dosahu
- Damage: 150 za útok

---

## Jungle kempy (Arena)

| Buff typ | Strany mapy | Respawn | Efekt |
|----------|-------------|---------|-------|
| POWER | Obě strany (po 1) | 60s | Zvýší AP/AD +% na 120s |
| AS_AH | Obě strany (po 1) | 60s | Zvýší attack speed + ability haste na 120s |
| TANK | Obě strany (po 1) | 60s | Zvýší HP + resistence na 120s |

**Preferenční logika (ze strany AI):**
- TANK buff: TANK > SUPPORT > FIGHTER role
- POWER buff: magical SLAYER > FIGHTER > SLAYER
- AS_AH buff: physical SLAYER > SPLITPUSHER > FIGHTER

---

## Role systém

| Role | Primární úkol | Silné stránky |
|------|---------------|---------------|
| FIGHTER | All-around combat + push | Vyváženost, schopnost teamfightu i split push |
| TANK | Absorbovat damage, peel | Nejvyšší EHP, CC kouzla |
| SLAYER | Burst dmg, kill carry | Vysoký damage, nízká HP |
| SPLITPUSHER | Capture věží, roaming | Pohyblivost, samostatná akce |
| SUPPORT | Heal/buff spolubojovníků | Heal, CC, šitily, teamfight utility |
| MAGE | Ability damage + CC | Vysoký AP dmg, spellové efekty |

### Rolové weight modifikátory (AI prioritizace)

| Role | Hlavní odchylka od base |
|------|------------------------|
| SPLITPUSHER | heroKillScore ×0.2 (classic) / ×0.8 (arena), towerScore ×1.8 / ×1.2 |
| SLAYER | heroKillScore ×1.6, lowHpScore ×2.2, visionRange ×1.25 |
| TANK | heroKillScore ×0.8, towerScore ×1.3 |
| FIGHTER | minionPushScore ×1.5, heroKillScore ×1.1 |

---

## Damage scaling (attack)

| Hrdina | AA scale |
|--------|----------|
| Vanguard | AD ×0.55 |
| Jirina | AP ×0.35 |
| Bruiser | AD ×0.60 |
| Ironclad | AD ×0.45 |
| Hana | AP ×0.40 |
| Jailer | AP ×0.40 |
| Goliath | AD ×0.50 |
| Lynx | AD ×0.60 |
| Zephyr | AP ×0.35 |
| Reaper | AP ×0.40 |
| Wanderer | AD ×0.55 |
| Kratoma | AD ×0.50 |
| Quiller | AD ×0.75 |
| Fusilier | AD ×0.70 |
| Volstrov | AP ×0.60 |
| Mage | AP ×0.20 |
| Summoner | AP ×0.20 |
| Pyromancer | AP ×0.20 |
| Tamer | AP ×0.20 |
| Healer | AP ×0.20 |
| Cleric | AP ×0.20 |
| Eggchanter | AP ×0.20 |
| Oracle | AD ×0.65 |
| Doctor | AD ×0.40 |

---

## Síťová architektura (relevantní pro gameplay)

- **Server-authoritative:** Veškerý damage, heal, kills se počítá na serveru
- **Client-side prediction:** Lokální hráč má okamžitý pohyb (bez čekání na server)
- **Serverová korekce:** Snap >150px, lerp 30–150px, ignoruj <30px
- **Broadcast Fast** (~20×/s): pozice, HP, projektily, CC opravy
- **Broadcast Slow** (~4×/s): gold, stats, inventář, levely, bot roster
- Boti běží plně na serveru — klient je jen zobrazuje

---

## PCS systém (Player Combat Score)

Composite skóre hodnotící výkon hráče/bota:

| Složka | Weight/jednotku |
|--------|----------------|
| Kill | +120 |
| Assist | +75 |
| Death | -180 |
| Damage dealt | ×0.02 |
| HP healed | ×0.05 |
| Tower capture | +1 400 |
| Tower defend time | ×60/s |
| Tower assault time | ×16/s |
| Objective presence | ×6/s |
| Powerup collected | +300 |
| Powerup uptime | ×4/s |
