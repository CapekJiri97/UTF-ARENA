const fs = require('fs');
const path = require('path');

function loadExportedConst(filePath, constName) {
  let src = fs.readFileSync(filePath, 'utf8');
  // Replace any "export const" declarations to plain "const" so file can be evaluated safely
  src = src.replace(/export const/g, 'const');
  const wrapper = `(function(){ ${src}; return ${constName}; })()`;
  return eval(wrapper);
}

const repoRoot = path.join(__dirname, '..');
const classesPath = path.join(repoRoot, 'classes.js');
const itemsPath = path.join(repoRoot, 'items.js');

const CLASSES = loadExportedConst(classesPath, 'CLASSES');
const shopItems = loadExportedConst(itemsPath, 'shopItems');

// Utility: parse AA_SCALES from classes.js
function loadAAScales() {
  const src = fs.readFileSync(classesPath, 'utf8');
  const m = src.match(/export const AA_SCALES = \{([\s\S]*?)\};/);
  if (!m) return {};
  const body = '{' + m[1] + '}';
  return eval('(' + body + ')');
}

const AA_SCALES = loadAAScales();

const TARGETS = {
  squishy: { hp: 600, armor: 18, mr: 18 },
  skirmisher: { hp: 850, armor: 28, mr: 25 },
  frontline: { hp: 1200, armor: 45, mr: 45 },
  support: { hp: 700, armor: 22, mr: 28 }
};

function phaseForScenario(level, itemCount) {
  if (level <= 2 && itemCount <= 1) return 'early';
  if (level <= 6 || itemCount <= 3) return 'mid';
  return 'late';
}

function spellDamage(sp, AD, AP) {
  const base = sp.baseDamage || 0;
  const dmg = Math.round(base + (AP * (sp.scaleAP||0)) + (AD * (sp.scaleAD||0)) + (sp.level||0)*8);
  return dmg;
}

function damageMultiplierFor(type, target) {
  const arm = target.armor || 0; const mr = target.mr || 0;
  if (type === 'physical') return 100 / (100 + arm);
  if (type === 'magical') return 100 / (100 + mr);
  return 1.0;
}

function effectiveHP(target, dmgType) {
  const mult = damageMultiplierFor(dmgType, target);
  return Math.round(target.hp / mult);
}

// Simple strategy: offensive items: AD for physical, AP for magical, AS items convert to attackSpeed
function applyItemsToStats(className, itemCount) {
  const base = CLASSES[className];
  let AD = base.baseAD || 0;
  let AP = base.baseAP || 0;
  let attackSpeed = 1.0;
  if (CLASSES[className].dmgType === 'physical') {
    let asItems = Math.floor(itemCount/3);
    let adItems = itemCount - asItems;
    AD += 15 * adItems;
    attackSpeed += 0.20 * asItems;
  } else {
    AP += 15 * itemCount;
  }
  return {AD, AP, attackSpeed};
}

function effectiveSurvivability(hp, armor, mr) {
  const phys = effectiveHP({ hp, armor, mr }, 'physical');
  const magic = effectiveHP({ hp, armor, mr }, 'magical');
  return (phys + magic) / 2;
}

