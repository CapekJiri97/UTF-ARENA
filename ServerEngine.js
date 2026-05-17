// ServerEngine.js — Server-side game loop and room management
// Phase 7: Multi-room support via per-room state + context swap pattern.

// Browser global polyfills for game files that reference window/performance
if (typeof window      === 'undefined') global.window = {};
if (typeof performance === 'undefined') global.performance = { now: Date.now.bind(Date) };

import { game } from './State.js';
import { Player, BotPlayer } from './Player.js';
import { Tower, Minion, HealPickup, PowerUp, SpeedPad } from './Entities.js';
import { GameMode_Classic } from './GameMode_Classic.js';
import { GameMode_ARAM }    from './GameMode_ARAM.js';
import { GameMode_Arena }   from './GameMode_Arena.js';
import { GameMode_Speed }   from './GameMode_Speed.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { smoothPolygon, dist } from './Utils.js';
import { registerGameContext, gc } from './GameContext.js';
import { createServerLogic } from './ServerGameLogic.js';
import { getShopItem, canBuyShopItem, getItemBuyCost, getItemSellPrice } from './items.js';

const GAME_MODES = { classic: GameMode_Classic, aram: GameMode_ARAM, arena: GameMode_Arena, speed: GameMode_Speed };

// Per-room state map: roomName → { interval, mode, vSocket, serverLogic, spawnRef, spawnInterval, nexusDrainRate, fastTimer, slowTimer, lastTick, state }
const _rooms = new Map();

// Keys that are "owned" by game state and must be swapped between rooms
const _GAME_STATE_KEYS = [
  'players','projectiles','minions','towers','damageNumbers','particles','effectTexts',
  'walls','wallGrid','wallGridSize',
  'heals','powerup','speedPads','nexus','score','gameOver','winner','started','startDelay',
  'isHost','isSpectator','killFeed','passiveTimer','cleanupTimer','burstHits','deadMinionIds',
  'playersById','minionsById','blueBotDifficulty','redBotDifficulty',
  '_botDtAcc','_minionDtAcc','_minionCollTick','_pendingMinionDeaths',
];

// Copy selected keys from src object into dst object
function _copyState(src, dst) {
  for (const k of _GAME_STATE_KEYS) {
    if (k in src) dst[k] = src[k];
  }
}

// Swap global `game` singleton and gc to a room's state, run fn(), then swap back
function _withRoomContext(roomEntry, fn) {
  // Load room state into global game
  _copyState(roomEntry.state, game);
  gc.socket         = roomEntry.vSocket;
  gc.activeGameMode = roomEntry.mode;
  // Swap game logic functions to this room's serverLogic (closures capture per-room state)
  if (roomEntry.serverLogic) Object.assign(gc, roomEntry.serverLogic);

  try {
    fn();
  } finally {
    // Save room state from global game back
    _copyState(game, roomEntry.state);
  }
}

// ── Virtual socket ────────────────────────────────────────────────────────────
// Translates host socket.emit() calls into io.to(roomName) broadcasts
function makeVirtualSocket(io, roomName) {
  return {
    emit(event, data) {
      switch (event) {
        case 'host_event':    io.to(roomName).emit('network_host_event',  data); break;
        case 'host_state':    io.to(roomName).emit('network_host_state',  data); break;
        case 'broadcast_kill':io.to(roomName).emit('network_kill_feed',   data); break;
        case 'player_action': io.to(roomName).emit('network_player_action', data); break;
        // ping_check, player_update etc. are client→server only, ignore on server
      }
    },
    // broadcast.to() is not used from entity code, but keep a stub in case
    broadcast: { to: () => ({ emit: () => {} }) },
  };
}

// ── getSmartBotClass (duplicate from main.js) ─────────────────────────────────
function getSmartBotClass(myTeamPicked, enemyTeamPicked) {
  const roleCounts = { SPLITPUSHER: 0, SLAYER: 0, TANK: 0, SUPPORT: 0, FIGHTER: 0 };
  for (const c of myTeamPicked) {
    const r = CLASSES[c]?.role;
    if (r && roleCounts[r] !== undefined) roleCounts[r]++;
  }
  const candidates = Object.keys(CLASSES).map(c => {
    let weight = 100;
    const role = CLASSES[c].role || 'FIGHTER';
    if      (role === 'SUPPORT')     weight *= roleCounts.SUPPORT   === 0 ? 3.0 : roleCounts.SUPPORT   === 1 ? 0.05 : 0;
    else if (role === 'TANK')        weight *= roleCounts.TANK      === 0 ? 3.0 : roleCounts.TANK      >= 2  ? 0.1  : 1;
    else if (role === 'SLAYER')      weight *= roleCounts.SLAYER    === 0 ? 2.0 : roleCounts.SLAYER    >= 2  ? 0.4  : 1;
    else if (role === 'FIGHTER')     weight *= roleCounts.FIGHTER   === 0 ? 2.0 : roleCounts.FIGHTER   >= 2  ? 0.4  : 1;
    if (myTeamPicked.includes(c))   weight  = 0;
    if (enemyTeamPicked.includes(c)) weight *= 0.10;
    return { className: c, weight };
  });
  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return Object.keys(CLASSES)[0];
  let rand = Math.random() * totalWeight;
  for (const c of candidates) { if (rand < c.weight) return c.className; rand -= c.weight; }
  return Object.keys(CLASSES)[0];
}

