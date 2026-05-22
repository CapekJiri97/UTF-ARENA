/**
 * Simulation.js — Multi-mode headless batch simulator.
 *
 * Usage (from SimUI or browser console):
 *
 *   import { SimulationEngine } from './Simulation.js';
 *   const engine = new SimulationEngine();
 *   const { aggregate, results } = await engine.start({
 *       numGames:    200,
 *       gameMode:    'random',  // 'arena' | 'classic' | 'speed' | 'aram' | 'random'
 *       budgetMs:    50,
 *       yieldMs:     8,
 *       difficulty:  2.0,
 *       classFilter: null,      // null = smart draft; 'random' = random pool; string[] = fixed
 *       draftMode:   'clever',  // 'clever' | 'random' | 'mixed' (one team random, one clever)
 *   });
 */

import { game }                                   from './State.js';
import { GameMode_Arena }                         from './GameMode_Arena.js';
import { GameMode_Classic }                       from './GameMode_Classic.js';
import { GameMode_Speed }                         from './GameMode_Speed.js';
import { CLASSES }                                from './classes.js';
import {
    simMode, setSimMode,
    simUpdate, resetSpawnTimer,
    setActiveMode, startGame,
} from './main.js';
import {
    GameTracker,
    computeAggregateStats,
} from './SimStats.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIM_SECONDS = 20 * 60;
const SIM_DT          = 1 / 20;

export const ALL_CLASSES   = Object.keys(CLASSES);
export const ALL_GAMEMODES = ['arena', 'classic', 'speed', 'aram'];

// ─── SimulationEngine ─────────────────────────────────────────────────────────
export class SimulationEngine {
    constructor() {
        this.running       = false;
        this.currentGame   = 0;
        this.totalGames    = 0;
        this.results       = [];
        this.config        = null;
        this._tracker      = null;
        this._rafId        = null;
        this._resolve      = null;
        this._reject       = null;
        this._onProgress   = null;
        this._onComplete   = null;
        this._origTriggers = null;
        this._origSound    = null;
        this._currentGameMode = null;
    }

