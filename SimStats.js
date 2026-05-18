/**
 * SimStats.js — Per-game and aggregate statistics engine for the simulation module.
 *
 * Architecture:
 *   PlayerTracker  — tracks one bot across one game (burst windows, DPS, casts, …)
 *   GameTracker    — owns all PlayerTrackers for one game, produces a GameRecord on finalize()
 *   computeAggregateStats(records[]) — crunches all GameRecords into class/item reports
 *   exportCSV / exportJSON            — serialisation helpers
 */

// ─── Numeric keys that are averaged / min-max-medianed per class ──────────────
const NUMERIC_KEYS = [
    'kills', 'deaths', 'assists', 'kda',
    'dmgDealtTotal', 'dmgDealtToHeroes', 'dmgTaken', 'hpHealed',
    'dpsToHeroes', 'hpsHealed',
    'maxBurst1s', 'maxBurst3s',
    'spellCastsQ', 'spellCastsE',
    'level', 'gold', 'totalGold', 'goldPerMin',
    'timeAlive', 'timeDead', 'survivalRate',
    'killsPerMin', 'dmgEfficiency',
];

// ─── PlayerTracker ─────────────────────────────────────────────────────────────
class PlayerTracker {
    constructor(player) {
        this.id             = player.id;
        this.className      = player.className;
        this.team           = player.team;
        this.dmgType        = player.dmgType      || 'physical';
        this.role           = player.role         || 'FIGHTER';
        this.buildArchetype = player.buildArchetype || 'unknown';

        // Rolling burst window — stores {time, amount} for damage dealt to heroes
        this._dmgEvents  = [];
        this.maxBurst1s  = 0;
        this.maxBurst3s  = 0;

        // Cumulative baseline (last-tick values to compute deltas)
        this._prevDmgHeroes = 0;
        this._prevKills     = 0;

        // Spell casts (incremented via window._simCastHook)
        this.spellCasts  = { Q: 0, E: 0 };

        // Time bookkeeping
        this.timeAlive   = 0;
        this.timeDead    = 0;

        // Kill timestamps (simTime at each kill)
        this._killTimes  = [];
    }

    /** Called by GameTracker when this player casts a spell. */
    onSpellCast(key) {
        if (key === 'Q') this.spellCasts.Q++;
        else if (key === 'E') this.spellCasts.E++;
    }

    /** Called every simulation tick. */
    tick(simTime, dt, player) {
        // ── Time alive / dead ────────────────────────────────────────────────
        if (player.alive) this.timeAlive += dt;
        else              this.timeDead  += dt;

        // ── Burst damage tracking ────────────────────────────────────────────
        const curDmg   = player.stats?.dmgDealtToHeroes || 0;
        const dmgDelta = curDmg - this._prevDmgHeroes;
        this._prevDmgHeroes = curDmg;
        if (dmgDelta > 0) this._dmgEvents.push({ time: simTime, amount: dmgDelta });

        // Prune events older than 3 s
        const cutoff3 = simTime - 3.0;
        while (this._dmgEvents.length > 0 && this._dmgEvents[0].time < cutoff3) {
            this._dmgEvents.shift();
        }

        // Sum 1 s and 3 s windows
        let sum1 = 0, sum3 = 0;
        const cutoff1 = simTime - 1.0;
        for (const e of this._dmgEvents) {
            sum3 += e.amount;
            if (e.time >= cutoff1) sum1 += e.amount;
        }
        if (sum1 > this.maxBurst1s) this.maxBurst1s = sum1;
        if (sum3 > this.maxBurst3s) this.maxBurst3s = sum3;

        // ── Kill event timestamps ────────────────────────────────────────────
        if (player.kills > this._prevKills) {
            this._killTimes.push(simTime);
            this._prevKills = player.kills;
        }
    }

