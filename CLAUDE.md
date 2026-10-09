# UTF Arena — CLAUDE.md

## Co je projekt
Multiplayer browser MOBA-like hra (Canvas + Socket.IO + ES Modules). Inspirace: LoL Arena.
Spouštění: `node server.js` → `http://localhost:3000`.

## Architektura

### Složková struktura
```
Kořen (vstupní body):
  server.js           ← Express + Socket.IO server
  main.js             ← klientský vstupní bod (browser)
  ServerEngine.js     ← server game loop (kořenová kopie)
  ServerGameLogic.js  ← server autorita: damage, heal, shop
  index.html, style.css

shared/             ← sdílené mezi klientem i serverem (žádná DOM závislost)
  State.js, Utils.js, GameContext.js, classes.js, items.js

client/             ← čistě browserové soubory
  Audio.js, UI.js, Effects.js

entities/           ← herní objekty (sdílené)
  Entities.js, BotBrain.js, Player.js

gamemodes/          ← herní módy + mapové konfigurace
  GameMode_Classic.js / Speed / ARAM / Arena
  MapConfig.js / MapConfig_ARAM.js / MapConfig_Arena.js

server logika js soubory/   ← serverové kopie (alternative server runtime)
  ServerEngine.js, ServerGameLogic.js, Player.js, main.js

simulation/         ← simulační engine (browser only)
  Simulation.js, SimStats.js, SimUI.js

simulations/        ← CSV/JSON výstupy simulací
tools/              ← balance nástroje
NO CODE BASE/       ← dokumentace, obrázky, poznámky (ne kód)
```

### Klíčové soubory (číst jako první)
- `server.js` — Express + Socket.IO vstupní bod, room management, routing socketových eventů
- `server logika js soubory/ServerEngine.js` — server-side game loop (20 FPS), multi-room via `_rooms` Map, context-swap pattern (`_withRoomContext`)
- `ServerGameLogic.js` — server autorita: damage, heal, shop, kills
- `shared/GameContext.js` — DI hub (gc objekt), swapuje implementace mezi serverem a klientem
- `shared/State.js` — `game` objekt (sdílený stav), `camera`, konstanty, `BOT_WEIGHTS`
- `server logika js soubory/Player.js` — Player třída s proxy přes `gc.*`

## Herní módy
`classic` | `speed` | `aram` | `arena` — třídy `GameMode_*` v `gamemodes/` s `mapConfig.spawnPoints` a `mapConfig.mapBoundary`.

## Server-authoritative architektura (dokončeno Fáze 1–7)

### Pravidlo pro klientský kód
```js
if (!gc.socket || game.isHost) { /* applyDamage / applyHeal / buff timery */ }
```
Klient nikdy přímo neaplikuje damage/heal na ostatní hráče — server je autorita.

### Server identifikátory
- `hostId: '__server__'` — server není hráč
- `game.isHost = false` na klientech v server módu

### Broadcast cyklus
- `_broadcastFast` (~20×/s) — pozice, HP, projektily, knockback/stun korekce (`humanPosCorrections`)
- `_broadcastSlow` (~4×/s) — gold, stats, inventář, level, bot roster

### Multi-room
`_rooms` Map: `roomName → { interval, mode, vSocket, serverLogic, ... }`
Context-swap: `_withRoomContext(roomName, fn)` swapuje globální `game` + `gc` per-tick.
Signatury: `handlePlayerAction(roomName, ...)`, `removePlayerFromGame(roomName, ...)`.

### Client-side prediction (Fáze 6)
Pohyb lokálního hráče je okamžitý. Server posílá korekci:
- snap >150px, lerp 30–150px, ignoruj <30px

## Struktura socketových eventů (server.js)
- `create_room` / `join_room` — lobby
- `start_game` — spustí `ServerEngine`
- `player_action` — vstup hráče → `handlePlayerAction`
- `buy_item` / `sell_item` — shop autorita na serveru
- `player_disconnected` — rebuild `playersById`

## Simulace a nástroje
- `simulations/` — CSV/JSON výstupy z herních simulací
- `tools/balance_analysis.js` + `summarize_report.js` — balance nástroje
- `simulation/Simulation.js`, `simulation/SimStats.js`, `simulation/SimUI.js` — simulační engine

## Co NEČÍST při hledání serverové logiky
`client/Audio.js`, `client/UI.js`, `client/Effects.js` — čistě klientské, server je ignoruje (jsou mockované přes `gc`).

## Stav projektu (2026-05)
Fáze 7 dokončena — čistý codebase, žádný zbytkový host-client kód.
