// ── BotBrain.js ───────────────────────────────────────────────────────────────
//
// Sdílené rozhraní pro strategické myšlení botů (Macro vrstva).
// Každý GameMode_*.js si importuje BaseBotBrain a přepíše jen to co potřebuje.
//
// Metody:
//   buildStrategyOrder(ctx)          → string[]  — seřazené strategie (best first)
//   pickRecoveryStrategy(ctx)        → string    — panic fallback strategie
//   scoreMacroSnapshot(start, end)   → { total, breakdown } — KPI hodnocení výsledku
//   getPhaseDuration(phase, ctx)     → number    — sekundy pro danou fázi
//   assignMacroOrders(ctx)           → void      — rozdělí úkoly všem botům
//
// ctx (kontext předávaný do všech metod):
//   team, mState, macroSnapshot, enemies, teamBots, teamPlayers,
//   unassigned, ownedTowers, unownedTowers, spawnPoints,
//   assign(bot, type, target), isHomeTower(tower),
//   scoreBotForTower(bot, tower), scoreBotForAttack(bot, target)

import { game } from './State.js';
import { dist } from './Utils.js';

// ── Dominion / Classic brain (výchozí) ───────────────────────────────────────

export const DominionBrain = {

  buildStrategyOrder(ctx) {
    const { homeThreat, towerLead, neutralCount, powerLead, pointDiff,
            objectivePresenceLead, activePowerupLead, allyRoles,
            teamHeroCount, enemyHeroCount, enemyDeadCount, enemyRespawnSoonCount } = ctx;
    const objectiveBias = objectivePresenceLead >= 18 ? 6 : (objectivePresenceLead <= -18 ? -4 : 0);
    const powerupBias   = activePowerupLead > 0 ? 8 : 0;
    const ranked = [
      { id: 'TOWER_FIRST', score: 125 + (homeThreat * 62) + (Math.max(0, -towerLead) * 38) + (neutralCount * 8) + (Math.max(0, -powerLead) * 6) + (pointDiff < 0 ? 12 : 0) + objectiveBias },
      { id: 'TURTLE',      score: 110 + (homeThreat * 68) + (Math.max(0, -towerLead) * 30) + (Math.max(0, -powerLead) * 5) + (pointDiff < 0 ? 20 : 0) + (objectivePresenceLead < 0 ? 6 : 0) },
      { id: 'AGGRO_DEF',   score: 90  + (Math.max(0, -towerLead) * 24) + (homeThreat * 18) + (Math.max(0, enemyHeroCount - teamHeroCount) * 6) + (objectivePresenceLead < 0 ? 4 : 0) },
      { id: 'META_4_1',    score: 96  + (allyRoles.SPLITPUSHER * 22) + (allyRoles.FIGHTER * 4) + (towerLead >= 0 ? 10 : 0) + (pointDiff >= 0 ? 6 : 0) + (enemyDeadCount > 0 ? 8 : 0) + objectiveBias + powerupBias },
      { id: 'META_3_2',    score: 82  + (Math.min(allyRoles.FIGHTER, 3) * 12) + (teamHeroCount >= 3 ? 6 : 0) + (enemyRespawnSoonCount > 0 ? 6 : 0) + objectiveBias },
      { id: 'KILL_FIRST',  score: 88  + (allyRoles.SLAYER * 22) + (allyRoles.SUPPORT * 8) + (Math.max(0, teamHeroCount - enemyHeroCount) * 6) + (powerLead > 0 ? 8 : 0) + (enemyDeadCount > 0 ? 18 : 0) + (activePowerupLead > 0 ? 10 : 0) + (homeThreat === 0 ? 14 : -12) },
      { id: 'AGGRO_ALL',   score: 60  + (Math.max(0, towerLead) * 18) + (Math.max(0, teamHeroCount - enemyHeroCount) * 5) + (powerLead > 0 ? 4 : 0) - (homeThreat * 18) + (objectivePresenceLead < 0 ? -2 : 0) },
      { id: 'SPLIT_ROAM',  score: 70  + (allyRoles.SPLITPUSHER * 24) + (neutralCount * 10) + (Math.max(0, towerLead) * 4) - (homeThreat * 12) + (objectivePresenceLead > 15 ? 4 : 0) },
    ];
    return ranked.sort((a, b) => b.score - a.score).slice(0, 5).map(s => s.id);
  },

  pickRecoveryStrategy(ctx) {
    const { homeThreat, towerLead, powerLead, activePowerupLead, pointDiff } = ctx;
    if (homeThreat > 1 || towerLead < -1) return 'TURTLE';
    if (homeThreat > 0 || towerLead < 0)  return 'TOWER_FIRST';
    if (powerLead < -250)                  return 'AGGRO_DEF';
    if (activePowerupLead > 0 && pointDiff >= 0) return 'KILL_FIRST';
    return 'TOWER_FIRST';
  },

  scoreMacroSnapshot(startSnap, endSnap) {
    if (!startSnap || !endSnap) return { total: 0, breakdown: [] };
    const breakdown = [
      { key: 'pointDiff',            weight: 90,    delta: endSnap.pointDiff            - startSnap.pointDiff },
      { key: 'towerLead',            weight: 7200,  delta: endSnap.towerLead            - startSnap.towerLead },
      { key: 'homeHeld',             weight: 5200,  delta: endSnap.homeHeld             - startSnap.homeHeld },
      { key: 'homeControlLead',      weight: 40,    delta: endSnap.homeControlLead      - startSnap.homeControlLead },
      { key: 'objectivePresenceLead',weight: 15,    delta: endSnap.objectivePresenceLead- startSnap.objectivePresenceLead },
      { key: 'teamKillLead',         weight: 360,   delta: endSnap.teamKillLead         - startSnap.teamKillLead },
      { key: 'enemyDeadCount',       weight: 350,   delta: endSnap.enemyDeadCount       - startSnap.enemyDeadCount },
      { key: 'activePowerupLead',    weight: 1200,  delta: endSnap.activePowerupLead    - startSnap.activePowerupLead },
      { key: 'powerLead',            weight: 25,    delta: endSnap.powerLead            - startSnap.powerLead },
      { key: 'homeThreat',           weight: -2400, delta: endSnap.homeThreat           - startSnap.homeThreat },
      { key: 'towerPressure',        weight: -950,  delta: endSnap.towerPressure        - startSnap.towerPressure },
    ].map(item => ({ ...item, score: item.delta * item.weight }));
    return { total: breakdown.reduce((s, i) => s + i.score, 0), breakdown };
  },

  getPhaseDuration(phase, ctx) {
    if (phase === 'EARLY')   return 60;
    if (phase === 'EXPLORE') return (ctx.homeThreat > 0 || ctx.towerLead < 0) ? 35 : 25;
    if (phase === 'EXPLOIT') return ctx.homeThreat > 0 ? 240 : 300;
    return 25;
  },

  assignMacroOrders(ctx) {
    const { team, mState, macroSnapshot: snap, enemies,
            teamBots, unassigned: _unassigned, ownedTowers, unownedTowers,
            assign, isHomeTower, scoreBotForTower, scoreBotForAttack, spawnPoints } = ctx;

    // Lokální unassigned — měníme ho uvnitř
    let unassigned = [..._unassigned];
    const reassign = (bot, type, target) => { assign(bot, type, target); unassigned = unassigned.filter(b => b.id !== bot.id); };

    // 1. ZÁCHRANA SPOLUBOJOVNÍKA
    for (let ally of teamBots.filter(b => b.alive)) {
      if (ally.hp / ally.effectiveMaxHp < 0.4 && ally.target && ally.target.alive) {
        const winProb = ally.predictFightOutcome ? ally.predictFightOutcome(ally.target) : 0.5;
        if (winProb < 0.4) {
          const helpers = unassigned.filter(b => dist(b.pos, ally.pos) < 2000);
          if (helpers.length > 0) {
            const best = helpers.sort((a, b) => {
              const sA = dist(a.pos, ally.pos) - (['SLAYER', 'FIGHTER'].includes(a.role) ? 1500 : 0);
              const sB = dist(b.pos, ally.pos) - (['SLAYER', 'FIGHTER'].includes(b.role) ? 1500 : 0);
              return sA - sB;
            })[0];
            reassign(best, 'HUNT', ally.target);
          }
        }
      }
    }

    // 2. POWERUP
    if (game.powerup && game.powerup.active && unassigned.length > 0) {
      const candidates = unassigned.filter(b => ['SLAYER', 'SPLITPUSHER'].includes(b.role));
      const pool = candidates.length > 0 ? candidates : unassigned;
      const best = pool.sort((a, b) => dist(a.pos, game.powerup.pos) - dist(b.pos, game.powerup.pos))[0];
      reassign(best, 'POWERUP', game.powerup);
    }

    // 3. DEFEND — věže pod palbou
    if (mState.currentStrat !== 'AGGRO_ALL') {
      for (let t of ownedTowers) {
        const attackers = enemies.filter(e => dist(e.pos, t.pos) < t.captureRadius + 400);
        if (attackers.length > 0 && Math.abs(t.control) < 100) {
          const needed = mState.currentStrat === 'AGGRO_DEF' ? 1 : Math.min(unassigned.length, attackers.length);
          for (let i = 0; i < needed; i++) {
            const best = unassigned.sort((a, b) =>
              ((a.role === 'TANK' ? -2000 : 0) + dist(a.pos, t.pos)) -
              ((b.role === 'TANK' ? -2000 : 0) + dist(b.pos, t.pos))
            )[0];
            if (best) reassign(best, 'DEFEND', t);
          }
        }
      }
    }

    // 3b. HOLD OWN TOWERS
    if (mState.currentStrat !== 'AGGRO_ALL') {
      const isDesperate   = ownedTowers.length <= 1 && unownedTowers.length >= 3;
      const isLosing      = ownedTowers.length < game.towers.length / 2;
      let holdBudget = isDesperate ? 3 : (isLosing ? 2 : 2);
      const holdTowers = ownedTowers.filter(t => {
        const nearbyEnemies = enemies.filter(e => dist(e.pos, t.pos) < t.captureRadius + 900).length;
        const nearbyAllies  = teamBots.filter(b => b.alive && dist(b.pos, t.pos) < t.captureRadius + 650).length;
        return isHomeTower(t) || nearbyEnemies > 0 || Math.abs(t.control) < 100 || nearbyAllies < 2;
      }).sort((a, b) => {
        if (isHomeTower(a) !== isHomeTower(b)) return isHomeTower(a) ? -1 : 1;
        return enemies.filter(e => dist(e.pos, b.pos) < b.captureRadius + 900).length -
               enemies.filter(e => dist(e.pos, a.pos) < a.captureRadius + 900).length;
      });
      for (let t of holdTowers) {
        if (holdBudget <= 0 || unassigned.length === 0) break;
        const nearbyEnemies = enemies.filter(e => dist(e.pos, t.pos) < t.captureRadius + 900).length;
        let need = Math.min(nearbyEnemies > 1 ? 2 : 1, holdBudget);
        if (Math.abs(t.control) < 100) need = Math.max(need, 1);
        for (let i = 0; i < need && holdBudget > 0 && unassigned.length > 0; i++) {
          const best = unassigned.sort((a, b) =>
            ((a.role === 'TANK' ? -2500 : 0) + (a.role === 'FIGHTER' ? -1200 : 0) + dist(a.pos, t.pos)) -
            ((b.role === 'TANK' ? -2500 : 0) + (b.role === 'FIGHTER' ? -1200 : 0) + dist(b.pos, t.pos))
          )[0];
          if (best) { reassign(best, 'DEFEND', t); holdBudget--; }
        }
      }
    }

    // 4. SNEAK CAPTURE
    if (['META_4_1', 'META_3_2'].includes(mState.currentStrat)) {
      for (let t of unownedTowers) {
        if (enemies.filter(e => dist(e.pos, t.pos) < 1200).length === 0 && unassigned.length > 0) {
          const best = unassigned.sort((a, b) =>
            ((a.role === 'SPLITPUSHER' ? -3000 : 0) + (a.hp / a.effectiveMaxHp) * 1000 + dist(a.pos, t.pos)) -
            ((b.role === 'SPLITPUSHER' ? -3000 : 0) + (b.hp / b.effectiveMaxHp) * 1000 + dist(b.pos, t.pos))
          )[0];
          if (best) reassign(best, 'SNEAK_CAPTURE', t);
        }
      }
    }

    // 5. DISTRIBUCE DLE STRATEGIE
    const cx = unassigned.length > 0
      ? unassigned.reduce((s, b) => s + b.pos.x, 0) / unassigned.length
      : spawnPoints[team].x;
    const cy = unassigned.length > 0
      ? unassigned.reduce((s, b) => s + b.pos.y, 0) / unassigned.length
      : spawnPoints[team].y;
    const remainingTowers = [...unownedTowers].sort((a, b) => dist(a.pos, {x: cx, y: cy}) - dist(b.pos, {x: cx, y: cy}));
    const targetTower     = remainingTowers[0] || null;
    const borderTowers    = [...ownedTowers].sort((a, b) => dist(a.pos, spawnPoints[1 - team]) - dist(b.pos, spawnPoints[1 - team]));
    const topMidTower     = game.towers.find(t => t.index === 1);
    const enemyBotTower   = game.towers.find(t => t.index === (team === 0 ? 3 : 4));
    let mainTarget = (topMidTower && topMidTower.owner !== team) ? topMidTower : enemyBotTower;
    if (!mainTarget || mainTarget.owner === team) mainTarget = targetTower;

    const strat = mState.currentStrat;

    if (strat === 'TOWER_FIRST') {
      const towerPlan = [...ownedTowers].sort((a, b) => {
        const pA = enemies.filter(e => dist(e.pos, a.pos) < a.captureRadius + 900).length;
        const pB = enemies.filter(e => dist(e.pos, b.pos) < b.captureRadius + 900).length;
        return ((pB * 5000) + (isHomeTower(b) ? 8000 : 0) + (Math.abs(b.control) < 100 ? 6000 : 0) - dist(b.pos, spawnPoints[team])) -
               ((pA * 5000) + (isHomeTower(a) ? 8000 : 0) + (Math.abs(a.control) < 100 ? 6000 : 0) - dist(a.pos, spawnPoints[team]));
      });
      for (let t of towerPlan) {
        if (unassigned.length === 0) break;
        const needed = isHomeTower(t) ? 2 : (enemies.filter(e => dist(e.pos, t.pos) < t.captureRadius + 900).length > 1 ? 2 : 1);
        for (let i = 0; i < needed && unassigned.length > 0; i++) {
          const best = unassigned.sort((a, b) => scoreBotForTower(a, t) - scoreBotForTower(b, t))[0];
          if (best) reassign(best, 'DEFEND', t);
        }
      }
      if (unassigned.length > 0) {
        const best = unassigned.sort((a, b) => scoreBotForAttack(a, targetTower || mainTarget) - scoreBotForAttack(b, targetTower || mainTarget))[0];
        if (best) reassign(best, 'ASSAULT', targetTower || mainTarget);
      }
    }
    else if (strat === 'KILL_FIRST') {
      let killCandidates = enemies.filter(e => e.className && (
        ownedTowers.some(t => dist(e.pos, t.pos) < t.captureRadius + 700) ||
        (game.powerup && game.powerup.active && dist(e.pos, game.powerup.pos) < 700) ||
        dist(e.pos, spawnPoints[team]) < 2200
      ));
      if (killCandidates.length === 0) killCandidates = enemies.filter(e => e.className);
      const focusTarget = killCandidates.sort((a, b) =>
        (a.hp / (a.effectiveMaxHp || a.maxHp)) * 1000 + dist(a.pos, spawnPoints[team]) * 0.35 -
        ((b.hp / (b.effectiveMaxHp || b.maxHp)) * 1000 + dist(b.pos, spawnPoints[team]) * 0.35)
      )[0] || null;
      for (let b of [...unassigned].sort((a, b) => scoreBotForAttack(a, focusTarget || mainTarget) - scoreBotForAttack(b, focusTarget || mainTarget))) {
        if (focusTarget && (['SLAYER', 'FIGHTER', 'SUPPORT'].includes(b.role) || dist(b.pos, focusTarget.pos) < 1800))
          reassign(b, 'HUNT', focusTarget);
        else
          reassign(b, 'ASSAULT', targetTower || mainTarget);
      }
    }
    else if (strat === 'TURTLE') {
      for (let i = 0; i < unassigned.length; i++)
        reassign(unassigned[0], 'DEFEND', borderTowers[i % Math.max(1, borderTowers.length)]);
    }
    else if (strat === 'AGGRO_ALL') {
      for (let b of [...unassigned]) reassign(b, 'ASSAULT', targetTower);
    }
    else if (strat === 'AGGRO_DEF') {
      if (unassigned.length > 0 && borderTowers.length > 0) {
        const def = unassigned.sort((a, b) => scoreBotForTower(a, borderTowers[0]) - scoreBotForTower(b, borderTowers[0]))[0];
        reassign(def, 'DEFEND', borderTowers[0]);
      }
      for (let b of [...unassigned]) reassign(b, 'ASSAULT', targetTower);
    }
    else if (strat === 'SPLIT_ROAM') {
      if (unassigned.length > 0) {
        const roamer = unassigned.sort((a, b) =>
          ((a.role === 'SPLITPUSHER' ? -1000 : 0) - a.speed) -
          ((b.role === 'SPLITPUSHER' ? -1000 : 0) - b.speed)
        )[0];
        const sneakTarget = unownedTowers.sort((a, b) =>
          dist(b.pos, mainTarget ? mainTarget.pos : spawnPoints[1 - team]) -
          dist(a.pos, mainTarget ? mainTarget.pos : spawnPoints[1 - team])
        )[0];
        if (sneakTarget) reassign(roamer, 'SNEAK_CAPTURE', sneakTarget);
      }
      for (let b of [...unassigned]) reassign(b, 'ASSAULT', targetTower);
    }
    else if (strat === 'META_3_2') {
      const t2 = unownedTowers.find(t => t !== mainTarget) || borderTowers[0];
      for (let i = 0; i < unassigned.length; i++)
        reassign(unassigned[0], 'ASSAULT', i < 3 ? mainTarget : t2);
    }
    else { // META_4_1
      const splitPusher = unassigned.find(b => b.role === 'SPLITPUSHER') || unassigned[unassigned.length - 1];
      if (splitPusher && unassigned.length > 1) {
        let splitTarget = mainTarget === topMidTower ? enemyBotTower : topMidTower;
        if (!splitTarget || splitTarget.owner === team) splitTarget = unownedTowers.find(t => t !== mainTarget);
        if (splitTarget) reassign(splitPusher, 'PUSH_LANE', splitTarget);
      }
      const assaultTeam = [...unassigned].sort((a, b) =>
        ((['TANK', 'FIGHTER'].includes(a.role) ? -1000 : 0) + (a.role === 'SUPPORT' ? 2000 : 0)) -
        ((['TANK', 'FIGHTER'].includes(b.role) ? -1000 : 0) + (b.role === 'SUPPORT' ? 2000 : 0))
      );
      for (let b of assaultTeam) reassign(b, 'ASSAULT', mainTarget);
    }

    // 6. ZÁLOHA
    for (let b of [...unassigned]) reassign(b, 'FARM', null);
  },
};

