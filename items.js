// Adaptive Power helper — gives AD/AP as % of hero's base stat (cross-class safe)
export const addAdaptive = (pl, pct) => {
  if (pl.dmgType === 'magical') pl.AP = (pl.AP || 0) + Math.round((pl.baseAP_stat || 0) * pct);
  else pl.AD = (pl.AD || 0) + Math.round((pl.baseAD_stat || 0) * pct);
};

export const shopItems = [
  // ==========================================
  // 1. OFFENSE TREE (Marksman / Auto-Attack Carry)
  //    off_t1 → off_t2_as → off_t3_ls
  //                       → off_t3_pen
  //                       → off_t3_dance
  // ==========================================
  {
    id: 'off_t1', name: 'Iron Shard', desc: '+~10 Power, +5% AS, +5 AH', cost: 300,
    treeId: 'offense', treeBranch: 'core',
    stats: { power: 0.15, asPct: 0.05, ahFlat: 5 },
    apply: (pl) => { addAdaptive(pl, 0.15); pl.attackSpeed += 0.05; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'off_t2_as', name: 'Recurve Bow', desc: '+~25 Power, +20% AS', cost: 400,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t1',
    stats: { power: 0.45, asPct: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.45); pl.attackSpeed += 0.20; }
  },
  {
    // NERF: AS 30%→20%, LS 10%→8%
    id: 'off_t3_ls', name: 'Crimson Edge', desc: '+~50 Power, +20% AS, +8% Lifesteal', cost: 600,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.85, asPct: 0.20, lifestealPct: 0.08 },
    apply: (pl) => { addAdaptive(pl, 0.85); pl.attackSpeed += 0.20; pl.lifesteal = (pl.lifesteal || 0) + 0.08; }
  },
  {
    // NERF: power 0.95→0.80, pen 25%→20%
    id: 'off_t3_pen', name: 'Sundermark', desc: '+~45 Power, +20% AS, +20% Pen', cost: 500,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.80, asPct: 0.20, penPct: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.80); pl.attackSpeed += 0.20; pl.adaptivePen = (pl.adaptivePen || 0) + 0.20; }
  },
  {
    // NERF: power 1.05→0.85, armor 60%→50%, LS 15%→10%
    id: 'off_t3_dance', name: "Warborn Mantle", desc: '+~50 Power, +30% Base HP, +50% Base Armor, +10% Lifesteal', cost: 600,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.85, hpPct: 0.30, armorPct: 0.50, lifestealPct: 0.10 },
    apply: (pl) => {
      addAdaptive(pl, 0.85);
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.30); pl.maxHp += h; pl.hp += h;
      pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.50);
      pl.lifesteal = (pl.lifesteal || 0) + 0.10;
    }
  },

  // ==========================================
  // 2. SORCERY TREE (Mage / Ability Caster)
  // ==========================================
  {
    id: 'sorc_t1', name: 'Arcane Page', desc: '+~15 Power, +10 AH', cost: 300,
    treeId: 'sorcery', treeBranch: 'core',
    stats: { power: 0.20, ahFlat: 10 },
    apply: (pl) => { addAdaptive(pl, 0.20); pl.abilityHaste = (pl.abilityHaste || 0) + 10; }
  },
  {
    id: 'sorc_t2_ah', name: "Sage's Stone", desc: '+~35 Power, +15 AH', cost: 400,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t1',
    stats: { power: 0.50, ahFlat: 15 },
    apply: (pl) => { addAdaptive(pl, 0.50); pl.abilityHaste = (pl.abilityHaste || 0) + 15; }
  },
  {
    // NERF: power 0.85→0.70, AH 20→15, LS 10%→8%
    id: 'sorc_t3_vamp', name: 'Hextech Core', desc: '+~40 Power, +15 AH, +8% Lifesteal', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.70, ahFlat: 15, lifestealPct: 0.08 },
    apply: (pl) => { addAdaptive(pl, 0.70); pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.lifesteal = (pl.lifesteal || 0) + 0.08; }
  },
  {
    // NERF: power 0.70→0.60, AH 25→20, on-spell dmg 3%→2.5%; CD zůstává 2s z předchozí úpravy
    id: 'sorc_t3_burn', name: "Ember Catalyst", desc: '+~35 Power, +20 AH, +2.5% Max HP Spell Dmg', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.60, ahFlat: 20, spellDmg: 0.025 },
    apply: (pl) => { addAdaptive(pl, 0.60); pl.abilityHaste = (pl.abilityHaste || 0) + 20; pl.titanSigilSpellDmg = Math.max(pl.titanSigilSpellDmg || 0, 0.025); pl.titanSigilCd = 2.0; }
  },
  {
    // NERF: power 0.80→0.65, AH 15→10, slow 30%→25%
    id: 'sorc_t3_slow', name: "Glacial Sigil", desc: '+~37 Power, +10 AH, 25% Slow on Spells', cost: 500,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.65, ahFlat: 10, slowOnSpell: 0.25 },
    apply: (pl) => { addAdaptive(pl, 0.65); pl.abilityHaste = (pl.abilityHaste || 0) + 10; pl.onSpellHitSlow = Math.max(pl.onSpellHitSlow || 0, 0.25); }
  },

  // ==========================================
  // 3. TITAN TREE (Tank / Frontline)
  // ==========================================
  {
    id: 'titan_t1', name: 'Ruby Shard', desc: '+12% Base HP', cost: 300,
    treeId: 'titan', treeBranch: 'core',
    stats: { hpPct: 0.12 },
    apply: (pl) => { const b = Math.round((pl.baseMaxHp || pl.maxHp) * 0.12); pl.maxHp += b; pl.hp += b; }
  },
  {
    id: 'titan_t2_ar', name: 'Chain Vest', desc: '+15% Base HP, +30% Base Armor', cost: 400,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t1',
    stats: { hpPct: 0.15, armorPct: 0.30 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.30); }
  },
  {
    // NERF: HP 30%→25%, armor 50%→40%, burn 2%/s→1.5%/s (Player.js tick zůstává 0.01 per 0.5s → změň na 0.0075)
    id: 'titan_t3_sun', name: 'Blazing Bulwark', desc: '+25% Base HP, +40% Base Armor, Proximity Burn Aura (1.5%/s)', cost: 600,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t2_ar', unique: true,
    stats: { hpPct: 0.25, armorPct: 0.40, burnAura: true },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.25); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.40); pl.hasAoeBurn = true; }
  },
  {
    id: 'titan_t2_mr', name: 'Negatron Cloak', desc: '+15% Base HP, +35% Base MR', cost: 400,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t1',
    stats: { hpPct: 0.15, mrPct: 0.35 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.35); }
  },
  {
    // NERF: HP 30%→25%, MR 50%→40%, healPower 20%→15%
    id: 'titan_t3_spirit', name: 'Soulwarden Aegis', desc: '+25% Base HP, +40% Base MR, +15% Heal Power', cost: 600,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t2_mr', unique: true,
    stats: { hpPct: 0.25, mrPct: 0.40, healPower: 0.15 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.25); pl.maxHp += h; pl.hp += h; pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.40); pl.healPower = (pl.healPower || 0) + 0.15; }
  },

  // ==========================================
  // 4. COMBAT TREE (Bruiser / Fighter)
  // ==========================================
  {
    id: 'comb_t1', name: 'Phage Shard', desc: '+~12 Power, +10% Base HP', cost: 300,
    treeId: 'combat', treeBranch: 'core',
    stats: { power: 0.25, hpPct: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.25); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.10); pl.maxHp += h; pl.hp += h; }
  },
  {
    id: 'comb_t2', name: 'Waraxe', desc: '+~25 Power, +30% Base HP, +10 AH', cost: 450,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t1',
    stats: { power: 0.50, hpPct: 0.30, ahFlat: 10 },
    apply: (pl) => { addAdaptive(pl, 0.50); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.30); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 10; }
  },
  {
    // NERF: power 0.95→0.80, HP 45%→35%, pen 20%→15%
    id: 'comb_t3_cleave', name: 'Splitblade', desc: '+~45 Power, +35% Base HP, +15% Pen', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2', unique: true,
    stats: { power: 0.80, hpPct: 0.35, penPct: 0.15 },
    apply: (pl) => { addAdaptive(pl, 0.80); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.35); pl.maxHp += h; pl.hp += h; pl.adaptivePen = (pl.adaptivePen || 0) + 0.15; }
  },
  {
    // Nahrazuje Death's Dance — tankový fighter s HP + MR + LS
    id: 'comb_t3_iron', name: 'Ironheart Mantle', desc: '+~40 Power, +45% Base HP, +40% Base MR, +8% Lifesteal', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2', unique: true,
    stats: { power: 0.75, hpPct: 0.45, mrPct: 0.40, lifestealPct: 0.08 },
    apply: (pl) => {
      addAdaptive(pl, 0.75);
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.45); pl.maxHp += h; pl.hp += h;
      pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.40);
      pl.lifesteal = (pl.lifesteal || 0) + 0.08;
    }
  },

  // ==========================================
  // 5. BENEVOLENCE TREE (Support / Healer)
  // ==========================================
  {
    id: 'ben_t1', name: 'Faerie Charm', desc: '+~5 Power, +15% Base HP, +5 AH', cost: 300,
    treeId: 'benevolence', treeBranch: 'core',
    stats: { power: 0.10, hpPct: 0.15, ahFlat: 5 },
    apply: (pl) => { addAdaptive(pl, 0.10); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'ben_t2', name: 'Mender\'s Idol', desc: '+~10 Power, +35% Base HP, +15 AH, +10% Heal Power', cost: 400,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t1',
    stats: { power: 0.15, hpPct: 0.35, ahFlat: 15, healPower: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.15); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.35); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    // NERF: HP 60%→50%, AH 25→20, healPower 20%→15%
    id: 'ben_t3_red', name: 'Absolution', desc: '+~15 Power, +50% Base HP, +20 AH, +15% Heal Power', cost: 500,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t2', unique: true,
    stats: { power: 0.25, hpPct: 0.50, ahFlat: 20, healPower: 0.15 },
    apply: (pl) => { addAdaptive(pl, 0.25); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.50); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 20; pl.healPower = (pl.healPower || 0) + 0.15; }
  },
  {
    id: 'ben_t2b', name: "Warden's Charm", desc: '+~5 Power, +50% Base HP, +70% Base Armor, +10% Heal Power', cost: 400,
    treeId: 'benevolence', treeBranch: 'warden_branch', requires: 'ben_t1',
    stats: { power: 0.10, hpPct: 0.50, armorPct: 0.70, healPower: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.10); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.50); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.70); pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    // NERF: HP 85%→65%, armor 120%→100%, healPower 20%→15%
    id: 'ben_t3_locket', name: 'Aegis of Devotion', desc: '+~10 Power, +65% Base HP, +100% Base Armor, +15% Heal Power', cost: 600,
    treeId: 'benevolence', treeBranch: 'warden_branch', requires: 'ben_t2b', unique: true,
    stats: { power: 0.15, hpPct: 0.65, armorPct: 1.00, healPower: 0.15 },
    apply: (pl) => { addAdaptive(pl, 0.15); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.65); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 1.00); pl.healPower = (pl.healPower || 0) + 0.15; }
  },

  // ==========================================
  // 6. BLIGHT TREE (Grievous Wounds / Anti-Heal)
  // ==========================================
  {
    id: 'blight_t1', name: 'Blighted Shard', desc: '+~5 Power, 20% Grievous Wounds', cost: 300,
    treeId: 'blight', treeBranch: 'core',
    stats: { power: 0.10, antiHeal: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.10); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.20); }
  },
  {
    id: 'blight_t2_off', name: 'Plague Edge', desc: '+~20 Power, 40% Grievous Wounds', cost: 450,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t1',
    stats: { power: 0.35, antiHeal: 0.40 },
    apply: (pl) => { addAdaptive(pl, 0.35); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    // NERF: power 0.80→0.65, GW 60%→50%
    id: 'blight_t3_off', name: "Blightreaper", desc: '+~37 Power, +10% Pen, 50% Grievous Wounds', cost: 600,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t2_off', unique: true,
    stats: { power: 0.65, penPct: 0.10, antiHeal: 0.50 },
    apply: (pl) => { addAdaptive(pl, 0.65); pl.adaptivePen = (pl.adaptivePen || 0) + 0.10; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.50); }
  },
  {
    id: 'blight_t2_tank', name: 'Bramble Vest', desc: '+15% Base HP, +20% Base Armor, 40% Grievous Wounds', cost: 450,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t1',
    stats: { hpPct: 0.15, armorPct: 0.20, antiHeal: 0.40 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.20); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    // NERF: HP 30%→25%, armor 50%→40%, GW 60%→50%
    id: 'blight_t3_tank', name: 'Thornplate', desc: '+25% Base HP, +40% Base Armor, 50% Grievous Wounds', cost: 600,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t2_tank', unique: true,
    stats: { hpPct: 0.25, armorPct: 0.40, antiHeal: 0.50 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.25); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.40); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.50); }
  },

  // ==========================================
  // 7. PENETRATION TREE (Anti-Tank / Armor+MR shred)
  //    pen_t1 → pen_t2       → pen_t3_as  (fyzický carry)
  //                          → pen_t3_ah  (mage/caster)
  //           → pen_t2_def   → pen_t3_def (fighter tank-buster)
  //
  //    adaptivePen stackuje aditivně (+=) záměrně.
  //    Bot ji vybírá jen pokud enemyAvgRes > 55.
  // ==========================================
  {
    id: 'pen_t1', name: 'Serrated Edge', desc: '+~7 Power, +8% Adaptive Pen', cost: 300,
    treeId: 'penetration', treeBranch: 'core',
    stats: { power: 0.12, penPct: 0.08 },
    apply: (pl) => { addAdaptive(pl, 0.12); pl.adaptivePen = (pl.adaptivePen || 0) + 0.08; }
  },
  {
    id: 'pen_t2', name: 'Void Edge', desc: '+~23 Power, +18% Pen, +12% AS, +8 AH', cost: 450,
    treeId: 'penetration', treeBranch: 'hybrid_branch', requires: 'pen_t1',
    stats: { power: 0.40, penPct: 0.18, asPct: 0.12, ahFlat: 8 },
    apply: (pl) => { addAdaptive(pl, 0.40); pl.adaptivePen = (pl.adaptivePen || 0) + 0.18; pl.attackSpeed += 0.12; pl.abilityHaste = (pl.abilityHaste || 0) + 8; }
  },
  {
    id: 'pen_t2_def', name: "Breaker's Plating", desc: '+~17 Power, +18% Pen, +20% Base HP, +20% Base Armor', cost: 450,
    treeId: 'penetration', treeBranch: 'def_branch', requires: 'pen_t1',
    stats: { power: 0.30, penPct: 0.18, hpPct: 0.20, armorPct: 0.20 },
    apply: (pl) => {
      addAdaptive(pl, 0.30);
      pl.adaptivePen = (pl.adaptivePen || 0) + 0.18;
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.20); pl.maxHp += h; pl.hp += h;
      pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.20);
    }
  },
  {
    id: 'pen_t3_as', name: "Dominion's Edge", desc: '+~43 Power, +32% Pen, +25% AS', cost: 600,
    treeId: 'penetration', treeBranch: 'hybrid_branch', requires: 'pen_t2', unique: true,
    stats: { power: 0.75, penPct: 0.32, asPct: 0.25 },
    apply: (pl) => { addAdaptive(pl, 0.75); pl.adaptivePen = (pl.adaptivePen || 0) + 0.32; pl.attackSpeed += 0.25; }
  },
  {
    id: 'pen_t3_ah', name: 'Nullweave Staff', desc: '+~43 Power, +32% Pen, +25 AH', cost: 600,
    treeId: 'penetration', treeBranch: 'hybrid_branch', requires: 'pen_t2', unique: true,
    stats: { power: 0.75, penPct: 0.32, ahFlat: 25 },
    apply: (pl) => { addAdaptive(pl, 0.75); pl.adaptivePen = (pl.adaptivePen || 0) + 0.32; pl.abilityHaste = (pl.abilityHaste || 0) + 25; }
  },
  {
    id: 'pen_t3_def', name: "Titan's Resolve", desc: '+~32 Power, +28% Pen, +35% Base HP, +35% Base Armor', cost: 600,
    treeId: 'penetration', treeBranch: 'def_branch', requires: 'pen_t2_def', unique: true,
    stats: { power: 0.55, penPct: 0.28, hpPct: 0.35, armorPct: 0.35 },
    apply: (pl) => {
      addAdaptive(pl, 0.55);
      pl.adaptivePen = (pl.adaptivePen || 0) + 0.28;
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.35); pl.maxHp += h; pl.hp += h;
      pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.35);
    }
  },
];

