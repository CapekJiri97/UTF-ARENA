/**
 * SimStats.js — Per-game and aggregate statistics engine for the simulation module.
 *
 * Architecture:
 *   PlayerTracker  — tracks one bot across one game
 *   GameTracker    — owns all PlayerTrackers for one game, produces a GameRecord on finalize()
 *   computeAggregateStats(records[]) — crunches all GameRecords into class/item reports
 *   exportCSV / exportJSON            — serialisation helpers
 */

// ─── Numeric keys averaged / min-max-medianed per class ───────────────────────
const NUMERIC_KEYS = [
    'kills', 'deaths', 'assists', 'kda',
    'dmgDealtTotal', 'dmgDealtToHeroes', 'dmgTaken', 'hpHealed',
    'dpsToHeroes', 'hpsHealed',
    'maxBurst1s', 'maxBurst3s',
    'spellCastsQ', 'spellCastsE',
    'level', 'gold', 'totalGold', 'goldPerMin',
    'timeAlive', 'timeDead', 'survivalRate',
    'killsPerMin', 'dmgEfficiency',
    'pcs',
    'dmgPerGold',       // dmgDealtToHeroes / totalGold — efektivnost investice
    'killParticipation',// (kills+assists) / teamTotalKills — 0..1
    'soloKillRate',     // kills where no ally dealt dmg last 3s — proxy "outplay"
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

        this._dmgEvents  = [];
        this.maxBurst1s  = 0;
        this.maxBurst3s  = 0;

        this._prevDmgHeroes = 0;
        this._prevKills     = 0;

        this.spellCasts  = { Q: 0, E: 0 };
        this.timeAlive   = 0;
        this.timeDead    = 0;
        this._killTimes  = [];
    }

    onSpellCast(key) {
        if (key === 'Q') this.spellCasts.Q++;
        else if (key === 'E') this.spellCasts.E++;
    }

    tick(simTime, dt, player) {
        if (player.alive) this.timeAlive += dt;
        else              this.timeDead  += dt;

        const curDmg   = player.stats?.dmgDealtToHeroes || 0;
        const dmgDelta = curDmg - this._prevDmgHeroes;
        this._prevDmgHeroes = curDmg;
        if (dmgDelta > 0) this._dmgEvents.push({ time: simTime, amount: dmgDelta });

        const cutoff3 = simTime - 3.0;
        while (this._dmgEvents.length > 0 && this._dmgEvents[0].time < cutoff3) this._dmgEvents.shift();

        let sum1 = 0, sum3 = 0;
        const cutoff1 = simTime - 1.0;
        for (const e of this._dmgEvents) {
            sum3 += e.amount;
            if (e.time >= cutoff1) sum1 += e.amount;
        }
        if (sum1 > this.maxBurst1s) this.maxBurst1s = sum1;
        if (sum3 > this.maxBurst3s) this.maxBurst3s = sum3;

        if (player.kills > this._prevKills) {
            this._killTimes.push(simTime);
            this._prevKills = player.kills;
        }
    }

    finalize(simTime, player, allPlayers) {
        const s          = player.stats || {};
        const totalDmg   = s.dmgDealtToHeroes || 0;
        const totalHeal  = s.hpHealed         || 0;
        const aliveTime  = Math.max(this.timeAlive, 1);
        const gameDurMin = Math.max(simTime / 60, 0.01);

        const kda = player.deaths === 0
            ? (player.kills + player.assists)
            : (player.kills + player.assists) / player.deaths;

        // Kill participation — need team total kills
        const teamKills = allPlayers
            .filter(p => p.team === player.team)
            .reduce((s, p) => s + (p.kills || 0), 0);
        const killParticipation = teamKills > 0
            ? _r2((player.kills + player.assists) / teamKills)
            : 0;

        // Teammates and opponents (for team comp analysis)
        const teammates = allPlayers
            .filter(p => p.team === player.team && p.id !== player.id)
            .map(p => ({ id: p.id, className: p.className, role: p.role, dmgType: p.dmgType }));
        const opponents = allPlayers
            .filter(p => p.team !== player.team)
            .map(p => ({ id: p.id, className: p.className, role: p.role, dmgType: p.dmgType }));

        const totalGold = Math.round(player.totalGold || player.gold);

        return {
            id:             this.id,
            className:      player.className, // read at finalize (may have changed via reassign)
            team:           this.team,
            role:           player.role || this.role,
            dmgType:        player.dmgType || this.dmgType,
            buildArchetype: player.buildArchetype || this.buildArchetype,

            // Core combat
            kills:            player.kills,
            deaths:           player.deaths,
            assists:          player.assists,
            kda:              _r2(kda),
            killParticipation,

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

            // Economy
            level:       player.level,
            gold:        Math.round(player.gold),
            totalGold,
            goldPerMin:  Math.round(totalGold / gameDurMin),
            dmgPerGold:  totalGold > 0 ? _r2(totalDmg / totalGold) : 0,

            // Items — individual counts per item (easier to group in Python)
            items:       [...(player.items || [])],
            itemCounts:  _countItems(player.items || []),

            // Survival
            timeAlive:     Math.round(this.timeAlive),
            timeDead:      Math.round(this.timeDead),
            survivalRate:  _r3(this.timeAlive / Math.max(simTime, 1)),

            // Derived KPIs
            killsPerMin:   _r1(player.kills / gameDurMin),
            dmgEfficiency: s.dmgTaken > 0 ? _r2(totalDmg / s.dmgTaken) : totalDmg,
            soloKillRate:  0, // placeholder — hard to track without continuous attacker log

            // PCS (player combat score)
            pcs: Math.round(player.pcs || 0),

            // Team comp context
            teammates,
            opponents,
        };
    }
}