// ── initWalls (duplicate from main.js) ────────────────────────────────────────
function initWalls(activeGameMode) {
  const mc = activeGameMode.mapConfig;
  game.walls = [];
  game.wallGrid = new Map();
  game.wallGridSize = 200;

  const processPoly = (pts) => {
    let cx = 0, cy = 0;
    pts.forEach(p => { cx += p.x; cy += p.y; });
    cx /= pts.length; cy /= pts.length;

    let scale = 0.95;
    if (dist({ x: cx, y: cy }, mc.spawnPoints[0]) < 600 || dist({ x: cx, y: cy }, mc.spawnPoints[1]) < 600) scale = 0.85;
    const scaledPts = pts.map(p => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale }));
    const sorted    = scaledPts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

    let minE = Infinity;
    for (let i = 0; i < sorted.length; i++) minE = Math.min(minE, dist(sorted[i], sorted[(i + 1) % sorted.length]));
    const r = minE * 0.18;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    sorted.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });

    const wallObj = { pts: sorted, r, bbox: { minX, maxX, minY, maxY } };
    game.walls.push(wallObj);

    const startX = Math.floor((minX - r - 50) / game.wallGridSize);
    const endX   = Math.floor((maxX + r + 50) / game.wallGridSize);
    const startY = Math.floor((minY - r - 50) / game.wallGridSize);
    const endY   = Math.floor((maxY + r + 50) / game.wallGridSize);
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = x * 10000 + y;
        if (!game.wallGrid.has(key)) game.wallGrid.set(key, []);
        game.wallGrid.get(key).push(wallObj);
      }
    }
  };

  mc.rawPolys.forEach(pts => {
    const smoothed = smoothPolygon(pts, 3);
    processPoly(smoothed);
    processPoly(smoothed.map(p => ({ x: mc.world.width - p.x, y: p.y })));
  });

  const makeHex = (hx, hy, hr) => {
    const p = [];
    for (let i = 0; i < 6; i++) p.push({ x: Math.round(hx + hr * Math.cos(i * Math.PI / 3)), y: Math.round(hy + hr * Math.sin(i * Math.PI / 3)) });
    return p;
  };
  mc.nexusHexWalls.forEach(h => processPoly(makeHex(h.x, h.y, h.r)));
}

