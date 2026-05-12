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
    game.nexus = { 0: 1, 1: 1 }; // placeholder, neodčerpává se

    // Věže se přidělí týmům hned na začátku (T0-T2 modré, T3-T5 červené)
    // Musíme počkat jeden tick až jsou towers inicializovány — použijeme setTimeout
    setTimeout(() => {
      for (const t of game.towers) {
        if (t.index <= 2) { t.owner = 0; t.control = 100; }
        else              { t.owner = 1; t.control = -100; }
      }
    }, 0);
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

    // Výhra = nexus věž protivníka je zničena (hp == 0)
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

  // Home tower indexy: blue chrání T2, red chrání T3
  homeTowerIndexes: { 0: [0, 1, 2], 1: [3, 4, 5] },
};
