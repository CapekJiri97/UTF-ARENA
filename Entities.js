import { dist, isPointInPoly, distToPoly } from './Utils.js';
import { game, TEAM_COLOR, NEUTRAL_COLOR } from './State.js';
const _isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
// mapBoundary, spawnPoints, MINION_SPAWN_POINTS jsou čteny z activeGameMode.mapConfig za běhu
import { spawnParticles, EffectText, DamageNumber } from './Effects.js';
import { socket, applyDamage, applyHeal, handlePlayerKill, moveEntityWithCollision, drawHealthBar, flashMessage, player, grantRewards, grantMinionKillRewards, activeGameMode } from './main.js';
import { playSound } from './Audio.js';

export class Projectile{
  constructor(x,y,vx,vy,ownerId,ownerTeam,opts={}){ this.pos={x,y}; this.vel={x:vx,y:vy}; 
    this.radius=opts.radius||4; this.life=opts.life||2.0; this.ownerId = ownerId; this.ownerTeam = ownerTeam; this.damage = opts.damage||25; this.dmgType = opts.dmgType||'physical'; this.glyph = opts.glyph||'*'; this.dead = false;
    this.color = ownerTeam === 0 ? '#486FED' : (ownerTeam === 1 ? '#FF4E4E' : '#fff'); 
    this.opts = opts; }
  update(dt){ if(this.dead) return; this.pos.x += this.vel.x*dt; this.pos.y += this.vel.y*dt; this.life -= dt; if(this.life<=0) this.dead = true;
    if(!isPointInPoly(this.pos.x, this.pos.y, activeGameMode.mapConfig.mapBoundary)) { this.dead = true; spawnParticles(this.pos.x, this.pos.y, 5, '#888'); return; }




    let cx = Math.floor(this.pos.x / 200), cy = Math.floor(this.pos.y / 200);
    let nearbyWalls = game.wallGrid ? (game.wallGrid.get(`${cx},${cy}`) || []) : game.walls;
    for(let w of nearbyWalls) { 
      let info = distToPoly(this.pos.x, this.pos.y, w.pts);
      if(info.inside || info.minDist < w.r) { this.dead = true; spawnParticles(this.pos.x, this.pos.y, 5, '#888'); return; }
    }
    
    let hitTarget = null;
    for(let m of game.minions){ 
      if(!m.dead && m.team !== this.ownerTeam && dist(this.pos, m.pos) < this.radius + m.radius){ 
        hitTarget = m; applyDamage(m, this._scaleBurstDamage(m.id, this.damage), this.dmgType, this.ownerId, false, this.opts.isSpell || false);
        if (!this.opts.noHitParticles) spawnParticles(this.pos.x, this.pos.y, 4, '#f00');
        if(m.hp<=0 && (!socket || game.isHost)){ m.dead = true; const owner = game.players.find(x=>x.id===this.ownerId); if(owner){ grantMinionKillRewards(owner, m.pos); } } break;
      } 
    }
    if (hitTarget) { this.processOnHit(hitTarget); this.dead = true; return; }

    // Věže s HP (ARAM) — lze je zasáhnout projektily hráčů a minionů (ne jinými věžemi)
    if (this.ownerId !== 'tower' && (!socket || game.isHost)) {
      for (let t of game.towers) {
        if (!t.dead && t.maxHp !== null && t.owner !== this.ownerTeam && dist(this.pos, t.pos) < this.radius + t.radius + 12) {
          t.takeDamage(this.damage, this.ownerId);
          spawnParticles(this.pos.x, this.pos.y, 4, '#ff8800');
          this.dead = true; return;
        }
      }
    }

    for(let p of game.players){
      if(p.id !== this.ownerId && p.team !== this.ownerTeam && p.alive && dist(this.pos, p.pos) < this.radius + p.radius){
        hitTarget = p; applyDamage(p, this._scaleBurstDamage(p.id, this.damage), this.dmgType, this.ownerId, false, this.opts.isSpell || false);
        if (!this.opts.noHitParticles) spawnParticles(this.pos.x, this.pos.y, 4, '#f00');
        if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.ownerId); } break;
      }
    }
    if (hitTarget) { this.processOnHit(hitTarget); this.dead = true; }
  }
  processOnHit(target) {
      if (this.opts.slowDuration) {
          target.slowTimer = Math.max(target.slowTimer || 0, this.opts.slowDuration);
          if (this.opts.slowMod) {
              target.slowMod = Math.min(target.slowMod || 1, this.opts.slowMod);
          }
      }
      if (this.opts.markPetTarget && (!socket || game.isHost)) {
          const owner = game.players.find(p => p.id === this.ownerId);
          if (owner) {
              owner.petTargetId = target.id;
          }
      }
      if (this.opts.bonusMaxHpDmg && target.maxHp && (!socket || game.isHost)) {
          applyDamage(target, Math.round(target.maxHp * this.opts.bonusMaxHpDmg), 'magical', this.ownerId, false, true);
      }
      if (this.opts.pullToCaster && (!socket || game.isHost)) {
          const owner = game.players.find(p => p.id === this.ownerId);
          if (owner && target.knockbackTimer <= 0) { // Don't override existing knockback
              const angle = Math.atan2(owner.pos.y - target.pos.y, owner.pos.x - target.pos.x);
              const pullSpeed = 1200;
              target.knockbackTimer = dist(owner.pos, target.pos) / pullSpeed;
              target.knockbackVel = { x: Math.cos(angle) * pullSpeed, y: Math.sin(angle) * pullSpeed };
          }
      }
      if (this.opts.stunDuration) { target.stunTimer = Math.max(target.stunTimer || 0, this.opts.stunDuration); if(target.className) game.effectTexts.push(new EffectText(target.pos.x, target.pos.y-20, "STUNNED", '#ffcc00')); }
      if (this.opts.silenceDuration) { target.silenceTimer = Math.max(target.silenceTimer || 0, this.opts.silenceDuration); if(target.className) game.effectTexts.push(new EffectText(target.pos.x, target.pos.y-20, "SILENCED", '#fff')); }
      if (this.opts.spawnMinion && (!socket || game.isHost)) {
          let bestTower = null, bd = Infinity;
          for (let t of game.towers) if (t.owner !== this.ownerTeam && dist(t.pos, this.pos) < bd) { bestTower = t; bd = dist(t.pos, this.pos); }
          const tIndex = bestTower ? bestTower.index : 0;
          
          let m = new Minion(this.pos.x, this.pos.y, this.ownerTeam, tIndex);
          m.maxHp = this.opts.mHp || 100; m.hp = m.maxHp; m.attackDamage = this.opts.mAd || 10;
          m.glyph = this.opts.mGlyph || 'b';
              m.isSummon = true; m.ownerId = this.ownerId; m.speed = 135;
          game.minions.push(m);
          spawnParticles(this.pos.x, this.pos.y, 10, '#a3c');
      }
  }
  _scaleBurstDamage(targetId, dmg) {
    if (!this.opts.burstId) return dmg;
    if (!game.burstHits) game.burstHits = new Map();
    const bk = this.opts.burstId + ':' + targetId;
    const entry = game.burstHits.get(bk);
    const prev = entry ? entry.n : 0;
    const scaled = prev === 0 ? dmg : Math.round(dmg * 0.25);
    const next = prev + 1;
    if (next >= (this.opts.burstMax || 3)) game.burstHits.delete(bk);
    else game.burstHits.set(bk, { n: next, time: performance.now() });
    return scaled;
  }
  draw(ctx){
    ctx.fillStyle = this.color; ctx.font=`bold ${Math.round(this.radius * 4.5)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
    if (!_isMobile) { ctx.shadowColor = this.color; ctx.shadowBlur = 8; }
    ctx.fillText(this.glyph, this.pos.x, this.pos.y);
    ctx.shadowBlur = 0; 
  }
}

// Věže - Host je autorita pro obsazování a útoky
export class Tower{
  constructor(x,y,index){
    this.pos={x,y}; this.index = index; this.radius=20;
    const isAram = activeGameMode && activeGameMode.name === 'aram';
    const isArena = activeGameMode && activeGameMode.name === 'arena';
    this.captureRadius = isArena ? 220 : 80;
    this.owner = -1; this.control = 0; this.attackCooldown = 0;
    this.attackRange  = isAram ? 420 : 320;
    this.attackDamage = isAram ? 120 : 45;
    this.maxHp = isAram ? 2000 : null; // null = indestructible (classic)
    this.hp    = this.maxHp;
    this.dead  = false;
    // LoL agro: tracks which enemy hero last attacked an ally in range
    this._aggroTarget = null;
    this.isLocked = false;
    this.unlockTimer = 0;
  }
  update(dt){ if(game.gameOver) return;
    if (this.dead) {
      if (typeof this._handleJungleDeath === 'function' && !this._jungleDeathHandled) {
        this._handleJungleDeath();
      }
      return;
    }

    if (this.isLocked) {
        this.unlockTimer -= dt;
        if (this.unlockTimer <= 0) {
            this.isLocked = false;
            if (!socket || game.isHost) {
                game.effectTexts.push(new EffectText(this.pos.x, this.pos.y-40, "UNLOCKED!", '#0f0'));
            }
        }
        return; // Dokud je zamčeno, nelze obsadit ani věž nestřílí
    }

    if (!socket || game.isHost) {
      // Capture logika — jen v Classic (ARAM věže mají HP a ničí se)
      if (this.maxHp === null) {
      const counts = [0,0]; let rallyBonus = [0,0];
      for(let p of game.players){ if(p.alive && dist(p.pos, this.pos) <= this.captureRadius) { counts[p.team]++; if(p.rallyTimer > 0) rallyBonus[p.team] += 2; } } 
      const presenceDelta = (counts[0] + rallyBonus[0]) - (counts[1] + rallyBonus[1]);
      if(presenceDelta !== 0){ 
        const rate = Math.sign(presenceDelta) * (25 + (Math.abs(presenceDelta) - 1) * 5);
        this.control += rate * dt; 
      } else { 
        if(this.owner === 0 && this.control < 100) this.control = Math.min(100, this.control + 6*dt); 
        else if(this.owner === 1 && this.control > -100) this.control = Math.max(-100, this.control - 6*dt); 
        else if(this.owner === -1) { if(this.control > 0) this.control = Math.max(0, this.control - 6*dt); else if(this.control < 0) this.control = Math.min(0, this.control + 6*dt); }
      }
      this.control = Math.max(-100, Math.min(100, this.control)); 
      if (this.owner === 0 && this.control < 0) { this.owner = -1; }
      if (this.owner === 1 && this.control > 0) { this.owner = -1; }
      if (this.control >= 100 && this.owner !== 0){
          const prevOwner0 = this.owner;
          this.owner = 0; this.control = 100; game.shake = 0.3;
          playSound('capture_tower', this.pos, { team: 0 });
          if (prevOwner0 === 1) playSound('lose_tower', this.pos, { team: 1 });
          if(!socket || game.isHost) {
              let caps = game.players.filter(p => p.alive && p.team === 0 && dist(p.pos, this.pos) <= this.captureRadius);
              let totalLvl = 0, pCount = 0;
              for (let p of game.players) { if (p.team >= 0) { totalLvl += p.level; pCount++; } }
              let avgLevel = pCount > 0 ? totalLvl / pCount : 1;
              let scale = Math.min(avgLevel, 8) / 7.0;
              let gShare = Math.round((80 * scale) / Math.max(1, caps.length));
              let eShare = Math.round((120 * scale) / Math.max(1, caps.length));
              for (let p of caps) grantRewards(p, gShare, eShare);
            for (let p of caps) {
              if (p.towerCaptures !== undefined) p.towerCaptures += 1;
              if (typeof p.refreshDominionPCS === 'function') p.refreshDominionPCS();
            }
              let kName = caps.length > 0 ? caps[0].className : 'Blue Team';
              let ev = { killer: kName, victim: 'Tower '+(this.index+1), killerTeam: 0, victimTeam: -1, isCapture: true };
              if(socket) socket.emit('broadcast_kill', ev); if(game.killFeed) game.killFeed.push({...ev, timer: 5.0});
          }
      } 
      if (this.control <= -100 && this.owner !== 1){
          const prevOwner1 = this.owner;
          this.owner = 1; this.control = -100; game.shake = 0.3;
          playSound('capture_tower', this.pos, { team: 1 });
          if (prevOwner1 === 0) playSound('lose_tower', this.pos, { team: 0 });
          if(!socket || game.isHost) {
              let caps = game.players.filter(p => p.alive && p.team === 1 && dist(p.pos, this.pos) <= this.captureRadius);
              let totalLvl = 0, pCount = 0;
              for (let p of game.players) { if (p.team >= 0) { totalLvl += p.level; pCount++; } }
              let avgLevel = pCount > 0 ? totalLvl / pCount : 1;
              let scale = Math.min(avgLevel, 8) / 7.0;
              let gShare = Math.round((80 * scale) / Math.max(1, caps.length));
              let eShare = Math.round((120 * scale) / Math.max(1, caps.length));
              for (let p of caps) grantRewards(p, gShare, eShare);
            for (let p of caps) {
              if (p.towerCaptures !== undefined) p.towerCaptures += 1;
              if (typeof p.refreshDominionPCS === 'function') p.refreshDominionPCS();
            }
              let kName = caps.length > 0 ? caps[0].className : 'Red Team';
              let ev = { killer: kName, victim: 'Tower '+(this.index+1), killerTeam: 1, victimTeam: -1, isCapture: true };
              if(socket) socket.emit('broadcast_kill', ev); if(game.killFeed) game.killFeed.push({...ev, timer: 5.0});
          }
      }
      } // end if (this.maxHp === null) — capture blok
    }

    if (this.owner >= 0) {
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && (!socket || game.isHost)) {
        let isBeingCaptured = false;
        for (let p of game.players) { if (p.alive && p.team !== this.owner && dist(p.pos, this.pos) <= this.captureRadius) { isBeingCaptured = true; break; } }
        if (!isBeingCaptured) {
          // LoL agro: pokud enemy hero napadl spojeneckou jednotku v range, přepni na něj
          if (this._aggroTarget && (!this._aggroTarget.alive || this._aggroTarget.dead || dist(this._aggroTarget.pos, this.pos) > this.attackRange)) {
            this._aggroTarget = null;
          }

          let target = this._aggroTarget || null;

          if (!target) {
            // Priorita 1: nepřátelský minion v range (nejbližší)
            let bestDist = this.attackRange;
            for (let m of game.minions) {
              if (m.team !== this.owner && !m.dead) {
                const d = dist(m.pos, this.pos);
                if (d < bestDist) { target = m; bestDist = d; }
              }
            }
            // Priorita 2: nepřátelský hrdina v range (jen pokud žádný minion)
            if (!target) {
              for (let p of game.players) {
                if (p.team !== this.owner && p.alive) {
                  const d = dist(p.pos, this.pos);
                  if (d < bestDist) { target = p; bestDist = d; }
                }
              }
            }
          }

          if (target) {
            this.attackCooldown = 1.2;
            const angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
            const speed = 550;
            game.projectiles.push(new Projectile(this.pos.x, this.pos.y, Math.cos(angle)*speed, Math.sin(angle)*speed, 'tower', this.owner, {damage: this.attackDamage, dmgType: 'physical', glyph: '♦', life: this.attackRange/speed}));
            if (socket) socket.emit('host_event', { type: 'tower_shoot', x: this.pos.x, y: this.pos.y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, owner: this.owner, damage: this.attackDamage, life: this.attackRange/speed });
          }
        }
      }
    }
  }

  // Voláno z applyDamage když věž dostane dmg (jen ARAM)
  takeDamage(amount, killerId) {
    if (this.maxHp === null || this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.dead = true;
      this.owner = -1;
      this.control = 0;
      game.shake = 0.5;
      playSound('capture', this.pos);
      // Odměna za zničení věže — všichni živí útočníci v širokém okolí
      if (!socket || game.isHost) {
        const attackerTeam = killerId ? (game.players.find(p => p.id === killerId)?.team ?? -1) : -1;
        const attackers = attackerTeam >= 0
          ? game.players.filter(p => p.alive && p.team === attackerTeam && dist(p.pos, this.pos) < 900)
          : [];
        let totalLvl = 0, pCount = 0;
        for (let p of game.players) { if (p.team >= 0) { totalLvl += p.level; pCount++; } }
        const avgLevel = pCount > 0 ? totalLvl / pCount : 1;
        const scale = Math.min(avgLevel, 8) / 7.0;
        const gShare = Math.round((200 * scale) / Math.max(1, attackers.length));
        const eShare = Math.round((250 * scale) / Math.max(1, attackers.length));
        for (const p of attackers) grantRewards(p, gShare, eShare);
        const kName = attackers.length > 0 ? attackers[0].className : (attackerTeam === 0 ? 'Blue Team' : 'Red Team');
        const ev = { killer: kName, victim: 'Tower ' + (this.index + 1), killerTeam: attackerTeam, victimTeam: -1, isCapture: false };
        if (socket) socket.emit('broadcast_kill', ev);
        if (game.killFeed) game.killFeed.push({ ...ev, timer: 5.0 });
      }
    }
  }
  draw(ctx){
    if (this.dead) return;
    ctx.font='20px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const color = this.owner>=0 ? TEAM_COLOR[this.owner] : NEUTRAL_COLOR;
    
    if (this.isLocked) {
        ctx.fillStyle = '#666'; ctx.fillText('L', this.pos.x, this.pos.y);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
        ctx.fillText(`Unlocks in ${Math.ceil(this.unlockTimer)}s`, this.pos.x, this.pos.y - 25);
        
        ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.captureRadius, 0, Math.PI*2); ctx.stroke();
        return; // Během zámku nevykreslujeme HP ani obsazovací ring
    }

    ctx.fillStyle = color; ctx.fillText('T', this.pos.x, this.pos.y);

    // HP bar pro ARAM věže
    if (this.maxHp !== null) {
      const bw = 60, bh = 7;
      const bx = this.pos.x - bw/2, by = this.pos.y - 38;
      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = '#111'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = hpPct > 0.5 ? '#0f0' : hpPct > 0.25 ? '#ff0' : '#f00';
      ctx.fillRect(bx, by, bw * hpPct, bh);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by, bw, bh);
      ctx.font = '9px monospace'; ctx.fillStyle = '#fff';
      ctx.fillText(Math.ceil(this.hp) + '/' + this.maxHp, this.pos.x, by - 3);
    }

    // Capture ring (jen classic)
    if (this.maxHp === null) {
      let pct = Math.max(0, Math.min(1, Math.abs(this.control) / 100));
      let progressAngle = -Math.PI/2 + pct * Math.PI*2;
      ctx.font='10px monospace';
      for(let a = -Math.PI/2; a < Math.PI*1.5; a += 0.2) {
          let isCaptured = pct > 0 && a <= progressAngle;
          let char = isCaptured ? '#' : '.';
          ctx.fillStyle = isCaptured ? ((this.control > 0 || this.owner === 0) ? TEAM_COLOR[0] : TEAM_COLOR[1]) : 'rgba(255,255,255,0.2)';
          ctx.fillText(char, this.pos.x + Math.cos(a)*this.captureRadius, this.pos.y + Math.sin(a)*this.captureRadius);
      }
    }
  }
}

export class Minion{
  constructor(x, y, team, targetIndex, opts = {}) {
    this.id = 'm_' + Math.random().toString(36).substr(2, 9);
    this.pos = {x, y}; this.team = team; this.radius = 8; this.speed = 80;
    this.isRanged = opts.isRanged || false;
    this.glyph = this.isRanged ? 'r' : 'm';

    let avgLevel = 1;
    if (game.players && game.players.length > 0) {
        let totalLvl = 0;
        for (let p of game.players) totalLvl += p.level;
        avgLevel = totalLvl / game.players.length;
    }
    let scale = 1 + Math.max(0, avgLevel - 1) * 0.08;

    // Melee: -20% HP/DMG vs original. Ranged: 50% HP of melee, 130% DMG of melee, long range.
    const meleeHp  = Math.round(200 * scale);
    const meleeDmg = Math.round(11  * scale);
    this.maxHp       = this.isRanged ? Math.round(meleeHp * 0.5) : meleeHp;
    this.hp          = this.maxHp;
    this.attackDamage = this.isRanged ? Math.round(meleeDmg * 1.3) : meleeDmg;
    this.attackRange  = this.isRanged ? 180 : 55;

    this.dead = false; this.targetIndex = targetIndex; this.atTarget = false; this.linger = 3.5; this._syncDirty = true;
    this.attackCooldown = 0; this.flashTimer = 0;
    this.thinkTimer = Math.random() * 0.5; this.state = 'PUSH'; this.currentTarget = null;
    this.knockbackTimer = 0; this.knockbackVel = {x: 0, y: 0};
    this.stunTimer = 0; this.silenceTimer = 0;
  }
  think() {
    let giveUpRange = this.isSummon ? 800 : (this.isRanged ? 280 : 200);
    if (activeGameMode && activeGameMode.name === 'arena' && !this.isSummon) giveUpRange = 120; // Rychleji ztratí zájem a vrátí se k postupu
    if (this.currentTarget && (this.currentTarget.dead || this.currentTarget.hp <= 0 || dist(this.pos, this.currentTarget.pos) > giveUpRange)) {
        this.currentTarget = null; this.state = 'PUSH';
    }
    if (this.state === 'PUSH') {
        let nearestEnemy = null, minDist = this.isSummon ? 600 : (this.isRanged ? 200 : 150);
        if (activeGameMode && activeGameMode.name === 'arena' && !this.isSummon) minDist = 100; // Mají klapky na očích a hledí si své cesty
        const enemyPlayers = game.players.filter(p => p.alive && p.team !== this.team);
        const enemyMinions = game.minions.filter(m => !m.dead && m.team !== this.team && m !== this);
        
        if (this.isSummon) {
            for (const p of enemyPlayers) { const d = dist(this.pos, p.pos); if (d < minDist) { nearestEnemy = p; minDist = d; } }
        }
        if (!nearestEnemy) {
            const potentialTargets = [...enemyPlayers, ...enemyMinions];
            for (const t of potentialTargets) { 
                let d = dist(this.pos, t.pos); 
                if (activeGameMode && activeGameMode.name === 'arena' && !this.isSummon && t.className) d += 200; // Silně ignorují hrdiny
                if (d < minDist) { nearestEnemy = t; minDist = d; } 
            }
        }
        if (nearestEnemy) { this.state = 'ATTACK'; this.currentTarget = nearestEnemy; }
    }
  }
  update(dt){ 
    if (socket && !game.isHost) {
        if(this.flashTimer > 0) this.flashTimer -= dt;
        if (this.knockbackTimer > 0) {
            this.knockbackTimer -= dt;
            moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt);
            return;
        }
        if (this.targetPos) { if (dist(this.pos, this.targetPos) > 200) { this.pos.x = this.targetPos.x; this.pos.y = this.targetPos.y; } else { this.pos.x += (this.targetPos.x - this.pos.x) * 15 * dt; this.pos.y += (this.targetPos.y - this.pos.y) * 15 * dt; } }
        return; 
    }
    if(this.dead || game.gameOver) return; 
    const towerTarget = game.towers[this.targetIndex]; if(!towerTarget) return;
    // ARAM retargeting na další žijící věž
    if (towerTarget.dead && activeGameMode && activeGameMode.name === 'aram') {
        if (this.team === 0 && this.targetIndex < 5) this.targetIndex++;
        if (this.team === 1 && this.targetIndex < 2) this.targetIndex++;
    }
    if(this.hp <= 0 && !this.dead) {
      if (typeof this._handleJungleDeath === 'function') this._handleJungleDeath();
      this.dead = true;
      return;
    }
    if(dist(this.pos, activeGameMode.mapConfig.spawnPoints[1-this.team]) < 200 && (!socket || game.isHost)) { applyDamage(this, 1000 * dt, 'true', 'laser'); if(this.hp<=0) { this.dead=true; return; } }
    if(this.flashTimer > 0) this.flashTimer -= dt;
    if(this.stunTimer > 0) this.stunTimer -= dt;
    if(this.attackCooldown>0) this.attackCooldown -= dt;
    
    if (this.knockbackTimer > 0) {
        this.knockbackTimer -= dt;
        if (!socket || game.isHost) moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt); // Pohyb minionů řídí Host
        return;
    }
    if (this.regenBuffTimer > 0) {
        this.regenBuffTimer -= dt;
        if (!socket || game.isHost) { this.hp = Math.min(this.maxHp, this.hp + this.regenBuffAmount * dt); }
        if (Math.random() < 0.1) spawnParticles(this.pos.x, this.pos.y, 1, '#0f0', {life: 0.3});
    }
    if(this.stunTimer > 0) return;
    
    this.thinkTimer -= dt; if (this.thinkTimer <= 0) { this.thinkTimer = 0.4 + Math.random() * 0.2; this.think(); }
    let dx = 0, dy = 0;
    if (this.state === 'ATTACK' && this.currentTarget) {
        const d = dist(this.pos, this.currentTarget.pos);
        const atkRange = this.attackRange;
        const stopRange = this.isRanged ? atkRange - 15 : atkRange - 10;
        const atkCd    = this.isRanged ? 1.8 : 1.2;
        if (this.attackCooldown <= 0 && d <= atkRange) {
            this.attackCooldown = atkCd;
            if (this.isRanged) {
                // Ranged: fire a projectile — damage handled by Projectile.update()
                const angle = Math.atan2(this.currentTarget.pos.y - this.pos.y, this.currentTarget.pos.x - this.pos.x);
                const projSpeed = 320;
                const projLife = (atkRange + 20) / projSpeed;
                game.projectiles.push(new Projectile(
                    this.pos.x, this.pos.y,
                    Math.cos(angle) * projSpeed, Math.sin(angle) * projSpeed,
                    this.id, this.team,
                    { damage: this.attackDamage, dmgType: 'physical', glyph: '•', life: projLife, radius: 5 }
                ));
            } else {
                // Melee: instant damage + small swipe animation
                if (!socket || game.isHost) {
                    applyDamage(this.currentTarget, this.attackDamage, 'physical', this.id);
                }
                const ang = Math.atan2(this.currentTarget.pos.y - this.pos.y, this.currentTarget.pos.x - this.pos.x);
                spawnParticles(this.pos.x + Math.cos(ang) * 12, this.pos.y + Math.sin(ang) * 12,
                    1, this.team === 0 ? '#7af' : '#f87',
                    { glyph: ')', angle: ang, speed: 120, life: 0.18, size: 60, rotate: true, stretchX: 0.35 });
                if (!socket || game.isHost) {
                    if (this.currentTarget.hp <= 0) {
                        if (this.currentTarget.className) handlePlayerKill(this.currentTarget, this.id);
                        else { if (this.currentTarget.die) this.currentTarget.die(); else this.currentTarget.dead = true; }
                        this.currentTarget = null; this.state = 'PUSH';
                    }
                }
            }
        }
        if (this.currentTarget && d > stopRange) { dx = this.currentTarget.pos.x - this.pos.x; dy = this.currentTarget.pos.y - this.pos.y; }
    } else {
        if (!this.atTarget) {
            let destPos = activeGameMode.mapConfig.MINION_SPAWN_POINTS[this.targetIndex] || towerTarget.pos;
            if (activeGameMode && activeGameMode.name === 'arena') {
                if (towerTarget && towerTarget.owner === this.team) {
                    destPos = this.team === 0 ? {x: 2917, y: 682} : {x: 483, y: 682};
                } else {
                    destPos = towerTarget.pos;
                }
            }
            let distToTarget = dist(this.pos, destPos);
            if (activeGameMode && activeGameMode.minionPathMode === 'linear') {
                // ARAM: přímá linka k cíli
                dx = destPos.x - this.pos.x;
                dy = destPos.y - this.pos.y;
            } else {
                // Classic: eliptická cesta kolem středu mapy
                const cx = 2000, cy = 1575, Rx = 1250, Ry = 1150;
                if (distToTarget > 350) { let myA = Math.atan2((this.pos.y - cy)/Ry, (this.pos.x - cx)/Rx); let tA = Math.atan2((destPos.y - cy)/Ry, (destPos.x - cx)/Rx); let diff = tA - myA; while(diff <= -Math.PI) diff += 2*Math.PI; while(diff > Math.PI) diff -= 2*Math.PI; let lookAhead = myA + Math.sign(diff) * 0.15; dx = (cx + Rx * Math.cos(lookAhead)) - this.pos.x; dy = (cy + Ry * Math.sin(lookAhead)) - this.pos.y;
                } else { dx = destPos.x - this.pos.x; dy = destPos.y - this.pos.y; }
            }
            if (distToTarget <= 70) { 
                this.atTarget = true; this.linger = 3.5; dx = 0; dy = 0; 
                if (activeGameMode && activeGameMode.name === 'arena' && towerTarget && towerTarget.owner === this.team) {
                    this.dead = true;
                    if (!socket || game.isHost) {
                        game.score[this.team] = (game.score[this.team] || 0) + 2;
                        game.damageNumbers.push(new DamageNumber(this.pos.x, this.pos.y - 15, '+2', this.team === 0 ? '#486FED' : '#FF4E4E'));
                    }
                }
            }
        }
    }
    if (this.atTarget) {
        // Linger at the lane midpoint then expire — no tower siege
        this.linger -= dt; if (this.linger <= 0) this.dead = true;
    } else {
        if (dx !== 0 || dy !== 0) {
            let currentL = Math.hypot(dx, dy); if (currentL > 0) { dx /= currentL; dy /= currentL; }
            let pcx = Math.floor(this.pos.x / 200), pcy = Math.floor(this.pos.y / 200);
            let nearbyWalls = game.wallGrid ? (game.wallGrid.get(`${pcx},${pcy}`) || []) : game.walls;
            for(let w of nearbyWalls) { let info = distToPoly(this.pos.x, this.pos.y, w.pts); if (info.minDist < w.r + 30 && !info.inside) { dx += info.closestNorm.x * 2.5; dy += info.closestNorm.y * 2.5; let tx = -info.closestNorm.y; let ty = info.closestNorm.x; if (dx * tx + dy * ty < 0) { tx = -tx; ty = -ty; } dx += tx * 3.5 + (Math.random() - 0.5) * 0.5; dy += ty * 3.5 + (Math.random() - 0.5) * 0.5; } }
        }
        const l = Math.hypot(dx, dy); if (l > 0) { moveEntityWithCollision(this, (dx / l) * this.speed, (dy / l) * this.speed, dt); }
    }
  }
  draw(ctx){ 
    if ((this.isSmallChicken || this.isBigChicken) && this.targetHeroId) {
        let target = game.players.find(p => p.id === this.targetHeroId);
        if (target && target.alive) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            ctx.lineTo(target.pos.x, target.pos.y);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.font='14px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle = this.flashTimer > 0 ? '#fff' : (this.team===0? '#aaddff' : '#ffb3b3'); ctx.fillText(this.glyph, this.pos.x, this.pos.y); drawHealthBar(ctx, this.hp, this.maxHp, this.pos.x, this.pos.y+12, this.team); 
  }
}

export class HealPickup {
  constructor(x, y) { this.pos = {x,y}; this.active = true; this.respawnTimer = 0; this.radius = 20; }
  update(dt) {
    if(socket && !game.isHost) return; 
    if(!this.active) { this.respawnTimer -= dt; if(this.respawnTimer <= 0) this.active = true; return; }
    for(let p of game.players) {
      if(p.alive && this.active && dist(p.pos, this.pos) < this.radius + p.radius) {
        applyHeal(p, p.effectiveMaxHp * 0.33); this.active = false; this.respawnTimer = 45.0;
        spawnParticles(this.pos.x, this.pos.y, 25, '#0f0', {speed: 150}); if (p === player) flashMessage("+33% HP!");
        playSound('heal_pickup', this.pos);
        if (socket && game.isHost) socket.emit('host_event', { type: 'heal_pickup', playerId: p.id, hp: p.hp, healIndex: game.heals.indexOf(this) });
      }
    }
  }
  draw(ctx) { if(!this.active) return; ctx.fillStyle = '#0f0'; ctx.font = 'bold 20px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('HP', this.pos.x, this.pos.y); ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2); ctx.strokeStyle = 'rgba(0,255,0,0.8)'; ctx.lineWidth = 2; ctx.stroke(); }
}

export class PowerUp {
  constructor(x,y) { this.pos = {x,y}; this.radius = 80; this.captureTimer = 0; this.active = true; this.respawnTimer = 0; }
  update(dt) {
    if(socket && !game.isHost) return; 
    if(!this.active) { this.respawnTimer -= dt; if(this.respawnTimer <= 0) { this.active = true; this.captureTimer = 0; } return; }
    let capturingPlayer = null; for(let p of game.players) { if(p.alive && dist(p.pos, this.pos) < this.radius) { capturingPlayer = p; break; } }
    if(capturingPlayer) {
      this.captureTimer += dt;
      if(this.captureTimer >= 10.0) {
        capturingPlayer.hasPowerup = true; capturingPlayer.powerupTimer = 120.0; this.active = false; this.respawnTimer = 120.0;
        spawnParticles(this.pos.x, this.pos.y, 40, '#ff0', {speed: 250}); if(capturingPlayer === player) flashMessage("POWER UP OBTAINED! (+20% STATS)");
        if(socket && game.isHost) socket.emit('host_event', { type: 'powerup_pickup', playerId: capturingPlayer.id, x: this.pos.x, y: this.pos.y });
          if (capturingPlayer.powerupsCollected !== undefined) capturingPlayer.powerupsCollected += 1;
          if (typeof capturingPlayer.refreshDominionPCS === 'function') capturingPlayer.refreshDominionPCS();
      }
    } else { if(this.captureTimer > 0) this.captureTimer = Math.max(0, this.captureTimer - dt); }
  }
  draw(ctx) {
    if(!this.active) return; 
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 24px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; 
    ctx.fillText('PP', this.pos.x, this.pos.y);
    
    ctx.font = '12px monospace';
    let progressAngle = -Math.PI/2 + (this.captureTimer / 10.0) * Math.PI*2;
    for(let a = -Math.PI/2; a < Math.PI*1.5; a += 0.2) {
        let isCaptured = this.captureTimer > 0 && a <= progressAngle;
        ctx.fillStyle = isCaptured ? '#ffcc00' : 'rgba(255, 204, 0, 0.3)';
        let char = isCaptured ? '#' : '.';
        ctx.fillText(char, this.pos.x + Math.cos(a)*this.radius, this.pos.y + Math.sin(a)*this.radius);
    }
    
    if(this.captureTimer > 0) { 
        ctx.font = '16px monospace'; ctx.fillStyle = '#ffcc00'; 
        ctx.fillText((10 - this.captureTimer).toFixed(1) + 's', this.pos.x, this.pos.y + 35); 
    }
  }
}

export class SpeedPad {
  constructor(x, y) { this.pos = {x, y}; this.radius = 60; }
  update(dt) {
    if(socket && !game.isHost) return; 
    for (let p of game.players) {
      if (p.alive && dist(p.pos, this.pos) < this.radius + p.radius) {
        p.msBuffTimer = Math.max(p.msBuffTimer || 0, 3.0);
        p.msBuffAmount = Math.max(p.msBuffAmount || 0, 0.25);
        if (Math.random() < 0.2) spawnParticles(p.pos.x, p.pos.y, 1, '#0ff', {life: 0.3, speed: 50});
      }
    }
  }
  draw(ctx) {
    ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.08)'; ctx.fill();
    
    ctx.font = 'bold 14px monospace'; 
    ctx.fillStyle = 'rgba(0, 255, 255, 0.24)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    
    const numChars = 12; // Počet ASCII dílků na okraji

    ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#0ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('>>', this.pos.x, this.pos.y);
  }
}