import { game, camera } from './State.js';
import * as AramMap from './MapConfig_ARAM.js';
import { showEnd } from './UI.js';
import { AramBrain } from './BotBrain.js';

// ── ARAM game mode — čistá aréna 5v5 ─────────────────────────────────────────
// Žádné věže, žádní minioni. Čistý teamfight 5v5.
// Win condition: zatím bez — prostor pro vlastní logiku.

export const GameMode_ARAM = {
  name: 'aram',
  mapConfig: AramMap,

  minionPathMode: 'linear',

  init() {
    game.nexus = { 0: 1, 1: 1 };

    // Kamera — ARAM mapa je 3200×2000
    camera.scale = 0.7;
  },

  // Žádné miniony — nic se nespaví
  tickSpawn(_dt, spawnTimer, _spawnInterval) {
    return spawnTimer;
  },

  // Win condition: tým bez živých hráčů prohrává
  tickObjective(_dt, _nexusDrainRate, socket) {
    if (game.startDelay > 0 || game.gameOver) return;

    const blueAlive = game.players.some(p => p.team === 0 && p.alive);
    const redAlive  = game.players.some(p => p.team === 1 && p.alive);

    if (!blueAlive && game.players.some(p => p.team === 0)) {
      this._triggerGameOver(1, socket);
    } else if (!redAlive && game.players.some(p => p.team === 1)) {
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

  drawHUD(ctx, cw, _isMobile) {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('ARAM', cw / 2, 2);
  },

  getBotLane(_idx) {
    return 'mid';
  },

  homeTowerIndexes: { 0: [0], 1: [1] },

  // Strategická AI pro boty — ARAM: push linka, bráň svou věž
  botBrain: AramBrain,
};
