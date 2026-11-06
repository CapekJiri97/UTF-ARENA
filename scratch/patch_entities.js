import fs from 'fs';

const filePath = 'utf-arena-main/entities/Entities.js';
let raw = fs.readFileSync(filePath, 'utf8');
const hadCRLF = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Minion constructor opts support
const targetConstructor = `    this.spawnDeathTimer = 0; this.deathDamagePercent = 0; this.deathStartTime = null;
  }`;

const replacementConstructor = `    this.spawnDeathTimer = 0; this.deathDamagePercent = 0; this.deathStartTime = null;

    this.name = opts.name || (this.isRanged ? 'Archer' : 'Minion');
    if (opts.glyph) this.glyph = opts.glyph;
    if (opts.color) this.color = opts.color;
    if (opts.radius) this.radius = opts.radius;
    if (opts.speed) this.speed = opts.speed;
    if (opts.maxHp) {
      this.maxHp = opts.maxHp;
      this.hp = this.maxHp;
    }
    if (opts.attackDamage) this.attackDamage = opts.attackDamage;
    if (opts.attackRange) this.attackRange = opts.attackRange;
    if (opts.isBomber) this.isBomber = true;
    if (opts.isBoss) {
      this.isBoss = true;
      this.bossAbilityCd = 4.0;
    }
    if (opts.isFinalBoss) this.isFinalBoss = true;
    if (opts.slowOnHit) this.slowOnHit = opts.slowOnHit;
    if (opts.goldReward) this.goldReward = opts.goldReward;
    if (opts.expReward) this.expReward = opts.expReward;
  }
  explode() {
    if (this._hasExploded) return;
    this._hasExploded = true;
    this.dead = true;
    this.hp = 0;
    const explRadius = 110;
    const explDmg = 160;
    game.shake = 0.4;
    playSound('explosion', this.pos);
    spawnParticles(this.pos.x, this.pos.y, 25, '#ff4400', { speed: 200, life: 0.45 });
    spawnParticles(this.pos.x, this.pos.y, 15, '#ffcc00', { speed: 120, life: 0.3 });

    if (!socket || game.isHost) {
      for (const p of game.players) {
        if (p.alive && p.team === 0 && dist(this.pos, p.pos) <= explRadius + p.radius) {
          applyDamage(p, explDmg, 'physical', this.id, false, true);
        }
      }
      if (game.towers[0] && !game.towers[0].dead && dist(this.pos, game.towers[0].pos) <= explRadius + game.towers[0].radius) {
        game.towers[0].takeDamage(explDmg, this.id);
      }
      for (const m of game.minions) {
        if (m !== this && !m.dead && dist(this.pos, m.pos) <= explRadius) {
          applyDamage(m, explDmg * 0.75, 'physical', this.id, false, true);
          if (m.hp <= 0) m.dead = true;
        }
      }
    }
  }`;

if (!content.includes('this.isBomber = true')) {
  if (content.includes(targetConstructor)) {
    content = content.replace(targetConstructor, replacementConstructor);
    console.log('Minion constructor updated.');
  } else {
    console.error('Target constructor not found!');
  }
}

// 2. Minion.think giveUpRange & heroAggroRange for horde
const targetThink = `    const isArena = activeGameMode && activeGameMode.name === 'arena';
    const isDominion = !this.isSummon && !isArena;
    // Summons chase far; regular minions give up quickly so they stay on objective
    let giveUpRange = this.isSummon ? 800 : 95;
    if (this.currentTarget && (this.currentTarget.dead || this.currentTarget.hp <= 0 || dist(this.pos, this.currentTarget.pos) > giveUpRange)) {
        this.currentTarget = null; this.state = 'PUSH';
    }
    if (this.state === 'PUSH') {
        // Regular minions only aggro heroes that are very close (90px); summons chase normally
        const heroAggroRange = this.isSummon ? 600 : 90;`;

const replacementThink = `    const isArena = activeGameMode && activeGameMode.name === 'arena';
    const isHorde = activeGameMode && activeGameMode.name === 'horde';
    const isDominion = !this.isSummon && !isArena && !isHorde;
    // Summons chase far; regular minions give up quickly so they stay on objective
    let giveUpRange = this.isSummon ? 800 : (isHorde ? 260 : 95);
    if (this.currentTarget && (this.currentTarget.dead || this.currentTarget.hp <= 0 || dist(this.pos, this.currentTarget.pos) > giveUpRange)) {
        this.currentTarget = null; this.state = 'PUSH';
    }
    if (this.state === 'PUSH') {
        // Regular minions only aggro heroes that are very close (90px); summons chase normally
        const heroAggroRange = this.isSummon ? 600 : (isHorde ? (this.isBomber ? 320 : 180) : 90);`;