    /** Produce the final PlayerResult object at game end. */
    finalize(simTime, player) {
        const s          = player.stats || {};
        const totalDmg   = s.dmgDealtToHeroes || 0;
        const totalHeal  = s.hpHealed         || 0;
        const aliveTime  = Math.max(this.timeAlive, 1);
        const gameDurMin = Math.max(simTime / 60, 0.01);

        const kda = player.deaths === 0
            ? (player.kills + player.assists)
            : (player.kills + player.assists) / player.deaths;

        return {
            id:             this.id,
            className:      this.className,
            team:           this.team,
            role:           this.role,
            dmgType:        this.dmgType,
            buildArchetype: this.buildArchetype,

            kills:       player.kills,
            deaths:      player.deaths,
            assists:     player.assists,
            kda:         _r2(kda),

            dmgDealtTotal:    Math.round(s.dmgDealt   || 0),
            dmgDealtToHeroes: Math.round(totalDmg),
            dmgTaken:         Math.round(s.dmgTaken   || 0),
            hpHealed:         Math.round(totalHeal),

            dpsToHeroes: _r1(totalDmg  / aliveTime),
            hpsHealed:   _r1(totalHeal / aliveTime),

            maxBurst1s:  Math.round(this.maxBurst1s),
            maxBurst3s:  Math.round(this.maxBurst3s),

            spellCastsQ: this.spellCasts.Q,
            spellCastsE: this.spellCasts.E,

            level:       player.level,
            gold:        Math.round(player.gold),
            totalGold:   Math.round(player.totalGold || player.gold),
            goldPerMin:  Math.round((player.totalGold || player.gold) / gameDurMin),

            items:       [...(player.items || [])],

            timeAlive:     Math.round(this.timeAlive),
            timeDead:      Math.round(this.timeDead),
            survivalRate:  _r3(this.timeAlive / Math.max(simTime, 1)),

            killsPerMin:   _r1(player.kills / gameDurMin),
            dmgEfficiency: s.dmgTaken > 0 ? _r2(totalDmg / s.dmgTaken) : totalDmg,
        };
    }
}

// ─── GameTracker ───────────────────────────────────────────────────────────────
export class GameTracker {
    constructor(gameIndex) {
        this.gameIndex  = gameIndex;
        this.simTime    = 0;
        this._trackers  = new Map(); // id → PlayerTracker
    }

    /** Call once after startGame() to register all players. */
    init(players) {
        this._trackers.clear();
        this.simTime = 0;
        for (const p of players) {
            this._trackers.set(p.id, new PlayerTracker(p));
        }
    }

    /** Call from within the sim loop for every tick. */
    tick(players, dt) {
        this.simTime += dt;
        for (const p of players) {
            this._trackers.get(p.id)?.tick(this.simTime, dt, p);
        }
    }

    /** Called by Simulation engine when a spell is cast. */
    onSpellCast(playerId, key) {
        this._trackers.get(playerId)?.onSpellCast(key);
    }

    /** Produce the complete GameRecord. */
    finalize(winner, score, players) {
        const playerResults = players.map(p =>
            this._trackers.get(p.id)?.finalize(this.simTime, p) ?? null
        ).filter(Boolean);

        return {
            gameIndex: this.gameIndex,
            winner,
            score:    { 0: score?.[0] ?? 0, 1: score?.[1] ?? 0 },
            duration: Math.round(this.simTime),
            players:  playerResults,
        };
    }
}

// ─── Aggregate computation ─────────────────────────────────────────────────────
/**
 * Crunches an array of GameRecords into a structured report:
 *   - classStats[className]: { gamesPlayed, wins, losses, winRate, stats{key:{avg,min,max,median,p25,p75}} }
 *   - itemStats[itemId]:     { appearances, wins, winRate }
 *   - teamWinRate, avgGameDuration, totalGames
 */
