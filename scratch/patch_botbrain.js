import fs from 'fs';
import path from 'path';

const filePath = 'utf-arena-main/entities/BotBrain.js';
let content = fs.readFileSync(filePath, 'utf8');

const hordeBrainCode = `

// ── Horde Survival brain ─────────────────────────────────────────────────────
// Spojenečtí boti na týmu 0:
// 1. Záchrana / sběr HealPickup pokud mají bot < 45% HP
// 2. Priorita: Odchyt a likvidace Kamikaze Bomberů mířících na Svatyni
// 3. Priorita: Focus na aktivního Bosse / Minibosse
// 4. Obrana Svatyně proti monstrům v okruhu 450 px
// 5. Hlídkování a kiting kolem středu nádvoří

export const HordeBrain = {

  buildStrategyOrder(_ctx) {
    const shrine = game.towers && game.towers[0];
    const shrineHpPct = shrine && shrine.maxHp ? shrine.hp / shrine.maxHp : 1.0;
    const ranked = [
      { id: 'DEFEND_SHRINE', score: 100 + (1 - shrineHpPct) * 80 },
      { id: 'KILL_BOMBERS',  score: 110 },
      { id: 'BOSS_FOCUS',    score: 95 },
    ];
    return ranked.sort((a, b) => b.score - a.score).map(s => s.id);
  },

  pickRecoveryStrategy(_ctx) {
    return 'DEFEND_SHRINE';
  },

  scoreMacroSnapshot(_startSnap, _endSnap) {
    return { total: 0, breakdown: [] };
  },

  getPhaseDuration(_phase, _ctx) {
    return 15;
  },

  assignMacroOrders(ctx) {
    const { teamBots, unassigned: _unassigned, assign } = ctx;
    let unassigned = [..._unassigned];
    const reassign = (bot, type, target) => {
      assign(bot, type, target);
      unassigned = unassigned.filter(b => b.id !== bot.id);
    };

    const shrine = (game.towers && game.towers[0]) || { pos: { x: 1100, y: 1100 } };

    // 1. Léčení: bot s nízkým HP se pokusí vzít aktivní HealPickup v nádvoří
    for (let bot of [...unassigned]) {
      if (bot.alive && (bot.hp / (bot.effectiveMaxHp || bot.maxHp)) < 0.45) {
        const activeHeals = (game.heals || []).filter(h => h.active);
        if (activeHeals.length > 0) {
          const nearestHeal = activeHeals.sort((a, b) => dist(a.pos, bot.pos) - dist(b.pos, bot.pos))[0];
          if (nearestHeal && dist(bot.pos, nearestHeal.pos) < 750) {
            reassign(bot, 'ROAM', nearestHeal.pos);
          }
        }
      }
    }

    // 2. Nejvyšší priorita: Sebevražední bombardi blížící se ke svatyni
    const bombers = (game.minions || []).filter(m => !m.dead && m.isBomber && dist(m.pos, shrine.pos) < 800)
      .sort((a, b) => dist(a.pos, shrine.pos) - dist(b.pos, shrine.pos));

    for (let bomber of bombers) {
      if (unassigned.length === 0) break;
      const closestBot = unassigned.sort((a, b) => dist(a.pos, bomber.pos) - dist(b.pos, bomber.pos))[0];
      if (closestBot) {
        reassign(closestBot, 'HUNT', bomber);
      }
    }

    // 3. Priorita: Aktivní Boss / Miniboss v dosahu
    const bosses = (game.minions || []).filter(m => !m.dead && m.isBoss)
      .sort((a, b) => dist(a.pos, shrine.pos) - dist(b.pos, shrine.pos));
    if (bosses.length > 0) {
      const boss = bosses[0];
      for (let b of [...unassigned]) {
        if (dist(b.pos, boss.pos) < 950) {
          reassign(b, 'HUNT', boss);
        }
      }
    }

    // 4. Obrana svatyně: jakékoliv monstrum v dosahu 450 px od svatyně
    const shrineThreats = (game.minions || []).filter(m => !m.dead && m.team === 1 && dist(m.pos, shrine.pos) < 450)
      .sort((a, b) => dist(a.pos, shrine.pos) - dist(b.pos, shrine.pos));

    for (let threat of shrineThreats) {
      if (unassigned.length === 0) break;
      const b = unassigned.sort((a, b) => dist(a.pos, threat.pos) - dist(b.pos, threat.pos))[0];
      if (b) reassign(b, 'HUNT', threat);
    }

    // 5. Ostatní boti: hunt nejbližšího nepřítele nebo hlídkování u svatyně
    for (let b of [...unassigned]) {
      const nearbyMonster = (game.minions || []).filter(m => !m.dead && m.team === 1 && dist(m.pos, b.pos) < 700)
        .sort((a, b) => dist(a.pos, b.pos) - dist(b.pos, b.pos))[0];
      if (nearbyMonster) {
        reassign(b, 'HUNT', nearbyMonster);
      } else {
        const seed = parseInt(b.id, 36) || 1;
        const offsetAngle = (seed * 2.1) % (Math.PI * 2);
        const guardTarget = {
          pos: {
            x: shrine.pos.x + Math.cos(offsetAngle) * 160,
            y: shrine.pos.y + Math.sin(offsetAngle) * 160,
          }
        };
        reassign(b, 'DEFEND', guardTarget);
      }
    }
  },
};
`;

if (!content.includes('HordeBrain')) {
  fs.writeFileSync(filePath, content + hordeBrainCode, 'utf8');
  console.log('HordeBrain appended successfully.');
} else {
  console.log('HordeBrain already exists.');
}
