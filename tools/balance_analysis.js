const fs = require('fs');
const path = require('path');

function loadExportedConst(filePath, constName) {
  let src = fs.readFileSync(filePath, 'utf8');
  src = src.replace(/export const/g, 'const');
  src = src.replace(/export function/g, 'function');
  const wrapper = `(function(){ ${src}; return ${constName}; })()`;
  return eval(wrapper);
}

const repoRoot = path.join(__dirname, '..');
const classesPath = path.join(repoRoot, 'classes.js');
const itemsPath = path.join(repoRoot, 'items.js');

const CLASSES = loadExportedConst(classesPath, 'CLASSES');
const shopItems = loadExportedConst(itemsPath, 'shopItems');

const TARGETS = {
  squishy:    { hp: 600,  armor: 18, mr: 18 },
  skirmisher: { hp: 850,  armor: 28, mr: 25 },
  frontline:  { hp: 1200, armor: 45, mr: 45 },
  support:    { hp: 700,  armor: 22, mr: 28 }
};

function phaseForScenario(level, itemCount) {
  if (level <= 2 && itemCount <= 1) return 'early';
  if (level <= 6 || itemCount <= 3) return 'mid';
  return 'late';
}

function damageMultiplierFor(type, target, pen) {
  const arm = target.armor || 0; const mr = target.mr || 0;
  const p = pen || 0;
  if (type === 'physical') return 100 / (100 + arm * (1 - p));
  if (type === 'magical')  return 100 / (100 + mr  * (1 - p));
  return 1.0;
}

function effectiveHP(target, dmgType, pen) {
  const mult = damageMultiplierFor(dmgType, target, pen || 0);
  return Math.round(target.hp / mult);
}

// Simulate realistic item builds for each champion using the ACTUAL item system.
// Budget is 6 item slots (max per rules). Items cost 250-525+. We model a
// standard spend of: heavy power → then utility → then def.
// Returns stat deltas ON TOP of base stats.
function applyItemsToStats(className, itemCount) {
  const base = CLASSES[className];
  const baseAD = base.baseAD || 0;
  const baseAP = base.baseAP || 0;
  const baseArmor = base.baseArmor || 0;
  const baseMR   = base.baseMR   || 0;

  let AD = baseAD;
  let AP = baseAP;
  let armor = baseArmor;
  let mr    = baseMR;
  let attackSpeed = 1.0;
  let hp = base.hp || 1000;
  let abilityHaste = 0;
  let adaptivePen = 0;
  let lifesteal = 0;
  let healPower = 0;
  let onHitSlow = 0;

  if (itemCount === 0) {
    return { AD, AP, armor, mr, attackSpeed, hp, abilityHaste, adaptivePen, lifesteal, healPower, onHitSlow };
  }

  // Item priority weights by role / dmgType
  const isPhys  = base.dmgType === 'physical';
  const isMagic = base.dmgType === 'magical';
  const role    = base.role || '';

  // Build a priority list of items to buy in order
  // Typical builds by role:
  //   TANK/FIGHTER: 2× power, 1× HP, 1× armor, 1× MR, 1× haste
  //   SLAYER phys : 3× power, 1× AS, 1× HP, 1× pen
  //   SLAYER mag  : 3× power, 1× HP, 1× haste, 1× pen
  //   SUPPORT     : 1× power, 2× haste, 1× HP, 1× heal_power, 1× slow
  //   MAGE        : 3× power, 1× HP, 1× haste, 1× pen
  //   SPLITPUSHER : 2× power, 1× AS, 1× MS, 1× HP, 1× pen

  const powerItem  = isPhys ? 'basic_power' : 'basic_power'; // adaptive
  const hpItem     = 'basic_hp';
  const armorItem  = 'basic_armor';
  const mrItem     = 'basic_mr';
  const hasteItem  = 'basic_haste';
  const asItem     = 'basic_as';
  const penItem    = 'special_pen';
  const lsItem     = 'special_lifesteal';
  const healPwItem = 'special_heal_power';
  const msItem     = 'special_movespeed';
  const slowItem   = 'special_slow';

  let queue = [];
  if (role === 'TANK') {
    queue = [powerItem, hpItem, armorItem, mrItem, hasteItem, hpItem];
  } else if (role === 'FIGHTER') {
    queue = [powerItem, penItem, powerItem, hpItem, hasteItem, lsItem];
  } else if (role === 'SLAYER' && isPhys) {
    queue = [powerItem, penItem, powerItem, asItem, hpItem, powerItem];
  } else if (role === 'SLAYER' && isMagic) {
    queue = [powerItem, penItem, powerItem, hpItem, hasteItem, powerItem];
  } else if (role === 'MAGE') {
    queue = [powerItem, penItem, powerItem, hpItem, hasteItem, powerItem];
  } else if (role === 'SUPPORT') {
    queue = [powerItem, hasteItem, hpItem, healPwItem, slowItem, hasteItem];
  } else if (role === 'SPLITPUSHER') {
    queue = [powerItem, penItem, powerItem, asItem, hpItem, msItem];
  } else {
    queue = [powerItem, penItem, powerItem, hpItem, hasteItem, armorItem];
  }

  const bought = queue.slice(0, itemCount);

  // Counts per item id for stepped costs (not used for stats, just tracking)
  const counts = {};
  for (const id of bought) {
    counts[id] = (counts[id] || 0) + 1;
  }

  // Apply each item's stats
  const itemMap = {};
  for (const it of shopItems) itemMap[it.id] = it;

  for (const id of bought) {
    const it = itemMap[id];
    if (!it) continue;
    const s = it.stats || {};
    if (s.powerPct) {
      if (isMagic) AP = Math.round(AP + baseAP * s.powerPct);
      else         AD = Math.round(AD + baseAD * s.powerPct);
    }
    if (s.hpPct)    { const h = Math.round((base.hp) * s.hpPct); hp += h; }
    if (s.armorPct) armor = Math.round(armor + baseArmor * s.armorPct);
    if (s.mrPct)    mr    = Math.round(mr    + baseMR    * s.mrPct);
    if (s.ahFlat)   abilityHaste += s.ahFlat;
    if (s.asPct)    attackSpeed  += s.asPct;
    if (s.penPct)   adaptivePen = Math.min(0.60, adaptivePen + s.penPct);
    if (s.lifestealPct) lifesteal = Math.min(0.25, lifesteal + s.lifestealPct);
    if (s.healPower)    healPower = Math.min(0.45, healPower + s.healPower);
    if (s.slowOnHit)    onHitSlow = Math.min(0.30, onHitSlow + s.slowOnHit);
  }

  return { AD, AP, armor, mr, attackSpeed, hp, abilityHaste, adaptivePen, lifesteal, healPower, onHitSlow };
}

