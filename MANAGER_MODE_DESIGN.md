# UTF Arena Manager — Design Document
> Esports management simulátor postavený na UTF Arena enginu.
> Verze 0.1 | Datum: 2026-06-09

---

## 1. Vize a koncept

**UTF Arena Manager** je single-player hra stylem Football Manageru, kde hráč řídí
profesionální esportový tým, který soutěží v turnajích ve hře **UTF Arena**.

Hráč nekontroluje postavy přímo — místo toho:
- Nabírá a propouští **skutečné esportové hráče** (lidi se jménem, věkem, stats)
- Každý esportový hráč hraje **za hrdinu** (class z classes.js)
- Nastavuje **strategii týmu** před každým zápasem
- Sleduje **simulaci zápasu** (headless, nebo s vizualizací) pomocí existujícího Simulation.js
- Čte **statistiky** z SimStats.js a rozhoduje o dalším postupu
- Podepisuje **smlouvy**, kupuje/prodává hráče na **transferovém trhu**
- Postupuje **turnaji** a sbírá peníze, reputaci, prestiž

---

## 2. Využití existující codebase

Toto je klíčová část — co PŘEBÍRÁME beze změny:

### 2.1 Simulační jádro (90 % beze změny)

| Soubor | Co poskytuje | Využití v Manageru |
|--------|-------------|-------------------|
| `Simulation.js` | Headless batch simulátor, 20 FPS, až 10 000 her | **Základ simulace každého zápasu** |
| `SimStats.js` | PlayerTracker, GameTracker, computeAggregateStats | **Veškeré statistiky hráčů po zápase** |
| `SimUI.js` | UI panel s konfigurací simulace | **Přepracujeme jako "Scout/Analysis" panel** |
| `BotBrain.js` | AI rozhodování botů | Boty = hráči bez instrukce trenéra |
| `classes.js` | 25 hrdinů (Vanguard, Lynx, Oracle...) s plnými stats | **Roster hrdinů, které hráči hrají** |
| `items.js` | Item systém | **Vybavení / build pro každého hráče** |
| `GameMode_*.js` | Arena, Classic, Speed, ARAM | **Formáty zápasů v turnajích** |

### 2.2 Co se upraví minimálně

- `Simulation.js` — přidáme **hráčský koeficient** (viz sekce 4.3)
- `BotBrain.js` — přidáme hook pro **trenérskou strategii**
- `SimStats.js` — přidáme ukládání výsledků do **Manager State** (JSON)

### 2.3 Co se postaví nově

- `ManagerState.js` — centrální datový model (tým, hráči, finance, turnaje)
- `ManagerUI.js` — celé UI manažerské části (HTML/CSS, bez Canvas)
- `PlayerMarket.js` — generátor a logika transferového trhu
- `TournamentEngine.js` — bracket systém, rozvrh zápasů, elos
- `ManagerSim.js` — wrapper nad Simulation.js, který aplikuje hráčské koeficienty

---

## 3. Datové modely

### 3.1 EsportPlayer (skutečný člověk)

```js
{
  id: 'player_001',
  name: 'Jan "xBlade" Novák',
  age: 21,
  nationality: 'CZ',
  contractValue: 12000,     // měsíční plat v "credits"
  contractExpiry: 'S3',     // vyprší po sezóně 3
  marketValue: 85000,       // přestupní cena
  isOnMarket: false,

  // Herní stats (1–100)
  stats: {
    mechanics:   87,   // přesnost, reflexy → ovlivňuje DMG output hrdiny
    gameIQ:      72,   // rozhodování, spell timing → ovlivňuje spell casts efektivitu
    teamwork:    65,   // kooperace → ovlivňuje assists a kill participation
    consistency: 80,   // variance výkonu (vyšší = méně výkyvů)
    clutch:      55,   // výkon pod tlakem (finálová série, tie-breaker)
    stamina:     70,   // výkon v pozdní fázi turnaje (fatigue systém)
  },

  // Specializace hrdinů (affinity)
  heroAffinity: {
    Lynx:     90,   // tento hráč je specialist na Lynx
    Fusilier: 75,
    Nemesis:  40,
  },
  preferredRoles: ['CARRY', 'FIGHTER'],

  // Progrese
  form: 0.9,          // aktuální forma (0.5–1.2), mění se každý turnaj
  fatigue: 0,         // 0–100, roste s počtem her za den
  experience: 1240,   // celkové XP, ovlivňuje leveling stats
  potential: 92,      // maximální možný mechanics (skrytý atribut)

  // Historie
  careerStats: { wins: 42, losses: 18, mvps: 7 },
}
```