export function computeAggregateStats(gameRecords) {
    const byClass = {}; // className → { entries: PlayerResult[], wins: 0, losses: 0 }
    const byItem  = {}; // itemId   → { appearances: 0, wins: 0 }
    // className → archetype → { wins, losses }
    const byClassArchetype = {};

    let team0Wins = 0, team1Wins = 0, draws = 0;

    for (const rec of gameRecords) {
        if (rec.winner === 0) team0Wins++;
        else if (rec.winner === 1) team1Wins++;
        else draws++;

        for (const p of rec.players) {
            // ── Per class ──────────────────────────────────────────────────
            if (!byClass[p.className]) {
                byClass[p.className] = { entries: [], wins: 0, losses: 0 };
            }
            const won = (p.team === rec.winner);
            byClass[p.className].entries.push(p);
            if (won) byClass[p.className].wins++;
            else     byClass[p.className].losses++;

            // ── Per class × archetype ──────────────────────────────────────
            const arch = p.buildArchetype || 'unknown';
            if (!byClassArchetype[p.className]) byClassArchetype[p.className] = {};
            if (!byClassArchetype[p.className][arch]) byClassArchetype[p.className][arch] = { wins: 0, losses: 0 };
            if (won) byClassArchetype[p.className][arch].wins++;
            else     byClassArchetype[p.className][arch].losses++;

            // ── Per item ───────────────────────────────────────────────────
            for (const itemId of new Set(p.items)) {
                if (!byItem[itemId]) byItem[itemId] = { appearances: 0, wins: 0 };
                byItem[itemId].appearances++;
                if (won) byItem[itemId].wins++;
            }
        }
    }

    // ── Class stats ────────────────────────────────────────────────────────────
    const classStats = {};
    for (const [cls, data] of Object.entries(byClass)) {
        const n = data.entries.length;
        const stats = {};
        for (const key of NUMERIC_KEYS) {
            const vals = data.entries
                .map(e => typeof e[key] === 'number' ? e[key] : 0)
                .sort((a, b) => a - b);
            const sum  = vals.reduce((s, v) => s + v, 0);
            stats[key] = {
                avg:    _r2(sum / n),
                min:    vals[0],
                max:    vals[n - 1],
                median: vals[Math.floor(n / 2)],
                p25:    vals[Math.floor(n * 0.25)],
                p75:    vals[Math.floor(n * 0.75)],
            };
        }
        // Per-archetype winrate pro tuto třídu
        const archData = byClassArchetype[cls] || {};
        const buildStats = {};
        let bestBuild = null, bestBuildWr = -1;
        for (const [archName, ad] of Object.entries(archData)) {
            const total = ad.wins + ad.losses;
            const wr = _r1(ad.wins / total * 100);
            buildStats[archName] = { wins: ad.wins, losses: ad.losses, gamesPlayed: total, winRate: wr };
            if (wr > bestBuildWr) { bestBuildWr = wr; bestBuild = archName; }
        }

        classStats[cls] = {
            gamesPlayed: n,
            wins:        data.wins,
            losses:      data.losses,
            winRate:     _r1(data.wins / n * 100),
            stats,
            buildStats,
            bestBuild,
            bestBuildWinRate: bestBuildWr >= 0 ? bestBuildWr : null,
        };
    }

    // ── Item stats ─────────────────────────────────────────────────────────────
    const itemStats = {};
    for (const [id, data] of Object.entries(byItem)) {
        itemStats[id] = {
            appearances: data.appearances,
            wins:        data.wins,
            winRate:     _r1(data.wins / data.appearances * 100),
        };
    }

    // ── Game-level aggregates ──────────────────────────────────────────────────
    const durations = gameRecords.map(r => r.duration);
    const totalGames = gameRecords.length || 1;

    return {
        totalGames:      gameRecords.length,
        avgGameDuration: Math.round(durations.reduce((s, v) => s + v, 0) / totalGames),
        minGameDuration: Math.min(...durations),
        maxGameDuration: Math.max(...durations),
        team0WinRate:    _r1(team0Wins / totalGames * 100),
        team1WinRate:    _r1(team1Wins / totalGames * 100),
        draws,
        classStats,
        itemStats,
    };
}