function effectiveSurvivability(hp, armor, mr) {
  const phys  = effectiveHP({ hp, armor, mr }, 'physical');
  const magic = effectiveHP({ hp, armor, mr }, 'magical');
  return (phys + magic) / 2;
}

function analyze() {
  const levels = [1, 5, 10, 15];
  const itemCounts = [0, 1, 3, 6, 9];
  const report = [];

  for (const className of Object.keys(CLASSES)) {
    for (const L of levels) {
      for (const items of itemCounts) {
        const base = CLASSES[className];
        const phase = phaseForScenario(L, items);

        const lvlHPGain    = base.lvlHP    ?? 15;
        const lvlArmorGain = base.lvlArmor ?? 0.5;
        const lvlMRGain    = base.lvlMR    ?? 0.5;
        const lvlPwrGain   = base.lvlPower ?? 1.0;
        const lvlAtkGain   = base.lvlAtk   ?? 0.5;

        const levelBonusHp    = lvlHPGain * (L - 1);
        const levelBonusArmor = lvlArmorGain * (L - 1);
        const levelBonusMR    = lvlMRGain * (L - 1);
        const lvlAD = (base.baseAD || 0) + (L - 1) * lvlPwrGain;
        const lvlAP = (base.baseAP || 0) + (L - 1) * lvlPwrGain;
        const lvlBaseAtk = (base.baseAtk || 0) + (L - 1) * lvlAtkGain;

        const it = applyItemsToStats(className, items);
        const aaScale = base.aaScale || 0.3;

        // Items already include base stats; compute deltas for level-scaled totals
        let totalAD   = lvlAD + (it.AD   - (base.baseAD   || 0));
        let totalAP   = lvlAP + (it.AP   - (base.baseAP   || 0));
        let totalAS   = it.attackSpeed;
        let totalHP   = it.hp + levelBonusHp;
        let totalArmor = it.armor + levelBonusArmor;
        let totalMR   = it.mr + levelBonusMR;
        let totalAH   = it.abilityHaste || 0;
        const pen     = it.adaptivePen || 0;
        const ls      = it.lifesteal   || 0;
        const hp_pw   = it.healPower   || 0;
        const slowHit = it.onHitSlow   || 0;

        // Ability haste reduces effective cooldowns (AH = 0 → 1.0×, AH = 60 → 0.625×)
        const cdMult = 100 / (100 + totalAH);

        const q = base.Q || null;
        const e = base.E || null;
        let spellLvl = L === 1 ? 1 : (L === 5 ? 3 : (L === 10 ? 5 : 7));

        // Pre-apply passive buffs that affect base AA stats
        if (q && q.type === 'hana_q') totalAS *= (q.bonusAsMult || 1.25);
        if (e && e.type === 'buff_ad_as') { totalAD *= 1.25; totalAS *= 1.25; }

        let powerStat = base.dmgType === 'magical' ? totalAP : totalAD;
        let basicDmg  = Math.round(lvlBaseAtk + (aaScale * powerStat));
        if (q && q.type === 'hana_q') basicDmg += Math.round(totalHP * (q.bonusHpDmg || 0.027));

        const atkPerSec = totalAS / base.attackDelay;
        const basicDPS  = basicDmg * atkPerSec;

        let spellDPS = 0;
        let spellHPS = 0;
        let burstDmg = basicDmg;
        let utilityScore = 0;
        let summonDPS = 0;
        let summonHPS = 0;

        function evalSpell(sp) {
          if (!sp) return;
          const rawCd = Math.max(1.0, sp.baseCooldown || 1.0);
          const cd    = rawCd * cdMult;
          const scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;

          let dmg = Math.round(
            (sp.baseDamage || 0) +
            (spellLvl * scLvl) +
            (totalAP * (sp.scaleAP || 0)) +
            (totalAD * (sp.scaleAD || 0))
          );

          burstDmg += dmg;
          spellDPS  += (dmg / cd);

          // Healing spells
          if (sp.type && sp.type.includes('heal')) {
            const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 10;
            let heal = ((sp.amount || 0) + (totalAP * (sp.scaleAP || 0)) + (totalAD * (sp.scaleAD || 0)) + spellLvl * scLvlHeal) * (1 + hp_pw);
            spellHPS += (heal / cd);
          }
          if (sp.type === 'hana_q') {
            const scLvlRegen = sp.scaleLevel !== undefined ? sp.scaleLevel : 2;
            let regen = (5 + totalAP * 0.1 + spellLvl * scLvlRegen) * (1 + hp_pw);
            spellHPS += regen;
          }

          // Shields → Utility
          if (sp.amount && sp.type && (sp.type.includes('shield') || sp.type === 'reaper_e')) {
            const scLvlShield = sp.scaleLevel !== undefined ? sp.scaleLevel : 20;
            utilityScore += ((sp.amount || 0) + (totalAP * (sp.scaleAP || 0)) + (totalAD * (sp.scaleAD || 0)) + spellLvl * scLvlShield) / cd;
          }
          if (sp.shieldAmount) {
            const scLvlShield = sp.scaleLevel !== undefined ? sp.scaleLevel : 15;
            utilityScore += (sp.shieldAmount + (totalAD * 0.3) + spellLvl * scLvlShield) / cd;
          }

          // Summons
          if (sp.type === 'summon') {
            const gDmg = Math.round((sp.baseDamage || 0) + spellLvl * scLvl + totalAP * (sp.scaleAP || 0));
            summonDPS += (((gDmg * 0.4) / 1.2) * (sp.count || 1)) * ((sp.spawnDeathTimer || 8) / cd);
          }
          if (sp.type === 'tamer_q') {
            const wolfAD  = Math.round(22 + totalAP * 0.42 + L * 5.5);
            const wolfAS  = 1 / 1.2;
            summonDPS += wolfAD * wolfAS;
          }
          if (sp.type === 'projectile_summon') {
            summonDPS += (((sp.summonAd || 30) + totalAD * 0.2) / 1.2) * ((sp.spawnDeathTimer || 6) / cd);
          }
          if (sp.type === 'summon_healers') {
            const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 2;
            let healAmt = ((sp.amount || 5) + totalAP * (sp.scaleAP || 0) + spellLvl * scLvlHeal) * (1 + hp_pw);
            let pulseDmg = 5 + totalAP * 0.10;
            summonHPS += ((healAmt * 3) / 2) * (5 / cd);
            summonDPS += ((pulseDmg * 3) / 2) * (5 / cd);
          }
          if (sp.type === 'projectile_egg') {
            const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 4;
            summonHPS += (((sp.amount || 5) + totalAP * (sp.scaleAP || 0) + spellLvl * scLvlHeal) / 2.0) * (6 / cd) * (1 + hp_pw);
            summonDPS += (10 + totalAP * 0.15) * (6 / cd);
          }

          // Special mechanics
          if (sp.type === 'reaper_q') spellDPS += (dmg * 3) / cd;

          if (sp.type === 'spin_to_win') {
            let ticks = (sp.duration || 2.0) / (sp.tickRate || 0.25);
            spellDPS  += (dmg * ticks) / cd;
            burstDmg  += dmg * ticks;
          }
          if (sp.type === 'omnislash') {
            const cnt = sp.count || 5;
            spellDPS += (dmg * cnt) / cd;
            burstDmg += dmg * cnt;
            utilityScore += 200 / cd; // pseudo-invulnerability
            utilityScore += 80  / cd; // dash mobility
          }
          if (sp.type === 'projectile_pull') {
            spellDPS  += dmg / cd;
            burstDmg  += dmg;
            utilityScore += 150 / cd;
          }
          if (sp.type === 'shield_aoe') {
            const scLvlShield = sp.scaleLevel !== undefined ? sp.scaleLevel : 15;
            utilityScore += ((sp.amount || 0) + (totalAP * (sp.scaleAP || 0)) + spellLvl * scLvlShield) / cd;
          }
          if (sp.type === 'heal_beam') {
            const ticksPerSec = 1 / (sp.tickRate || 0.1);
            const heal = ((sp.amount || 0) + totalAP * (sp.scaleAP || 0) + spellLvl * (sp.scaleLevel || 0.5)) * (1 + hp_pw);
            spellHPS += heal * ticksPerSec;
            utilityScore += 50 / cd;
          }
          if (sp.type === 'ubercharge') {
            utilityScore += 300 / cd;
          }
          if (sp.type === 'dash_heal_silence') {
            const healAmt = ((sp.amount || 0) + spellLvl * scLvl) * (1 + hp_pw);
            spellHPS += healAmt / cd;
          }
          if (sp.type === 'shield_explode') {
            const shAmt = (sp.amount || 0) + spellLvl * scLvl;
            utilityScore += shAmt / cd;
          }
          if (sp.type === 'flamethrower') {
            // baseDamage is total over duration; already counted in spellDPS above once
            // but flamethrower's baseDamage is full channel, so no double count needed
          }

          // Buffs
          if (sp.type === 'buff_ms') utilityScore += 80 / cd;

          // CC scoring (now using AH-adjusted cd)
          if (sp.stunDuration)    utilityScore += (sp.stunDuration    * 150) / cd;
          if (sp.silenceDuration) utilityScore += (sp.silenceDuration * 100) / cd;
          if (sp.slowDuration)    utilityScore += (sp.slowDuration    *  40) / cd;
          if (sp.pullToCaster)    utilityScore += 120 / cd;
          if (sp.type && sp.type.includes('knockback')) utilityScore += 100 / cd;
          if (sp.type && sp.type.includes('dash'))      utilityScore +=  80 / cd;

          // On-hit slow from items (add to utility)
          if (slowHit > 0) utilityScore += slowHit * 30;
        }

        evalSpell(q);
        evalSpell(e);

        // Lifesteal sustain: add to HPS as fraction of DPS
        spellHPS += basicDPS * ls;

        const totalDPS  = basicDPS + spellDPS + summonDPS;
        const totalHPS  = spellHPS + summonHPS;
        const survivability = effectiveSurvivability(totalHP, totalArmor, totalMR);

        const phaseWeights = phase === 'early'
          ? { dps: 0.55, burst: 0.22, hps: 0.65, util: 1.90, surv: 0.012 }
          : phase === 'mid'
            ? { dps: 0.48, burst: 0.16, hps: 0.75, util: 1.75, surv: 0.014 }
            : { dps: 0.42, burst: 0.12, hps: 0.85, util: 1.60, surv: 0.016 };

        const phaseScore   = (totalDPS * phaseWeights.dps)   + (burstDmg   * phaseWeights.burst) +
                             (totalHPS * phaseWeights.hps)   + (utilityScore * phaseWeights.util) +
                             (survivability * phaseWeights.surv);
        const controlScore = (utilityScore * 1.4) + (totalHPS * 1.1) + (survivability * 0.008);

        const row = {
          className, level: L, items, phase,
          burstDmg:      Number(burstDmg.toFixed(1)),
          basicDPS:      Number(basicDPS.toFixed(1)),
          spellDPS:      Number(spellDPS.toFixed(1)),
          summonDPS:     Number(summonDPS.toFixed(1)),
          totalDPS:      Number(totalDPS.toFixed(1)),
          hps:           Number(totalHPS.toFixed(1)),
          utility:       Number(utilityScore.toFixed(1)),
          survivability: Number(survivability.toFixed(1)),
          controlScore:  Number(controlScore.toFixed(1)),
          phaseScore:    Number(phaseScore.toFixed(1)),
          abilityHaste:  Number(totalAH.toFixed(0)),
          pen:           Number((pen * 100).toFixed(0))
        };

        row.ttk = {};
        for (const [targetName, target] of Object.entries(TARGETS)) {
          const targetHp = target.hp + 15 * (L - 1);
          const effHP    = effectiveHP({ hp: targetHp, armor: target.armor, mr: target.mr }, base.dmgType, pen);
          const ttk      = totalDPS > 0 ? (effHP / totalDPS) : Infinity;
          row.ttk[targetName] = Number(ttk.toFixed(2));
        }

        report.push(row);
      }
    }
  }

  fs.writeFileSync(path.join(repoRoot, 'balance_report.json'), JSON.stringify(report, null, 2));
  console.log('Report written to balance_report.json');
}

analyze();
