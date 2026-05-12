import { game, camera } from './State.js';
import * as AramMap from './MapConfig_ARAM.js';
import { Minion } from './Entities.js';
import { showEnd } from './UI.js';

const { MINION_SPAWN_POINTS, nexusTowerIndex } = AramMap;

// ── ARAM game mode ────────────────────────────────────────────────────────────
// Jedna linka, 2 věže (T0 blue, T1 red) s HP — žádná capture logika.
// Minionové spawní za věží svého týmu a tlačí přímo dopředu.
// Vyhraješ zničením nepřátelské věže.
// Boti: vždy tlačí dopředu mid linkou.

export const GameMode_ARAM = {
  name: 'aram',
  mapConfig: AramMap,

  // Přímočará linka — minionové nepoužívají elipsu, jdou přímo k cíli
  minionPathMode: 'linear',

  init() {
    game.nexus = { 0: 1, 1: 1 }; // placeholder, neodčerpává se

    // Kamera — ARAM mapa je 3200×1000
    camera.scale = 1.0;

    // Přiřaď věže týmům hned na začátku (T0 blue, T1 red)
    setTimeout(() => {
      for (const t of game.towers) {
        if (t.index === 0) { t.owner = 0; t.control = 100; }
        else               { t.owner = 1; t.control = -100; }
      }
    }, 0);
  },

  // Spawn minionů: každý tým spawní za svou věží směrem k nepříteli
  tickSpawn(dt, spawnTimer, spawnInterval) {
    let newTimer = spawnTimer + dt;
    if (newTimer > spawnInterval) {
      newTimer = 0;
      // Blue tým: spawní za T0 (index 0), cíl T1 (index 1)
      if (!game.towers[0] || !game.towers[0].dead) {
        this._spawnWave(0, 0, 1);
      }
      // Red tým: spawní za T1 (index 1), cíl T0 (index 0)
      if (!game.towers[1] || !game.towers[1].dead) {
        this._spawnWave(1, 1, 0);
      }
    }
    return newTimer;
  },

  _spawnWave(team, spawnTowerIdx, targetTowerIdx) {
    const sp = MINION_SPAWN_POINTS[team];
    if (!sp) return;
    // 3 melee + 3 ranged na vlnu
    for (let k = 0; k < 3; k++) {
      const sx = sp.x + (Math.random() - 0.5) * 40;
      const sy = sp.y + (Math.random() - 0.5) * 60;
      game.minions.push(new Minion(sx, sy, team, targetTowerIdx));
    }
    for (let k = 0; k < 3; k++) {
      const sx = sp.x + (Math.random() - 0.5) * 40;
      const sy = sp.y + (Math.random() - 0.5) * 60;
      game.minions.push(new Minion(sx, sy, team, targetTowerIdx, { isRanged: true }));
    }
  },

  // Win condition: zničení nepřátelské věže
  tickObjective(dt, _nexusDrainRate, socket) {
    if (game.startDelay > 0 || game.gameOver) return;

    const blueNexusTower = game.towers[nexusTowerIndex[0]]; // T0
    const redNexusTower  = game.towers[nexusTowerIndex[1]]; // T1

    if (blueNexusTower && blueNexusTower.dead) {
      this._triggerGameOver(1, socket);
    } else if (redNexusTower && redNexusTower.dead) {
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

  drawHUD(ctx, cw, isMobile) {
    const blueNexus = game.towers[nexusTowerIndex[0]];
    const redNexus  = game.towers[nexusTowerIndex[1]];
    const cxTop = cw / 2;

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = isMobile ? 'bold 10px monospace' : 'bold 13px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText('ARAM', cxTop, 2);

    const barW = isMobile ? 90 : 140;
    const barH = isMobile ? 12 : 16;
    const barY = isMobile ? 15 : 20;

    const drawNexusBar = (tower, bx, label) => {
      if (!tower) return;
      const pct = tower.dead ? 0 : Math.max(0, tower.hp / tower.maxHp);
      const hpColor = pct > 0.5 ? '#0f0' : pct > 0.25 ? '#ff0' : '#f00';
      ctx.fillStyle = '#111'; ctx.fillRect(bx, barY, barW, barH);
      ctx.fillStyle = hpColor; ctx.fillRect(bx, barY, barW * pct, barH);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, barY, barW, barH);
      ctx.font = isMobile ? 'bold 9px monospace' : 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      const hpText = tower.dead ? 'DESTROYED' : Math.ceil(tower.hp) + ' / ' + tower.maxHp;
      ctx.fillText(label + ' ' + hpText, bx + barW / 2, barY + barH + 2);
    };

    drawNexusBar(blueNexus, cxTop - barW - 10, '🔵');
    drawNexusBar(redNexus,  cxTop + 10,        '🔴');
  },

  // Všichni boti v ARAM jdou "mid" — není top/bottom
  getBotLane(_idx) {
    return 'mid';
  },

  // Home tower indexy: blue chrání T0, red chrání T1
  homeTowerIndexes: { 0: [0], 1: [1] },
};