if (!content.includes('const isHorde = activeGameMode && activeGameMode.name === \'horde\';')) {
  if (content.includes(targetThink)) {
    content = content.replace(targetThink, replacementThink);
    console.log('Minion.think updated.');
  } else {
    console.error('Target think not found!');
  }
}

// 3. Minion.update: bomber proximity check & boss stomp
const targetUpdateStart = `    // Handle summon death timer (e.g. Pheasant after 6s or Ghoul after 8s)
    if (this.isSummon && this.spawnDeathTimer > 0 && (!socket || game.isHost)) {`;

const replacementUpdateStart = `    // Bomber early detonation if close to target player or shrine
    if (this.isBomber && (!socket || game.isHost)) {
      if (this.currentTarget && dist(this.pos, this.currentTarget.pos) <= 45) {
        this.explode();
        return;
      }
      if (game.towers[0] && !game.towers[0].dead && dist(this.pos, game.towers[0].pos) <= 55) {
        this.explode();
        return;
      }
    }

    // Boss Stomp Shockwave
    if (this.isBoss && (!socket || game.isHost)) {
      if (this.bossAbilityCd > 0) this.bossAbilityCd -= dt;
      if (this.bossAbilityCd <= 0) {
        this.bossAbilityCd = this.isFinalBoss ? 5.5 : 7.0;
        const stompRadius = this.isFinalBoss ? 260 : 200;
        const stompDmg = this.isFinalBoss ? 130 : 90;
        game.shake = 0.5;
        playSound('explosion', this.pos);
        spawnParticles(this.pos.x, this.pos.y, 30, '#ff1744', { speed: 220, life: 0.5 });
        for (const p of game.players) {
          if (p.alive && p.team === 0 && dist(this.pos, p.pos) <= stompRadius) {
            applyDamage(p, stompDmg, 'physical', this.id, false, true);
            const kAngle = Math.atan2(p.pos.y - this.pos.y, p.pos.x - this.pos.x);
            p.knockbackTimer = 0.35;
            p.knockbackVel = { x: Math.cos(kAngle) * 350, y: Math.sin(kAngle) * 350 };
            p.stunTimer = Math.max(p.stunTimer || 0, 0.6);
          }
        }
      }
    }

    // Handle summon death timer (e.g. Pheasant after 6s or Ghoul after 8s)
    if (this.isSummon && this.spawnDeathTimer > 0 && (!socket || game.isHost)) {`;

if (!content.includes('// Bomber early detonation')) {
  if (content.includes(targetUpdateStart)) {
    content = content.replace(targetUpdateStart, replacementUpdateStart);
    console.log('Minion.update bomber & boss stomp updated.');
  } else {
    console.error('Target update start not found!');
  }
}

// 4. Minion death explodes bomber
const targetDeath = `    if(this.hp <= 0 && !this.dead) {
      if (typeof this._handleJungleDeath === 'function') this._handleJungleDeath();
      this.dead = true;
      return;
    }`;

const replacementDeath = `    if(this.hp <= 0 && !this.dead) {
      if (this.isBomber) this.explode();
      if (typeof this._handleJungleDeath === 'function') this._handleJungleDeath();
      this.dead = true;
      return;
    }`;

if (!content.includes('if (this.isBomber) this.explode();')) {
  if (content.includes(targetDeath)) {
    content = content.replace(targetDeath, replacementDeath);
    console.log('Minion death bomber explosion updated.');
  } else {
    console.error('Target death not found!');
  }
}

// 5. Laser immunity for horde
const targetLaser = `    const _isAramMode = activeGameMode && activeGameMode.name === 'aram';
    if(!_isAramMode && _laserTarget && dist(this.pos, _laserTarget) < _laserDistThreshold && (!socket || game.isHost)) {`;

const replacementLaser = `    const _noLaserMode = activeGameMode && (activeGameMode.name === 'aram' || activeGameMode.name === 'horde');
    if(!_noLaserMode && _laserTarget && dist(this.pos, _laserTarget) < _laserDistThreshold && (!socket || game.isHost)) {`;

if (!content.includes('_noLaserMode')) {
  if (content.includes(targetLaser)) {
    content = content.replace(targetLaser, replacementLaser);
    console.log('Laser immunity for horde updated.');
  } else {
    console.error('Target laser not found!');
  }
}

// 6. Slow on hit for minion attacks
const targetSwipe = `                if (!socket || game.isHost) {
                    applyDamage(this.currentTarget, this.attackDamage, 'physical', this.id);
                }`;

const replacementSwipe = `                if (!socket || game.isHost) {
                    applyDamage(this.currentTarget, this.attackDamage, 'physical', this.id);
                    if (this.slowOnHit && this.currentTarget.slowTimer !== undefined) {
                        this.currentTarget.slowTimer = Math.max(this.currentTarget.slowTimer || 0, 1.5);
                        this.currentTarget.slowMod = Math.min(this.currentTarget.slowMod || 1, 1 - this.slowOnHit);
                    }
                }`;

