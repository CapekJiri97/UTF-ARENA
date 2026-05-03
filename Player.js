import { dist, distToPoly, expForLevel } from './Utils.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { shopItems } from './items.js';
import { game, TEAM_COLOR, NEUTRAL_COLOR, RANGED_ATTACK_RANGE, MELEE_ATTACK_RANGE, BOT_WEIGHTS } from './State.js';
import { world, spawnPoints, mapBoundary } from './MapConfig.js';
import { Particle, spawnParticles, EffectText } from './Effects.js';
import { Projectile, Minion } from './Entities.js';
import { socket, applyDamage, applyHeal, handlePlayerKill, moveEntityWithCollision, drawHealthBar, flashMessage, player, keys, buyItem, mouse, grantRewards } from './main.js';
import { updateSpellLabels } from './UI.js';
import { playSound } from './Audio.js';

export class Player{
  constructor(x,y,opts={}){
    this.pos = {x,y}; this.vel = {x:0,y:0}; this.radius = 12;
    this.className = opts.className || 'Bruiser'; const cData = CLASSES[this.className];
    this.speed = cData.speed;
    this.glyph = cData.glyph; this.team = opts.team||0; this.id = opts.id||'player0';
    this.alive = true; this.respawnTimer = 0; this.respawnTime = 5;
    this.flashTimer = 0;
    this.dmgType = cData.dmgType;
    this.shield = 0;
    this.silenceTimer = 0;
    this.stunTimer = 0;
    this.shieldTimer = 0;
    this.reaperCharge = 0; // Stacky posílených útoků
    this.reaperTimer = 0;

    // stats
    this.maxHp = cData.hp; this.hp = this.maxHp; this.hpRegen = cData.hpRegen || 2.0; 
    this.AD = cData.baseAD; this.AP = cData.baseAP; this.attackSpeed = 1.0; this.abilityHaste = 0; this.armor = cData.baseArmor; this.mr = cData.baseMR;
    
    // economy & stats
    this.gold = 600; this.totalGold = 600; this.kills = 0; this.deaths = 0; this.assists = 0;

    this.summonerSpell = opts.summonerSpell || 'Heal';
    this.summonerCooldown = 0;
    this.boostTimer = 0;
    this.rallyTimer = 0;
    this.slowTimer = 0;
    
    this.invulnerableTimer = 0;
    this.regenBuffTimer = 0;
    this.regenBuffAmount = 0;
    this.hanaBuffTimer = 0;
    this.defBuffTimer = 0;
    this.adAsBuffTimer = 0;
    this.adAsBuffAmount = 0;
    this.hasPowerup = false; this.powerupTimer = 0;
    this.stats = { dmgDealt: 0, dmgTaken: 0, hpHealed: 0 };
    this.recentAttackers = new Map();

    this.isDirty = true; // Příznak pro síťovou optimalizaci
    // progression
    this.level = 1; this.exp = 0; this.totalExp = 0; this.spellPoints = 0;

    this.levelUpTimer = 0;
    // spells
    this.spells = {
      Q: { ...cData.Q, cd: 0, level: 1 },
      E: { ...cData.E, cd: 0, level: 1 }
    };

    
    this.castingTimeRemaining = 0;
    this.castingTimeTotal = 0;
    this.dashTimer = 0; this.dashVel = {x:0, y:0}; this.dashEndExplosion = null;
    this.knockbackTimer = 0; this.knockbackVel = {x:0, y:0};
    this.msBuffTimer = 0; this.msBuffAmount = 0;

    // basic attack


    // basic attack
    this.attackCooldown = 0; this.attackDelay = cData.attackDelay; this.range = cData.range;
    this.attackRange = cData.attackRange || (this.range ? RANGED_ATTACK_RANGE : MELEE_ATTACK_RANGE);

    this.aimAngle = 0; // Uchovává směr, kam hráč míří

    this.items = [];
    
    this.macroOrder = null; // Rozkaz od Centrálního Mozku (pro UI nebo boty)
    
    this.role = cData.role || 'FIGHTER';
  }

  get effectiveMaxHp() { return Math.round(this.maxHp * (this.hasPowerup ? 1.2 : 1.0)); }

  computeSpellCooldown(spKey){ const sp = this.spells[spKey]; const base = sp.baseCooldown; const hasteFactor = 100 / (100 + this.abilityHaste); const levelFactor = Math.pow(0.95, sp.level-1); return Math.max(1.0, base * hasteFactor * levelFactor); }

  die(){ 
    this.alive = false; this.hasPowerup = false; 
    
    this.shield = 0; this.shieldExplodeData = null;
    this.dashTimer = 0; this.dashEndExplosion = null;
    this.castingTimeRemaining = 0; this.knockbackTimer = 0;
    this.castingTimeTotal = 0; this.shieldTimer = 0;
    this.silenceTimer = 0; this.slowTimer = 0; this.msBuffTimer = 0;
    this.stunTimer = 0;
    this.hanaBuffTimer = 0; this.adAsBuffTimer = 0; this.defBuffTimer = 0;
    this.invulnerableTimer = 0; this.boostTimer = 0; this.rallyTimer = 0;
    this.reaperCharge = 0; this.reaperTimer = 0;

    // PŘIDÁNO: Odpočet se musí nastavit pro všechny, aby i klient lokálně správně čekal a poslal scoreboard status
    this.deaths++; this.respawnTimer = (CLASSES[this.className].respawnBase || 7) + this.level * (CLASSES[this.className].respawnPerLevel || 1);
    console.log(`[DEBUG] ${this.id} died. Respawning in ${this.respawnTimer}s.`); 
    if(player && this.id === player.id) { game.shake = 0.5; flashMessage('You died — respawning...'); } 
  }
  revive(){ 
    this.alive = true; this.respawnTimer = 0;
    // OPRAVA: Zdraví a pozice do základny se musí resetovat lokálně všem hráčům! Nejen Hostovi.
    this.hp = this.effectiveMaxHp; const sp = spawnPoints[this.team]; if(sp) { this.pos.x = sp.x; this.pos.y = sp.y; this.targetPos = null; }
    console.log(`[DEBUG] ${this.id} revived.`); 
  }

  allocateSpellPoint(spKey){ 
      if(this.spellPoints<=0) return false; 
      const sp = this.spells[spKey]; 
      const otherKey = spKey === 'Q' ? 'E' : 'Q';
      const otherSp = this.spells[otherKey];
      if(!sp || !otherSp) return false; 
      
      // Maximální poměr levelů mezi spelly může být 2.5 ku 1
      if ((sp.level + 1) / otherSp.level > 2.5) {
          if (this === player) flashMessage(`Max ratio 2.5:1 reached! Level up ${otherKey} first.`);
          return false;
      }

      if (!socket || game.isHost || this === player) { sp.level += 1; this.spellPoints -= 1; this.isDirty = true; } 
      updateSpellLabels(); 
      return true;
  }

  levelUp(){
    if (this === player) playSound('levelup');
    if (!socket || game.isHost || this === player) { this.level += 1; this.spellPoints += 1; this.maxHp += 15; this.hp = Math.min(this.effectiveMaxHp, this.hp + 15); this.AD += 1; this.AP += 1; this.isDirty = true; }
    this.levelUpTimer = 2.0; spawnParticles(this.pos.x, this.pos.y, 25, '#ffcc00', {speed: 120, life: 1.0});
    console.log(`[DEBUG] ${this.id} leveled up to ${this.level}`); 
  }

