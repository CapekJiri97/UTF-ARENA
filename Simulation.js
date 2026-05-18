/**
 * Simulation.js — Multi-mode headless batch simulator.
 *
 * Usage (from the browser console or SimUI):
 *
 *   import { SimulationEngine } from './Simulation.js';
 *   const engine = new SimulationEngine();
 *   const { aggregate, results } = await engine.start({
 *       numGames:    200,
 *       gameMode:    'arena',   // 'arena' | 'classic' | 'speed' | 'aram'
 *       budgetMs:    50,        // ms of sim work per setTimeout burst
 *       yieldMs:     8,         // ms yielded to browser between bursts
 *       difficulty:  2.0,       // bot stat multiplier (0.5 – 2.0)
 *       classFilter: null,      // null = random draft; ['Bruiser','Mage',...] = fixed pool
 *   }, {
 *       onProgress: ({ current, total, simTime, lastResult }) => { ... },
 *       onComplete:  (aggregate, results) => { ... },
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

/** Maximum simulated seconds before a game is force-ended as a draw. */
const MAX_SIM_SECONDS = 20 * 60; // 20 minutes

/** Fixed dt per tick — 20 fps is sufficient for bot AI (tacticTimer=0.2s, thinkTimer=0.4s). */
const SIM_DT = 1 / 20;