// ─── TeamStrategyTracker ───────────────────────────────────────────────────────
class TeamStrategyTracker {
    constructor(team) {
        this.team         = team;
        // phase time accumulators (seconds)
        this.phaseTime    = { EARLY: 0, EXPLORE: 0, EXPLOIT: 0 };
        // strategy uptime map: stratId → seconds
        this.stratTime    = {};
        this._lastPhase   = null;
        this._lastStrat   = null;
    }

    tick(dt, macroState) {
        if (!macroState) return;
        const ms = macroState[this.team];
        if (!ms) return;

        const phase = ms.phase || 'EARLY';
        const strat = ms.currentStrat || 'NONE';

        this.phaseTime[phase] = (this.phaseTime[phase] || 0) + dt;
        this.stratTime[strat] = (this.stratTime[strat]  || 0) + dt;

        this._lastPhase = phase;
        this._lastStrat = strat;
    }

    finalize(simTime) {
        // Dominant strategy = most time spent in any single strategy
        let dominantStrat = 'NONE', dominantTime = 0;
        for (const [s, t] of Object.entries(this.stratTime)) {
            if (t > dominantTime) { dominantTime = t; dominantStrat = s; }
        }

        // Phase share fractions
        const total = Math.max(simTime, 1);
        const exploitShare = _r2((this.phaseTime.EXPLOIT || 0) / total);
        const exploreShare = _r2((this.phaseTime.EXPLORE || 0) / total);
        const earlyShare   = _r2((this.phaseTime.EARLY   || 0) / total);

        // How many distinct strategies were tested
        const strategyCount = Object.keys(this.stratTime).length;

        return {
            dominantStrategy: dominantStrat,
            dominantStrategyTime: Math.round(dominantTime),
            exploitTimeFrac:  exploitShare,
            exploreTimeFrac:  exploreShare,
            earlyTimeFrac:    earlyShare,
            strategyCount,
            // full breakdown for JSON export / Python lab
            stratTime:  Object.fromEntries(Object.entries(this.stratTime).map(([k,v]) => [k, Math.round(v)])),
            phaseTime:  { EARLY: Math.round(this.phaseTime.EARLY||0), EXPLORE: Math.round(this.phaseTime.EXPLORE||0), EXPLOIT: Math.round(this.phaseTime.EXPLOIT||0) },
        };
    }
}