  update(dt){ if(game.gameOver) return;
    // handle death/respawn
    if(!this.alive){
        // Odpočet respawnu probíhá jen na Hostovi nebo pro lokálního hráče, ne pro cizí hráče po síti!
        if (!socket || game.isHost || this === player) {
            this.respawnTimer -= dt; if(this.respawnTimer <= 0) this.revive();
        }
        return;
    }
    
    if(this.silenceTimer > 0) this.silenceTimer -= dt;
    if(this.stunTimer > 0) this.stunTimer -= dt;
    if(this.shieldTimer > 0) {
        this.shieldTimer -= dt;
        if (this.shieldTimer <= 0 && !this.shieldExplodeData) this.shield = 0;
    }
    if(this.hanaBuffTimer > 0) this.hanaBuffTimer -= dt;
    if(this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if(this.defBuffTimer > 0) this.defBuffTimer -= dt;
    if(this.adAsBuffTimer > 0) this.adAsBuffTimer -= dt;
    if(this.summonerCooldown > 0) this.summonerCooldown -= dt;
    if(this.boostTimer > 0) this.boostTimer -= dt;
    if(this.rallyTimer > 0) this.rallyTimer -= dt;
    if(this.slowTimer > 0) this.slowTimer -= dt;
    if(this.reaperCharge > 0) {
        this.reaperTimer -= dt;
        if(this.reaperTimer <= 0) this.reaperCharge = 0;
    }

    if(this.regenBuffTimer > 0) {
        this.regenBuffTimer -= dt;
        if (this === player || (!socket || game.isHost)) { this.hp = Math.min(this.effectiveMaxHp, this.hp + this.regenBuffAmount * dt); }
        if (Math.random() < 0.1) spawnParticles(this.pos.x, this.pos.y, 1, '#0f0', {life: 0.3});
    }
    
    if(this.flashTimer > 0) this.flashTimer -= dt;

    if (this.shieldExplodeData) {
        this.shieldExplodeData.timer -= dt;
        if (this.shieldExplodeData.timer <= 0 || this.shield <= 0) {
            let expl = this.shieldExplodeData;
            game.particles.push(new Particle(this.pos.x, this.pos.y, '#aaa', {shape: 'ring', radius: expl.radius, life: 0.4, speed: 0, lineWidth: 4}));
            for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= expl.radius){ applyDamage(m, expl.damage, expl.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } } }
            for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= expl.radius){ applyDamage(p, expl.damage, expl.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } }
            spawnParticles(this.pos.x, this.pos.y, 10, '#aaa');
            this.shieldExplodeData = null;
            this.shield = 0;
        }
    }

    if(this.hasPowerup) {
        this.powerupTimer -= dt;
        if(this.powerupTimer <= 0) this.hasPowerup = false;
    }

    const allyBaseDist = dist(this.pos, spawnPoints[this.team]);

    if (this === player) {

        // AUTO BUY
        if (game.autoPlay && game.autoBuy && (!this.alive || allyBaseDist < 250) && this.gold >= 300 && this.items.length < 25) {
            let itemToBuy = null;
            if (!this.hasBoots && this.gold >= 300) itemToBuy = shopItems.find(it => it.id === 'boots');
            else {
                let enemyPhys = 0, enemyMag = 0;
                const enemies = game.players.filter(p => p.team !== this.team);
                for (let e of enemies) { if (e.dmgType === 'physical') enemyPhys++; else enemyMag++; }

                let pool = [];
                const isTank = this.role === 'TANK';
                const isFighter = this.role === 'FIGHTER' || this.role === 'SPLITPUSHER';
                const isMageSupport = this.role === 'SUPPORT' || (this.role === 'SLAYER' && this.dmgType === 'magical') || (this.role === 'SPLITPUSHER' && this.dmgType === 'magical');
                
                if (isTank) {
                    pool.push('hp', 'hp');
                    if (enemyPhys >= enemyMag) pool.push('armor', 'armor');
                    if (enemyMag >= enemyPhys) pool.push('mr', 'mr');
                } else if (isFighter) {
                    pool.push('hp');
                    if (this.dmgType === 'magical') pool.push('ap', 'ah'); else pool.push('ad', 'ah'); 
                    if (enemyPhys > enemyMag) pool.push('armor'); else if (enemyMag > enemyPhys) pool.push('mr');
                } else if (isMageSupport) {
                    pool.push('ap', 'ap', 'ah', 'ah'); if (Math.random() < 0.25) pool.push('hp'); 
                } else { 
                    if (this.role === 'SLAYER' && this.range) pool.push('ad', 'ad', 'as'); else pool.push('ad', 'ad', 'ah'); 
                    if (Math.random() < 0.2) pool.push(enemyPhys > enemyMag ? 'armor' : 'mr');
                }
                let chosenId = pool[Math.floor(Math.random() * pool.length)];
                itemToBuy = shopItems.find(it => it.id === chosenId);
            }
            if (itemToBuy && this.gold >= itemToBuy.cost) buyItem(itemToBuy.id); // buyItem handles gold/item changes
        }
    }

    // Passive HP Regen (Host počítá i pro síťové hráče pro synchronizaci, lokální hráč počítá sám pro plynulost)
    if (!socket || game.isHost || this === player) {
        if(this.hp < this.effectiveMaxHp) this.hp = Math.min(this.effectiveMaxHp, this.hp + this.hpRegen * dt);
    }

    // Fountain Logic (Heal in own base, Laser in enemy base) - Host-only
    if (!socket || game.isHost) {
        // Fountain Logic (Heal in own base, Laser in enemy base)
        if (allyBaseDist < 200) this.hp = Math.min(this.effectiveMaxHp, this.hp + (this.effectiveMaxHp * 0.15 * dt));
        const enemyBaseDist = dist(this.pos, spawnPoints[1-this.team]);
        if (enemyBaseDist < 200) { applyDamage(this, 1000 * dt, 'true', 'laser'); if(this.hp<=0) handlePlayerKill(this, 'laser'); }
    }

    if(this.msBuffTimer > 0) this.msBuffTimer -= dt;

    // movement
    if(this.attackPenaltyTimer > 0) this.attackPenaltyTimer -= dt;
    let dx=0, dy=0, l=0;
    if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        moveEntityWithCollision(this, this.dashVel.x, this.dashVel.y, dt);
        if (Math.random() < 0.4) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2}); // Trail efekt
            if (Math.random() < 0.4 && Math.hypot(this.dashVel.x, this.dashVel.y) > 250) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2}); // Trail efekt jen pro rychlé dashe
        if (this.dashTimer <= 0 && this.dashEndExplosion) {
           const expl = this.dashEndExplosion; const range = expl.radius;
           game.particles.push(new Particle(this.pos.x, this.pos.y, '#f80', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
           for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, expl.damage, expl.dmgType, expl.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } } }
           for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, expl.damage, expl.dmgType, expl.id); if (expl.silenceDuration) { p.silenceTimer = Math.max(p.silenceTimer || 0, expl.silenceDuration); game.effectTexts.push(new EffectText(p.pos.x, p.pos.y-20, "SILENCED", '#fff')); } if (expl.slowDuration) { p.slowTimer = Math.max(p.slowTimer || 0, expl.slowDuration); p.slowMod = expl.slowMod || 0.6; } spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, expl.id); } } }
           spawnParticles(this.pos.x, this.pos.y, 10, '#f80');
           this.dashEndExplosion = null;
        }
    } else if (this.knockbackTimer > 0) {
        this.knockbackTimer -= dt;
        moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt);
    } else {
        if (this === player) { // PŘIDÁNO: Zabráníme aplikaci lokálních WASD na cizí hráče
            if(keys['w']) dy-=1; if(keys['s']) dy+=1; if(keys['a']) dx-=1; if(keys['d']) dx+=1; l = Math.hypot(dx,dy);
            let moveSpeed = this.speed * (this.hasPowerup ? 1.2 : 1.0) * (this.msBuffTimer > 0 ? (1 + this.msBuffAmount) : 1.0) * (this.slowTimer > 0 ? (this.slowMod || 0.6) : 1.0);
            if(this.castingTimeRemaining > 0) moveSpeed *= 0.3; // 70% slow během castingu!
            if(this.attackPenaltyTimer > 0) moveSpeed *= 0.8;
            if(this.stunTimer > 0) moveSpeed = 0;
            if(l>0){ dx/=l; dy/=l; this.vel.x = dx*moveSpeed; this.vel.y = dy*moveSpeed; } else { this.vel.x = 0; this.vel.y = 0; }
            moveEntityWithCollision(this, this.vel.x, this.vel.y, dt);
        } else if (this.targetPos) { // Logika pro ostatní (síťové) hráče
            // Interpolace pohybu síťových hráčů pro plynulost na Hostovi i u Klientů
            if (dist(this.pos, this.targetPos) > 200) { this.pos.x = this.targetPos.x; this.pos.y = this.targetPos.y; } // Pokud se teleportnul (např. po respawnu), tak přeskočí
            else { this.pos.x += (this.targetPos.x - this.pos.x) * 15 * dt; this.pos.y += (this.targetPos.y - this.pos.y) * 15 * dt; }
        }
    }

    // Neviditelná bariéra během odpočtu (zabrání opuštění spawnu)
    if (game.startDelay > 0) {
      const sp = spawnPoints[this.team]; const d = dist(this.pos, sp);
      if (d > 190) { const a = Math.atan2(this.pos.y - sp.y, this.pos.x - sp.x); this.pos.x = sp.x + Math.cos(a)*190; this.pos.y = sp.y + Math.sin(a)*190; }
    }

    // aiming (Twin-stick style)
    let isManualAim = false;
    let intendedAngle = this.aimAngle;
    if (this === player) {
        let ax=0, ay=0; if(keys['arrowup']) ay-=1; if(keys['arrowdown']) ay+=1; if(keys['arrowleft']) ax-=1; if(keys['arrowright']) ax+=1;
        if(ax!==0 || ay!==0) { intendedAngle = Math.atan2(ay, ax); isManualAim = true; } // Míření šipkami
        else if (game.mouseTarget) { intendedAngle = Math.atan2(mouse.wy - this.pos.y, mouse.wx - this.pos.x); isManualAim = true; }
        else if(l>0) intendedAngle = Math.atan2(dy, dx); // Pokud nedrží šipky, míří tam, kam jde
    }

    // --- Aim Assist (Auto-Targeting with Player Priority) ---
    if (this === player && !game.mouseTarget) {
      let bestTarget = null;
      const maxD = this.attackRange + 100;
      const use360 = game.autoTarget;
      const maxAngleDiff = 35 * Math.PI / 180;

      // First, check for players in the cone
      let minPlayerDist = Infinity;
      const playerTargets = game.players.filter(p => p.team !== this.team && p.alive);
      for (const t of playerTargets) {
          const d = dist(this.pos, t.pos);
          if (d < maxD) {
              const angleTo = Math.atan2(t.pos.y - this.pos.y, t.pos.x - this.pos.x);
              const diff = Math.abs(Math.atan2(Math.sin(angleTo - intendedAngle), Math.cos(angleTo - intendedAngle)));
              if ((use360 || diff < maxAngleDiff) && d < minPlayerDist) { minPlayerDist = d; bestTarget = t; }
          }
      }

      // If no player is targeted, check for minions
      if (!bestTarget) {
          let minMinionDist = Infinity;
          const minionTargets = game.minions.filter(m => m.team !== this.team && !m.dead);
          for (const t of minionTargets) {
              const d = dist(this.pos, t.pos);
              if (d < maxD) {
                  const angleTo = Math.atan2(t.pos.y - this.pos.y, t.pos.x - this.pos.x);
                  const diff = Math.abs(Math.atan2(Math.sin(angleTo - intendedAngle), Math.cos(angleTo - intendedAngle)));
                  if ((use360 || diff < maxAngleDiff) && d < minMinionDist) { minMinionDist = d; bestTarget = t; }
              }
          }
      }

      if (bestTarget) {
          let tx = bestTarget.pos.x;
          let ty = bestTarget.pos.y;
          if (bestTarget.vel && (Math.abs(bestTarget.vel.x) > 5 || Math.abs(bestTarget.vel.y) > 5)) {
              let d = dist(this.pos, bestTarget.pos);
              let pSpeed = this.range ? 800 : 1000;
              let travelTime = d / pSpeed;
              tx += bestTarget.vel.x * travelTime;
              ty += bestTarget.vel.y * travelTime;
          }
          intendedAngle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
      }
      this.currentTarget = bestTarget; // Uložení pro vykreslení HUD
    } else if (this === player && game.mouseTarget) {
      let hoverTarget = null;
      let minDist = 80; // Zóna okolo kurzoru myši pro zachycení cíle
      const potentialTargets = [...game.players.filter(p => p.team !== this.team && p.alive), ...game.minions.filter(m => m.team !== this.team && !m.dead)];
      for (const t of potentialTargets) {
          const d = dist({x: mouse.wx, y: mouse.wy}, t.pos);
          if (d < minDist) { minDist = d; hoverTarget = t; }
      }
      this.currentTarget = hoverTarget;
    }

    // Pokud nemáme žádný cíl (nepřítele), ukážeme v HUDu nejbližšího spojence
    if (this === player && !this.currentTarget) {
        let nearestAlly = null;
        let minAllyDist = Infinity;
        for (let p of game.players) {
            if (p.team === this.team && p !== this && p.alive) {
                const d = dist(this.pos, p.pos);
                if (d < minAllyDist) { minAllyDist = d; nearestAlly = p; }
            }
        }
        this.currentTarget = nearestAlly;
    }

    if (this === player) {
      // Aplikujeme plynulé otáčení (nebo okamžité při manuálním míření šipkami/myší)
      if (isManualAim) {
          this.aimAngle = intendedAngle;
      } else {
          let diff = intendedAngle - this.aimAngle;
          while (diff <= -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          const maxTurn = 7.5 * dt; // Plynulé otáčení zaměřovače (cca 430° za vteřinu)
          if (Math.abs(diff) < maxTurn) this.aimAngle = intendedAngle;
          else this.aimAngle += Math.sign(diff) * maxTurn;
      }
    }

    // basic attack
    if(this.attackCooldown>0) this.attackCooldown -= dt;
    let wantAttack = keys[' '];
    if (this === player && game.mouseTarget && mouse.down) wantAttack = true;
    if (this === player && game.autoPlay && this.currentTarget && this.currentTarget.hp > 0 && !this.currentTarget.dead && this.currentTarget.team !== this.team) {
        const d = dist(this.pos, this.currentTarget.pos);
        const atkRange = this.attackRange + 20;
        // Autoplay počká na plynulé dotočení crosshairu k cíli, než vystřelí (zamezuje střelbě naprázdno do zdi)
        let targetAngle = Math.atan2(this.currentTarget.pos.y - this.pos.y, this.currentTarget.pos.x - this.pos.x);
        let diff = Math.abs(Math.atan2(Math.sin(targetAngle - this.aimAngle), Math.cos(targetAngle - this.aimAngle)));
        if (d <= atkRange && diff < 0.3) wantAttack = true;
    }
    if (this.stunTimer > 0) wantAttack = false;
    let effAS = this.attackSpeed * (this.adAsBuffTimer > 0 ? 1 + this.adAsBuffAmount : 1.0);
    if (this.hanaBuffTimer > 0) effAS *= (this.spells.Q.bonusAsMult || 1.25);
    if(this === player && wantAttack && this.attackCooldown<=0){ this.shoot(this.pos.x + Math.cos(this.aimAngle)*100, this.pos.y + Math.sin(this.aimAngle)*100); this.attackCooldown = this.attackDelay / effAS; }

    // spells cooldowns
    for(let k of Object.keys(this.spells)){ const sp = this.spells[k]; if(sp.cd>0){ sp.cd = Math.max(0, sp.cd - dt); } }

    // casting timer
    if(this.castingTimeRemaining>0){ this.castingTimeRemaining -= dt; if(this.castingTimeRemaining<=0) this.castingTimeRemaining = 0; }

    if(this.levelUpTimer > 0) this.levelUpTimer -= dt;
    // leveling
    while(this.exp >= expForLevel(this.level)){
      this.exp -= expForLevel(this.level);
      this.levelUp();
    }
    if (this === player && game.autoPlay && this.spellPoints > 0) {
        while(this.spellPoints > 0) {
            let canQ = ((this.spells.Q.level + 1) / this.spells.E.level) <= 2.5;
            let canE = ((this.spells.E.level + 1) / this.spells.Q.level) <= 2.5;
            if (canQ && canE) this.allocateSpellPoint(Math.random() > 0.5 ? 'Q' : 'E');
            else if (canQ) this.allocateSpellPoint('Q');
            else if (canE) this.allocateSpellPoint('E');
            else break; // Pojistka proti záseku
        }
    }
  }

  draw(ctx){ if(!this.alive){ ctx.font = '20px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillText('✖', this.pos.x, this.pos.y); return; }
    ctx.font = '10px monospace'; ctx.fillStyle = TEAM_COLOR[this.team] || NEUTRAL_COLOR; ctx.fillText(`${this.className} LV${this.level}`, this.pos.x, this.pos.y - 25);
    ctx.font = '20px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle = this.flashTimer > 0 ? '#fff' : (TEAM_COLOR[this.team] || NEUTRAL_COLOR); ctx.fillText(this.glyph, this.pos.x, this.pos.y);
    // Zaměřovač (Crosshair)
    const cxAim = this.pos.x + Math.cos(this.aimAngle)*45; const cyAim = this.pos.y + Math.sin(this.aimAngle)*45;
    ctx.beginPath(); ctx.moveTo(this.pos.x + Math.cos(this.aimAngle)*20, this.pos.y + Math.sin(this.aimAngle)*20); ctx.lineTo(cxAim, cyAim); ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0f0'; ctx.font = 'bold 18px monospace'; ctx.fillText('+', cxAim, cyAim);
    drawHealthBar(ctx, this.hp, this.effectiveMaxHp, this.pos.x, this.pos.y + 18, this.team);
    if (this.castingTimeRemaining > 0 && this.castingTimeTotal > 0) {
        let castPct = 1.0 - (this.castingTimeRemaining / this.castingTimeTotal);
        let barW = 30; let barH = 4;
        let bx = this.pos.x - barW / 2; let by = this.pos.y + 24;
        ctx.fillStyle = '#222'; ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#0ff'; ctx.fillRect(bx, by, barW * castPct, barH);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, barW, barH);
    }
    if (this.shield > 0) {
        ctx.fillStyle = '#aaa';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`+${Math.floor(this.shield)}`, this.pos.x + 30, this.pos.y + 18);
    }
    
    if(this.hasPowerup) {
        ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius + 6, 0, Math.PI*2);
        ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Dynamické skládání aktivních status efektů nad sebou
    let statuses = [];
    if (this.silenceTimer > 0) statuses.push({ t: 'SILENCED', c: '#fff' });
    if (this.slowTimer > 0) statuses.push({ t: 'SLOWED', c: '#f55' });
    if (this.invulnerableTimer > 0) statuses.push({ t: 'IMMUNE', c: '#ffcc00' });
    if (this.shield > 0) statuses.push({ t: 'SHIELD', c: '#aaa' });
    if (this.stunTimer > 0) statuses.push({ t: 'STUNNED', c: '#ffcc00' });
    if (this.hasPowerup) statuses.push({ t: 'POWERUP', c: '#ffcc00' });
    if (this.msBuffTimer > 0) statuses.push({ t: 'SPEED UP', c: '#0ff' });
    if (this.boostTimer > 0) statuses.push({ t: 'BOOST', c: '#ff0' });
    if (this.rallyTimer > 0) statuses.push({ t: 'RALLY', c: '#f80' });
    if (this.defBuffTimer > 0) statuses.push({ t: 'DEFENSE', c: '#88f' });
    if (this.adAsBuffTimer > 0) statuses.push({ t: 'FRENZY', c: '#f00' });
    if (this.hanaBuffTimer > 0) statuses.push({ t: 'EMPOWERED', c: '#f0f' });
    if (this.reaperCharge > 0) statuses.push({ t: `EMPOWERED (${this.reaperCharge})`, c: '#800080' });
    
    let startY = this.pos.y - 38;
    ctx.font = 'bold 10px monospace';
    for (let i = 0; i < statuses.length; i++) {
        ctx.fillStyle = statuses[i].c;
        ctx.fillText(statuses[i].t, this.pos.x, startY - (i * 12));
    }

    if (this.levelUpTimer > 0) {
      ctx.save(); ctx.globalAlpha = Math.max(0, this.levelUpTimer / 2.0); ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'center';
      ctx.fillText('LEVEL UP!', this.pos.x, this.pos.y - 35 - (2.0 - this.levelUpTimer)*25); ctx.restore();
    }
  }

  castSummonerSpell(isNetwork = false) {
      if (this.summonerSpell !== 'Revive' && !this.alive) return;
      if (this.summonerSpell === 'Revive' && this.alive) return;
      if (!isNetwork && this.summonerCooldown > 0) return;
      if (!isNetwork && this.stunTimer > 0) return;

      if (socket && !isNetwork) {
          if (this === player || (game.isHost && this instanceof BotPlayer)) {
              socket.emit('player_action', { type: 'summoner', id: this.id });
          }
      }

      this.summonerCooldown = SUMMONER_SPELLS[this.summonerSpell].cd;

      game.effectTexts.push(new EffectText(this.pos.x, this.pos.y - 30, this.summonerSpell, '#ffcc00'));

      switch(this.summonerSpell) {
          case 'Heal': applyHeal(this, 150 + this.level * 20); spawnParticles(this.pos.x, this.pos.y, 25, '#0f0', {speed: 150}); break;
          case 'Ghost': this.msBuffTimer = 5.0; this.msBuffAmount = 0.4; spawnParticles(this.pos.x, this.pos.y, 25, '#0ff', {speed: 150}); break;
          case 'Boost': this.boostTimer = 5.0; spawnParticles(this.pos.x, this.pos.y, 25, '#ff0', {speed: 150}); break;
          case 'Rally': this.rallyTimer = 5.0; spawnParticles(this.pos.x, this.pos.y, 25, '#f80', {speed: 150}); 
              for(let m of game.minions) {
                  if(m.team === this.team && !m.dead && dist(this.pos, m.pos) <= 400) {
                      applyHeal(m, 150); m.attackDamage += 10; m.speed += 20; spawnParticles(m.pos.x, m.pos.y, 5, '#f80');
                  }
              } break;
          case 'Revive': this.revive(); spawnParticles(this.pos.x, this.pos.y, 40, '#fff', {speed: 200}); break;
          case 'Exhaust': game.particles.push(new Particle(this.pos.x, this.pos.y, '#f00', {shape: 'ring', radius: 300, life: 0.5, lineWidth: 6}));
              for(let p of game.players) {
                  if (p.team !== this.team && p.alive && dist(p.pos, this.pos) <= 300) {
                      p.slowTimer = 2.0; p.slowMod = 0.6; spawnParticles(p.pos.x, p.pos.y, 10, '#f00');
                  }
              } break;
      }
  }

  shoot(tx,ty, isNetwork = false){ 
    if(!this.alive) return; 
    if (this === player && !isNetwork) playSound('shoot');
    this.attackPenaltyTimer = 0.5; 
    
    // Odeslání akce na server (Host odesílá za sebe i za své boty)
    if (socket && !isNetwork) {
      if (this === player || (game.isHost && this instanceof BotPlayer)) {
        socket.emit('player_action', { type: 'shoot', id: this.id, tx: Math.round(tx), ty: Math.round(ty) });
      }
    }

    const buffAdMult = 1.0 + (this.adAsBuffTimer > 0 ? this.adAsBuffAmount : 0);
    const pAD = this.AD * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0) * buffAdMult; 
    const pAP = this.AP * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0);
    const aaScale = CLASSES[this.className].aaScale || 0.3;
    let damage = Math.round(CLASSES[this.className].baseAtk + ((this.dmgType === 'magical' ? pAP : pAD) * aaScale));
    if (this.hanaBuffTimer > 0) damage += Math.round(this.effectiveMaxHp * (this.spells.Q.bonusHpDmg || 0.03));

    let isEmpowered = false;
    if (this.reaperCharge > 0) {
        isEmpowered = true;
        this.reaperCharge--;
        const spQ = this.spells.Q;
        damage += Math.round((spQ.baseDamage||0) + (pAP * (spQ.scaleAP||0)) + spQ.level*(spQ.scaleLevel !== undefined ? spQ.scaleLevel : 8));
    }

    if(this.range){ // ranged - projectile with limited range
      const angle = Math.atan2(ty-this.pos.y, tx-this.pos.x); const speed = 800; const range = this.attackRange; const life = range / speed; 
      let pCount = CLASSES[this.className].projCount || 1;
      let pSpread = CLASSES[this.className].projSpread || 0.25;
      for(let i=0; i<pCount; i++) {
          const a = pCount === 1 ? angle : angle - (pSpread*(pCount-1))/2 + i*pSpread;
          const vx = Math.cos(a)*speed; const vy = Math.sin(a)*speed;
          const p = new Projectile(this.pos.x + Math.cos(a)*(this.radius+6), this.pos.y + Math.sin(a)*(this.radius+6), vx, vy, this.id, this.team, {damage:damage, dmgType: this.dmgType, glyph:'-' , life:life, radius: 8}); game.projectiles.push(p);
      }
    } else { // melee basic
      const meleeRange = isEmpowered ? this.attackRange + (this.spells.Q.bonusRange || 70) : this.attackRange; 
      if (CLASSES[this.className].customMeleeAoE === 'ring') {
          spawnParticles(this.pos.x, this.pos.y, 2, '#f0f', { shape: 'ring', radius: meleeRange, life: 0.2, speed: 0, lineWidth: 2 });
          for(let m of game.minions){ if(!m.dead && m.team !== this.team){ if(dist(this.pos, m.pos) <= meleeRange){ applyDamage(m, Math.round(damage * 0.6), this.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 2, '#fff'); if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } } } }
          for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive){ if(dist(this.pos, p.pos) <= meleeRange){ applyDamage(p, damage, this.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 2, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } } }
      } else {
          // hit minions in cone
            const ang = Math.atan2(ty-this.pos.y, tx-this.pos.x); const cone = isEmpowered ? (60 * Math.PI / 180) : (70 * Math.PI / 180); // 70deg základní, 60deg pro posílené (Reaper Q)
          let pColor = isEmpowered ? '#800080' : '#fff';
          let mGlyph = isEmpowered ? '}' : ')';
          let finalSize = isEmpowered ? 160 : 130; // Zvětšeno na pokrytí kuželu, ale zúženo přes stretchX
          let startSize = 20;
          let mSpeed = (meleeRange - 20) / 0.15; // Závorka přesně doletí na okraj dosahu
          let growRate = (finalSize - startSize) / 0.15; // Rychlost zvětšování během letu
          
          // Letící a dynamicky se zvětšující útok (Kužel / Výseč)
          game.particles.push(new Particle(this.pos.x + Math.cos(ang)*20, this.pos.y + Math.sin(ang)*20, pColor, { angle: ang, speed: mSpeed, life: 0.15, glyph: mGlyph, size: startSize, grow: growRate, rotate: true, stretchX: 0.3 }));
          // Statická závorka na okraji dosahu (Místo původní kulaté čáry)
          game.particles.push(new Particle(this.pos.x + Math.cos(ang)*(meleeRange - 10), this.pos.y + Math.sin(ang)*(meleeRange - 10), pColor, { angle: ang, speed: 0, life: 0.2, glyph: mGlyph, size: finalSize, rotate: true, stretchX: 0.3 }));
          for(let m of game.minions){ if(!m.dead && m.team !== this.team){ const d = dist(this.pos, m.pos); if(d <= meleeRange){ const a2 = Math.atan2(m.pos.y - this.pos.y, m.pos.x - this.pos.x); const da = Math.abs(Math.atan2(Math.sin(a2-ang), Math.cos(a2-ang))); if(da <= cone/2){ applyDamage(m, Math.round(damage * 0.6), this.dmgType, this.id); if(isEmpowered){ m.slowTimer = Math.max(m.slowTimer||0, 1.0); m.slowMod = 0.6; } spawnParticles(m.pos.x, m.pos.y, 2, pColor); if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } } } } }
          for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive){ const d = dist(this.pos, p.pos); if(d <= meleeRange){ const a2 = Math.atan2(p.pos.y - this.pos.y, p.pos.x - this.pos.x); const da = Math.abs(Math.atan2(Math.sin(a2-ang), Math.cos(a2-ang))); if(da <= cone/2){ applyDamage(p, damage, this.dmgType, this.id); if(isEmpowered){ p.slowTimer = Math.max(p.slowTimer||0, 1.0); p.slowMod = 0.6; } spawnParticles(p.pos.x, p.pos.y, 2, pColor); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } } } }
      }
    } }

  castSpell(spKey, targetX, targetY, isNetwork = false){ 
    if(!this.alive) return;
    const sp = this.spells[spKey]; if(!sp) return; 
    if(!isNetwork && sp.cd>0) return; // Zabráníme lokálnímu spamování
    if(!isNetwork && this.silenceTimer > 0) return; 
    if(!isNetwork && this.stunTimer > 0) return; 
    
    if (this === player && !isNetwork) playSound('shoot');

    let tx = targetX, ty = targetY; 
    if(tx === undefined){ 
        let useAim = true;
        if (this === player && game.autoTarget && (sp.type === 'dash' || sp.type === 'dash_def')) {
            let mx = 0, my = 0;
            if(keys['w']) my -= 1; if(keys['s']) my += 1; if(keys['a']) mx -= 1; if(keys['d']) mx += 1;
            if(mx !== 0 || my !== 0) {
                let wAngle = Math.atan2(my, mx);
                tx = this.pos.x + Math.cos(wAngle)*100;
                ty = this.pos.y + Math.sin(wAngle)*100;
                useAim = false;
            }
        }
        if (useAim) { tx = this.pos.x + Math.cos(this.aimAngle)*100; ty = this.pos.y + Math.sin(this.aimAngle)*100; }
    } 
    
    // Odeslání kouzla na server
    if (socket && !isNetwork) {
      if (this === player || (game.isHost && this instanceof BotPlayer)) {
        socket.emit('player_action', { type: 'cast', id: this.id, spKey: spKey, tx: Math.round(tx), ty: Math.round(ty) });
      }
    }

    sp.cd = this.computeSpellCooldown(spKey) + (sp.castTime || 0); // Cooldown se rovnou navýší o délku cast time
    this.castingTimeRemaining = sp.castTime || 0; 
    this.castingTimeTotal = sp.castTime || 0;

    const buffAdMult = 1.0 + (this.adAsBuffTimer > 0 ? this.adAsBuffAmount : 0);
    const pAD = this.AD * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0) * buffAdMult; const pAP = this.AP * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0);
    const damage = Math.round((sp.baseDamage || 0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 8)); // Damage calculation is fine on client for display
    
    // Odebráno globální omezení 'Host-only', aby klienti viděli letící projektily a mohli vizuálně dashovat
    if (sp.type === 'projectile') {
        const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x); const speed = sp.pSpeed || 900; const life = sp.life || (700 / speed); 
        const count = sp.count || 1; const spread = sp.spread || 0.25;
        for(let i=0; i<count; i++) {
            const a = count === 1 ? angle : angle - (spread*(count-1))/2 + i*spread;
            const vx = Math.cos(a)*speed; const vy = Math.sin(a)*speed;
            game.projectiles.push(new Projectile(this.pos.x + Math.cos(a)*(this.radius+6), this.pos.y + Math.sin(a)*(this.radius+6), vx, vy, this.id, this.team, {damage:damage, dmgType: this.dmgType, glyph:sp.pGlyph, life: life, slowDuration: sp.slowDuration, slowMod: sp.slowMod})); 
        }
    } else if (sp.type === 'projectile_summon') {
        const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x); const speed = sp.pSpeed || 900; const life = sp.life || (700 / speed);
        const vx = Math.cos(angle)*speed; const vy = Math.sin(angle)*speed;
        let sumHp = Math.round((sp.summonHp || 120) + pAD * 0.5);
        let sumAd = Math.round((sp.summonAd || 50) + pAD * 0.2);
        game.projectiles.push(new Projectile(this.pos.x + Math.cos(angle)*(this.radius+6), this.pos.y + Math.sin(angle)*(this.radius+6), vx, vy, this.id, this.team, {
            damage: damage, dmgType: this.dmgType, glyph: sp.pGlyph, life: life,
            spawnMinion: true, mGlyph: sp.summonGlyph, mHp: sumHp, mAd: sumAd,
            slowDuration: sp.slowDuration
        }));
    } else if (sp.type === 'buff_ad_as') {
        this.adAsBuffTimer = sp.duration;
        this.adAsBuffAmount = sp.amount;
        if (sp.shieldAmount) { this.shield = sp.shieldAmount + (pAD * 0.3) + sp.level * (sp.scaleLevel !== undefined ? sp.scaleLevel : 15); this.shieldTimer = sp.duration; }
        spawnParticles(this.pos.x, this.pos.y, 15, '#f00', {speed: 150});
    } else if (sp.type === 'aoe') {
        const range = sp.radius; 
        game.particles.push(new Particle(this.pos.x, this.pos.y, '#ccf', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
        for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, damage, this.dmgType, this.id); if (sp.slowDuration) { m.slowTimer = Math.max(m.slowTimer||0, sp.slowDuration); m.slowMod = sp.slowMod || 0.6; } if (sp.stunDuration) { m.stunTimer = Math.max(m.stunTimer||0, sp.stunDuration); } spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } } } 
        for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, damage, this.dmgType, this.id); if (sp.slowDuration) { p.slowTimer = Math.max(p.slowTimer||0, sp.slowDuration); p.slowMod = sp.slowMod || 0.6; } if (sp.stunDuration) { p.stunTimer = Math.max(p.stunTimer||0, sp.stunDuration); game.effectTexts.push(new EffectText(p.pos.x, p.pos.y-20, "STUNNED", '#ffcc00')); } if (sp.silenceDuration) { p.silenceTimer = Math.max(p.silenceTimer||0, sp.silenceDuration); game.effectTexts.push(new EffectText(p.pos.x, p.pos.y-20, "SILENCED", '#fff')); } spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } }
        spawnParticles(this.pos.x, this.pos.y, 10, '#ccf');
    } else if (sp.type === 'heal_self') {
        let healAmount = Math.round((sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 10));
        let healed = applyHeal(this, healAmount); 
        if(this.stats && (!socket || game.isHost)) this.stats.hpHealed += healed;
        spawnParticles(this.pos.x, this.pos.y, 8, '#0f0');
    } else if (sp.type === 'heal_aoe') {
        let healAmount = Math.round((sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 10));
        game.particles.push(new Particle(this.pos.x, this.pos.y, '#0f0', {shape: 'ring', radius: sp.radius, life: 0.4, speed: 0, lineWidth: 4}));
        for(let p of game.players){ 
            if(p.team === this.team && p.alive && dist(this.pos, p.pos) <= sp.radius){ 
                let currentHeal = healAmount;
                if (p === this && sp.selfHealPenalty) { currentHeal *= sp.selfHealPenalty; }
                let healed = applyHeal(p, currentHeal); 
                if(this.stats && (!socket || game.isHost)) this.stats.hpHealed += healed; 
                spawnParticles(p.pos.x, p.pos.y, 6, '#0f0'); 
            } 
        }
    } else if (sp.type === 'aoe_knockback') {
        const range = sp.radius; 
        game.particles.push(new Particle(this.pos.x, this.pos.y, '#f55', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
        for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ 
            applyDamage(m, damage, this.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); 
            let angle = Math.atan2(m.pos.y - this.pos.y, m.pos.x - this.pos.x);
            m.knockbackTimer = 0.2; m.knockbackVel = { x: Math.cos(angle)*750, y: Math.sin(angle)*750 };
            if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } 
        } } 
        for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ 
            applyDamage(p, damage, this.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); 
            let angle = Math.atan2(p.pos.y - this.pos.y, p.pos.x - this.pos.x);
            p.knockbackTimer = 0.2; p.knockbackVel = { x: Math.cos(angle)*750, y: Math.sin(angle)*750 };
            if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } 
        } } 
        spawnParticles(this.pos.x, this.pos.y, 10, '#f55');
    } else if (sp.type === 'hana_q') {
        this.hanaBuffTimer = sp.duration || 5.0; this.regenBuffTimer = sp.duration || 5.0; 
        this.regenBuffAmount = 5 + (pAP * 0.1) + sp.level * (sp.scaleLevel !== undefined ? sp.scaleLevel : 2); spawnParticles(this.pos.x, this.pos.y, 15, '#f0f', {speed: 150});
    } else if (sp.type === 'dash' || sp.type === 'dash_def') {
        const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
        const distToMove = sp.distance || 250;
        const dashTime = sp.dashTime || 0.2; 
        this.dashTimer = dashTime;
        this.dashVel = { x: Math.cos(angle)*(distToMove/dashTime), y: Math.sin(angle)*(distToMove/dashTime) };
        spawnParticles(this.pos.x, this.pos.y, 8, '#fff');
        if (sp.type === 'dash_def') { this.defBuffTimer = 4.0; spawnParticles(this.pos.x, this.pos.y, 10, '#88f', {speed: 100}); }
        if (sp.radius && sp.baseDamage !== undefined) { 
            this.dashEndExplosion = { radius: sp.radius, damage: damage, dmgType: this.dmgType, id: this.id, slowDuration: sp.slowDuration, slowMod: sp.slowMod, silenceDuration: sp.silenceDuration };
        }
    } else if (sp.type === 'shield_explode') {
        this.shield = (sp.amount || 0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level * (sp.scaleLevel !== undefined ? sp.scaleLevel : 20);
        this.shieldExplodeData = { timer: sp.duration, damage: damage, radius: sp.radius, dmgType: this.dmgType };
        spawnParticles(this.pos.x, this.pos.y, 15, '#ccc', {speed: 100});
    } else if (sp.type === 'dash_heal_silence') {
        let healAmount = Math.round((sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 10));
        let healed = applyHeal(this, healAmount); 
        if(this.stats && (!socket || game.isHost)) this.stats.hpHealed += healed; 
        
        const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
        const distToMove = sp.distance || 80;
        const dashTime = sp.dashTime || 0.15; 
        this.dashTimer = dashTime;
        this.dashVel = { x: Math.cos(angle)*(distToMove/dashTime), y: Math.sin(angle)*(distToMove/dashTime) };
        spawnParticles(this.pos.x, this.pos.y, 8, '#fff');
        this.dashEndExplosion = { radius: sp.radius, damage: damage, dmgType: this.dmgType, id: this.id, silenceDuration: sp.silenceDuration };
    } else if (sp.type === 'buff_ms') {
        this.msBuffTimer = sp.duration;
          this.msBuffAmount = (sp.amount || 0) + (pAP * (sp.scaleAP || 0)) + (pAD * (sp.scaleAD || 0));
        spawnParticles(this.pos.x, this.pos.y, 15, '#0ff', {speed: 150});
    } else if (sp.type === 'summon') {
        let bestTower = null, bd = Infinity;
        for (let t of game.towers) if (t.owner !== this.team && dist(t.pos, this.pos) < bd) { bestTower = t; bd = dist(t.pos, this.pos); }
        const tIndex = bestTower ? bestTower.index : 0;
        if (!socket || game.isHost) {
            for(let i=0; i<(sp.count||1); i++) {
                const sx = this.pos.x + (Math.random()-0.5)*40; const sy = this.pos.y + (Math.random()-0.5)*40;
                let m = new Minion(sx, sy, this.team, tIndex);
                m.maxHp = Math.round(damage * 1.5); m.hp = m.maxHp; m.attackDamage = Math.round(damage * 0.4);
                m.glyph = sp.mGlyph || 'g';
                m.isSummon = true; m.ownerId = this.id; m.speed = 115;
                game.minions.push(m);
            }
        }
        spawnParticles(this.pos.x, this.pos.y, 10, '#a3c');
    } else if (sp.type === 'reaper_q') {
        this.reaperCharge = sp.charges || 3;
        this.reaperTimer = 4.0;
        spawnParticles(this.pos.x, this.pos.y, 20, '#800080', {speed: 150});
    } else if (sp.type === 'reaper_e') {
        const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
        const distToMove = sp.distance || 100;
        const dashTime = sp.dashTime || 0.15; 
        this.dashTimer = dashTime;
        this.dashVel = { x: Math.cos(angle)*(distToMove/dashTime), y: Math.sin(angle)*(distToMove/dashTime) };
        this.msBuffTimer = sp.duration || 1.5; this.msBuffAmount = 0.4;
        this.shield = (sp.amount || 0) + (pAP * (sp.scaleAP||0)) + sp.level * (sp.scaleLevel !== undefined ? sp.scaleLevel : 20);
        this.shieldTimer = sp.duration || 1.5;
        this.spells.Q.cd = 0; // Okamžitý reset Q!
        spawnParticles(this.pos.x, this.pos.y, 15, '#800080', {speed: 120});
    } else if (sp.type === 'summon_healers') {
        let healAmount = Math.round((sp.amount || 15) + pAP * (sp.scaleAP || 0) + sp.level * (sp.scaleLevel !== undefined ? sp.scaleLevel : 2));
        let pulseDmg = Math.round(5 + pAP * 0.10);
        if (!socket || game.isHost) {
            for(let i=0; i<3; i++) {
                const sx = this.pos.x + (Math.random()-0.5)*60; const sy = this.pos.y + (Math.random()-0.5)*60;
                let m = new Minion(sx, sy, this.team, 0);
                m.maxHp = Math.round(40 + pAP * 0.15); m.hp = m.maxHp; m.attackDamage = 0;
                m.glyph = 'c'; m.isSummon = true; m.ownerId = this.id; m.speed = 190;
                m.isSmallChicken = true; m.healAmount = healAmount; m.healTimer = 2.0; m.targetHeroId = null;
                m.pulseDmg = pulseDmg;
                m.lifeTime = 5.0;

                m.update = function(dt) { // Unikátní update loop jen pro Host server
                    if(this.dead || game.gameOver) return;
                    if(this.hp <= 0) { this.dead = true; return; }
                    if(this.flashTimer > 0) this.flashTimer -= dt;
                    if (this.knockbackTimer > 0) { this.knockbackTimer -= dt; moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt); return; }

                    this.lifeTime -= dt;
                    if (this.lifeTime <= 0) this.hp -= this.maxHp * 0.15 * dt;

                    this.healTimer -= dt;
                    if (!this.targetHeroId || !game.players.find(p => p.id === this.targetHeroId && p.alive)) {
                        let allies = game.players.filter(p => p.team === this.team && p.alive);
                        let bestAlly = null; let bestDist = Infinity;
                        for (let ally of allies) {
                            let maxOnAlly = (ally.id === this.ownerId) ? 1 : 2;
                            let chickensOnAlly = game.minions.filter(min => min.isSmallChicken && min.targetHeroId === ally.id && !min.dead).length;
                            let d = dist(this.pos, ally.pos);
                            if (chickensOnAlly < maxOnAlly && d <= 400) { if (d < bestDist) { bestDist = d; bestAlly = ally; } }
                        }
                        this.targetHeroId = bestAlly ? bestAlly.id : null;
                    }

                    if (this.targetHeroId) {
                        let targetHero = game.players.find(p => p.id === this.targetHeroId);
                        if (targetHero) {
                            let d = dist(this.pos, targetHero.pos);
                            if (d > 70) {
                                let dx = targetHero.pos.x - this.pos.x, dy = targetHero.pos.y - this.pos.y;
                                let l = Math.hypot(dx, dy); moveEntityWithCollision(this, (dx/l)*this.speed, (dy/l)*this.speed, dt);
                            }
                        }
                    }

                    if (this.healTimer <= 0) {
                        this.healTimer = sp.healInterval || 1.0;
                        if (this.targetHeroId) {
                            let targetHero = game.players.find(p => p.id === this.targetHeroId);
                            if (targetHero && dist(this.pos, targetHero.pos) < 500 && targetHero.hp < targetHero.effectiveMaxHp) { 
                                let healed = applyHeal(targetHero, this.healAmount); 
                                let owner = game.players.find(p => p.id === this.ownerId);
                                if (owner && owner.stats) owner.stats.hpHealed += healed;
                                spawnParticles(this.pos.x, this.pos.y, 3, '#0f0'); 
                            }
                        }
                        let hit = false;
                        for(let ep of game.players) { if(ep.team !== this.team && ep.alive && dist(this.pos, ep.pos) <= 65) { applyDamage(ep, this.pulseDmg, 'magical', this.ownerId); hit = true; } }
                        for(let em of game.minions) { if(em.team !== this.team && !em.dead && dist(this.pos, em.pos) <= 65) { applyDamage(em, this.pulseDmg, 'magical', this.ownerId); hit = true; } }
                        if (hit) spawnParticles(this.pos.x, this.pos.y, 4, '#ff4e4e');
                    } // Pokud nemá cíl, prostě stojí a čeká na místě. (umře přirozeně po 8 vteřinách, ale stále pálí okolí)
                };
                game.minions.push(m);
            }
        }
        spawnParticles(this.pos.x, this.pos.y, 15, '#ffcc00');
    } else if (sp.type === 'projectile_egg') {
        const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
        const speed = sp.pSpeed || 400; const life = sp.life || 0.625;
        const vx = Math.cos(angle)*speed; const vy = Math.sin(angle)*speed;
        
        let egg = new Projectile(this.pos.x + Math.cos(angle)*(this.radius+6), this.pos.y + Math.sin(angle)*(this.radius+6), vx, vy, this.id, this.team, {
            damage: damage, dmgType: this.dmgType, glyph: 'o', life: life, radius: 10
        });
        let pulseDmg = Math.round(10 + pAP * 0.15);

        if (!socket || game.isHost) {
            let origUpdate = egg.update.bind(egg);
            egg.update = function(dt) {
                let wasDead = this.dead; origUpdate(dt);
                if (this.dead && !wasDead) { 
                    // Limit 2 velké slepice
                    let existingBig = game.minions.filter(m => m.ownerId === this.ownerId && m.isBigChicken && !m.dead);
                    while(existingBig.length >= 2) {
                        let oldest = existingBig.shift();
                        oldest.hp = 0; oldest.dead = true;
                    }

                    let m = new Minion(this.pos.x, this.pos.y, this.ownerTeam, 0);
                    m.maxHp = Math.round(80 + pAP * 0.30); m.hp = m.maxHp; m.attackDamage = 0; m.glyph = 'C'; m.isSummon = true; m.ownerId = this.ownerId; m.speed = 210;
                    m.isBigChicken = true; m.healAmount = Math.round((sp.amount || 25) + pAP * (sp.scaleAP || 0) + sp.level * (sp.scaleLevel !== undefined ? sp.scaleLevel : 4)); m.healTimer = 2.0;
                    m.lifeTime = 6.0;
                    m.pulseDmg = pulseDmg;
                    m.targetHeroId = this.ownerId;
                    m.update = function(dt) {
                        if(this.dead || game.gameOver) return; if(this.hp <= 0) { this.dead = true; return; }
                        if(this.flashTimer > 0) this.flashTimer -= dt;
                        if (this.knockbackTimer > 0) { this.knockbackTimer -= dt; moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt); return; }
                        
                        this.lifeTime -= dt;
                        if (this.lifeTime <= 0) this.hp -= this.maxHp * 0.15 * dt;
                        
                        this.healTimer -= dt; 
                        let targetHero = game.players.find(p => p.id === this.ownerId && p.alive);
                        if (targetHero) {
                            this.targetHeroId = targetHero.id;
                            let d = dist(this.pos, targetHero.pos);
                            if (d > 70) { let dx = targetHero.pos.x - this.pos.x, dy = targetHero.pos.y - this.pos.y; let l = Math.hypot(dx, dy); moveEntityWithCollision(this, (dx/l)*this.speed, (dy/l)*this.speed, dt); }
                        } else { this.hp -= 20 * dt; this.targetHeroId = null; }

                        if (this.healTimer <= 0) { 
                            this.healTimer = sp.healInterval || 1.0; 
                            if (targetHero && dist(this.pos, targetHero.pos) < 500 && targetHero.hp < targetHero.effectiveMaxHp) { 
                                let healed = applyHeal(targetHero, this.healAmount); 
                                let owner = game.players.find(p => p.id === this.ownerId);
                                if (owner && owner.stats) owner.stats.hpHealed += healed;
                                spawnParticles(this.pos.x, this.pos.y, 6, '#0f0'); 
                            } 
                            let hit = false;
                            for(let ep of game.players) { if(ep.team !== this.team && ep.alive && dist(this.pos, ep.pos) <= 65) { applyDamage(ep, this.pulseDmg, 'magical', this.ownerId); if(ep.hp <= 0) handlePlayerKill(ep, this.ownerId); hit = true; } }
                            for(let em of game.minions) { if(em.team !== this.team && !em.dead && dist(this.pos, em.pos) <= 65) { applyDamage(em, this.pulseDmg, 'magical', this.ownerId); if(em.hp <= 0) em.dead = true; hit = true; } }
                            if (hit) spawnParticles(this.pos.x, this.pos.y, 5, '#ff4e4e');
                        }
                    };
                    game.minions.push(m);
                    spawnParticles(this.pos.x, this.pos.y, 10, '#fff');
                }
            };
        }
        game.projectiles.push(egg);
    }
    if (this === player) updateSpellLabels(); 
  }
}