// ── startServerGame ───────────────────────────────────────────────────────────
export function startServerGame(io, roomName, playersData, settings) {
  // Tear down existing game in this room if any
  stopServerGame(roomName);

  // Game mode
  const modeName   = settings.gameMode || 'classic';
  const activeMode = GAME_MODES[modeName] || GameMode_Classic;

  // Build fresh per-room game state
  const state = {
    players: [], projectiles: [], minions: [], towers: [],
    damageNumbers: [], particles: [], effectTexts: [], walls: [], wallGrid: new Map(), wallGridSize: 200,
    heals: [], powerup: null, speedPads: [],
    nexus: { 0: 500, 1: 500 }, score: null,
    gameOver: false, winner: null, started: true,
    startDelay: 10.0, isHost: true, isSpectator: false,
    killFeed: [], passiveTimer: 0, cleanupTimer: 0,
    burstHits: new Map(), deadMinionIds: new Set(),
    playersById: new Map(), minionsById: new Map(),
    blueBotDifficulty: (settings.blueBotDiff || 100) / 100,
    redBotDifficulty:  (settings.redBotDiff  || 100) / 100,
  };

  // Virtual socket — translates host emit calls to room broadcasts
  const vSocket = makeVirtualSocket(io, roomName);

  // Server-side game logic factory (receives a getter so it always reads current room state)
  const roomEntry = { interval: null, mode: activeMode, vSocket, state };
  const serverLogic = createServerLogic(io, roomName, state, () => activeMode);

  // Register server gc once — will be swapped per-tick via _withRoomContext
  registerGameContext({
    socket:      vSocket,
    localPlayer: null,
    keys:        {},
    mouse:       { sx: 0, sy: 0, down: false, wx: 0, wy: 0 },
    activeGameMode: activeMode,
    ...serverLogic,
  });

  // Load room state into global game so entity constructors can reference it
  _copyState(state, game);
  gc.socket         = vSocket;
  gc.activeGameMode = activeMode;

  // Init map geometry — writes into global game, copy results back to state
  initWalls(activeMode);
  state.walls        = game.walls;
  state.wallGrid     = game.wallGrid;
  state.wallGridSize = game.wallGridSize;

  // Build towers into state, then sync to global game before activeMode.init()
  state.towers = activeMode.mapConfig.towerPositions.map((tp, i) => new Tower(tp.x, tp.y, i));
  game.towers  = state.towers;

  // activeMode.init() writes game.nexus and may touch other game fields — sync back to state after
  activeMode.init();
  _copyState(game, state);

  // Build player roster
  const spawnPoints = activeMode.mapConfig.spawnPoints;
  const spellsArray = Object.keys(SUMMONER_SPELLS);
  let bluePicked = [], redPicked = [];

  Object.values(playersData).forEach(pData => {
    if (pData.team === -1) return; // spectator
    const p = new Player(spawnPoints[pData.team].x, spawnPoints[pData.team].y, {
      team: pData.team, id: pData.id, className: pData.className, summonerSpell: pData.summonerSpell,
    });
    state.players.push(p);
    if (pData.team === 0) bluePicked.push(pData.className);
    else                  redPicked.push(pData.className);
  });

  // Fill remaining slots with bots
  const teamSize   = activeMode.mapConfig.teamSize || 5;
  const humansBlue = Object.values(playersData).filter(p => p.team === 0).length;
  const humansRed  = Object.values(playersData).filter(p => p.team === 1).length;
  const blueBotCnt = Math.max(0, teamSize - humansBlue);
  const redBotCnt  = Math.max(0, teamSize - humansRed);
  const totalBots  = Math.max(blueBotCnt, redBotCnt);
  const getBotLane = (idx) => activeMode.getBotLane(idx);

  for (let i = 1; i <= totalBots; i++) {
    if (i <= blueBotCnt) {
      const c = getSmartBotClass(bluePicked, redPicked);
      bluePicked.push(c);
      const bot = new BotPlayer(
        spawnPoints[0].x + (Math.random() - 0.5) * 50,
        spawnPoints[0].y + (Math.random() - 0.5) * 50,
        { team: 0, id: `bot0_${i}_${roomName}`, className: c, lane: getBotLane(i), summonerSpell: spellsArray[Math.floor(Math.random() * spellsArray.length)] }
      );
      bot._isBotPlayer = true;
      state.players.push(bot);
    }
    if (i <= redBotCnt) {
      const c = getSmartBotClass(redPicked, bluePicked);
      redPicked.push(c);
      const bot = new BotPlayer(
        spawnPoints[1].x + (Math.random() - 0.5) * 50,
        spawnPoints[1].y + (Math.random() - 0.5) * 50,
        { team: 1, id: `bot1_${i}_${roomName}`, className: c, lane: getBotLane(i), summonerSpell: spellsArray[Math.floor(Math.random() * spellsArray.length)] }
      );
      bot._isBotPlayer = true;
      state.players.push(bot);
    }
  }

  // Map pickups
  state.heals     = activeMode.mapConfig.healPickupPositions.map(p => new HealPickup(p.x, p.y));
  const pp        = activeMode.mapConfig.powerupPosition;
  state.powerup   = pp ? new PowerUp(pp.x, pp.y) : null;
  state.speedPads = (activeMode.mapConfig.speedPadPositions || []).map(p => new SpeedPad(p.x, p.y));

  // Initial lookup maps
  state.playersById = new Map(state.players.map(p => [p.id, p]));

  // Store server logic on room entry so action handlers can call it
  roomEntry.serverLogic = serverLogic;

  // Inform clients of the authoritative bot roster so they don't randomise classes themselves
  const botRoster = state.players
    .filter(p => p._isBotPlayer)
    .map(p => ({ id: p.id, team: p.team, className: p.className, lane: p.lane, summonerSpell: p.summonerSpell }));
  io.to(roomName).emit('bot_roster', botRoster);

  console.log(`[SERVER ENGINE] Game started in room "${roomName}" mode=${modeName} players=${state.players.length}`);

  // ── Game loop state ──────────────────────────────────────
  let lastTick      = Date.now();
  const spawnRef    = { val: 0 };
  const spawnInterval  = 16.0;
  const nexusDrainRate = 0.75;
  let pvpTimer    = 0;   // 20 Hz — human HP/shield/buffs (PvP kritické)
  let botTimer    = 0;   // 30 Hz — bot pozice (proximity culled)
  let minionTimer = 0;   //  6 Hz — minion pozice (proximity culled)
  let scoreTimer = 0;   // 2 Hz  — gold, exp, kills (scoreboard)
  let towerTimer = 0;   //  3 Hz — towers (control mění se při capture)
  let slowTimer  = 0;   //  1 Hz — heals, nexus (málo se mění)
  let perfTimer  = 0;   // 1 Hz  — server perf stats pro UI overlay
  let tickWarnings = 0;
  // Rolling perf metrics (reset každou sekundu při _broadcastPerf)
  let _perfTickCount = 0, _perfSlowTicks = 0, _perfTickMsSum = 0, _perfTickMsMax = 0;

  // ── Tick loop (30 FPS = 33 ms) ───────────────────────────
  roomEntry.interval = setInterval(() => {
    if (roomEntry.state.gameOver || !roomEntry.state.started) return;

    const now = Date.now();
    const rawDt = (now - lastTick) / 1000;
    const dt = Math.min(0.25, Math.max(0.001, rawDt));
    lastTick  = now;

    const tickMs = rawDt * 1000;
    _perfTickCount++;
    _perfTickMsSum += tickMs;
    if (tickMs > _perfTickMsMax) _perfTickMsMax = tickMs;

    if (rawDt > 0.066) {
      _perfSlowTicks++;
      tickWarnings++;
      if (tickWarnings % 30 === 1) console.warn(`[SERVER ENGINE] Slow tick in "${roomName}": ${Math.round(tickMs)}ms (target 67ms)`);
    } else {
      tickWarnings = 0;
    }

    _withRoomContext(roomEntry, () => {
      try {
        _serverTick(dt, activeMode, spawnRef, spawnInterval, nexusDrainRate, vSocket);
      } catch (err) {
        console.error('[SERVER ENGINE] Tick error:', err.message, err.stack);
      }

      pvpTimer    += dt;
      botTimer    += dt;
      minionTimer += dt;
      scoreTimer  += dt;
      towerTimer  += dt;
      slowTimer   += dt;
      perfTimer   += dt;

      // 20 Hz — human HP, shield, buffs, knockback korekce (PvP kritické)
      if (pvpTimer >= 0.05) {
        pvpTimer = 0;
        _broadcastPvp(io, roomName);
      }
      // 30 Hz — boti (proximity culled)
      if (botTimer >= 0.033) {
        botTimer = 0;
        _broadcastBots(io, roomName);
      }
      // 6 Hz — minioni (proximity culled, silná interpolace na klientovi)
      if (minionTimer >= 0.167) {
        minionTimer = 0;
        _broadcastMinions(io, roomName);
      }
      // 2 Hz — human scoreboard (gold, exp, kills, level)
      if (scoreTimer >= 0.5) {
        scoreTimer = 0;
        _broadcastScore(io, roomName);
      }
      // 3 Hz — věže (control se mění při capture)
      if (towerTimer >= 0.333) {
        towerTimer = 0;
        _broadcastTowers(io, roomName);
      }
      // 1 Hz — healy, nexus (málokdy se mění)
      if (slowTimer >= 1.0) {
        slowTimer = 0;
        _broadcastSlow(io, roomName, activeMode);
      }
      // 1 Hz — server perf overlay
      if (perfTimer >= 1.0) {
        perfTimer = 0;
        const avgMs  = _perfTickCount > 0 ? _perfTickMsSum / _perfTickCount : 0;
        const mem    = process.memoryUsage();
        const perfData = {
          avgMs:    Math.round(avgMs * 10) / 10,
          maxMs:    Math.round(_perfTickMsMax * 10) / 10,
          slowPct:  _perfTickCount > 0 ? Math.round(_perfSlowTicks / _perfTickCount * 100) : 0,
          heapMB:   Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
          rssMB:    Math.round(mem.rss      / 1024 / 1024 * 10) / 10,
          players:  game.players.length,
          minions:  game.minions.length,
        };
        io.to(roomName).emit('server_perf', perfData);
        _perfTickCount = 0; _perfSlowTicks = 0; _perfTickMsSum = 0; _perfTickMsMax = 0;
      }
    });
  }, 33);

  _rooms.set(roomName, roomEntry);
}

