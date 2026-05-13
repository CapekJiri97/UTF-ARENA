import { game, camera } from './State.js';
import * as AramMap from './MapConfig_ARAM.js';
import { showEnd } from './UI.js';
import { AramBrain } from './BotBrain.js';
import { Minion } from './Entities.js';

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
    });
  },

  tickSpawn(dt, spawnTimer, _spawnInterval) {
    let newTimer = spawnTimer + dt;
    if (newTimer >= 15.0) {
      newTimer = 0;
      const spBlue = AramMap.aramMinionSpawns[0];
      const spRed  = AramMap.aramMinionSpawns[1];

      // Modří útočí na červené věže (index 3, 4, 5)
      let blueTargetIndex = 3;
      if (game.towers[3] && game.towers[3].dead) blueTargetIndex = 4;
      if (game.towers[4] && game.towers[4].dead) blueTargetIndex = 5;

      // Červení útočí na modré věže (index 0, 1, 2)
      let redTargetIndex = 0;
      if (game.towers[0] && game.towers[0].dead) redTargetIndex = 1;
      if (game.towers[1] && game.towers[1].dead) redTargetIndex = 2;

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
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('ARAM', cw / 2, 2);

    // Zobrazení zdraví Base věží v HUDu pro přehlednost
    if (game.towers[2] && game.towers[5]) {
        const blueHp = Math.max(0, Math.floor(game.towers[2].hp));
        const redHp = Math.max(0, Math.floor(game.towers[5].hp));
        ctx.font = isMobile ? 'bold 18px monospace' : 'bold 24px monospace';
        ctx.fillStyle = '#fff'; ctx.fillText(' : ', cw/2, isMobile ? 12 : 18);
        ctx.textAlign = 'right'; ctx.fillStyle = '#486FED'; ctx.fillText(blueHp, cw/2 - 15, isMobile ? 12 : 18);
        ctx.textAlign = 'left'; ctx.fillStyle = '#FF4E4E'; ctx.fillText(redHp, cw/2 + 15, isMobile ? 12 : 18);
    }
  },

  getBotLane(_idx) {
    return 'mid';
  },

  homeTowerIndexes: { 0: [0], 1: [1] },

  // Strategická AI pro boty — ARAM: push linka, bráň svou věž
  botBrain: AramBrain,
};