### 3.2 Team

```js
{
  id: 'team_player',
  name: 'Nova Esports',
  logo: '⚡',
  budget: 250000,           // celkový budget
  monthlyExpenses: 45000,   // součet platů
  reputation: 62,           // 0–100, ovlivňuje které hráče lze naverbovat
  roster: ['player_001', 'player_002', ...],  // max 8 hráčů, 5 aktivních
  activeLineup: ['player_001', ...],          // 5 hráčů pro aktuální zápas

  // Taktika
  strategy: {
    playstyle: 'aggressive',  // 'aggressive' | 'defensive' | 'balanced' | 'poke'
    draftPriority: 'tankComp', // 'tankComp' | 'burstComp' | 'healComp' | 'mixedComp'
    laneAssignments: {
      player_001: { hero: 'Lynx', role: 'CARRY' },
      player_002: { hero: 'Vanguard', role: 'TANK' },
    },
    itemPresets: {
      Lynx: ['ShadowBlade', 'CritOrb', 'SwiftBoots'],
    },
  },

  history: [],   // záznamy odehraných zápasů
}
```

### 3.3 Tournament

```js
{
  id: 'tournament_001',
  name: 'UTF Arena Spring Split S1',
  tier: 'Challenger',    // 'Amateur' | 'Challenger' | 'Pro' | 'Masters'
  format: 'double_elim', // 'single_elim' | 'double_elim' | 'round_robin'
  gameMode: 'arena',
  prizePool: 100000,
  teams: ['team_player', 'team_nova', ...],  // 8–16 týmů
  bracket: [ /* Match objekty */ ],
  currentRound: 2,
  status: 'ongoing',     // 'upcoming' | 'ongoing' | 'finished'
}
```

### 3.4 Match (výsledek jednoho zápasu)

```js
{
  id: 'match_042',
  tournamentId: 'tournament_001',
  teamA: 'team_player',
  teamB: 'team_rival',
  format: 'bo3',           // 'bo1' | 'bo3' | 'bo5'
  results: [               // jeden záznam per game
    {
      winner: 'team_player',
      duration: 847,       // sekund (z SimStats)
      simResults: { /* raw SimStats GameRecord */ },
      playerPerformances: [
        { playerId: 'player_001', heroPlayed: 'Lynx', kda: 8.5, mvp: true, ... }
      ],
    }
  ],
  finalWinner: 'team_player',
  date: 'S1W3',            // Sezóna 1 Týden 3
}
```

---

## 4. Klíčové systémy

### 4.1 Hráčský koeficient v simulaci

Toto je **nejdůležitější mechanika** — jak se skutečný hráč promítne do Simulation.js.

Simulation.js spouští headless boty přes `BotBrain.js`. Přidáme jeden hook:

```js
// ManagerSim.js — wrapper
function applyPlayerCoefficient(botPlayer, esportPlayer) {
  const s = esportPlayer.stats;
  const affinity = esportPlayer.heroAffinity[botPlayer.className] || 50;
  const form = esportPlayer.form;
  const fatigue = 1 - (esportPlayer.fatigue / 200); // max -50% při max fatigue

  // Mechanics → DMG multiplikátor
  botPlayer._dmgMult = (s.mechanics / 100) * (affinity / 100) * form * fatigue;

  // GameIQ → spell cast frequency a accuracy (hook do BotBrain)
  botPlayer._spellIQMult = s.gameIQ / 100;

  // Teamwork → assist bonus (hráč s vyšším teamwork dostane více kill participations)
  botPlayer._assistMult = s.teamwork / 100;

  // Consistency → variance (nizka consistency = vice outliers)
  const variance = 1 - (s.consistency / 200); // 0.5 → ±50%, 1.0 → ±0%
  botPlayer._variance = variance;

  // Clutch → aktivuje se pokud je tým pozadu (score, HP nexusu, atd.)
  botPlayer._clutchBonus = s.clutch / 100;
}
```

**Kde se hook zapíná:**
- `Simulation.js:_initNextGame()` — po `startGame()` projdeme `game.players` a mapujeme je na esport hráče
- `BotBrain.js` — přidáme `if (bot._spellIQMult)` podmínky pro spell timing

