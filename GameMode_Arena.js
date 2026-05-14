import { game, camera } from './State.js';
import * as ArenaMap from './MapConfig_Arena.js';
import { showEnd } from './UI.js';
import { ArenaBrain } from './BotBrain.js';
import { Minion } from './Entities.js';
import { player, flashMessage, applyDamage, drawHealthBar, socket } from './main.js';
import { spawnParticles } from './Effects.js';
import { dist } from './Utils.js';
import { playSound } from './Audio.js';

// ── Arena game mode ───────────────────────────────────────────────────────────
// 4v4, elipsová mapa, jedna neutrální věž uprostřed.
// Skóre: držení věže = +5 bodů / 10 s, kill = +1 bod.
// První tým na 150 bodů vyhrává.
// Žádní minioni, žádné healy, žádné powerupy.

const SCORE_CAP        = 150;   // body pro výhru
const HOLD_POINTS      = 3;     // body za 10 sekund držení věže
const HOLD_INTERVAL    = 6.0;  // sekund mezi bodováním za držení
const KILL_POINTS      = 1;     // bod za kill


export const GameMode_Arena = {
  name: 'arena',
  mapConfig: ArenaMap,

  minionPathMode: 'linear',

  // game.score nahrazuje game.nexus jako hlavní stav skóre
  init() {
    game.score  = { 0: 0, 1: 0 };
    game.nexus  = { 0: SCORE_CAP, 1: SCORE_CAP }; // proxy pro HUD kompatibilitu — zobrazíme skóre
    this._holdTimer = 0;

    camera.scale = 1.52;

    this.camps = [
        { x: 2350, y: 160, buff: 'AS_AH', glyph: 'A', color: '#4a53d0', respawnTimer: 0, m: null }, // Nahoře Vpravo
        { x: 1700, y: 120, buff: 'POWER', glyph: 'P', color: '#f98101', respawnTimer: 0, m: null }, // Nahoře Střed
        { x: 1050, y: 160, buff: 'TANK', glyph: 'T', color: '#0da20d', respawnTimer: 0, m: null },  // Nahoře Vlevo
        { x: 2350, y: 1180, buff: 'TANK', glyph: 'T', color: '#0da20d', respawnTimer: 0, m: null }, // Dole Vpravo
        { x: 1700, y: 1220, buff: 'POWER', glyph: 'P', color: '#f98101', respawnTimer: 0, m: null },// Dole Střed
        { x: 1050, y: 1180, buff: 'AS_AH', glyph: 'A', color: '#4a53d0', respawnTimer: 0, m: null } // Dole Vlevo
    ];

    // Věž začíná neutrální
    setTimeout(() => {
      for (const t of game.towers) {
        t.owner = -1; t.control = 0;
        t.isLocked = true;
        t.unlockTimer = 30.0;
      }
    }, 0);
  },

  tickSpawn(_dt, spawnTimer, _interval) {
    let newTimer = spawnTimer + _dt;
    if (newTimer >= 20.0) {
      newTimer = 0;
      
      const spBlue = ArenaMap.arenaMinionSpawns[0];
      if (spBlue) {
        spBlue.forEach(sp => {
          for (let k = 0; k < 1; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 0, 0));
          for (let k = 0; k < 1; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 0, 0, { isRanged: true }));
        });
      }

      const spRed = ArenaMap.arenaMinionSpawns[1];
      if (spRed) {
        spRed.forEach(sp => {
          for (let k = 0; k < 1; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 1, 0));
          for (let k = 0; k < 1; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 1, 0, { isRanged: true }));
        });
      }

      const centerTower = game.towers[0];
      if (centerTower && centerTower.owner >= 0) {
        const owner = centerTower.owner;
        for (let k = 0; k < 1; k++) game.minions.push(new Minion(centerTower.pos.x + (Math.random() - 0.5) * 40, centerTower.pos.y + (Math.random() - 0.5) * 40, owner, 0));
        for (let k = 0; k < 1; k++) game.minions.push(new Minion(centerTower.pos.x + (Math.random() - 0.5) * 40, centerTower.pos.y + (Math.random() - 0.5) * 40, owner, 0, { isRanged: true }));
      }
    }

    // Spawnování a udržování Jungle kempů
    for (let camp of this.camps) {
        if (!camp.m || camp.m.dead) {
            camp.respawnTimer -= _dt;
            if (camp.respawnTimer <= 0) {
                let m = new Minion(camp.x, camp.y, -1, 0); 
                m.isJungleMonster = true;
                m.maxHp = 1250; m.hp = m.maxHp;
                m.attackDamage = 35;
                m.glyph = camp.glyph;
                m.speed = 100;
                m.camp = camp;
                m.color = camp.color;
                m._jungleDeathHandled = false;
                m._handleJungleDeath = function() {
                  if (this._jungleDeathHandled) return;
                  this._jungleDeathHandled = true;
                  if (this.camp) this.camp.respawnTimer = 150.0;
                  if (!socket || game.isHost) {
                    let killer = game.players.find(p => p.id === this.lastAttackerId);
                    if (!killer) {
                        let kMinion = game.minions.find(m => m.id === this.lastAttackerId);
                        if (kMinion && kMinion.ownerId) {
                            killer = game.players.find(p => p.id === kMinion.ownerId);
                        }
                    }
                    if (killer) {
                      if (this.camp.buff === 'POWER') killer.junglePowerTimer = 120.0;
                      else if (this.camp.buff === 'AS_AH') killer.jungleAsAhTimer = 120.0;
                      else if (this.camp.buff === 'TANK') killer.jungleTankTimer = 120.0;

                      if (socket) socket.emit('host_event', {type: 'jungle_buff', playerId: killer.id, buff: this.camp.buff});
                      spawnParticles(killer.pos.x, killer.pos.y, 30, '#fff', {speed: 150});
                      if (killer === player) flashMessage("JUNGLE BUFF OBTAINED!");
                      playSound('heal_pickup', killer.pos);
                    }
                  }
                  spawnParticles(this.pos.x, this.pos.y, 20, this.camp.color);
                };
                
                m.update = function(dt) {
                    if (this.dead || game.gameOver) return;
                    
                    // Zabíjení monstra a předávání buffu
                    if (this.hp <= 0) {
                        if (typeof this._handleJungleDeath === 'function') this._handleJungleDeath();
                        this.dead = true;
                        return;
                    }
                    
                    if (this.flashTimer > 0) this.flashTimer -= dt;
                    if (this.attackCooldown > 0) this.attackCooldown -= dt;
                    if (this.knockbackTimer > 0) { this.knockbackTimer -= dt; return; }
                    
                    let distToCamp = dist(this.pos, {x: this.camp.x, y: this.camp.y});
                    
                    if (distToCamp >= 250) {
                        this.isResetting = true;
                    }
                    
                    if (this.isResetting && distToCamp < 10) {
                        this.isResetting = false;
                        this.lastAttackerId = null;
                        this.targetHeroId = null;
                    }
                    
                    if (this.lastAttackerId && !this.targetHeroId && !this.isResetting) {
                        this.targetHeroId = this.lastAttackerId;
                    }
                    
                    let target = game.players.find(p => p.id === this.targetHeroId) || game.minions.find(m => m.id === this.targetHeroId);
                    let isTargetValid = target && (target.alive !== false && !target.dead);
                    
                    if (isTargetValid && !this.isResetting) {
                        let d = dist(this.pos, target.pos);
                        if (d <= 65) {
                            if (this.attackCooldown <= 0) {
                                this.attackCooldown = 1.2;
                                if (!socket || game.isHost) applyDamage(target, this.attackDamage, 'physical', this.id);
                                const ang = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
                                spawnParticles(this.pos.x + Math.cos(ang)*15, this.pos.y + Math.sin(ang)*15, 1, '#f00', {glyph: ')', angle: ang, speed: 60, life: 0.15, size: 40});
                                playSound('hit', this.pos);
                            }
                        } else { let dx = target.pos.x - this.pos.x, dy = target.pos.y - this.pos.y; let l = Math.hypot(dx, dy); this.pos.x += (dx/l)*this.speed*dt; this.pos.y += (dy/l)*this.speed*dt; }
                    } else {
                        this.targetHeroId = null;
                        if (distToCamp > 10) { 
                            let dx = this.camp.x - this.pos.x, dy = this.camp.y - this.pos.y; let l = Math.hypot(dx, dy); 
                            this.pos.x += (dx/l)*this.speed*dt; this.pos.y += (dy/l)*this.speed*dt; 
                            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15 * dt); 
                        } else { 
                            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15 * dt); 
                            this.lastAttackerId = null;
                        }
                    }
                };
                
                m.draw = function(ctx) { ctx.font='bold 24px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle = this.flashTimer > 0 ? '#fff' : this.camp.color; ctx.fillText(this.glyph, this.pos.x, this.pos.y); drawHealthBar(ctx, this.hp, this.maxHp, this.pos.x, this.pos.y+16, this.team); };
                camp.m = m; game.minions.push(m);
            }
        }
    }
    return newTimer;
  },

  tickObjective(dt, _drainRate, socket) {
    if (game.startDelay > 0 || game.gameOver) return;

    // Bodování za držení věže každých HOLD_INTERVAL sekund
    this._holdTimer = (this._holdTimer || 0) + dt;
    if (this._holdTimer >= HOLD_INTERVAL) {
      this._holdTimer = 0;
      const holder = game.towers[0] && game.towers[0].owner >= 0 ? game.towers[0].owner : -1;
      if (holder >= 0) {
        game.score[holder] = (game.score[holder] || 0) + HOLD_POINTS;
      }
    }

    // Synchronizuj game.nexus pro HUD (zobrazujeme skóre místo HP)
    game.nexus[0] = game.score[0] || 0;
    game.nexus[1] = game.score[1] || 0;

    // Win condition
    if ((game.score[0] || 0) >= SCORE_CAP && !game.gameOver) this._triggerGameOver(0, socket);
    if ((game.score[1] || 0) >= SCORE_CAP && !game.gameOver) this._triggerGameOver(1, socket);
  },

  // Voláno z main.js handlePlayerKill — přidej bod zabíjejícímu týmu
  onKill(killerTeam) {
    if (killerTeam < 0 || killerTeam > 1) return;
    game.score[killerTeam] = (game.score[killerTeam] || 0) + KILL_POINTS;
  },

  _triggerGameOver(winner, socket) {
    game.gameOver = true;
    game.winner = winner;
    showEnd(winner);
    if (socket) {
      socket.emit('host_event', {
        type: 'game_over',
        winner,
        finalStats: game.players.map(p => ({
          id: p.id, stats: p.stats, kills: p.kills, deaths: p.deaths, assists: p.assists,
          totalGold: p.totalGold,
          pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null,
        })),
      });
    }
  },

  drawHUD(ctx, cw, isMobile) {
    const s0 = Math.floor(game.score?.[0] || 0);
    const s1 = Math.floor(game.score?.[1] || 0);
    const cxTop = cw / 2;
    const holder = game.towers[0] && game.towers[0].owner >= 0 ? game.towers[0].owner : -1;

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    // Název módu
    ctx.font = isMobile ? 'bold 10px monospace' : 'bold 13px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('ARENA', cxTop, 2);

    // Skóre
    ctx.font = isMobile ? 'bold 18px monospace' : 'bold 28px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(' : ', cxTop, isMobile ? 12 : 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#486FED';
    ctx.fillText(s0, cxTop - 15, isMobile ? 12 : 18);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF4E4E';
    ctx.fillText(s1, cxTop + 15, isMobile ? 12 : 18);

    // Cíl a indikátor kdo drží věž
    ctx.font = isMobile ? 'bold 9px monospace' : 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`goal: ${SCORE_CAP}`, cxTop, isMobile ? 34 : 50);

    if (holder >= 0) {
      const hColor = holder === 0 ? '#486FED' : '#FF4E4E';
      const hName  = holder === 0 ? 'BLUE' : 'RED';
      ctx.fillStyle = hColor;
      ctx.fillText(`${hName} holds (+${HOLD_POINTS}pts/10s)`, cxTop, isMobile ? 44 : 64);
    } else {
      ctx.fillStyle = '#888';
      ctx.fillText('NEUTRAL', cxTop, isMobile ? 44 : 64);
    }

    // Progressbary
    const barW = isMobile ? 80 : 120;
    const barH = isMobile ? 8  : 12;
    const barY = isMobile ? 55 : 80;

    const drawBar = (score, bx, color) => {
      const pct = Math.min(1, score / SCORE_CAP);
      ctx.fillStyle = '#111'; ctx.fillRect(bx, barY, barW, barH);
      ctx.fillStyle = color;  ctx.fillRect(bx, barY, barW * pct, barH);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(bx, barY, barW, barH);
    };
    drawBar(s0, cxTop - barW - 8, '#486FED');
    drawBar(s1, cxTop + 8,        '#FF4E4E');
  },

  getBotLane(_idx) {
    return 'mid';
  },

  // Jediná věž uprostřed — oba týmy ji chtějí, žádná "home" věž
  homeTowerIndexes: { 0: [], 1: [] },

  // Strategická AI pro boty — Arena: drž věž pro body, huntuj pro body
  botBrain: ArenaBrain,
};
