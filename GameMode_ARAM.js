import { game } from './State.js';
import * as AramMap from './MapConfig_ARAM.js';
import { Minion } from './Entities.js';
import { showEnd } from './UI.js';

const { MINION_SPAWN_POINTS, nexusTowerIndex } = AramMap;

// ── ARAM game mode ────────────────────────────────────────────────────────────
// Jedna linka, 6 věží (T0-T2 modré, T3-T5 červené).
// T2 = blue nexus věž, T3 = red nexus věž.
// Minionové se spawní u nejzazší vlastní věže a tlačí přímo dopředu.
// Vyhraješ zničením nepřátelské nexus věže (owner = tvůj tým).
// Boti: vždy tlačí dopředu, drží linku, pomáhají minionům.

export const GameMode_ARAM = {
  name: 'aram',
  mapConfig: AramMap,

  // Přímočará linka — minionové nepoužívají elipsu, jdou přímo k cíli
  minionPathMode: 'linear',

  init() {
    // Nexus HP se nepoužívá — win condition je dobytí nexus věže
    game.nexus = { 0: 1, 1: 1 }; // placeholder, neodčerpává se
  },

  // Spawn minionů: pouze nejzazší vlastní věž spawní vlnu směrem k nepříteli
  tickSpawn(dt, spawnTimer, spawnInterval) {
    let newTimer = spawnTimer + dt;
    if (newTimer > spawnInterval) {
      newTimer = 0;
      const N = game.towers.length; // 6

      // Blue tým spawní od nejzazší živé blue věže směrem doprava
      this._spawnWaveForTeam(0, N);
      // Red tým spawní od nejzazší živé red věže směrem doleva
      this._spawnWaveForTeam(1, N);
    }
    return newTimer;
  },

  _spawnWaveForTeam(team, N) {
    // Najdi nejzazší věž vlastněnou tímto týmem
    // Blue: věže 0,1,2 — nejzazší = nejnižší index který vlastní
    // Red:  věže 3,4,5 — nejzazší = nejvyšší index který vlastní
    let spawnTowerIdx = -1;
    if (team === 0) {
      for (let i = 0; i <= 2; i++) {
        if (game.towers[i] && game.towers[i].owner === 0) { spawnTowerIdx = i; break; }
      }
    } else {
      for (let i = N - 1; i >= 3; i--) {
        if (game.towers[i] && game.towers[i].owner === 1) { spawnTowerIdx = i; break; }
      }
    }
    if (spawnTowerIdx < 0) return; // tým nemá žádnou vlastní věž

    // Cíl minionů = první nepřátelská věž před nimi
    let targetIdx = -1;
    if (team === 0) {
      for (let i = spawnTowerIdx + 1; i < N; i++) {
        if (game.towers[i] && game.towers[i].owner !== 0) { targetIdx = i; break; }
      }
    } else {
      for (let i = spawnTowerIdx - 1; i >= 0; i--) {
        if (game.towers[i] && game.towers[i].owner !== 1) { targetIdx = i; break; }
      }
    }
    if (targetIdx < 0) return; // žádný nepřátelský cíl — zvítězili jsme

    const sp = MINION_SPAWN_POINTS[spawnTowerIdx] || game.towers[spawnTowerIdx].pos;
    // 3 melee + 3 ranged na vlnu (ARAM má silnější vlny)
    for (let k = 0; k < 3; k++) {
      const sx = sp.x + (Math.random() - 0.5) * 40;
      const sy = sp.y + (Math.random() - 0.5) * 60;
      game.minions.push(new Minion(sx, sy, team, targetIdx));
    }
    for (let k = 0; k < 3; k++) {
      const sx = sp.x + (Math.random() - 0.5) * 40;
      const sy = sp.y + (Math.random() - 0.5) * 60;
      game.minions.push(new Minion(sx, sy, team, targetIdx, { isRanged: true }));
    }
  },

  // Win condition: blue nexus věž (T2) dobytá červenými = red wins, a naopak
  tickObjective(dt, _nexusDrainRate, socket) {
    if (game.startDelay > 0 || game.gameOver) return;

    const blueNexusTower = game.towers[nexusTowerIndex[0]]; // T2
    const redNexusTower  = game.towers[nexusTowerIndex[1]]; // T3

    if (blueNexusTower && blueNexusTower.owner === 1) {
      this._triggerGameOver(1, socket);
    } else if (redNexusTower && redNexusTower.owner === 0) {
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
          totalGold: p.totalGold, towerCaptures: p.towerCaptures || 0,
          towerDefends: p.towerDefends || 0, towerAssaultTime: p.towerAssaultTime || 0,
          objectivePresenceTime: p.objectivePresenceTime || 0,
          powerupsCollected: p.powerupsCollected || 0, powerupUptime: p.powerupUptime || 0,
          pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null,
        })),
      });
    }
  },

  // HUD: zobrazení stavu nexus věží místo nexus HP
  drawHUD(ctx, cw, isMobile) {
    const blueNexus = game.towers[nexusTowerIndex[0]];
    const redNexus  = game.towers[nexusTowerIndex[1]];
    const cxTop = cw / 2;

    // Velký nápis ARAM
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = isMobile ? 'bold 10px monospace' : 'bold 14px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('ARAM', cxTop, isMobile ? 5 : 4);

    // Stav nexus věže jako health bar — control jde -100 až +100
    ctx.font = isMobile ? 'bold 16px monospace' : 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('NEXUS', cxTop, isMobile ? 18 : 22);

    const barW = isMobile ? 80 : 130;
    const barH = isMobile ? 10 : 14;
    const barY = isMobile ? 36 : 50;

    // Blue nexus health bar
    if (blueNexus) {
      const pct = Math.max(0, Math.min(1, (blueNexus.control + 100) / 200));
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(cxTop - barW - 8, barY, barW, barH);
      ctx.fillStyle = blueNexus.owner === 1 ? '#ff4444' : '#486FED';
      ctx.fillRect(cxTop - barW - 8, barY, barW * pct, barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(cxTop - barW - 8, barY, barW, barH);
    }

    // Red nexus health bar
    if (redNexus) {
      const pct = Math.max(0, Math.min(1, (redNexus.control + 100) / 200));
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(cxTop + 8, barY, barW, barH);
      ctx.fillStyle = redNexus.owner === 0 ? '#486FED' : '#FF4E4E';
      ctx.fillRect(cxTop + 8, barY, barW * pct, barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(cxTop + 8, barY, barW, barH);
    }
  },

  // Všichni boti v ARAM jdou "mid" — není top/bottom
  getBotLane(_idx) {
    return 'mid';
  },

  // Home tower indexy: blue chrání T2, red chrání T3
  homeTowerIndexes: { 0: [0, 1, 2], 1: [3, 4, 5] },
};
