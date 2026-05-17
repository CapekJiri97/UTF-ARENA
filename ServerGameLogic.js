// ServerGameLogic.js — Server-side authoritative game logic
// Factory: createServerLogic(io, roomName, game, getActiveMode) → { applyDamage, applyHeal, ... }

import { getShopItem, canBuyShopItem, getItemBuyCost } from './items.js';
import { dist } from './Utils.js';
import { CLASSES } from './classes.js';

const _MINION_EXP_PCT = [1.0, 0.75, 0.50, 0.33, 0.25];

export function createServerLogic(io, roomName, game, getActiveMode) {
  const emit = (event, data) => io.to(roomName).emit(event, data);

  // ──────────────────────────────────────────────────────── recalcPlayerItemStats
  function recalcPlayerItemStats(pl) {
    const cData = CLASSES[pl.className];
    if (!cData) return;
    const hpFrac = pl.maxHp > 0 ? Math.max(0, Math.min(1, pl.hp / pl.maxHp)) : 1;
    pl.AD           = pl.baseAD_stat    !== undefined ? pl.baseAD_stat    : cData.baseAD;
    pl.AP           = pl.baseAP_stat    !== undefined ? pl.baseAP_stat    : cData.baseAP;
    pl.attackSpeed  = 1.0;
    pl.abilityHaste = 0;
    pl.armor        = pl.baseArmor_stat !== undefined ? pl.baseArmor_stat : cData.baseArmor;
    pl.mr           = pl.baseMR_stat    !== undefined ? pl.baseMR_stat    : cData.baseMR;
    pl.maxHp        = pl.baseMaxHp      !== undefined ? pl.baseMaxHp      : cData.hp;
    pl.hpRegen      = cData.hpRegen || 2.0;
    pl.lifesteal    = 0; pl.antiHeal  = 0; pl.onHitSlow = 0; pl.onSpellHitSlow = 0;
    pl.adaptivePen  = 0; pl.armorPenFlat = 0; pl.magicPenFlat = 0;
    pl.titanSigilSpellDmg = 0; pl.titanSigilCd = pl.titanSigilCd || 0;
    pl.aoeBurnPct   = 0; pl.strikeBurnPct = 0; pl.healPower = 0; pl.shieldOnHit = 0;
    pl.speed        = cData.speed + 40 + (cData.range && cData.role !== 'SUPPORT' ? 5 : 0);

    for (const itemId of (pl.items || [])) {
      const it = getShopItem(itemId);
      if (it && it.apply) it.apply(pl);
    }
    if (pl.diffBonusHP || pl.diffBonusAD || pl.diffBonusAP || pl.diffBonusArmor || pl.diffBonusMR) {
      pl.maxHp  += (pl.diffBonusHP    || 0);
      pl.AD     += (pl.diffBonusAD    || 0);
      pl.AP     += (pl.diffBonusAP    || 0);
      pl.armor  += (pl.diffBonusArmor || 0);
      pl.mr     += (pl.diffBonusMR    || 0);
    }
    pl.hp = Math.min(pl.maxHp, Math.max(1, Math.round(hpFrac * pl.maxHp)));
  }

  // ──────────────────────────────────────────────────────── grantRewards
  function grantRewards(targetPlayer, baseGold, baseExp) {
    if (!targetPlayer) return;
    let totalLevel = 0, count = 0;
    for (let p of game.players) { if (p.team >= 0) { totalLevel += p.level; count++; } }
    const avgLevel = count > 0 ? totalLevel / count : 1;
    let mult = 1.0;
    if (targetPlayer.level >= avgLevel + 2) mult = 0.5;
    else if (targetPlayer.level <= avgLevel - 2) mult = 1.5;
    const finalGold = Math.round(baseGold * mult);
    const finalExp  = Math.round(baseExp  * mult);
    targetPlayer.gold      += finalGold;
    targetPlayer.totalGold += finalGold;
    targetPlayer.exp       += finalExp;
    targetPlayer.totalExp   = (targetPlayer.totalExp || 0) + finalExp;
    // Bot auto-buy — BotPlayer.botBuyItems calls recalcPlayerItemStats via gc
    if (targetPlayer._isBotPlayer) {
      const botEnemies = game.players.filter(p => p.team !== targetPlayer.team);
      targetPlayer.constructor.botBuyItems(targetPlayer, botEnemies);
    }
  }

  // ──────────────────────────────────────────────────────── grantMinionKillRewards
  function grantMinionKillRewards(killer, minionPos) {
    if (!killer) return;
    let totalLevel = 0, pCount = 0;
    for (const p of game.players) { if (p.team >= 0) { totalLevel += p.level; pCount++; } }
    const avgLevel = pCount > 0 ? totalLevel / pCount : 1;
    const snowMult = (pl) => pl.level >= avgLevel + 2 ? 0.5 : pl.level <= avgLevel - 2 ? 1.5 : 1.0;
    const activeGameMode = getActiveMode();
    const nearby = game.players.filter(p => p.alive && p.team === killer.team && dist(p.pos, minionPos) <= 300);
    const recipients = nearby.length > 0 ? nearby : [killer];
    const pct = _MINION_EXP_PCT[Math.min(recipients.length - 1, _MINION_EXP_PCT.length - 1)];
    const modeMult = (activeGameMode && activeGameMode.name === 'arena') ? 1.5 : 1.0;
    for (const p of recipients) {
      const m = snowMult(p) * modeMult;
      const prevGold = p.gold;
      p.gold      += Math.round(8  * pct * m);
      p.totalGold += Math.round(8  * pct * m);
      p.exp       += Math.round(11 * pct * m);
      p.totalExp   = (p.totalExp || 0) + Math.round(11 * pct * m);
      if (p._isBotPlayer && prevGold < 250 && p.gold >= 250) {
        const botEnemies = game.players.filter(e => e.team !== p.team);
        p.constructor.botBuyItems(p, botEnemies);
      }
    }
  }

  // ──────────────────────────────────────────────────────── applyHeal
  function applyHeal(target, amount) {
    if (!target || target.dead || target.hp <= 0) return 0;
    if ((target.antiHealTimer || 0) > 0 && (target.antiHealStrength || 0) > 0) {
      amount *= (1 - target.antiHealStrength);
    }
    if (amount <= 0) return 0;
    const oldHp = target.hp;
    target.hp = Math.min(target.effectiveMaxHp || target.maxHp, target.hp + amount);
    const actualHeal = Math.round(target.hp - oldHp);
    if (actualHeal > 0 && target.className) {
      emit('network_host_event', { type: 'player_hp_update', id: target.id, hp: target.hp, shield: target.shield });
    }
    return actualHeal;
  }

  // ──────────────────────────────────────────────────────── applyDamage
  function applyDamage(target, amount, type, sourceId, isNetwork = false, isSpell = false, isAoE = false) {
    if (!target || target.dead || target.hp <= 0) return 0;
    if (target.invulnerableTimer > 0 && type !== 'true') return 0;

    const sourceEntity = game.players.find(p => p.id === sourceId) || game.minions.find(m => m.id === sourceId);

    // LoL tower aggro
    if (sourceEntity && sourceEntity.className) {
      for (const tower of game.towers) {
        if (!tower.dead && tower.owner >= 0 && tower.owner !== sourceEntity.team) {
          if (dist(sourceEntity.pos, tower.pos) <= tower.attackRange && target && target.team === tower.owner) {
            tower._aggroTarget = sourceEntity;
          }
        }
      }
    }

    let arm = target.armor || 0, mr = target.mr || 0;
    if (target.hasPowerup)        { arm *= 1.2; mr *= 1.2; }
    if (target.boostTimer > 0)    { arm *= 1.1; mr *= 1.1; }
    if (target.jungleTankTimer > 0){ arm *= 1.1; mr *= 1.1; }
    if (target.defBuffTimer > 0)  { arm += 50;  mr += 50;  }
    if (sourceEntity) {
      const pen = sourceEntity.adaptivePen || 0;
      if (type === 'physical') arm = Math.round(arm * (1 - pen));
      else if (type === 'magical') mr = Math.round(mr * (1 - pen));
    }
    let multiplier = 1;
    if (type === 'physical') multiplier = 100 / (100 + arm);
    else if (type === 'magical') multiplier = 100 / (100 + mr);

    const actualDamage = Math.round(amount * multiplier);
    let finalDamage = actualDamage;

    if (target.shield > 0 && type !== 'true') {
      const sDmg = Math.min(target.shield, finalDamage);
      target.shield -= sDmg;
      finalDamage -= sDmg;
    }
    target.hp -= finalDamage;
    target.lastAttackerId = sourceId;

    // Titan's Sigil passive
    if (finalDamage > 0 && isSpell && (sourceEntity?.titanSigilSpellDmg || 0) > 0 &&
        (sourceEntity.titanSigilCd || 0) <= 0 && target.maxHp && type !== 'true') {
      const sigilBonus = Math.round(target.maxHp * sourceEntity.titanSigilSpellDmg);
      target.hp -= sigilBonus;
      sourceEntity.titanSigilCd = 2.0;
    }

    // Strike Burn DoT
    if ((sourceEntity?.strikeBurnPct || 0) > 0 && type !== 'true' && type !== 'dot' && target.maxHp && !target.isLocked) {
      const burnMult = (isSpell && isAoE) ? 0.5 : 1.0;
      target.burnDotTimer   = 2.0;
      target.burnDotTickDmg = (target.maxHp * sourceEntity.strikeBurnPct * burnMult) / 4.0;
      target.burnDotSource  = sourceId;
      if (!target.burnDotTick || target.burnDotTick <= 0) target.burnDotTick = 0.5;
    }

    target.flashTimer = 0.1;

    if (finalDamage > 0 || actualDamage > 0) {
      emit('network_host_event', { type: 'show_damage', targetId: target.id, amount: actualDamage, sourceId, dmgType: type });
    }

    // HP broadcast for player entities
    if (target.className && !isNetwork) {
      emit('network_host_event', { type: 'player_hp_update', id: target.id, hp: target.hp, shield: target.shield });
    }

    // Minion HP changed — mark dirty so _broadcastSlow picks up the new HP
    if (!target.className && finalDamage > 0) target._syncDirty = true;

    // Dead minion tracking
    if (!target.className && target.hp <= 0) {
      if (typeof target._handleJungleDeath === 'function') target._handleJungleDeath();
      if (!game.deadMinionIds) game.deadMinionIds = new Set();
      game.deadMinionIds.add(target.id);
    }

    // Lifesteal
    if (sourceEntity && sourceEntity.className && finalDamage > 0) {
      const sustain = type !== 'true' ? (sourceEntity.lifesteal || 0) : 0;
      if (sustain > 0) {
        const now = Date.now();
        if (!sourceEntity._svWin || now - sourceEntity._svWin.t > 50) {
          sourceEntity._svWin = { t: now, count: 0 };
        }
        sourceEntity._svWin.count++;
        const aoeMult = sourceEntity._svWin.count === 1 ? 1.0 : 0.2;
        const healed = applyHeal(sourceEntity, finalDamage * sustain * aoeMult);
        if (healed > 0 && sourceEntity.stats) sourceEntity.stats.hpHealed += healed;
      }
      if ((sourceEntity.antiHeal || 0) > 0) {
        target.antiHealTimer    = Math.max(target.antiHealTimer    || 0, 2.0);
        target.antiHealStrength = Math.max(target.antiHealStrength || 0, sourceEntity.antiHeal);
      }
    }

    // Stats tracking
    if (sourceEntity && sourceEntity.stats) {
      sourceEntity.stats.dmgDealt += actualDamage;
      if (target.className) sourceEntity.stats.dmgDealtToHeroes   = (sourceEntity.stats.dmgDealtToHeroes   || 0) + actualDamage;
      else                  sourceEntity.stats.dmgDealtToMinions  = (sourceEntity.stats.dmgDealtToMinions  || 0) + actualDamage;
    }
    if (target.stats) target.stats.dmgTaken += actualDamage;
    if (target.className && sourceEntity && sourceEntity.team !== target.team) {
      const existing = target.recentAttackers.get(sourceId);
      const now      = Date.now();
      const isRecent = existing && (now - existing.time < 10000);
      target.recentAttackers.set(sourceId, {
        time:   now,
        count:  isRecent ? existing.count  + 1          : 1,
        damage: isRecent ? existing.damage + actualDamage : actualDamage,
      });
    }
    return actualDamage;
  }

  // ──────────────────────────────────────────────────────── handlePlayerKill
  function handlePlayerKill(victim, killerId) {
    if (!victim || !victim.alive) return;
    victim.hp = 0;
    if (victim.die) victim.die(); else victim.dead = true;

    let killer = game.players.find(p => p.id === killerId);
    if (!killer || killer.team === victim.team) {
      let lastHeroAttackerId = null, lastTime = 0;
      const now = Date.now();
      if (victim.recentAttackers) {
        victim.recentAttackers.forEach((data, attackerId) => {
          const t = data.time || data;
          const p = game.players.find(x => x.id === attackerId);
          if (p && p.team !== victim.team && (now - t) < 10000 && t > lastTime) {
            lastTime = t; lastHeroAttackerId = attackerId;
          }
        });
      }
      if (lastHeroAttackerId) {
        killerId = lastHeroAttackerId;
        killer   = game.players.find(p => p.id === killerId);
      }
    }

    emit('network_host_event', { type: 'player_died', id: victim.id, killerId });

    const killerName = killer ? killer.className : (killerId === 'laser' ? 'Laser' : (killerId === 'tower' ? 'Tower' : 'Minion'));
    const killerTeam = killer ? killer.team : -1;
    const killData   = { killer: killerName, victim: victim.className || 'Player', killerTeam, victimTeam: victim.team, timer: 5.0 };
    if (game.killFeed) game.killFeed.push(killData);
    emit('network_kill_feed', killData);

    if (killer) {
      grantRewards(killer, 150, 50);
      killer.kills++;
      if (typeof killer.refreshDominionPCS === 'function') killer.refreshDominionPCS();
      game.nexus[victim.team] = Math.max(0, (game.nexus[victim.team] || 0) - 2);
      const activeGameMode = getActiveMode();
      if (typeof activeGameMode.onKill === 'function') activeGameMode.onKill(killer.team);
    }

    const now = Date.now();
    if (victim.recentAttackers) {
      victim.recentAttackers.forEach((data, attackerId) => {
        const t = data.time || data;
        if (attackerId !== killerId && (now - t) < 10000) {
          const assister = game.players.find(p => p.id === attackerId);
          if (assister && assister.team !== victim.team) {
            assister.assists++;
            grantRewards(assister, 50, 25);
            if (typeof assister.refreshDominionPCS === 'function') assister.refreshDominionPCS();
          }
        }
      });
      victim.recentAttackers.clear();
    }
  }

  // ──────────────────────────────────────────────────────── moveEntityWithCollision
  function moveEntityWithCollision(ent, vx, vy, dt) {
    const activeGameMode = getActiveMode();
    const { width, height } = activeGameMode.mapConfig.world;
    ent.pos.x += vx * dt; ent.pos.y += vy * dt;
    ent.pos.x = Math.max(ent.radius, Math.min(width  - ent.radius, ent.pos.x));
    ent.pos.y = Math.max(ent.radius, Math.min(height - ent.radius, ent.pos.y));

    const gridX = Math.floor(ent.pos.x / 200), gridY = Math.floor(ent.pos.y / 200);
    const nearbyWalls = game.wallGrid ? (game.wallGrid.get(gridX * 10000 + gridY) || []) : (game.walls || []);
    for (const w of nearbyWalls) {
      const info = _distToPoly(ent.pos.x, ent.pos.y, w.pts);
      if (info.inside) {
        const pushDist = info.minDist + w.r + ent.radius;
        ent.pos.x += info.closestNorm.x * pushDist;
        ent.pos.y += info.closestNorm.y * pushDist;
      } else if (info.minDist < w.r + ent.radius) {
        const pushDist = (w.r + ent.radius) - info.minDist;
        const dx = ent.pos.x - info.closestPt.x, dy = ent.pos.y - info.closestPt.y;
        const dl = Math.hypot(dx, dy);
        if (dl > 0) { ent.pos.x += (dx / dl) * pushDist; ent.pos.y += (dy / dl) * pushDist; }
        else { ent.pos.x += info.closestNorm.x * pushDist; ent.pos.y += info.closestNorm.y * pushDist; }
      }
    }

    // Map boundary polygon collision
    const _mb = activeGameMode.mapConfig.mapBoundary;
    const cx = width / 2, cy = height / 2;
    let isInside = _isPointInPoly(ent.pos.x, ent.pos.y, _mb);
    let minDistB = Infinity, closestB = null;
    for (let i = 0; i < _mb.length; i++) {
      const p1 = _mb[i], p2 = _mb[(i + 1) % _mb.length];
      const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
      const t  = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((ent.pos.x - p1.x) * (p2.x - p1.x) + (ent.pos.y - p1.y) * (p2.y - p1.y)) / l2));
      const clx = p1.x + t * (p2.x - p1.x), cly = p1.y + t * (p2.y - p1.y);
      const d = Math.hypot(ent.pos.x - clx, ent.pos.y - cly);
      if (d < minDistB) { minDistB = d; closestB = { x: clx, y: cly }; }
    }
    if (closestB && (!isInside || minDistB < ent.radius)) {
      let dx = ent.pos.x - closestB.x, dy = ent.pos.y - closestB.y;
      let d  = Math.hypot(dx, dy);
      if (d === 0) { dx = cx - ent.pos.x; dy = cy - ent.pos.y; d = Math.hypot(dx, dy); }
      if (isInside) { const push = ent.radius - minDistB; ent.pos.x += (dx / d) * push; ent.pos.y += (dy / d) * push; }
      else { ent.pos.x = closestB.x - (dx / d) * ent.radius; ent.pos.y = closestB.y - (dy / d) * ent.radius; }
    }
  }

  return { applyDamage, applyHeal, handlePlayerKill, moveEntityWithCollision, grantRewards, grantMinionKillRewards, recalcPlayerItemStats };
}

// ── Inline copies of Utils functions (to avoid import side-effects) ──
function _isPointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const intersect = ((pts[i].y > py) !== (pts[j].y > py)) &&
                      (px < (pts[j].x - pts[i].x) * (py - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x);
    if (intersect) inside = !inside;
  }
  return inside;
}

function _distToPoly(px, py, pts) {
  const inside = _isPointInPoly(px, py, pts);
  let minDist = Infinity, closestPt = null, closestNorm = null;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
    const t  = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2));
    const cx = p1.x + t * (p2.x - p1.x), cy = p1.y + t * (p2.y - p1.y);
    const d  = Math.hypot(px - cx, py - cy);
    if (d < minDist) {
      minDist = d; closestPt = { x: cx, y: cy };
      const nx = p2.y - p1.y, ny = -(p2.x - p1.x), nl = Math.hypot(nx, ny);
      closestNorm = { x: nx / nl, y: ny / nl };
    }
  }
  return { inside, minDist, closestPt, closestNorm };
}
