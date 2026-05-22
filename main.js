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
    socket.on('network_player_update', (data) => {
      let netPlayer = game.playersById ? game.playersById.get(data.id) : game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) { 
        // Velocity extrapolace — spočítáme rychlost z rozdílu pozic, žádná extra data po síti
        if (netPlayer.targetPos) {
          const dx = data.x - netPlayer.targetPos.x;
          const dy = data.y - netPlayer.targetPos.y;
          const dt2 = netPlayer._lastPosTime ? Math.min(0.2, (performance.now() - netPlayer._lastPosTime) / 1000) : 0.05;
          netPlayer.netVel = { x: dx / (dt2 || 0.05), y: dy / (dt2 || 0.05) };
        }
        netPlayer._lastPosTime = performance.now();
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
      if (game && game.isHost) return; // Host ignoruje tyto zprávy, má svou vlastní pravdu
      (data.bots || []).forEach(bData => {
        let bot = game.playersById ? game.playersById.get(bData.id) : game.players.find(p => p.id === bData.id);
        if (bot) {
          // PŘIDÁNO: Synchronizace třídy bota, pokud se při startovní randomizaci u Klienta a Hosta lišila
          if (bot.className !== bData.className && bData.className) {
              bot.className = bData.className;
              const cData = CLASSES[bot.className];
              bot.glyph = cData.glyph; bot.dmgType = cData.dmgType; bot.range = cData.range;
              bot.spells = {
                  Q: { ...cData.Q, cd: bot.spells.Q.cd, level: bData.qLvl || 1 },
                  E: { ...cData.E, cd: bot.spells.E.cd, level: bData.eLvl || 1 }
              };
          }
          if (bot.targetPos) {
            const dx = bData.x - bot.targetPos.x;
            const dy = bData.y - bot.targetPos.y;
            const dt2 = bot._lastPosTime ? Math.min(0.2, (performance.now() - bot._lastPosTime) / 1000) : 0.05;
            bot.netVel = { x: dx / (dt2 || 0.05), y: dy / (dt2 || 0.05) };
          }
          bot._lastPosTime = performance.now();
          bot.targetPos = { x: bData.x, y: bData.y }; bot.hp = bData.hp; bot.alive = bData.alive; bot.aimAngle = bData.aimAngle;
          if (bData.slowT !== undefined) bot.slowTimer = bData.slowT;
          if (bData.boostT !== undefined) bot.boostTimer = bData.boostT;
          if (bData.silenceT !== undefined) bot.silenceTimer = bData.silenceT;
          bot.stunTimer = bData.stunT || 0;
          bot.shield = bData.shield || 0;
          if (bData.hanaT !== undefined) bot.hanaBuffTimer = bData.hanaT;
          if (bData.beamT !== undefined) bot.beamTimer = bData.beamT;
          if (bData.beamId !== undefined) bot.beamTargetId = bData.beamId;
          if (bData.uberT !== undefined) bot.uberChargeTimer = bData.uberT;
          if (bData.invT !== undefined) bot.invulnerableTimer = bData.invT;
          if (bData.defT !== undefined) bot.defBuffTimer = bData.defT;
          if (bData.msBuffT !== undefined) { bot.msBuffTimer = bData.msBuffT; bot.msBuffAmount = bData.msBuffAmt || 0; }
          if (bData.junglePwrT !== undefined) bot.junglePowerTimer = bData.junglePwrT;
          if (bData.jungleAsAhT !== undefined) bot.jungleAsAhTimer = bData.jungleAsAhT;
          if (bData.jungleTankT !== undefined) bot.jungleTankTimer = bData.jungleTankT;
          if (bData.adAsBuffT !== undefined) { bot.adAsBuffTimer = bData.adAsBuffT; bot.adAsBuffAmount = bData.adAsBuffAmt || 0; }
          if (bData.antiHealT !== undefined) { bot.antiHealTimer = bData.antiHealT; bot.antiHealStrength = bData.antiHealStr || 0; }
          if (bData.regenBuffT !== undefined) { bot.regenBuffTimer = bData.regenBuffT; bot.regenBuffAmount = bData.regenBuffAmt || 0; }
          if (bData.hasPwrup !== undefined) { bot.hasPowerup = bData.hasPwrup; bot.powerupTimer = bData.pwrupT || 0; }
          if (bData.beamUberT !== undefined) bot.beamUberTimer = bData.beamUberT;

          if (bData.isFullUpdate) {
            if (bData.level && bData.level > bot.level) { bot.levelUpTimer = 2.0; spawnParticles(bot.pos.x, bot.pos.y, 25, '#ffcc00', {speed: 120, life: 1.0}); }
            bot.level = bData.level || bot.level; bot.maxHp = bData.maxHp || bot.maxHp;
            bot.kills = bData.kills || 0; bot.deaths = bData.deaths || 0; bot.assists = bData.assists || 0; bot.totalGold = bData.gold || 0;
            bot.items.length = bData.items !== undefined ? bData.items : bot.items.length;
            if (bData.stats) { bot.stats.dmgDealt = bData.stats.dmgDealt; bot.stats.dmgTaken = bData.stats.dmgTaken; bot.stats.hpHealed = bData.stats.hpHealed; }
            bot.AD = bData.AD || bot.AD; bot.AP = bData.AP || bot.AP; bot.armor = bData.armor || bot.armor;
            bot.mr = bData.mr || bot.mr; bot.speed = bData.speed || bot.speed; bot.attackSpeed = bData.attackSpeed || bot.attackSpeed; bot.abilityHaste = bData.abilityHaste || bot.abilityHaste;
            bot.invulnerableTimer = bData.invTimer || 0; bot.defBuffTimer = bData.defTimer || 0;
            bot.towerCaptures = bData.towerCaptures || 0; bot.towerDefends = bData.towerDefends || 0; bot.towerAssaultTime = bData.towerAssaultTime || 0;
            bot.objectivePresenceTime = bData.objectivePresenceTime || 0; bot.powerupsCollected = bData.powerupsCollected || 0; bot.powerupUptime = bData.powerupUptime || 0; bot.pcs = bData.pcs || 0; bot.pcsBreakdown = bData.pcsBreakdown || bot.pcsBreakdown;
            if (bot.spells) {
                if (bData.qLvl) bot.spells.Q.level = bData.qLvl;
                if (bData.eLvl) bot.spells.E.level = bData.eLvl;
            }
            bot.summonerSpell = bData.sumSpell || bot.summonerSpell;
          }
        }
      });
      
      // OPRAVA: Odstranění mrtvých minionů ("duchů"), které už Host nesleduje
      // Pouze pokud paket obsahuje miniony (rychlý tick) — pomalý tick posílá prázdné pole
      if (!game.deadMinionIds) game.deadMinionIds = new Set();
      if (data.minions && data.minions.length > 0) {
        const hostMinionIds = new Set(data.minions.map(m => m.id));
        game.minions.forEach(m => { if (!hostMinionIds.has(m.id)) m.dead = true; });
      }

      (data.minions || []).forEach(mData => {
        let minion = game.minionsById ? game.minionsById.get(mData.id) : game.minions.find(m => m.id === mData.id);
        if (!minion && !mData.dead && !game.deadMinionIds.has(mData.id)) { // Pokud u klienta chybí a nebyl lokálně zabit, vytvoříme ho
           minion = new Minion(mData.x, mData.y, mData.team ?? 0, mData.targetIndex ?? 0);
           minion.id = mData.id;
           minion.isSummon = mData.isSummon ?? false;
           minion.glyph = mData.glyph || 'm';
           minion.maxHp = mData.maxHp || 250;
           minion.targetPos = { x: mData.x, y: mData.y };
           minion.targetHeroId = mData.tHeroId;
           minion.isSmallChicken = mData.isSc ?? false;
           minion.isBigChicken = mData.isBc ?? false;
           game.minions.push(minion);
        }
        if (minion) {
          if (minion.targetPos) {
            const dx = mData.x - minion.targetPos.x; const dy = mData.y - minion.targetPos.y;
            const dt2 = minion._lastPosTime ? Math.min(0.2, (performance.now() - minion._lastPosTime) / 1000) : 0.05;
            minion.netVel = { x: dx / (dt2 || 0.05), y: dy / (dt2 || 0.05) };
          }
          minion._lastPosTime = performance.now();
          minion.targetPos = { x: mData.x, y: mData.y }; minion.hp = mData.hp; minion.dead = mData.dead;
          if (mData.maxHp !== undefined) minion.maxHp = mData.maxHp;
          if (mData.glyph !== undefined) minion.glyph = mData.glyph;
          if (mData.tHeroId !== undefined) minion.targetHeroId = mData.tHeroId;
          if (mData.isSc !== undefined) minion.isSmallChicken = mData.isSc;
          if (mData.isBc !== undefined) minion.isBigChicken = mData.isBc;
          if (mData.team !== undefined) minion.team = mData.team;
          if (mData.targetIndex !== undefined) minion.targetIndex = mData.targetIndex;
        }
      });
      (data.towers || []).forEach(tData => {
        let tower = game.towers.find(t => t.index === tData.i);
        if (tower) { 
            if (tower.owner !== tData.o && tData.o !== -1) game.shake = 0.3; // Zemětřesení pro klienty při zabrání
            tower.control = tData.c; tower.owner = tData.o; 
            if (tData.l !== undefined) tower.isLocked = tData.l;
            if (tData.u !== undefined) tower.unlockTimer = tData.u;
        }
      });
      // Sdílení lékárniček, powerupů a životů základen z Hosta na Klienty
      if (data.heals) data.heals.forEach((act, i) => { if(game.heals[i]) game.heals[i].active = act; });
      if (data.powerup && game.powerup) { game.powerup.active = data.powerup.a; game.powerup.captureTimer = data.powerup.c; }
      if (data.nexus) {
        game.nexus[0] = data.nexus[0]; game.nexus[1] = data.nexus[1];
        if (activeGameMode.name === 'arena') { if (!game.score) game.score = {}; game.score[0] = data.nexus[0]; game.score[1] = data.nexus[1]; }
      }
          // PvP packet: HP/shield/buffs (20 Hz) — samostatný od score/humans
          if (data.humans) {
              data.humans.forEach(hData => {
                  let p = game.playersById ? game.playersById.get(hData.id) : game.players.find(x => x.id === hData.id);
                  if (!p) return;
                  // HP a alive vždy aktualizujeme
                  if (hData.hp !== undefined) p.hp = hData.hp;
                  if (hData.alive !== undefined) {
                      if (!p.alive && hData.alive) p.revive();
                      else if (p.alive && !hData.alive) { p.hp = 0; p.die(); }
                  }
                  if (hData.shield !== undefined) p.shield = hData.shield;
                  if (hData.stunT !== undefined) p.stunTimer = hData.stunT;
                  if (hData.slowT !== undefined) p.slowTimer = hData.slowT;
                  if (hData.invT !== undefined) p.invulnerableTimer = hData.invT;
                  if (hData.defT !== undefined) p.defBuffTimer = hData.defT;
                  if (hData.msBuffT !== undefined) { p.msBuffTimer = hData.msBuffT; p.msBuffAmount = hData.msBuffAmt || 0; }
                  if (hData.hasPwrup !== undefined) { p.hasPowerup = !!hData.hasPwrup; p.powerupTimer = hData.pwrupT || 0; }
                  if (hData.beamT !== undefined) { p.beamTimer = hData.beamT; p.beamTargetId = hData.beamId; }
                  if (hData.uberT !== undefined) p.uberChargeTimer = hData.uberT;
                  if (hData.beamUberT !== undefined) p.beamUberTimer = hData.beamUberT;
                  if (hData.kbT !== undefined && hData.kbT > 0) { p.knockbackTimer = hData.kbT; p.knockbackVel = { x: hData.kbVx || 0, y: hData.kbVy || 0 }; }
              });
          }

          // Score packet: gold, kills, level (2 Hz)
          if (data.score) {
              data.score.forEach(hData => {
                  let p = game.playersById ? game.playersById.get(hData.id) : game.players.find(x => x.id === hData.id);
                  if (!p) return;
                  if (p === player) {
                      // Lokální hráč: jen přírůstky goldů/expů (aby neblblo UI při nákupech)
                      if (hData.gold !== undefined) { const diff = hData.gold - (p.totalGold || 0); if (diff > 0) { p.gold += diff; p.totalGold = hData.gold; } }
                      if (hData.totalExp !== undefined) { const diff = hData.totalExp - (p.totalExp || 0); if (diff > 0) { p.exp += diff; p.totalExp = hData.totalExp; } }
                  } else {
                      if (hData.gold !== undefined) { p.gold = hData.currentGold ?? p.gold; p.totalGold = hData.gold; }
                      if (hData.totalExp !== undefined) { p.totalExp = hData.totalExp; }
                      if (hData.exp !== undefined) p.exp = hData.exp;
                  }
                  if (hData.kills !== undefined) p.kills = hData.kills;
                  if (hData.deaths !== undefined) p.deaths = hData.deaths;
                  if (hData.assists !== undefined) p.assists = hData.assists;
                  if (hData.alive !== undefined) {
                      if (!p.alive && hData.alive) p.revive();
                      else if (p.alive && !hData.alive) { p.hp = 0; p.die(); }
                  }
                  if (hData.macro !== undefined) p.macroOrder = hData.macro ? { type: hData.macro } : null;
                  if (hData.towerCaptures !== undefined) p.towerCaptures = hData.towerCaptures;
                  if (hData.pcs !== undefined) p.pcs = hData.pcs;
                  if (hData.silenceT !== undefined) p.silenceTimer = hData.silenceT;
                  if (hData.hanaT !== undefined) p.hanaBuffTimer = hData.hanaT;
                  if (hData.boostT !== undefined) p.boostTimer = hData.boostT;
                  if (hData.junglePwrT !== undefined) p.junglePowerTimer = hData.junglePwrT;
                  if (hData.jungleAsAhT !== undefined) p.jungleAsAhTimer = hData.jungleAsAhT;
                  if (hData.jungleTankT !== undefined) p.jungleTankTimer = hData.jungleTankT;
                  if (hData.adAsBuffT !== undefined) { p.adAsBuffTimer = hData.adAsBuffT; p.adAsBuffAmount = hData.adAsBuffAmt || 0; }
                  if (hData.antiHealT !== undefined) { p.antiHealTimer = hData.antiHealT; p.antiHealStrength = hData.antiHealStr || 0; }
                  if (hData.regenBuffT !== undefined) { p.regenBuffTimer = hData.regenBuffT; p.regenBuffAmount = hData.regenBuffAmt || 0; }
              });
          }
    });
    
    // PŘIDÁNO: Přijímání jednorázových událostí od Hosta (Věže střílí, poškození prostředím, Konec hry)
    socket.on('network_host_event', (data) => {
      if (game && game.isHost) return; 
      if (data.type === 'damage') {
        let t = game.players.find(p => p.id === data.targetId);
        if (t) applyDamage(t, data.amount, data.dmgType, data.sourceId, true); // true = isNetwork = ignore host check
      } else if (data.type === 'tower_shoot') {
        game.projectiles.push(new Projectile(data.x, data.y, data.vx, data.vy, 'tower', data.owner, {damage: data.damage, dmgType: 'physical', glyph: '♦', life: data.life}));
      } else if (data.type === 'heal_pickup') {
        let p = game.players.find(x => x.id === data.playerId);
        if (p) { p.hp = data.hp; spawnParticles(game.heals[data.healIndex].pos.x, game.heals[data.healIndex].pos.y, 25, '#0f0', {speed: 150}); if(p === player) { flashMessage("+33% HP!"); game.screenHealFlash = 0.5; } }
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
        let p = game.players.find(x => x.id === data.id); if (p && p.alive) { handlePlayerKill(p, data.killerId); }
      } else if (data.type === 'show_damage') {
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
    
    // PŘIDÁNO: Přijímání útoků a kouzel od ostatních hráčů (a botů)
    socket.on('network_player_action', (data) => {
      let netPlayer = game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) {
        if (data.type === 'shoot') netPlayer.shoot(data.tx, data.ty, true);
        else if (data.type === 'cast') netPlayer.castSpell(data.spKey, data.tx, data.ty, true);
        else if (data.type === 'summoner') netPlayer.castSummonerSpell(true);
        else if (data.type === 'buy_item') {
          let it = getShopItem(data.itemId);
          if (it && canBuyShopItem(netPlayer, it).ok) {
            const cost = data.cost !== undefined ? data.cost : getItemBuyCost(netPlayer, it);
            if (netPlayer.gold >= cost) {
              netPlayer.gold -= cost;
              netPlayer.items.push(data.itemId);
              recalcPlayerItemStats(netPlayer);
              netPlayer.isDirty = true;
            }
          }
        }
        else if (data.type === 'sell_item') {
          const idx = netPlayer.items.indexOf(data.itemId);
          if (idx !== -1) {
            netPlayer.items.splice(idx, 1);
            netPlayer.gold += data.refund;
            recalcPlayerItemStats(netPlayer);
            netPlayer.isDirty = true;
          }
        }
      }
    });

    socket.on('network_kill_feed', (data) => {
      data.timer = 5.0;
      if (game.killFeed) game.killFeed.push(data);
    });

    socket.on('player_disconnected', (id) => {
       if(game && game.players) game.players = game.players.filter(p => p.id !== id);
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

  export function applyHeal(target, amount, caster) {
    if(!target || target.dead || target.hp <= 0) return 0;
    // Heal Power multiplikátor (patří castujícímu, ne targetovi)
    if (caster && (caster.healPower || 0) > 0) amount *= (1 + caster.healPower);
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
            if (socket && !simMode) socket.emit('host_event', { type: 'show_heal', targetId: target.id, amount: actualHeal });
            if (socket && !simMode && target instanceof Player) {
                socket.emit('host_event', { type: 'player_hp_update', id: target.id, hp: target.hp, shield: target.shield });
            }
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
    
    // OPRAVA: Host posílá striktní zprávu o poškození minionů pouze proti lidským hráčům (Boti se posílají rovnou celí přes host_state prevence zdvojení).
    if (socket && game.isHost && !isNetwork && !simMode) {
      let isMinion = game.minions.some(m => m.id === sourceId);
      if (isMinion && target instanceof Player && !(target instanceof BotPlayer)) {
         socket.emit('host_event', { type: 'damage', targetId: target.id, amount: amount, dmgType: type, sourceId: sourceId });
      }
    }

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
        
        if (!socket || game.isHost || isNetwork) {
            let pCount = Math.min(30, Math.max(3, Math.floor(finalDamage / 10)));
            spawnParticles(target.pos.x, target.pos.y, pCount, '#f00', { speed: 100 + (finalDamage / 2) });
        }

        if (!socket || game.isHost) {
            let isLocal = (player && (sourceId === player.id || target.id === player.id));
            let color = '#ffffff';
            if (finalDamage < actualDamage) color = '#aaaaaa';
            else if (type === 'physical') color = isLocal ? '#ffdddd' : '#ff8888';
            else if (type === 'magical') color = isLocal ? '#ddddff' : '#88bbff';
            else color = isLocal ? '#ffffff' : '#ffc83c'; // includes 'true' and 'dot'
            
            game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, actualDamage, color));
            if (socket && !simMode) socket.emit('host_event', { type: 'show_damage', targetId: target.id, amount: actualDamage, sourceId: sourceId, dmgType: type });
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

    // OPRAVA: Host je autorita a posílá všem informaci o změně HP hráče
    if (socket && game.isHost && target instanceof Player && !isNetwork && !simMode) {
        socket.emit('host_event', { type: 'player_hp_update', id: target.id, hp: target.hp, shield: target.shield });
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

      // Oznámení všem klientům, že hráč zemřel (Pouze Host smí odeslat tento event)
      if (socket && game.isHost && !simMode) socket.emit('host_event', { type: 'player_died', id: victim.id, killerId: killerId });

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

    let bluePicked = []; let redPicked = [];
    const spellsArray = Object.keys(SUMMONER_SPELLS);
    
    let humansBlue = 0; let humansRed = 0;

    Object.values(playersData).forEach(pData => {
        if (pData.team === -1) return; // Skip spectators
        let p = new Player(spawnPoints[pData.team].x, spawnPoints[pData.team].y, { team: pData.team, id: pData.id, className: pData.className, summonerSpell: pData.summonerSpell });
        game.players.push(p);
        if (pData.team === 0) { humansBlue++; bluePicked.push(pData.className); }
        else { humansRed++; redPicked.push(pData.className); }
        if (socket && pData.id === socket.id) { player = p; }
    });

    if (isSpectator) {
        player = null;
        camera.x = activeGameMode.mapConfig.world.width / 2;
        camera.y = activeGameMode.mapConfig.world.height / 2;
    }

    const getBotLane = (idx) => activeGameMode.getBotLane(idx);

    const teamSize = activeGameMode.mapConfig.teamSize || 5;
    let blueBotCount = Math.max(0, teamSize - humansBlue);
    let redBotCount  = Math.max(0, teamSize - humansRed);
    let totalBots = Math.max(blueBotCount, redBotCount);

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

    player.gold -= cost;
    player.items.push(it.id);
    recalcPlayerItemStats(player);
    player.isDirty = true;
    flashMessage('Bought ' + it.name);
    updateInventory();
    populateShop();

    if (socket && !game.isHost) {
      socket.emit('player_action', { type: 'buy_item', id: player.id, itemId: it.id, cost });
    }
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
    player.items.splice(idx, 1);
    player.gold += sellPrice;
    recalcPlayerItemStats(player);
    player.isDirty = true;
    flashMessage(`Sold ${it.name} for ${sellPrice}g`);
    updateInventory();
    populateShop();
    if (socket && !game.isHost) {
      socket.emit('player_action', { type: 'sell_item', id: player.id, itemId: id, refund: sellPrice });
    }
  }
  export function flashMessage(txt){ const el = document.createElement('div'); el.style.position='fixed'; el.style.left='50%'; el.style.top='18px'; el.style.transform='translateX(-50%)'; el.style.background='rgba(255,255,255,0.06)'; el.style.padding='6px 10px'; el.style.borderRadius='6px'; el.style.zIndex=100000; el.textContent = txt; document.body.appendChild(el); setTimeout(()=>el.remove(),1200); }

  function update(dt){ if(game.gameOver || !game.started) return;
    if(game.startDelay > 0) game.startDelay -= dt;

    // update mouse world
    const mw = screenToWorld(mouse.sx, mouse.sy); mouse.wx = mw.x; mouse.wy = mw.y;

    for(let p of game.players) {
        const ox = p.pos.x, oy = p.pos.y;
        p.update(dt);
        if (dt > 0) p.vel = { x: (p.pos.x - ox) / dt, y: (p.pos.y - oy) / dt };
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
    // Minion update + pending death tracking pro 6Hz broadcast
    if (!game._pendingMinionDeaths) game._pendingMinionDeaths = new Set();
    for(let m of game.minions) {
        const ox = m.pos.x, oy = m.pos.y;
        m.update(dt);
        if (dt > 0) m.vel = { x: (m.pos.x - ox) / dt, y: (m.pos.y - oy) / dt };
        if (m.dead) { game._pendingMinionDeaths.add(m.id); if (game.deadMinionIds) game.deadMinionIds.add(m.id); }
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

    // Minion collision resolution (anti-stacking) — pouze na Hostu, Klient interpoluje.
    // Throttle: jen každých 6 ticků (~6x za sekundu při 60fps), persistent grid bez GC.
    if (!socket || game.isHost) {
      game._minionCollTick = (game._minionCollTick || 0) + 1;
      if (game._minionCollTick % 6 === 0 && game.minions.length > 1) {
        const CELL = 60;
        if (!game._minionCollGrid) game._minionCollGrid = new Map();
        const grid = game._minionCollGrid;
        // Reuse existujících polí — jen zkrátíme délku místo alokace nových
        for (const arr of grid.values()) arr.length = 0;
        for (const m of game.minions) {
          if (m.dead) continue;
          const key = Math.floor(m.pos.x / CELL) * 10000 + Math.floor(m.pos.y / CELL);
          let cell = grid.get(key);
          if (!cell) { cell = []; grid.set(key, cell); }
          cell.push(m);
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
                  const push = (minD - d) / 2, px = (dx/d)*push, py = (dy/d)*push;
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
            if (game.syncTimer >= 0.05) {
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
        
        // HOST SYNCHRONIZUJE STAV BOTŮ A MINIONŮ
        // Diferencované Hz podle typu dat — stejný princip jako v ServerEngine.js
        if (game.isHost) {
            // ── Timery ─────────────────────────────────────────────────────────
            game._tBot    = (game._tBot    || 0) + dt; // 20 Hz — pozice botů
            game._tMinion = (game._tMinion || 0) + dt; // 6 Hz  — pozice minionů
            game._tPvp    = (game._tPvp    || 0) + dt; // 20 Hz — HP/buffs lidí (PvP kritické)
            game._tScore  = (game._tScore  || 0) + dt; // 2 Hz  — gold, kills, level
            game._tTower  = (game._tTower  || 0) + dt; // 3 Hz  — věže
            game._tSlow   = (game._tSlow   || 0) + dt; // 1 Hz  — heals, nexus

            // ── Helper: pozice živých hráčů pro proximity culling ──────────────
            const _humanPos = () => {
                const out = [];
                for (const p of game.players) { if (!(p instanceof BotPlayer) && p.alive) out.push(p.pos); }
                return out;
            };
            // Viewport-based proximity tier — thresholdy odvozeny od skutečné velikosti viewportu (~550px radius).
            // Tier 0: viewport +15% → 100% rate
            // Tier 1: viewport +60% → 50% rate
            // Tier 2: viewport +150% → 25% rate
            // Tier 3: za tím       → 10% rate
            const _proxTier = (pos, hPos) => {
                if (hPos.length === 0) return 0;
                let minD2 = Infinity;
                for (const h of hPos) { const dx = pos.x-h.x, dy = pos.y-h.y; const d2=dx*dx+dy*dy; if(d2<minD2) minD2=d2; }
                if (minD2 < 700*700)  return 0;
                if (minD2 < 1400*1400) return 1;
                if (minD2 < 2800*2800) return 2;
                return 3;
            };

            // ── 20 Hz: pozice botů (viewport-based culling) ───────────────────
            if (game._tBot >= 0.05) {
                game._tBot = 0;
                const hPos = _humanPos();
                const botUpdates = [];
                for (const b of game.players) {
                    if (!(b instanceof BotPlayer)) continue;
                    // Viewport culling: tier 0=100%, tier 1=50% (každý 2.), tier 2=25% (každý 4.), tier 3=10% (každý 10.)
                    const tier = _proxTier(b.pos, hPos);
                    b._proxSkip = (b._proxSkip || 0) + 1;
                    if (tier === 1 && b._proxSkip % 2 !== 0) continue;
                    if (tier === 2 && b._proxSkip % 4 !== 0) continue;
                    if (tier === 3 && b._proxSkip % 10 !== 0) continue;
                    // Delta komprese
                    const dx = b.pos.x - (b._lastSyncX ?? b.pos.x + 999);
                    const dy = b.pos.y - (b._lastSyncY ?? b.pos.y + 999);
                    if ((dx*dx + dy*dy) <= 1 && !b.isDirty) continue;
                    b._lastSyncX = b.pos.x; b._lastSyncY = b.pos.y;
                    const base = { id: b.id, x: Math.round(b.pos.x), y: Math.round(b.pos.y), hp: Math.round(b.hp), alive: b.alive, aimAngle: b.aimAngle, stunT: b.stunTimer, shield: b.shield,
                        invT: b.invulnerableTimer, defT: b.defBuffTimer,
                        msBuffT: b.msBuffTimer, msBuffAmt: b.msBuffAmount,
                        adAsBuffT: b.adAsBuffTimer, adAsBuffAmt: b.adAsBuffAmount,
                        antiHealT: b.antiHealTimer, antiHealStr: b.antiHealStrength,
                        regenBuffT: b.regenBuffTimer, regenBuffAmt: b.regenBuffAmount,
                        hasPwrup: b.hasPowerup, pwrupT: b.powerupTimer,
                        beamUberT: b.beamUberTimer };
                    if (b.isDirty) {
                        b.isDirty = false;
                        botUpdates.push({ ...base, isFullUpdate: true, className: b.className,
                            slowT: b.slowTimer, boostT: b.boostTimer, silenceT: b.silenceTimer, hanaT: b.hanaBuffTimer, beamT: b.beamTimer, beamId: b.beamTargetId, uberT: b.uberChargeTimer,
                            junglePwrT: b.junglePowerTimer, jungleAsAhT: b.jungleAsAhTimer, jungleTankT: b.jungleTankTimer,
                            level: b.level, maxHp: b.effectiveMaxHp, kills: b.kills, deaths: b.deaths, assists: b.assists, gold: b.totalGold, items: b.items.length,
                            AD: b.AD, AP: b.AP, armor: b.armor, mr: b.mr, speed: b.speed, attackSpeed: b.attackSpeed, abilityHaste: b.abilityHaste,
                            invTimer: b.invulnerableTimer, defTimer: b.defBuffTimer, qLvl: b.spells.Q.level, eLvl: b.spells.E.level,
                            sumSpell: b.summonerSpell, towerCaptures: b.towerCaptures || 0, pcs: b.pcs || 0 });
                    } else {
                        botUpdates.push(base);
                    }
                }
                if (botUpdates.length > 0) {
                    try { socket.emit('host_state', { bots: botUpdates, minions: [] });
                    } catch(netErr) { console.warn('[NET] host_state (bots) error:', netErr.message); }
                }
            }

            // ── 6 Hz: pozice minionů (proximity culled, silná interpolace na klientovi) ──
            if (game._tMinion >= 0.167) {
                game._tMinion = 0;
                const hPos = _humanPos();
                const minionOut = [];
                // Pending deaths (minioni co zemřeli od posledního minion ticku)
                if (game._pendingMinionDeaths && game._pendingMinionDeaths.size > 0) {
                    for (const id of game._pendingMinionDeaths) minionOut.push({ id, dead: true });
                    game._pendingMinionDeaths.clear();
                }
                for (const m of game.minions) {
                    if (m.dead) continue; // dead handled via _pendingMinionDeaths
                    // Viewport culling: tier 0=6Hz, tier 1=3Hz, tier 2=1.5Hz, tier 3=0.6Hz
                    const tier = _proxTier(m.pos, hPos);
                    m._proxSkip = (m._proxSkip || 0) + 1;
                    if (tier === 1 && m._proxSkip % 2 !== 0) continue; // ~3 Hz
                    if (tier === 2 && m._proxSkip % 4 !== 0) continue; // ~1.5 Hz
                    if (tier === 3 && m._proxSkip % 10 !== 0) continue; // ~0.6 Hz
                    if (m._syncDirty) {
                        m._syncDirty = false;
                        minionOut.push({ id: m.id, x: Math.round(m.pos.x), y: Math.round(m.pos.y), hp: Math.round(m.hp), dead: false, maxHp: m.maxHp, team: m.team, targetIndex: m.targetIndex, isSummon: m.isSummon, glyph: m.glyph, tHeroId: m.targetHeroId, isSc: m.isSmallChicken, isBc: m.isBigChicken });
                    } else {
                        minionOut.push({ id: m.id, x: Math.round(m.pos.x), y: Math.round(m.pos.y), hp: Math.round(m.hp) });
                    }
                }
                if (minionOut.length > 0) {
                    try { socket.emit('host_state', { bots: [], minions: minionOut });
                    } catch(netErr) { console.warn('[NET] host_state (minions) error:', netErr.message); }
                }
            }

            // ── 20 Hz: HP/shield/buffs lidských hráčů (PvP kritické) ───────────
            if (game._tPvp >= 0.05) {
                game._tPvp = 0;
                const humanUpdates = game.players
                    .filter(p => !(p instanceof BotPlayer))
                    .map(p => {
                        const h = { id: p.id, hp: Math.round(p.hp), alive: p.alive };
                        if (p.shield > 0)               h.shield    = Math.round(p.shield);
                        if (p.stunTimer > 0.01)         h.stunT     = Math.round(p.stunTimer*100)/100;
                        if (p.slowTimer > 0.01)         h.slowT     = Math.round(p.slowTimer*10)/10;
                        if (p.invulnerableTimer > 0.01) h.invT      = Math.round(p.invulnerableTimer*10)/10;
                        if (p.defBuffTimer > 0.01)      h.defT      = Math.round(p.defBuffTimer*10)/10;
                        if (p.msBuffTimer > 0.01)       { h.msBuffT = Math.round(p.msBuffTimer*10)/10; h.msBuffAmt = Math.round((p.msBuffAmount||0)*100)/100; }
                        if (p.hasPowerup)               { h.hasPwrup = 1; h.pwrupT = Math.round(p.powerupTimer*10)/10; }
                        if (p.beamTimer > 0.01)         { h.beamT   = Math.round(p.beamTimer*10)/10; h.beamId = p.beamTargetId; }
                        if (p.uberChargeTimer > 0.01)   h.uberT     = Math.round(p.uberChargeTimer*10)/10;
                        if (p.beamUberTimer > 0.01)     h.beamUberT = Math.round(p.beamUberTimer*10)/10;
                        if (p.knockbackTimer > 0)       { h.kbT = Math.round(p.knockbackTimer*100)/100; h.kbVx = Math.round(p.knockbackVel.x); h.kbVy = Math.round(p.knockbackVel.y); }
                        return h;
                    });
                if (humanUpdates.length > 0) {
                    try { socket.emit('host_state', { bots: [], minions: [], humans: humanUpdates });
                    } catch(netErr) { console.warn('[NET] host_state (pvp) error:', netErr.message); }
                }
            }

            // ── 2 Hz: scoreboard (gold, kills, level) ─────────────────────────
            if (game._tScore >= 0.5) {
                game._tScore = 0;
                const scoreUpdates = game.players
                    .filter(p => !(p instanceof BotPlayer))
                    .map(p => ({
                        id: p.id, gold: p.totalGold, currentGold: p.gold, exp: p.exp, totalExp: p.totalExp || 0,
                        kills: p.kills, deaths: p.deaths, assists: p.assists,
                        alive: p.alive, macro: p.macroOrder ? p.macroOrder.type : null,
                        towerCaptures: p.towerCaptures || 0, pcs: p.pcs || 0,
                        silenceT: p.silenceTimer, hanaT: p.hanaBuffTimer,
                        junglePwrT: p.junglePowerTimer, jungleAsAhT: p.jungleAsAhTimer, jungleTankT: p.jungleTankTimer,
                        adAsBuffT: p.adAsBuffTimer, adAsBuffAmt: p.adAsBuffAmount,
                        antiHealT: p.antiHealTimer, antiHealStr: p.antiHealStrength,
                        regenBuffT: p.regenBuffTimer, regenBuffAmt: p.regenBuffAmount,
                        boostT: p.boostTimer
                    }));
                if (scoreUpdates.length > 0) {
                    try { socket.emit('host_state', { bots: [], minions: [], score: scoreUpdates });
                    } catch(netErr) { console.warn('[NET] host_state (score) error:', netErr.message); }
                }
            }

            // ── 3 Hz: věže — proximity-tiered + dirty-only ────────────────────
            if (game._tTower >= 0.333) {
                game._tTower = 0;
                const hPos = _humanPos();
                const towerOut = [];
                for (const t of game.towers) {
                    const tier = _proxTier(t.pos, hPos);
                    t._towerSkip = (t._towerSkip || 0) + 1;
                    if (tier === 1 && t._towerSkip % 2 !== 0) continue; // ~1.5 Hz
                    if (tier === 2 && t._towerSkip % 3 !== 0) continue; // ~1 Hz
                    if (tier === 3 && t._towerSkip % 6 !== 0) continue; // ~0.5 Hz
                    // Dirty check: posílej jen věže kde se něco změnilo
                    const cc = t.control, co = t.owner, cl = t.isLocked;
                    if (t._lastC === cc && t._lastO === co && t._lastL === cl && tier > 0) continue;
                    t._lastC = cc; t._lastO = co; t._lastL = cl;
                    towerOut.push({i: t.index, c: cc, o: co, l: cl, u: t.unlockTimer});
                }
                if (towerOut.length > 0) {
                    try { socket.emit('host_state', { bots: [], minions: [], towers: towerOut });
                    } catch(netErr) { console.warn('[NET] host_state (towers) error:', netErr.message); }
                }
            }

            // ── 1 Hz: heals, nexus (málokdy se mění) ──────────────────────────
            if (game._tSlow >= 1.0) {
                game._tSlow = 0;
                try { socket.emit('host_state', { bots: [], minions: [],
                    heals: game.heals.map(h => h.active),
                    powerup: game.powerup ? { a: game.powerup.active, c: game.powerup.captureTimer } : null,
                    nexus: [game.nexus[0], game.nexus[1]]
                }); } catch(netErr) { console.warn('[NET] host_state (slow) error:', netErr.message); }
            }
        }
    }
  }

  // ── Perf tracking pro overlay ──────────────────────────────────────────────
  // Accumulate frame stats každou sekundu → zobrazí se v pingDisplay
  game._perf = { tickCount: 0, slowTicks: 0, tickMsSum: 0, tickMsMax: 0, lastFlush: performance.now() };

  let last = performance.now();
  function loop(){
    try {
      const now = performance.now();
      const frameMs = now - last;
      const dtRaw = Math.min(0.05, frameMs / 1000);
      last = now;

      // Perf accounting
      if (game._perf) {
        game._perf.tickCount++;
        game._perf.tickMsSum += frameMs;
        if (frameMs > game._perf.tickMsMax) game._perf.tickMsMax = frameMs;
        if (frameMs > 50) game._perf.slowTicks++; // >50ms = slow frame (sub-20fps)
        // Flush každou sekundu
        if (now - game._perf.lastFlush >= 1000) {
          const n = game._perf.tickCount || 1;
          const elapsed = now - game._perf.lastFlush;
          game._perfSnapshot = {
            avgMs:   Math.round(game._perf.tickMsSum / n * 10) / 10,
            maxMs:   Math.round(game._perf.tickMsMax * 10) / 10,
            slowPct: Math.round(game._perf.slowTicks / n * 100),
            fps:     Math.round(n * 1000 / elapsed),
            players: game.players ? game.players.length : 0,
            minions: game.minions ? game.minions.length : 0,
            projs:   game.projectiles ? game.projectiles.length : 0,
          };
          game._perf.tickCount = 0; game._perf.slowTicks = 0;
          game._perf.tickMsSum = 0; game._perf.tickMsMax = 0;
          game._perf.lastFlush = now;

          // Console log stavu každé 3 sekundy
          game._perf._logTimer = (game._perf._logTimer || 0) + 1;
          if (game._perf._logTimer >= 3) {
            game._perf._logTimer = 0;
            const s = game._perfSnapshot;
            const role = game.isHost ? 'HOST' : 'CLIENT';
            const warn = s.slowPct > 20 ? ' ⚠ SLOW' : '';
            console.log(`[PERF ${role}] ${s.fps}fps  frame=${s.avgMs}/${s.maxMs}ms  slow=${s.slowPct}%${warn}  ${s.players}p ${s.minions}m ${s.projs}proj`);
          }
        }
      }

      if (!simMode) { update(dtRaw); draw(); }
      requestAnimationFrame(loop);
    } catch(err) {
      console.error('[FATAL ERROR] Game loop crashed!', err);
      try { console.table({ players: game.players.length, minions: game.minions.length, projectiles: game.projectiles.length, particles: game.particles.length, isHost: game.isHost }); } catch(_) {}
      console.error('[FATAL STACK]', err.stack);
      alert('Game crashed! Press F12 and send the log (Console tab).\n\nError: ' + err.message);
      return;
    }
  }
  requestAnimationFrame(loop);

  buildMenu();
  populateShop();
  updateInventory();
