import { dist, distToPoly, expForLevel } from './Utils.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { shopItems } from './items.js';
import { game, TEAM_COLOR, NEUTRAL_COLOR, RANGED_ATTACK_RANGE, MELEE_ATTACK_RANGE, BOT_WEIGHTS } from './State.js';
import { spawnPoints, mapBoundary } from './MapConfig.js';
import { Particle, spawnParticles, EffectText } from './Effects.js';
import { Projectile, Minion } from './Entities.js';
import { socket, applyDamage, applyHeal, handlePlayerKill, moveEntityWithCollision, drawHealthBar, flashMessage, player, keys, buyItem } from './main.js';
import { updateSpellLabels } from './UI.js';

export class Player{
  constructor(x,y,opts={}){
    this.pos = {x,y}; this.vel = {x:0,y:0}; this.radius = 12;
    this.className = opts.className || 'Bruiser'; const cData = CLASSES[this.className];
    this.speed = cData.speed;
    this.glyph = cData.glyph; this.team = opts.team||0; this.id = opts.id||'player0';
    this.alive = true; this.respawnTimer = 0; this.respawnTime = 5;
    this.flashTimer = 0;
    this.dmgType = cData.dmgType;

    // stats
    this.maxHp = cData.hp; this.hp = this.maxHp; this.hpRegen = 2.0; 
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
    this.defBuffTimer = 0;
    this.hasPowerup = false; this.powerupTimer = 0;
    this.stats = { dmgDealt: 0, dmgTaken: 0, hpHealed: 0 };
    this.recentAttackers = new Map();

    this.isDirty = true; // Příznak pro síťovou optimalizaci
    // progression
    this.level = 1; this.exp = 0; this.spellPoints = 0;

    this.levelUpTimer = 0;
    // spells
    this.spells = {
      Q: { ...cData.Q, cd: 0, level: 1 },
      E: { ...cData.E, cd: 0, level: 1 }
    };

    
    this.castingTimeRemaining = 0;
    this.dashTimer = 0; this.dashVel = {x:0, y:0}; this.dashEndExplosion = null;
    this.knockbackTimer = 0; this.knockbackVel = {x:0, y:0};
    this.msBuffTimer = 0; this.msBuffAmount = 0;

    // basic attack


    // basic attack
    this.attackCooldown = 0; this.attackDelay = cData.attackDelay; this.range = cData.range;

    this.aimAngle = 0; // Uchovává směr, kam hráč míří

    this.items = [];
  }

  get effectiveMaxHp() { return Math.round(this.maxHp * (this.hasPowerup ? 1.2 : 1.0)); }

  computeSpellCooldown(spKey){ const sp = this.spells[spKey]; const base = sp.baseCooldown; const hasteFactor = Math.max(0, 1 - this.abilityHaste/100); const levelFactor = Math.pow(0.95, sp.level-1); return Math.max(0.4, base * hasteFactor * levelFactor); }

  die(){ this.alive = false; this.hasPowerup = false; this.deaths++; this.respawnTimer = Math.max(3, 4 + Math.floor(this.level * 0.5)); console.log(`[DEBUG] ${this.id} died. Respawning in ${this.respawnTimer}s.`); if(player && this.id === player.id) { game.shake = 0.5; flashMessage('You died — respawning...'); } }
  revive(){ this.alive = true; this.hp = this.effectiveMaxHp; const sp = spawnPoints[this.team]; if(sp) { this.pos.x = sp.x; this.pos.y = sp.y; } this.respawnTimer = 0; console.log(`[DEBUG] ${this.id} revived.`); }

  allocateSpellPoint(spKey){ if(this.spellPoints<=0) return; const sp = this.spells[spKey]; if(!sp) return; sp.level += 1; this.spellPoints -= 1; this.isDirty = true; updateSpellLabels(); }

  levelUp(){ 
    this.level += 1; this.spellPoints += 1; this.maxHp += 15; this.hp = Math.min(this.effectiveMaxHp, this.hp + 15); this.AD += 1; this.AP += 1; 
    this.levelUpTimer = 2.0;
    this.isDirty = true;
    spawnParticles(this.pos.x, this.pos.y, 25, '#ffcc00', {speed: 120, life: 1.0});
    console.log(`[DEBUG] ${this.id} leveled up to ${this.level}`);
  }

