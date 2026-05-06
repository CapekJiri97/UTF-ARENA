import { clamp, dist, isPointInPoly, distToPoly, smoothPolygon, expForLevel } from './Utils.js';
import { shopItems, canBuyShopItem, getShopItem } from './items.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { game, camera, TEAM_COLOR, NEUTRAL_COLOR, RANGED_ATTACK_RANGE, MELEE_ATTACK_RANGE, BOT_WEIGHTS } from './State.js';
import { world, spawnPoints, rawPolys, mapBoundary } from './MapConfig.js';
import { Particle, spawnParticles, DamageNumber, EffectText } from './Effects.js';
import { Projectile, Tower, Minion, HealPickup, PowerUp } from './Entities.js';
import { Player, BotPlayer } from './Player.js';
import { buildMenu, populateShop, toggleShop, updateLobbyUI, showEnd, draw, updateSpellLabels, updateInventory, updateRoomListUI, updateShopGold } from './UI.js';
import { initAudio, playSound } from './Audio.js';

  export const canvas = document.getElementById('gameCanvas');
  export const ctx = canvas.getContext('2d');
  function resize(){ 
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr; 
      canvas.height = window.innerHeight * dpr; 
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
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
    
    socket.on('room_list', (data) => { if(typeof updateRoomListUI === 'function') updateRoomListUI(data); });
    socket.on('lobby_update', (data) => { if(typeof updateLobbyUI === 'function') updateLobbyUI(data.players, data.roomName, data.settings); });
    socket.on('game_start', (data) => {
      const m = document.getElementById('menu'); if(m) m.style.display = 'none';
      // Extrahujeme data správně a určíme, kdo je Host
      game.isHost = (socket.id === data.hostId);
      game.hostId = data.hostId; // Zapamatujeme si ID hosta pro případ odpojení
      if (data.settings) {
          game.blueBotDifficulty = data.settings.blueBotDiff / 100;
          game.redBotDifficulty = data.settings.redBotDiff / 100;
      }
      if(typeof startGameNetworked === 'function') startGameNetworked(data.players);
    });
    socket.on('network_player_update', (data) => {
      let netPlayer = game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) { 
        netPlayer.targetPos = { x: data.x, y: data.y }; // Nastavení cílové pozice pro plynulý pohyb
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

        if (data.isFullUpdate) {
          if (data.level && data.level > netPlayer.level) { netPlayer.levelUpTimer = 2.0; spawnParticles(netPlayer.pos.x, netPlayer.pos.y, 25, '#ffcc00', {speed: 120, life: 1.0}); }
          netPlayer.level = data.level || netPlayer.level; netPlayer.maxHp = data.maxHp || netPlayer.maxHp;
          netPlayer.items.length = data.items !== undefined ? data.items : netPlayer.items.length;
          netPlayer.AD = data.AD || netPlayer.AD; netPlayer.AP = data.AP || netPlayer.AP; netPlayer.armor = data.armor || netPlayer.armor;
          netPlayer.mr = data.mr || netPlayer.mr; netPlayer.speed = data.speed || netPlayer.speed; netPlayer.attackSpeed = data.attackSpeed || netPlayer.attackSpeed; netPlayer.abilityHaste = data.abilityHaste || netPlayer.abilityHaste;
          netPlayer.invulnerableTimer = data.invTimer || 0; netPlayer.defBuffTimer = data.defTimer || 0; // Ochrana proti lokálnímu falešnému damage
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
      data.bots.forEach(bData => {
        let bot = game.players.find(p => p.id === bData.id);
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
          bot.targetPos = { x: bData.x, y: bData.y }; bot.hp = bData.hp; bot.alive = bData.alive; bot.aimAngle = bData.aimAngle;
          bot.slowTimer = bData.slowT || 0;
          bot.boostTimer = bData.boostT || 0;
          bot.silenceTimer = bData.silenceT || 0;
          bot.stunTimer = bData.stunT || 0;
          bot.shield = bData.shield || 0;
          bot.hanaBuffTimer = bData.hanaT || 0;
          bot.beamTimer = bData.beamT || 0;
          bot.beamTargetId = bData.beamId;
          bot.uberChargeTimer = bData.uberT || 0;

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
      const hostMinionIds = new Set(data.minions.map(m => m.id));
      game.minions.forEach(m => { if (!hostMinionIds.has(m.id)) m.dead = true; });

      if (!game.deadMinionIds) game.deadMinionIds = new Set();

      data.minions.forEach(mData => {
        let minion = game.minions.find(m => m.id === mData.id);
        if (!minion && !mData.dead && !game.deadMinionIds.has(mData.id)) { // Pokud u klienta chybí a nebyl lokálně zabit, vytvoříme ho
           minion = new Minion(mData.x, mData.y, mData.team, mData.targetIndex);
           minion.id = mData.id;
           minion.isSummon = mData.isSummon;
           minion.glyph = mData.glyph || 'm';
           minion.maxHp = mData.maxHp || 250;
           minion.targetPos = { x: mData.x, y: mData.y };
           minion.targetHeroId = mData.tHeroId;
           minion.isSmallChicken = mData.isSc;
           minion.isBigChicken = mData.isBc;
           game.minions.push(minion);
        }
        if (minion) { minion.targetPos = { x: mData.x, y: mData.y }; minion.hp = mData.hp; minion.dead = mData.dead; minion.maxHp = mData.maxHp || minion.maxHp; minion.glyph = mData.glyph || minion.glyph; minion.targetHeroId = mData.tHeroId !== undefined ? mData.tHeroId : minion.targetHeroId; minion.isSmallChicken = mData.isSc !== undefined ? mData.isSc : minion.isSmallChicken; minion.isBigChicken = mData.isBc !== undefined ? mData.isBc : minion.isBigChicken; }
      });
      data.towers.forEach(tData => {
        let tower = game.towers.find(t => t.index === tData.i);
        if (tower) { 
            if (tower.owner !== tData.o && tData.o !== -1) game.shake = 0.3; // Zemětřesení pro klienty při zabrání
            tower.control = tData.c; tower.owner = tData.o; 
        }
      });
      // Sdílení lékárniček, powerupů a životů základen z Hosta na Klienty
      if (data.heals) data.heals.forEach((act, i) => { if(game.heals[i]) game.heals[i].active = act; });
      if (data.powerup && game.powerup) { game.powerup.active = data.powerup.a; game.powerup.captureTimer = data.powerup.c; }
      if (data.nexus) { game.nexus[0] = data.nexus[0]; game.nexus[1] = data.nexus[1]; }
          if (data.humans) {
              data.humans.forEach(hData => {
                  let p = game.players.find(x => x.id === hData.id);
                  if (p) {
                      if (p === player) {
                          // LOKÁLNÍ HRÁČ: Počítáme jen přírůstky Goldů a EXPů z Hosta, abychom zamezili skákání UI při nákupech!
                          let goldDiff = hData.gold - (p.totalGold || 0); if (goldDiff > 0) { p.gold += goldDiff; p.totalGold = hData.gold; }
                          let expDiff = hData.totalExp - (p.totalExp || 0); if (expDiff > 0) { p.exp += expDiff; p.totalExp = hData.totalExp; }
                          p.hp = hData.hp; p.kills = hData.kills; p.deaths = hData.deaths; p.assists = hData.assists;
                      } else {
                          // SÍŤOVÍ HRÁČI: Rovnou natvrdo přepisujeme vše, včetně zlata a expů
                          p.hp = hData.hp; p.gold = hData.currentGold; p.totalGold = hData.gold; p.exp = hData.exp; p.totalExp = hData.totalExp;
                          p.kills = hData.kills; p.deaths = hData.deaths; p.assists = hData.assists;
                      }
                      if (hData.shield !== undefined) p.shield = hData.shield;
                      if (hData.silenceT !== undefined) p.silenceTimer = hData.silenceT;
                      if (hData.stunT !== undefined) p.stunTimer = hData.stunT;
                      if (hData.slowT !== undefined) p.slowTimer = hData.slowT;
                      if (hData.boostT !== undefined) p.boostTimer = hData.boostT;
                      if (hData.hanaT !== undefined) p.hanaBuffTimer = hData.hanaT;
                      if (hData.beamT !== undefined) p.beamTimer = hData.beamT;
                      p.beamTargetId = hData.beamId;
                      if (hData.uberT !== undefined) p.uberChargeTimer = hData.uberT;
                      if (hData.macro !== undefined) p.macroOrder = hData.macro ? { type: hData.macro } : null;
                      if (hData.stats && p.stats) { p.stats.dmgDealt = hData.stats.dmgDealt; p.stats.dmgTaken = hData.stats.dmgTaken; p.stats.hpHealed = hData.stats.hpHealed; }
                        if (hData.towerCaptures !== undefined) p.towerCaptures = hData.towerCaptures;
                        if (hData.towerDefends !== undefined) p.towerDefends = hData.towerDefends;
                        if (hData.towerAssaultTime !== undefined) p.towerAssaultTime = hData.towerAssaultTime;
                        if (hData.objectivePresenceTime !== undefined) p.objectivePresenceTime = hData.objectivePresenceTime;
                        if (hData.powerupsCollected !== undefined) p.powerupsCollected = hData.powerupsCollected;
                        if (hData.powerupUptime !== undefined) p.powerupUptime = hData.powerupUptime;
                        if (hData.pcs !== undefined) p.pcs = hData.pcs;
                        if (hData.pcsBreakdown) p.pcsBreakdown = hData.pcsBreakdown;
                      if (!p.alive && hData.alive) p.revive(); else if (p.alive && !hData.alive) { p.hp = 0; p.die(); }
                  }
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
        if (p) { p.hp = data.hp; spawnParticles(game.heals[data.healIndex].pos.x, game.heals[data.healIndex].pos.y, 25, '#0f0', {speed: 150}); if(p === player) { flashMessage("+50% HP!"); game.screenHealFlash = 0.5; } }
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
          if (it && canBuyShopItem(netPlayer, it).ok && netPlayer.gold >= it.cost) {
                netPlayer.gold -= it.cost;
                netPlayer.items.push(data.itemId);
                it.apply(netPlayer);
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
  window.addEventListener('keydown', e=>{ if(e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = true; if(['w','a','s','d','tab','c','m','j','k','arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
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
    if(k === sumKey) { player && player.castSummonerSpell && player.castSummonerSpell(); }
    if(k === 'b') toggleShop();
    if(k === 'u' && keys['shift']) { game.autoTarget = !game.autoTarget; flashMessage('Auto Target: ' + (game.autoTarget ? 'ON' : 'OFF')); }
    if(k === 'i' && keys['shift']) { 
        if (!game.autoPlay) { game.autoPlay = true; game.autoBuy = true; flashMessage('Auto: FULL'); }
        else if (game.autoBuy) { game.autoBuy = false; flashMessage('Auto: COMBAT ONLY'); }
        else { game.autoPlay = false; game.autoBuy = false; flashMessage('Auto: OFF'); }
    }
    if(k === 'o' && keys['shift']) { game.mouseTarget = !game.mouseTarget; flashMessage('Mouse Target: ' + (game.mouseTarget ? 'ON' : 'OFF')); }
  });

  export const mouse = { sx:0, sy:0, down:false, wx:0, wy:0 };
  canvas.addEventListener('mousemove', e=>{ const r = canvas.getBoundingClientRect(); mouse.sx = e.clientX - r.left; mouse.sy = e.clientY - r.top; });
  window.addEventListener('mousedown', ()=> mouse.down = true);
  window.addEventListener('mouseup', ()=> mouse.down = false);

  export function screenToWorld(sx, sy){ return { x: camera.x + sx / camera.scale, y: camera.y + sy / camera.scale }; }

  export function drawHealthBar(ctx, hp, maxHp, x, y, team) {
    const boxes = 5; let f = Math.max(0, Math.min(boxes, Math.round((Math.max(0, hp) / maxHp) * boxes) || 0));
    let bar = '[' + '|'.repeat(f) + ' '.repeat(boxes - f) + ']';
    ctx.font = '10px monospace'; ctx.fillStyle = team === 0 ? '#486FED' : (team === 1 ? '#FF4E4E' : '#999');
    ctx.fillText(bar, x, y);
  }

  export function grantRewards(targetPlayer, baseGold, baseExp) {
    if (!targetPlayer) return;
    let avgLevel = 1;
    let totalLevel = 0;
    let count = 0;
    for (let p of game.players) { if (p.team >= 0) { totalLevel += p.level; count++; } }
    if (count > 0) avgLevel = totalLevel / count;

    let mult = 1.0;
    if (targetPlayer.level >= avgLevel + 3) mult = 0.5;
    else if (targetPlayer.level <= avgLevel - 2) mult = 1.5;

    let finalGold = Math.round(baseGold * mult);
    let finalExp = Math.round(baseExp * mult);

    targetPlayer.gold += finalGold;
    targetPlayer.totalGold += finalGold;
    targetPlayer.exp += finalExp;
    targetPlayer.totalExp = (targetPlayer.totalExp || 0) + finalExp;
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
            if (socket) socket.emit('host_event', { type: 'show_heal', targetId: target.id, amount: actualHeal });
            if (socket && target instanceof Player) {
                socket.emit('host_event', { type: 'player_hp_update', id: target.id, hp: target.hp, shield: target.shield });
            }
        }
        return actualHeal;
    }
    return 0;
  }

  export function applyDamage(target, amount, type, sourceId, isNetwork = false) {
    if(!target || target.dead || target.hp <= 0) return 0;
    if(target.invulnerableTimer > 0 && type !== 'true') {
        game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, "IMMUNE"));
        return 0;
    }
    const sourceEntity = game.players.find(p => p.id === sourceId) || game.minions.find(m => m.id === sourceId);
    let multiplier = 1;
    let arm = target.armor || 0; let mr = target.mr || 0;
    if(target.hasPowerup) { arm *= 1.2; mr *= 1.2; }
    if(target.boostTimer > 0) { arm *= 1.1; mr *= 1.1; }
    if(target.defBuffTimer > 0) { arm += 50; mr += 50; }
    if (sourceEntity) {
      if (type === 'physical') arm = Math.max(0, arm - (sourceEntity.armorPenFlat || 0));
      if (type === 'magical') mr = Math.max(0, mr - (sourceEntity.magicPenFlat || 0));
    }
    if (type === 'physical') multiplier = 100 / (100 + arm);
    else if (type === 'magical') multiplier = 100 / (100 + mr);
    else if (type === 'true') multiplier = 1; // Pure damage (Fountain laser)
    
    // OPRAVA: Host posílá striktní zprávu o poškození minionů pouze proti lidským hráčům (Boti se posílají rovnou celí přes host_state prevence zdvojení).
    if (socket && game.isHost && !isNetwork) {
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
    }
    target.flashTimer = 0.1;
    
    if (finalDamage > 0 || actualDamage > 0) {
        let isHeroInvolved = game.players.some(p => p.id === sourceId || p.id === target.id);
        if (isHeroInvolved) { // Přehrává zvuk pouze pokud se boje účastní nějaký hrdina (redukce šumu z minionů)
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
            else color = isLocal ? '#ffffff' : '#ffc83c';
            
            game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, actualDamage, color));
            if (socket) socket.emit('host_event', { type: 'show_damage', targetId: target.id, amount: actualDamage, sourceId: sourceId, dmgType: type });
        }
    }

        if ((!socket || game.isHost || isNetwork) && sourceEntity instanceof Player && finalDamage > 0) {
          const sustain = type === 'physical' ? (sourceEntity.lifesteal || 0) : (type === 'magical' ? (sourceEntity.spellVamp || 0) : 0);
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
            target.antiHealTimer = Math.max(target.antiHealTimer || 0, 3.0);
            target.antiHealStrength = Math.max(target.antiHealStrength || 0, sourceEntity.antiHeal);
          }
        }

    // OPRAVA: Host je autorita a posílá všem informaci o změně HP hráče
    if (socket && game.isHost && target instanceof Player && !isNetwork) {
        socket.emit('host_event', { type: 'player_hp_update', id: target.id, hp: target.hp, shield: target.shield });
    }
    
    // PŘIDÁNO: Centrální registrace mrtvých minionů pro prevenci "duchů" a falešných duplicitních zisků goldů
    if (target instanceof Minion && target.hp <= 0) {
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
      if (socket && game.isHost) socket.emit('host_event', { type: 'player_died', id: victim.id, killerId: killerId });

      let killerName = killer ? killer.className : (killerId === 'laser' ? 'Laser' : (killerId === 'tower' ? 'Tower' : 'Minion'));
      let killerTeam = killer ? killer.team : -1;
      
      const killData = { killer: killerName, victim: victim.className || 'Player', killerTeam: killerTeam, victimTeam: victim.team, timer: 5.0 };
      if (game.killFeed) game.killFeed.push(killData);

      if (!socket || game.isHost) {
          if (killer) { grantRewards(killer, 150, 50); killer.kills++; if (typeof killer.refreshDominionPCS === 'function') killer.refreshDominionPCS(); }
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
    const cx = world.width/2, cy = world.height/2, maxR = 1900;
    ent.pos.x += vx * dt; ent.pos.y += vy * dt;
    ent.pos.x = clamp(ent.pos.x, ent.radius, world.width - ent.radius);
    ent.pos.y = clamp(ent.pos.y, ent.radius, world.height - ent.radius);
    
    for(let w of game.walls) {
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
    let isInside = isPointInPoly(ent.pos.x, ent.pos.y, mapBoundary);
    let minDistB = Infinity; let closestB = null;
    for(let i=0; i<mapBoundary.length; i++) {
      let p1 = mapBoundary[i], p2 = mapBoundary[(i+1)%mapBoundary.length];
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
        camera.x = world.width / 2;
        camera.y = world.height / 2;
    }

    const getBotLane = (idx) => { if(idx <= 3) return 'top'; if(idx === 4) return 'bottom'; return Math.random() > 0.5 ? 'top' : 'bottom'; };

    let blueBotCount = (!isSpectator && playerTeam === 0) ? 4 : 5;
    let redBotCount = (!isSpectator && playerTeam === 1) ? 4 : 5;
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
    game.heals = [
        new HealPickup(1079, 2870), new HealPickup(2811, 2860), new HealPickup(3438, 1144),
        new HealPickup(1994, 152), new HealPickup(481, 1110), new HealPickup(1272, 1816),
        new HealPickup(2061, 2204), new HealPickup(2713, 1785), new HealPickup(2014, 1151)
    ];
    game.powerup = new PowerUp(1993, 1567);

    console.log(`[DEBUG] Game started! Player selected class: ${playerClass}`);
  }

  function startGameNetworked(playersData) {
    game.players = []; game.minions = []; game.projectiles = [];

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
        camera.x = world.width / 2;
        camera.y = world.height / 2;
    }

    const getBotLane = (idx) => { if(idx <= 3) return 'top'; if(idx === 4) return 'bottom'; return Math.random() > 0.5 ? 'top' : 'bottom'; };

    let blueBotCount = Math.max(0, 5 - humansBlue);
    let redBotCount = Math.max(0, 5 - humansRed);
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
    game.heals = [ new HealPickup(1079, 2870), new HealPickup(2811, 2860), new HealPickup(3438, 1144), new HealPickup(1994, 152), new HealPickup(481, 1110), new HealPickup(1272, 1816), new HealPickup(2061, 2204), new HealPickup(2713, 1785), new HealPickup(2014, 1151) ];
    game.powerup = new PowerUp(1993, 1567);
  }

  function initWalls() { 
    game.walls = [];
    const processPoly = (pts) => {
      let cx=0, cy=0; pts.forEach(p=>{cx+=p.x; cy+=p.y;}); cx/=pts.length; cy/=pts.length;
      
      let scale = 0.95; // Plošné zmenšení objemu zdí o 5%
      if (dist({x:cx, y:cy}, spawnPoints[0]) < 600 || dist({x:cx, y:cy}, spawnPoints[1]) < 600) {
        scale = 0.85; // Zmenšení "Nexus" zdí o 15% (okolo základen)
      }
      let scaledPts = pts.map(p => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale }));

      let sorted = scaledPts.slice().sort((a,b)=>Math.atan2(a.y-cy, a.x-cx) - Math.atan2(b.y-cy, b.x-cx));
      let minE = Infinity;
      for(let i=0; i<sorted.length; i++) minE = Math.min(minE, dist(sorted[i], sorted[(i+1)%sorted.length]));
      let r = minE * 0.18;
      let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
      sorted.forEach(p=>{ minX=Math.min(minX, p.x); maxX=Math.max(maxX, p.x); minY=Math.min(minY, p.y); maxY=Math.max(maxY, p.y); });
      game.walls.push({ pts: sorted, r, bbox: {minX, maxX, minY, maxY} });
    };
    rawPolys.forEach(pts => {
      let smoothed = smoothPolygon(pts, 3); // Vyhlazení rohů všech vnitřních zdí v aréně
      processPoly(smoothed);
      let mirrored = smoothed.map(p => ({ x: world.width - p.x, y: p.y }));
      processPoly(mirrored);
    });
    
    const makeHex = (cx, cy, r) => {
        let pts = []; for(let i=0; i<6; i++) pts.push({x: Math.round(cx + r*Math.cos(i*Math.PI/3)), y: Math.round(cy + r*Math.sin(i*Math.PI/3))}); return pts;
    };
    const extraPolys = [
        makeHex(1047, 2709, 40), makeHex(1287, 2870, 40),
        makeHex(2617, 2840, 40), makeHex(2868, 2712, 40)
    ];
    extraPolys.forEach(pts => processPoly(pts));
  }
  initWalls();

  function initTowers() { 
    const towerPoints = [
      {x: 827, y: 1224},  // Vez 1
      {x: 1973, y: 394},  // Vez 2
      {x: 3155, y: 1242}, // Vez 3
      {x: 2658, y: 2606}, // Vez 4
      {x: 1266, y: 2603}  // Vez 5
    ];
    game.towers = towerPoints.map((tp, i) => new Tower(tp.x, tp.y, i)); 
  }
  initTowers();

  let spawnTimer = 0; const spawnInterval = 12.0; const nexusDrainRate = 0.75; // Sníženo odečítání skóre (cca 30%)

  export function buyItem(id) { 
    if (!player) return; const it = getShopItem(id); if (!it) return; 
    const allyBaseDist = dist(player.pos, spawnPoints[player.team]); if (allyBaseDist > 250 && player.alive) { return flashMessage('Shop available only in your base!'); } 
    const buyCheck = canBuyShopItem(player, it); if (!buyCheck.ok) { return flashMessage(buyCheck.reason); }
    if (player.gold < it.cost){ return flashMessage('Not enough gold'); } player.gold -= it.cost; player.items.push(it.id); it.apply(player); player.isDirty = true; flashMessage('Bought ' + it.name); updateInventory(); populateShop(); 
    if (socket && !game.isHost) {
        socket.emit('player_action', { type: 'buy_item', id: player.id, itemId: it.id, cost: it.cost });
    }
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
    }
    for(let p of game.projectiles) p.update(dt);
    for(let m of game.minions) {
        let ox = m.pos.x, oy = m.pos.y;
        m.update(dt);
        if (dt > 0) m.vel = { x: (m.pos.x - ox) / dt, y: (m.pos.y - oy) / dt };
    }
    for(let d of game.damageNumbers) d.update(dt);
    for(let t of game.towers) t.update(dt);
    for(let et of game.effectTexts) et.update(dt);
    for(let pt of game.particles) pt.update(dt);
    
    for(let h of game.heals) h.update(dt);
    if(game.powerup) game.powerup.update(dt);

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

    // Minion collision resolution (anti-stacking)
    for(let i=0; i<game.minions.length; i++){
      for(let j=i+1; j<game.minions.length; j++){
        let m1 = game.minions[i], m2 = game.minions[j];
        if(m1.dead || m2.dead) continue;
        let dx = m2.pos.x - m1.pos.x, dy = m2.pos.y - m1.pos.y, d = Math.hypot(dx,dy);
        let minDist = m1.radius + m2.radius;
        if(d < minDist) {
          if (d === 0) { dx = Math.random()-0.5; dy = Math.random()-0.5; d = Math.hypot(dx, dy); }
          let push = (minDist - d) / 2; let px = (dx/d)*push, py = (dy/d)*push;
          m1.pos.x -= px; m1.pos.y -= py; m2.pos.x += px; m2.pos.y += py;
        }
      }
    }

    if (game.shake > 0) game.shake -= dt;
    if (game.screenDamageFlash > 0) game.screenDamageFlash -= dt * 0.8;
    if (game.screenHealFlash > 0) game.screenHealFlash -= dt * 0.8;
    game.passiveTimer = (game.passiveTimer || 0) + dt;
    if (game.startDelay <= 0 && game.passiveTimer >= 1.0) { game.passiveTimer -= 1.0; if (!socket || game.isHost) { for(let p of game.players) { p.gold += 2; p.totalGold += 2; p.exp += 1; p.totalExp = (p.totalExp||0) + 1; } } }

    if (game.killFeed) {
        game.killFeed.forEach(k => k.timer -= dt);
        game.killFeed = game.killFeed.filter(k => k.timer > 0);
    }

    game.projectiles = game.projectiles.filter(p=>!p.dead);
    game.minions = game.minions.filter(m=>!m.dead);
    game.damageNumbers = game.damageNumbers.filter(d=>d.life>0);
    game.particles = game.particles.filter(p=>p.life>0);
    game.effectTexts = game.effectTexts.filter(et=>et.life>0);

    // spawning: owned towers spawn minions toward neighboring enemy-owned towers
    if(game.startDelay <= 0 && (!socket || game.isHost)) { spawnTimer += dt;
      if(spawnTimer > spawnInterval){ spawnTimer = 0; const N = game.towers.length; for(let i=0;i<N;i++){ const t = game.towers[i]; if(t.owner < 0) continue; const next = game.towers[(i+1)%N]; const prev = game.towers[(i-1+N)%N];
          if(next.owner !== t.owner){ for(let k=0; k<4; k++){ const sx = t.pos.x + (Math.random()-0.5)*40; const sy = t.pos.y + (Math.random()-0.5)*40; game.minions.push(new Minion(sx,sy,t.owner,(i+1)%N)); } }
          if(prev.owner !== t.owner){ for(let k=0; k<4; k++){ const sx = t.pos.x + (Math.random()-0.5)*40; const sy = t.pos.y + (Math.random()-0.5)*40; game.minions.push(new Minion(sx,sy,t.owner,(i-1+N)%N)); } }
        } }
    }

    // nexus draining logic (Pouze Host odečítá skóre a ukončuje hru)
    if (!socket || game.isHost) {
      const owned0 = game.towers.filter(t=>t.owner===0).length; const owned1 = game.towers.filter(t=>t.owner===1).length; const diff = owned0 - owned1; if(game.startDelay <= 0 && diff>0){ game.nexus[1] -= nexusDrainRate * diff * dt; } else if(game.startDelay <= 0 && diff<0){ game.nexus[0] -= nexusDrainRate * (-diff) * dt; }
      game.nexus[0] = Math.max(0, game.nexus[0]); game.nexus[1] = Math.max(0, game.nexus[1]);
      if(game.nexus[0] <= 0 && !game.gameOver){ game.gameOver = true; game.winner = 1; showEnd(game.winner); if(socket) socket.emit('host_event', {type:'game_over', winner: 1, finalStats: game.players.map(p=>({id:p.id, stats:p.stats, kills:p.kills, deaths:p.deaths, assists:p.assists, totalGold: p.totalGold, towerCaptures: p.towerCaptures || 0, towerDefends: p.towerDefends || 0, towerAssaultTime: p.towerAssaultTime || 0, objectivePresenceTime: p.objectivePresenceTime || 0, powerupsCollected: p.powerupsCollected || 0, powerupUptime: p.powerupUptime || 0, pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null}))}); }
      if(game.nexus[1] <= 0 && !game.gameOver){ game.gameOver = true; game.winner = 0; showEnd(game.winner); if(socket) socket.emit('host_event', {type:'game_over', winner: 0, finalStats: game.players.map(p=>({id:p.id, stats:p.stats, kills:p.kills, deaths:p.deaths, assists:p.assists, totalGold: p.totalGold, towerCaptures: p.towerCaptures || 0, towerDefends: p.towerDefends || 0, towerAssaultTime: p.towerAssaultTime || 0, objectivePresenceTime: p.objectivePresenceTime || 0, powerupsCollected: p.powerupsCollected || 0, powerupUptime: p.powerupUptime || 0, pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null}))}); }
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
        camera.x = clamp(camera.x, 0, Math.max(0, world.width - viewW));
        camera.y = clamp(camera.y, 0, Math.max(0, world.height - viewH));
    } else if (player) {
        const viewW = canvas.clientWidth / camera.scale; 
        const viewH = canvas.clientHeight / camera.scale;
        camera.x = clamp(player.pos.x - viewW/2, 0, Math.max(0, world.width - viewW));
        camera.y = clamp(player.pos.y - viewH/2, 0, Math.max(0, world.height - viewH));
    }

    // SÍŤOVÁ SYNCHRONIZACE POZICE
    if (socket) {
        if (player) {
            game.syncTimer = (game.syncTimer || 0) + dt;
            if (game.syncTimer >= 0.05) {
                game.syncTimer = 0;
                const minimalState = {
                    id: player.id, x: player.pos.x, y: player.pos.y, aimAngle: player.aimAngle,
                    slowT: player.slowTimer, boostT: player.boostTimer, stunT: player.stunTimer,
                    silenceT: player.silenceTimer, shield: player.shield, hanaT: player.hanaBuffTimer,
                    beamT: player.beamTimer, beamId: player.beamTargetId, uberT: player.uberChargeTimer
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
        
        // HOST SYNCHRONIZUJE STAV BOTŮ A MINIONŮ (cca 10x za sekundu)
        if (game.isHost) {
            game.hostSyncTimer = (game.hostSyncTimer || 0) + dt;
            if (game.hostSyncTimer >= 0.1) {
                game.hostSyncTimer = 0;
                socket.emit('host_state', {
                    bots: game.players.filter(p => p instanceof BotPlayer).map(b => {
                    const minimalState = { id: b.id, x: b.pos.x, y: b.pos.y, hp: b.hp, alive: b.alive, aimAngle: b.aimAngle, slowT: b.slowTimer, boostT: b.boostTimer, silenceT: b.silenceTimer, stunT: b.stunTimer, shield: b.shield, hanaT: b.hanaBuffTimer, beamT: b.beamTimer, beamId: b.beamTargetId, uberT: b.uberChargeTimer, towerCaptures: b.towerCaptures || 0, towerDefends: b.towerDefends || 0, towerAssaultTime: b.towerAssaultTime || 0, objectivePresenceTime: b.objectivePresenceTime || 0, powerupsCollected: b.powerupsCollected || 0, powerupUptime: b.powerupUptime || 0, pcs: b.pcs || 0 };
                        if (b.isDirty) {
                            b.isDirty = false;
                            return { ...minimalState, isFullUpdate: true, className: b.className,
                                level: b.level, maxHp: b.effectiveMaxHp, kills: b.kills, deaths: b.deaths, assists: b.assists, gold: b.totalGold,
                        items: b.items.length,
                                AD: b.AD, AP: b.AP, armor: b.armor, mr: b.mr, speed: b.speed, attackSpeed: b.attackSpeed, abilityHaste: b.abilityHaste,
                        invTimer: b.invulnerableTimer, defTimer: b.defBuffTimer, qLvl: b.spells.Q.level, eLvl: b.spells.E.level,
                        stats: b.stats, sumSpell: b.summonerSpell,
                        towerCaptures: b.towerCaptures || 0, towerDefends: b.towerDefends || 0, towerAssaultTime: b.towerAssaultTime || 0, objectivePresenceTime: b.objectivePresenceTime || 0,
                        powerupsCollected: b.powerupsCollected || 0, powerupUptime: b.powerupUptime || 0, pcs: b.pcs || 0, pcsBreakdown: b.pcsBreakdown || null };
                        } else { return minimalState; }
                    }),
                    humans: game.players.filter(p => !(p instanceof BotPlayer)).map(p => ({
                        id: p.id, hp: p.hp, shield: p.shield, silenceT: p.silenceTimer, stunT: p.stunTimer, slowT: p.slowTimer, boostT: p.boostTimer, hanaT: p.hanaBuffTimer, gold: p.totalGold, currentGold: p.gold, exp: p.exp, totalExp: p.totalExp || 0,
                    kills: p.kills, deaths: p.deaths, assists: p.assists, stats: p.stats, alive: p.alive, macro: p.macroOrder ? p.macroOrder.type : null, beamT: p.beamTimer, beamId: p.beamTargetId, uberT: p.uberChargeTimer,
                    towerCaptures: p.towerCaptures || 0, towerDefends: p.towerDefends || 0, towerAssaultTime: p.towerAssaultTime || 0, objectivePresenceTime: p.objectivePresenceTime || 0,
                    powerupsCollected: p.powerupsCollected || 0, powerupUptime: p.powerupUptime || 0, pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null
                    })),
                    minions: game.minions.map(m => ({
                        id: m.id, x: m.pos.x, y: m.pos.y, hp: m.hp, maxHp: m.maxHp, dead: m.dead, team: m.team, 
                        targetIndex: m.targetIndex, isSummon: m.isSummon, glyph: m.glyph, tHeroId: m.targetHeroId, isSc: m.isSmallChicken, isBc: m.isBigChicken
                    })),
                    towers: game.towers.map(t => ({i: t.index, c: t.control, o: t.owner})),
                    heals: game.heals.map(h => h.active),
                    powerup: game.powerup ? { a: game.powerup.active, c: game.powerup.captureTimer } : null,
                    nexus: game.nexus
                });
            }
        }
    }
  }

  let last = performance.now();
  function loop(){ 
    try {
      const now = performance.now(); const dtRaw = Math.min(0.05, (now-last)/1000); last = now; 
      const steps = game.isSpectator ? 1 : 1;
      for(let i=0; i<steps; i++) { update(dtRaw); }
      draw(); 
      requestAnimationFrame(loop); 
    } catch(err) {
      console.error('[FATAL ERROR] Herní smyčka spadla!', err); console.table({ hráči: game.players.length, minioni: game.minions.length, projektily: game.projectiles.length }); alert('Hra zamrzla z důvodu chyby! Zmáčkni F12 pro otevření konzole a pošli mi výpis.');
    }
  }
  requestAnimationFrame(loop);

  buildMenu();
  populateShop();
  updateInventory();
