import { game, camera } from '../shared/State.js';
import * as AramMap from './MapConfig_ARAM.js';
import { showEnd } from '../client/UI.js';
import { AramBrain } from '../entities/BotBrain.js';
import { Minion } from '../entities/Entities.js';

// ── ARAM game mode — 5v5 v jedné lince s věžemi ──────────────────────────────
// Věže s HP jako v LoLku (Outer 1500, Inner 2000, Base 2500).
// Minioni chodí a pomáhají bořit. Konec hry = zničení Base věže.

export const GameMode_ARAM = {
  name: 'aram',
  mapConfig: AramMap,

  minionPathMode: 'linear',

  init() {
    game.nexus = { 0: 1, 1: 1 };

    // Kamera — ARAM mapa je 3200×2000
    camera.scale = 1.52;

    // Nastavení věží pro ARAM
    const towerHPs = [1500, 2000, 2500, 1500, 2000, 2500];
    game.towers.forEach((t, i) => {
      t.owner = i < 3 ? 0 : 1;
      t.control = t.owner === 0 ? 100 : -100;
      t.maxHp = towerHPs[i];
      t.hp = t.maxHp;
      t.attackDamage = 150;
      t.attackRange = 420;
    });
  },

  tickSpawn(dt, spawnTimer, _spawnInterval) {
    let newTimer = spawnTimer + dt;
    if (newTimer >= 15.0) {
      newTimer = 0;
      const spBlue = AramMap.aramMinionSpawns[0];
      const spRed  = AramMap.aramMinionSpawns[1];

      // Modří útočí na první živou červenou věž v řadě (3 Outer -> 4 Inner -> 5 Base)
      const blueAlive = [3, 4, 5].find(i => game.towers[i] && !game.towers[i].dead);
      const blueTargetIndex = blueAlive !== undefined ? blueAlive : 5;

      // Červení útočí na první živou modrou věž v řadě (0 Outer -> 1 Inner -> 2 Base)
      const redAlive = [0, 1, 2].find(i => game.towers[i] && !game.towers[i].dead);
      const redTargetIndex = redAlive !== undefined ? redAlive : 2;

      if (spBlue) {
        for (let k = 0; k < 3; k++) game.minions.push(new Minion(spBlue.x + (Math.random()-0.5)*40, spBlue.y + (Math.random()-0.5)*40, 0, blueTargetIndex));
        for (let k = 0; k < 2; k++) game.minions.push(new Minion(spBlue.x + (Math.random()-0.5)*40, spBlue.y + (Math.random()-0.5)*40, 0, blueTargetIndex, { isRanged: true }));
      }

      if (spRed) {
        for (let k = 0; k < 3; k++) game.minions.push(new Minion(spRed.x + (Math.random()-0.5)*40, spRed.y + (Math.random()-0.5)*40, 1, redTargetIndex));
        for (let k = 0; k < 2; k++) game.minions.push(new Minion(spRed.x + (Math.random()-0.5)*40, spRed.y + (Math.random()-0.5)*40, 1, redTargetIndex, { isRanged: true }));
      }
    }
    return newTimer;
  },

  tickObjective(_dt, _nexusDrainRate, socket) {
    if (game.startDelay > 0 || game.gameOver) return;

    const blueBaseDead = game.towers[2] && game.towers[2].dead;
    const redBaseDead  = game.towers[5] && game.towers[5].dead;

    if (blueBaseDead && !game.gameOver) {
      this._triggerGameOver(1, socket);
    } else if (redBaseDead && !game.gameOver) {
      this._triggerGameOver(0, socket);
    }
  },

  _triggerGameOver(winner, socket) {
    game.gameOver = true;
    game.winner = winner;
    if (typeof showEnd === 'function') {
      try { showEnd(winner); } catch (e) {}
    }
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
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('ARAM', cw / 2, 2);

    // Kills display
    const blueKills = game.players ? game.players.filter(p => p.team === 0).reduce((s, p) => s + (p.kills || 0), 0) : 0;
    const redKills  = game.players ? game.players.filter(p => p.team === 1).reduce((s, p) => s + (p.kills || 0), 0) : 0;
    
    ctx.font = isMobile ? 'bold 18px monospace' : 'bold 22px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(' : ', cw / 2, isMobile ? 14 : 18);
    ctx.textAlign = 'right'; ctx.fillStyle = '#486FED'; ctx.fillText(blueKills, cw / 2 - 18, isMobile ? 14 : 18);
    ctx.textAlign = 'left';  ctx.fillStyle = '#FF4E4E'; ctx.fillText(redKills,  cw / 2 + 18, isMobile ? 14 : 18);

    // Status aktivních front-line věží
    if (game.towers && game.towers.length >= 6) {
      const blueFront = [0, 1, 2].map(i => game.towers[i]).find(t => t && !t.dead) || game.towers[2];
      const redFront  = [3, 4, 5].map(i => game.towers[i]).find(t => t && !t.dead) || game.towers[5];
      const bHp = Math.max(0, Math.floor(blueFront.hp));
      const rHp = Math.max(0, Math.floor(redFront.hp));
      const bName = blueFront.index === 2 ? 'Base' : (blueFront.index === 1 ? 'Inner' : 'Outer');
      const rName = redFront.index === 5 ? 'Base' : (redFront.index === 4 ? 'Inner' : 'Outer');

      ctx.font = isMobile ? '10px monospace' : '12px monospace';
      ctx.textAlign = 'right'; ctx.fillStyle = '#7af';
      ctx.fillText(`T[${bName}]: ${bHp}`, cw / 2 - 25, isMobile ? 36 : 42);
      ctx.textAlign = 'left'; ctx.fillStyle = '#f87';
      ctx.fillText(`T[${rName}]: ${rHp}`, cw / 2 + 25, isMobile ? 36 : 42);
    }
  },

  getBotLane(_idx) {
    return 'mid';
  },

  homeTowerIndexes: { 0: [0, 1, 2], 1: [3, 4, 5] },

  // Strategická AI pro boty — ARAM: push linka, bráň svou věž
  botBrain: AramBrain,
};