// ─── GameTracker ───────────────────────────────────────────────────────────────
export class GameTracker {
    constructor(gameIndex, gameMode) {
        this.gameIndex       = gameIndex;
        this.gameMode        = gameMode || 'arena';
        this.simTime         = 0;
        this._trackers       = new Map();
        this._stratTrackers  = { 0: new TeamStrategyTracker(0), 1: new TeamStrategyTracker(1) };
    }

    init(players) {
        this._trackers.clear();
        this.simTime = 0;
        this._stratTrackers[0] = new TeamStrategyTracker(0);
        this._stratTrackers[1] = new TeamStrategyTracker(1);
        for (const p of players) this._trackers.set(p.id, new PlayerTracker(p));
    }

    // macroState is game.macroState — optional, only present for Dominion-style modes
    tick(players, dt, macroState) {
        this.simTime += dt;
        for (const p of players) this._trackers.get(p.id)?.tick(this.simTime, dt, p);
        if (macroState) {
            this._stratTrackers[0].tick(dt, macroState);
            this._stratTrackers[1].tick(dt, macroState);
        }
    }

    onSpellCast(playerId, key) {
        this._trackers.get(playerId)?.onSpellCast(key);
    }

    finalize(winner, score, players) {
        const playerResults = players.map(p =>
            this._trackers.get(p.id)?.finalize(this.simTime, p, players) ?? null
        ).filter(Boolean);

        const teamStrategies = {
            0: this._stratTrackers[0].finalize(this.simTime),
            1: this._stratTrackers[1].finalize(this.simTime),
        };

        return {
            gameIndex: this.gameIndex,
            gameMode:  this.gameMode,
            winner,
            score:        { 0: score?.[0] ?? 0, 1: score?.[1] ?? 0 },
            duration:     Math.round(this.simTime),
            players:      playerResults,
            teamStrategies,
        };
    }
}