const itemById = new Map(shopItems.map((item) => [item.id, item]));

export function getShopItem(id) {
  return itemById.get(id) || null;
}

function getOwnedTreeBranch(player, treeId) {
  if (!player || !Array.isArray(player.items)) return null;
  for (const itemId of player.items) {
    const ownedItem = getShopItem(itemId);
    if (!ownedItem || ownedItem.treeId !== treeId) continue;
    if (ownedItem.treeBranch && ownedItem.treeBranch !== 'core') return ownedItem.treeBranch;
  }
  return null;
}

function countFreeItems(player, itemId) {
  const owned = (player.items || []).filter(id => id === itemId).length;
  const consumed = (player.items || []).reduce((sum, id) => {
    const it = getShopItem(id);
    if (!it || it.unique) return sum;
    const reqs = Array.isArray(it.requires) ? it.requires : (it.requires ? [it.requires] : []);
    return sum + reqs.filter(r => r === itemId).length;
  }, 0);
  return owned - consumed;
}

export function canBuyShopItem(player, item) {
  if (!player || !item) return { ok: false, reason: 'Invalid' };

  if (item.unique && (player.items || []).includes(item.id)) {
    return { ok: false, reason: `${item.name} is unique — already owned` };
  }

  const reqs = Array.isArray(item.requires) ? item.requires : (item.requires ? [item.requires] : []);
  for (const reqId of reqs) {
    if (countFreeItems(player, reqId) <= 0) {
      const reqItem = getShopItem(reqId);
      return { ok: false, reason: `Requires ${reqItem ? reqItem.name : reqId}` };
    }
  }

  if (item.treeBranch && item.treeBranch !== 'core' && item.treeId) {
    const ownedBranch = getOwnedTreeBranch(player, item.treeId);
    if (ownedBranch && ownedBranch !== item.treeBranch) {
      const hasT3InTree = (player.items || []).some(id => {
        const it = getShopItem(id);
        return it && it.treeId === item.treeId && it.unique;
      });
      if (!hasT3InTree) {
        return { ok: false, reason: `Already on a different ${item.treeId} path` };
      }
    }
  }

  return { ok: true, reason: '' };
}

export function getBuyBlockReason(player, item) {
  return canBuyShopItem(player, item).reason;
}

export function calcTotalCost(player, item) {
  if (!item) return 0;
  let total = item.cost;
  const reqs = Array.isArray(item.requires) ? item.requires : (item.requires ? [item.requires] : []);
  for (const reqId of reqs) {
    if (countFreeItems(player, reqId) <= 0) {
      const reqItem = getShopItem(reqId);
      if (reqItem) total += calcTotalCost(player, reqItem);
    }
  }
  return total;
}