    start(config, { onProgress, onComplete } = {}) {
        if (this.running) throw new Error('[Sim] Already running. Call stop() first.');

        this.config = {
            numGames:      Math.max(1, Math.min(10000, config.numGames || 100)),
            ticksPerFrame: Math.max(1, Math.min(120,   config.ticksPerFrame || 30)),
            budgetMs:      Math.max(10, Math.min(200,  config.budgetMs  || 80)),
            yieldMs:       Math.max(0, Math.min(50,    config.yieldMs   || 8)),
            difficulty:    Math.max(0.5, Math.min(2.0, config.difficulty || 2.0)),
            classFilter:   Array.isArray(config.classFilter) ? config.classFilter : null,
            // 'arena'|'classic'|'speed'|'aram'|'random'
            gameMode:      config.gameMode || 'arena',
            // 'clever'|'random'|'mixed'
            draftMode:     config.draftMode || 'clever',
        };
        this.totalGames  = this.config.numGames;
        this.currentGame = 0;
        this.results     = [];
        this.running     = true;

        this._onProgress = onProgress || (() => {});
        this._onComplete = onComplete || (() => {});

        this._installPatches();
        setSimMode(true);

        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject  = reject;
            this._initNextGame();
        });
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        if (this._rafId !== null) { clearTimeout(this._rafId); this._rafId = null; }
        this._removePatches();
        setSimMode(false);
        if (this._reject) this._reject(new Error('[Sim] Stopped by user.'));
    }

    _installPatches() {
        const simTrigger = function(winner) { game.gameOver = true; game.winner = winner; };
        this._origTriggers = {};
        for (const [key, mode] of Object.entries({ arena: GameMode_Arena, classic: GameMode_Classic, speed: GameMode_Speed })) {
            this._origTriggers[key] = mode._triggerGameOver?.bind(mode);
            mode._triggerGameOver   = simTrigger;
        }
        this._origSound       = window._simSoundMuted;
        window._simSoundMuted = true;
        window._simCastHook   = null;
    }

    _removePatches() {
        const modes = { arena: GameMode_Arena, classic: GameMode_Classic, speed: GameMode_Speed };
        for (const [key, mode] of Object.entries(modes)) {
            if (this._origTriggers?.[key]) mode._triggerGameOver = this._origTriggers[key];
        }
        this._origTriggers    = null;
        window._simSoundMuted = this._origSound ?? false;
        window._simCastHook   = null;
    }

    _pickGameMode() {
        if (this.config.gameMode === 'random') {
            return ALL_GAMEMODES[Math.floor(Math.random() * ALL_GAMEMODES.length)];
        }
        return this.config.gameMode;
    }

    _initNextGame() {
        if (!this.running) return;
        if (this.currentGame >= this.totalGames) { this._finish(); return; }

        const gi = this.currentGame;

        game.blueBotDifficulty = this.config.difficulty;
        game.redBotDifficulty  = this.config.difficulty;

        // Pick game mode (may be random per-game)
        const gameMode = this._pickGameMode();
        this._currentGameMode = gameMode;
        setActiveMode(gameMode);
        startGame('Bruiser', 0, true);

        game.gameOver  = false;
        game.winner    = null;
        game.startDelay = 0;
        resetSpawnTimer();

        // Apply draft mode overrides
        _applyDraftMode(game.players, this.config.draftMode);

        // Apply class filter if fixed pool
        if (this.config.classFilter && this.config.classFilter.length >= 2) {
            _reassignBotClasses(game.players, this.config.classFilter);
        }

        this._tracker = new GameTracker(gi, gameMode);
        this._tracker.init(game.players);

        window._simCastHook = (id, key) => this._tracker.onSpellCast(id, key);

        this._rafId = setTimeout(() => this._simLoop(gi), 0);
    }

    _simLoop(gameIndex) {
        if (!this.running || this.currentGame !== gameIndex) return;

        const budgetMs = this.config.budgetMs ?? 50;
        const deadline = performance.now() + budgetMs;

        while (performance.now() < deadline) {
            simUpdate(SIM_DT);
            this._tracker.tick(game.players, SIM_DT, game.macroState ?? null);

            if (game.gameOver) { this._onGameEnd(); return; }
            if (this._tracker.simTime > MAX_SIM_SECONDS) {
                game.gameOver = true; game.winner = -1;
                this._onGameEnd(); return;
            }
        }

        if (game.particles.length    > 50)  game.particles    = [];
        if (game.damageNumbers.length > 0)  game.damageNumbers = [];
        if (game.effectTexts.length   > 0)  game.effectTexts   = [];

        this._onProgress({ current: this.currentGame, total: this.totalGames, simTime: this._tracker.simTime });

        const yieldMs = this.config.yieldMs ?? 8;
        this._rafId = setTimeout(() => this._simLoop(gameIndex), yieldMs);
    }

    _onGameEnd() {
        const record = this._tracker.finalize(game.winner, game.score, game.players);
        this.results.push(record);
        this.currentGame++;

        this._onProgress({ current: this.currentGame, total: this.totalGames, simTime: this._tracker.simTime, lastResult: record });
        setTimeout(() => this._initNextGame(), 0);
    }

    _finish() {
        this._removePatches();
        setSimMode(false);
        this.running = false;

        const aggregate = computeAggregateStats(this.results);
        this._onComplete(aggregate, this.results);
        if (this._resolve) this._resolve({ aggregate, results: this.results });
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Applies draft mode to bots.
 * 'clever'  — both teams use smart draft (default, no override needed)
 * 'random'  — all bots get random classes from full pool
 * 'mixed'   — team 0 clever, team 1 random (or vice versa, alternates per game)
 */
function _applyDraftMode(players, draftMode) {
    if (draftMode === 'clever') return; // default startGame() already uses smart draft

    if (draftMode === 'random') {
        _reassignBotClasses(players, ALL_CLASSES);
    } else if (draftMode === 'mixed') {
        // Team 0 = smart (leave as-is), Team 1 = random
        const team1 = players.filter(p => p.team === 1);
        _reassignBotClasses(team1, ALL_CLASSES);
    }
}

function _reassignBotClasses(players, pool) {
    const shuffled = _shuffle([...pool]);
    let pi = 0;
    for (const p of players) {
        const cls = shuffled[pi % shuffled.length];
        pi++;
        if (!CLASSES[cls]) continue;
        const cData = CLASSES[cls];
        p.className  = cls;
        p.dmgType    = cData.dmgType;
        p.role       = cData.role || 'FIGHTER';
        p.maxHp      = cData.hp;      p.hp           = cData.hp;    p.baseMaxHp = cData.hp;
        p.AD         = cData.baseAD;  p.baseAD_stat  = cData.baseAD;
        p.AP         = cData.baseAP;  p.baseAP_stat  = cData.baseAP;
        p.armor      = cData.baseArmor; p.baseArmor_stat = cData.baseArmor;
        p.mr         = cData.baseMR;    p.baseMR_stat    = cData.baseMR;
        p.speed      = cData.speed;
        p.range      = cData.range;
        p.attackSpeed  = 1.0;
        p.attackDelay  = cData.attackDelay;
        p.spells = { Q: { ...cData.Q, cd: 0, level: 1 }, E: { ...cData.E, cd: 0, level: 1 } };
    }
}

function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