// ── ARAM brain ────────────────────────────────────────────────────────────────
// Jedna linka. Vždy tlač dopředu. Bráň svou věž pokud je ohrožena.
// Strategie: PUSH (všichni tlačí), DIVE (agresivní útok), HOLD (obrana věže).

export const AramBrain = {

  buildStrategyOrder(ctx) {
    const { homeThreat, powerLead, teamHeroCount, enemyHeroCount, allyRoles } = ctx;
    const ranked = [
      { id: 'PUSH',  score: 100 + (Math.max(0, powerLead) * 0.05) + (teamHeroCount >= enemyHeroCount ? 10 : 0) },
      { id: 'DIVE',  score: 70  + (allyRoles.SLAYER * 15) + (powerLead > 200 ? 20 : 0) + (teamHeroCount > enemyHeroCount ? 15 : 0) },
      { id: 'HOLD',  score: 50  + (homeThreat * 40) + (powerLead < -150 ? 30 : 0) + (teamHeroCount < enemyHeroCount ? 20 : 0) },
    ];
    return ranked.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.id);
  },

  pickRecoveryStrategy(ctx) {
    return ctx.homeThreat > 0 || ctx.powerLead < -100 ? 'HOLD' : 'PUSH';
  },

  scoreMacroSnapshot(startSnap, endSnap) {
    if (!startSnap || !endSnap) return { total: 0, breakdown: [] };
    const breakdown = [
      { key: 'teamKillLead',  weight: 800,   delta: endSnap.teamKillLead  - startSnap.teamKillLead },
      { key: 'powerLead',     weight: 60,    delta: endSnap.powerLead     - startSnap.powerLead },
      { key: 'homeThreat',    weight: -3000, delta: endSnap.homeThreat    - startSnap.homeThreat },
      { key: 'towerLead',     weight: 12000, delta: endSnap.towerLead     - startSnap.towerLead },
      { key: 'enemyDeadCount',weight: 600,   delta: endSnap.enemyDeadCount- startSnap.enemyDeadCount },
    ].map(item => ({ ...item, score: item.delta * item.weight }));
    return { total: breakdown.reduce((s, i) => s + i.score, 0), breakdown };
  },

  getPhaseDuration(phase, _ctx) {
    // ARAM hry jsou kratší a rychlejší
    if (phase === 'EARLY')   return 20;
    if (phase === 'EXPLORE') return 15;
    if (phase === 'EXPLOIT') return 120;
    return 15;
  },

  assignMacroOrders(ctx) {
    const { team, mState, enemies, teamBots, unassigned: _unassigned,
            ownedTowers, unownedTowers, spawnPoints, assign } = ctx;

    let unassigned = [..._unassigned];
    const reassign = (bot, type, target) => { assign(bot, type, target); unassigned = unassigned.filter(b => b.id !== bot.id); };

    // 1. ZÁCHRANA — vždy
    for (let ally of teamBots.filter(b => b.alive)) {
      if (ally.hp / ally.effectiveMaxHp < 0.35 && ally.target?.alive) {
        const winProb = ally.predictFightOutcome ? ally.predictFightOutcome(ally.target) : 0.5;
        if (winProb < 0.35) {
          const helper = unassigned
            .filter(b => dist(b.pos, ally.pos) < 1200)
            .sort((a, b) => dist(a.pos, ally.pos) - dist(b.pos, ally.pos))[0];
          if (helper) reassign(helper, 'HUNT', ally.target);
        }
      }
    }

    // 2. OBRANA VĚŽE — pokud je věž pod palbou
    for (let t of ownedTowers.filter(t => !t.dead)) {
      const attackers = enemies.filter(e => dist(e.pos, t.pos) < t.captureRadius + 400);
      if (attackers.length > 0) {
        const needed = Math.min(attackers.length, unassigned.length, 2);
        for (let i = 0; i < needed; i++) {
          const best = unassigned.sort((a, b) => dist(a.pos, t.pos) - dist(b.pos, t.pos))[0];
          if (best) reassign(best, 'DEFEND', t);
        }
      }
    }

    // 3. Cílový bod: věž nebo (pokud žádné věže) nepřátelský spawn
    const enemyTower = unownedTowers.filter(t => !t.dead).sort((a,b) => dist(a.pos, spawnPoints[team]) - dist(b.pos, spawnPoints[team]))[0];
    const enemySpawnPos = spawnPoints[1 - team];
    // Pseudo-cíl pro pohyb bez věží — botové míří na střed mapy nebo k nepřátelskému spawnu
    const pushTarget = enemyTower || { pos: enemySpawnPos };
    const strat = mState.currentStrat;

    if (strat === 'HOLD') {
      const myTower = ownedTowers.filter(t => !t.dead).sort((a,b) => dist(a.pos, spawnPoints[1-team]) - dist(b.pos, spawnPoints[1-team]))[0];
      const holdPos = myTower || { pos: spawnPoints[team] };
      for (let b of [...unassigned]) reassign(b, 'DEFEND', myTower ? myTower : holdPos);
    } else if (strat === 'DIVE') {
      // Agresivní — nejdřív hunt, pak push
      const target = enemies.filter(e => e.className).sort((a, b) =>
        (a.hp / (a.effectiveMaxHp || a.maxHp)) - (b.hp / (b.effectiveMaxHp || b.maxHp))
      )[0];
      for (let b of [...unassigned]) {
        if (target && dist(b.pos, target.pos) < 1800) reassign(b, 'HUNT', target);
        else reassign(b, 'ASSAULT', pushTarget);
      }
    } else { // PUSH
      for (let b of [...unassigned]) reassign(b, 'ASSAULT', pushTarget);
    }
  },
};

