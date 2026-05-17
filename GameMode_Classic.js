import { game, camera } from './State.js';
import * as ClassicMap from './MapConfig.js';
import { Minion } from './Entities.js';
import { gc } from './GameContext.js';
const showEnd = (...a) => gc.showEnd(...a);
import { DominionBrain } from './BotBrain.js';

// ── Classic / Dominion mode ───────────────────────────────────────────────────
// Věže se capture-ují, minionové se spawní podél kruhu věží,
// nexus protivníka se odčerpává podle převahy věží.
// Nexus týmu který dosáhne 0 prohraje.

export const GameMode_Classic = {
  name: 'classic',
  mapConfig: ClassicMap,

  // Voláno jednou při startu hry — inicializace stavu specifického pro mód
  init() {
    game.nexus = { 0: 500, 1: 500 };
    camera.scale = 1.52;
  },

  // Voláno každý tick hostitelem — spawn minionů
  tickSpawn(dt, spawnTimer, spawnInterval) {
    let newTimer = spawnTimer + dt;
    if (newTimer > spawnInterval) {
      newTimer = 0;
      const N = game.towers.length;
      for (let i = 0; i < N; i++) {
        const t = game.towers[i];
        if (t.owner < 0) continue;
        const next = game.towers[(i + 1) % N];
        const prev = game.towers[(i - 1 + N) % N];
        const sp = ClassicMap.MINION_SPAWN_POINTS[i] || t.pos;
        if (next.owner !== t.owner) {
          for (let k = 0; k < 2; k++) {
            const sx = sp.x + (Math.random() - 0.5) * 40;
            const sy = sp.y + (Math.random() - 0.5) * 40;
            game.minions.push(new Minion(sx, sy, t.owner, (i + 1) % N));
          }
          for (let k = 0; k < 2; k++) {
            const sx = sp.x + (Math.random() - 0.5) * 40;
            const sy = sp.y + (Math.random() - 0.5) * 40;
            game.minions.push(new Minion(sx, sy, t.owner, (i + 1) % N, { isRanged: true }));
          }
        }
        if (prev.owner !== t.owner) {
          for (let k = 0; k < 2; k++) {
            const sx = sp.x + (Math.random() - 0.5) * 40;
            const sy = sp.y + (Math.random() - 0.5) * 40;
            game.minions.push(new Minion(sx, sy, t.owner, (i - 1 + N) % N));
          }
          for (let k = 0; k < 2; k++) {
            const sx = sp.x + (Math.random() - 0.5) * 40;
            const sy = sp.y + (Math.random() - 0.5) * 40;
            game.minions.push(new Minion(sx, sy, t.owner, (i - 1 + N) % N, { isRanged: true }));
          }
        }
      }
    }
    return newTimer;
  },

  // Voláno každý tick hostitelem — odčerpávání nexusu + detekce výhry
  tickObjective(dt, nexusDrainRate, socket) {
    if (game.startDelay > 0) return;

    const owned0 = game.towers.filter(t => t.owner === 0).length;
    const owned1 = game.towers.filter(t => t.owner === 1).length;
    const diff = owned0 - owned1;
    if (diff > 0) game.nexus[1] -= nexusDrainRate * diff * dt;
    else if (diff < 0) game.nexus[0] -= nexusDrainRate * (-diff) * dt;
    game.nexus[0] = Math.max(0, game.nexus[0]);
    game.nexus[1] = Math.max(0, game.nexus[1]);

    if (game.nexus[0] <= 0 && !game.gameOver) this._triggerGameOver(1, socket);
    if (game.nexus[1] <= 0 && !game.gameOver) this._triggerGameOver(0, socket);
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
          totalGold: p.totalGold, towerCaptures: p.towerCaptures || 0,
          towerDefends: p.towerDefends || 0, towerAssaultTime: p.towerAssaultTime || 0,
          objectivePresenceTime: p.objectivePresenceTime || 0,
          powerupsCollected: p.powerupsCollected || 0, powerupUptime: p.powerupUptime || 0,
          pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null,
        })),
      });
    }
  },

  // Voláno z UI.js — kreslení HUD specifického pro mód
  drawHUD(ctx, cw, isMobile) {
    const tBlue = game.towers.filter(t => t.owner === 0).length;
    const tRed  = game.towers.filter(t => t.owner === 1).length;
    const cxTop = cw / 2;

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = isMobile ? 'bold 18px monospace' : 'bold 28px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(' : ', cxTop, 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#486FED';
    ctx.fillText(Math.floor(game.nexus[0]), cxTop - 15, 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF4E4E';
    ctx.fillText(Math.floor(game.nexus[1]), cxTop + 15, 20);

    ctx.font = isMobile ? 'bold 12px monospace' : 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(' X ', cxTop, isMobile ? 40 : 55);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#486FED';
    ctx.fillText(`(${tBlue})`, cxTop - 15, isMobile ? 40 : 55);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF4E4E';
    ctx.fillText(`(${tRed})`, cxTop + 15, isMobile ? 40 : 55);
  },

  // Vrátí lane pro bota podle jeho pořadového indexu (0-3 top, 4 bottom)
  getBotLane(idx) {
    if (idx <= 3) return 'top';
    if (idx === 4) return 'bottom';
    return Math.random() > 0.5 ? 'top' : 'bottom';
  },

  // Home tower indexy pro každý tým (používá se v bot AI)
  homeTowerIndexes: { 0: [0, 4], 1: [2, 3] },

  // Strategická AI pro boty — Dominion: věže, nexus, split-push
  botBrain: DominionBrain,
};