export class BotPlayer extends Player {
    constructor(x, y, opts) {
      super(x, y, opts);
      this.state = 'SEARCHING'; // Výchozí stav pro nový State Machine
      this.target = null;
      this.objective = null;
      this.tacticTimer = 0;
      this.microDodgeMod = 0.8 + Math.random() * 0.4; // Náhodná schopnost reflexů bota pro uhýbání (80% až 120%)
      this.maxGroupSize = Math.random() > 0.5 ? 3 : 2; // 50% šance snést 3člennou skupinu na stejné věži
      this.lane = opts.lane || null;

      this.personalWeights = {};
      for(let key in BOT_WEIGHTS) {
          this.personalWeights[key] = BOT_WEIGHTS[key] * (0.9 + Math.random() * 0.2);
      }

      // Aplikace osobností bota (Role-based AI Weights)
      if (this.role === 'SPLITPUSHER') {
          this.personalWeights.heroKillScore *= 0.2; // Pacifista
          this.personalWeights.enemyBaseScore *= 0.2;
          this.personalWeights.towerBaseScore *= 1.8; // Miluje věže
          this.personalWeights.emptyTowerScore *= 2.5;
          this.personalWeights.neutralTowerScore *= 2.5;
          this.personalWeights.powerupScore *= 3.0; // Posedlost PowerUpem
      } else if (this.role === 'SLAYER') {
          this.personalWeights.heroKillScore *= 1.6; // Zabiják
          this.personalWeights.lowHpScore *= 2.2; // Krvelačný
          this.personalWeights.attackVisionRange *= 1.25; // Vidí kořist dál
      } else if (this.role === 'TANK') {
          this.personalWeights.heroKillScore *= 0.8;
          this.personalWeights.towerBaseScore *= 1.3; // Rád drží linii u věží
      } else if (this.role === 'FIGHTER') {
          this.personalWeights.minionPushBaseScore *= 1.5; // Dobrý pusher vln
          this.personalWeights.heroKillScore *= 1.1;
      }

      this.guardData = null;

      if (!game.teamIntents) game.teamIntents = { 0: {}, 1: {} }; // Týmová nástěnka
      this.strategy = 'NORMAL';
      this.randomizePokeThresholds();
    }