Tím pádem **Simulation.js zůstane nedotčen** — veškerá logika je ve wrapperu.

### 4.2 Draft systém

Před každým zápasem trenér (hráč) nastaví:
1. **Lineup** — kteří 5 hráčů nastoupí
2. **Hero assignment** — kdo hraje jakého hrdinu (s respektem k heroAffinity)
3. **Playstyle** — aggressive/defensive (modifikuje BotBrain agresivitu)
4. **Item preset** — preferovaný build pro každého hrdinu (přepíše BotBrain item buying)

Každý soupeřní tým má svůj vlastní draft (generovaný AI trenérem).

### 4.3 Transfer Market

Každý týden (herní čas) se trh aktualizuje:

```js
// PlayerMarket.js
class PlayerMarket {
  generateWeeklyOffers(season, managerReputation) {
    // Generuje pool dostupných hráčů
    // Kvalita hráčů záleží na reputaci manažera
    // Ceny fluktuují dle formy a výsledků
  }

  calculateTransferFee(player) {
    const ageFactor = player.age < 23 ? 1.4 : player.age > 27 ? 0.7 : 1.0;
    const formFactor = player.form;
    const potentialFactor = player.potential / 100;
    return Math.round(player.marketValue * ageFactor * formFactor * potentialFactor);
  }

  triggerBuyout(playerId, offerAmount) {
    // Soupeřní tým nabídne odkoupení tvého hráče
  }
}
```

### 4.4 Tournament Engine

```js
// TournamentEngine.js
class TournamentEngine {
  generateSeason(tier, numTeams) {
    // Vygeneruje turnaj pro danou úroveň
  }

  simulateMatch(teamA, teamB, format) {
    // Spustí ManagerSim (který používá Simulation.js)
    // Bo3/Bo5 = 2–5 her, každá s jinými drafty
    // Vrátí Match objekt se statistikami
  }

  calculateElo(teamA, teamB, result) {
    // Elo systém pro ranking týmů
  }

  distributeRewards(tournament) {
    // Rozdá prize pool, prestiž, nabídky hráčů vítězům
  }
}
```

### 4.5 Progrese hráčů

Po každém zápase / turnaji:

```js
function updatePlayerAfterMatch(esportPlayer, performance) {
  // Forma
  const targetForm = performance.mvp ? 1.15 : performance.kda > 5 ? 1.05 : 0.9;
  esportPlayer.form = lerp(esportPlayer.form, targetForm, 0.3);

  // Fatigue (roste během turnaje)
  esportPlayer.fatigue = Math.min(100, esportPlayer.fatigue + 15);

  // XP a leveling stats
  esportPlayer.experience += performance.mvp ? 150 : 80;
  if (esportPlayer.experience >= nextLevelThreshold(esportPlayer)) {
    levelUpPlayer(esportPlayer);
  }

  // Hero affinity (více her na hrdinovi = vyšší affinity)
  const hero = performance.heroPlayed;
  esportPlayer.heroAffinity[hero] = Math.min(100,
    (esportPlayer.heroAffinity[hero] || 30) + 3
  );
}
```

### 4.6 Friendly Match (přátelák)

Hráč může kdykoli **spustit přátelský zápas** — použije vlastní tým vs. AI tým nebo konkrétního soupeře:
- Vlevo panel s výběrem soupeře, game módu, formátu
- Spustí `SimulationEngine.start()` s konfigurací z managera
- Po doběhnutí zobrazí detailní statistiky (identické se SimStats výstupem)
- Nemá vliv na turnajové výsledky, ale hráči sbírají hero affinity a XP

---

## 5. Obrazovky (UI)

Veškeré UI je **čistý HTML/CSS** (žádný Canvas). Existující Canvas se použije pouze
pro volitelnou vizualizaci průběhu zápasu (spectate mode).

### 5.1 Mapa obrazovek