  update(dt){ if(game.gameOver) return;
    // handle death/respawn
    if(!this.alive){ this.respawnTimer -= dt; if(this.respawnTimer <= 0) this.revive(); return; }
    
    if(this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if(this.defBuffTimer > 0) this.defBuffTimer -= dt;
    if(this.summonerCooldown > 0) this.summonerCooldown -= dt;
    if(this.boostTimer > 0) this.boostTimer -= dt;
    if(this.rallyTimer > 0) this.rallyTimer -= dt;
    if(this.slowTimer > 0) this.slowTimer -= dt;

    if(this.regenBuffTimer > 0) {
        this.regenBuffTimer -= dt;
        if (this === player || (!socket || game.isHost)) { this.hp = Math.min(this.effectiveMaxHp, this.hp + this.regenBuffAmount * dt); }
        if (Math.random() < 0.1) spawnParticles(this.pos.x, this.pos.y, 1, '#0f0', {life: 0.3});
    }
    
    if(this.flashTimer > 0) this.flashTimer -= dt;

    if(this.hasPowerup) {
        this.powerupTimer -= dt;
        if(this.powerupTimer <= 0) this.hasPowerup = false;
    }

    if (this === player) {
        // Passive HP Regen
        if(this.hp < this.effectiveMaxHp) this.hp = Math.min(this.effectiveMaxHp, this.hp + this.hpRegen * dt);

        // Fountain Logic (Heal in own base, Laser in enemy base)
        const allyBaseDist = dist(this.pos, spawnPoints[this.team]);
        if (allyBaseDist < 200) this.hp = Math.min(this.effectiveMaxHp, this.hp + (this.effectiveMaxHp * 0.15 * dt));
        const enemyBaseDist = dist(this.pos, spawnPoints[1-this.team]);
        if (enemyBaseDist < 200) { applyDamage(this, 1000 * dt, 'true', 'laser'); if(this.hp<=0) handlePlayerKill(this, 'laser'); }

        // AUTO BUY
        if (game.autoPlay && (!this.alive || allyBaseDist < 250) && this.gold >= 300 && this.items.length < 25) {
            let itemToBuy = null;
            if (!this.hasBoots && this.gold >= 300) itemToBuy = shopItems.find(it => it.id === 'boots');
            else {
                let possibleItems = shopItems.filter(it => it.cost <= this.gold && it.id !== 'boots');
                if (possibleItems.length > 0) {
                    let prefs = possibleItems.filter(it => (this.dmgType === 'magical' && (it.id==='ap' || it.id==='mr')) || (this.dmgType === 'physical' && (it.id==='ad' || it.id==='as' || it.id==='armor')) || it.id==='hp');
                    itemToBuy = (prefs.length > 0) ? prefs[Math.floor(Math.random()*prefs.length)] : possibleItems[Math.floor(Math.random()*possibleItems.length)];
                }
            }
            if (itemToBuy) buyItem(itemToBuy.id);
        }
    }

    if(this.msBuffTimer > 0) this.msBuffTimer -= dt;

    // movement
    if(this.attackPenaltyTimer > 0) this.attackPenaltyTimer -= dt;
    let dx=0, dy=0, l=0;
    if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        moveEntityWithCollision(this, this.dashVel.x, this.dashVel.y, dt);
        if (Math.random() < 0.4) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2}); // Trail efekt
        if (this.dashTimer <= 0 && this.dashEndExplosion) {
           const expl = this.dashEndExplosion; const range = expl.radius;
           game.particles.push(new Particle(this.pos.x, this.pos.y, '#f80', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
           for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, expl.damage, expl.dmgType, expl.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; this.gold += 10; this.totalGold += 10; this.exp += 15; } } }
           for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, expl.damage, expl.dmgType, expl.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, expl.id); } } }
           spawnParticles(this.pos.x, this.pos.y, 10, '#f80');
           this.dashEndExplosion = null;
        }
    } else if (this.knockbackTimer > 0) {
        this.knockbackTimer -= dt;
        moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt);
    } else {
        if (this === player) { // PŘIDÁNO: Zabráníme aplikaci lokálních WASD na cizí hráče
            if(keys['w']) dy-=1; if(keys['s']) dy+=1; if(keys['a']) dx-=1; if(keys['d']) dx+=1; l = Math.hypot(dx,dy);
            let moveSpeed = this.speed * (this.hasPowerup ? 1.2 : 1.0) * (this.msBuffTimer > 0 ? (1 + this.msBuffAmount) : 1.0) * (this.slowTimer > 0 ? 0.6 : 1.0);
            if(this.castingTimeRemaining > 0) moveSpeed *= 0.5;
            if(this.attackPenaltyTimer > 0) moveSpeed *= 0.8;
            if(l>0){ dx/=l; dy/=l; this.vel.x = dx*moveSpeed; this.vel.y = dy*moveSpeed; } else { this.vel.x = 0; this.vel.y = 0; }
            moveEntityWithCollision(this, this.vel.x, this.vel.y, dt);
        } else if (this.targetPos) { // Logika pro ostatní (síťové) hráče
            // OPRAVA: Na Hostu se pozice skokově mění pro přesnost, na klientech se interpoluje pro plynulost
            if (game.isHost) {
                this.pos.x = this.targetPos.x;
                this.pos.y = this.targetPos.y;
            } else {
                if (dist(this.pos, this.targetPos) > 200) { this.pos.x = this.targetPos.x; this.pos.y = this.targetPos.y; } // Pokud se teleportnul (např. po respawnu), tak přeskočí
                else { this.pos.x += (this.targetPos.x - this.pos.x) * 15 * dt; this.pos.y += (this.targetPos.y - this.pos.y) * 15 * dt; }
            }
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
        else if(l>0) intendedAngle = Math.atan2(dy, dx); // Pokud nedrží šipky, míří tam, kam jde
    }

    // --- Aim Assist (Auto-Targeting with Player Priority) ---
    if (this === player) {
      let bestTarget = null;
      const maxD = this.range ? RANGED_ATTACK_RANGE : MELEE_ATTACK_RANGE + 100;
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
          intendedAngle = Math.atan2(bestTarget.pos.y - this.pos.y, bestTarget.pos.x - this.pos.x);
      }
      this.currentTarget = bestTarget; // Uložení pro vykreslení HUD

      // Aplikujeme plynulé otáčení (pokud nemíří manuálně šipkami)
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
    if (this === player && game.autoPlay && this.currentTarget && this.currentTarget.hp > 0 && !this.currentTarget.dead) {
        const d = dist(this.pos, this.currentTarget.pos);
        const atkRange = this.range ? RANGED_ATTACK_RANGE : MELEE_ATTACK_RANGE + 20;
        if (d <= atkRange) wantAttack = true;
    }
    if(this === player && wantAttack && this.attackCooldown<=0){ this.shoot(this.pos.x + Math.cos(this.aimAngle)*100, this.pos.y + Math.sin(this.aimAngle)*100); this.attackCooldown = this.attackDelay / this.attackSpeed; }

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
            this.allocateSpellPoint(Math.random() > 0.5 ? 'Q' : 'E');
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
    
    if(this.hasPowerup) {
        ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius + 6, 0, Math.PI*2);
        ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5; ctx.stroke();
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

      if (socket && !isNetwork) {
          if (this === player || (game.isHost && this instanceof BotPlayer)) {
              socket.emit('player_action', { type: 'summoner', id: this.id });
          }
      }

      if (!isNetwork) { this.summonerCooldown = SUMMONER_SPELLS[this.summonerSpell].cd; }

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
                      p.slowTimer = 2.0; spawnParticles(p.pos.x, p.pos.y, 10, '#f00');
                  }
              } break;
      }
  }

  shoot(tx,ty, isNetwork = false){ 
    if(!this.alive) return; 
    this.attackPenaltyTimer = 0.5; 
    
    // Odeslání akce na server (Host odesílá za sebe i za své boty)
    if (socket && !isNetwork) {
      if (this === player || (game.isHost && this instanceof BotPlayer)) {
        socket.emit('player_action', { type: 'shoot', id: this.id, tx: Math.round(tx), ty: Math.round(ty) });
      }
    }

    const pAD = this.AD * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0); const pAP = this.AP * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0);
    const aaScale = this.dmgType === 'magical' ? (this.className === 'Hana' ? 0.4 : 0.15) : 0.6;
    if(this.range){ // ranged - projectile with limited range
      const angle = Math.atan2(ty-this.pos.y, tx-this.pos.x); const speed = 800; const range = RANGED_ATTACK_RANGE; const life = range / speed; const vx = Math.cos(angle)*speed; const vy = Math.sin(angle)*speed; const damage = Math.round(CLASSES[this.className].baseAtk + (this.dmgType === 'magical' ? pAP*aaScale : pAD*aaScale)); const p = new Projectile(this.pos.x + Math.cos(angle)*(this.radius+6), this.pos.y + Math.sin(angle)*(this.radius+6), vx, vy, this.id, this.team, {damage:damage, dmgType: this.dmgType, glyph:'-' , life:life, radius: 8}); game.projectiles.push(p);
    } else { // melee basic
      const meleeRange = MELEE_ATTACK_RANGE; const damage = Math.round(CLASSES[this.className].baseAtk + (this.dmgType === 'magical' ? pAP*aaScale : pAD*aaScale));
      if (this.className === 'Hana') {
          spawnParticles(this.pos.x, this.pos.y, 2, '#f0f', { shape: 'ring', radius: meleeRange, life: 0.2, speed: 0, lineWidth: 2 });
          for(let m of game.minions){ if(!m.dead && m.team !== this.team){ if(dist(this.pos, m.pos) <= meleeRange){ applyDamage(m, damage, this.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 2, '#fff'); if(m.hp<=0){ m.dead = true; this.gold += 10; this.totalGold += 10; this.exp += 15; } } } }
          for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive){ if(dist(this.pos, p.pos) <= meleeRange){ applyDamage(p, damage, this.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 2, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } } }
      } else {
          // hit minions in cone
          const ang = Math.atan2(ty-this.pos.y, tx-this.pos.x); const cone = Math.PI/2; // 90deg
          spawnParticles(this.pos.x + Math.cos(ang)*20, this.pos.y + Math.sin(ang)*20, 1, '#fff', { angle: ang, speed: 400, life: 0.15, glyph: ')))', size: 24, rotate: true });
          for(let m of game.minions){ if(!m.dead && m.team !== this.team){ const d = dist(this.pos, m.pos); if(d <= meleeRange){ const a2 = Math.atan2(m.pos.y - this.pos.y, m.pos.x - this.pos.x); const da = Math.abs(Math.atan2(Math.sin(a2-ang), Math.cos(a2-ang))); if(da <= cone/2){ applyDamage(m, damage, this.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 2, '#fff'); if(m.hp<=0){ m.dead = true; this.gold += 10; this.totalGold += 10; this.exp += 15; } } } } }
          for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive){ const d = dist(this.pos, p.pos); if(d <= meleeRange){ const a2 = Math.atan2(p.pos.y - this.pos.y, p.pos.x - this.pos.x); const da = Math.abs(Math.atan2(Math.sin(a2-ang), Math.cos(a2-ang))); if(da <= cone/2){ applyDamage(p, damage, this.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 2, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } } } }
      }
    } }

  castSpell(spKey, targetX, targetY, isNetwork = false){ 
    const sp = this.spells[spKey]; if(!sp) return; 
    if(!isNetwork && sp.cd>0) return; // Zabráníme lokálnímu spamování
    
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

    if(!isNetwork) { sp.cd = this.computeSpellCooldown(spKey); this.castingTimeRemaining = sp.castTime; }

    const pAD = this.AD * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0); const pAP = this.AP * (this.hasPowerup ? 1.2 : 1.0) * (this.boostTimer > 0 ? 1.1 : 1.0);
    const damage = Math.round(sp.baseDamage + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*8);
    
    if (sp.type === 'projectile') {
      const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x); const speed = sp.pSpeed || 900; const life = sp.life || (700 / speed); 
      const count = sp.count || 1; const spread = sp.spread || 0.25;
      for(let i=0; i<count; i++) {
        const a = count === 1 ? angle : angle - (spread*(count-1))/2 + i*spread;
        const vx = Math.cos(a)*speed; const vy = Math.sin(a)*speed;
        game.projectiles.push(new Projectile(this.pos.x + Math.cos(a)*(this.radius+6), this.pos.y + Math.sin(a)*(this.radius+6), vx, vy, this.id, this.team, {damage:damage, dmgType: this.dmgType, glyph:sp.pGlyph, life: life})); 
      }
    } else if (sp.type === 'aoe') {
      const range = sp.radius; 
      game.particles.push(new Particle(this.pos.x, this.pos.y, '#ccf', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
      for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, damage, this.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; this.gold += 10; this.totalGold += 10; this.exp += 15; } } } 
      for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, damage, this.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } } } 
      spawnParticles(this.pos.x, this.pos.y, 10, '#ccf');
    } else if (sp.type === 'heal_self') {
      let healAmount = Math.round((sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*10);
      let healed = applyHeal(this, healAmount); 
      if(this.stats) this.stats.hpHealed += healed;
      spawnParticles(this.pos.x, this.pos.y, 8, '#0f0');
    } else if (sp.type === 'heal_aoe') {
      let healAmount = Math.round((sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + sp.level*10);
      game.particles.push(new Particle(this.pos.x, this.pos.y, '#0f0', {shape: 'ring', radius: sp.radius, life: 0.4, speed: 0, lineWidth: 4}));
      for(let p of game.players){ if(p.team === this.team && p.alive && dist(this.pos, p.pos) <= sp.radius){ let healed = applyHeal(p, healAmount); if(this.stats) this.stats.hpHealed += healed; spawnParticles(p.pos.x, p.pos.y, 6, '#0f0'); } }
    } else if (sp.type === 'aoe_knockback') {
      const range = sp.radius; 
      game.particles.push(new Particle(this.pos.x, this.pos.y, '#f55', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
      for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ 
          applyDamage(m, damage, this.dmgType, this.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); 
          let angle = Math.atan2(m.pos.y - this.pos.y, m.pos.x - this.pos.x);
          m.knockbackTimer = 0.2; m.knockbackVel = { x: Math.cos(angle)*750, y: Math.sin(angle)*750 };
          if(m.hp<=0){ m.dead = true; this.gold += 10; this.totalGold += 10; this.exp += 15; } 
      } } 
      for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ 
          applyDamage(p, damage, this.dmgType, this.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); 
          let angle = Math.atan2(p.pos.y - this.pos.y, p.pos.x - this.pos.x);
          p.knockbackTimer = 0.2; p.knockbackVel = { x: Math.cos(angle)*750, y: Math.sin(angle)*750 };
          if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.id); } 
      } } 
      spawnParticles(this.pos.x, this.pos.y, 10, '#f55');
    } else if (sp.type === 'hana_q') {
      this.invulnerableTimer = 1.0; this.regenBuffTimer = 6.0; this.regenBuffAmount = 15 + (pAP * 0.2) + sp.level * 5; 
      spawnParticles(this.pos.x, this.pos.y, 15, '#0f0', {speed: 150});
    } else if (sp.type === 'dash' || sp.type === 'dash_def') {
      const angle = Math.atan2(ty - this.pos.y, tx - this.pos.x);
      const distToMove = sp.distance || 250;
      const dashTime = 0.2; // Rychlost dashe v sekundách (200ms)
      this.dashTimer = dashTime;
      this.dashVel = { x: Math.cos(angle)*(distToMove/dashTime), y: Math.sin(angle)*(distToMove/dashTime) };
      spawnParticles(this.pos.x, this.pos.y, 8, '#fff');
      if (sp.type === 'dash_def') { this.defBuffTimer = 4.0; spawnParticles(this.pos.x, this.pos.y, 10, '#88f', {speed: 100}); }
      if (sp.radius && sp.baseDamage !== undefined) { // Volitelná exploze při dopadu
          this.dashEndExplosion = { radius: sp.radius, damage: damage, dmgType: this.dmgType, id: this.id };
      }
    } else if (sp.type === 'buff_ms') {
      this.msBuffTimer = sp.duration;
      this.msBuffAmount = sp.amount;
      spawnParticles(this.pos.x, this.pos.y, 15, '#0ff', {speed: 150});
    } else if (sp.type === 'summon') {
      let bestTower = null, bd = Infinity;
      for (let t of game.towers) if (t.owner !== this.team && dist(t.pos, this.pos) < bd) { bestTower = t; bd = dist(t.pos, this.pos); }
      const tIndex = bestTower ? bestTower.index : 0;
      // PŘIDÁNO: Na multiplayeru spawnuje ghúly pouze Host, aby se neduplikovali
      if (!socket || game.isHost) {
          for(let i=0; i<(sp.count||1); i++) {
             const sx = this.pos.x + (Math.random()-0.5)*40; const sy = this.pos.y + (Math.random()-0.5)*40;
             let m = new Minion(sx, sy, this.team, tIndex);
             m.maxHp = Math.round(damage * 3); m.hp = m.maxHp; m.attackDamage = Math.round(damage * 0.8);
             m.glyph = sp.mGlyph || 'g';
             game.minions.push(m);
          }
      }
      spawnParticles(this.pos.x, this.pos.y, 10, '#a3c');
    }
    if (this === player) updateSpellLabels(); 
  }
}

