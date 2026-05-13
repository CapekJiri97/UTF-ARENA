import { game, camera } from './State.js';
import * as ArenaMap from './MapConfig_Arena.js';
import { showEnd } from './UI.js';
import { speakNexusWarning } from './Audio.js';
import { ArenaBrain } from './BotBrain.js';
import { Minion } from './Entities.js';

// ── Arena game mode ───────────────────────────────────────────────────────────
// 4v4, elipsová mapa, jedna neutrální věž uprostřed.
// Skóre: držení věže = +5 bodů / 10 s, kill = +1 bod.
// První tým na 150 bodů vyhrává.
// Žádní minioni, žádné healy, žádné powerupy.

const SCORE_CAP        = 150;   // body pro výhru
const HOLD_POINTS      = 5;     // body za 10 sekund držení věže
const HOLD_INTERVAL    = 10.0;  // sekund mezi bodováním za držení
const KILL_POINTS      = 1;     // bod za kill

// TTS varovné prahy — analogie k nexus HP, ale pro body
const WARN_NEAR   = 120;  // "120 points!"
const WARN_CLOSE  = 140;  // "140 points!"

const _ttsSpoken = { 0: {}, 1: {} };

function speakScore(team, score) {
  if (typeof speechSynthesis === 'undefined') return;
  const key = score >= WARN_CLOSE ? 'close' : score >= WARN_NEAR ? 'near' : null;
  if (!key || _ttsSpoken[team][key]) return;
  _ttsSpoken[team][key] = true;
  const teamName = team === 0 ? 'Blue' : 'Red';
  const pts = score >= WARN_CLOSE ? WARN_CLOSE : WARN_NEAR;
  const msg = new SpeechSynthesisUtterance(`${teamName} team at ${pts} points!`);
  msg.lang = 'en-US'; msg.volume = 1.0; msg.rate = 1.1;
  msg.pitch = team === 0 ? 1.2 : 0.85;
  speechSynthesis.speak(msg);
}

export const GameMode_Arena = {
  name: 'arena',
  mapConfig: ArenaMap,

  minionPathMode: 'linear',

  // game.score nahrazuje game.nexus jako hlavní stav skóre
  init() {
    game.score  = { 0: 0, 1: 0 };
    game.nexus  = { 0: SCORE_CAP, 1: SCORE_CAP }; // proxy pro HUD kompatibilitu — zobrazíme skóre
    _ttsSpoken[0] = {}; _ttsSpoken[1] = {};
    this._holdTimer = 0;

    camera.scale = 1.52;

    // Věž začíná neutrální
    setTimeout(() => {
      for (const t of game.towers) {
        t.owner = -1; t.control = 0;
      }
    }, 0);
  },

  tickSpawn(_dt, spawnTimer, _interval) {
    let newTimer = spawnTimer + _dt;
    if (newTimer >= 15.0) {
      newTimer = 0;
      
      const spBlue = ArenaMap.arenaMinionSpawns[0];
      if (spBlue) {
        spBlue.forEach(sp => {
          for (let k = 0; k < 2; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 0, 0));
          for (let k = 0; k < 1; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 0, 0, { isRanged: true }));
        });
      }

      const spRed = ArenaMap.arenaMinionSpawns[1];
      if (spRed) {
        spRed.forEach(sp => {
          for (let k = 0; k < 2; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 1, 0));
          for (let k = 0; k < 1; k++) game.minions.push(new Minion(sp.x + (Math.random() - 0.5) * 40, sp.y + (Math.random() - 0.5) * 40, 1, 0, { isRanged: true }));
        });
      }

      const centerTower = game.towers[0];
      if (centerTower && centerTower.owner >= 0) {
        const owner = centerTower.owner;
        for (let k = 0; k < 2; k++) game.minions.push(new Minion(centerTower.pos.x + (Math.random() - 0.5) * 40, centerTower.pos.y + (Math.random() - 0.5) * 40, owner, 0));
        for (let k = 0; k < 2; k++) game.minions.push(new Minion(centerTower.pos.x + (Math.random() - 0.5) * 40, centerTower.pos.y + (Math.random() - 0.5) * 40, owner, 0, { isRanged: true }));
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

    // TTS varování
    speakScore(0, game.score[0] || 0);
    speakScore(1, game.score[1] || 0);

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