```
[MAIN MENU]
    │
    ├── [NEW CAREER]  → výběr startovního týmu, budget, tier
    │
    └── [LOAD CAREER]

[MANAGER HUB] ← hlavní obrazovka, vždy dostupná
    │
    ├── [TEAM OVERVIEW]
    │     ├── Roster tabulka (5 aktivních + bench)
    │     ├── Lineup editor (drag & drop hráčů)
    │     └── Strategie & Draft nastavení
    │
    ├── [PLAYERS]
    │     ├── Karta každého hráče (stats, form, affinity, smlouva)
    │     ├── Srovnání hráčů (side-by-side)
    │     └── Tréninkový plán (zvyšování stats za cenu credits)
    │
    ├── [TRANSFER MARKET]
    │     ├── Dostupní hráči (filtr dle role, stat, ceny)
    │     ├── Nabídky na tvoje hráče
    │     └── Sledovaní hráči (watchlist)
    │
    ├── [TOURNAMENT]
    │     ├── Aktuální turnaj (bracket, výsledky, tabulka)
    │     ├── Nadcházející zápas (preview, soupeřova stats)
    │     └── Historie sezón
    │
    ├── [MATCH CENTER]
    │     ├── Simulate Match (rychle, jen výsledek)
    │     ├── Watch Match (spectate mode — Canvas vizualizace)
    │     ├── Friendly Match (přátelák kdykoli)
    │     └── Post-match anályza (statistiky ze SimStats)
    │
    ├── [ANALYTICS]  ← přímé napojení na SimStats
    │     ├── Statistiky týmu (agregát přes sezónu)
    │     ├── Hero performance (která class funguje nejlépe)
    │     ├── Heatmapy draftů
    │     └── Export CSV (přebírá exportCSV z SimStats.js)
    │
    └── [FINANCES]
          ├── Budget přehled
          ├── Platy hráčů
          └── Prize pool history
```

### 5.2 Klíčové UI komponenty

#### Team Overview
```
┌─────────────────────────────────────────────────────┐
│  NOVA ESPORTS  ⚡    Season 2 Week 3    Budget: 214k │
├──────┬──────────────────┬──────┬──────┬─────────────┤
│  #   │  Hráč            │ Hero │ Role │ Form  Stats │
├──────┼──────────────────┼──────┼──────┼─────────────┤
│  1   │ xBlade           │ Lynx │ CARRY│ ●●●●○ 87M  │
│  2   │ TankPro          │ Van..│ TANK │ ●●●○○ 71M  │
│  3   │ MidGod           │ Orac.│ MAGE │ ●●●●● 92M  │
│  4   │ SupportKing      │ Heal.│ SUPP │ ●●●○○ 68M  │
│  5   │ JungleMaster     │ Argo │ JUNG │ ●●●●○ 83M  │
├──────┴──────────────────┴──────┴──────┴─────────────┤
│  [SIMULATE FRIENDLY]  [SET STRATEGY]  [VIEW STATS]  │
└─────────────────────────────────────────────────────┘
```

#### Player Card
```
┌─────────────────────────────────────────────┐
│  Jan "xBlade" Novák  🇨🇿  Věk: 21          │
│  Hodnota: 85,000 cr  |  Plat: 12,000/měs   │
│  Smlouva do: Sezóna 4                       │
├─────────────────────────────────────────────┤
│  STATS                                       │
│  Mechanics   ████████░░ 87                  │
│  Game IQ     ███████░░░ 72                  │
│  Teamwork    ██████░░░░ 65                  │
│  Consistency ████████░░ 80                  │
│  Clutch      █████░░░░░ 55                  │
│  Stamina     ███████░░░ 70                  │
├─────────────────────────────────────────────┤
│  HERO AFFINITY                               │
│  Lynx ●●●●●  Fusilier ●●●●○  Nemesis ●●○○○  │
├─────────────────────────────────────────────┤
│  Forma: ▲ 0.95  |  Fatigue: ██░░░░░░ 18%   │
│  Career: 42W / 18L  |  MVPs: 7             │
└─────────────────────────────────────────────┘
```

#### Post-Match Analytics (ze SimStats)
```
┌─────────────────────────────────────────────────────┐
│  MATCH RESULT: Nova Esports 2 — 1 Rival Team        │
│  Game 3 duration: 14:22                             │
├────────────┬──────┬───────┬──────┬──────┬───────────┤
│  Hráč      │ Hero │  KDA  │  DMG │ Gold │  Rating   │
├────────────┼──────┼───────┼──────┼──────┼───────────┤
│ xBlade  ★  │ Lynx │ 12.0  │ 18.4k│ 9240 │   9.2/10  │
│ MidGod     │ Orac │  8.5  │ 12.1k│ 8100 │   8.1/10  │
│ TankPro    │ Van. │  4.0  │  3.2k│ 6200 │   7.5/10  │
│ SupportKng │ Heal │  6.0  │  1.1k│ 5400 │   7.8/10  │
│ JungleMst  │ Argo │  5.5  │  9.8k│ 7800 │   7.2/10  │
├────────────┴──────┴───────┴──────┴──────┴───────────┤
│  [DETAILNÍ STATS]  [EXPORT CSV]  [REPLAY (WATCH)]   │
└─────────────────────────────────────────────────────┘
```