// ── Arena brain ───────────────────────────────────────────────────────────────
// Jedna věž uprostřed. Drž ji pro body. Zabíjej pro body.
// Strategie: HOLD_AND_FIGHT (drž věž + fight), DIVE (hunt low-hp), SIEGE (obléhej věž).

export const ArenaBrain = {

  buildStrategyOrder(ctx) {
    const { powerLead, allyRoles, teamHeroCount, enemyHeroCount, pointDiff } = ctx;
    // V Areně neexistují homeTowers — věž je vždy neutrální nebo nepřátelská
    const ranked = [
      { id: 'HOLD_AND_FIGHT', score: 120 + (powerLead > 0 ? 20 : 0) + (allyRoles.TANK * 10) + (allyRoles.FIGHTER * 8) },
      { id: 'DIVE',           score: 80  + (allyRoles.SLAYER * 20) + (powerLead > 200 ? 25 : 0) + (teamHeroCount > enemyHeroCount ? 20 : 0) + (pointDiff > 20 ? 10 : 0) },
      { id: 'SIEGE',          score: 60  + (allyRoles.SPLITPUSHER * 15) + (pointDiff < -15 ? 25 : 0) + (powerLead < -100 ? 15 : 0) },
    ];
    return ranked.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.id);
  },

  pickRecoveryStrategy(ctx) {
    return ctx.powerLead < -150 ? 'SIEGE' : 'HOLD_AND_FIGHT';
  },

  scoreMacroSnapshot(startSnap, endSnap) {
    if (!startSnap || !endSnap) return { total: 0, breakdown: [] };
    // Priorita: kill lead > towerLead (drží věž) > power delta
    const breakdown = [
      { key: 'teamKillLead',  weight: 1200, delta: endSnap.teamKillLead   - startSnap.teamKillLead },
      { key: 'towerLead',     weight: 8000, delta: endSnap.towerLead      - startSnap.towerLead },
      { key: 'powerLead',     weight: 40,   delta: endSnap.powerLead      - startSnap.powerLead },
      { key: 'enemyDeadCount',weight: 900,  delta: endSnap.enemyDeadCount - startSnap.enemyDeadCount },
      { key: 'homeThreat',    weight: -500, delta: endSnap.homeThreat     - startSnap.homeThreat },
    ].map(item => ({ ...item, score: item.delta * item.weight }));
    return { total: breakdown.reduce((s, i) => s + i.score, 0), breakdown };
  },

  getPhaseDuration(phase, _ctx) {
    // Arena hry jsou rychlé — skóre se mění rychle
    if (phase === 'EARLY')   return 15;
    if (phase === 'EXPLORE') return 12;
    if (phase === 'EXPLOIT') return 90;
    return 12;
  },

  assignMacroOrders(ctx) {
    const { team, mState, enemies, teamBots, unassigned: _unassigned, assign, spawnPoints } = ctx;

    let unassigned = [..._unassigned];
    const reassign = (bot, type, target) => { assign(bot, type, target); unassigned = unassigned.filter(b => b.id !== bot.id); };

    const centerTower = game.towers[0]; // jediná věž
    const strat = mState.currentStrat;

    // 1. ZÁCHRANA
    for (let ally of teamBots.filter(b => b.alive)) {
      if (ally.hp / ally.effectiveMaxHp < 0.3 && ally.target?.alive) {
        const winProb = ally.predictFightOutcome ? ally.predictFightOutcome(ally.target) : 0.5;
        if (winProb < 0.35) {
          const helper = unassigned
            .filter(b => dist(b.pos, ally.pos) < 1400)
            .sort((a, b) => {
              const sA = dist(a.pos, ally.pos) - (['SLAYER', 'FIGHTER'].includes(a.role) ? 1200 : 0);
              const sB = dist(b.pos, ally.pos) - (['SLAYER', 'FIGHTER'].includes(b.role) ? 1200 : 0);
              return sA - sB;
            })[0];
          if (helper) reassign(helper, 'HUNT', ally.target);
        }
      }
    }

    // 1.5 REGROUP (Sjednocení týmu, pokud je většina mrtvá)
    const teamDead = game.players.filter(p => p.team === team && !p.alive).length;
    if (teamDead >= 2) {
      for (let b of [...unassigned]) {
        reassign(b, 'REGROUP', { pos: spawnPoints[team] });
      }
      return; // Dál nic nepřidělujeme, čekáme v základně na tým
    }

    // Helper for camp preference
    const getCampPref = (bot, camp) => {
        if (!camp.camp) return 0; // fallback if it's not a jungle monster
        let score = 100;
        if (camp.camp.buff === 'TANK') {
            if (bot.role === 'TANK') score += 500;
            if (bot.role === 'SUPPORT') score += 400;
            if (bot.role === 'FIGHTER') score += 200;
        } else if (camp.camp.buff === 'POWER') {
            if (bot.dmgType === 'magical' && bot.role === 'SLAYER') score += 500;
            if (bot.role === 'FIGHTER') score += 300;
            if (bot.role === 'SLAYER') score += 100;
        } else if (camp.camp.buff === 'AS_AH') {
            if (bot.dmgType === 'physical' && bot.role === 'SLAYER') score += 500;
            if (bot.role === 'SPLITPUSHER') score += 400;
            if (bot.role === 'FIGHTER') score += 200;
        }
        score -= dist(bot.pos, camp.pos) * 0.05;
        return score;
    };

    // 1.8 JUNGLE CAMPS FARMING
    const aliveCamps = game.minions.filter(m => m.isJungleMonster && !m.dead);
    const isStartOfGame = (game.score[0] || 0) < 5 && (game.score[1] || 0) < 5;

    if (isStartOfGame && aliveCamps.length > 0) {
      if (mState.startSplit === undefined) {
          mState.startSplit = [4, 3, 2][Math.floor(Math.random() * 3)]; // 4/0, 3/1, 2/2 (Camps / Mid)
      }
      // Blue team -> top camps (y < 600), Red team -> bottom camps (y > 600)
      const myCamps = aliveCamps.filter(c => team === 0 ? c.pos.y < 600 : c.pos.y > 600);
      if (myCamps.length > 0) {
        let candidates = [...unassigned].sort((a,b) => {
            // Tanci, Supporti a Caster Mágové preferují Mid, AD a Melee radši do Jungle
            const scoreA = (['SUPPORT', 'TANK'].includes(a.role) ? 100 : 0) + (['Mage','Summoner','Pyromancer','Tamer'].includes(a.className) ? 50 : 0) - (['SLAYER', 'FIGHTER', 'SPLITPUSHER'].includes(a.role) && a.dmgType === 'physical' ? 100 : 0);
            const scoreB = (['SUPPORT', 'TANK'].includes(b.role) ? 100 : 0) + (['Mage','Summoner','Pyromancer','Tamer'].includes(b.className) ? 50 : 0) - (['SLAYER', 'FIGHTER', 'SPLITPUSHER'].includes(b.role) && b.dmgType === 'physical' ? 100 : 0);
            return scoreA - scoreB;
        });

        let numCamps = Math.min(candidates.length, mState.startSplit);
        let toCamps = candidates.slice(0, numCamps);
        let toMid = candidates.slice(numCamps);

        for (let b of toMid) {
            reassign(b, 'ASSAULT', centerTower);
        }

        if (toCamps.length > 0) {
            let bestCamp = myCamps[0];
            let bestScore = -Infinity;
            let bestTaker = toCamps[0];
            
            for (let c of myCamps) {
                for (let b of toCamps) {
                    let s = getCampPref(b, c);
                    if (s > bestScore) {
                        bestScore = s;
                        bestCamp = c;
                        bestTaker = b;
                    }
                }
            }
            for (let b of toCamps) {
                reassign(b, 'FARM', bestCamp);
                b.macroOrder.designatedTakerId = bestTaker.id;
            }
        }
      }
    } else {
      // Free time farming
      const weOwnTower = centerTower && centerTower.owner === team;
      const enemyThreats = enemies.filter(e => e.alive && dist(e.pos, centerTower.pos) < centerTower.captureRadius + 600).length;

      if (weOwnTower && enemyThreats <= 1 && aliveCamps.length > 0) {
        if (!mState.currentSquadSize || Math.random() < 0.1) {
            mState.currentSquadSize = Math.floor(Math.random() * 3) + 1; // 1 to 3 boti na jeden kemp
        }
        let availableForFarm = unassigned.filter(b => ['SLAYER', 'FIGHTER', 'SPLITPUSHER', 'TANK', 'SUPPORT'].includes(b.role));
        availableForFarm.sort((a,b) => (['SLAYER', 'FIGHTER'].includes(b.role) ? 0 : 1) - (['SLAYER', 'FIGHTER'].includes(a.role) ? 0 : 1));
        
        let squad = availableForFarm.slice(0, mState.currentSquadSize);
        
        if (squad.length > 0) {
            let bestCamp = aliveCamps[0];
            let bestScore = -Infinity;
            let bestTaker = squad[0];
            
            for (let c of aliveCamps) {
                for (let b of squad) {
                    let s = getCampPref(b, c);
                    if (s > bestScore) {
                        bestScore = s;
                        bestCamp = c;
                        bestTaker = b;
                    }
                }
            }
            
            for (let b of squad) {
                reassign(b, 'FARM', bestCamp);
                b.macroOrder.designatedTakerId = bestTaker.id;
            }
        }
      }
    }

    if (strat === 'DIVE') {
      // Hunt low-hp nepřátelé — pak obsaď věž
      const target = enemies.filter(e => e.className).sort((a, b) =>
        (a.hp / (a.effectiveMaxHp || a.maxHp)) - (b.hp / (b.effectiveMaxHp || b.maxHp))
      )[0];
      for (let b of [...unassigned]) {
        if (target && ['SLAYER', 'FIGHTER'].includes(b.role)) reassign(b, 'HUNT', target);
        else reassign(b, 'ASSAULT', centerTower);
      }
    } else if (strat === 'SIEGE') {
      // Všichni obléhají věž — capture first
      for (let b of [...unassigned]) reassign(b, 'ASSAULT', centerTower);
    } else { // HOLD_AND_FIGHT
      // Tanky a fighteři drží věž (pokud je dostupná), slayeři huntují
      // Pokud je věž zamčená, všichni farmují kemp a čekají
      const towerLocked = centerTower && centerTower.isLocked;
      
      for (let b of [...unassigned]) {
        if (['SLAYER', 'SPLITPUSHER'].includes(b.role) && enemies.length > 0) {
          const nearbyEnemy = enemies.filter(e => e.className && dist(e.pos, b.pos) < 1600)
            .sort((a, b) => a.hp - b.hp)[0];
          if (nearbyEnemy) { reassign(b, 'HUNT', nearbyEnemy); continue; }
        }
        
        // Pokud je věž zamčená, jdi do lesů farmit
        if (towerLocked && aliveCamps.length > 0) {
          const bestCamp = aliveCamps.reduce((best, camp) => 
            getCampPref(b, camp) > getCampPref(b, best) ? camp : best
          );
          reassign(b, 'FARM', bestCamp);
        } else {
          // Věž je dostupná — jdi ji obsadit
          reassign(b, 'ASSAULT', centerTower);
        }
      }
    }
  },
};
