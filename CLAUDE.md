# UTF Arena — CLAUDE.md

## Co je projekt
Multiplayer browser MOBA-like hra (Canvas + Socket.IO + ES Modules). Inspirace: LoL Arena.
Spouštění: `node server.js` → `http://localhost:3000`.

## Architektura

### Dva kontexty souborů
| Složka | Účel |
|--------|------|
| Kořen projektu | Klientské soubory (canvas renderer, UI, game logic sdílená) |
| `server logika js soubory/` | Serverové kopie `ServerEngine.js`, `Player.js`, `main.js` |

Server importuje z kořene (State.js, Utils.js, items.js, classes.js, Effects.js, Entities.js, GameMode_*.js atd.) přes relativní cesty.

### Klíčové soubory (číst jako první)
- `server.js` — Express + Socket.IO vstupní bod, room management, routing socketových eventů
- `server logika js soubory/ServerEngine.js` — server-side game loop (20 FPS), multi-room via `_rooms` Map, context-swap pattern (`_withRoomContext`)
- `server logika js soubory/ServerGameLogic.js` — server autorita: damage, heal, shop, kills
- `GameContext.js` — DI hub (gc objekt), swapuje implementace mezi serverem a klientem
- `State.js` — `game` objekt (sdílený stav), `camera`, konstanty, `BOT_WEIGHTS`
- `server logika js soubory/Player.js` — Player třída s proxy přes `gc.*`

### Sdílené soubory (klient i server)
`Utils.js`, `items.js`, `classes.js`, `Entities.js`, `Effects.js`, `BotBrain.js`, `MapConfig*.js`, `GameMode_*.js`

## Herní módy
`classic` | `speed` | `aram` | `arena` — třídy `GameMode_*` s `mapConfig.spawnPoints` a `mapConfig.mapBoundary`.

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
- `SimStats.js`, `SimUI.js`, `Simulation.js` — simulační engine

## Co NEČÍST při hledání serverové logiky
`Audio.js`, `UI.js`, `Effects.js` — čistě klientské, server je ignoruje (jsou mockované přes `gc`).

## Stav projektu (2026-05)
Fáze 7 dokončena — čistý codebase, žádný zbytkový host-client kód.