---

## 6. Sezónní struktura (herní čas)

```
SEZÓNA (16 týdnů)
│
├── Týden 1–2:   Draft sezóny + Transfer okno (kupuješ/prodáváš hráče)
├── Týden 3–10:  Základní část (round robin zápasy, každý týden 1–2 zápasy)
├── Týden 11:    Transfer okno #2 (zimní přestávka)
├── Týden 12–15: Playoff (bracket, bo3/bo5)
└── Týden 16:    Finále + Vyhlášení cen + Přechod do nové sezóny

Po každé sezóně:
- Hráči stárnou (věk++)
- Hráči nad 30 let začínají klesat v stats
- Young talents (věk 18-20) se mohou výrazně zlepšit
- Otevře se nový transferový trh
- Tým postoupí/sestoupí do vyšší/nižší tier ligy
```

---

## 7. Přátelský zápas — simulace v reálném čase

Hráč může kdykoli spustit "friendly" a sledovat zápas:

```
[FRIENDLY MATCH SETUP]
  Soupeř: [AI Team — Random] ▼
  Game Mode: [Arena] ▼
  Format: [Bo1] ▼
  Difficulty: [Hard] ▼
                    [SIMULATE FAST] [WATCH LIVE]

  [SIMULATE FAST] → headless Simulation.js, výsledek za ~200ms
  [WATCH LIVE]    → spectate mode (existující Canvas renderer)
                    Kamera sleduje automaticky (auto-spectate)
```

Pro "WATCH LIVE" se použije existující **spectate mode** z main.js — hráč prostě přihlíží
simulaci jako divák, vidí boje v reálném čase, může přepínat kameru.

---

## 8. Implementační plán

### Fáze 1 — Datový základ (3–5 dní)
- [ ] `ManagerState.js` — EsportPlayer, Team, Match datové modely
- [ ] `PlayerGenerator.js` — generátor náhodných hráčů (jména, stats, affinities)
- [ ] Ukládání/načítání stavu (localStorage JSON)
- [ ] Základní unit testy datových modelů

### Fáze 2 — Simulační wrapper (3–4 dny)
- [ ] `ManagerSim.js` — wrapper nad Simulation.js s koeficienty
- [ ] Hook do BotBrain pro hráčské stats
- [ ] Post-match rating kalkulace (10-scale rating z SimStats)
- [ ] Friendly match funkčnost (bez UI, jen konzole)

### Fáze 3 — Tournament Engine (4–5 dní)
- [ ] `TournamentEngine.js` — bracket generátor, round robin, double elim
- [ ] AI opponent teams (generátor soupeřních týmů)
- [ ] Elo / ranking systém
- [ ] Sezónní struktura (týdny, transfer okna)

### Fáze 4 — Transfer Market (3–4 dny)
- [ ] `PlayerMarket.js` — generátor nabídek, ceny, smlouvy
- [ ] Buy/sell flow (nabídka → přijetí/odmítnutí → přestup)
- [ ] AI týmy také kupují/prodávají hráče

### Fáze 5 — Manager UI (7–10 dní)
- [ ] Main layout (sidebar navigace, hlavní obsah)
- [ ] Team Overview obrazovka
- [ ] Player Card + srovnání
- [ ] Transfer Market obrazovka
- [ ] Tournament bracket zobrazení
- [ ] Post-match analytics (napojení na SimStats výstupy)
- [ ] Finances panel

### Fáze 6 — Leštění (3–5 dní)
- [ ] Animace výsledků (turnajové bracket animace)
- [ ] News feed (textové zprávy o dění v lize)
- [ ] Achievementy
- [ ] Sound efekty pro klíčové momenty

**Celkový odhad: 5–7 týdnů** pro solidní hratelný prototyp.

---

## 9. Technická architektura (souborová struktura)

