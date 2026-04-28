import { dist, isPointInPoly, distToPoly } from './Utils.js';
import { game, TEAM_COLOR, NEUTRAL_COLOR } from './State.js';
import { mapBoundary, spawnPoints } from './MapConfig.js';
import { spawnParticles } from './Effects.js';
import { socket, applyDamage, handlePlayerKill, moveEntityWithCollision, drawHealthBar, flashMessage, player } from './main.js';

export class Projectile{
  constructor(x,y,vx,vy,ownerId,ownerTeam,opts={}){ this.pos={x,y}; this.vel={x:vx,y:vy}; 
    this.radius=opts.radius||4; this.life=opts.life||2.0; this.ownerId = ownerId; this.ownerTeam = ownerTeam; this.damage = opts.damage||25; this.dmgType = opts.dmgType||'physical'; this.glyph = opts.glyph||'*'; this.dead = false;
    this.color = ownerTeam === 0 ? '#4da6ff' : (ownerTeam === 1 ? '#ff6b6b' : '#fff'); }
  update(dt){ if(this.dead) return; this.pos.x += this.vel.x*dt; this.pos.y += this.vel.y*dt; this.life -= dt; if(this.life<=0) this.dead = true;
    if(!isPointInPoly(this.pos.x, this.pos.y, mapBoundary)) { this.dead = true; spawnParticles(this.pos.x, this.pos.y, 5, '#888'); return; }
    for(let w of game.walls) { 
      let info = distToPoly(this.pos.x, this.pos.y, w.pts);
      if(info.inside || info.minDist < w.r) { this.dead = true; spawnParticles(this.pos.x, this.pos.y, 5, '#888'); return; }
    }
    
    let hit = false;
    for(let m of game.minions){ 
      if(!m.dead && m.team !== this.ownerTeam && dist(this.pos, m.pos) < this.radius + m.radius){ 
        hit = true; applyDamage(m, this.damage, this.dmgType, this.ownerId); spawnParticles(this.pos.x, this.pos.y, 4, '#f00'); 
        if(m.hp<=0){ m.dead = true; const owner = game.players.find(x=>x.id===this.ownerId); if(owner){ owner.gold += 10; owner.totalGold += 10; owner.exp += 15; } } break; 
      } 
    }
    if (hit) { this.dead = true; return; }
    
    for(let p of game.players){ 
      if(p.id !== this.ownerId && p.team !== this.ownerTeam && p.alive && dist(this.pos, p.pos) < this.radius + p.radius){ 
        hit = true; applyDamage(p, this.damage, this.dmgType, this.ownerId); spawnParticles(this.pos.x, this.pos.y, 4, '#f00'); 
        if(p.hp<=0 && (!socket || game.isHost)){ handlePlayerKill(p, this.ownerId); } break; 
      } 
    }
    if (hit) { this.dead = true; }
  }
  draw(ctx){ 
    ctx.fillStyle = this.color; ctx.font=`bold ${Math.round(this.radius * 4.5)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'; 
    ctx.shadowColor = this.color; ctx.shadowBlur = 8;
    ctx.fillText(this.glyph, this.pos.x, this.pos.y); 
    ctx.shadowBlur = 0; 
  }
}

export class Tower{
  constructor(x,y,index){ this.pos={x,y}; this.index = index; this.radius=20; this.captureRadius = 80; this.owner = -1; this.control = 0; this.attackCooldown = 0; this.attackRange = 320; this.attackDamage = 45; }
  update(dt){ if(game.gameOver) return; 
    if (!socket || game.isHost) {
      const counts = [0,0]; for(let p of game.players){ if(p.alive && dist(p.pos, this.pos) <= this.captureRadius) counts[p.team]++; } 
      const presenceDelta = counts[0] - counts[1];
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
      if (this.control >= 100 && this.owner !== 0){ this.owner = 0; this.control = 100; game.shake = 0.3; } 
      if (this.control <= -100 && this.owner !== 1){ this.owner = 1; this.control = -100; game.shake = 0.3; }
    }
    if (this.owner >= 0) {
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && (!socket || game.isHost)) {
        let isBeingCaptured = false;
        for (let p of game.players) { if (p.alive && p.team !== this.owner && dist(p.pos, this.pos) <= this.captureRadius) { isBeingCaptured = true; break; } }
        if (!isBeingCaptured) {
          let target = null; let bestDist = this.attackRange;
          for (let m of game.minions) { if (m.team !== this.owner && !m.dead) { const d = dist(m.pos, this.pos); if (d < bestDist) { target = m; bestDist = d; } } }
          if (!target) { for (let p of game.players) { if (p.team !== this.owner && p.alive) { const d = dist(p.pos, this.pos); if (d < bestDist) { target = p; bestDist = d; } } } }
          if (target) {
            this.attackCooldown = 1.5; const angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x); const speed = 500;
            game.projectiles.push(new Projectile(this.pos.x, this.pos.y, Math.cos(angle)*speed, Math.sin(angle)*speed, 'tower', this.owner, {damage: this.attackDamage, dmgType: 'physical', glyph: '♦', life: this.attackRange/speed}));
            if (socket) socket.emit('host_event', { type: 'tower_shoot', x: this.pos.x, y: this.pos.y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, owner: this.owner, damage: this.attackDamage, life: this.attackRange/speed });
          }
        }
      }
    }
  }
  draw(ctx){ ctx.font='20px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; const color = this.owner>=0 ? TEAM_COLOR[this.owner] : NEUTRAL_COLOR; ctx.fillStyle = color; ctx.fillText('T', this.pos.x, this.pos.y);
    const totalBoxes = 8; let pct = Math.max(0, Math.min(1, Math.abs(this.control) / 100)); let filled = Math.round(pct * totalBoxes) || 0;
    let bar = '[' + '='.repeat(filled) + ' '.repeat(totalBoxes - filled) + ']';
    ctx.font='10px monospace'; ctx.fillText(bar, this.pos.x, this.pos.y + 18);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for(let a=0; a<Math.PI*2; a+=0.4){ ctx.fillText('.', this.pos.x + Math.cos(a)*this.captureRadius, this.pos.y + Math.sin(a)*this.captureRadius); }
  }
}

export class Minion{
  constructor(x,y,team,targetIndex){ 
    this.id = 'm_' + Math.random().toString(36).substr(2,9); 
    this.pos={x,y}; this.team = team; this.radius=8; this.glyph='m'; this.speed = 80; this.maxHp = 250; this.hp = 250; this.dead = false; this.targetIndex = targetIndex; this.atTarget = false; this.linger = 3.5; this.attackCooldown = 0; this.attackDamage = 25; this.flashTimer = 0; 
    this.thinkTimer = Math.random() * 0.5; this.state = 'PUSH'; this.currentTarget = null;
    this.knockbackTimer = 0; this.knockbackVel = {x:0, y:0};
  }
  think() {
    if (this.atTarget || (this.currentTarget && (this.currentTarget.dead || this.currentTarget.hp <= 0 || dist(this.pos, this.currentTarget.pos) > 200))) {
        this.currentTarget = null; this.state = 'PUSH';
    }
    if (this.state === 'PUSH') {
        let nearestEnemy = null, minDist = 150;
        const potentialTargets = [...game.players.filter(p => p.alive && p.team !== this.team), ...game.minions.filter(m => !m.dead && m.team !== this.team && m !== this)];
        for (const t of potentialTargets) { const d = dist(this.pos, t.pos); if (d < minDist) { nearestEnemy = t; minDist = d; } }
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
    if(this.hp <= 0 && !this.dead) { this.dead = true; return; }
    if(dist(this.pos, spawnPoints[1-this.team]) < 200) { applyDamage(this, 1000 * dt, 'true', 'laser'); if(this.hp<=0) { this.dead=true; return; } }
    if(this.flashTimer > 0) this.flashTimer -= dt;
    if(this.attackCooldown>0) this.attackCooldown -= dt;
    
    if (this.knockbackTimer > 0) {
        this.knockbackTimer -= dt;
        moveEntityWithCollision(this, this.knockbackVel.x, this.knockbackVel.y, dt);
        return;
    }
    
    this.thinkTimer -= dt; if (this.thinkTimer <= 0) { this.thinkTimer = 0.4 + Math.random() * 0.2; this.think(); }
    let dx = 0, dy = 0;
    if (this.state === 'ATTACK' && this.currentTarget) {
        const d = dist(this.pos, this.currentTarget.pos);
        if (this.attackCooldown <= 0 && d <= 55) {
            applyDamage(this.currentTarget, this.attackDamage, 'physical', 'minion'); this.attackCooldown = 1.2;
            if (this.currentTarget.hp <= 0) { if (this.currentTarget.die) this.currentTarget.die(); else this.currentTarget.dead = true; this.currentTarget = null; this.state = 'PUSH'; }
        }
        if (this.currentTarget && d > 45) { dx = this.currentTarget.pos.x - this.pos.x; dy = this.currentTarget.pos.y - this.pos.y; }
    } else {
        if (!this.atTarget) {
            const cx = 2000, cy = 1575, Rx = 1250, Ry = 1150; let distToTarget = dist(this.pos, towerTarget.pos);
            if (distToTarget > 350) { let myA = Math.atan2((this.pos.y - cy)/Ry, (this.pos.x - cx)/Rx); let tA = Math.atan2((towerTarget.pos.y - cy)/Ry, (towerTarget.pos.x - cx)/Rx); let diff = tA - myA; while(diff <= -Math.PI) diff += 2*Math.PI; while(diff > Math.PI) diff -= 2*Math.PI; let lookAhead = myA + Math.sign(diff) * 0.15; dx = (cx + Rx * Math.cos(lookAhead)) - this.pos.x; dy = (cy + Ry * Math.sin(lookAhead)) - this.pos.y;
            } else { dx = towerTarget.pos.x - this.pos.x; dy = towerTarget.pos.y - this.pos.y; }
            if(distToTarget <= towerTarget.captureRadius - 10){ this.atTarget = true; this.linger = 3.5; dx = 0; dy = 0; }
        }
    }
    if (this.atTarget) {
        if (towerTarget.owner !== this.team) {
            if (this.attackCooldown <= 0) { if (this.team === 0) towerTarget.control += 5; else towerTarget.control -= 5; this.hp -= this.maxHp * 0.10; if (this.hp <= 0) this.dead = true; this.attackCooldown = 1.0; spawnParticles(towerTarget.pos.x, towerTarget.pos.y, 4, '#ffa500'); }
        } else { this.linger -= dt; if (this.linger <= 0) this.dead = true; }
    } else {
        if (dx !== 0 || dy !== 0) {
            let currentL = Math.hypot(dx, dy); if (currentL > 0) { dx /= currentL; dy /= currentL; }
            for(let w of game.walls) { let info = distToPoly(this.pos.x, this.pos.y, w.pts); if (info.minDist < w.r + 30 && !info.inside) { dx += info.closestNorm.x * 2.5; dy += info.closestNorm.y * 2.5; let tx = -info.closestNorm.y; let ty = info.closestNorm.x; if (dx * tx + dy * ty < 0) { tx = -tx; ty = -ty; } dx += tx * 3.5 + (Math.random() - 0.5) * 0.5; dy += ty * 3.5 + (Math.random() - 0.5) * 0.5; } }
        }
        const l = Math.hypot(dx, dy); if (l > 0) { moveEntityWithCollision(this, (dx / l) * this.speed, (dy / l) * this.speed, dt); }
    }
  }
  draw(ctx){ ctx.font='14px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle = this.flashTimer > 0 ? '#fff' : (this.team===0? '#b3ffb3' : '#ffb3b3'); ctx.fillText(this.glyph, this.pos.x, this.pos.y); drawHealthBar(ctx, this.hp, this.maxHp, this.pos.x, this.pos.y+12, this.team); }
}

export class HealPickup {
  constructor(x, y) { this.pos = {x,y}; this.active = true; this.respawnTimer = 0; this.radius = 20; }
  update(dt) {
    if(socket && !game.isHost) return; 
    if(!this.active) { this.respawnTimer -= dt; if(this.respawnTimer <= 0) this.active = true; return; }
    for(let p of game.players) {
      if(p.alive && this.active && dist(p.pos, this.pos) < this.radius + p.radius) {
        p.hp = Math.min(p.effectiveMaxHp, p.hp + p.effectiveMaxHp * 0.5); this.active = false; this.respawnTimer = 45.0;
        spawnParticles(this.pos.x, this.pos.y, 25, '#0f0', {speed: 150}); if (p === player) flashMessage("+50% HP!");
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
      }
    } else { if(this.captureTimer > 0) this.captureTimer = Math.max(0, this.captureTimer - dt); }
  }
  draw(ctx) {
    if(!this.active) return; ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 24px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('PP', this.pos.x, this.pos.y);
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2); ctx.stroke();
    if(this.captureTimer > 0) { ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius + 8, -Math.PI/2, -Math.PI/2 + (this.captureTimer / 10.0) * Math.PI*2); ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 6; ctx.stroke(); ctx.font = '16px monospace'; ctx.fillStyle = '#ffcc00'; ctx.fillText((10 - this.captureTimer).toFixed(1) + 's', this.pos.x, this.pos.y + 25); }
  }
}