/** All available class names, derived at import time. */
export const ALL_CLASSES = Object.keys(CLASSES);

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
        this._origTrigger  = null;
        this._origSound    = null;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Starts the simulation batch.
     * @param {object} config
     * @param {number}   config.numGames        Number of games to simulate (1 – 10 000).
     * @param {number}   [config.ticksPerFrame]  Ticks per rAF frame (default 30 → ~30× speed).
     * @param {number}   [config.difficulty]     Bot difficulty multiplier (default 2.0).
     * @param {string[]|null} [config.classFilter] Fixed class pool or null for smart draft.
     * @param {object}   [callbacks]
     * @param {function} [callbacks.onProgress]  Called after each game.
     * @param {function} [callbacks.onComplete]  Called after all games with (aggregate, results).
     * @returns {Promise<{aggregate, results}>}
     */
    start(config, { onProgress, onComplete } = {}) {
        if (this.running) throw new Error('[Sim] Already running. Call stop() first.');

        this.config      = {
            numGames:      Math.max(1, Math.min(10000, config.numGames || 100)),
            ticksPerFrame: Math.max(1, Math.min(120,   config.ticksPerFrame || 30)),
            budgetMs:      Math.max(10, Math.min(200,  config.budgetMs  || 80)),
            difficulty:    Math.max(0.5, Math.min(2.0, config.difficulty   || 2.0)),
            classFilter:   Array.isArray(config.classFilter) ? config.classFilter : null,
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

    /** Aborts the currently running simulation. */
    stop() {
        if (!this.running) return;
        this.running = false;
        if (this._rafId !== null) {
            clearTimeout(this._rafId);
            this._rafId = null;
        }
        this._removePatches();
        setSimMode(false);
        if (this._reject) this._reject(new Error('[Sim] Stopped by user.'));
    }

    // ── Internals ──────────────────────────────────────────────────────────────

    /** Patches all supported game modes and Audio so the sim runs silently. */
    _installPatches() {
        // Patch _triggerGameOver on all supported modes to skip DOM showEnd()
        const simTrigger = function(winner) {
            game.gameOver = true;
            game.winner   = winner;
        };
        this._origTriggers = {};
        for (const [key, mode] of Object.entries({ arena: GameMode_Arena, classic: GameMode_Classic, speed: GameMode_Speed })) {
            this._origTriggers[key] = mode._triggerGameOver?.bind(mode);
            mode._triggerGameOver   = simTrigger;
        }

        this._origSound       = window._simSoundMuted;
        window._simSoundMuted = true;
        window._simCastHook   = null;
    }

    /** Restores all patched functions. */
    _removePatches() {
        const modes = { arena: GameMode_Arena, classic: GameMode_Classic, speed: GameMode_Speed };
        for (const [key, mode] of Object.entries(modes)) {
            if (this._origTriggers?.[key]) mode._triggerGameOver = this._origTriggers[key];
        }
        this._origTriggers    = null;
        window._simSoundMuted = this._origSound ?? false;
        window._simCastHook   = null;
    }

    /** Initialises one arena game, wires the tracker, schedules the sim loop. */
    _initNextGame() {
        if (!this.running) return;

        if (this.currentGame >= this.totalGames) {
            this._finish();
            return;
        }

        const gi = this.currentGame;

        // ── Set difficulty ────────────────────────────────────────────────────
        game.blueBotDifficulty = this.config.difficulty;
        game.redBotDifficulty  = this.config.difficulty;

        // ── Boot a spectator-only game (isSpectator=true → all bots, no human) ──
        const gameMode = this.config.gameMode || 'arena';
        setActiveMode(gameMode);
        startGame('Bruiser', 0, true); // isSpectator=true; no human player created

        // startGame() does NOT reset gameOver — must clear it manually between games
        game.gameOver = false;
        game.winner   = null;

        // Skip pre-game countdown so bots fight immediately
        game.startDelay = 0;

        // Reset the spawn timer (it persists across games as a module-level var)
        resetSpawnTimer();

        // ── Optionally restrict class pool ────────────────────────────────────
        if (this.config.classFilter && this.config.classFilter.length >= 2) {
            _reassignBotClasses(game.players, this.config.classFilter);
        }

        // ── Create tracker ────────────────────────────────────────────────────
        this._tracker = new GameTracker(gi);
        this._tracker.init(game.players);

        // Wire spell cast hook to the tracker
        window._simCastHook = (id, key) => this._tracker.onSpellCast(id, key);

        // ── Schedule first tick burst ─────────────────────────────────────────
        this._rafId = setTimeout(() => this._simLoop(gi), 0);
    }

    /**
     * Main simulation loop — runs ticks for `budgetMs` real milliseconds,
     * then yields `yieldMs` to the browser so it can handle events/render.
     * This prevents browser lag while maximising throughput.
     */
    _simLoop(gameIndex) {
        if (!this.running || this.currentGame !== gameIndex) return;

        const budgetMs = this.config.budgetMs ?? 50;
        const deadline = performance.now() + budgetMs;

        while (performance.now() < deadline) {
            simUpdate(SIM_DT);
            this._tracker.tick(game.players, SIM_DT);

            // ── Win condition already set by patched _triggerGameOver ─────────
            if (game.gameOver) {
                this._onGameEnd();
                return;
            }

            // ── Safety net: force-end runaway games ───────────────────────────
            if (this._tracker.simTime > MAX_SIM_SECONDS) {
                game.gameOver = true;
                game.winner   = -1; // draw / timeout
                this._onGameEnd();
                return;
            }
        }

        // ── Purge visual-only state to prevent memory bloat ───────────────────
        if (game.particles.length    > 50)  game.particles    = [];
        if (game.damageNumbers.length > 0)  game.damageNumbers = [];
        if (game.effectTexts.length   > 0)  game.effectTexts   = [];

        // ── Report progress ───────────────────────────────────────────────────
        this._onProgress({
            current:  this.currentGame,
            total:    this.totalGames,
            simTime:  this._tracker.simTime,
        });

        // Yield to browser — guaranteed breathing room between bursts
        const yieldMs = this.config.yieldMs ?? 8;
        this._rafId = setTimeout(() => this._simLoop(gameIndex), yieldMs);
    }

    /** Collects the finished game record and starts the next game. */
    _onGameEnd() {
        const record = this._tracker.finalize(game.winner, game.score, game.players);
        this.results.push(record);
        this.currentGame++;

        this._onProgress({
            current:    this.currentGame,
            total:      this.totalGames,
            simTime:    this._tracker.simTime,
            lastResult: record,
        });

        // Yield one event-loop tick so the browser stays responsive
        // (allows UI updates, prevents "page unresponsive" warnings)
        setTimeout(() => this._initNextGame(), 0);
    }

    /** Called after all games are done — compute aggregates and resolve. */
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
 * Reassigns bot classes from a fixed pool (round-robin, alternating teams).
 * Called after startGame() has already spawned bots so we don't touch the
 * BotPlayer constructor logic — we only overwrite className + re-apply CLASSES data.
 */
function _reassignBotClasses(players, pool) {
    const shuffled = _shuffle([...pool]);
    let pi = 0;
    for (const p of players) {
        const cls = shuffled[pi % shuffled.length];
        pi++;
        if (!CLASSES[cls]) continue;
        const cData = CLASSES[cls];
        p.className = cls;
        p.dmgType   = cData.dmgType;
        p.role      = cData.role || 'FIGHTER';
        // Re-init base stats from class definition
        p.maxHp     = cData.hp;
        p.hp        = cData.hp;
        p.baseMaxHp = cData.hp;
        p.AD        = cData.baseAD;   p.baseAD_stat   = cData.baseAD;
        p.AP        = cData.baseAP;   p.baseAP_stat   = cData.baseAP;
        p.armor     = cData.baseArmor; p.baseArmor_stat = cData.baseArmor;
        p.mr        = cData.baseMR;    p.baseMR_stat    = cData.baseMR;
        p.speed     = cData.speed;
        p.range     = cData.range;
        p.attackSpeed  = 1.0;
        p.attackDelay  = cData.attackDelay;
        p.spells = {
            Q: { ...cData.Q, cd: 0, level: 1 },
            E: { ...cData.E, cd: 0, level: 1 },
        };
    }
}

/** Fisher-Yates shuffle (returns new array). */
function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