// ─── Export helpers ────────────────────────────────────────────────────────────

/**
 * Exports the full flat player-per-game CSV.
 * Each row = one player in one game.
 */
export function exportPlayerCSV(gameRecords) {
    const cols = [
        'gameIndex', 'winner', 'gameDuration', 'score0', 'score1',
        'id', 'className', 'team', 'role', 'dmgType', 'buildArchetype',
        ...NUMERIC_KEYS,
        'items',
    ];

    const rows = [cols.join(',')];
    for (const rec of gameRecords) {
        for (const p of rec.players) {
            const row = cols.map(c => {
                if (c === 'gameIndex')    return rec.gameIndex;
                if (c === 'winner')       return rec.winner;
                if (c === 'gameDuration') return rec.duration;
                if (c === 'score0')       return rec.score[0];
                if (c === 'score1')       return rec.score[1];
                if (c === 'items')        return `"${(p.items || []).join(';')}"`;
                const v = p[c];
                return v === undefined ? '' : v;
            });
            rows.push(row.join(','));
        }
    }
    return rows.join('\n');
}

/**
 * Exports the per-class aggregate summary CSV.
 * Each row = one class × one stat, or use wide format.
 * Here we use wide format: one row per class, one column per stat.avg.
 */
export function exportClassCSV(aggregate) {
    const statCols = NUMERIC_KEYS.map(k => [`${k}_avg`, `${k}_median`, `${k}_max`]).flat();
    const cols = ['className', 'gamesPlayed', 'wins', 'losses', 'winRate', 'bestBuild', 'bestBuildWinRate', ...statCols];
    const rows = [cols.join(',')];

    for (const [cls, data] of Object.entries(aggregate.classStats)) {
        const row = cols.map(c => {
            if (c === 'className')        return cls;
            if (c === 'gamesPlayed')      return data.gamesPlayed;
            if (c === 'wins')             return data.wins;
            if (c === 'losses')           return data.losses;
            if (c === 'winRate')          return data.winRate;
            if (c === 'bestBuild')        return data.bestBuild ?? '';
            if (c === 'bestBuildWinRate') return data.bestBuildWinRate ?? '';

            const [key, stat] = c.split('_');
            return data.stats[key]?.[stat] ?? '';
        });
        rows.push(row.join(','));
    }
    return rows.join('\n');
}

/**
 * Exports per-class × per-archetype winrate CSV.
 * Each row = one class × one archetype.
 */
export function exportBuildCSV(aggregate) {
    const rows = ['className,buildArchetype,gamesPlayed,wins,losses,winRate'];
    for (const [cls, data] of Object.entries(aggregate.classStats)) {
        for (const [arch, bd] of Object.entries(data.buildStats || {})) {
            rows.push(`${cls},${arch},${bd.gamesPlayed},${bd.wins},${bd.losses},${bd.winRate}`);
        }
    }
    return rows.join('\n');
}

/** Exports the item win-rate CSV. */
export function exportItemCSV(aggregate) {
    const rows = ['itemId,appearances,wins,winRate'];
    for (const [id, data] of Object.entries(aggregate.itemStats)) {
        rows.push(`${id},${data.appearances},${data.wins},${data.winRate}`);
    }
    return rows.join('\n');
}

/** Serialises the full aggregate + raw records to JSON. */
export function exportJSON(aggregate, gameRecords) {
    return JSON.stringify({ aggregate, gameRecords }, null, 2);
}

/** Triggers a browser download of the given text content. */
export function downloadFile(filename, content, mime = 'text/csv') {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── Internal rounding helpers ─────────────────────────────────────────────────
const _r1 = v => Math.round(v * 10)   / 10;
const _r2 = v => Math.round(v * 100)  / 100;
const _r3 = v => Math.round(v * 1000) / 1000;