if (!content.includes('this.slowOnHit && this.currentTarget.slowTimer')) {
  if (content.includes(targetSwipe)) {
    content = content.replace(targetSwipe, replacementSwipe);
    console.log('Minion slowOnHit updated.');
  } else {
    console.error('Target swipe not found!');
  }
}

// 7. Destructible tower sieging (ARAM + Horde)
const targetAramSiege = `    if (this.atTarget) {
        const isAram = activeGameMode && activeGameMode.name === 'aram';
        if (isAram) {
            // ARAM: Minioni útočí na věž s poškozením (nesebevraždí se do controlu)
            if (this._siegingTower && !this._siegingTower.dead) {
                if (this.attackCooldown <= 0) {
                    this.attackCooldown = this.isRanged ? 1.6 : 1.2;
                    if (!socket || game.isHost) {
                        const dmg = Math.round(this.attackDamage * (this.isRanged ? 1.2 : 1.5));
                        this._siegingTower.takeDamage(dmg, this.id);
                    }
                    const col = this.team === 0 ? '#486FED' : '#FF4E4E';
                    spawnParticles(this._siegingTower.pos.x, this._siegingTower.pos.y, 3, col, {speed: 80, life: 0.25});
                    playSound('hit_physical', this._siegingTower.pos);
                }
            } else {
                // Věž padla -> reset atTarget a pochod na další věž
                this.atTarget = false;
                this._siegingTower = null;
                const order = this.team === 0 ? [3, 4, 5] : [0, 1, 2];
                const nextIdx = order.find(i => game.towers[i] && !game.towers[i].dead);
                if (nextIdx !== undefined) this.targetIndex = nextIdx;
            }
        } else {`;

const replacementAramSiege = `    if (this.atTarget) {
        const isDestructibleTower = this._siegingTower && this._siegingTower.maxHp !== null;
        if (isDestructibleTower) {
            // ARAM & Horde: Minioni útočí na věž s poškozením (nesebevraždí se do controlu)
            if (this.isBomber) {
                this.explode();
            } else if (!this._siegingTower.dead) {
                if (this.attackCooldown <= 0) {
                    this.attackCooldown = this.isRanged ? 1.6 : 1.2;
                    if (!socket || game.isHost) {
                        const dmg = Math.round(this.attackDamage * (this.isRanged ? 1.2 : 1.5));
                        this._siegingTower.takeDamage(dmg, this.id);
                    }
                    const col = this.team === 0 ? '#486FED' : '#FF4E4E';
                    spawnParticles(this._siegingTower.pos.x, this._siegingTower.pos.y, 3, col, {speed: 80, life: 0.25});
                    playSound('hit_physical', this._siegingTower.pos);
                }
            } else {
                // Věž padla -> reset atTarget a pochod na další věž
                this.atTarget = false;
                this._siegingTower = null;
                if (activeGameMode && activeGameMode.name === 'aram') {
                    const order = this.team === 0 ? [3, 4, 5] : [0, 1, 2];
                    const nextIdx = order.find(i => game.towers[i] && !game.towers[i].dead);
                    if (nextIdx !== undefined) this.targetIndex = nextIdx;
                }
            }
        } else {`;

if (!content.includes('isDestructibleTower')) {
  if (content.includes(targetAramSiege)) {
    content = content.replace(targetAramSiege, replacementAramSiege);
    console.log('Destructible tower siege updated.');
  } else {
    console.error('Target ARAM siege not found!');
  }
}

// 8. Tower HP bar label
const targetTowerLabel = `      ctx.font = '9px monospace'; ctx.fillStyle = shielded ? '#00e5ff' : '#fff';
      ctx.fillText(shielded ? 'SHIELDED' : (Math.ceil(this.hp) + '/' + this.maxHp), this.pos.x, by - 3);`;

const replacementTowerLabel = `      ctx.font = '9px monospace'; ctx.fillStyle = shielded ? '#00e5ff' : '#fff';
      const hpLabel = (activeGameMode && activeGameMode.name === 'horde')
        ? (\`SHRINE \${Math.ceil(this.hp)}/\${this.maxHp}\`)
        : (shielded ? 'SHIELDED' : (Math.ceil(this.hp) + '/' + this.maxHp));
      ctx.fillText(hpLabel, this.pos.x, by - 3);`;

if (!content.includes('SHRINE ${Math.ceil(this.hp)}')) {
  if (content.includes(targetTowerLabel)) {
    content = content.replace(targetTowerLabel, replacementTowerLabel);
    console.log('Tower.draw shrine label updated.');
  } else {
    console.error('Target tower label not found!');
  }
}

if (hadCRLF) {
  content = content.replace(/\n/g, '\r\n');
}
fs.writeFileSync(filePath, content, 'utf8');
console.log('All Entities.js patches applied successfully!');