```
UTF-ARENA-main/
│
├── [EXISTUJÍCÍ — beze změny]
│   ├── Simulation.js
│   ├── SimStats.js
│   ├── SimUI.js
│   ├── classes.js
│   ├── items.js
│   ├── BotBrain.js
│   ├── GameMode_*.js
│   └── server.js (multiplayer — nedotčen)
│
├── [EXISTUJÍCÍ — minimální úpravy]
│   ├── main.js         (přidání spectate auto-cam pro watching)
│   └── BotBrain.js     (hook pro trenérskou strategii)
│
└── [NOVÉ — Manager mode]
    ├── manager/
    │   ├── ManagerState.js       (datové modely, save/load)
    │   ├── ManagerSim.js         (wrapper nad Simulation.js)
    │   ├── PlayerGenerator.js    (generátor hráčů)
    │   ├── PlayerMarket.js       (transferový trh)
    │   ├── TournamentEngine.js   (bracket, elo, sezóny)
    │   └── ManagerUI.js          (celé HTML/CSS UI)
    │
    ├── manager.html              (standalone stránka pro manager mode)
    └── manager.css               (styling manažerského UI)
```

---

## 10. Klíčové designové rozhodnutí

### A) Proč wrapper místo úpravy Simulation.js?
Simulation.js je stabilní, dobře otestovaný engine. Wrapper pattern zachovává zpětnou
kompatibilitu — balance tool a SimUI fungují dál beze změny.

### B) Proč headless simulace, ne live?
- Rychlost: zápas bo3 = 3 hry × ~10 min = 30 min live vs. ~500ms headless
- Hráč si může kdykoli zvolit "WATCH" pro vizuální zážitek
- Turnajové kolo s 8 týmy = 4 simultánní zápasy → headless nutnost

### C) Jak funguje hero affinity?
Hráč s `heroAffinity[Lynx] = 90` dostane `dmgMult = 0.9 × 0.9 = 0.81` base vs
`heroAffinity[Lynx] = 30` → `dmgMult = 0.87 × 0.3 = 0.26`. Specialisté na hrdinu
výrazně překonávají generalisty — nutí manažera myslet na draft.

### D) Jak se určuje "AI trenér" soupeřního týmu?
AI trenér soupeře je zjednodušená verze PlayerMarket.js heuristiky:
- Vybere hrdiny s nejvyšší hero affinity svých hráčů
- Přiřadí playstyle dle průměrného mechanics vs. gameIQ ratia
- Preferuje statisticky silné herdy (tier list z BALANCE_ANALYSIS.txt!)

### E) Integrace s existujícím balance systémem
`simulations/` složka + `BALANCE_ANALYSIS.txt` = **reálná data** o win rates hrdinů.
AI trenér (a hráčský draft advisor) tato data využívají — pokud je Oracle S-tier (66% WR),
AI ho draftuje s vyšší prioritou. Tím se reálná balance hry promítne do managera.

---

## 11. Příklad herní smyčky (jeden herní den)

```
1. Otevřeš Manager Hub
   → Vidíš: "ZÁPAS DNES: Nova Esports vs. Cyber Dragons (bo3, Arena)"

2. Přejdeš na PLAYERS
   → xBlade má fatigue 45 (unavený po včerejším přáteláku)
   → Zvažuješ ho vyměnit za benche (JungleMaster má fatigue 10)

3. Přejdeš na TOURNAMENT → Nadcházející zápas
   → Vidíš statistiky soupeře: Cyber Dragons hrají tank comp, hlavní hráč na Vanguard
   → Draft advisor doporučuje Pyromancer (counter na tanky)

4. Nastavíš lineup a strategii:
   → xBlade OUT (odpočinek), JungleMaster IN
   → Hero: Lynx → Fusilier (vyšší affinity pro JungleMastera)
   → Playstyle: Poke (counter na tank comp)

5. Klikneš [SIMULATE MATCH]
   → Výsledek: Nova Esports 2 — 1 Cyber Dragons ✓
   → MidGod byl MVP (Oracle, KDA 11.0)

6. Post-match:
   → MidGod forma ↑ (0.98 → 1.08)
   → xBlade odpočíval → fatigue ↓ (45 → 30)
   → Cyber Dragons nabídli 40,000 cr za TankPro → Odmítneš

7. Transfer Market:
   → Nový hráč na trhu: "Kira" (věk 19, mechanics 78, potential 95)
   → Cena 55,000 cr — investice do budoucnosti?
```

---

*Dokument je živý — bude se aktualizovat s vývojem projektu.*