export function stopServerGame(roomName) {
  const entry = _rooms.get(roomName);
  if (!entry) return;
  clearInterval(entry.interval);
  _rooms.delete(roomName);
  console.log(`[SERVER ENGINE] Game stopped in room "${roomName}"`);
}

// Handle action events from human players (spell casts, auto-attacks, shop)
export function handlePlayerAction(roomName, playerId, data) {
  const entry = _rooms.get(roomName);
  if (!entry) return;
  _withRoomContext(entry, () => {
    const p = game.playersById?.get(playerId);
    if (!p || !p.alive) return;

    switch (data.type) {
      case 'shoot':
        if (typeof p.shoot === 'function') p.shoot(data.tx, data.ty);
        break;

      case 'cast':
        if (typeof p.castSpell === 'function') p.castSpell(data.spKey, data.tx, data.ty);
        break;

      case 'summoner':
        if (typeof p.castSummonerSpell === 'function') p.castSummonerSpell();
        break;

      case 'buy_item': {
        const it = getShopItem(data.itemId);
        if (!it) break;
        const check = canBuyShopItem(p, it);
        const cost  = getItemBuyCost(p, it);
        if (!check.ok || p.gold < cost) break;
        p.gold  -= cost;
        p.items.push(it.id);
        gc.recalcPlayerItemStats(p);
        p.isDirty = true;
        break;
      }

      case 'sell_item': {
        const it2 = getShopItem(data.itemId);
        if (!it2) break;
        const idx = p.items.indexOf(data.itemId);
        if (idx === -1) break;
        const refund = getItemSellPrice(p, it2);
        p.items.splice(idx, 1);
        p.gold += refund;
        gc.recalcPlayerItemStats(p);
        p.isDirty = true;
        break;
      }
    }
  });
}

// Remove a disconnected human player from the server game
export function removePlayerFromGame(roomName, playerId) {
  const entry = _rooms.get(roomName);
  if (!entry) return;
  const state = entry.state;
  const p = state.playersById?.get(playerId);
  if (!p) return;
  state.players    = state.players.filter(x => x.id !== playerId);
  state.playersById = new Map(state.players.map(x => [x.id, x]));
  console.log(`[SERVER ENGINE] Player ${playerId} removed from room "${roomName}"`);
}

