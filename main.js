import { clamp, dist, isPointInPoly, distToPoly, smoothPolygon, expForLevel } from './Utils.js';
import { shopItems } from './items.js';
import { CLASSES } from './classes.js';
import { game, camera, TEAM_COLOR, NEUTRAL_COLOR, RANGED_ATTACK_RANGE, MELEE_ATTACK_RANGE, BOT_WEIGHTS } from './State.js';
import { world, spawnPoints, rawPolys, mapBoundary } from './MapConfig.js';
import { Particle, spawnParticles, DamageNumber } from './Effects.js';
import { Projectile, Tower, Minion, HealPickup, PowerUp } from './Entities.js';
import { Player, BotPlayer } from './Player.js';
import { buildMenu, populateShop, toggleShop, updateLobbyUI, showEnd, draw, updateSpellLabels, updateInventory } from './UI.js';

  export const canvas = document.getElementById('gameCanvas');
  export const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
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
    
    socket.on('lobby_update', (playersData) => { if(typeof updateLobbyUI === 'function') updateLobbyUI(playersData); });
    socket.on('game_start', (data) => {
      const m = document.getElementById('menu'); if(m) m.style.display = 'none';
      // Extrahujeme data správně a určíme, kdo je Host
      game.isHost = (socket.id === data.hostId);
      if(typeof startGameNetworked === 'function') startGameNetworked(data.players);
    });
    socket.on('network_player_update', (data) => {
      let netPlayer = game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) { 
        netPlayer.targetPos = { x: data.x, y: data.y }; // Nastavení cílové pozice pro plynulý pohyb
        if (!netPlayer.alive && data.alive) netPlayer.revive(); // Pokud u nás byl mrtvý, ale už ožil
        else if (netPlayer.alive && !data.alive) netPlayer.die(); // Pokud u nás žil, ale server říká že umřel
        netPlayer.hp = data.hp; 
        netPlayer.aimAngle = data.aimAngle !== undefined ? data.aimAngle : netPlayer.aimAngle;
        // PŘIDÁNO: Přijímání statistik pro Scoreboard (TAB)
        netPlayer.level = data.level || netPlayer.level; netPlayer.maxHp = data.maxHp || netPlayer.maxHp;
        netPlayer.kills = data.kills || 0; netPlayer.deaths = data.deaths || 0; netPlayer.assists = data.assists || 0; 
        netPlayer.totalGold = data.gold || 0; netPlayer.items.length = data.items || 0;
        if (data.stats) { netPlayer.stats.dmgDealt = data.stats.dmgDealt; netPlayer.stats.dmgTaken = data.stats.dmgTaken; netPlayer.stats.hpHealed = data.stats.hpHealed; }
        // PŘIDÁNO: Synchro bojových statů pro správný výpočet damage z cizích střel
        netPlayer.AD = data.AD || netPlayer.AD; netPlayer.AP = data.AP || netPlayer.AP; netPlayer.armor = data.armor || netPlayer.armor;
        netPlayer.mr = data.mr || netPlayer.mr; netPlayer.speed = data.speed || netPlayer.speed; netPlayer.attackSpeed = data.attackSpeed || netPlayer.attackSpeed; netPlayer.abilityHaste = data.abilityHaste || netPlayer.abilityHaste;
        netPlayer.invulnerableTimer = data.invTimer || 0; netPlayer.defBuffTimer = data.defTimer || 0; // Ochrana proti lokálnímu falešnému damage
        // PŘIDÁNO: Synchro spell levelů pro správný damage z jejich střel
        if (netPlayer.spells) {
            if (data.qLvl) netPlayer.spells.Q.level = data.qLvl;
            if (data.eLvl) netPlayer.spells.E.level = data.eLvl;
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
          bot.targetPos = { x: bData.x, y: bData.y }; bot.hp = bData.hp; bot.alive = bData.alive; bot.aimAngle = bData.aimAngle; }
        if (bot) {
          bot.level = bData.level || bot.level; bot.maxHp = bData.maxHp || bot.maxHp;
          bot.kills = bData.kills || 0; bot.deaths = bData.deaths || 0; bot.assists = bData.assists || 0; bot.totalGold = bData.gold || 0;
          if (bData.stats) { bot.stats.dmgDealt = bData.stats.dmgDealt; bot.stats.dmgTaken = bData.stats.dmgTaken; bot.stats.hpHealed = bData.stats.hpHealed; }
          bot.AD = bData.AD || bot.AD; bot.AP = bData.AP || bot.AP; bot.armor = bData.armor || bot.armor;
          bot.mr = bData.mr || bot.mr; bot.speed = bData.speed || bot.speed; bot.attackSpeed = bData.attackSpeed || bot.attackSpeed; bot.abilityHaste = bData.abilityHaste || bot.abilityHaste;
          bot.invulnerableTimer = bData.invTimer || 0; bot.defBuffTimer = bData.defTimer || 0;
          if (bot.spells) {
              if (bData.qLvl) bot.spells.Q.level = bData.qLvl;
              if (bData.eLvl) bot.spells.E.level = bData.eLvl;
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
           minion.targetPos = { x: mData.x, y: mData.y };
           game.minions.push(minion);
        }
        if (minion) { minion.targetPos = { x: mData.x, y: mData.y }; minion.hp = mData.hp; minion.dead = mData.dead; }
      });
      data.towers.forEach(tData => {
        let tower = game.towers.find(t => t.index === tData.i);
        if (tower) { tower.control = tData.c; tower.owner = tData.o; }
      });
      // Sdílení lékárniček, powerupů a životů základen z Hosta na Klienty
      if (data.heals) data.heals.forEach((act, i) => { if(game.heals[i]) game.heals[i].active = act; });
      if (data.powerup && game.powerup) { game.powerup.active = data.powerup.a; game.powerup.captureTimer = data.powerup.c; }
      if (data.nexus) { game.nexus[0] = data.nexus[0]; game.nexus[1] = data.nexus[1]; }
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
        if (p) { p.hp = data.hp; spawnParticles(game.heals[data.healIndex].pos.x, game.heals[data.healIndex].pos.y, 25, '#0f0', {speed: 150}); if(p === player) flashMessage("+50% HP!"); }
      } else if (data.type === 'powerup_pickup') {
        let p = game.players.find(x => x.id === data.playerId);
        if (p) { p.hasPowerup = true; p.powerupTimer = 120.0; spawnParticles(data.x, data.y, 40, '#ff0', {speed: 250}); if(p === player) flashMessage("POWER UP OBTAINED! (+20% STATS)"); }
      } else if (data.type === 'game_over') {
        game.gameOver = true; game.winner = data.winner; showEnd(game.winner);
      }
    });
    
    // PŘIDÁNO: Přijímání útoků a kouzel od ostatních hráčů (a botů)
    socket.on('network_player_action', (data) => {
      let netPlayer = game.players.find(p => p.id === data.id);
      if (netPlayer && netPlayer !== player) {
        if (data.type === 'shoot') netPlayer.shoot(data.tx, data.ty, true);
        else if (data.type === 'cast') netPlayer.castSpell(data.spKey, data.tx, data.ty, true);
      }
    });

    socket.on('network_kill_feed', (data) => {
      data.timer = 5.0;
      if (game.killFeed) game.killFeed.push(data);
    });

    socket.on('player_disconnected', (id) => {
       if(game && game.players) game.players = game.players.filter(p => p.id !== id);
    });
  } else {
    console.warn('[KLIENT] Socket.io knihovna nenalezena. Hra běží offline.');
  }

  // =========================================================================
  // ⚙️ GAME ENGINE & BALANCE CONFIGURATION ⚙️
  // Zde můžeš upravovat veškeré základní statistiky, mapu a hodnoty ve hře.
  // =========================================================================

  export const keys = {};
  window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; if(['w','a','s','d','tab','c','j','k','arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
  window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

  // action keys (non-repeat)
  window.addEventListener('keydown', e=>{
    if(e.repeat) return;
    const k = e.key.toLowerCase();
    const qKey = game.autoTarget ? 'j' : 'q';
    const eKey = game.autoTarget ? 'k' : 'e';
    
    if(k === qKey) { if(keys['shift']) { player && player.allocateSpellPoint && player.allocateSpellPoint('Q'); } else { player && player.castSpell && player.castSpell('Q'); } }
    if(k === eKey) { if(keys['shift']) { player && player.allocateSpellPoint && player.allocateSpellPoint('E'); } else { player && player.castSpell && player.castSpell('E'); } }
    if(k === 'b') toggleShop();
    if(k === 'u' && keys['shift']) { game.autoTarget = !game.autoTarget; flashMessage('Auto Target: ' + (game.autoTarget ? 'ON' : 'OFF')); }
    if(k === 'i' && keys['shift']) { game.autoPlay = !game.autoPlay; flashMessage('Auto Play: ' + (game.autoPlay ? 'ON' : 'OFF')); }
    if(k === 'v' && keys['shift']) { game.showDebug = !game.showDebug; flashMessage('Debug View: ' + (game.showDebug ? 'ON' : 'OFF')); }
  });

  export const mouse = { sx:0, sy:0, down:false, wx:0, wy:0 };
  canvas.addEventListener('mousemove', e=>{ const r = canvas.getBoundingClientRect(); mouse.sx = e.clientX - r.left; mouse.sy = e.clientY - r.top; });
  window.addEventListener('mousedown', ()=> mouse.down = true);
  window.addEventListener('mouseup', ()=> mouse.down = false);

  // 🛠️ DEV TOOL: Získání souřadnic kliknutím (SHIFT + Levý klik) s popiskem
  window.savedMapCoords = [];
  canvas.addEventListener('mousedown', (e)=>{
    if(keys['shift']) {
      const mw = screenToWorld(mouse.sx, mouse.sy);
      const rx = Math.round(mw.x);
      const ry = Math.round(mw.y);
      setTimeout(() => {
        const desc = prompt(`Bod zaměřen na X: ${rx}, Y: ${ry}\nZadej popis pro tento bod (ESC pro zrušení):`);
        if (desc !== null) {
          window.savedMapCoords.push({ label: desc, x: rx, y: ry });
          console.clear();
          console.log("👇 ZKOPÍRUJ TENTO TEXT A POŠLI MI HO 👇");
          console.log(JSON.stringify(window.savedMapCoords, null, 2));
          flashMessage(`Uloženo: ${desc}`);
        }
      }, 10); // setTimeout aby prompt nezasekl animaci kliknutí
    }
  });

  export function screenToWorld(sx, sy){ return { x: camera.x + sx / camera.scale, y: camera.y + sy / camera.scale }; }

  export function drawHealthBar(ctx, hp, maxHp, x, y, team) {
    const boxes = 5; let f = Math.max(0, Math.min(boxes, Math.round((Math.max(0, hp) / maxHp) * boxes) || 0));
    let bar = '[' + '|'.repeat(f) + ' '.repeat(boxes - f) + ']';
    ctx.font = '10px monospace'; ctx.fillStyle = team === 0 ? '#4da6ff' : (team === 1 ? '#ff6b6b' : '#999');
    ctx.fillText(bar, x, y);
  }

  export function applyDamage(target, amount, type, sourceId, isNetwork = false) {
    if(!target || target.dead || target.hp <= 0) return 0;
    if(target.invulnerableTimer > 0 && type !== 'true') {
        game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, "IMMUNE"));
        return 0;
    }
    let multiplier = 1;
    let arm = target.armor || 0; let mr = target.mr || 0;
    if(target.hasPowerup) { arm *= 1.2; mr *= 1.2; }
    if(target.defBuffTimer > 0) { arm += 50; mr += 50; }
    if (type === 'physical') multiplier = 100 / (100 + arm);
    else if (type === 'magical') multiplier = 100 / (100 + mr);
    else if (type === 'true') multiplier = 1; // Pure damage (Fountain laser)
    
    // OPRAVA: Host posílá striktní zprávu o poškození minionů pouze proti lidským hráčům (Boti se posílají rovnou celí přes host_state prevence zdvojení).
    if (socket && game.isHost && !isNetwork) {
      if (sourceId === 'minion' && target instanceof Player && !(target instanceof BotPlayer)) {
         socket.emit('host_event', { type: 'damage', targetId: target.id, amount: amount, dmgType: type, sourceId: sourceId });
      }
    }

    const actualDamage = Math.round(amount * multiplier);
    target.hp -= actualDamage; target.flashTimer = 0.1;
    if (actualDamage > 0) game.damageNumbers.push(new DamageNumber(target.pos.x, target.pos.y-6, actualDamage));
    
    // PŘIDÁNO: Centrální registrace mrtvých minionů pro prevenci "duchů" a falešných duplicitních zisků goldů
    if (target instanceof Minion && target.hp <= 0) {
        if (!game.deadMinionIds) game.deadMinionIds = new Set();
        game.deadMinionIds.add(target.id);
    }

    // TRACKOVÁNÍ STATISTIK A ASISTENCÍ
    let sourcePlayer = game.players.find(p => p.id === sourceId);
    if (sourcePlayer && sourcePlayer.stats) sourcePlayer.stats.dmgDealt += actualDamage;
    if (target.stats) target.stats.dmgTaken += actualDamage;
    if (target instanceof Player && sourcePlayer && sourcePlayer.team !== target.team) {
        target.recentAttackers.set(sourceId, performance.now());
    }

    return actualDamage;
  }

  export function handlePlayerKill(victim, killerId) {
      victim.hp = 0; if (victim.die) victim.die(); else victim.dead = true;
      let killer = game.players.find(p => p.id === killerId);
      
      let killerName = killer ? killer.className : (killerId === 'laser' ? 'Laser' : 'Minion');
      let killerTeam = killer ? killer.team : -1;
      if (game.killFeed) game.killFeed.push({ killer: killerName, victim: victim.className || 'Player', killerTeam: killerTeam, victimTeam: victim.team, timer: 5.0 });
      
      // SÍŤOVÁ SYNCHRONIZACE: Pošleme kill ostatním hráčům, aby ho viděli i ti na druhé straně mapy
      if (socket && (victim === player || (game.isHost && victim instanceof BotPlayer))) {
          socket.emit('broadcast_kill', { killer: killerName, victim: victim.className || 'Player', killerTeam: killerTeam, victimTeam: victim.team });
      }

      if (killer) { killer.gold += 150; killer.totalGold += 150; killer.exp += 50; killer.kills++; }
      let now = performance.now();
      if (victim.recentAttackers) {
          victim.recentAttackers.forEach((time, attackerId) => {
              if (attackerId !== killerId && (now - time) < 10000) {
                  let assister = game.players.find(p => p.id === attackerId);
                  if (assister && assister.team !== victim.team) { assister.assists++; assister.gold += 50; assister.totalGold += 50; assister.exp += 25; }
              }
          });
          victim.recentAttackers.clear();
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
  
  export function startGame(playerClass, playerTeam = 0, isSpectator = false) {
    game.players = []; game.minions = []; game.projectiles = [];
    game.isSpectator = isSpectator;
    game.isHost = true; // Důležité: Aby boti a hra nečekali na síťové příkazy!
    
    const classKeys = Object.keys(CLASSES);
    function shuffle(arr) { let a=arr.slice(); for(let i=a.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
    
    let blueClasses = shuffle(classKeys);
    let redClasses = shuffle(classKeys);
    
    if (!isSpectator) {
        if (playerTeam === 0) blueClasses = blueClasses.filter(c => c !== playerClass);
        else redClasses = redClasses.filter(c => c !== playerClass);

        player = new Player(spawnPoints[playerTeam].x, spawnPoints[playerTeam].y, { team: playerTeam, id:'player0', className: playerClass });
        game.players.push(player);
    } else {
        player = null;
        camera.x = world.width / 2;
        camera.y = world.height / 2;
    }

    const getBotLane = (idx) => { if(idx <= 3) return 'top'; if(idx === 4) return 'bottom'; return Math.random() > 0.5 ? 'top' : 'bottom'; };

    let blueBotCount = (!isSpectator && playerTeam === 0) ? 4 : 5;
    for (let i = 1; i <= blueBotCount; i++) {
        const c = blueClasses.pop();
        let bot = new BotPlayer(spawnPoints[0].x + Math.random()*50, spawnPoints[0].y + Math.random()*50, {team:0, id:'bot0_'+i, className: c, lane: getBotLane(i)});
        game.players.push(bot);
    }
    let redBotCount = (!isSpectator && playerTeam === 1) ? 4 : 5;
    for (let i = 1; i <= redBotCount; i++) {
        const c = redClasses.pop();
        let bot = new BotPlayer(spawnPoints[1].x + Math.random()*50, spawnPoints[1].y + Math.random()*50, {team:1, id:'bot1_'+i, className: c, lane: getBotLane(i)});
        game.players.push(bot);
    }

    game.started = true;
    updateSpellLabels();

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

    const classKeys = Object.keys(CLASSES);
    function shuffle(arr) { let a=arr.slice(); for(let i=a.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
    let blueClasses = shuffle(classKeys); let redClasses = shuffle(classKeys);
    
    let humansBlue = 0; let humansRed = 0;

    Object.values(playersData).forEach(pData => {
        let p = new Player(spawnPoints[pData.team].x, spawnPoints[pData.team].y, { team: pData.team, id: pData.id, className: pData.className });
        game.players.push(p);
        if (pData.team === 0) { humansBlue++; blueClasses = blueClasses.filter(c => c !== pData.className); }
        else { humansRed++; redClasses = redClasses.filter(c => c !== pData.className); }
        if (socket && pData.id === socket.id) { player = p; }
    });

    const getBotLane = (idx) => { if(idx <= 3) return 'top'; if(idx === 4) return 'bottom'; return Math.random() > 0.5 ? 'top' : 'bottom'; };

    let blueBotCount = Math.max(0, 5 - humansBlue);
    for (let i = 1; i <= blueBotCount; i++) {
        let bot = new BotPlayer(spawnPoints[0].x + Math.random()*50, spawnPoints[0].y + Math.random()*50, {team:0, id:'bot0_'+i, className: blueClasses.pop(), lane: getBotLane(i)});
        game.players.push(bot);
    }
    let redBotCount = Math.max(0, 5 - humansRed);
    for (let i = 1; i <= redBotCount; i++) {
        let bot = new BotPlayer(spawnPoints[1].x + Math.random()*50, spawnPoints[1].y + Math.random()*50, {team:1, id:'bot1_'+i, className: redClasses.pop(), lane: getBotLane(i)});
        game.players.push(bot);
    }

    game.started = true; updateSpellLabels();
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
      let r = minE * 0.15;
      let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
      sorted.forEach(p=>{ minX=Math.min(minX, p.x); maxX=Math.max(maxX, p.x); minY=Math.min(minY, p.y); maxY=Math.max(maxY, p.y); });
      game.walls.push({ pts: sorted, r, bbox: {minX, maxX, minY, maxY} });
    };
    rawPolys.forEach(pts => {
      let smoothed = smoothPolygon(pts, 2); // Vyhlazení rohů všech vnitřních zdí v aréně
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

  export function buyItem(id){ if(!player) return; const it = shopItems.find(x=>x.id===id); if(!it) return; const allyBaseDist = dist(player.pos, spawnPoints[player.team]); if (allyBaseDist > 250 && player.alive) { return flashMessage('Shop available only in your base!'); } 
  if (player.items.length >= 25) { return flashMessage('Inventory is full! (Max 25)'); } if(player.gold < it.cost){ return flashMessage('Not enough gold'); } player.gold -= it.cost; player.items.push(it.id); it.apply(player); flashMessage('Bought '+it.name); updateInventory(); populateShop(); }
  export function flashMessage(txt){ const el = document.createElement('div'); el.style.position='fixed'; el.style.left='50%'; el.style.top='18px'; el.style.transform='translateX(-50%)'; el.style.background='rgba(255,255,255,0.06)'; el.style.padding='6px 10px'; el.style.borderRadius='6px'; el.style.zIndex=120; el.textContent = txt; document.body.appendChild(el); setTimeout(()=>el.remove(),1200); }

  function update(dt){ if(game.gameOver || !game.started) return;
    if(game.startDelay > 0) game.startDelay -= dt;

    // update mouse world
    const mw = screenToWorld(mouse.sx, mouse.sy); mouse.wx = mw.x; mouse.wy = mw.y;

    for(let p of game.players) p.update(dt);
    for(let p of game.projectiles) p.update(dt);
    for(let m of game.minions) m.update(dt);
    for(let d of game.damageNumbers) d.update(dt);
    for(let t of game.towers) t.update(dt);
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

    if (game.shake > 0) game.shake -= dt;
    game.passiveTimer = (game.passiveTimer || 0) + dt;
    if (game.startDelay <= 0 && game.passiveTimer >= 1.0) { game.passiveTimer -= 1.0; for(let p of game.players) { p.gold += 2; p.totalGold += 2; p.exp += 1; } }

    if (game.killFeed) {
        game.killFeed.forEach(k => k.timer -= dt);
        game.killFeed = game.killFeed.filter(k => k.timer > 0);
    }

    game.projectiles = game.projectiles.filter(p=>!p.dead);
    game.minions = game.minions.filter(m=>!m.dead);
    game.damageNumbers = game.damageNumbers.filter(d=>d.life>0);
    game.particles = game.particles.filter(p=>p.life>0);

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
      if(game.nexus[0] <= 0 && !game.gameOver){ game.gameOver = true; game.winner = 1; showEnd(game.winner); if(socket) socket.emit('host_event', {type:'game_over', winner: 1}); }
      if(game.nexus[1] <= 0 && !game.gameOver){ game.gameOver = true; game.winner = 0; showEnd(game.winner); if(socket) socket.emit('host_event', {type:'game_over', winner: 0}); }
    }

    // update camera to follow player or spectate
    if (game.isSpectator) {
        const camSpeed = 1500 * dt;
        if (keys['w']) camera.y -= camSpeed;
        if (keys['s']) camera.y += camSpeed;
        if (keys['a']) camera.x -= camSpeed;
        if (keys['d']) camera.x += camSpeed;
        const viewW = canvas.width / camera.scale; 
        const viewH = canvas.height / camera.scale;
        camera.x = clamp(camera.x, 0, Math.max(0, world.width - viewW));
        camera.y = clamp(camera.y, 0, Math.max(0, world.height - viewH));
    } else if (player) {
        const viewW = canvas.width / camera.scale; 
        const viewH = canvas.height / camera.scale;
        camera.x = clamp(player.pos.x - viewW/2, 0, Math.max(0, world.width - viewW));
        camera.y = clamp(player.pos.y - viewH/2, 0, Math.max(0, world.height - viewH));
    }

    // SÍŤOVÁ SYNCHRONIZACE POZICE
    if (socket) {
        if (player) {
            game.syncTimer = (game.syncTimer || 0) + dt;
            if (game.syncTimer >= 0.05) {
                game.syncTimer = 0;
                socket.emit('player_update', { 
                    x: player.pos.x, y: player.pos.y, hp: player.hp, alive: player.alive, aimAngle: player.aimAngle,
                    level: player.level, maxHp: player.maxHp, kills: player.kills, deaths: player.deaths, assists: player.assists, gold: player.totalGold, items: player.items.length,
                    AD: player.AD, AP: player.AP, armor: player.armor, mr: player.mr, speed: player.speed, attackSpeed: player.attackSpeed, abilityHaste: player.abilityHaste,
                    invTimer: player.invulnerableTimer, defTimer: player.defBuffTimer,
                    qLvl: player.spells.Q.level, eLvl: player.spells.E.level,
                    stats: player.stats
                });
            }
        }
        
        // HOST SYNCHRONIZUJE STAV BOTŮ A MINIONŮ (cca 10x za sekundu)
        if (game.isHost) {
            game.hostSyncTimer = (game.hostSyncTimer || 0) + dt;
            if (game.hostSyncTimer >= 0.1) {
                game.hostSyncTimer = 0;
                socket.emit('host_state', {
                    bots: game.players.filter(p => p instanceof BotPlayer).map(b => ({
                        id: b.id, className: b.className, x: b.pos.x, y: b.pos.y, hp: b.hp, alive: b.alive, aimAngle: b.aimAngle,
                        level: b.level, maxHp: b.maxHp, kills: b.kills, deaths: b.deaths, assists: b.assists, gold: b.totalGold,
                        AD: b.AD, AP: b.AP, armor: b.armor, mr: b.mr, speed: b.speed, attackSpeed: b.attackSpeed, abilityHaste: b.abilityHaste,
                        invTimer: b.invulnerableTimer, defTimer: b.defBuffTimer,
                        qLvl: b.spells.Q.level, eLvl: b.spells.E.level,
                        stats: b.stats
                    })),
                    minions: game.minions.map(m => ({id: m.id, x: m.pos.x, y: m.pos.y, hp: m.hp, dead: m.dead, team: m.team, targetIndex: m.targetIndex})),
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
      
      const steps = game.isSpectator ? 2 : 1;
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
