import { clamp, dist, isPointInPoly, distToPoly, smoothPolygon, expForLevel } from './Utils.js';
import { shopItems, canBuyShopItem, getShopItem, getItemBuyCost, getItemSellPrice } from './items.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { game, camera, TEAM_COLOR, NEUTRAL_COLOR, RANGED_ATTACK_RANGE, MELEE_ATTACK_RANGE, BOT_WEIGHTS } from './State.js';
// MapConfig data jsou čtena za běhu z activeGameMode.mapConfig
import { Particle, spawnParticles, DamageNumber, EffectText } from './Effects.js';
import { Projectile, Tower, Minion, HealPickup, PowerUp, SpeedPad } from './Entities.js';
import { Player, BotPlayer } from './Player.js';
import { buildMenu, populateShop, toggleShop, showEnd, draw, updateSpellLabels, updateInventory, updateShopGold, updateLobbyUI, updateRoomListUI } from './UI.js';
import { GameMode_Classic } from './GameMode_Classic.js';
import { GameMode_Speed } from './GameMode_Speed.js';
import { GameMode_ARAM } from './GameMode_ARAM.js';
import { GameMode_Arena } from './GameMode_Arena.js';
import { registerGameContext, gc } from './GameContext.js';

export const GAME_MODES = {
  classic: GameMode_Classic,
  speed:   GameMode_Speed,
  aram:    GameMode_ARAM,
  arena:   GameMode_Arena,
};

// Registrace nového game modu za běhu — stačí zavolat z libovolného GameMode_*.js souboru.
// Příklad: registerGameMode('deathmatch', GameMode_Deathmatch);
export function registerGameMode(name, modeObj) {
  GAME_MODES[name] = modeObj;
}

export let activeGameMode = GameMode_Classic;

export function setActiveMode(modeName) {
  activeGameMode = GAME_MODES[modeName] ?? GameMode_Classic;
  gc.activeGameMode = activeGameMode;
}