export class BotPlayer extends Player {
    constructor(x, y, opts) {
      super(x, y, opts);
      this.thinkTimer = 0;
      this.state = 'SEARCHING'; // Výchozí stav pro nový State Machine
      this.target = null;
      this.objective = null;
      this.maxGroupSize = Math.random() > 0.5 ? 3 : 2; // 50% šance snést 3člennou skupinu na stejné věži
      this.lane = opts.lane || null;
      
      const roamerClasses = ['Assassin', 'Runner', 'Jirina'];
      const supportClasses = ['Healer', 'Acolyte'];
      if (roamerClasses.includes(this.className)) this.role = 'ROAMER';
      else if (supportClasses.includes(this.className)) this.role = 'SUPPORT';
      else this.role = 'FIGHTER';
    }
    revive() {
      super.revive();
    }
    draw(ctx) {
      super.draw(ctx);
      if (!this.alive) return;
      // Zobrazí nad botem jeho aktuální stav a váhu motivace
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(`[${this.state}: ${Math.round(this.currentScore || 0)}]`, this.pos.x, this.pos.y - 40);
    }
    think() {
      // 1. Nakupování (pokud je mrtvý nebo ve fontáně)
      const inBase = dist(this.pos, spawnPoints[this.team]) < 250;
      if ((!this.alive || inBase) && this.gold >= 300 && this.items.length < 25) {
          let itemToBuy = null;
          if (!this.hasBoots && this.gold >= 300) {
              itemToBuy = shopItems.find(it => it.id === 'boots');
          } else {
              let possibleItems = shopItems.filter(it => it.cost <= this.gold && it.id !== 'boots');
              if (possibleItems.length > 0) {
                  let prefs = possibleItems.filter(it => (this.dmgType === 'magical' && (it.id==='ap' || it.id==='mr')) || (this.dmgType === 'physical' && (it.id==='ad' || it.id==='as' || it.id==='armor')) || it.id==='hp');
                  itemToBuy = (prefs.length > 0) ? prefs[Math.floor(Math.random()*prefs.length)] : possibleItems[Math.floor(Math.random()*possibleItems.length)];
              }
          }
          if (itemToBuy) {
              this.gold -= itemToBuy.cost; this.items.push(itemToBuy.id); itemToBuy.apply(this); this.isDirty = true;
          }
      }

      // 2. Levelování spellů
      while(this.spellPoints > 0) {
          this.allocateSpellPoint(Math.random() > 0.5 ? 'Q' : 'E');
      }

      if (!this.alive) return;

      // --- 0. Náhodné nálady (Urges) ---
      if (Math.random() < 0.05 && this.level >= 4) this.farmUrge = true;
      if (Math.random() < 0.1) this.farmUrge = false;

      if (Math.random() < 0.05 && !this.huntTarget) {
          let squishies = game.players.filter(p => p.team !== this.team && p.alive && ['Mage', 'Healer', 'Marksman', 'Acolyte', 'Summoner'].includes(p.className));
          if (squishies.length > 0) this.huntTarget = squishies[Math.floor(Math.random() * squishies.length)];
      }
      if (this.huntTarget && (!this.huntTarget.alive || Math.random() < 0.1)) this.huntTarget = null;

      // --- 1. Hodnocení Objektivů (Věže a Minioni) ---
      let bestObjective = null;
      let bestObjScore = -Infinity;
      let bestState = 'SEARCHING';
      const enemyBase = spawnPoints[1 - this.team]; // Zóna nepřátelské základny

      const myTowersCount = game.towers.filter(t => t.owner === this.team).length;
      const enemyTowersCount = game.towers.filter(t => t.owner === 1 - this.team).length;
      const isLosing = myTowersCount < enemyTowersCount;

      for (let t of game.towers) {
          if (t.owner === this.team && ((this.team === 0 && t.control >= 100) || (this.team === 1 && t.control <= -100))) continue;
          
          let score = BOT_WEIGHTS.towerBaseScore - dist(this.pos, t.pos);
          if (dist(t.pos, enemyBase) < 300) score -= BOT_WEIGHTS.enemyBasePenalty; // Penalizace
          let isTopTower = (t.index === 0 || t.index === 1 || t.index === 2);
          let isBotTower = (t.index === 3 || t.index === 4);
          if (this.lane === 'top' && isTopTower) score += BOT_WEIGHTS.laneMatchScore;
          if (this.lane === 'bottom' && isBotTower) score += BOT_WEIGHTS.laneMatchScore;
          
          if (this.role === 'ROAMER' && t.owner === 1 - this.team) score += 4600; // Zvýšeno o 15%

          // PŘIDÁNO: Masivní bonus, pokud je bot blízko neutrální nebo nepřátelské věže (< 1000 units)
          if (t.owner !== this.team && dist(this.pos, t.pos) < 1000) {
              score += 4000;
          }

          // PŘIDÁNO: Pokud tým prohrává, větší šance jít na věže a krást v týlu
          if (isLosing) {
              score += 4600; // Zvýšeno o 15%
              if (t.owner === 1 - this.team) score += 3450; // Zvýšeno o 15%
          }

          if (this.role === 'SUPPORT') {
              let alliedFighters = game.players.some(p => p instanceof BotPlayer && p.team === this.team && p.role === 'FIGHTER' && p.objective === t);
              if (alliedFighters) score += 6900; // Zvýšeno o 15%
          }
          
          if (t.owner === -1) score += BOT_WEIGHTS.neutralTowerScore;
          
          let alliesOnTower = game.players.filter(p => p instanceof BotPlayer && p.team === this.team && p.objective === t && p.id !== this.id).length;
          if (alliesOnTower >= this.maxGroupSize) score -= BOT_WEIGHTS.overcrowdedTowerPenalty;
          else if (alliesOnTower === 0) score += BOT_WEIGHTS.emptyTowerScore;
          
          if (this.state === 'CAPTURE' && this.objective === t) score += BOT_WEIGHTS.objectiveHysteresis;
          if (score > bestObjScore) { bestObjScore = score; bestObjective = t; bestState = 'CAPTURE'; }
      }

      for (let m of game.minions) {
          if (m.team === this.team && !m.dead) {
              let targetTower = game.towers[m.targetIndex];
              if (!targetTower || targetTower.owner === this.team) continue;

              // Pokud už minioni dorazili blízko k věži, bot je přestane eskortovat a zaměří se rovnou na její obsazení
              if (dist(m.pos, targetTower.pos) < 400) continue;

              let nearbyMinions = 0, nearbyAllies = 0;
              for (let otherM of game.minions) { if (otherM.team === this.team && !otherM.dead && dist(m.pos, otherM.pos) < 350) nearbyMinions++; }
              for (let p of game.players) { if (p.team === this.team && p.alive && p.id !== this.id && dist(m.pos, p.pos) < 350) nearbyAllies++; }
              
              if (nearbyMinions >= 2 && nearbyAllies <= 1) {
                  let d = dist(this.pos, m.pos);
                  let score = BOT_WEIGHTS.minionPushBaseScore - d;
                  if (dist(m.pos, enemyBase) < 300) score -= BOT_WEIGHTS.enemyBasePenalty; // Nejdeme pro miniony do báze
                  if (this.state === 'PUSH' && this.objective && this.objective.type === 'minions' && dist(this.objective.pos, m.pos) < 250) score += BOT_WEIGHTS.objectiveHysteresis;
                  
                  if (score > bestObjScore) { bestObjScore = score; bestObjective = { pos: m.pos, type: 'minions', captureRadius: 160, index: 'MINIONS' }; bestState = 'PUSH'; }
              }
          }
      }

      // --- 1.5 Hodnocení Sběratelských Předmětů (Healy a PowerUp - stav PICKUP) ---
      if (this.hp / this.effectiveMaxHp < 0.85) { // Reagují dříve (na 85%)
          for (let h of game.heals) {
              if (h.active) {
                  let d = dist(this.pos, h.pos);
                  let missingHpPct = 1 - (this.hp / this.effectiveMaxHp);
                  
                  // Masivní bonus za chybějící HP (až +8000) a bonus +3000, pokud je heal blízko (např. v boji)
                  let score = BOT_WEIGHTS.healScore + (missingHpPct * 8000) - d;
                  if (d < 600) score += 3000;
                  
                  if (dist(h.pos, enemyBase) < 300) score -= BOT_WEIGHTS.enemyBasePenalty;
                  if (this.state === 'PICKUP' && this.objective && this.objective.type === 'heal' && dist(this.objective.pos, h.pos) < 10) score += BOT_WEIGHTS.objectiveHysteresis;
                  if (score > bestObjScore) { bestObjScore = score; bestObjective = { pos: h.pos, type: 'heal', captureRadius: 20 }; bestState = 'PICKUP'; }
              }
          }
      }
      
      if (Math.random() < 0.1) this.powerupUrge = true; // 10% šance na vyvolání nutkání sebrat powerup
      if (!game.powerup || !game.powerup.active || this.hasPowerup) this.powerupUrge = false;
      
      if (this.powerupUrge && game.powerup && game.powerup.active) {
          let d = dist(this.pos, game.powerup.pos);
          let score = BOT_WEIGHTS.powerupScore - d;
          if (dist(game.powerup.pos, enemyBase) < 300) score -= BOT_WEIGHTS.enemyBasePenalty;
          if (this.state === 'PICKUP' && this.objective && this.objective.type === 'powerup') score += BOT_WEIGHTS.objectiveHysteresis;
          if (score > bestObjScore) { bestObjScore = score; bestObjective = { pos: game.powerup.pos, type: 'powerup', captureRadius: 70 }; bestState = 'PICKUP'; }
      }

      // --- 2. Hodnocení Útoků (Combat) ---
      let bestTarget = null;
      let bestTargetScore = -Infinity;
      const enemies = [...game.players.filter(p => p.team !== this.team && p.alive), ...game.minions.filter(m => m.team !== this.team && !m.dead)];
      for (let e of enemies) {
          let d = dist(e.pos, this.pos);
          if (d < BOT_WEIGHTS.attackVisionRange) {
              let score = BOT_WEIGHTS.enemyBaseScore - d;
              if (dist(e.pos, enemyBase) < 300) score -= BOT_WEIGHTS.enemyBasePenalty; // Neútočíme dovnitř báze
              if (e.className) {
                  score += BOT_WEIGHTS.heroKillScore;
                  if (this.huntTarget === e) score += 6800; // Sníženo o 15%
              } else {
                  if (this.farmUrge) score += 3400; // Sníženo o 15%
              }
              if (e.hp / (e.effectiveMaxHp || e.maxHp) < 0.3 && !this.farmUrge) score += BOT_WEIGHTS.lowHpScore;
              
              // PŘIDÁNO: Snížení priority boje, pokud tým prohrává (soustředění na záchranu věží)
              if (isLosing) score -= 3450; // Posílena averze k boji o 15%

              if (score > bestTargetScore) { bestTargetScore = score; bestTarget = e; }
          }
      }

      // --- 2.5 Hodnocení Volání o pomoc (Help Urge) ---
      if (this.helpUrgeTarget && this.helpUrgeTarget.alive !== false && !this.helpUrgeTarget.dead) {
          let dToHelp = dist(this.pos, this.helpUrgeTarget.pos);
          if (dToHelp < 1500) { // Běží pomoct i z větší dálky, než je běžný vision
              let score = 25000 - dToHelp; // Obrovská priorita (přebije i neutrální věž)
              if (score > bestTargetScore) { bestTargetScore = score; bestTarget = this.helpUrgeTarget; }
          } else {
              this.helpUrgeTarget = null; // Cíl pomoci se příliš vzdálil
          }
      }

      // --- 2.6 Odeslání žádosti o pomoc (Pokud prohrávám combat) ---
      if (this.state === 'ATTACK' && this.target && this.hp / this.effectiveMaxHp < 0.6) {
          let enemyHpPct = this.target.hp / (this.target.effectiveMaxHp || this.target.maxHp);
          let now = performance.now();
          // Pokud mám procentuálně méně životů než nepřítel (prohrávám) a naposledy jsem volal před více jak 5 vteřinami
          if ((this.hp / this.effectiveMaxHp) < enemyHpPct && (!this.lastHelpCallTime || now - this.lastHelpCallTime > 5000)) {
              this.lastHelpCallTime = now;
              if (Math.random() < 0.5) { // 50% šance na zavolání
                  let allies = game.players.filter(p => p instanceof BotPlayer && p.team === this.team && p.id !== this.id && p.alive && dist(p.pos, this.pos) < 1200);
                  for (let ally of allies) {
                      let isBusy = false;
                      if (ally.state === 'ATTACK') isBusy = true; // Zrovna bojuje
                      if (ally.state === 'PICKUP' && ally.objective && ally.objective.type === 'heal') isBusy = true; // Jde se léčit
                      if ((ally.state === 'CAPTURE' || ally.state === 'PUSH') && ally.objective && ally.objective.pos) {
                          if (dist(ally.pos, ally.objective.pos) < dist(ally.pos, this.pos)) isBusy = true; // Má bližší objektiv, než je vzdálenost k volajícímu
                      }
                      if (!isBusy) {
                          ally.helpUrgeTarget = this.target; // Přepošleme mu nepřítele
                          ally.helpUrgeTimer = 5.0; // Bude mu klást prioritu po 5 sekund
                      }
                  }
              }
          }
      }

      // --- 3. Rozhodnutí: Cíl vs Objektiv ---
      let shouldAttack = false;
      if (bestTarget) {
          let d = dist(this.pos, bestTarget.pos);
          let isLowHp = bestTarget.hp / (bestTarget.effectiveMaxHp || bestTarget.maxHp) < 0.3;
          
          // Pokud máme málo HP a jdeme si pro lékárničku, ignorujeme boj na dálku a jdeme se léčit
          let isDesperateForHeal = (bestState === 'PICKUP' && bestObjective && bestObjective.type === 'heal' && this.hp / this.effectiveMaxHp < 0.6);
          // PŘIDÁNO: Pokud běžíme zabrat blízkou věž, ignorujeme boj do doby, než vlezeme do kruhu
          let isDesperateForTower = (bestState === 'CAPTURE' && bestObjective && bestObjective.owner !== this.team && dist(this.pos, bestObjective.pos) > (bestObjective.captureRadius || 80));
          
          if (isDesperateForHeal) {
              if (d < 150) shouldAttack = true; // Bráníme se jen v sebeobraně nablízko
          } else if (isDesperateForTower) {
              if (d < 150 || isLowHp) shouldAttack = true; // Sprintujeme do kruhu, bojujeme jen ve velké blízkosti
          } else {
              // Útočíme, pokud je cíl blízko, má low HP, nic jiného nehoří (věže mají málo bodů), NEBO pokud běžíme na pomoc (bestTargetScore >= 20000)
              if (d < 350 || isLowHp || bestObjScore < BOT_WEIGHTS.objectiveFocusThreshold || bestTargetScore >= 20000) shouldAttack = true;
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
    }
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
          if (this.summonerSpell === 'Revive' && this.summonerCooldown <= 0) { this.castSummonerSpell(); return; }
          this.respawnTimer -= dt; if(this.respawnTimer <= 0) this.revive(); 
          this.thinkTimer -= dt; if(this.thinkTimer <= 0) { this.thinkTimer = 0.5; this.think(); } // Může nakupovat
          return; 
      }
      
      if(this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
      if(this.defBuffTimer > 0) this.defBuffTimer -= dt;
      if(this.regenBuffTimer > 0) {
          this.regenBuffTimer -= dt;
          if (this === player || (!socket || game.isHost)) { this.hp = Math.min(this.effectiveMaxHp, this.hp + this.regenBuffAmount * dt); }
          if (Math.random() < 0.1) spawnParticles(this.pos.x, this.pos.y, 1, '#0f0', {life: 0.3});
      }
      
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

      // Passive HP Regen & Fountain
      if(this.hp < this.effectiveMaxHp) this.hp = Math.min(this.effectiveMaxHp, this.hp + this.hpRegen * dt);
      const allyBaseDist = dist(this.pos, spawnPoints[this.team]);
      if (allyBaseDist < 200) this.hp = Math.min(this.effectiveMaxHp, this.hp + (this.effectiveMaxHp * 0.15 * dt));
      const enemyBaseDist = dist(this.pos, spawnPoints[1-this.team]);
      if (enemyBaseDist < 200) { applyDamage(this, 1000 * dt, 'true', 'laser'); if(this.hp<=0) handlePlayerKill(this, 'laser'); }

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

      if (this.dashTimer > 0) {
          this.dashTimer -= dt;
          moveEntityWithCollision(this, this.dashVel.x, this.dashVel.y, dt);
          if (Math.random() < 0.4) spawnParticles(this.pos.x, this.pos.y, 1, '#fff', {life: 0.2});
          if (this.dashTimer <= 0 && this.dashEndExplosion) {
             const expl = this.dashEndExplosion; const range = expl.radius;
             game.particles.push(new Particle(this.pos.x, this.pos.y, '#f80', {shape: 'ring', radius: range, life: 0.4, speed: 0, lineWidth: 4}));
             for(let m of game.minions){ if(!m.dead && m.team !== this.team && dist(this.pos, m.pos) <= range){ applyDamage(m, expl.damage, expl.dmgType, expl.id); spawnParticles(m.pos.x, m.pos.y, 4, '#fff'); if(m.hp<=0){ m.dead = true; this.gold += 10; this.totalGold += 10; this.exp += 15; } } }
             for(let p of game.players){ if(p !== this && p.team !== this.team && p.alive && dist(this.pos, p.pos) <= range){ applyDamage(p, expl.damage, expl.dmgType, expl.id); spawnParticles(p.pos.x, p.pos.y, 4, '#fff'); if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, expl.id); } } }
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

      this.thinkTimer -= dt;
      if (this.thinkTimer <= 0) { this.thinkTimer = 0.25 + Math.random()*0.1; this.think(); }

      // --- ANTI-STUCK MECHANISMUS ---
      this.posCheckTimer = (this.posCheckTimer || 0) + dt;
      if (this.posCheckTimer >= 1.0) {
          this.posCheckTimer = 0;
          if (this.lastPosCheck && dist(this.pos, this.lastPosCheck) < 3) {
              let ang = Math.random() * Math.PI * 2;
              let dashed = false;
              for (let key of ['Q', 'E']) {
                  let sp = this.spells[key];
                  if (sp && sp.cd <= 0 && (sp.type === 'dash' || sp.type === 'dash_def')) {
                      this.castSpell(key, this.pos.x + Math.cos(ang)*100, this.pos.y + Math.sin(ang)*100);
                      dashed = true; break;
                  }
              }
              if (!dashed) {
                  this.dashTimer = 0.2;
                  this.dashVel = { x: Math.cos(ang)*250, y: Math.sin(ang)*250 }; // 250 * 0.2 = 50 units
              }
          }
          this.lastPosCheck = { x: this.pos.x, y: this.pos.y };
      }

      // --- NOVÁ LOGIKA POHYBU A ÚTOKU (STATE MACHINE) ---
      let dx = 0, dy = 0;

      if (this.state === 'ATTACK') {
          if (this.target && (this.target.hp > 0 && (this.target.alive !== false && !this.target.dead))) {
              let tx = this.target.pos.x;
              let ty = this.target.pos.y;
              let d = dist(this.pos, this.target.pos);
              let atkRange = this.range ? RANGED_ATTACK_RANGE - 50 : MELEE_ATTACK_RANGE - 20;
              
              // Movement Logic
              if (d > atkRange) { dx = tx - this.pos.x; dy = ty - this.pos.y; } // Chasing
              else if (this.range && d < atkRange - 150) { dx = this.pos.x - tx; dy = this.pos.y - ty; } // Kiting pro střelce
              else { dx = -(ty - this.pos.y); dy = (tx - this.pos.x); } // Strafeování v dosahu
              
              // PRIORITIZACE VĚŽE BĚHEM SOUBOJE:
              let fightObjective = this.objective || game.towers.sort((a,b)=>dist(a.pos,this.pos)-dist(b.pos,this.pos))[0];
              if (fightObjective) {
                  let odx = fightObjective.pos.x - this.pos.x;
                  let ody = fightObjective.pos.y - this.pos.y;
                  let odist = Math.hypot(odx, ody);
                  let isCapturing = (fightObjective.owner !== undefined && fightObjective.owner !== this.team);
                  let cRad = fightObjective.captureRadius || 80;
                  
                  if (isCapturing && odist > cRad - 15) {
                      // PŘIDÁNO: Pokud se snaží zabrat věž, nesmí ho chase/kiting vyhodit z kruhu!
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
                  this.attackCooldown = this.attackDelay / this.attackSpeed; 
              }
              
              // Spells Logic (Q)
              if (this.spells.Q && this.spells.Q.cd <= 0 && this.castingTimeRemaining <= 0) {
                  let castQ = false; let qtx = tx, qty = ty;
                  if (this.spells.Q.type === 'heal_self' || this.spells.Q.type === 'hana_q') castQ = (this.hp < this.effectiveMaxHp * 0.7);
                  else if (this.spells.Q.type === 'dash' || this.spells.Q.type === 'dash_def') {
                      if (this.range) { if (d < 250) { castQ = true; qtx = this.pos.x + (this.pos.x - tx); qty = this.pos.y + (this.pos.y - ty); } }
                      else { if (d > 150 && d < 400) castQ = true; }
                  } else if (this.spells.Q.type === 'buff_ms') castQ = (d < 600);
                  else if (this.spells.Q.type === 'aoe' || this.spells.Q.type === 'aoe_knockback') castQ = (d < (this.spells.Q.radius || 200));
                  else castQ = (d < 450);
                  if (castQ) this.castSpell('Q', qtx, qty);
              }
              
              // Spells Logic (E)
              if (this.spells.E && this.spells.E.cd <= 0 && this.castingTimeRemaining <= 0) {
                  let castE = false; let etx = tx, ety = ty;
                  if (this.spells.E.type === 'heal_self' || this.spells.E.type === 'hana_q') castE = (this.hp < this.effectiveMaxHp * 0.6);
                  else if (this.spells.E.type === 'heal_aoe') castE = (this.hp < this.effectiveMaxHp * 0.7);
                  else if (this.spells.E.type === 'dash' || this.spells.E.type === 'dash_def') {
                      if (this.range) { if (d < 250) { castE = true; etx = this.pos.x + (this.pos.x - tx); ety = this.pos.y + (this.pos.y - ty); } }
                      else { if (d > 150 && d < 400) castE = true; }
                  } else if (this.spells.E.type === 'aoe' || this.spells.E.type === 'aoe_knockback') castE = (d < (this.spells.E.radius || 200));
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

      const l = Math.hypot(dx, dy);
      let moveSpeed = this.speed * (this.hasPowerup ? 1.2 : 1.0) * (this.msBuffTimer > 0 ? (1 + this.msBuffAmount) : 1.0) * (this.slowTimer > 0 ? 0.6 : 1.0);
      if (this.attackPenaltyTimer > 0) moveSpeed *= 0.8;
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

          if (this.state !== 'ATTACK') this.aimAngle = Math.atan2(dy, dx);
          moveEntityWithCollision(this, dx * moveSpeed, dy * moveSpeed, dt); 
      }
    }
  }
  