// Update the server's position for a human player when we receive their player_update
export function applyPlayerUpdate(roomName, playerId, data) {
  const entry = _rooms.get(roomName);
  if (!entry) return;
  const p = entry.state.playersById?.get(playerId);
  if (!p) return;
  // Ignorujeme klientovu pozici pokud server právě aplikuje knockback nebo stun — server je autorita
  const serverControlsPos = (p.knockbackTimer > 0 || p.stunTimer > 0 || p.dashTimer > 0);
  if (!serverControlsPos) {
    if (data.x !== undefined) p.pos.x = data.x;
    if (data.y !== undefined) p.pos.y = data.y;
  }
  if (data.aimAngle !== undefined) p.aimAngle = data.aimAngle;
}

// ── _serverTick ──────────────────────────────────────────────────────────────
function _serverTick(dt, activeMode, spawnRef, spawnInterval, nexusDrainRate, vSocket) {
  if (game.startDelay > 0) game.startDelay -= dt;

  // Update players:
  // - Bots: full p.update(dt) runs AI + movement
  // - Human players: p.update(dt) runs but movement branch is skipped (Player.js checks
  //   !_isBotPlayer && !targetPos → no-op). Knockback/dash still handled because those
  //   branches run before the movement check. Timers + ability effects tick normally.
  // Bot AI throttle: accumulate dt and only run full update every 2 ticks (saves ~40% CPU on AI).
  // Human players update every tick (timer ticks, knockback etc. must be precise).
  // _botDtAcc lives on game (per-room state) to avoid cross-room contamination.
  if (!game._botDtAcc) game._botDtAcc = new Map();
  const _botAcc = game._botDtAcc;

  for (const p of game.players) {
    if (p._isBotPlayer) {
      const acc = (_botAcc.get(p.id) || 0) + dt;
      if (acc < 0.125) { _botAcc.set(p.id, acc); continue; } // AI tick ~125ms (8 Hz)
      _botAcc.set(p.id, 0);
      const ox = p.pos.x, oy = p.pos.y;
      p.update(acc);
      if (acc > 0) p.vel = { x: (p.pos.x - ox) / acc, y: (p.pos.y - oy) / acc };
    } else {
      const ox = p.pos.x, oy = p.pos.y;
      p.update(dt);
      if (dt > 0) p.vel = { x: (p.pos.x - ox) / dt, y: (p.pos.y - oy) / dt };
    }

    // Burn DoT applies to all
    if (p.burnDotTimer > 0 && p.alive) {
      p.burnDotTimer -= dt;
      p.burnDotTick   = (p.burnDotTick || 0) - dt;
      if (p.burnDotTick <= 0) {
        p.burnDotTick = 0.5;
        gc.applyDamage(p, p.burnDotTickDmg, 'dot', p.burnDotSource, false, false, false);
      }
    }
  }

  for (const proj of game.projectiles) proj.update(dt);

  // Minion AI throttle: accumulate dt, update every 3 ticks (~150ms). Client interpolates.
  if (!game._minionDtAcc) game._minionDtAcc = new Map();
  const _minionAcc = game._minionDtAcc;
  for (const m of game.minions) {
    const acc = (_minionAcc.get(m.id) || 0) + dt;
    if (m.burnDotTimer > 0 && !m.dead) {
      m.burnDotTimer -= dt;
      m.burnDotTick   = (m.burnDotTick || 0) - dt;
      if (m.burnDotTick <= 0) { m.burnDotTick = 0.5; gc.applyDamage(m, m.burnDotTickDmg, 'dot', m.burnDotSource, false, false, false); }
    }
    if (acc < 0.15) { _minionAcc.set(m.id, acc); continue; }
    _minionAcc.set(m.id, 0);
    const ox = m.pos.x, oy = m.pos.y;
    m.update(acc);
    if (acc > 0) m.vel = { x: (m.pos.x - ox) / acc, y: (m.pos.y - oy) / acc };
  }

  for (const t of game.towers) t.update(dt);

  if (game.powerup) game.powerup.update(dt);
  for (const h of game.heals)     h.update(dt);
  for (const sp of game.speedPads) sp.update(dt);

  // Player–player collision (anti-stack)
  for (let i = 0; i < game.players.length; i++) {
    for (let j = i + 1; j < game.players.length; j++) {
      const p1 = game.players[i], p2 = game.players[j];
      if (!p1.alive || !p2.alive) continue;
      let dx = p2.pos.x - p1.pos.x, dy = p2.pos.y - p1.pos.y, d = Math.hypot(dx, dy);
      const minD = p1.radius + p2.radius;
      if (d < minD) {
        if (d === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
        const push = (minD - d) / 2, px = (dx / d) * push, py = (dy / d) * push;
        p1.pos.x -= px; p1.pos.y -= py; p2.pos.x += px; p2.pos.y += py;
      }
    }
  }

  // Minion–minion collision — only run every other tick to reduce CPU on free tier
  game._minionCollTick = (game._minionCollTick || 0) + 1;
  if (game._minionCollTick % 2 === 0 && game.minions.length > 1) {
    const CELL = 60;
    const grid = new Map();
    for (const m of game.minions) {
      if (m.dead) continue;
      const key = (Math.floor(m.pos.x / CELL) * 10000 + Math.floor(m.pos.y / CELL));
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(m);
    }
    for (const m1 of game.minions) {
      if (m1.dead) continue;
      const cx = Math.floor(m1.pos.x / CELL), cy = Math.floor(m1.pos.y / CELL);
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        for (let ny = cy - 1; ny <= cy + 1; ny++) {
          const cell = grid.get(nx * 10000 + ny);
          if (!cell) continue;
          for (const m2 of cell) {
            if (m1.id >= m2.id || m2.dead) continue;
            let dx = m2.pos.x - m1.pos.x, dy = m2.pos.y - m1.pos.y, d = Math.hypot(dx, dy);
            const minD = m1.radius + m2.radius;
            if (d < minD) {
              if (d === 0) { dx = 0.5; dy = 0.5; d = Math.SQRT2 * 0.5; }
              const push = (minD - d) / 2, px = (dx / d) * push, py = (dy / d) * push;
              m1.pos.x -= px; m1.pos.y -= py; m2.pos.x += px; m2.pos.y += py;
            }
          }
        }
      }
    }
  }

  // Passive income (1 s tick)
  game.passiveTimer = (game.passiveTimer || 0) + dt;
  if (game.startDelay <= 0 && game.passiveTimer >= 1.0) {
    game.passiveTimer -= 1.0;
    let passiveMult = 1.0;
    if (activeMode.name === 'arena') passiveMult = 1.75;
    if (activeMode.name === 'speed') passiveMult = 3.0;
    for (const p of game.players) {
      p.gold      += 2 * passiveMult;
      p.totalGold += 2 * passiveMult;
      p.exp       += 1 * passiveMult;
      p.totalExp   = (p.totalExp || 0) + 1 * passiveMult;
    }
  }

  // Periodic cleanup
  game.cleanupTimer = (game.cleanupTimer || 0) + dt;
  if (game.cleanupTimer >= 5.0) {
    game.cleanupTimer = 0;
    if (game.burstHits) {
      const nowMs = Date.now();
      game.burstHits.forEach((v, k) => { if (nowMs - (v.time || 0) > 10000) game.burstHits.delete(k); });
    }
    if (game.deadMinionIds && game.deadMinionIds.size > 200) game.deadMinionIds.clear();
    if (game._minionDtAcc && game._minionDtAcc.size > 200) {
      const liveIds = new Set(game.minions.map(m => m.id));
      game._minionDtAcc.forEach((_, id) => { if (!liveIds.has(id)) game._minionDtAcc.delete(id); });
    }
  }

  // Kill feed timers
  if (game.killFeed) {
    game.killFeed.forEach(k => k.timer -= dt);
    game.killFeed = game.killFeed.filter(k => k.timer > 0);
  }

  // Collect dead minions before filtering — _broadcastFast needs to notify clients
  if (!game._pendingMinionDeaths) game._pendingMinionDeaths = new Set();
  for (const m of game.minions) {
    if (m.dead) { game._pendingMinionDeaths.add(m.id); if (game.deadMinionIds) game.deadMinionIds.add(m.id); }
  }

  // Filter dead entities
  game.projectiles = game.projectiles.filter(p => !p.dead);
  game.minions     = game.minions.filter(m => !m.dead);

  // Visual-only arrays are stubs on server — clear each tick to prevent memory accumulation
  game.particles    = [];
  game.effectTexts  = [];
  game.damageNumbers = [];

  // Rebuild lookup maps
  game.playersById = new Map(game.players.map(p => [p.id, p]));
  game.minionsById = new Map(game.minions.map(m => [m.id, m]));

  // Spawn minions + drain nexus + win condition
  if (game.startDelay <= 0) {
    spawnRef.val = activeMode.tickSpawn(dt, spawnRef.val, spawnInterval);
  }
  activeMode.tickObjective(dt, nexusDrainRate, vSocket);
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

// Vrátí seznam pozic živých lidských hráčů pro proximity výpočty
function _humanPositions() {
  const positions = [];
  for (const p of game.players) {
    if (!p._isBotPlayer && p.alive) positions.push(p.pos);
  }
  return positions;
}

// Proximity tier: 0 = blízko (<500px) → 10Hz, 1 = střední (500-1200px) → 5Hz, 2 = daleko (>1200px) → 2Hz
// Vrátí minimální vzdálenost entity od nejbližšího lidského hráče
function _proximityTier(pos, humanPos) {
  if (humanPos.length === 0) return 0; // žádní hráči → všechno posílej
  let minD2 = Infinity;
  for (const h of humanPos) {
    const dx = pos.x - h.x, dy = pos.y - h.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < minD2) minD2 = d2;
  }
  if (minD2 < 500*500)  return 0;
  if (minD2 < 1200*1200) return 1;
  return 2;
}