    randomizePokeThresholds() {
        const vary = () => 0.7 + Math.random() * 0.6; // Generuje odchylku +/- 30%
        this.pokeToleranceHits = Math.max(1, Math.round(3 * vary())); // cca 2 - 4 rány
        this.pokeTolerancePct = 0.20 * vary(); // 14% - 26% poškození
        this.pokeTowerThreshold = 0.50 * vary(); // 35% - 65% obsazení
        
        // BLOODLUST thresholds (Finish Him!)
        this.bloodlustTargetHpPct = 0.20 * vary(); // Cíl musí mít pod 14% - 26% HP
        this.bloodlustHpAdvantage = 0.30 * vary(); // Bot musí mít o 21% - 39% více HP
    }

    // Heuristická predikce souboje (Výpočet Time-To-Kill a DPS pro obě strany)
    // Vrací WinProbability (0.0 = Jistá prohra, 0.5 = Vyrovnané, 1.0 = Jistá výhra)
    predictFightOutcome(target) {
        if (!target) return 0.5;
        let myTeamHp = 0, myTeamDps = 0, myTeamHps = 0;
        let enTeamHp = 0, enTeamDps = 0, enTeamHps = 0;
        
        // Extrakce hrubých statistik hrdiny (velmi zjednodušeno pro rychlost)
        const getStats = (p) => {
            let buffAdMult = 1.0 + (p.adAsBuffTimer > 0 ? p.adAsBuffAmount : 0);
            let buffAsMult = 1.0 + (p.adAsBuffTimer > 0 ? p.adAsBuffAmount : 0);
            let pAD = p.AD * (p.hasPowerup ? 1.2 : 1.0) * (p.boostTimer > 0 ? 1.1 : 1.0) * buffAdMult;
            let pAP = p.AP * (p.hasPowerup ? 1.2 : 1.0) * (p.boostTimer > 0 ? 1.1 : 1.0);
            
            let aaScale = CLASSES[p.className].aaScale || 0.3;
            let basicDmg = Math.round(CLASSES[p.className].baseAtk + ((p.dmgType === 'magical' ? pAP : pAD) * aaScale));
            if (p.hanaBuffTimer > 0) basicDmg += Math.round(p.effectiveMaxHp * (p.spells.Q.bonusHpDmg || 0.03));
            
            let effAS = p.attackSpeed * buffAsMult;
            if (p.hanaBuffTimer > 0) effAS *= (p.spells.Q.bonusAsMult || 1.25);
            let atkPerSec = effAS / p.attackDelay;
            
            let dps = basicDmg * atkPerSec;
            let hps = p.hpRegen || 2;
            
            if (p.regenBuffTimer > 0) hps += p.regenBuffAmount || 0;
            if (p.summonerSpell === 'Heal' && p.summonerCooldown <= 0) hps += (150 + p.level * 20) / 15; // Predikce léčení
            
            if (p.spells) {
                for (let key of ['Q', 'E']) {
                    let sp = p.spells[key];
                    if (!sp) continue;
                    
                    let cd = Math.max(1.0, sp.baseCooldown);
                    let spellDmg = Math.round((sp.baseDamage||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 8));
                    
                    dps += (spellDmg / cd); // Boti nyní počítají se stabilním průměrným DPS, takže nepanikaří, když dají spell na cooldown
                    
                    if (sp.type && sp.type.includes('heal')) { 
                        let healAmt = (sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 10); 
                        hps += (healAmt / cd); 
                    }
                    if (sp.type === 'hana_q') hps += (5 + pAP * 0.1 + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 2));
                    if (sp.type === 'reaper_q') dps += (spellDmg * 3) / cd;

                    // Započítání vyvolávačů a jejich HPS/DPS
                    if (sp.type === 'summon_healers') {
                        let healAmt = (sp.amount || 15) + pAP * (sp.scaleAP || 0) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 2);
                        let interval = sp.healInterval || 1.0;
                        hps += ((healAmt * 3) / 2) * ((5 / interval) / cd);
                        dps += ((5 + pAP * 0.1) * 3 / 2) * ((5 / interval) / cd);
                    }
                    if (sp.type === 'projectile_egg') {
                        let interval = sp.healInterval || 1.0;
                        hps += (((sp.amount || 25) + pAP * (sp.scaleAP || 0) + sp.level*(sp.scaleLevel !== undefined ? sp.scaleLevel : 4)) / 2.0) * ((6 / interval) / cd);
                        dps += (10 + pAP * 0.15) * ((6 / interval) / cd);
                    }
                    if (sp.type === 'summon') dps += (((spellDmg * 0.4) / 1.2) * (sp.count||1)) * (8 / cd);
                    if (sp.type === 'projectile_summon') dps += (((sp.summonAd || 50) + pAD * 0.2) / 1.2) * (8 / cd);
                }
            }
            return { hp: p.hp + (p.shield || 0), dps: dps, hps: hps }; // Přidání štítů k celkové odolnosti
        };

        for (let p of game.players) {
            if (!p.alive) continue;
            if (p.team === this.team && dist(this.pos, p.pos) < 800) {
                let s = getStats(p); myTeamHp += s.hp; myTeamDps += s.dps; myTeamHps += s.hps;
            } else if (p.team !== this.team && dist(target.pos, p.pos) < 800) {
                let s = getStats(p); enTeamHp += s.hp; enTeamDps += s.dps; enTeamHps += s.hps;
            }
        }
        
        // Započítání poškození a léčení od už vyvolaných jednotek na mapě
        for (let m of game.minions) {
            if (m.dead) continue;
            let mDps = (m.attackDamage || 15) * 0.8; // Minion útočí cca každých 1.2s
            if (m.pulseDmg) mDps += m.pulseDmg; // Pulzní damage (Slepice atd.)
            let mHps = 0;
            if (m.healAmount && m.healTimer) mHps += (m.healAmount / m.healTimer);

            if (m.team === this.team && dist(this.pos, m.pos) < 600) {
                myTeamHp += m.hp; myTeamDps += mDps; myTeamHps += mHps;
            } else if (m.team !== this.team && dist(target.pos, m.pos) < 600) {
                enTeamHp += m.hp; enTeamDps += mDps; enTeamHps += mHps;
            }
        }
        
        // Zohlednění poškození od věží (Věž dává masivní DPS navíc)
        let nearMyTower = game.towers.some(t => t.owner === this.team && dist(this.pos, t.pos) < t.captureRadius + 200);
        let nearEnTower = game.towers.some(t => t.owner === 1 - this.team && dist(target.pos, t.pos) < t.captureRadius + 200);
        if (nearMyTower) myTeamDps += 80;
        if (nearEnTower) enTeamDps += 80;

        if (myTeamDps <= 0) myTeamDps = 1; if (enTeamDps <= 0) enTeamDps = 1;
        // Aplikace Healingu proti DPS
        myTeamDps = Math.max(1, myTeamDps - enTeamHps);
        enTeamDps = Math.max(1, enTeamDps - myTeamHps);

        let ttkEnemy = enTeamHp / myTeamDps; // Za jak dlouho umřou oni
        let ttkUs = myTeamHp / enTeamDps;    // Za jak dlouho umřeme my

        return ttkUs / (ttkUs + ttkEnemy); // Výpočet šance na výhru z poměrů TTK
    }

    revive() {
      super.revive();
      this.randomizePokeThresholds();
    }

    // ==========================================
    // VRSTVA 1: CENTRÁLNÍ MOZEK (RTS Makro - Běží každé 1.5 vteřiny pro celý tým najednou)
    // ==========================================
    static runCentralBrain(team) {
        if (!game.isHost) return;
        let teamBots = game.players.filter(p => p instanceof BotPlayer && p.team === team);
        let teamPlayers = game.players.filter(p => p.team === team); // Včetně živých hráčů
        
        // 0. Údržba vojáků (Nakupování a levelování) JEN PRO BOTY
        for (let bot of teamBots) {
            const inBase = dist(bot.pos, spawnPoints[bot.team]) < 250;
            if ((!bot.alive || inBase) && bot.gold >= 300 && bot.items.length < 25) {
                if (!bot.hasBoots && bot.gold >= 300) {
                    let boots = shopItems.find(it => it.id === 'boots');
                    if (boots) { bot.gold -= boots.cost; bot.items.push(boots.id); boots.apply(bot); bot.isDirty = true; }
                } else {
                    let enemyPhys = 0, enemyMag = 0;
                    for (let e of game.players.filter(p => p.team !== bot.team)) { if (e.dmgType === 'physical') enemyPhys++; else enemyMag++; }
                    let pool = [];
                    const isTank = bot.role === 'TANK';
                    const isFighter = bot.role === 'FIGHTER' || bot.role === 'SPLITPUSHER';
                    const isMageSupport = bot.role === 'SUPPORT' || (bot.role === 'SLAYER' && bot.dmgType === 'magical') || (bot.role === 'SPLITPUSHER' && bot.dmgType === 'magical');
                    
                    if (isTank) { pool.push('hp', 'hp'); if (enemyPhys >= enemyMag) pool.push('armor'); if (enemyMag >= enemyPhys) pool.push('mr'); } 
                    else if (isFighter) { pool.push('hp'); if (bot.dmgType === 'magical') pool.push('ap', 'ah'); else pool.push('ad', 'ah'); if (enemyPhys > enemyMag) pool.push('armor'); else if (enemyMag > enemyPhys) pool.push('mr'); } 
                    else if (isMageSupport) { pool.push('ap', 'ap', 'ah', 'ah'); if (Math.random() < 0.25) pool.push('hp'); } 
                    else { if (bot.role === 'SLAYER' && bot.range) pool.push('ad', 'ad', 'as'); else pool.push('ad', 'ad', 'ah'); if (Math.random() < 0.2) pool.push(enemyPhys > enemyMag ? 'armor' : 'mr'); }
                    let chosenId = pool[Math.floor(Math.random() * pool.length)];
                    let item = shopItems.find(it => it.id === chosenId);
                    if (item && bot.gold >= item.cost) { bot.gold -= item.cost; bot.items.push(item.id); item.apply(bot); bot.isDirty = true; }
                }
            }
            while(bot.spellPoints > 0) {
                let canQ = ((bot.spells.Q.level + 1) / bot.spells.E.level) <= 2.5;
                let canE = ((bot.spells.E.level + 1) / bot.spells.Q.level) <= 2.5;
                if (canQ && canE) bot.allocateSpellPoint(Math.random() > 0.5 ? 'Q' : 'E');
                else if (canQ) bot.allocateSpellPoint('Q');
                else if (canE) bot.allocateSpellPoint('E');
                else break; // Pojistka
            }
        }

        // Aktualizace globálního pohledu (Makro stavy i pro živé lidi!)
        for (let p of teamPlayers) {
            const myTowersCount = game.towers.filter(t => t.owner === p.team).length;
            const enemyTowersCount = game.towers.filter(t => t.owner === 1 - p.team).length;
            p.isGlobalLosing = myTowersCount < enemyTowersCount;
            p.isDesperate = myTowersCount <= 1 && enemyTowersCount >= 3; 
        }

        let unassigned = teamPlayers.filter(b => b.alive);
        if (unassigned.length === 0) return;
        let enemies = game.players.filter(p => p.team !== team && p.alive);

        // DND (Do Not Disturb): Pokud bot už úspěšně obsazuje věž a není v ohrožení, mozek ho nechá pracovat
        unassigned = unassigned.filter(b => {
            if (b.state === 'CAPTURE' && b.objective && b.objective.owner !== team && dist(b.pos, b.objective.pos) <= (b.objective.captureRadius || 80)) {
                let enemiesAround = enemies.filter(e => dist(e.pos, b.pos) < 800).length;
                if (enemiesAround === 0) return false; // Není v ohrožení, vyřazen z přidělování úkolů (zůstane na věži)
            }
            return true;
        });

        const assign = (bot, type, target) => {
            bot.macroOrder = { type, target };
            unassigned = unassigned.filter(b => b.id !== bot.id);
        };

        // 1. ZÁCHRANA SPOLUBOJOVNÍKA (REINFORCE)
        for (let ally of teamBots.filter(b => b.alive)) {
            if (ally.hp / ally.effectiveMaxHp < 0.4 && ally.target && ally.target.alive) {
                let winProb = ally.predictFightOutcome ? ally.predictFightOutcome(ally.target) : 0.5;
                if (winProb < 0.4) {
                    let helpers = unassigned.filter(b => dist(b.pos, ally.pos) < 2000);
                    if (helpers.length > 0) {
                        // Preferujeme Slayery (Assassiny) a Fightery pro záchranu parťáka
                        let bestHelper = helpers.sort((a,b) => {
                            let scoreA = dist(a.pos, ally.pos) - (['SLAYER', 'FIGHTER'].includes(a.role) ? 1500 : 0);
                            let scoreB = dist(b.pos, ally.pos) - (['SLAYER', 'FIGHTER'].includes(b.role) ? 1500 : 0);
                            return scoreA - scoreB;
                        })[0];
                        assign(bestHelper, 'HUNT', ally.target);
                    }
                }
            }
        }

        // 2. POWERUP (Pošle prioritně Slayera nebo Splitpushera)
        if (game.powerup && game.powerup.active && unassigned.length > 0) {
            let candidates = unassigned.filter(b => ['SLAYER', 'SPLITPUSHER'].includes(b.role));
            if (candidates.length === 0) candidates = unassigned;
            if (candidates.length > 0) {
                let best = candidates.sort((a,b) => dist(a.pos, game.powerup.pos) - dist(b.pos, game.powerup.pos))[0];
                assign(best, 'POWERUP', game.powerup);
            }
        }

        // 3. DEFEND (Obrana věží pod palbou)
        let ownedTowers = game.towers.filter(t => t.owner === team);
        for (let t of ownedTowers) {
            let attackers = enemies.filter(e => dist(e.pos, t.pos) < t.captureRadius + 400);
            if (attackers.length > 0 && Math.abs(t.control) < 100) {
                let needed = Math.min(unassigned.length, attackers.length);
                for (let i = 0; i < needed; i++) {
                    let best = unassigned.sort((a,b) => {
                        let scoreA = (a.role === 'TANK' ? -2000 : 0) + dist(a.pos, t.pos);
                        let scoreB = (b.role === 'TANK' ? -2000 : 0) + dist(b.pos, t.pos);
                        return scoreA - scoreB;
                    })[0];
                    if (best) assign(best, 'DEFEND', t);
                }
            }
        }

        // 4. SNEAK CAPTURE (Kradení prázdných věží)
        let unownedTowers = game.towers.filter(t => t.owner !== team);
        for (let t of unownedTowers) {
            let enemiesNear = enemies.filter(e => dist(e.pos, t.pos) < 1200); // 1200 radius safe zone
            if (enemiesNear.length === 0 && unassigned.length > 0) {
                let best = unassigned.sort((a,b) => {
                    let scoreA = (a.role === 'SPLITPUSHER' ? -3000 : 0) + (a.hp / a.effectiveMaxHp)*1000 + dist(a.pos, t.pos);
                    let scoreB = (b.role === 'SPLITPUSHER' ? -3000 : 0) + (b.hp / b.effectiveMaxHp)*1000 + dist(b.pos, t.pos);
                    return scoreA - scoreB;
                })[0];
                if (best) assign(best, 'SNEAK_CAPTURE', t);
            }
        }

        // 5. ASSAULT (Přímý útok na nepřátelskou věž)
        // DOMINION TAKTIKA: "Rule of 3" & "Power Play"
        // Pokud držíme 3 věže, neútočíme dál, POKUD nečekáme na respawn většiny nepřátel (Death Timer Advantage).
        let totalEnemiesCount = game.players.filter(p => p.team !== team).length;
        let massiveAdvantage = (totalEnemiesCount > 0 && enemies.length <= Math.floor(totalEnemiesCount / 2)); // Např. žijí jen 2 z 5

        // DOMINION TAKTIKA: Minimalizace cestování (Center of Mass)
        // Cílovou věž nevybíráme podle vzdálenosti od spawnu, ale podle aktuální polohy volné armády
        let cx = spawnPoints[team].x, cy = spawnPoints[team].y;
        if (unassigned.length > 0) {
            cx = 0; cy = 0;
            for (let b of unassigned) { cx += b.pos.x; cy += b.pos.y; }
            cx /= unassigned.length; cy /= unassigned.length;
        }
        let remainingTowers = unownedTowers.sort((a,b) => dist(a.pos, {x: cx, y: cy}) - dist(b.pos, {x: cx, y: cy}));
        let targetTower = remainingTowers.length > 0 ? remainingTowers[0] : null;

        // Pokud držíme 3 věže, útočíme na další JEN POKUD je neutrální (Free), nebo máme masivní výhodu.
        let shouldHold = (ownedTowers.length >= 3 && !massiveAdvantage && targetTower && targetTower.owner !== -1);

        if (shouldHold && unassigned.length > 0) {
            // Pošleme volné boty preventivně hlídkovat na naše hraniční věže (ty nejblíže k nepříteli)
            let borderTowers = ownedTowers.sort((a,b) => dist(a.pos, spawnPoints[1-team]) - dist(b.pos, spawnPoints[1-team]));
            for (let b of unassigned) assign(b, 'DEFEND', borderTowers[0]);
        } else if (targetTower && unassigned.length > 0) {
                let assaultTeam = unassigned.sort((a,b) => {
                    // Frontline (Tanci/Fighter) jdou dopředu, Support se drží vzadu, pokud nemá s kým jít
                    let scoreA = dist(a.pos, targetTower.pos) - (['TANK', 'FIGHTER'].includes(a.role) ? 1000 : 0) + (a.role === 'SUPPORT' ? 2000 : 0);
                    let scoreB = dist(b.pos, targetTower.pos) - (['TANK', 'FIGHTER'].includes(b.role) ? 1000 : 0) + (b.role === 'SUPPORT' ? 2000 : 0);
                    return scoreA - scoreB;
                }).slice(0, 3);
                
                // Pojistka: Nepošleme samotného SUPPORTA útočit na věž, raději ho pošleme pomáhat s farmou (kde narazí na spojence)
                if (!(assaultTeam.length === 1 && assaultTeam[0].role === 'SUPPORT')) {
                    for (let b of assaultTeam) assign(b, 'ASSAULT', targetTower);
                }
        }

        // 6. FARM / PUSH WAVES (Zbylí jdou farmit)
        for (let b of unassigned) assign(b, 'FARM', null);
    }

    // ==========================================
    // VRSTVA 2: TAKTIKA (Meso management - Každou 0.25 vteřinu)
    // ==========================================
    evaluateTactic() {
      if (!this.alive) return;
      this.terrified = false; // Reset strachu na začátku úvahy
      this.angryAtPeker = null; // Reset naštvanosti na střelce
      this.tankStalemateTarget = null; // Resetování stavu Tank vs Tank
      
      const farmUrge = this.macroOrder && this.macroOrder.type === 'FARM';
      const powerupUrge = this.macroOrder && this.macroOrder.type === 'POWERUP';

      // 0. OPTIMALIZACE: Globální sken okolí pro tento taktovací cyklus
      const aliveAllies = [];
      const aliveEnemies = [];
      for (let p of game.players) {
          if (!p.alive) continue;
          if (p.team === this.team) aliveAllies.push(p);
          else aliveEnemies.push(p);
      }
      const activeEnemyMinions = game.minions.filter(m => !m.dead && m.team !== this.team);
      const activeAllyMinions = game.minions.filter(m => !m.dead && m.team === this.team);

      let bestObjective = null;
      let bestObjScore = -Infinity;
      let bestState = 'SEARCHING';
      const enemyBase = spawnPoints[1 - this.team]; // Zóna nepřátelské základny

      // 1. OBRANA PO OBSAZENÍ: Zkontrolujeme, jestli jsme zrovna nezabrali věž
      if (this.state === 'CAPTURE' && this.objective && this.objective.owner === this.team) {
          let enemyBots = aliveEnemies.filter(p => dist(p.pos, this.pos) < 1000);
          if (enemyBots.length > 0) { // 100% šance
              this.guardData = { tower: this.objective, radius: 1000 };
          }
      }

      if (this.guardData) {
          bestObjScore = 30000;
          bestObjective = this.guardData.tower;
          bestState = 'DEFEND';
      }

      // 2. Hodnocení Objektivů (Věže)
      for (let t of game.towers) {
          let isUnderAttack = false;
          for (let p of aliveEnemies) { if (dist(p.pos, t.pos) <= t.captureRadius) { isUnderAttack = true; break; } }

          // Proaktivní obrana - pokud plně vlastníme věž, ale někdo v ní stojí nebo už nám klesá control, musíme reagovat
          if (t.owner === this.team) {
              let fullyControlled = (this.team === 0 && t.control >= 100) || (this.team === 1 && t.control <= -100);
              if (fullyControlled && !isUnderAttack) {
                  continue; // Věž je bezpečná
              }
          }

          let score = this.personalWeights.towerBaseScore - dist(this.pos, t.pos);
          if (dist(t.pos, enemyBase) < 300) score -= this.personalWeights.enemyBasePenalty; // Penalizace
          let isTopTower = (t.index === 0 || t.index === 1 || t.index === 2);
          let isBotTower = (t.index === 3 || t.index === 4);
          
          // DYNAMICKÁ LANING FÁZE: V průběhu hry se vazba na původní linku vytrácí
          let laneMultiplier = 1.0;
          if (this.level >= 3) laneMultiplier = 0.5; // Od levelu 3 (Mid-game) slábne vliv linek na polovinu
          if (this.level >= 5) laneMultiplier = 0.0; // Od levelu 5 (Late-game) linky úplně mizí a boti rotují volně
          
          if (this.lane === 'top' && isTopTower) score += this.personalWeights.laneMatchScore * laneMultiplier;
          if (this.lane === 'bottom' && isBotTower) score += this.personalWeights.laneMatchScore * laneMultiplier;
          
          if (this.role === 'ROAMER' && t.owner === 1 - this.team) score += 4600; // Zvýšeno o 15%
          
          // Obrovská priorita bránit vlastní napadenou věž
          if (t.owner === this.team && (isUnderAttack || Math.abs(t.control) < 100)) {
              score += 18000; 
          }

          // Vyhodnocení obránců na věži (Zabránění sebevražedným náběhům do přečíslení)
          let defenders = aliveEnemies.filter(p => dist(p.pos, t.pos) < t.captureRadius + 400); // Širší okruh obránců
          let alliesNear = aliveAllies.filter(p => dist(p.pos, t.pos) < t.captureRadius + 400);
          if (t.owner !== this.team && defenders.length > alliesNear.length) {
              score -= (defenders.length - alliesNear.length) * 6000; // Masivní penalizace za přečíslení na cizí věži
          }

          // Rozdílná logika obsazování pro Melee vs Range
          let closeDefenders = defenders.filter(p => dist(p.pos, t.pos) < t.captureRadius + 150);
          if (closeDefenders.length > 0) {
              let hasRangedDef = closeDefenders.some(d => d.range);
              let hasMeleeDef = closeDefenders.some(d => !d.range);
              if (this.range) { if (hasMeleeDef && !hasRangedDef) score += 1800; } // Ranged bot se nebojí Melee obránce
              else { if (hasRangedDef) score -= 1800; } // Melee bot se obává pokeování od Ranged obránce
          }

          // PŘIDÁNO: Masivní bonus, pokud je bot blízko neutrální nebo nepřátelské věže (< 1000 units)
          if (t.owner !== this.team && dist(this.pos, t.pos) < 1000) {
              score += 4000;
          }

          // PŘIDÁNO: Pokud tým prohrává, větší šance jít na věže a krást v týlu
          if (this.isGlobalLosing) {
              score += 4600; // Zvýšeno o 15%
              if (t.owner === 1 - this.team) score += 3450; // Zvýšeno o 15%
          }
          if (this.isDesperate) {
              score += 15000; // Zoufalství: Brutální priorita věží (přebije potyčky i lékárničky)
              if (t.owner === 1 - this.team) score += 5000;
          }

          if (this.role === 'SUPPORT') {
              let alliedFighters = game.players.some(p => p instanceof BotPlayer && p.team === this.team && p.role === 'FIGHTER' && p.objective === t);
              if (alliedFighters) score += 6900; // Zvýšeno o 15%
          }
          
          if (t.owner === -1) score += this.personalWeights.neutralTowerScore;
          
          let alliesOnTower = 0;
          for (let id in game.teamIntents[this.team]) {
              if (id !== this.id && game.teamIntents[this.team][id].objective === t) alliesOnTower++;
          }
          if (alliesOnTower >= this.maxGroupSize) score -= this.personalWeights.overcrowdedTowerPenalty;
          else if (alliesOnTower === 0) score += this.personalWeights.emptyTowerScore;
          
          if (this.state === 'CAPTURE' && this.objective === t) {
              score += this.personalWeights.objectiveHysteresis;
              // PROGRES BONUS: Neodchází, když už to skoro má!
              let progressVal = (this.team === 0) ? (t.control + 100)/200 : (100 - t.control)/200; // 0 až 1
              if (progressVal > 0) score += progressVal * 20000; 
          }
          
          // ROZKAZ OD CENTRÁLNÍHO MOZKU PŘEBÍJÍ VŠE
          if (this.macroOrder && ['DEFEND', 'SNEAK_CAPTURE', 'ASSAULT'].includes(this.macroOrder.type) && this.macroOrder.target === t) {
              score += 60000;
          }
          
          if (score > bestObjScore) { bestObjScore = score; bestObjective = t; bestState = 'CAPTURE'; }
      }

      // 3. Hodnocení Minionů (Pushování)
      for (let m of activeAllyMinions) {
              let targetTower = game.towers[m.targetIndex];
              if (!targetTower || targetTower.owner === this.team) continue;

              // Pokud už minioni dorazili blízko k věži, bot je přestane eskortovat a zaměří se rovnou na její obsazení
              if (dist(m.pos, targetTower.pos) < 400) continue;

              let nearbyAllies = 0;
              for (let p of aliveAllies) { if (p.id !== this.id && dist(m.pos, p.pos) < 350) nearbyAllies++; }
              
              // Každý minion na cestě je dobrý cíl k eskortě, pokud u něj nehlídkuje moc hrdinů.
              if (nearbyAllies <= 1) {
                  let d = dist(this.pos, m.pos);
                  let score = this.personalWeights.minionPushBaseScore - d;
                  if (dist(m.pos, enemyBase) < 300) score -= this.personalWeights.enemyBasePenalty; // Nejdeme pro miniony do báze
                  if (this.state === 'PUSH' && this.objective && this.objective.type === 'minions' && dist(this.objective.pos, m.pos) < 250) score += this.personalWeights.objectiveHysteresis;
                  
                  if (score > bestObjScore) { bestObjScore = score; bestObjective = { pos: m.pos, type: 'minions', captureRadius: 160, index: 'MINIONS' }; bestState = 'PUSH'; }
              }
      }

      // 4. Hodnocení Sběratelských Předmětů (Healy a PowerUp)
      if (this.hp / this.effectiveMaxHp < 0.85) { // Reagují dříve (na 85%)
          for (let h of game.heals) {
              if (h.active) {
                  let d = dist(this.pos, h.pos);
                  let missingHpPct = 1 - (this.hp / this.effectiveMaxHp);
                  
                  // TÝMOVÁ NÁSTĚNKA (Blackboard): Nebereme heal, pokud už pro něj běží spojenec co je blíž
                  let getHealClaim = (p) => (1 - (p.hp / p.effectiveMaxHp)) * 5000 + Math.max(0, 2000 - dist(p.pos, h.pos));
                  let myClaim = getHealClaim(this);
                  let allyGoingForHeal = false;
                  for (let id in game.teamIntents[this.team]) {
                      if (id === this.id) continue;
                      let intent = game.teamIntents[this.team][id];
                      if (intent && intent.state === 'PICKUP' && intent.objective && intent.objective.type === 'heal' && intent.objective.pos.x === h.pos.x) {
                          let ally = aliveAllies.find(p => p.id === id);
                          if (ally && getHealClaim(ally) + 1000 > myClaim) { allyGoingForHeal = true; break; } // +1000 hystereze brání překlikávání a dohadování
                      }
                  }
                  if (allyGoingForHeal) continue;

                  // Masivní bonus za chybějící HP (až +8000) a bonus +3000, pokud je heal blízko (např. v boji)
                  let score = this.personalWeights.healScore + (missingHpPct * 8000) - d;
                  if (d < 600) score += 3000;
                  
                  if (dist(h.pos, enemyBase) < 300) score -= this.personalWeights.enemyBasePenalty;
                  if (this.state === 'PICKUP' && this.objective && this.objective.type === 'heal' && dist(this.objective.pos, h.pos) < 10) score += this.personalWeights.objectiveHysteresis;
                  if (score > bestObjScore) { bestObjScore = score; bestObjective = { pos: h.pos, type: 'heal', captureRadius: 20 }; bestState = 'PICKUP'; }
              }
          }
      }
      
      if (game.powerup && game.powerup.active && !this.hasPowerup) {
          // TÝMOVÁ NÁSTĚNKA (Blackboard): Prevence davového šílenství u PowerUpu
          let getPwrClaim = (p) => (['SLAYER', 'SPLITPUSHER'].includes(p.role) ? 2000 : (p.role === 'FIGHTER' ? 1000 : 0)) + Math.max(0, 3000 - dist(p.pos, game.powerup.pos));
          let myPwrClaim = getPwrClaim(this);
          let allyGoingForPowerup = false;
          for (let id in game.teamIntents[this.team]) {
              if (id === this.id) continue;
              let intent = game.teamIntents[this.team][id];
              if (intent && intent.state === 'PICKUP' && intent.objective && intent.objective.type === 'powerup') {
                  let ally = aliveAllies.find(p => p.id === id);
                  if (ally && getPwrClaim(ally) + 1500 > myPwrClaim) { 
                      allyGoingForPowerup = true; break; 
                  }
              }
          }
          
          if (!allyGoingForPowerup) {
          let d = dist(this.pos, game.powerup.pos);
          let score = this.personalWeights.powerupScore - d; 
          
          if (powerupUrge) score += 25000; // Extrémní bonus z nálady, bot pro to prostě dojde
          
          if (this.state === 'PICKUP' && this.objective && this.objective.type === 'powerup') {
              score += this.personalWeights.objectiveHysteresis;
              score += (game.powerup.captureTimer / 10.0) * 20000; // Neodchází, když ho už skoro má (až +20k bodů)
          }

          if (dist(game.powerup.pos, enemyBase) < 300) score -= this.personalWeights.enemyBasePenalty;
          if (this.state === 'PICKUP' && this.objective && this.objective.type === 'powerup') score += this.personalWeights.objectiveHysteresis;
          if (score > bestObjScore) { bestObjScore = score; bestObjective = { pos: game.powerup.pos, type: 'powerup', captureRadius: 70 }; bestState = 'PICKUP'; }
          }
      }

      // 5. Hodnocení Útoků (Combat)
      let bestTarget = null;
      let bestTargetScore = -Infinity;
      const enemies = [...aliveEnemies, ...activeEnemyMinions];
      for (let e of enemies) {
          let d = dist(e.pos, this.pos);
          let enemyHpPct = e.hp / (e.effectiveMaxHp || e.maxHp);
          let myHpPctLoc = this.hp / this.effectiveMaxHp;
          let isBloodlust = e.className && (enemyHpPct < this.bloodlustTargetHpPct) && ((myHpPctLoc - enemyHpPct) > this.bloodlustHpAdvantage);

          // Pokud je to hunt target, ignorujeme zrak a vnímáme ho globálně (nebo pokud ho zrovna chceme dorazit)
          if (d < this.personalWeights.attackVisionRange || this.huntTarget === e || (isBloodlust && this.target === e)) {
              let score = this.personalWeights.enemyBaseScore - d;
              if (dist(e.pos, enemyBase) < 300) score -= this.personalWeights.enemyBasePenalty; // Neútočíme dovnitř báze
              
              // ANALÝZA PŘESILY (Prevence sebevražedných 1v3)
              let winProb = this.predictFightOutcome(e);
              if (e.className && this.huntTarget !== e) {
                  let cowardiceThreshold = 0.40; // Základní WinProb limit pro strach
                  if (this.role === 'SPLITPUSHER') cowardiceThreshold = 0.55; // Srubne jenom snadné cíle
                  else if (this.role === 'TANK') cowardiceThreshold = 0.25; // Tank se nebojí, i když má nevýhodu
                  else if (this.role === 'SLAYER') cowardiceThreshold = 0.45; 

                  if (this.isDesperate) {
                      cowardiceThreshold -= 0.15; // Zoufalství: Budou riskovat i vyloženě špatné souboje o cíle!
                  }

                  // ZVLÁŠTNÍ PRAVIDLO: Kradení věží -> Zbabělec utíká hned jak někoho vidí!
                  if (this.macroOrder && this.macroOrder.type === 'SNEAK_CAPTURE') {
                      cowardiceThreshold = 0.8;
                  }

                  let minionSwarm = activeEnemyMinions.filter(m => dist(m.pos, this.pos) < 350).length;

                  if (winProb < cowardiceThreshold || minionSwarm >= 5) { 
                      score -= 30000; 
                      if (d < 600) this.terrified = true; 
                  } else if (winProb > 0.65) {
                      score += 8000; // Tým má masivní výhodu, agresivní útok
                  }
              }

              if (e.className) {
                  score += this.personalWeights.heroKillScore;
                  if (this.target === e) score += 2500; // Cílová hystereze (Zabraňuje trhavému překlikávání mezi cíli v teamfightu)
                  if (this.huntTarget === e) score += 30000; // Terminátor mód - neoblomná gigantická priorita
                  if (this.macroOrder && this.macroOrder.type === 'HUNT' && this.macroOrder.target === e) score += 60000; // Rozkaz k záchraně kolegy
                  
                  // DOMINION MECHANIKA: Přerušení obsazování (Capture Interrupt)
                  let capturingOurTower = game.towers.find(t => t.owner === this.team && dist(e.pos, t.pos) <= t.captureRadius);
                  if (capturingOurTower) {
                      score += 15000; // Obrovská priorita trefit toho, kdo nám právě krade věž!
                      if (this.range) score += 5000; // Ranged boti mají výhodu bezpečného přerušení na dálku
                  }

                  // FOCUS FIRE BONUS PŘES NÁSTĚNKU
                  let allyFocus = 0;
                  for (let id in game.teamIntents[this.team]) { if (id !== this.id && game.teamIntents[this.team][id].target === e) allyFocus++; }
                  if (allyFocus > 0) score += allyFocus * 3500; // Boti si pomáhají a sdružují poškození na jeden cíl
                  
                  // PEELING & TANK PROTECT
                  let chasingTerrified = aliveAllies.some(ally => ally.id !== this.id && ally.terrified && dist(e.pos, ally.pos) < 350);
                  if (chasingTerrified) score += 2500;
                  
                  if (this.role === 'TANK') {
                      let attackingCarry = aliveAllies.some(ally => ['SLAYER', 'SUPPORT'].includes(ally.role) && ally.recentAttackers && ally.recentAttackers.has(e.id));
                      if (attackingCarry) score += 8000; // Tanci agresivně brání střelce a supporty ve svém týmu
                  }
              } else {
                  if (farmUrge) score += 1500; // Zvýšeno, aby farmařil více
                  // Masivní priorita POUZE pro miniony, kteří překážejí v obsazování/obraně věže
                  if ((this.state === 'CAPTURE' || this.state === 'DEFEND') && this.objective && this.objective.pos) {
                      if (dist(e.pos, this.objective.pos) < 120) score += 15000; // Okamžitá poprava překážejících minionů
                  }
              }
              if (enemyHpPct < 0.3 && !farmUrge) score += this.personalWeights.lowHpScore;
              if (isBloodlust) score += 25000; // Krev! Musí ho dorazit a nenechat utéct!
              
              if (this.recentAttackers && this.recentAttackers.has(e.id)) {
                  let atkData = this.recentAttackers.get(e.id);
                  let timeSince = performance.now() - (atkData.time || atkData);
                  let hits = atkData.count || 1;
                  let dmgTaken = atkData.damage || 0;
                  let hpLostPct = dmgTaken / this.effectiveMaxHp;
                  if (timeSince < 5000) {
                      score += 6000 + (hpLostPct * 20000); // Silnější reakce podle toho, jak moc to bolelo

                      // --- ANTI-POKE LOGIKA (Melee vs Ranged) ---
                      if (!this.range && e.range) {
                          let progressVal = 0;
                          if (bestState === 'CAPTURE' && bestObjective && bestObjective.control !== undefined) {
                              progressVal = (this.team === 0) ? (bestObjective.control + 100)/200 : (100 - bestObjective.control)/200;
                          }
                          
                          // Pokud už máme věž rozdělanou nad vlastní limit, nebo nás poke zatím dost nevytočil, ignorujeme ho
                          if (progressVal > this.pokeTowerThreshold || (hits < this.pokeToleranceHits && hpLostPct < this.pokeTolerancePct)) {
                              score -= 10000;
                          } else {
                              // Přetekla nám trpělivost -> jdeme střelce zničit (čím víc to bolelo, tím silnější motivace)
                              score += 15000 + (hpLostPct * 40000);
                              this.angryAtPeker = e.id;
                          }
                      }
                  }
              }

              // PŘIDÁNO: Snížení priority boje, pokud tým prohrává (soustředění na záchranu věží)
              if (this.isGlobalLosing) score -= 3450; // Posílena averze k boji o 15%
              if (this.isDesperate) score -= 8000; // Absolutní averze k nesmyslným bojům v lese (jen objektivy)

              // PŘIDÁNO: Ztráta priority, pokud ho bot dlouho nahání ale nedal mu dmg
              // OPRAVA: Ignorujeme Anti-Chase pro lovené cíle, volání o pomoc a low HP cíle (Bloodlust)!
              if (this.target === e && this.chaseTimer > 2.0 && this.huntTarget !== e && this.helpUrgeTarget !== e && !isBloodlust) {
                  score -= 20000; // Po dvou vteřinách neúspěšného stíhání běžný cíl těžce ztratí na prioritě
              }

              if (score > bestTargetScore) { bestTargetScore = score; bestTarget = e; }
          }
      }

      // 6. Pud sebezáchovy (Kritické HP)
      let myHpPct = this.hp / this.effectiveMaxHp;
      if (myHpPct < 0.15) {
          let almostDone = false;
          if (bestState === 'CAPTURE' && bestObjective && bestObjective.control !== undefined) {
              let progressVal = (this.team === 0) ? (bestObjective.control + 100)/200 : (100 - bestObjective.control)/200;
              if (progressVal > 0.85) almostDone = true; // Riskne to a zkusí to dotáhnout
          }
          if (!almostDone) this.terrified = true; // Zpanikaří a utíká se zachránit
      }

      // 7. Hodnocení Volání o pomoc
      if (this.helpUrgeTarget && this.helpUrgeTarget.alive !== false && !this.helpUrgeTarget.dead) {
          let dToHelp = dist(this.pos, this.helpUrgeTarget.pos);
          let maxHelpDist = this.role === 'SUPPORT' ? 2500 : 1500;
          if (dToHelp < maxHelpDist) { // Běží pomoct i z větší dálky, než je běžný vision
              let score = (this.role === 'SUPPORT' ? 40000 : 30000) - dToHelp; // Zvýšeno, aby pomoc přebila i pushování a PowerUp
              if (score > bestTargetScore) { bestTargetScore = score; bestTarget = this.helpUrgeTarget; }
          } else {
              this.helpUrgeTarget = null; // Cíl pomoci se příliš vzdálil
          }
      }

      // 8. Odeslání žádosti o pomoc
      let isStalemate = (this.state === 'ATTACK' && this.target && this.tankStalemateTarget === this.target);
      if (this.state === 'ATTACK' && this.target) {
          let now = performance.now();
          
          // Zkontrolujeme cooldown na volání o pomoc (5 vteřin)
          if (!this.lastHelpCallTime || now - this.lastHelpCallTime > 5000) {
              let winProb = this.predictFightOutcome(this.target);
              // Voláme pomoc pokud je to Stalemate, NEBO pokud reálně prohráváme souboj (WinProb < 45%)
              if (isStalemate || winProb < 0.45) {
                  this.lastHelpCallTime = now;
                  if (isStalemate || Math.random() < 0.5) { // 100% šance při stalemate, jinak 50%
                      let allies = aliveAllies.filter(p => p instanceof BotPlayer && p.id !== this.id);
                      for (let ally of allies) {
                          let hearRadius = ally.role === 'SUPPORT' ? 2000 : 1200;
                          if (dist(ally.pos, this.pos) > hearRadius) continue;

                          let isBusy = false;
                          if (ally.state === 'ATTACK') isBusy = true; // Zrovna bojuje
                          if (ally.state === 'PICKUP' && ally.objective && ally.objective.type === 'heal') isBusy = true; // Jde se léčit
                          if ((ally.state === 'CAPTURE' || ally.state === 'PUSH') && ally.objective && ally.objective.pos) {
                              if (dist(ally.pos, ally.objective.pos) < dist(ally.pos, this.pos)) isBusy = true; // Má bližší objektiv, než je vzdálenost k volajícímu
                          }

                          // SUPPORT zahodí práci a jde pomoct, pokud sám neumírá
                          if (ally.role === 'SUPPORT' && (ally.hp / ally.effectiveMaxHp > 0.35)) {
                              isBusy = false;
                          }

                          if (!isBusy) {
                              ally.helpUrgeTarget = this.target; // Přepošleme mu nepřítele
                              ally.helpUrgeTimer = ally.role === 'SUPPORT' ? 8.0 : 5.0; // Support se snaží déle
                          }
                      }
                  }
              }
          }
      }

      // 9. Zbabělý útěk (Terrified)
      if (this.terrified) {
          bestObjScore = 35000; // Sníženo pro vyváženost
          
          let fleePos = spawnPoints[this.team];
          let bestFleeDist = Infinity;
          let fleeRadius = 200; // Výchozí radius pro spawn
          
          // 1. Zkusíme utéct k nejbližší lékárničce
          for (let h of game.heals) {
              if (h.active) { let d = dist(this.pos, h.pos); if (d < bestFleeDist) { bestFleeDist = d; fleePos = h.pos; fleeRadius = 20; } }
          }
          
          // 2. Pokud žádná není blízko (dál než 1500 unitů), běžíme k nejbližšímu spojenci
          if (bestFleeDist > 1500) {
              for (let p of aliveAllies) {
                  if (p.id !== this.id) { let d = dist(this.pos, p.pos); if (d < bestFleeDist) { bestFleeDist = d; fleePos = p.pos; fleeRadius = 150; } }
              }
          }
          
          bestObjective = { pos: fleePos, type: 'flee', captureRadius: fleeRadius };
          bestState = 'PICKUP'; // Zneužijeme PUSH/PICKUP logiku pro prostý běh
          bestTargetScore = -Infinity;
          bestTarget = null;
      }

      // 10. Rozhodnutí: Cíl vs Objektiv
      let shouldAttack = false;
      if (bestTarget) {
          let d = dist(this.pos, bestTarget.pos);
          let isLowHp = bestTarget.hp / (bestTarget.effectiveMaxHp || bestTarget.maxHp) < 0.3;
          let isUnderAttack = this.recentAttackers && this.recentAttackers.has(bestTarget.id);
          
          // Pokud máme málo HP a jdeme si pro lékárničku, ignorujeme boj na dálku a jdeme se léčit
          let isDesperateForHeal = (bestState === 'PICKUP' && bestObjective && bestObjective.type === 'heal' && this.hp / this.effectiveMaxHp < 0.6);
          // PŘIDÁNO: Pokud běžíme zabrat blízkou věž, ignorujeme boj do doby, než vlezeme do kruhu
          let isTravelingToMacro = (this.macroOrder !== null && bestObjScore > 50000 && dist(this.pos, bestObjective.pos) > 200); // Cestuje na příkaz mozku
          let isDesperateForTower = (bestState === 'CAPTURE' && bestObjective && bestObjective.owner !== this.team && dist(this.pos, bestObjective.pos) > (bestObjective.captureRadius || 80));
          let isDefendingTower = ((bestState === 'CAPTURE' || bestState === 'DEFEND') && bestObjective && dist(this.pos, bestObjective.pos) < 200 && d < 400);
          
          if (isDesperateForHeal) {
              if (d < 150) shouldAttack = true; // Bráníme se jen v sebeobraně nablízko
          } else if ((isDesperateForTower || isTravelingToMacro) && !isUnderAttack) {
              if (d < 200 || isLowHp) shouldAttack = true; // Máme klapky na oči a plníme rozkaz, ignorujeme rvačky v dálce
          } else {
              // Útočíme, pokud je cíl blízko, má low HP, nic jiného nehoří, běžíme na pomoc NEBO DO NÁS NĚKDO STŘÍLÍ
              if (d < 400 || isLowHp || bestObjScore < this.personalWeights.objectiveFocusThreshold || bestTargetScore >= 20000 || isDefendingTower || isUnderAttack) shouldAttack = true;
          }
      }

      if (shouldAttack) {
          this.state = 'ATTACK';
          this.target = bestTarget;
          this.currentScore = bestTargetScore;
          if (bestObjective) this.objective = bestObjective; // Zapamatujeme si cestu
      } else if (bestObjective) {
          this.state = bestState;
          this.objective = bestObjective;
          this.target = null;
          this.currentScore = bestObjScore;
      } else {
          this.state = 'SEARCHING';
          this.objective = null;
          this.target = null;
          this.currentScore = 0;
      }

      // --- SDÍLENÍ NA NÁSTĚNCE ---
      game.teamIntents[this.team][this.id] = { state: this.state, objective: this.objective, target: this.target };
    }

    // ==========================================
    // VRSTVA 3: OPERATIVA (Mikro management - Každý frame)
    // ==========================================
    update(dt) {
      if (socket && !game.isHost) {
          if(this.flashTimer > 0) this.flashTimer -= dt;
          if(this.attackCooldown > 0) this.attackCooldown -= dt;
          if(this.castingTimeRemaining > 0) this.castingTimeRemaining -= dt;
          for(let k of Object.keys(this.spells)){ if(this.spells[k].cd>0) this.spells[k].cd -= dt; }
          if(this.hasPowerup){ this.powerupTimer -= dt; if(this.powerupTimer <= 0) this.hasPowerup = false; }
          if(this.summonerCooldown > 0) this.summonerCooldown -= dt;
          if(this.boostTimer > 0) this.boostTimer -= dt;
          if(this.rallyTimer > 0) this.rallyTimer -= dt;
          if(this.slowTimer > 0) this.slowTimer -= dt;
          if(this.msBuffTimer > 0) this.msBuffTimer -= dt;
          if(this.levelUpTimer > 0) this.levelUpTimer -= dt;
          if(this.adAsBuffTimer > 0) this.adAsBuffTimer -= dt;
          if(this.shieldTimer > 0) { 
              this.shieldTimer -= dt; 
              if(this.shieldTimer <= 0 && !this.shieldExplodeData) this.shield = 0; 
          }
          if(this.silenceTimer > 0) this.silenceTimer -= dt;
      if(this.stunTimer > 0) this.stunTimer -= dt;
          if(this.hanaBuffTimer > 0) this.hanaBuffTimer -= dt;
          if(this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
          if(this.defBuffTimer > 0) this.defBuffTimer -= dt;
          if(this.reaperCharge > 0) {
              this.reaperTimer -= dt;
              if(this.reaperTimer <= 0) this.reaperCharge = 0;
          }

          // Lokální vykreslení exploze štítu u cizích botů
          if (this.shieldExplodeData) {
              this.shieldExplodeData.timer -= dt;
              if (this.shieldExplodeData.timer <= 0 || this.shield <= 0) {
                  let expl = this.shieldExplodeData;
                  game.particles.push(new Particle(this.pos.x, this.pos.y, '#aaa', {shape: 'ring', radius: expl.radius, life: 0.4, speed: 0, lineWidth: 4}));
                  for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= expl.radius){ applyDamage(m, expl.damage, expl.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); } }
                  for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= expl.radius){ applyDamage(p, expl.damage, expl.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); } }
                  spawnParticles(this.pos.x, this.pos.y, 10, '#aaa');
                  this.shieldExplodeData = null;
                  this.shield = 0;
              }
          }

          // Lokální vykreslení plynulého dashe a exploze na konci dashe u cizích botů
          if (this.dashTimer > 0) {
              this.dashTimer -= dt;
              moveEntityWithCollision(this, this.dashVel.x, this.dashVel.y, dt);
              if (Math.random() < 0.4 && Math.hypot(this.dashVel.x, this.dashVel.y) > 250) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2});
              if (this.dashTimer <= 0 && this.dashEndExplosion) {
                 const expl = this.dashEndExplosion; const range = expl.radius;
                 game.particles.push(new Particle(this.pos.x, this.pos.y, '#f80', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
                 for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, expl.damage, expl.dmgType, expl.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); } }
                 for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, expl.damage, expl.dmgType, expl.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); } }
                 spawnParticles(this.pos.x, this.pos.y, 10, '#f80');
                 this.dashEndExplosion = null;
              }
              return;
          }

          if (this.knockbackTimer > 0) {
              this.knockbackTimer -= dt;
              moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt);
              return;
          }
          if (this.targetPos) {
              if (dist(this.pos, this.targetPos) > 200) { this.pos.x = this.targetPos.x; this.pos.y = this.targetPos.y; }
              else { this.pos.x += (this.targetPos.x - this.pos.x) * 15 * dt; this.pos.y += (this.targetPos.y - this.pos.y) * 15 * dt; }
          }
          return;
      }
      if(game.gameOver) return;
      if(game.startDelay > 0) return; // Boti čekají na start hry
      if(!this.alive){
          if (!socket || game.isHost) { // Respawn logika pouze na Hostovi
              if (this.summonerSpell === 'Revive' && this.summonerCooldown <= 0) { this.castSummonerSpell(); return; }
              this.respawnTimer -= dt; if(this.respawnTimer <= 0) this.revive(); 
          }
          return; 
      }
      
      if(this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
      if(this.defBuffTimer > 0) this.defBuffTimer -= dt;
      if(this.adAsBuffTimer > 0) this.adAsBuffTimer -= dt;
      if(this.shieldTimer > 0) { 
          this.shieldTimer -= dt; 
          if(this.shieldTimer <= 0 && !this.shieldExplodeData) this.shield = 0; 
      }
      if(this.silenceTimer > 0) this.silenceTimer -= dt;
      if(this.stunTimer > 0) this.stunTimer -= dt;
      if(this.reaperCharge > 0) {
          this.reaperTimer -= dt;
          if(this.reaperTimer <= 0) this.reaperCharge = 0;
      }
      if(this.hanaBuffTimer > 0) this.hanaBuffTimer -= dt;
      if(this.regenBuffTimer > 0) {
          this.regenBuffTimer -= dt;
          if (this === player || (!socket || game.isHost)) { this.hp = Math.min(this.effectiveMaxHp, this.hp + this.regenBuffAmount * dt); }
          if (Math.random() < 0.1) spawnParticles(this.pos.x, this.pos.y, 1, '#0f0', {life: 0.3});
      }
      
      // Tyto timery jsou lokální pro vizuální efekty a cooldowny, ale jejich efekty jsou Host-only
      if(this.flashTimer > 0) this.flashTimer -= dt; 
      if(this.attackCooldown > 0) this.attackCooldown -= dt; 
      if(this.attackPenaltyTimer > 0) this.attackPenaltyTimer -= dt; 
      if(this.summonerCooldown > 0) this.summonerCooldown -= dt; 

      if(this.boostTimer > 0) this.boostTimer -= dt;
      if(this.rallyTimer > 0) this.rallyTimer -= dt;
      if(this.slowTimer > 0) this.slowTimer -= dt;

      if (this.summonerCooldown <= 0 && (!socket || game.isHost)) { 
          let castSumm = false;
          switch(this.summonerSpell) {
              case 'Heal': if(this.hp / this.effectiveMaxHp < 0.3) castSumm = true; break;
              case 'Ghost': if(this.state === 'ATTACK' && this.target && dist(this.pos, this.target.pos) > 400 && this.target.hp / this.target.effectiveMaxHp < 0.5) castSumm = true; break;
              case 'Boost': if(this.state === 'ATTACK' && this.target && dist(this.pos, this.target.pos) < 300) castSumm = true; break;
              case 'Rally': if(this.state === 'CAPTURE' && this.objective && dist(this.pos, this.objective.pos) < 80) castSumm = true; break;
              case 'Exhaust': if(this.state === 'ATTACK' && this.target && dist(this.pos, this.target.pos) < 250) castSumm = true; break;
          }
          if (castSumm) this.castSummonerSpell();
      }

      if(this.hasPowerup) {
          this.powerupTimer -= dt;
          if(this.powerupTimer <= 0) this.hasPowerup = false;
      }

      // Passive HP Regen & Fountain - Host-only
      if (!socket || game.isHost) {
          if(this.hp < this.effectiveMaxHp) this.hp = Math.min(this.effectiveMaxHp, this.hp + this.hpRegen * dt);
          const allyBaseDist = dist(this.pos, spawnPoints[this.team]);
          if (allyBaseDist < 200) this.hp = Math.min(this.effectiveMaxHp, this.hp + (this.effectiveMaxHp * 0.15 * dt));
          const enemyBaseDist = dist(this.pos, spawnPoints[1-this.team]);
          if (enemyBaseDist < 200) { applyDamage(this, 1000 * dt, 'true', 'laser'); if(this.hp<=0) handlePlayerKill(this, 'laser'); }
      }

      for(let k of Object.keys(this.spells)){ const sp = this.spells[k]; if(sp.cd>0) sp.cd = Math.max(0, sp.cd - dt); }
      if(this.castingTimeRemaining > 0){ this.castingTimeRemaining -= dt; if(this.castingTimeRemaining <= 0) this.castingTimeRemaining = 0; }
      while(this.exp >= expForLevel(this.level)){ this.exp -= expForLevel(this.level); this.levelUp(); }
      
      if(this.levelUpTimer > 0) this.levelUpTimer -= dt;

      if(this.msBuffTimer > 0) this.msBuffTimer -= dt;

      
      // Timer pro volání o pomoc (Když mu někdo dá prioritu cizího targetu, drží mu to 5 vteřin)
      if(this.helpUrgeTimer > 0) {
          this.helpUrgeTimer -= dt;
          if(this.helpUrgeTimer <= 0) this.helpUrgeTarget = null;
      }

      if(this.guardData) {
          this.guardData.radius -= 80 * dt; // Zmenšování sledovacího pole
          let enemyInRadius = game.players.some(p => p.team !== this.team && p.alive && dist(p.pos, this.guardData.tower.pos) < this.guardData.radius);
          if (!enemyInRadius || this.guardData.radius <= 0) {
              this.guardData = null;
          }
      }

      if (this.dashTimer > 0) {
          this.dashTimer -= dt;
          moveEntityWithCollision(this, this.dashVel.x, this.dashVel.y, dt);
          if (Math.random() < 0.4) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2});
          if (Math.random() < 0.4 && Math.hypot(this.dashVel.x, this.dashVel.y) > 250) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2});
          if (this.dashTimer <= 0 && this.dashEndExplosion) {
             const expl = this.dashEndExplosion; const range = expl.radius;
             game.particles.push(new Particle(this.pos.x, this.pos.y, '#f80', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
             for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, expl.damage, expl.dmgType, expl.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; if (!socket || game.isHost) grantRewards(this, 10, 15); } } }
             for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, expl.damage, expl.dmgType, expl.id); if (expl.silenceDuration) { p.silenceTimer = Math.max(p.silenceTimer || 0, expl.silenceDuration); game.effectTexts.push(new EffectText(p.pos.x, p.pos.y-20, "SILENCED", '#fff')); } if (expl.slowDuration) { p.slowTimer = Math.max(p.slowTimer || 0, expl.slowDuration); p.slowMod = expl.slowMod || 0.6; } spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, expl.id); } } }
             spawnParticles(this.pos.x, this.pos.y, 10, '#f80');
             this.dashEndExplosion = null;
          }
          return;
      }

      if (this.knockbackTimer > 0) {
          this.knockbackTimer -= dt;
          moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt);
          return;
      }

      if (this.castingTimeRemaining > 0) return;

      // --- SPOUŠTĚNÍ CENTRÁLNÍHO MOZKU (1x za 1.5s pro celý tým na Hostiteli) ---
      if (!game.lastBrainTick) game.lastBrainTick = { 0: 0, 1: 0 };
      game.lastBrainTick[this.team] -= dt;
      if (game.lastBrainTick[this.team] <= 0) {
          game.lastBrainTick[this.team] = 1.5;
          BotPlayer.runCentralBrain(this.team);
      }

      this.tacticTimer -= dt;
      if (this.tacticTimer <= 0) { this.tacticTimer = 0.25 + Math.random()*0.1; this.evaluateTactic(); }

      // Spuštění Operativy
      this.executeOperative(dt);
    }

    executeOperative(dt) {
      
      if (this.stunTimer > 0) return;

      // --- ANTI-STUCK MECHANISMUS ---
      this.posCheckTimer = (this.posCheckTimer || 0) + dt;
      if (this.posCheckTimer >= 0.25) {
          this.posCheckTimer = 0;
          if (this.lastPosCheck && dist(this.pos, this.lastPosCheck) < 5) {
                  let nearWall = false;
                  for (let w of game.walls) {
                      let info = distToPoly(this.pos.x, this.pos.y, w.pts);
                      if (info.minDist <= w.r + 50 || info.inside) {
                          nearWall = true; break;
                      }
                  }
                  
                  if (nearWall) {
                      let tgtPos = (this.objective && this.objective.pos) ? this.objective.pos : (this.target ? this.target.pos : {x: world.width/2, y: world.height/2});
                      let objAng = Math.atan2(tgtPos.y - this.pos.y, tgtPos.x - this.pos.x);
                      let dir = Math.random() > 0.5 ? 1 : -1;
                      let ang = objAng + dir * Math.PI / 2;

                      let dashed = false;
                      for (let key of ['Q', 'E']) {
                          let sp = this.spells[key];
                          if (sp && sp.cd <= 0 && (sp.type === 'dash' || sp.type === 'dash_def')) {
                              this.castSpell(key, this.pos.x + Math.cos(ang)*200, this.pos.y + Math.sin(ang)*200);
                              dashed = true; break;
                          }
                      }
                      if (!dashed) {
                          let spd = this.speed; // Reálná rychlost konkrétního bota
                          this.dashTimer = 200 / spd; // Bude mu trvat adekvátní čas ujít 200 unitů
                          this.dashVel = { x: Math.cos(ang) * spd, y: Math.sin(ang) * spd }; 
                      }
                  }
          }
          this.lastPosCheck = { x: this.pos.x, y: this.pos.y };
      }

      // --- MICRO: WAVE CLEAR (AOE kouzla do skupinky minionů) ---
      this.waveClearTimer = (this.waveClearTimer || 0) - dt;
      if (this.castingTimeRemaining <= 0 && this.waveClearTimer <= 0) {
          this.waveClearTimer = 1.0 + Math.random() * 1.5; // Zkusí to vyhodnotit jen jednou za 1 až 2.5 vteřiny
          if (Math.random() < 0.65) { // 65% šance, že plošné kouzlo na miniony vůbec vyplýtvá
              for (let key of ['Q', 'E']) {
                  let sp = this.spells[key];
                  if (sp && sp.cd <= 0 && (sp.type === 'aoe' || sp.type === 'aoe_knockback')) {
                      let hitCount = 0;
                      let r = sp.radius || 150;
                      for (let m of game.minions) {
                          if (!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= r) {
                              hitCount++;
                          }
                      }
                      if (hitCount >= 3) {
                          this.castSpell(key, this.pos.x, this.pos.y);
                          break;
                      }
                  }
              }
          }
      }

      // --- MICRO: POWER-UP CONTEST OVERRIDE (Okamžitá reakce na krádež) ---
      this.powerupCheckTimer = (this.powerupCheckTimer || 0) - dt;
      if (game.powerup && game.powerup.active && !this.terrified && this.powerupCheckTimer <= 0) {
          this.powerupCheckTimer = 1.0 + Math.random() * 1.0; // Rozhoduje se 1x za 1 až 2 vteřiny
          if (dist(this.pos, game.powerup.pos) <= 500) {
              let capturer = game.players.find(p => p.alive && p.team !== this.team && dist(p.pos, game.powerup.pos) <= game.powerup.radius);
              if (capturer && this.target !== capturer) {
                  if (Math.random() < 0.60 && this.predictFightOutcome(capturer) >= 0.50) { // HUMAN FACTOR: 60% šance všimnutí
                      this.state = 'ATTACK';
                      this.target = capturer;
                  }
              }
          }
      }

      // --- OPERATIVNÍ LOGIKA POHYBU A ÚTOKU ---
      let dx = 0, dy = 0;
      let isKiting = false; // Vlajka pro střelbu za běhu

      if (this.state === 'ATTACK') {
          if (this.target && (this.target.hp > 0 && (this.target.alive !== false && !this.target.dead))) {
              let tx = this.target.pos.x;
              let ty = this.target.pos.y;
              let d = dist(this.pos, this.target.pos);

              // --- PRO GAMER: PREDIKCE MÍŘENÍ (LEADING) ---
              if (this.target.vel && (Math.abs(this.target.vel.x) > 10 || Math.abs(this.target.vel.y) > 10)) {
                  // Šance na predikci roste s levelem bota (Lvl 1 = 50%, Lvl 10 = 90%)
                  if (Math.random() < 0.46 + (this.level * 0.04)) {
                      let pSpeed = this.range ? 800 : 1000; // Průměrná rychlost střely (Basic attack / Spelly)
                      let travelTime = d / pSpeed;
                      let errorMod = 0.8 + Math.random() * 0.4; // 80% až 120% přesnost (Lidský faktor pro občasné minutí)
                      tx += this.target.vel.x * travelTime * errorMod;
                      ty += this.target.vel.y * travelTime * errorMod;
                  }
              }

              let atkRange = this.range ? Math.max(100, this.attackRange - 50) : Math.max(40, this.attackRange - 30);
              if (this.reaperCharge > 0) atkRange += 70; // Bot ví, že má s Q mnohem delší dosah
              
              if (d > atkRange + 20) {
                  this.chaseTimer = (this.chaseTimer || 0) + dt;
              } else {
                  this.chaseTimer = 0; // Jsem u cíle, timer se nuluje
              }

              // Movement Logic
              if (d > atkRange) { dx = tx - this.pos.x; dy = ty - this.pos.y; } // Chasing
              else if (this.range && d < atkRange - 150) { dx = this.pos.x - tx; dy = this.pos.y - ty; } // Kiting pro střelce
              else { 
                  let strafeDir = (parseInt(this.id.split('_')[1] || '0') % 2 === 0) ? 1 : -1;
                  dx = -(ty - this.pos.y) * strafeDir; dy = (tx - this.pos.x) * strafeDir; 
              } // Strafeování (každý bot krouží na jinou stranu)
              
              // PRIORITIZACE VĚŽE BĚHEM SOUBOJE:
              let fightObjective = this.objective || game.towers.sort((a,b)=>dist(a.pos,this.pos)-dist(b.pos,this.pos))[0];
              if (fightObjective) {
                  let odx = fightObjective.pos.x - this.pos.x;
                  let ody = fightObjective.pos.y - this.pos.y;
                  let odist = Math.hypot(odx, ody);
                  let isCapturing = (fightObjective.owner !== undefined && fightObjective.owner !== this.team);
                  let cRad = fightObjective.captureRadius || 80;
                  
                  if (isCapturing && odist > cRad - 15) {
                      let pullStr = Math.max(200, d * 2.0); 
                      dx += (odx/odist) * pullStr; 
                      dy += (ody/odist) * pullStr;
                  } else if (odist > 50 && odist < 600) { 
                      let pullStr = Math.max(10, d * 0.6);
                      dx += (odx/odist) * pullStr; 
                      dy += (ody/odist) * pullStr;
                  }
              }
              
              this.aimAngle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
              
              // Basic Attack
              if (this.attackCooldown <= 0 && d <= atkRange + 20) { 
                  this.shoot(tx, ty); 
                  let effAS = this.attackSpeed * (this.adAsBuffTimer > 0 ? 1 + this.adAsBuffAmount : 1.0);
                  this.attackCooldown = this.attackDelay / effAS; 
              }
              
              // Spells Logic (Q)
              let isMeleeVsRanged = !this.range && this.target.range;
              if (this.spells.Q && this.spells.Q.cd <= 0 && this.castingTimeRemaining <= 0) {
                  let castQ = false; let qtx = tx, qty = ty;
                  if (this.spells.Q.type === 'heal_self' || this.spells.Q.type === 'hana_q') castQ = (this.hp < this.effectiveMaxHp * 0.7);
                  else if (this.spells.Q.type === 'dash' || this.spells.Q.type === 'dash_def') {
                      if (this.range) { if (d < 250) { castQ = true; qtx = this.pos.x + (this.pos.x - tx); qty = this.pos.y + (this.pos.y - ty); } }
                      if (isMeleeVsRanged) { if (d > this.attackRange && d < this.attackRange + 250) castQ = true; } // Rytíř si šetří dash, dokud se mu lučištník nezačne vzdalovat
                      else if (this.range) { if (d < 250) { castQ = true; qtx = this.pos.x + (this.pos.x - tx); qty = this.pos.y + (this.pos.y - ty); } }
                      else { if (d > 150 && d < 400) castQ = true; }
                  } else if (this.spells.Q.type === 'buff_ms') castQ = (d < 600);
                  else if (this.spells.Q.type === 'aoe' || this.spells.Q.type === 'aoe_knockback') castQ = (d < (this.spells.Q.radius || 200));
                  else if (this.spells.Q.type === 'projectile_egg') castQ = (d < 260);
                  else if (this.spells.Q.type === 'reaper_q') castQ = (d < 350 && this.reaperCharge === 0);
                  else castQ = (d < 450);
                  if (castQ) this.castSpell('Q', qtx, qty);
              }
              
              // Spells Logic (E)
              if (this.spells.E && this.spells.E.cd <= 0 && this.castingTimeRemaining <= 0) {
                  let castE = false; let etx = tx, ety = ty;
                  if (this.spells.E.type === 'heal_self' || this.spells.E.type === 'hana_q') castE = (this.hp < this.effectiveMaxHp * 0.6);
                  else if (this.spells.E.type === 'heal_aoe') castE = (this.hp < this.effectiveMaxHp * 0.7);
                  else if (this.spells.E.type === 'summon_healers') castE = (this.hp < this.effectiveMaxHp * 0.8 || d < 400);
                  else if (this.spells.E.type === 'dash' || this.spells.E.type === 'dash_def') {
                      if (this.range) { if (d < 250) { castE = true; etx = this.pos.x + (this.pos.x - tx); ety = this.pos.y + (this.pos.y - ty); } }
                      if (isMeleeVsRanged) { if (d > this.attackRange && d < this.attackRange + 250) castE = true; } // Chytré zkrácení vzdálenosti
                      else if (this.range) { if (d < 250) { castE = true; etx = this.pos.x + (this.pos.x - tx); ety = this.pos.y + (this.pos.y - ty); } }
                      else { if (d > 150 && d < 400) castE = true; }
                  } else if (this.spells.E.type === 'aoe' || this.spells.E.type === 'aoe_knockback') castE = (d < (this.spells.E.radius || 200));
                  else if (this.spells.E.type === 'reaper_e') castE = (d > 100 && d < 350) || (this.spells.Q.cd > 2.0 && d < 200);
                  else castE = (d < (this.spells.E.radius || 250));
                  if (castE) this.castSpell('E', etx, ety);
              }
          } else {
              this.state = 'SEARCHING';
          }
      } 
      else if ((this.state === 'CAPTURE' || this.state === 'PUSH' || this.state === 'PICKUP') && this.objective) {
          let dToObj = dist(this.pos, this.objective.pos);
          let stopRadius = this.objective.captureRadius !== undefined ? this.objective.captureRadius - 10 : 80;
          if (dToObj > stopRadius) { // Zastavíme u cíle (u věže nebo u minionů)
              dx = this.objective.pos.x - this.pos.x;
              dy = this.objective.pos.y - this.pos.y;
              
              // --- POUŽITÍ POHYBOVÝCH KOUZEL K PŘIBLÍŽENÍ ---
              if (dToObj > stopRadius + 200 && this.castingTimeRemaining <= 0) { // Zabráníme overshootu u věže
                  for (let key of ['Q', 'E']) {
                      let sp = this.spells[key];
                      if (sp && sp.cd <= 0 && (sp.type === 'dash' || sp.type === 'dash_def' || sp.type === 'buff_ms')) {
                          this.castSpell(key, this.objective.pos.x, this.objective.pos.y);
                          break; // Použije jen jedno kouzlo naráz
                      }
                  }
              }
          }
      }

      // --- KITING BĚHEM ÚTĚKU / PŘESUNU ---
      if (this.state !== 'ATTACK') {
          let atkRange = this.attackRange + 20;
          let kitingTarget = null;
          let bestKDist = atkRange;
          
          for (let p of game.players) {
              if (p.team !== this.team && p.alive) {
                  let d = dist(this.pos, p.pos);
                  if (d <= bestKDist) { bestKDist = d; kitingTarget = p; }
              }
          }
          if (!kitingTarget) {
              for (let m of game.minions) {
                  if (m.team !== this.team && !m.dead) {
                      let d = dist(this.pos, m.pos);
                      if (d <= bestKDist) { bestKDist = d; kitingTarget = m; }
                  }
              }
          }
          if (kitingTarget) {
              let d = dist(this.pos, kitingTarget.pos);
              if (this.range || d <= this.attackRange + 20) { // Melee boti nemáchají zbraní do prázdna, když utíkají
                  isKiting = true;
                  this.aimAngle = Math.atan2(kitingTarget.pos.y - this.pos.y, kitingTarget.pos.x - this.pos.x);
                  if (this.attackCooldown <= 0) { 
                      this.shoot(kitingTarget.pos.x, kitingTarget.pos.y); 
                      let effAS = this.attackSpeed * (this.adAsBuffTimer > 0 ? 1 + this.adAsBuffAmount : 1.0);
                      this.attackCooldown = this.attackDelay / effAS; 
                  }
                  this.kitingSpellTimer = (this.kitingSpellTimer || 0) - dt;
                  if (this.castingTimeRemaining <= 0 && this.kitingSpellTimer <= 0) {
                      this.kitingSpellTimer = 0.8 + Math.random() * 0.8; // Rozhodne se zkusit kouzlo za sebe hodit max 1x za ~1s
                      let isMinion = !kitingTarget.className;
                      if (this.spells.Q && this.spells.Q.cd <= 0 && !['dash', 'dash_def', 'buff_ms', 'heal_self', 'hana_q'].includes(this.spells.Q.type)) {
                          let chance = (isMinion && this.spells.Q.type === 'aoe') ? 1.0 : 0.60;
                          if (Math.random() < chance) this.castSpell('Q', kitingTarget.pos.x, kitingTarget.pos.y);
                      }
                      else if (this.spells.E && this.spells.E.cd <= 0 && !['dash', 'dash_def', 'buff_ms', 'heal_self', 'hana_q'].includes(this.spells.E.type)) {
                          let chance = (isMinion && this.spells.E.type === 'aoe') ? 1.0 : 0.60;
                          if (Math.random() < chance) this.castSpell('E', kitingTarget.pos.x, kitingTarget.pos.y);
                      }
                  }
              }
          }
      }

      // --- MICRO: VYHÝBÁNÍ SE SKILLSHOTŮM (DODGING) ---
      let dodgeDx = 0, dodgeDy = 0;
      this.dodgeBlindTimer = (this.dodgeBlindTimer || 0) - dt;
      this.dodgeFocusTimer = (this.dodgeFocusTimer || 0) - dt;

      if (this.dodgeBlindTimer <= 0) {
      for (let proj of game.projectiles) {
          if (proj.ownerTeam !== this.team && !proj.dead) {
              let pdDist = dist(this.pos, proj.pos);
              if (pdDist < 250 * this.microDodgeMod) { // Sníženo vidění hrozeb z 350 na 250
                  let pLen = Math.hypot(proj.vel.x, proj.vel.y);
                  if (pLen > 0) {
                      let pDirX = proj.vel.x / pLen, pDirY = proj.vel.y / pLen;
                      let toMeX = this.pos.x - proj.pos.x, toMeY = this.pos.y - proj.pos.y;
                      let dot = toMeX * pDirX + toMeY * pDirY;
                      // Zkontrolujeme, zda projektil směřuje k nám (dot > 0) a neletí už za nás
                      if (dot > 0 && dot < pdDist + 50 * this.microDodgeMod) {
                          let projX = proj.pos.x + pDirX * dot, projY = proj.pos.y + pDirY * dot;
                          let distToLine = dist(this.pos, {x: projX, y: projY});
                          if (distToLine < this.radius + (proj.radius || 8) + 35 * this.microDodgeMod) { // Širší "bezpečná zóna"
                              
                              // HUMAN FACTOR ROZHODOVÁNÍ
                              if (this.dodgeFocusTimer <= 0) {
                                  // 35% základní šance, že si letící střely včas všimne (Sníženo z 70%)
                                  if (Math.random() < 0.35 * this.microDodgeMod) {
                                      this.dodgeFocusTimer = 1.0; // Úspěšný postřeh! Uhýbá perfektně další 1 vteřinu
                                  } else {
                                      this.dodgeBlindTimer = 0.5 + Math.random() * 0.5; // Zazmatkoval, ztuhne na delší dobu
                                      break; // Neprovede se dodge
                                  }
                              }

                              let crossX = this.pos.x - projX, crossY = this.pos.y - projY;
                              let cLen = Math.hypot(crossX, crossY);
                              let dodgeForce = 1200 * this.microDodgeMod;
                              if (cLen > 0) { dodgeDx += (crossX / cLen) * dodgeForce; dodgeDy += (crossY / cLen) * dodgeForce; } // Tvrdý úkrok do strany
                              else { dodgeDx += -pDirY * dodgeForce; dodgeDy += pDirX * dodgeForce; }
                          }
                      }
                  }
              }
          }
      }
      }
      if (dodgeDx !== 0 || dodgeDy !== 0) { dx += dodgeDx; dy += dodgeDy; }

      const l = Math.hypot(dx, dy);
       let moveSpeed = this.speed * (this.hasPowerup ? 1.2 : 1.0) * (this.msBuffTimer > 0 ? (1 + this.msBuffAmount) : 1.0) * (this.slowTimer > 0 ? (this.slowMod || 0.6) : 1.0);
      if (this.attackPenaltyTimer > 0) moveSpeed *= (this.range ? 0.6 : 0.85);
      if (l > 0) { 
          dx /= l; dy /= l; 
          
          // --- JEMNÉ VYHÝBÁNÍ ZDEM (Wall avoidance) ---
          for (let w of game.walls) {
              let info = distToPoly(this.pos.x, this.pos.y, w.pts);
              if (info.minDist < w.r + 40 && !info.inside) {
                  dx += info.closestNorm.x * 0.8; // Odstrčení od zdi
                  dy += info.closestNorm.y * 0.8;
                  
                  let tx = -info.closestNorm.y; 
                  let ty = info.closestNorm.x;
                  if (dx * tx + dy * ty < 0) { tx = -tx; ty = -ty; }
                  dx += tx * 1.5; // Skluz podél zdi
                  dy += ty * 1.5;
              }
          }
          // Znovu znormalizujeme úpravy ze zdi
          let finalL = Math.hypot(dx, dy);
          if (finalL > 0) { dx /= finalL; dy /= finalL; }

          if (this.state !== 'ATTACK' && !isKiting) this.aimAngle = Math.atan2(dy, dx);
          moveEntityWithCollision(this, dx * moveSpeed, dy * moveSpeed, dt); 
      }
    }
  }
  