function analyze() {
  const levels = [1,5,10];
  const itemCounts = [0,1,3,6];
  const report = [];

  for (const className of Object.keys(CLASSES)) {
    for (const L of levels) {
      for (const items of itemCounts) {
        const base = CLASSES[className];
        const phase = phaseForScenario(L, items);
        const levelBonusHp = 15 * (L-1);
        const lvlHp = base.hp + levelBonusHp;
        const lvlAD = (base.baseAD || 0) + (L-1) * 1;
        const lvlAP = (base.baseAP || 0) + (L-1) * 1;

        const it = applyItemsToStats(className, items);
        const aa = AA_SCALES[className] || 0.3;
        
        let pAD = lvlAD + (it.AD - (base.baseAD||0));
        let pAP = lvlAP + (it.AP - (base.baseAP||0));
        let pAS = it.attackSpeed;

        const q = base.Q || null; const e = base.E || null;
        let spellLvl = L === 1 ? 1 : (L === 5 ? 3 : 5);

        // Pre-calculate active buffs from abilities
        if (q && q.type === 'hana_q') pAS *= 1.25;
        if (e && e.type === 'buff_ad_as') { pAD *= 1.25; pAS *= 1.25; }

        let basicDmg = Math.round(base.baseAtk + ((base.dmgType === 'magical' ? pAP : pAD) * aa));
        if (q && q.type === 'hana_q') basicDmg += Math.round(lvlHp * 0.03);
        
        const atkPerSec = pAS / base.attackDelay;
        const basicDPS = basicDmg * atkPerSec;

        let spellDPS = 0;
        let spellHPS = 0;
        let burstDmg = basicDmg;
        let utilityScore = 0;
        let summonDPS = 0;
        let summonHPS = 0;

        function evalSpell(sp) {
          if (!sp) return;
          let cd = Math.max(1.0, sp.baseCooldown);
          const scLvlDmg = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
          let dmg = Math.round((sp.baseDamage||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + spellLvl*scLvlDmg);
          
          burstDmg += dmg;
          spellDPS += (dmg / cd);

          if (sp.type && sp.type.includes('heal')) {
              const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 10;
              let heal = (sp.amount||0) + (pAP * (sp.scaleAP||0)) + (pAD * (sp.scaleAD||0)) + spellLvl*scLvlHeal;
              spellHPS += (heal / cd);
          }
          if (sp.type === 'hana_q') {
              const scLvlRegen = sp.scaleLevel !== undefined ? sp.scaleLevel : 2;
              let regen = 5 + (pAP * 0.1) + spellLvl*scLvlRegen;
              spellHPS += regen;
          }
          
          // Shields -> Utility
          if (sp.amount && (sp.type.includes('shield') || sp.type.includes('reaper_e'))) {
              const scLvlShield = sp.scaleLevel !== undefined ? sp.scaleLevel : 20;
              utilityScore += ((sp.amount||0) + (pAP*(sp.scaleAP||0)) + (pAD*(sp.scaleAD||0)) + spellLvl*scLvlShield) / cd;
          }
          if (sp.shieldAmount) { // Special case for buff_ad_as
              const scLvlShield = sp.scaleLevel !== undefined ? sp.scaleLevel : 15;
              utilityScore += (sp.shieldAmount + (pAD*0.3) + spellLvl*scLvlShield) / cd;
          }

          // Summons
          if (sp.type === 'summon') summonDPS += (((dmg * 0.4) / 1.2) * (sp.count||1)) * (8 / cd);
          if (sp.type === 'tamer_q') {
              // Wolf persistent companion — scales with owner AP and level
              const wolfAD = Math.round(22 + pAP * 0.42 + L * 5.5);
              const wolfAS = 1 / 1.2; // ~0.83 attacks/s (same as minion cooldown)
              summonDPS += wolfAD * wolfAS;
          }
          if (sp.type === 'projectile_summon') summonDPS += (((sp.summonAd || 50) + pAD * 0.2) / 1.2) * (8 / cd);
          if (sp.type === 'summon_healers') {
              const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 2;
              let healAmt = (sp.amount || 15) + pAP * (sp.scaleAP || 0) + spellLvl*scLvlHeal;
              let pulseDmg = 5 + pAP * 0.10;
              summonHPS += ((healAmt * 3) / 2) * (5 / cd); summonDPS += ((pulseDmg * 3) / 2) * (5 / cd);
          }
          if (sp.type === 'projectile_egg') {
              const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 4;
              summonHPS += (((sp.amount || 25) + pAP * (sp.scaleAP || 0) + spellLvl*scLvlHeal) / 2.0) * (6 / cd);
              summonDPS += (10 + pAP * 0.15) * (6 / cd);
          }

          // Special scaling
          if (sp.type === 'reaper_q') spellDPS += (dmg * 3) / cd;
          if (sp.type === 'spin_to_win') {
              let ticks = (sp.duration || 2.5) / (sp.tickRate || 0.25);
              spellDPS += (dmg * ticks) / cd;
              burstDmg += dmg * ticks;
          }
          if (sp.type === 'omnislash') {
              spellDPS += (dmg * (sp.count || 5)) / cd;
              burstDmg += dmg * (sp.count || 5);
              utilityScore += 200 / cd; // Invulnerability is very strong
              utilityScore += 80 / cd; // Dash mobility
          }
          if (sp.type === 'projectile_pull') {
              spellDPS += dmg / cd;
              burstDmg += dmg;
              utilityScore += 150 / cd; // Huge utility for displacement
          }
          if (sp.type === 'shield_aoe') {
              const scLvlShield = sp.scaleLevel !== undefined ? sp.scaleLevel : 15;
              utilityScore += ((sp.amount||0) + (pAP*(sp.scaleAP||0)) + spellLvl*scLvlShield) / cd;
          }
          if (sp.type === 'heal_beam') {
              const scLvlHeal = sp.scaleLevel !== undefined ? sp.scaleLevel : 0.5;
              let heal = (sp.amount||0) + (pAP * (sp.scaleAP||0)) + spellLvl*scLvlHeal;
              let ticksPerSec = 1 / (sp.tickRate || 0.1);
              spellHPS += (heal * ticksPerSec); // Constant toggle, no cooldown dividing
              utilityScore += 50 / cd; // Healing utility
          }
          if (sp.type === 'ubercharge') {
              utilityScore += 300 / cd; // Invulnerability for 2 people is insane utility
          }

          // Hard CC & Utility Scores
          if (sp.stunDuration) utilityScore += (sp.stunDuration * 150) / cd;
          if (sp.silenceDuration) utilityScore += (sp.silenceDuration * 100) / cd;
          if (sp.slowDuration) utilityScore += (sp.slowDuration * 40) / cd;
          if (sp.type && sp.type.includes('knockback')) utilityScore += 100 / cd;
          if (sp.type && sp.type.includes('dash')) utilityScore += 80 / cd;
          if (sp.type === 'buff_ms') utilityScore += 80 / cd;
        }

        evalSpell(q); evalSpell(e);

        const totalDPS = basicDPS + spellDPS + summonDPS;
        const totalHPS = spellHPS + summonHPS;
        const survivability = effectiveSurvivability(lvlHp, base.baseArmor || 0, base.baseMR || 0);

        const phaseWeights = phase === 'early'
          ? { dps: 0.55, burst: 0.22, hps: 0.65, util: 1.90, surv: 0.012 }
          : phase === 'mid'
            ? { dps: 0.48, burst: 0.16, hps: 0.75, util: 1.75, surv: 0.014 }
            : { dps: 0.42, burst: 0.12, hps: 0.85, util: 1.60, surv: 0.016 };
        const phaseScore = (totalDPS * phaseWeights.dps) + (burstDmg * phaseWeights.burst) + (totalHPS * phaseWeights.hps) + (utilityScore * phaseWeights.util) + (survivability * phaseWeights.surv);
        const controlScore = (utilityScore * 1.4) + (totalHPS * 1.1) + (survivability * 0.008);

        const row = { className, level: L, items, phase, burstDmg: Number(burstDmg.toFixed(1)), basicDPS: Number(basicDPS.toFixed(1)), spellDPS: Number(spellDPS.toFixed(1)), summonDPS: Number(summonDPS.toFixed(1)), totalDPS: Number(totalDPS.toFixed(1)), hps: Number(totalHPS.toFixed(1)), utility: Number(utilityScore.toFixed(1)), survivability: Number(survivability.toFixed(1)), controlScore: Number(controlScore.toFixed(1)), phaseScore: Number(phaseScore.toFixed(1)) };

        row.ttk = {};
        for (const [targetName, target] of Object.entries(TARGETS)) {
          const targetHp = target.hp + 15 * (L - 1);
          const effHP = effectiveHP({ hp: targetHp, armor: target.armor, mr: target.mr }, base.dmgType);
          const ttk = totalDPS > 0 ? (effHP / totalDPS) : Infinity;
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