// 20 Hz — human pozice, HP, shield, buffs, knockback korekce (PvP kritické)
function _broadcastPvp(io, roomName) {
  const humanUpdates = [];
  for (const p of game.players) {
    if (p._isBotPlayer) continue;
    const h = { id: p.id, hp: Math.round(p.hp), alive: p.alive };
    if (p.shield > 0)               h.sh   = Math.round(p.shield);
    if (p.stunTimer > 0.01)         h.stun = Math.round(p.stunTimer*100)/100;
    if (p.slowTimer > 0.01)         h.slw  = Math.round(p.slowTimer*10)/10;
    if (p.invulnerableTimer > 0.01) h.inv  = Math.round(p.invulnerableTimer*10)/10;
    if (p.defBuffTimer > 0.01)      h.def  = Math.round(p.defBuffTimer*10)/10;
    if (p.msBuffTimer > 0.01)       { h.msT = Math.round(p.msBuffTimer*10)/10; h.msV = Math.round((p.msBuffAmount||0)*100)/100; }
    if (p.hasPowerup)               { h.pw  = 1; h.pwT = Math.round(p.powerupTimer*10)/10; }
    if (p.beamTimer > 0.01)         { h.bmT = Math.round(p.beamTimer*10)/10; h.bmId = p.beamTargetId; }
    if (p.uberChargeTimer > 0.01)   h.ubT  = Math.round(p.uberChargeTimer*10)/10;
    if (p.rallyTimer > 0.01)        h.rly  = Math.round(p.rallyTimer*10)/10;
    if (p.adAsBuffTimer > 0.01)     { h.adT = Math.round(p.adAsBuffTimer*10)/10; h.adV = Math.round((p.adAsBuffAmount||0)*100)/100; }
    humanUpdates.push(h);
  }
  const humanPosCorrections = game.players
    .filter(p => !p._isBotPlayer && (p.knockbackTimer > 0 || p.stunTimer > 0 || p.dashTimer > 0))
    .map(p => ({ id: p.id, x: Math.round(p.pos.x), y: Math.round(p.pos.y), posCorrection: true }));
  if (humanUpdates.length > 0 || humanPosCorrections.length > 0) {
    io.to(roomName).emit('network_host_state', { bots: [], minions: [], humans: humanUpdates, humanPosCorrections });
  }
}