// ─── Aggregate computation ─────────────────────────────────────────────────────
export function computeAggregateStats(gameRecords) {
    const byClass          = {};
    const byItem           = {};
    const byClassArchetype = {};
    const byGameMode       = {}; // gameMode → { wins0, wins1, draws, count }

    let team0Wins = 0, team1Wins = 0, draws = 0;

    for (const rec of gameRecords) {
        if (rec.winner === 0) team0Wins++;
        else if (rec.winner === 1) team1Wins++;
        else draws++;

        // Per game mode stats
        const gm = rec.gameMode || 'unknown';
        if (!byGameMode[gm]) byGameMode[gm] = { wins0: 0, wins1: 0, draws: 0, count: 0 };
        byGameMode[gm].count++;
        if (rec.winner === 0) byGameMode[gm].wins0++;
        else if (rec.winner === 1) byGameMode[gm].wins1++;
        else byGameMode[gm].draws++;

        for (const p of rec.players) {
            if (!byClass[p.className]) byClass[p.className] = { entries: [], wins: 0, losses: 0 };
            const won = (p.team === rec.winner);
            byClass[p.className].entries.push(p);
            if (won) byClass[p.className].wins++;
            else     byClass[p.className].losses++;

            const arch = p.buildArchetype || 'unknown';
            if (!byClassArchetype[p.className]) byClassArchetype[p.className] = {};
            if (!byClassArchetype[p.className][arch]) byClassArchetype[p.className][arch] = { wins: 0, losses: 0 };
            if (won) byClassArchetype[p.className][arch].wins++;
            else     byClassArchetype[p.className][arch].losses++;

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
            const vals = data.entries.map(e => typeof e[key] === 'number' ? e[key] : 0).sort((a, b) => a - b);
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
            gamesPlayed: n, wins: data.wins, losses: data.losses,
            winRate:     _r1(data.wins / n * 100),
            stats, buildStats, bestBuild,
            bestBuildWinRate: bestBuildWr >= 0 ? bestBuildWr : null,
        };
    }

    // ── Item stats ─────────────────────────────────────────────────────────────
    const itemStats = {};
    for (const [id, data] of Object.entries(byItem)) {
        itemStats[id] = { appearances: data.appearances, wins: data.wins, winRate: _r1(data.wins / data.appearances * 100) };
    }

    // ── Game-mode stats ────────────────────────────────────────────────────────
    const gameModeStats = {};
    for (const [gm, d] of Object.entries(byGameMode)) {
        gameModeStats[gm] = {
            count: d.count,
            team0WinRate: _r1(d.wins0 / d.count * 100),
            team1WinRate: _r1(d.wins1 / d.count * 100),
            drawRate: _r1(d.draws / d.count * 100),
        };
    }

    // ── Strategy stats ─────────────────────────────────────────────────────────
    // byStrategy[stratId] → { appearances, wins, team0Count, team1Count }
    const byStrategy = {};
    for (const rec of gameRecords) {
        if (!rec.teamStrategies) continue;
        for (const teamIdx of [0, 1]) {
            const ts = rec.teamStrategies[teamIdx];
            if (!ts || ts.dominantStrategy === 'NONE') continue;
            const s = ts.dominantStrategy;
            if (!byStrategy[s]) byStrategy[s] = { appearances: 0, wins: 0 };
            byStrategy[s].appearances++;
            if (rec.winner === teamIdx) byStrategy[s].wins++;
        }
    }
    const strategyStats = {};
    for (const [s, d] of Object.entries(byStrategy)) {
        strategyStats[s] = {
            appearances: d.appearances,
            wins:        d.wins,
            winRate:     _r1(d.wins / d.appearances * 100),
        };
    }

    const durations  = gameRecords.map(r => r.duration);
    const totalGames = gameRecords.length || 1;

    return {
        totalGames,
        avgGameDuration: Math.round(durations.reduce((s, v) => s + v, 0) / totalGames),
        minGameDuration: Math.min(...durations),
        maxGameDuration: Math.max(...durations),
        team0WinRate:    _r1(team0Wins / totalGames * 100),
        team1WinRate:    _r1(team1Wins / totalGames * 100),
        draws,
        classStats,
        itemStats,
        gameModeStats,
        strategyStats,
    };
}

// ─── Export helpers ────────────────────────────────────────────────────────────

/**
 * Full flat player-per-game CSV — one row per player per game.
 * Includes gameMode, teammates, opponents (as semicolon-separated classNames),
 * item counts, PCS, and all KPIs.
 */