// ── Simulation mode flag ──────────────────────────────────────────────────────
// When true: draw() is skipped, audio is muted, particles are purged by the sim engine.
export let simMode = false;
export function setSimMode(v) { simMode = v; }
// Wrapper so Simulation.js can call update() (which is not otherwise exported).
export function simUpdate(dt) { update(dt); }
// Resets the spawn timer between simulated games (it persists as a module-level var).
export function resetSpawnTimer() { spawnTimer = 0; }
import { initAudio, playSound } from './Audio.js';

  export const canvas = document.getElementById('gameCanvas');
  export const ctx = canvas.getContext('2d');
  export const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  function resize(){
      game._dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
      canvas.width = window.innerWidth * game._dpr;
      canvas.height = window.innerHeight * game._dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';

      game.isMobile = isMobile;
      if (isMobile && typeof camera !== 'undefined') {
          const cw = Math.max(window.innerWidth, window.innerHeight);
          const ch = Math.min(window.innerWidth, window.innerHeight);
          camera.scale = Math.min(cw / 1200, ch / 600);
      }
  }
  window.addEventListener('resize', resize); resize();

  window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]', e.message, 'at', e.filename, ':', e.lineno);
  });

  // =========================================================================
  // 🌐 SÍŤOVÁ KOMUNIKACE (SOCKET.IO) - ZÁKLAD PRO LAN
  // =========================================================================
  export let socket = null;
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('connect', () => {
      console.log(`[KLIENT] Připojeno k serveru! Moje ID: ${socket.id}`);
    });

    // ── Ping měření (každé 2s) ────────────────────────────────────────────────
    let _ping = 0;
    setInterval(() => {
      const t0 = performance.now();
      socket.emit('ping_check', null, () => { _ping = Math.round(performance.now() - t0); });
    }, 2000);

    // ── Server perf overlay ──────────────────────────────────────────────────
    const _perfEl = document.getElementById('perfOverlay');
    let _perfLogCount = 0;
    socket.on('server_perf', (d) => {
      if (_perfEl) {
        _perfEl.style.display = 'block';
        const slowColor = d.slowPct > 30 ? '#f55' : d.slowPct > 10 ? '#fa0' : '#4f8';
        const memColor  = d.heapMB  > 350 ? '#f55' : d.heapMB  > 200 ? '#fa0' : '#4ef';
        document.getElementById('perfPing').style.color = _ping > 150 ? '#f55' : _ping > 80 ? '#fa0' : '#4ef';
        document.getElementById('perfPing').textContent = `Ping: ${_ping}ms`;
        document.getElementById('perfTick').textContent = `Tick: ${d.avgMs}/${d.maxMs}ms`;
        document.getElementById('perfSlow').style.color = slowColor;
        document.getElementById('perfSlow').textContent = `Slow: ${d.slowPct}%`;
        document.getElementById('perfMem').style.color  = memColor;
        document.getElementById('perfMem').textContent  = `Mem: ${d.heapMB}/${d.rssMB}MB`;
        document.getElementById('perfEnts').textContent = `Ents: ${d.players}p ${d.minions}m`;
      }
      if (++_perfLogCount >= 3) {
        _perfLogCount = 0;
        const warn = d.slowPct > 20 ? ' ⚠ SLOW' : '';
        console.log(`[PERF] ping=${_ping}ms  tick=${d.avgMs}/${d.maxMs}ms  slow=${d.slowPct}%${warn}  heap=${d.heapMB}MB rss=${d.rssMB}MB  ${d.players}p ${d.minions}m`);
      }
    });
    
    socket.on('room_list', (data) => { updateRoomListUI(data); });
    socket.on('lobby_update', (data) => { updateLobbyUI(data.players, data.roomName, data.settings); });
    socket.on('game_start', (data) => {
      const m = document.getElementById('menu'); if(m) m.style.display = 'none';
      game.isHost = (socket.id === data.hostId);
      game.hostId = data.hostId;
      if (data.settings) {
          game.blueBotDifficulty = data.settings.blueBotDiff / 100;
          game.redBotDifficulty = data.settings.redBotDiff / 100;
          if (data.settings.gameMode) setActiveMode(data.settings.gameMode);
      }
      if(typeof startGameNetworked === 'function') startGameNetworked(data.players);
    });

    // Nastaví deadline interpolaci na entitě — voláno při každém přijatém position packetu.
    // Start = předchozí TARGET (ne aktuální vizuální pozice) aby nedocházelo k jitteru
    // při resetování interpolace uprostřed pohybu.
    // Nastaví target pozici pro smooth follow interpolaci (15 * dt lerp v Player.update)
    function _setInterpTarget(ent, nx, ny) {
      if (Math.hypot(nx - ent.pos.x, ny - ent.pos.y) > 400) {
        ent.pos.x = nx; ent.pos.y = ny; // snap při respawnu/teleportu
      }
    }

    socket.on('network_player_update', (data) => {
      let netPlayer = game.playersById ? game.playersById.get(data.id) : game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) {
        _setInterpTarget(netPlayer, data.x, data.y);
        netPlayer.targetPos = { x: data.x, y: data.y };
        if (!netPlayer.alive && data.alive) netPlayer.revive(); // Pokud u nás byl mrtvý, ale už ožil
        //else if (netPlayer.alive && !data.alive) netPlayer.die(); // Nahrazeno autoritativním 'player_died' eventem
        //netPlayer.hp = data.hp; // HP je nyní plně pod kontrolou Hosta
        netPlayer.aimAngle = data.aimAngle !== undefined ? data.aimAngle : netPlayer.aimAngle;
        // PŘIDÁNO: Přijímání statistik pro Scoreboard (TAB)
        netPlayer.slowTimer = data.slowT || 0;
        netPlayer.boostTimer = data.boostT || 0;
        netPlayer.silenceTimer = data.silenceT || 0;
        netPlayer.stunTimer = data.stunT || 0;
        netPlayer.shield = data.shield || 0;
        netPlayer.hanaBuffTimer = data.hanaT || 0;
        netPlayer.beamTimer = data.beamT || 0;
        netPlayer.beamTargetId = data.beamId;
        netPlayer.uberChargeTimer = data.uberT || 0;
        if (data.invT !== undefined) netPlayer.invulnerableTimer = data.invT;
        if (data.defT !== undefined) netPlayer.defBuffTimer = data.defT;
        if (data.kbT !== undefined && data.kbT > 0) { netPlayer.knockbackTimer = data.kbT; netPlayer.knockbackVel = { x: data.kbVx || 0, y: data.kbVy || 0 }; }
        if (data.msBuffT !== undefined) { netPlayer.msBuffTimer = data.msBuffT; netPlayer.msBuffAmount = data.msBuffAmt || 0; }
        if (data.junglePwrT !== undefined) netPlayer.junglePowerTimer = data.junglePwrT;
        if (data.jungleAsAhT !== undefined) netPlayer.jungleAsAhTimer = data.jungleAsAhT;
        if (data.jungleTankT !== undefined) netPlayer.jungleTankTimer = data.jungleTankT;
        if (data.adAsBuffT !== undefined) { netPlayer.adAsBuffTimer = data.adAsBuffT; netPlayer.adAsBuffAmount = data.adAsBuffAmt || 0; }
        if (data.antiHealT !== undefined) { netPlayer.antiHealTimer = data.antiHealT; netPlayer.antiHealStrength = data.antiHealStr || 0; }
        if (data.regenBuffT !== undefined) { netPlayer.regenBuffTimer = data.regenBuffT; netPlayer.regenBuffAmount = data.regenBuffAmt || 0; }
        if (data.hasPwrup !== undefined) { netPlayer.hasPowerup = data.hasPwrup; netPlayer.powerupTimer = data.pwrupT || 0; }
        if (data.beamUberT !== undefined) netPlayer.beamUberTimer = data.beamUberT;

        if (data.isFullUpdate) {
          if (data.level && data.level > netPlayer.level) { netPlayer.levelUpTimer = 2.0; spawnParticles(netPlayer.pos.x, netPlayer.pos.y, 25, '#ffcc00', {speed: 120, life: 1.0}); }
          netPlayer.level = data.level || netPlayer.level; netPlayer.maxHp = data.maxHp || netPlayer.maxHp;
          netPlayer.items.length = data.items !== undefined ? data.items : netPlayer.items.length;
          netPlayer.AD = data.AD || netPlayer.AD; netPlayer.AP = data.AP || netPlayer.AP; netPlayer.armor = data.armor || netPlayer.armor;
          netPlayer.mr = data.mr || netPlayer.mr; netPlayer.speed = data.speed || netPlayer.speed; netPlayer.attackSpeed = data.attackSpeed || netPlayer.attackSpeed; netPlayer.abilityHaste = data.abilityHaste || netPlayer.abilityHaste;
          netPlayer.invulnerableTimer = data.invTimer || netPlayer.invulnerableTimer; netPlayer.defBuffTimer = data.defTimer || netPlayer.defBuffTimer;
          // PŘIDÁNO: Synchro spell levelů pro správný damage z jejich střel
          if (netPlayer.spells) {
              if (data.qLvl) netPlayer.spells.Q.level = data.qLvl;
              if (data.eLvl) netPlayer.spells.E.level = data.eLvl;
          }
          netPlayer.summonerSpell = data.sumSpell || netPlayer.summonerSpell;
        }
      }
    });
    
    // PŘIDÁNO: Přijímání dat od Hosta (pohyb botů, minionů a věží)
    socket.on('network_host_state', (data) => {
      if (game && game.isHost) return;

      // Knockback/stun korekce hráčů
      (data.humanPosCorrections || []).forEach(cData => {
        const cp = game.playersById?.get(cData.id) ?? game.players.find(x => x.id === cData.id);
        if (!cp) return;
        const dx = cData.x - cp.pos.x, dy = cData.y - cp.pos.y;
        if (dx*dx + dy*dy > 4) { cp.pos.x = cData.x; cp.pos.y = cData.y; }
        if (cData.kbt !== undefined) { cp.knockbackTimer = cData.kbt; cp.knockbackVel = { x: cData.kbvx || 0, y: cData.kbvy || 0 }; }
        if (cData.stT !== undefined) cp.stunTimer = cData.stT;
      });

      // ── Boti ──
      (data.bots || []).forEach(b => {
        const bot = game.playersById ? game.playersById.get(b.id) : game.players.find(p => p.id === b.id);
        if (!bot) return;
        if (b.cls && bot.className !== b.cls) {
          bot.className = b.cls;
          const cd = CLASSES[b.cls];
          if (cd) { bot.glyph = cd.glyph; bot.dmgType = cd.dmgType; bot.range = cd.range;
            bot.spells = { Q: {...cd.Q, cd: bot.spells.Q.cd, level: b.qLv||1}, E: {...cd.E, cd: bot.spells.E.cd, level: b.eLv||1} }; }
        }
        _setInterpTarget(bot, b.x, b.y);
        bot.targetPos = { x: b.x, y: b.y };
        bot.hp = b.hp; bot.alive = !!b.alive; bot.aimAngle = b.aa ?? bot.aimAngle;
        bot.stunTimer        = b.stun ?? 0;
        bot.shield           = b.sh   ?? 0;
        if (b.inv  !== undefined) bot.invulnerableTimer = b.inv;
        if (b.def  !== undefined) bot.defBuffTimer      = b.def;
        if (b.msT  !== undefined) { bot.msBuffTimer = b.msT; bot.msBuffAmount = b.msV ?? 0; }
        if (b.adT  !== undefined) { bot.adAsBuffTimer = b.adT; bot.adAsBuffAmount = b.adV ?? 0; }
        if (b.slw  !== undefined) bot.slowTimer        = b.slw;
        if (b.ahT  !== undefined) { bot.antiHealTimer = b.ahT; bot.antiHealStrength = b.ahV ?? 0; }
        if (b.pw   !== undefined) { bot.hasPowerup = !!b.pw; bot.powerupTimer = b.pwT ?? 0; }
        if (b.bmT  !== undefined) { bot.beamTimer = b.bmT; bot.beamTargetId = b.bmId; }
        if (b.ubT  !== undefined) bot.uberChargeTimer = b.ubT;
        if (b.buT  !== undefined) bot.beamUberTimer   = b.buT;
        if (b.full) {
          if (b.lvl && b.lvl > bot.level) { bot.levelUpTimer = 2.0; spawnParticles(bot.pos.x, bot.pos.y, 25, '#ffcc00', {speed:120,life:1.0}); }
          if (b.lvl)  bot.level  = b.lvl;
          if (b.mhp)  bot.maxHp  = b.mhp;
          if (b.kda)  { bot.kills = b.kda[0]; bot.deaths = b.kda[1]; bot.assists = b.kda[2]; }
          if (b.gold) bot.totalGold = b.gold;
          if (b.itms !== undefined) bot.items.length = b.itms;
          if (b.AD)   bot.AD = b.AD;  if (b.AP)  bot.AP  = b.AP;
          if (b.arm)  bot.armor = b.arm; if (b.mr) bot.mr = b.mr;
          if (b.spd)  bot.speed = b.spd; if (b.as) bot.attackSpeed = b.as;
          if (b.qLv && bot.spells) bot.spells.Q.level = b.qLv;
          if (b.eLv && bot.spells) bot.spells.E.level = b.eLv;
          if (b.ss)   bot.summonerSpell = b.ss;
          if (b.slwT) bot.slowTimer    = b.slwT;
          if (b.bst)  bot.boostTimer   = b.bst;
          if (b.slnc) bot.silenceTimer = b.slnc;
          if (b.han)  bot.hanaBuffTimer = b.han;
          if (b.jpT)  bot.junglePowerTimer = b.jpT;
          if (b.rgT)  { bot.regenBuffTimer = b.rgT; bot.regenBuffAmount = b.rgV ?? 0; }
        }
      });

      // ── Minioni ──
      if (!game.deadMinionIds) game.deadMinionIds = new Set();
      (data.minions || []).forEach(m => {
        if (m.dead) { const mn = game.minionsById?.get(m.id); if (mn) mn.dead = true; return; }
        let minion = game.minionsById?.get(m.id);
        if (!minion && !game.deadMinionIds.has(m.id)) {
          minion = new Minion(m.x, m.y, m.tm ?? 0, m.ti ?? 0);
          minion.id = m.id;
          minion.isSummon = !!m.sum; minion.glyph = m.gl || 'm';
          minion.maxHp = m.mhp || 250; minion.targetHeroId = m.tH;
          minion.isSmallChicken = !!m.sc; minion.isBigChicken = !!m.bc;
          game.minions.push(minion);
        }
        if (minion) {
          _setInterpTarget(minion, m.x, m.y, 0.45);
          minion.targetPos = { x: m.x, y: m.y };
          minion.hp = m.hp;
          // Spawn packet obsahuje statická data (spawn:1), rutinní packet jen x/y/hp
          if (m.spawn) {
            if (m.mhp !== undefined) minion.maxHp = m.mhp;
            if (m.gl  !== undefined) minion.glyph = m.gl;
            if (m.tH  !== undefined) minion.targetHeroId = m.tH;
            if (m.sc  !== undefined) minion.isSmallChicken = !!m.sc;
            if (m.bc  !== undefined) minion.isBigChicken = !!m.bc;
            if (m.tm  !== undefined) minion.team = m.tm;
            if (m.ti  !== undefined) minion.targetIndex = m.ti;
          }
        }
      });

      // ── Věže, healy, nexus (1 Hz slow broadcast) ──
      (data.towers || []).forEach(t => {
        const tower = game.towers.find(x => x.index === t.i);
        if (tower) { if (tower.owner !== t.o && t.o !== -1) game.shake = 0.3;
          tower.control = t.c; tower.owner = t.o;
          if (t.l !== undefined) tower.isLocked = t.l;
          if (t.u !== undefined) tower.unlockTimer = t.u; }
      });
      if (data.heals) data.heals.forEach((act, i) => { if (game.heals[i]) game.heals[i].active = act; });
      if (data.powerup && game.powerup) { game.powerup.active = data.powerup.a; game.powerup.captureTimer = data.powerup.c; }
      if (data.nexus) {
        game.nexus[0] = data.nexus[0]; game.nexus[1] = data.nexus[1];
        if (activeGameMode.name === 'arena') { if (!game.score) game.score = {}; game.score[0] = data.nexus[0]; game.score[1] = data.nexus[1]; }
      }

      // ── Human HP/shield/buffs (10 Hz) ──
      (data.humans || []).forEach(h => {
        const p = game.playersById?.get(h.id) ?? game.players.find(x => x.id === h.id);
        if (!p) return;
        p.hp = h.hp; p.alive = !!h.alive;
        p.shield           = h.sh   ?? 0;
        p.stunTimer        = h.stun ?? 0;
        if (h.slw !== undefined) p.slowTimer        = h.slw;
        if (h.inv !== undefined) p.invulnerableTimer = h.inv;
        if (h.def !== undefined) p.defBuffTimer      = h.def;
        if (h.msT !== undefined) { p.msBuffTimer = h.msT; p.msBuffAmount = h.msV ?? 0; }
        if (h.adT !== undefined) { p.adAsBuffTimer = h.adT; p.adAsBuffAmount = h.adV ?? 0; }
        if (h.pw  !== undefined) { p.hasPowerup = !!h.pw; p.powerupTimer = h.pwT ?? 0; }
        if (h.bmT !== undefined) { p.beamTimer = h.bmT; p.beamTargetId = h.bmId; }
        if (h.ubT !== undefined) p.uberChargeTimer = h.ubT;
        if (h.rly !== undefined) p.rallyTimer = h.rly;
        if (!p.alive && h.alive) { if (p === player) p._serverPosTarget = null; if (typeof p.revive === 'function') p.revive(); }
        else if (p.alive && !h.alive) { p.hp = 0; if (typeof p.die === 'function') p.die(); }
      });
    });

    // 2 Hz scoreboard — gold, exp, kills, items, stats
    socket.on('network_score', (scoreData) => {
      if (game && game.isHost) return;
      (scoreData || []).forEach(s => {
        const p = game.playersById?.get(s.id) ?? game.players.find(x => x.id === s.id);
        if (!p) return;
        if (p === player) {
          const goldDiff = s.gold - (p.totalGold || 0); if (goldDiff > 0) { p.gold += goldDiff; p.totalGold = s.gold; }
          const expDiff  = s.texp - (p.totalExp  || 0); if (expDiff  > 0) { p.exp  += expDiff;  p.totalExp  = s.texp; }
        } else {
          p.totalGold = s.gold; p.gold = s.cg; p.exp = s.exp; p.totalExp = s.texp;
        }
        p.kills = s.kills; p.deaths = s.deaths; p.assists = s.assists;
        if (s.lvl && s.lvl > p.level) { p.levelUpTimer = 2.0; spawnParticles(p.pos.x, p.pos.y, 25, '#ffcc00', {speed:120,life:1.0}); }
        if (s.lvl)  p.level = s.lvl;
        if (s.mhp)  p.maxHp = s.mhp;
        if (s.items && Array.isArray(s.items)) { p.items = s.items; recalcPlayerItemStats(p); }
        if (s.AD)   p.AD = s.AD;   if (s.AP)  p.AP  = s.AP;
        if (s.arm)  p.armor = s.arm; if (s.mr) p.mr = s.mr;
        if (s.spd)  p.speed = s.spd; if (s.as) p.attackSpeed = s.as;
        if (s.stats) { if (!p.stats) p.stats = {}; p.stats.dmgDealt = s.stats[0]; p.stats.dmgTaken = s.stats[1]; p.stats.hpHealed = s.stats[2]; }
        if (s.tc !== undefined) p.towerCaptures = s.tc;
        if (s.td !== undefined) p.towerDefends  = s.td;
        if (s.pcs !== undefined) p.pcs = s.pcs;
        if (s.pwrc !== undefined) p.powerupsCollected = s.pwrc;
      });
    });
    
    // Přijímání jednorázových událostí od serveru (věže střílí, konec hry, efekty)
    socket.on('network_host_event', (data) => {
      if (game && game.isHost) return;
      if (data.type === 'tower_shoot') {
        game.projectiles.push(new Projectile(data.x, data.y, data.vx, data.vy, 'tower', data.owner, {damage: data.damage, dmgType: 'physical', glyph: '♦', life: data.life}));
      } else if (data.type === 'pull_hit') {
        spawnParticles(data.tx, data.ty, 8, '#800080', {speed: 120});
        if (data.stun) game.effectTexts.push(new gc.EffectText(data.tx, data.ty - 20, "STUNNED", '#ffcc00'));
      } else if (data.type === 'minion_shoot') {
        // Visual-only minion projectile — cull if > 900px from local player
        const viewX = player ? player.pos.x : data.x;
        const viewY = player ? player.pos.y : data.y;
        if ((data.x - viewX)**2 + (data.y - viewY)**2 < 900*900) {
          const color = data.tm === 0 ? '#7af' : '#f87';
          game.projectiles.push(new Projectile(data.x, data.y, data.vx, data.vy, 'minion', data.tm, {damage: 0, dmgType: 'physical', glyph: '•', life: data.life, radius: 5, noHit: true, color}));
        }
      } else if (data.type === 'heal_pickup') {
        let p = game.players.find(x => x.id === data.playerId);
        if (p) {
          // HP comes authoritatively via _broadcastPvp — don't override it here
          const heal = game.heals && game.heals[data.healIndex];
          const px = heal ? heal.pos.x : (p.pos.x); const py = heal ? heal.pos.y : (p.pos.y);
          spawnParticles(px, py, 25, '#0f0', {speed: 150});
          playSound('heal_pickup', p.pos);
          if (p === player) { flashMessage("+33% HP!"); game.screenHealFlash = 0.5; }
        }
      } else if (data.type === 'powerup_pickup') {
        let p = game.players.find(x => x.id === data.playerId);
        if (p) { p.hasPowerup = true; p.powerupTimer = 120.0; if (p.powerupsCollected !== undefined) p.powerupsCollected += 1; if (typeof p.refreshDominionPCS === 'function') p.refreshDominionPCS(); spawnParticles(data.x, data.y, 40, '#ff0', {speed: 250}); if(p === player) flashMessage("POWER UP OBTAINED! (+20% STATS)"); }
      } else if (data.type === 'game_over') {
        if (data.finalStats) {
            data.finalStats.forEach(fs => {
                let p = game.players.find(x => x.id === fs.id);
                if (p) { p.stats = fs.stats; p.kills = fs.kills; p.deaths = fs.deaths; p.assists = fs.assists; p.totalGold = fs.totalGold; p.towerCaptures = fs.towerCaptures || 0; p.towerDefends = fs.towerDefends || 0; p.towerAssaultTime = fs.towerAssaultTime || 0; p.objectivePresenceTime = fs.objectivePresenceTime || 0; p.powerupsCollected = fs.powerupsCollected || 0; p.powerupUptime = fs.powerupUptime || 0; p.pcs = fs.pcs || 0; p.pcsBreakdown = fs.pcsBreakdown || p.pcsBreakdown; }
            });
        }
        game.gameOver = true; game.winner = data.winner; showEnd(game.winner); 
      }
      // PŘIDÁNO: Host autoritativně mění HP hráčů
      else if (data.type === 'player_hp_update') {
        let p = game.players.find(x => x.id === data.id); if (p) { p.hp = data.hp; if (data.shield !== undefined) p.shield = data.shield; }
      } else if (data.type === 'player_died') {
        let p = game.players.find(x => x.id === data.id); if (p && p.alive) { if (p === player) p._serverPosTarget = null; handlePlayerKill(p, data.killerId); }
      } else if (data.type === 'show_damage') {
        // Vlastní útoky zobrazujeme lokálně v applyDamage — přeskočit echo ze serveru
        if (player && data.sourceId === player.id) { /* skip — already shown locally */ } else {
        let t = game.players.find(p => p.id === data.targetId) || game.minions.find(m => m.id === data.targetId);
        if (t) {
            let isLocal = (player && (data.sourceId === player.id || data.targetId === player.id));
            let color = '#ffffff';
            if (data.dmgType === 'physical') color = isLocal ? '#ffdddd' : '#ff8888';
            else if (data.dmgType === 'magical') color = isLocal ? '#ddddff' : '#88bbff';
            else color = isLocal ? '#ffffff' : '#ffc83c';
            game.damageNumbers.push(new DamageNumber(t.pos.x, t.pos.y-6, data.amount, color));
            let pCount = Math.min(30, Math.max(3, Math.floor(data.amount / 10)));
            spawnParticles(t.pos.x, t.pos.y, pCount, '#f00', { speed: 100 + (data.amount / 2) });
            if (t === player) game.screenDamageFlash = Math.min(1.0, (game.screenDamageFlash || 0) + data.amount / 450);
        }
        }
      } else if (data.type === 'show_heal') {
        let t = game.players.find(p => p.id === data.targetId) || game.minions.find(m => m.id === data.targetId);
        if (t) {
            game.damageNumbers.push(new DamageNumber(t.pos.x, t.pos.y-15, '+' + data.amount, '#00ff00'));
            if (t === player) game.screenHealFlash = Math.min(1.0, (game.screenHealFlash || 0) + data.amount / 450);
        }
      } else if (data.type === 'jungle_buff') {
        let p = game.players.find(x => x.id === data.playerId);
        if (p) {
            if (data.buff === 'POWER') p.junglePowerTimer = 120.0;
            else if (data.buff === 'AS_AH') p.jungleAsAhTimer = 120.0;
            else if (data.buff === 'TANK') p.jungleTankTimer = 120.0;
            spawnParticles(p.pos.x, p.pos.y, 30, '#fff', {speed: 150});
            if(p === player) flashMessage("JUNGLE BUFF OBTAINED!");
        }
      } else if (data.type === 'uber_buffs') {
        const doc = game.players.find(x => x.id === data.doctorId);
        const tgt = game.players.find(x => x.id === data.targetId);
        if (doc) { doc.beamUberTimer = 1.5; doc.invulnerableTimer = Math.max(doc.invulnerableTimer || 0, 1.5); doc.msBuffTimer = Math.max(doc.msBuffTimer || 0, 1.5); doc.msBuffAmount = 0.3; }
        if (tgt) { tgt.invulnerableTimer = Math.max(tgt.invulnerableTimer || 0, 1.5); tgt.msBuffTimer = Math.max(tgt.msBuffTimer || 0, 1.5); tgt.msBuffAmount = 0.3; spawnParticles(tgt.pos.x, tgt.pos.y, 20, '#ffcc00', {speed: 180}); if (tgt === player) flashMessage("UBERCHARGE! IMMUNE!"); }
      }
    });
    
    // Přijímání útoků a kouzel od ostatních hráčů (vizuální efekty)
    // buy_item / sell_item jsou nyní plně pod kontrolou serveru — stav přichází přes network_host_state
    socket.on('network_player_action', (data) => {
      let netPlayer = game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) {
        if (data.type === 'shoot') netPlayer.shoot(data.tx, data.ty, true);
        else if (data.type === 'cast') netPlayer.castSpell(data.spKey, data.tx, data.ty, true);
        else if (data.type === 'summoner') netPlayer.castSummonerSpell(true);
        // buy_item / sell_item: server aplikuje a pošle aktualizaci přes _broadcastSlow — tady nic neděláme
      }
    });

    socket.on('network_knockback', (data) => {
      if (game && game.isHost) return;
      const p = game.playersById?.get(data.id) ?? game.players.find(x => x.id === data.id);
      if (!p) return;
      // Snap to authoritative position and apply knockback velocity locally
      p.pos.x = data.x; p.pos.y = data.y;
      p.knockbackTimer = data.kbt;
      p.knockbackVel = { x: data.kbvx, y: data.kbvy };
    });

    socket.on('network_kill_feed', (data) => {
      data.timer = 5.0;
      if (game.killFeed) game.killFeed.push(data);
    });

    // Server pošle autoritativní seznam botů těsně po game_start
    socket.on('bot_roster', (bots) => {
      if (!game.started) return;
      const spawnPoints = activeGameMode.mapConfig.spawnPoints;
      for (const bData of bots) {
        if (game.playersById && game.playersById.has(bData.id)) continue; // už existuje
        if (game.players.find(p => p.id === bData.id)) continue;
        const sp = spawnPoints[bData.team];
        const bot = new BotPlayer(sp.x, sp.y, { team: bData.team, id: bData.id, className: bData.className, lane: bData.lane, summonerSpell: bData.summonerSpell });
        bot._isBotPlayer = true;
        game.players.push(bot);
      }
      game.playersById = new Map(game.players.map(p => [p.id, p]));
    });

    socket.on('player_disconnected', (id) => {
       if(game && game.players) {
         game.players = game.players.filter(p => p.id !== id);
         game.playersById = new Map(game.players.map(p => [p.id, p]));
       }
       if(game && game.hostId === id) {
           alert('Host disconnected. The match has ended.');
           window.location.reload();
       }
    });
  } else {
    console.warn('[KLIENT] Socket.io knihovna nenalezena. Hra běží offline.');
  }

  // =========================================================================
  // ⚙️ GAME ENGINE & BALANCE CONFIGURATION ⚙️
  // Zde můžeš upravovat veškeré základní statistiky, mapu a hodnoty ve hře.
  // =========================================================================

  export const keys = {};
  window.addEventListener('keydown', e=>{ if(e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = true; if(['w','a','s','d','tab','c','v','m','j','k','arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
  window.addEventListener('keyup', e=>{ if(e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = false; });
  
  // Prohlížeče vyžadují k aktivaci audia akci uživatele
  window.addEventListener('click', () => initAudio(), { once: true });
  window.addEventListener('keydown', () => initAudio(), { once: true });

  // action keys (non-repeat)
  window.addEventListener('keydown', e=>{
    if(e.target.tagName === 'INPUT' || e.repeat) return;
    const k = e.key.toLowerCase();
    const qKey = (game.autoTarget && !game.mouseTarget) ? 'j' : 'q';
    const eKey = (game.autoTarget && !game.mouseTarget) ? 'k' : 'e';
    const sumKey = (game.autoTarget && !game.mouseTarget) ? 'l' : 'f';
    
    if(k === qKey) { if(keys['shift']) { player && player.allocateSpellPoint && player.allocateSpellPoint('Q'); } else { player && player.castSpell && player.castSpell('Q'); } }
    if(k === eKey) { if(keys['shift']) { player && player.allocateSpellPoint && player.allocateSpellPoint('E'); } else { player && player.castSpell && player.castSpell('E'); } }
    if(k === sumKey && !keys['shift']) { player && player.castSummonerSpell && player.castSummonerSpell(); }
    if(k === 'b' && !keys['shift']) toggleShop();
    if(k === 'b' && keys['shift']) { game.autoBuy = !game.autoBuy; flashMessage('Auto-Buy: ' + (game.autoBuy ? 'ON' : 'OFF')); }
    if(k === 'u' && keys['shift']) { game.autoAttack = !game.autoAttack; flashMessage('Auto-Attack: ' + (game.autoAttack ? 'ON' : 'OFF')); }
    if(k === 'i' && keys['shift']) { game.autoTarget = !game.autoTarget; if (game.autoTarget) game.mouseTarget = false; flashMessage('Auto-Focus: ' + (game.autoTarget ? 'ON' : 'OFF')); }
    if(k === 'o' && keys['shift']) { game.mouseTarget = !game.mouseTarget; if (game.mouseTarget) game.autoTarget = false; flashMessage('Mouse-Focus: ' + (game.mouseTarget ? 'ON' : 'OFF')); }
    if(k === 'l' && keys['shift']) { game.autoLevelUp = !game.autoLevelUp; flashMessage('Auto-LevelUp: ' + (game.autoLevelUp ? 'ON' : 'OFF')); }
    if(k === 'f' && keys['shift']) { game.debugMapTools = !game.debugMapTools; flashMessage('Map Debug: ' + (game.debugMapTools ? 'ON' : 'OFF')); }
    if(k === 'f' && !keys['shift'] && game.debugMapTools) { console.log(`{x: ${Math.round(mouse.wx)}, y: ${Math.round(mouse.wy)}}`); flashMessage(`Logged: ${Math.round(mouse.wx)}, ${Math.round(mouse.wy)}`); }
    if(k === 'm' && keys['shift']) { game.showMapOverlay = !game.showMapOverlay; flashMessage('Map Overlay: ' + (game.showMapOverlay ? 'ON' : 'OFF')); }
  });

  export const mouse = { sx:0, sy:0, down:false, wx:0, wy:0 };
  canvas.addEventListener('mousemove', e=>{ const r = canvas.getBoundingClientRect(); mouse.sx = e.clientX - r.left; mouse.sy = e.clientY - r.top; });
  window.addEventListener('mousedown', ()=> {
    mouse.down = true;
    if (game.debugMapTools) {
      console.log(`{x: ${Math.round(mouse.wx)}, y: ${Math.round(mouse.wy)}}`);
      flashMessage(`Logged: ${Math.round(mouse.wx)}, ${Math.round(mouse.wy)}`);
    }
  });
  window.addEventListener('mouseup', ()=> mouse.down = false);

  export function screenToWorld(sx, sy){ return { x: camera.x + sx / camera.scale, y: camera.y + sy / camera.scale }; }

  const _hpBars = ['[     ]','[|    ]','[||   ]','[|||  ]','[|||| ]','[|||||]'];
  export function drawHealthBar(ctx, hp, maxHp, x, y, team) {
    const f = Math.max(0, Math.min(5, Math.round((Math.max(0, hp) / maxHp) * 5) || 0));
    ctx.font = '10px monospace'; ctx.fillStyle = team === 0 ? '#486FED' : (team === 1 ? '#FF4E4E' : '#999');
    ctx.fillText(_hpBars[f], x, y);
  }

  export function grantRewards(targetPlayer, baseGold, baseExp) {
    if (!targetPlayer) return;
    let avgLevel = 1;
    let totalLevel = 0;
    let count = 0;
    for (let p of game.players) { if (p.team >= 0) { totalLevel += p.level; count++; } }
    if (count > 0) avgLevel = totalLevel / count;

    let mult = 1.0;
    if (targetPlayer.level >= avgLevel + 2) mult = 0.5;
    else if (targetPlayer.level <= avgLevel - 2) mult = 1.5;

    let finalGold = Math.round(baseGold * mult);
    let finalExp = Math.round(baseExp * mult);

    targetPlayer.gold += finalGold;
    targetPlayer.totalGold += finalGold;
    targetPlayer.exp += finalExp;
    targetPlayer.totalExp = (targetPlayer.totalExp || 0) + finalExp;

    // Boti nakupují hned jak mají gold (bez shop omezení zóny)
    if (targetPlayer instanceof BotPlayer && (!socket || game.isHost)) {
      const botEnemies = game.players.filter(p => p.team !== targetPlayer.team);
      BotPlayer.botBuyItems(targetPlayer, botEnemies);
    }
  }

  // Per-hero exp % when N allies are nearby at minion death: 1→100%, 2→75%, 3→50%, 4→33%, 5→25%
  const _MINION_EXP_PCT = [1.0, 0.75, 0.50, 0.33, 0.25];

  export function grantMinionKillRewards(killer, minionPos) {
    if (!killer) return;
    let totalLevel = 0, pCount = 0;
    for (const p of game.players) { if (p.team >= 0) { totalLevel += p.level; pCount++; } }
    const avgLevel = pCount > 0 ? totalLevel / pCount : 1;
    const snowMult = (pl) => pl.level >= avgLevel + 2 ? 0.5 : pl.level <= avgLevel - 2 ? 1.5 : 1.0;

    // Gold AND Exp shared among all nearby allies (same area table)
    const nearby = game.players.filter(p => p.alive && p.team === killer.team && dist(p.pos, minionPos) <= 300);
    const recipients = nearby.length > 0 ? nearby : [killer];
    const pct = _MINION_EXP_PCT[Math.min(recipients.length - 1, _MINION_EXP_PCT.length - 1)];
    const modeMult = (activeGameMode && activeGameMode.name === 'arena') ? 1.5 : 1.0;
    for (const p of recipients) {
      const m = snowMult(p) * modeMult;
      const prevGold = p.gold;
      p.gold      += Math.round(8  * pct * m);
      p.totalGold += Math.round(8  * pct * m);
      p.exp       += Math.round(11 * pct * m);
      p.totalExp   = (p.totalExp || 0) + Math.round(11 * pct * m);
      // Bot nakupuje jakmile překoná práh pro basic item (throttled)
      if (p instanceof BotPlayer && (!socket || game.isHost) && prevGold < 250 && p.gold >= 250) {
        const botEnemies = game.players.filter(e => e.team !== p.team);
        BotPlayer.botBuyItems(p, botEnemies);
      }
    }
  }

  export function applyHeal(target, amount) {
    if(!target || target.dead || target.hp <= 0) return 0;
    // Anti-heal: reduce incoming heal (takes strongest active debuff, no stacking)
    if ((target.antiHealTimer || 0) > 0 && (target.antiHealStrength || 0) > 0) {
        amount *= (1 - target.antiHealStrength);
    }
    if (amount <= 0) return 0;
    let oldHp = target.hp;

    // SERVER AUTORITA
    if (!socket || game.isHost) {
        target.hp = Math.min(target.effectiveMaxHp || target.maxHp, target.hp + amount);
        let actualHeal = Math.round(target.hp - oldHp);
        if (actualHeal > 0) {
            if (target === player) game.screenHealFlash = Math.min(1.0, (game.screenHealFlash || 0) + actualHeal / 450);
            game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-15, '+' + actualHeal, '#00ff00'));
        }
        return actualHeal;
    }
    return 0;
  }

  export function applyDamage(target, amount, type, sourceId, isNetwork = false, isSpell = false, isAoE = false) {
    if(!target || target.dead || target.hp <= 0) return 0;
    if(target.invulnerableTimer > 0 && type !== 'true') {
        game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, "IMMUNE"));
        return 0;
    }
    const sourceEntity = game.players.find(p => p.id === sourceId) || game.minions.find(m => m.id === sourceId);

    // LoL agro: pokud hrdina zaútočí na spojeneckou jednotku v range nepřátelské věže, věž přepne agro na tohoto hrdinu
    if (sourceEntity && sourceEntity.className && (!socket || game.isHost)) {
      for (const tower of game.towers) {
        if (!tower.dead && tower.owner >= 0 && tower.owner !== sourceEntity.team) {
          const towerInRange = dist(sourceEntity.pos, tower.pos) <= tower.attackRange;
          if (towerInRange && target && target.team === tower.owner) {
            tower._aggroTarget = sourceEntity;
          }
        }
      }
    }

    let multiplier = 1;
    let arm = target.armor || 0; let mr = target.mr || 0;
    if(target.hasPowerup) { arm *= 1.2; mr *= 1.2; }
    if(target.boostTimer > 0) { arm *= 1.1; mr *= 1.1; }
    if(target.jungleTankTimer > 0) { arm *= 1.1; mr *= 1.1; }
    if(target.defBuffTimer > 0) { arm += 50; mr += 50; }
    if (sourceEntity) {
      const pen = sourceEntity.adaptivePen || 0;
      if (type === 'physical') arm = Math.round(arm * (1 - pen));
      else if (type === 'magical') mr = Math.round(mr * (1 - pen));
    }
    if (type === 'physical') multiplier = 100 / (100 + arm);
    else if (type === 'magical') multiplier = 100 / (100 + mr);
    else if (type === 'true' || type === 'dot') multiplier = 1; // Pure damage (Fountain laser)
    
    const actualDamage = Math.round(amount * multiplier);
    let finalDamage = actualDamage;
    
    // SERVER AUTORITA: Klient nesmí sám sobě nebo ostatním měnit HP bez pokynu
    if (!socket || game.isHost || isNetwork) { 
        if (target.shield > 0 && type !== 'true') {
            let sDmg = Math.min(target.shield, finalDamage);
            target.shield -= sDmg;
            finalDamage -= sDmg;
        }
        target.hp -= finalDamage;
        target.lastAttackerId = sourceId;
        // Titan's Sigil/Shard passive: % enemy max HP bonus magic dmg on spell hit (4s CD)
        if (finalDamage > 0 && isSpell && (sourceEntity?.titanSigilSpellDmg || 0) > 0 && (sourceEntity.titanSigilCd || 0) <= 0 && target.maxHp && type !== 'true') {
            const sigilBonus = Math.round(target.maxHp * sourceEntity.titanSigilSpellDmg);
            target.hp -= sigilBonus;
            sourceEntity.titanSigilCd = 2.0;
            game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y + 14, sigilBonus, '#e0e0ff'));
        }

        // Strike Burn
        if ((sourceEntity?.strikeBurnPct || 0) > 0 && type !== 'true' && type !== 'dot' && target.maxHp && !(target instanceof Tower)) {
            let burnMult = (isSpell && isAoE) ? 0.5 : 1.0;
            let totalBurnDmg = target.maxHp * sourceEntity.strikeBurnPct * burnMult;
            target.burnDotTimer = 2.0;
            target.burnDotTickDmg = totalBurnDmg / 4.0;
            target.burnDotSource = sourceId;
            if (!target.burnDotTick || target.burnDotTick <= 0) target.burnDotTick = 0.5;
        }
    }
    target.flashTimer = 0.1;
    
    if (finalDamage > 0 || actualDamage > 0) {
        let isHeroInvolved = game.players.some(p => p.id === sourceId || p.id === target.id);
        if (isHeroInvolved && type !== 'dot') { // Přehrává zvuk pouze pokud se boje účastní nějaký hrdina a nejedná se o tichý DoT
            playSound('hit', target.pos);
        }
        if (target === player && (!socket || game.isHost || isNetwork)) game.screenDamageFlash = Math.min(1.0, (game.screenDamageFlash || 0) + finalDamage / 450);

        if (!socket || game.isHost || isNetwork || (player && sourceId === player.id)) {
            let pCount = Math.min(30, Math.max(3, Math.floor(finalDamage / 10)));
            spawnParticles(target.pos.x, target.pos.y, pCount, '#f00', { speed: 100 + (finalDamage / 2) });
        }

        // V server módu zobrazit lokálně jen vlastní útoky (okamžitý feedback), server broadcastuje ostatním
        const isMyAttack = player && sourceId === player.id;
        if (!socket || game.isHost || isMyAttack) {
            let isLocal = (player && (sourceId === player.id || target.id === player.id));
            let color = '#ffffff';
            if (finalDamage < actualDamage) color = '#aaaaaa';
            else if (type === 'physical') color = isLocal ? '#ffdddd' : '#ff8888';
            else if (type === 'magical') color = isLocal ? '#ddddff' : '#88bbff';
            else color = isLocal ? '#ffffff' : '#ffc83c';
            game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, actualDamage, color));
        }
    }

        if ((!socket || game.isHost || isNetwork) && sourceEntity instanceof Player && finalDamage > 0) {
          const sustain = type !== 'true' ? (sourceEntity.lifesteal || 0) : 0;
          if (sustain > 0) {
            // AoE sustain cap: first target in a 50ms window heals at 100%, subsequent at 20%
            // This prevents AoE spells from healing 5x more than single-target attacks
            const now = performance.now();
            if (!sourceEntity._svWin || now - sourceEntity._svWin.t > 50) {
                sourceEntity._svWin = { t: now, count: 0 };
            }
            sourceEntity._svWin.count++;
            const aoeMult = sourceEntity._svWin.count === 1 ? 1.0 : 0.2;
            const healed = applyHeal(sourceEntity, finalDamage * sustain * aoeMult);
            if (healed > 0 && sourceEntity.stats) sourceEntity.stats.hpHealed += healed;
          }
          // Apply anti-heal debuff to the target (non-stacking: takes strongest effect)
          if ((sourceEntity.antiHeal || 0) > 0) {
            target.antiHealTimer = Math.max(target.antiHealTimer || 0, 2.0);
            target.antiHealStrength = Math.max(target.antiHealStrength || 0, sourceEntity.antiHeal);
          }
        }

    // PŘIDÁNO: Centrální registrace mrtvých minionů pro prevenci "duchů" a falešných duplicitních zisků goldů
    if (target instanceof Minion && target.hp <= 0) {
        if (typeof target._handleJungleDeath === 'function') target._handleJungleDeath();
        if (!game.deadMinionIds) game.deadMinionIds = new Set();
        game.deadMinionIds.add(target.id);
    }

    // TRACKOVÁNÍ STATISTIK A ASISTENCÍ
    if (!socket || game.isHost) {
        if (sourceEntity && sourceEntity.stats) {
            sourceEntity.stats.dmgDealt += actualDamage;
            if (target instanceof Player) sourceEntity.stats.dmgDealtToHeroes = (sourceEntity.stats.dmgDealtToHeroes || 0) + actualDamage;
            else if (target instanceof Minion) sourceEntity.stats.dmgDealtToMinions = (sourceEntity.stats.dmgDealtToMinions || 0) + actualDamage;
        }
        if (target.stats) target.stats.dmgTaken += actualDamage;
        if (target instanceof Player && sourceEntity && sourceEntity.team !== target.team) {
            let existing = target.recentAttackers.get(sourceId);
            let now = performance.now();
            let isRecent = existing && (now - existing.time < 10000); // 10 vteřin paměť souboje
            target.recentAttackers.set(sourceId, { time: now, count: isRecent ? existing.count + 1 : 1, damage: isRecent ? existing.damage + actualDamage : actualDamage });
        }
    }

    return actualDamage;
  }

  export function handlePlayerKill(victim, killerId) {
      if (!victim || !victim.alive) return; // Zamezení vícenásobného započítání smrti z vícero zdrojů poškození
      playSound('kill', victim.pos);
      victim.hp = 0; if (victim.die) victim.die(); else victim.dead = true;
      
      let killer = game.players.find(p => p.id === killerId);

      // Pokud zabil minion, věž, laser nebo spojenec, zkusíme najít asistenci hrdiny
      if (!killer || killer.team === victim.team) {
          let lastHeroAttackerId = null;
          let lastTime = 0;
          let now = performance.now();
          if (victim.recentAttackers) {
              victim.recentAttackers.forEach((data, attackerId) => {
                  let t = data.time || data;
                  let p = game.players.find(x => x.id === attackerId);
                  if (p && p.team !== victim.team && (now - t) < 10000 && t > lastTime) {
                      lastTime = t;
                      lastHeroAttackerId = attackerId;
                  }
              });
          }
          if (lastHeroAttackerId) {
              killerId = lastHeroAttackerId;
              killer = game.players.find(p => p.id === killerId);
          }
        }

      let killerName = killer ? killer.className : (killerId === 'laser' ? 'Laser' : (killerId === 'tower' ? 'Tower' : 'Minion'));
      let killerTeam = killer ? killer.team : -1;
      
      const killData = { killer: killerName, victim: victim.className || 'Player', killerTeam: killerTeam, victimTeam: victim.team, timer: 5.0 };
      if (game.killFeed) game.killFeed.push(killData);

      if (!socket || game.isHost) {
          if (killer) { grantRewards(killer, 150, 50); killer.kills++; if (typeof killer.refreshDominionPCS === 'function') killer.refreshDominionPCS(); game.nexus[victim.team] = Math.max(0, (game.nexus[victim.team] || 0) - 2); if (typeof activeGameMode.onKill === 'function') activeGameMode.onKill(killer.team); }
          let now = performance.now();
          if (victim.recentAttackers) {
              victim.recentAttackers.forEach((data, attackerId) => {
                  let t = data.time || data;
                  if (attackerId !== killerId && (now - t) < 10000) {
                      let assister = game.players.find(p => p.id === attackerId);
                if (assister && assister.team !== victim.team) { assister.assists++; grantRewards(assister, 50, 25); if (typeof assister.refreshDominionPCS === 'function') assister.refreshDominionPCS(); }
                  }
              });
              victim.recentAttackers.clear();
          }
      }
  }

  export function moveEntityWithCollision(ent, vx, vy, dt) {
    const cx = activeGameMode.mapConfig.world.width/2, cy = activeGameMode.mapConfig.world.height/2, maxR = 1900;
    ent.pos.x += vx * dt; ent.pos.y += vy * dt;
    ent.pos.x = clamp(ent.pos.x, ent.radius, activeGameMode.mapConfig.world.width - ent.radius);
    ent.pos.y = clamp(ent.pos.y, ent.radius, activeGameMode.mapConfig.world.height - ent.radius);
    
    let gridX = Math.floor(ent.pos.x / 200), gridY = Math.floor(ent.pos.y / 200);
    let nearbyWalls = game.wallGrid ? (game.wallGrid.get(gridX * 10000 + gridY) || []) : game.walls;
    for(let w of nearbyWalls) {
      let info = distToPoly(ent.pos.x, ent.pos.y, w.pts);
      if (info.inside) {
        let pushDist = info.minDist + w.r + ent.radius;
        ent.pos.x += info.closestNorm.x * pushDist; ent.pos.y += info.closestNorm.y * pushDist;
      } else if (info.minDist < w.r + ent.radius) {
        let pushDist = (w.r + ent.radius) - info.minDist;
        let dx = ent.pos.x - info.closestPt.x, dy = ent.pos.y - info.closestPt.y, dl = Math.hypot(dx, dy);
        if (dl > 0) { ent.pos.x += (dx/dl)*pushDist; ent.pos.y += (dy/dl)*pushDist; }
        else { ent.pos.x += info.closestNorm.x * pushDist; ent.pos.y += info.closestNorm.y * pushDist; }
      }
    }
    
    // Custom polygon boundary collision
    const _mb = activeGameMode.mapConfig.mapBoundary;
    let isInside = isPointInPoly(ent.pos.x, ent.pos.y, _mb);
    let minDistB = Infinity; let closestB = null;
    for(let i=0; i<_mb.length; i++) {
      let p1 = _mb[i], p2 = _mb[(i+1)%_mb.length];
      let l2 = (p2.x-p1.x)**2 + (p2.y-p1.y)**2;
      let t = l2===0 ? 0 : ((ent.pos.x-p1.x)*(p2.x-p1.x) + (ent.pos.y-p1.y)*(p2.y-p1.y))/l2;
      t = Math.max(0, Math.min(1, t)); 
      let clx = p1.x + t*(p2.x-p1.x), cly = p1.y + t*(p2.y-p1.y);
      let d = Math.hypot(ent.pos.x-clx, ent.pos.y-cly);
      if (d < minDistB) { minDistB = d; closestB = {x:clx, y:cly}; }
    }
    if (!isInside || minDistB < ent.radius) {
      let dx = ent.pos.x - closestB.x, dy = ent.pos.y - closestB.y;
      let d = Math.hypot(dx, dy);
      if (d === 0) { dx = cx - ent.pos.x; dy = cy - ent.pos.y; d = Math.hypot(dx, dy); }
      if (isInside) { let push = ent.radius - minDistB; ent.pos.x += (dx/d)*push; ent.pos.y += (dy/d)*push; }
      else { ent.pos.x = closestB.x - (dx/d)*ent.radius; ent.pos.y = closestB.y - (dy/d)*ent.radius; }
    }
  }

  export let player = null;
  
  // DRAFTING LOGIKA: Inteligentní výběr postav pro boty
  export function getSmartBotClass(myTeamPicked, enemyTeamPicked) {
      let roleCounts = { 'SPLITPUSHER': 0, 'SLAYER': 0, 'TANK': 0, 'SUPPORT': 0, 'FIGHTER': 0 };
      for (let c of myTeamPicked) { 
          let r = CLASSES[c] ? CLASSES[c].role : null;
          if(r && roleCounts[r] !== undefined) roleCounts[r]++; 
      }

      let candidates = Object.keys(CLASSES).map(c => {
          let weight = 100;
          let role = CLASSES[c].role || 'FIGHTER';

          if (role === 'SUPPORT') {
              if (roleCounts['SUPPORT'] === 0) weight *= 3.0; // Extrémní priorita, pokud chybí
              else if (roleCounts['SUPPORT'] === 1) weight *= 0.05; // 5% šance na double supporta
              else weight = 0; // 3. support zakázán
          }
          if (role === 'TANK') {
              if (roleCounts['TANK'] === 0) weight *= 3.0; // Extrémní priorita
              else if (roleCounts['TANK'] >= 2) weight *= 0.1; // Další tank jen výjimečně
          }
          if (role === 'SLAYER') {
              if (roleCounts['SLAYER'] === 0) weight *= 2.0; 
              else if (roleCounts['SLAYER'] >= 2) weight *= 0.4;
          }
          if (role === 'FIGHTER') {
              if (roleCounts['FIGHTER'] === 0) weight *= 2.0;
              else if (roleCounts['FIGHTER'] >= 2) weight *= 0.4;
          }
          
          if (myTeamPicked.includes(c)) weight = 0; // Vlastní tým nesmí mít stejné postavy
          if (enemyTeamPicked.includes(c)) weight *= 0.10; // Anti-Mirror: Pouze 10% šance, že zrcadlově vybere to co nepřítel

          return { className: c, weight: weight };
      });

      let totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight <= 0) return Object.keys(CLASSES)[0]; // Fallback
      
      let rand = Math.random() * totalWeight;
      for (let c of candidates) {
          if (rand < c.weight) return c.className;
          rand -= c.weight;
      }
      return Object.keys(CLASSES)[0];
  }

  export function startGame(playerClass, playerTeam = 0, isSpectator = false, summonerSpell = 'Heal') {
    game.players = []; game.minions = []; game.projectiles = [];
    game.isSpectator = isSpectator;
    game.isHost = true; // Důležité: Aby boti a hra nečekali na síťové příkazy!

    // Reinicializace mapy pro aktuální game mode (může se lišit od defaultu)
    game.bgCanvas = null; game.minimapBg = null; game.minimapOverlay = null;
    initWalls(); initTowers();
    activeGameMode.init();

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const cw = Math.max(window.innerWidth, window.innerHeight);
        const ch = Math.min(window.innerWidth, window.innerHeight);
        camera.scale = Math.min(cw / 1200, ch / 600);
    }

    const spawnPoints = activeGameMode.mapConfig.spawnPoints;
    let bluePicked = [];
    let redPicked = [];
    const spellsArray = Object.keys(SUMMONER_SPELLS);

    if (!isSpectator) {
        if (playerTeam === 0) bluePicked.push(playerClass);
        else redPicked.push(playerClass);

        player = new Player(spawnPoints[playerTeam].x, spawnPoints[playerTeam].y, { team: playerTeam, id:'player0', className: playerClass, summonerSpell });
        // summonerSpell is now passed from lobby selection
        game.players.push(player);
    } else {
        player = null;
        camera.x = activeGameMode.mapConfig.world.width / 2;
        camera.y = activeGameMode.mapConfig.world.height / 2;
    }

    const getBotLane = (idx) => activeGameMode.getBotLane(idx);

    const teamSize = activeGameMode.mapConfig.teamSize || 5;
    let blueBotCount = (!isSpectator && playerTeam === 0) ? teamSize - 1 : teamSize;
    let redBotCount  = (!isSpectator && playerTeam === 1) ? teamSize - 1 : teamSize;
    let totalBots = Math.max(blueBotCount, redBotCount);

    // Boti si vybírají na střídačku, aby dokázali reagovat na kompozici nepřítele a nebrali zrcadlové postavy
    for (let i = 1; i <= totalBots; i++) {
        if (i <= blueBotCount) {
            const c = getSmartBotClass(bluePicked, redPicked);
            bluePicked.push(c);
            let bot = new BotPlayer(spawnPoints[0].x + Math.random()*50, spawnPoints[0].y + Math.random()*50, {team:0, id:'bot0_'+i, className: c, lane: getBotLane(i), summonerSpell: spellsArray[Math.floor(Math.random()*spellsArray.length)]});
            game.players.push(bot);
        }
        if (i <= redBotCount) {
            const c = getSmartBotClass(redPicked, bluePicked);
            redPicked.push(c);
            let bot = new BotPlayer(spawnPoints[1].x + Math.random()*50, spawnPoints[1].y + Math.random()*50, {team:1, id:'bot1_'+i, className: c, lane: getBotLane(i), summonerSpell: spellsArray[Math.floor(Math.random()*spellsArray.length)]});
            game.players.push(bot);
        }
    }

    game.started = true;
    updateSpellLabels();

    const mc = document.getElementById('mobileControls'); if (mc) mc.style.display = 'block';
    game.heals = activeGameMode.mapConfig.healPickupPositions.map(p => new HealPickup(p.x, p.y));
    const _pp1 = activeGameMode.mapConfig.powerupPosition;
    game.powerup = _pp1 ? new PowerUp(_pp1.x, _pp1.y) : null;
    game.speedPads = (activeGameMode.mapConfig.speedPadPositions || []).map(p => new SpeedPad(p.x, p.y));

    console.log(`[DEBUG] Game started! Player selected class: ${playerClass}`);
  }

  function startGameNetworked(playersData) {
    game.players = []; game.minions = []; game.projectiles = [];

    // Reinicializace mapy pro aktuální game mode (setActiveMode bylo zavoláno těsně před tímto)
    game.bgCanvas = null; game.minimapBg = null; game.minimapOverlay = null;
    initWalls(); initTowers();
    activeGameMode.init();

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const cw = Math.max(window.innerWidth, window.innerHeight);
        const ch = Math.min(window.innerWidth, window.innerHeight);
        camera.scale = Math.min(cw / 1200, ch / 600);
    }

    const spawnPoints = activeGameMode.mapConfig.spawnPoints;
    let isSpectator = true;
    if (socket) {
        const myData = playersData[socket.id];
        if (myData && myData.team !== -1) {
            isSpectator = false;
        }
    }
    game.isSpectator = isSpectator;

    Object.values(playersData).forEach(pData => {
        if (pData.team === -1) return; // Skip spectators
        let p = new Player(spawnPoints[pData.team].x, spawnPoints[pData.team].y, { team: pData.team, id: pData.id, className: pData.className, summonerSpell: pData.summonerSpell });
        game.players.push(p);
        if (socket && pData.id === socket.id) { player = p; gc.localPlayer = p; }
    });

    if (isSpectator) {
        player = null; gc.localPlayer = null;
        camera.x = activeGameMode.mapConfig.world.width / 2;
        camera.y = activeGameMode.mapConfig.world.height / 2;
    }

    // Boti jsou spawněni ze server bot_roster eventu — klient neví jejich třídy dopředu
    // bot_roster přijde těsně po game_start, doplní je do game.players

    game.started = true; updateSpellLabels();
    const mc = document.getElementById('mobileControls'); if (mc) mc.style.display = 'block';
    game.heals = activeGameMode.mapConfig.healPickupPositions.map(p => new HealPickup(p.x, p.y));
    const _pp2 = activeGameMode.mapConfig.powerupPosition;
    game.powerup = _pp2 ? new PowerUp(_pp2.x, _pp2.y) : null;
    game.speedPads = (activeGameMode.mapConfig.speedPadPositions || []).map(p => new SpeedPad(p.x, p.y));
  }

  export function initWalls() {
    const mc = activeGameMode.mapConfig;
    game.walls = [];
    game.wallGrid = new Map();
    game.wallGridSize = 200;
    const processPoly = (pts) => {
      let cx=0, cy=0; pts.forEach(p=>{cx+=p.x; cy+=p.y;}); cx/=pts.length; cy/=pts.length;
      let scale = 0.95;
      if (dist({x:cx, y:cy}, mc.spawnPoints[0]) < 600 || dist({x:cx, y:cy}, mc.spawnPoints[1]) < 600) {
        scale = 0.85;
      }
      let scaledPts = pts.map(p => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale }));
      let sorted = scaledPts.slice().sort((a,b)=>Math.atan2(a.y-cy, a.x-cx) - Math.atan2(b.y-cy, b.x-cx));
      let minE = Infinity;
      for(let i=0; i<sorted.length; i++) minE = Math.min(minE, dist(sorted[i], sorted[(i+1)%sorted.length]));
      let r = minE * 0.18;
      let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
      sorted.forEach(p=>{ minX=Math.min(minX, p.x); maxX=Math.max(maxX, p.x); minY=Math.min(minY, p.y); maxY=Math.max(maxY, p.y); });
      
      let wallObj = { pts: sorted, r, bbox: {minX, maxX, minY, maxY} };
      game.walls.push(wallObj);
      
      let startX = Math.floor((minX - r - 50) / game.wallGridSize);
      let endX = Math.floor((maxX + r + 50) / game.wallGridSize);
      let startY = Math.floor((minY - r - 50) / game.wallGridSize);
      let endY = Math.floor((maxY + r + 50) / game.wallGridSize);
      for(let x=startX; x<=endX; x++) {
          for(let y=startY; y<=endY; y++) {
              let key = x * 10000 + y;
              if(!game.wallGrid.has(key)) game.wallGrid.set(key, []);
              game.wallGrid.get(key).push(wallObj);
          }
      }
    };
    mc.rawPolys.forEach(pts => {
      let smoothed = smoothPolygon(pts, 3);
      processPoly(smoothed);
      let mirrored = smoothed.map(p => ({ x: mc.world.width - p.x, y: p.y }));
      processPoly(mirrored);
    });
    const makeHex = (cx, cy, r) => {
      let pts = []; for(let i=0; i<6; i++) pts.push({x: Math.round(cx + r*Math.cos(i*Math.PI/3)), y: Math.round(cy + r*Math.sin(i*Math.PI/3))}); return pts;
    };
    mc.nexusHexWalls.forEach(h => processPoly(makeHex(h.x, h.y, h.r)));
  }
  initWalls();

  export function initTowers() {
    game.towers = activeGameMode.mapConfig.towerPositions.map((tp, i) => new Tower(tp.x, tp.y, i));
  }
  initTowers();

  // Inicializace game modu (nastaví nexus HP nebo jiné per-mode state)
  activeGameMode.init();

  let spawnTimer = 0; const spawnInterval = 16.0; const nexusDrainRate = 0.75; // Sníženo odečítání skóre (cca 30%)

  export function recalcPlayerItemStats(pl) {
    const cData = CLASSES[pl.className];
    if (!cData) return;
    const hpFrac = pl.maxHp > 0 ? Math.max(0, Math.min(1, pl.hp / pl.maxHp)) : 1;

    // Reset to level-grown base stats (fall back to class data for level-1 players)
    pl.AD = pl.baseAD_stat !== undefined ? pl.baseAD_stat : cData.baseAD;
    pl.AP = pl.baseAP_stat !== undefined ? pl.baseAP_stat : cData.baseAP;
    pl.attackSpeed = 1.0;
    pl.abilityHaste = 0;
    pl.armor = pl.baseArmor_stat !== undefined ? pl.baseArmor_stat : cData.baseArmor;
    pl.mr = pl.baseMR_stat !== undefined ? pl.baseMR_stat : cData.baseMR;
    pl.maxHp = pl.baseMaxHp !== undefined ? pl.baseMaxHp : cData.hp;
    pl.hpRegen = cData.hpRegen || 2.0;
    pl.lifesteal = 0;
    pl.antiHeal = 0;
    pl.onHitSlow = 0;
    pl.onSpellHitSlow = 0;
    pl.adaptivePen = 0;
    pl.armorPenFlat = 0;
    pl.magicPenFlat = 0;
    pl.titanSigilSpellDmg = 0;
    pl.titanSigilCd = pl.titanSigilCd || 0;
    pl.aoeBurnPct = 0;
    pl.strikeBurnPct = 0;
    pl.healPower = 0;
    pl.shieldOnHit = 0;
    pl.speed = cData.speed + 40 + (cData.range && cData.role !== 'SUPPORT' ? 5 : 0);

    // Re-apply all items
    for (const itemId of (pl.items || [])) {
      const it = getShopItem(itemId);
      if (it && it.apply) it.apply(pl);
    }

    // Apply difficulty bonuses (bots only) — these survive item resets
    if (pl.diffBonusHP || pl.diffBonusAD || pl.diffBonusAP || pl.diffBonusArmor || pl.diffBonusMR) {
        pl.maxHp  += (pl.diffBonusHP    || 0);
        pl.AD     += (pl.diffBonusAD    || 0);
        pl.AP     += (pl.diffBonusAP    || 0);
        pl.armor  += (pl.diffBonusArmor || 0);
        pl.mr     += (pl.diffBonusMR    || 0);
    }

    // Restore HP proportionally (don't let current HP exceed new max)
    pl.hp = Math.min(pl.maxHp, Math.max(1, Math.round(hpFrac * pl.maxHp)));
  }

  export function buyItem(id) {
    if (!player) return;
    const it = getShopItem(id);
    if (!it) return;
    const allyBaseDist = dist(player.pos, activeGameMode.mapConfig.spawnPoints[player.team]);
    if (allyBaseDist > 250 && player.alive) return flashMessage('Shop available only in your base!');
    const buyCheck = canBuyShopItem(player, it);
    if (!buyCheck.ok) return flashMessage(buyCheck.reason);
    const cost = getItemBuyCost(player, it);
    if (player.gold < cost) return flashMessage('Not enough gold');

    if (socket && !game.isHost) {
      // Server-authoritative: pošli akci a počkej na _broadcastSlow potvrzení
      socket.emit('player_action', { type: 'buy_item', id: player.id, itemId: it.id, cost });
      // Optimistická lokální aktualizace pro okamžitou odezvu UI
      player.gold -= cost;
      player.items.push(it.id);
      recalcPlayerItemStats(player);
      player.isDirty = true;
    } else {
      // Offline nebo host mód
      player.gold -= cost;
      player.items.push(it.id);
      recalcPlayerItemStats(player);
      player.isDirty = true;
    }
    flashMessage('Bought ' + it.name);
    updateInventory();
    populateShop();
  }
  export function sellItem(id) {
    if (!player) return;
    const it = getShopItem(id);
    if (!it) return;
    const allyBaseDist = dist(player.pos, activeGameMode.mapConfig.spawnPoints[player.team]);
    if (allyBaseDist > 250 && player.alive) return flashMessage('Shop available only in your base!');
    const idx = player.items.indexOf(id);
    if (idx === -1) return flashMessage('Item not in inventory');
    const sellPrice = getItemSellPrice(player, it);

    if (socket && !game.isHost) {
      // Server-authoritative: pošli akci a optimisticky aktualizuj lokálně
      socket.emit('player_action', { type: 'sell_item', id: player.id, itemId: id, refund: sellPrice });
      player.items.splice(idx, 1);
      player.gold += sellPrice;
      recalcPlayerItemStats(player);
      player.isDirty = true;
    } else {
      player.items.splice(idx, 1);
      player.gold += sellPrice;
      recalcPlayerItemStats(player);
      player.isDirty = true;
    }
    flashMessage(`Sold ${it.name} for ${sellPrice}g`);
    updateInventory();
    populateShop();
  }
  export function flashMessage(txt){ const el = document.createElement('div'); el.style.position='fixed'; el.style.left='50%'; el.style.top='18px'; el.style.transform='translateX(-50%)'; el.style.background='rgba(255,255,255,0.06)'; el.style.padding='6px 10px'; el.style.borderRadius='6px'; el.style.zIndex=100000; el.textContent = txt; document.body.appendChild(el); setTimeout(()=>el.remove(),1200); }

  function update(dt){ if(game.gameOver || !game.started) return;
    if(game.startDelay > 0) game.startDelay -= dt;

    // update mouse world
    const mw = screenToWorld(mouse.sx, mouse.sy); mouse.wx = mw.x; mouse.wy = mw.y;

    for(let p of game.players) {
        let ox = p.pos.x, oy = p.pos.y;
        p.update(dt);
        if (dt > 0) p.vel = { x: (p.pos.x - ox) / dt, y: (p.pos.y - oy) / dt };

        // CLIENT-SIDE PREDICTION: smooth korekce pozice lokálního hráče na serverovou pozici
        if (socket && !game.isHost && p === player && p._serverPosTarget && p.alive && p.stunTimer <= 0 && p.knockbackTimer <= 0) {
            const lerpRate = 1.0 - Math.pow(0.05, dt); // ~95% korekce za 1s, plynulé i při různém dt
            p.pos.x += (p._serverPosTarget.x - p.pos.x) * lerpRate;
            p.pos.y += (p._serverPosTarget.y - p.pos.y) * lerpRate;
            const rem = (p._serverPosTarget.x - p.pos.x) ** 2 + (p._serverPosTarget.y - p.pos.y) ** 2;
            if (rem < 4) p._serverPosTarget = null; // Dostatečně blízko — korekce hotova
        }

        if (p.burnDotTimer > 0 && p.alive && (!socket || game.isHost)) {
            p.burnDotTimer -= dt;
            p.burnDotTick = (p.burnDotTick || 0) - dt;
            if (p.burnDotTick <= 0) {
                p.burnDotTick = 0.5;
                applyDamage(p, p.burnDotTickDmg, 'dot', p.burnDotSource, false, false, false);
                spawnParticles(p.pos.x, p.pos.y, 2, '#ff6600', { life: 0.3, size: 6, speed: 40 });
            }
        }
    }
    for(let p of game.projectiles) p.update(dt);
    for(let m of game.minions) {
        let ox = m.pos.x, oy = m.pos.y;
        m.update(dt);
        if (dt > 0) m.vel = { x: (m.pos.x - ox) / dt, y: (m.pos.y - oy) / dt };
        
        if (m.burnDotTimer > 0 && !m.dead && (!socket || game.isHost)) {
            m.burnDotTimer -= dt;
            m.burnDotTick = (m.burnDotTick || 0) - dt;
            if (m.burnDotTick <= 0) {
                m.burnDotTick = 0.5;
                applyDamage(m, m.burnDotTickDmg, 'dot', m.burnDotSource, false, false, false);
                spawnParticles(m.pos.x, m.pos.y, 2, '#ff6600', { life: 0.3, size: 6, speed: 40 });
            }
        }
    }
    for(let d of game.damageNumbers) d.update(dt);
    for(let t of game.towers) t.update(dt);
    for(let et of game.effectTexts) et.update(dt);
    for(let pt of game.particles) pt.update(dt);
    
    for(let h of game.heals) h.update(dt);
    if(game.powerup) game.powerup.update(dt);
    for(let sp of game.speedPads) sp.update(dt);

    // Player/Bot collision resolution (anti-stacking)
    for(let i=0; i<game.players.length; i++){
      for(let j=i+1; j<game.players.length; j++){
        let p1 = game.players[i], p2 = game.players[j];
        if(!p1.alive || !p2.alive) continue;
        let dx = p2.pos.x - p1.pos.x, dy = p2.pos.y - p1.pos.y, d = Math.hypot(dx,dy);
        let minDist = p1.radius + p2.radius;
        if(d < minDist) {
          if (d === 0) { dx = Math.random()-0.5; dy = Math.random()-0.5; d = Math.hypot(dx, dy); } // Fix pokud se zjeví přesně v sobě
          let push = (minDist - d) / 2; let px = (dx/d)*push, py = (dy/d)*push;
          p1.pos.x -= px; p1.pos.y -= py; p2.pos.x += px; p2.pos.y += py;
        }
      }
    }

    // Minion collision resolution (anti-stacking) — pouze na Hostu, Klient interpoluje
    if (!socket || game.isHost) {
      const CELL_SIZE = 50;
      const grid = new Map();
      for(let i=0; i<game.minions.length; i++){
        let m = game.minions[i];
        if(m.dead) continue;
        let key = `${Math.floor(m.pos.x / CELL_SIZE)},${Math.floor(m.pos.y / CELL_SIZE)}`;
        if(!grid.has(key)) grid.set(key, []);
        grid.get(key).push(m);
      }
      for(let i=0; i<game.minions.length; i++){
        let m1 = game.minions[i];
        if(m1.dead) continue;
        let cx = Math.floor(m1.pos.x / CELL_SIZE);
        let cy = Math.floor(m1.pos.y / CELL_SIZE);
        for(let nx = cx - 1; nx <= cx + 1; nx++) {
          for(let ny = cy - 1; ny <= cy + 1; ny++) {
            let cell = grid.get(`${nx},${ny}`);
            if(cell) {
              for(let m2 of cell) {
                if(m1.id >= m2.id || m2.dead) continue; // Pár řešíme jen jednou
                let dx = m2.pos.x - m1.pos.x, dy = m2.pos.y - m1.pos.y, d = Math.hypot(dx,dy);
                let minDist = m1.radius + m2.radius;
                if(d < minDist) {
                  if (d === 0) { dx = Math.random()-0.5; dy = Math.random()-0.5; d = Math.hypot(dx, dy); }
                  let push = (minDist - d) / 2; let px = (dx/d)*push, py = (dy/d)*push;
                  m1.pos.x -= px; m1.pos.y -= py; m2.pos.x += px; m2.pos.y += py;
                }
              }
            }
          }
      }
    }
    }

    if (game.shake > 0) game.shake -= dt;
    if (game.screenDamageFlash > 0) game.screenDamageFlash -= dt * 0.8;
    if (game.screenHealFlash > 0) game.screenHealFlash -= dt * 0.8;
    game.passiveTimer = (game.passiveTimer || 0) + dt;
    if (game.startDelay <= 0 && game.passiveTimer >= 1.0) { 
        game.passiveTimer -= 1.0; 
        let passiveMult = 1.0;
        if (activeGameMode && activeGameMode.name === 'arena') passiveMult = 1.75;
        if (activeGameMode && activeGameMode.name === 'speed') passiveMult = 3.0;
        if (!socket || game.isHost) { for(let p of game.players) { p.gold += 2 * passiveMult; p.totalGold += 2 * passiveMult; p.exp += 1 * passiveMult; p.totalExp = (p.totalExp||0) + 1 * passiveMult; } } 
    }

    game.cleanupTimer = (game.cleanupTimer || 0) + dt;
    if (game.cleanupTimer >= 5.0) {
      game.cleanupTimer = 0;
      if (game.burstHits) { const now = performance.now(); game.burstHits.forEach((v, k) => { if (now - (v.time || 0) > 10000) game.burstHits.delete(k); }); }
      if (game.deadMinionIds && game.deadMinionIds.size > 200) game.deadMinionIds.clear();
    }

    if (game.killFeed) {
        game.killFeed.forEach(k => k.timer -= dt);
        game.killFeed = game.killFeed.filter(k => k.timer > 0);
    }

    game.projectiles = game.projectiles.filter(p=>!p.dead);
    game.minions = game.minions.filter(m=>!m.dead);
    game.damageNumbers = game.damageNumbers.filter(d=>d.life>0);
    if (game.particles.length > 800) game.particles = game.particles.filter(p=>p.life>0);
    else game.particles = game.particles.filter(p=>p.life>0);
    game.effectTexts = game.effectTexts.filter(et=>et.life>0);
    // Udržuj O(1) lookup mapy aktuální po cleanup
    game.playersById = new Map(game.players.map(p => [p.id, p]));
    game.minionsById = new Map(game.minions.map(m => [m.id, m]));

    // spawning + nexus drain + win condition — delegováno na aktivní game mode
    if (!socket || game.isHost) {
      if (game.startDelay <= 0) {
        spawnTimer = activeGameMode.tickSpawn(dt, spawnTimer, spawnInterval);
      }
      activeGameMode.tickObjective(dt, nexusDrainRate, socket);
    }

    // update camera to follow player or spectate
    if (game.isSpectator) {
        const camSpeed = 1500 * dt;
        if (keys['w']) camera.y -= camSpeed;
        if (keys['s']) camera.y += camSpeed;
        if (keys['a']) camera.x -= camSpeed;
        if (keys['d']) camera.x += camSpeed;
        const viewW = canvas.clientWidth / camera.scale; 
        const viewH = canvas.clientHeight / camera.scale;
        camera.x = clamp(camera.x, 0, Math.max(0, activeGameMode.mapConfig.world.width - viewW));
        camera.y = clamp(camera.y, 0, Math.max(0, activeGameMode.mapConfig.world.height - viewH));
    } else if (player) {
        const viewW = canvas.clientWidth / camera.scale; 
        const viewH = canvas.clientHeight / camera.scale;
        camera.x = clamp(player.pos.x - viewW/2, 0, Math.max(0, activeGameMode.mapConfig.world.width - viewW));
        camera.y = clamp(player.pos.y - viewH/2, 0, Math.max(0, activeGameMode.mapConfig.world.height - viewH));
    }

    // SÍŤOVÁ SYNCHRONIZACE POZICE — přeskočit během simulace
    if (socket && !game.gameOver && !simMode) {
        if (player) {
            game.syncTimer = (game.syncTimer || 0) + dt;
            if (game.syncTimer >= 0.067) {
                game.syncTimer = 0;
                const minimalState = {
                    id: player.id, x: player.pos.x, y: player.pos.y, aimAngle: player.aimAngle,
                    slowT: player.slowTimer, boostT: player.boostTimer, stunT: player.stunTimer,
                    silenceT: player.silenceTimer, shield: player.shield, hanaT: player.hanaBuffTimer,
                    beamT: player.beamTimer, beamId: player.beamTargetId, uberT: player.uberChargeTimer,
                    invT: player.invulnerableTimer, defT: player.defBuffTimer,
                    kbT: player.knockbackTimer, kbVx: player.knockbackVel ? player.knockbackVel.x : 0, kbVy: player.knockbackVel ? player.knockbackVel.y : 0,
                    msBuffT: player.msBuffTimer, msBuffAmt: player.msBuffAmount,
                    junglePwrT: player.junglePowerTimer, jungleAsAhT: player.jungleAsAhTimer, jungleTankT: player.jungleTankTimer,
                    adAsBuffT: player.adAsBuffTimer, adAsBuffAmt: player.adAsBuffAmount,
                    antiHealT: player.antiHealTimer, antiHealStr: player.antiHealStrength,
                    regenBuffT: player.regenBuffTimer, regenBuffAmt: player.regenBuffAmount,
                    hasPwrup: player.hasPowerup, pwrupT: player.powerupTimer,
                    beamUberT: player.beamUberTimer
                };
                if (player.isDirty) {
                    player.isDirty = false;
                    socket.emit('player_update', { ...minimalState, isFullUpdate: true,
                        level: player.level, maxHp: player.effectiveMaxHp, items: player.items.length,
                        AD: player.AD, AP: player.AP, armor: player.armor, mr: player.mr, speed: player.speed, attackSpeed: player.attackSpeed, abilityHaste: player.abilityHaste,
                        invTimer: player.invulnerableTimer, defTimer: player.defBuffTimer,
                        qLvl: player.spells.Q.level, eLvl: player.spells.E.level, sumSpell: player.summonerSpell
                    });
                } else {
                    socket.emit('player_update', minimalState);
                }
            }
        }
    }
  }

  const TARGET_FRAME_MS = 1000 / 50; // 50 FPS = 20ms
  let last = performance.now();
  function loop(){
    try {
      const now = performance.now();
      if (now - last < TARGET_FRAME_MS) { requestAnimationFrame(loop); return; }
      const dtRaw = Math.min(0.05, (now-last)/1000); last = now;
      const steps = game.isSpectator ? 1 : 1;
      for(let i=0; i<steps; i++) { update(dtRaw); }
      if (!simMode) draw();
      requestAnimationFrame(loop);
    } catch(err) {
      console.error('[FATAL ERROR] Game loop crashed!', err);
      try { console.table({ players: game.players.length, minions: game.minions.length, projectiles: game.projectiles.length, particles: game.particles.length, isHost: game.isHost }); } catch(_) {}
      console.error('[FATAL STACK]', err.stack);
      alert('Game crashed! Press F12 and send the log (Console tab).\n\nError: ' + err.message);
      return; // nezaplanovat další frame — hra se zastavila
    }
  }
  requestAnimationFrame(loop);

  buildMenu();
  populateShop();
  updateInventory();

  // Zaregistruj client-side implementace do GameContext — od teď je mohou Player.js/Entities.js/GameMode používat
  registerGameContext({
    socket, localPlayer: player, keys, mouse, activeGameMode,
    applyDamage, applyHeal, handlePlayerKill, moveEntityWithCollision,
    drawHealthBar, flashMessage, grantRewards, grantMinionKillRewards,
    recalcPlayerItemStats, buyItem,
    Particle, EffectText, DamageNumber, spawnParticles,
    updateSpellLabels, playSound, showEnd,
  });