// 30 Hz — pozice botů (proximity culled)
function _broadcastBots(io, roomName) {
  const humanPos = _humanPositions();
  const botUpdates = [];

  for (const b of game.players) {
    if (!b._isBotPlayer) continue;

    const tier = _proximityTier(b.pos, humanPos);
    b._proxSkip = (b._proxSkip || 0) + 1;
    if (tier === 1 && b._proxSkip % 2 !== 0 && !b.isDirty) continue; // ~7 Hz
    if (tier === 2 && b._proxSkip % 4 !== 0 && !b.isDirty) continue; // ~3 Hz

    const moved2 = (b.pos.x - (b._lastSyncX ?? b.pos.x+999))**2 + (b.pos.y - (b._lastSyncY ?? b.pos.y+999))**2;
    if (moved2 <= 1 && !b.isDirty) continue;
    b._lastSyncX = b.pos.x; b._lastSyncY = b.pos.y;

    const base = { id: b.id, x: Math.round(b.pos.x), y: Math.round(b.pos.y), hp: Math.round(b.hp), alive: b.alive, aa: Math.round(b.aimAngle * 100) / 100 };
    if (b.stunTimer > 0.01)  base.stun = Math.round(b.stunTimer * 100) / 100;
    if (b.shield > 0)        base.sh   = Math.round(b.shield);
    if (b.invulnerableTimer > 0.01) base.inv = Math.round(b.invulnerableTimer * 10) / 10;
    if (b.defBuffTimer > 0.01)      base.def = Math.round(b.defBuffTimer * 10) / 10;
    if (b.msBuffTimer > 0.01)       { base.msT = Math.round(b.msBuffTimer * 10) / 10; base.msV = Math.round((b.msBuffAmount||0)*100)/100; }
    if (b.adAsBuffTimer > 0.01)     { base.adT = Math.round(b.adAsBuffTimer*10)/10; base.adV = Math.round((b.adAsBuffAmount||0)*100)/100; }
    if (b.slowTimer > 0.01)         base.slw  = Math.round(b.slowTimer * 10) / 10;
    if (b.antiHealTimer > 0.01)     { base.ahT = Math.round(b.antiHealTimer*10)/10; base.ahV = Math.round((b.antiHealStrength||0)*100)/100; }
    if (b.hasPowerup)               { base.pw  = 1; base.pwT = Math.round(b.powerupTimer*10)/10; }
    if (b.beamTimer > 0.01)         { base.bmT = Math.round(b.beamTimer*10)/10; base.bmId = b.beamTargetId; }
    if (b.uberChargeTimer > 0.01)   base.ubT  = Math.round(b.uberChargeTimer*10)/10;
    if (b.beamUberTimer > 0.01)     base.buT  = Math.round(b.beamUberTimer*10)/10;

    if (b.isDirty) {
      b.isDirty = false;
      base.full = 1;
      base.cls  = b.className;
      base.lvl  = b.level;
      base.mhp  = Math.round(b.effectiveMaxHp || b.maxHp);
      base.kda  = [b.kills, b.deaths, b.assists];
      base.gold = Math.round(b.totalGold);
      base.itms = b.items.length;
      base.AD   = Math.round(b.AD);   base.AP  = Math.round(b.AP);
      base.arm  = Math.round(b.armor); base.mr = Math.round(b.mr);
      base.spd  = Math.round(b.speed); base.as = Math.round(b.attackSpeed*100)/100;
      base.qLv  = b.spells?.Q?.level;  base.eLv = b.spells?.E?.level;
      base.ss   = b.summonerSpell;
      if (b.slowTimer > 0.01)        base.slwT = Math.round(b.slowTimer*10)/10;
      if (b.boostTimer > 0.01)       base.bst  = Math.round(b.boostTimer*10)/10;
      if (b.silenceTimer > 0.01)     base.slnc = Math.round(b.silenceTimer*10)/10;
      if (b.hanaBuffTimer > 0.01)    base.han  = Math.round(b.hanaBuffTimer*10)/10;
      if (b.junglePowerTimer > 0.01) base.jpT  = Math.round(b.junglePowerTimer*10)/10;
      if (b.regenBuffTimer > 0.01)   { base.rgT = Math.round(b.regenBuffTimer*10)/10; base.rgV = Math.round((b.regenBuffAmount||0)*100)/100; }
    }
    botUpdates.push(base);
  }

  if (botUpdates.length > 0) {
    io.to(roomName).emit('network_host_state', { bots: botUpdates, minions: [], humans: [] });
  }
}