export function exportPlayerCSV(gameRecords) {
    const cols = [
        'gameIndex', 'gameMode', 'winner', 'gameDuration', 'score0', 'score1',
        'id', 'className', 'role', 'dmgType', 'team', 'buildArchetype',
        ...NUMERIC_KEYS,
        'maxBurst1s', 'maxBurst3s',
        'spellCastsQ', 'spellCastsE',
        'items',
        'itemCounts',
        'teammates_classes',
        'opponents_classes',
        'teammates_roles',
        'opponents_roles',
        // Strategy columns (populated for Dominion-style modes; empty for arena/aram)
        'team_dominantStrategy',
        'team_exploitTimeFrac',
        'team_exploreTimeFrac',
        'team_strategyCount',
        'team_stratTime',
    ];

    // Deduplicate (NUMERIC_KEYS already contains some of the above keys)
    const uniqueCols = [...new Set(cols)];

    const rows = [uniqueCols.join(',')];
    for (const rec of gameRecords) {
        const ts0 = rec.teamStrategies?.[0];
        const ts1 = rec.teamStrategies?.[1];

        for (const p of rec.players) {
            const ts = p.team === 0 ? ts0 : ts1;
            const row = uniqueCols.map(c => {
                switch(c) {
                    case 'gameIndex':    return rec.gameIndex;
                    case 'gameMode':     return rec.gameMode || 'unknown';
                    case 'winner':       return rec.winner;
                    case 'gameDuration': return rec.duration;
                    case 'score0':       return rec.score[0];
                    case 'score1':       return rec.score[1];
                    case 'items':        return `"${(p.items || []).join(';')}"`;
                    case 'itemCounts': {
                        const ic = p.itemCounts || {};
                        return `"${Object.entries(ic).map(([k,v]) => `${k}:${v}`).join(';')}"`;
                    }
                    case 'teammates_classes':
                        return `"${(p.teammates || []).map(t => t.className).join(';')}"`;
                    case 'opponents_classes':
                        return `"${(p.opponents || []).map(t => t.className).join(';')}"`;
                    case 'teammates_roles':
                        return `"${(p.teammates || []).map(t => t.role).join(';')}"`;
                    case 'opponents_roles':
                        return `"${(p.opponents || []).map(t => t.role).join(';')}"`;
                    case 'team_dominantStrategy': return ts?.dominantStrategy || '';
                    case 'team_exploitTimeFrac':  return ts?.exploitTimeFrac  ?? '';
                    case 'team_exploreTimeFrac':  return ts?.exploreTimeFrac  ?? '';
                    case 'team_strategyCount':    return ts?.strategyCount    ?? '';
                    case 'team_stratTime': {
                        if (!ts?.stratTime) return '';
                        return `"${Object.entries(ts.stratTime).map(([k,v]) => `${k}:${v}`).join(';')}"`;
                    }
                    default: {
                        const v = p[c];
                        return v === undefined ? '' : v;
                    }
                }
            });
            rows.push(row.join(','));
        }
    }
    return rows.join('\n');
}

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

export function exportBuildCSV(aggregate) {
    const rows = ['className,buildArchetype,gamesPlayed,wins,losses,winRate'];
    for (const [cls, data] of Object.entries(aggregate.classStats)) {
        for (const [arch, bd] of Object.entries(data.buildStats || {})) {
            rows.push(`${cls},${arch},${bd.gamesPlayed},${bd.wins},${bd.losses},${bd.winRate}`);
        }
    }
    return rows.join('\n');
}

export function exportItemCSV(aggregate) {
    const rows = ['itemId,appearances,wins,winRate'];
    for (const [id, data] of Object.entries(aggregate.itemStats)) {
        rows.push(`${id},${data.appearances},${data.wins},${data.winRate}`);
    }
    return rows.join('\n');
}

export function exportGameModeCSV(aggregate) {
    const rows = ['gameMode,count,team0WinRate,team1WinRate,drawRate'];
    for (const [gm, d] of Object.entries(aggregate.gameModeStats || {})) {
        rows.push(`${gm},${d.count},${d.team0WinRate},${d.team1WinRate},${d.drawRate}`);
    }
    return rows.join('\n');
}

export function exportStrategyCSV(aggregate) {
    const rows = ['strategy,appearances,wins,winRate'];
    for (const [s, d] of Object.entries(aggregate.strategyStats || {})) {
        rows.push(`${s},${d.appearances},${d.wins},${d.winRate}`);
    }
    return rows.join('\n');
}

export function exportJSON(aggregate, gameRecords) {
    return JSON.stringify({ aggregate, gameRecords }, null, 2);
}

export function downloadFile(filename, content, mime = 'text/csv') {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── Internal helpers ──────────────────────────────────────────────────────────
function _countItems(items) {
    const counts = {};
    for (const id of items) counts[id] = (counts[id] || 0) + 1;
    return counts;
}

const _r1 = v => Math.round(v * 10)   / 10;
const _r2 = v => Math.round(v * 100)  / 100;
const _r3 = v => Math.round(v * 1000) / 1000;