// 6 Hz — minioni (proximity culled, klient používá silnou interpolaci)
function _broadcastMinions(io, roomName) {
  const humanPos = _humanPositions();
  const minionUpdates = [];

  if (game._pendingMinionDeaths && game._pendingMinionDeaths.size > 0) {
    for (const id of game._pendingMinionDeaths) minionUpdates.push({ id, dead: true });
    game._pendingMinionDeaths.clear();
  }

  for (const m of game.minions) {
    const tier = _proximityTier(m.pos, humanPos);
    m._proxSkip = (m._proxSkip || 0) + 1;
    if (tier === 1 && m._proxSkip % 2 !== 0) continue; // ~3 Hz
    if (tier === 2 && m._proxSkip % 3 !== 0) continue; // ~2 Hz

    if (m._syncDirty) {
      m._syncDirty = false;
      minionUpdates.push({
        id: m.id, x: Math.round(m.pos.x), y: Math.round(m.pos.y), hp: Math.round(m.hp),
        mhp: m.maxHp, tm: m.team, ti: m.targetIndex,
        sum: m.isSummon || undefined, gl: m.glyph, tH: m.targetHeroId || undefined,
        sc: m.isSmallChicken || undefined, bc: m.isBigChicken || undefined,
        spawn: 1,
      });
    } else {
      minionUpdates.push({ id: m.id, x: Math.round(m.pos.x), y: Math.round(m.pos.y), hp: Math.round(m.hp) });
    }
  }

  if (minionUpdates.length > 0) {
    io.to(roomName).emit('network_host_state', { bots: [], minions: minionUpdates, humans: [] });
  }
}

// 2 Hz — scoreboard data (gold, exp, kills, level, items) — méně urgentní
function _broadcastScore(io, roomName) {
  const score = game.players
    .filter(p => !p._isBotPlayer)
    .map(p => ({
      id: p.id,
      gold: p.totalGold, cg: p.gold, exp: p.exp, texp: p.totalExp || 0,
      kills: p.kills, deaths: p.deaths, assists: p.assists,
      lvl: p.level, mhp: p.effectiveMaxHp || p.maxHp,
      items: p.items ? p.items.slice() : [],
      AD: p.AD, AP: p.AP, arm: p.armor, mr: p.mr,
      spd: p.speed, as: p.attackSpeed,
      stats: p.stats ? [Math.round(p.stats.dmgDealt||0), Math.round(p.stats.dmgTaken||0), Math.round(p.stats.hpHealed||0)] : null,
      tc: p.towerCaptures||0, td: p.towerDefends||0, pcs: p.pcs||0,
      pwrc: p.powerupsCollected||0,
    }));
  if (score.length > 0) io.to(roomName).emit('network_score', score);
}

// 3 Hz — věže (control/owner se mění při capture)
function _broadcastTowers(io, roomName) {
  if (!game.towers || game.towers.length === 0) return;
  io.to(roomName).emit('network_host_state', {
    bots: [], minions: [], humans: [],
    towers: game.towers.map(t => ({ i: t.index, c: t.control, o: t.owner, l: t.isLocked, u: t.unlockTimer })),
  });
}

// 1 Hz — healy, nexus (málokdy se mění)
function _broadcastSlow(io, roomName, activeMode) {
  io.to(roomName).emit('network_host_state', {
    bots: [], minions: [], humans: [],
    heals:   game.heals.map(h => h.active),
    powerup: game.powerup ? { a: game.powerup.active, c: game.powerup.captureTimer } : null,
    nexus:   [game.nexus[0], game.nexus[1]],
  });
}
