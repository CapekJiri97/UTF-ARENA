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
    id: 'off_t1', name: 'Iron Shard', cost: 300,
    treeId: 'offense', treeBranch: 'core',
    stats: { power: 0.15, asPct: 0.05, ahFlat: 5 },
    apply: (pl) => { addAdaptive(pl, 0.15); pl.attackSpeed += 0.05; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'off_t2_as', name: 'Recurve Bow', cost: 400,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t1',
    stats: { power: 0.45, asPct: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.45); pl.attackSpeed += 0.20; }
  },
  {
    id: 'off_t3_ls', name: 'Crimson Edge', cost: 600,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.75, asPct: 0.18, lifestealPct: 0.08 },
    apply: (pl) => { addAdaptive(pl, 0.75); pl.attackSpeed += 0.18; pl.lifesteal = (pl.lifesteal || 0) + 0.08; }
  },
  {
    id: 'off_t3_pen', name: 'Sundermark', cost: 500,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.70, asPct: 0.18, penPct: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.70); pl.attackSpeed += 0.18; pl.adaptivePen = (pl.adaptivePen || 0) + 0.20; }
  },
  {
    id: 'off_t3_dance', name: "Warborn Mantle", cost: 600,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.70, hpPct: 0.25, armorPct: 0.40, lifestealPct: 0.10 },
    apply: (pl) => {
      addAdaptive(pl, 0.70);
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.25); pl.maxHp += h; pl.hp += h;
      pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.40);
      pl.lifesteal = (pl.lifesteal || 0) + 0.10;
    }
  },

  // ==========================================
  // 2. SORCERY TREE (Mage / Ability Caster)
  // ==========================================
  {
    id: 'sorc_t1', name: 'Arcane Page', cost: 300,
    treeId: 'sorcery', treeBranch: 'core',
    stats: { power: 0.20, ahFlat: 10 },
    apply: (pl) => { addAdaptive(pl, 0.20); pl.abilityHaste = (pl.abilityHaste || 0) + 10; }
  },
  {
    id: 'sorc_t2_ah', name: "Sage's Stone", cost: 400,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t1',
    stats: { power: 0.50, ahFlat: 15 },
    apply: (pl) => { addAdaptive(pl, 0.50); pl.abilityHaste = (pl.abilityHaste || 0) + 15; }
  },
  {
    id: 'sorc_t3_vamp', name: 'Hextech Core', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.60, ahFlat: 13, lifestealPct: 0.08 },
    apply: (pl) => { addAdaptive(pl, 0.60); pl.abilityHaste = (pl.abilityHaste || 0) + 13; pl.lifesteal = (pl.lifesteal || 0) + 0.08; }
  },
  {
    id: 'sorc_t3_burn', name: "Ember Catalyst", cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.55, ahFlat: 18, spellDmg: 0.025 },
    apply: (pl) => { addAdaptive(pl, 0.55); pl.abilityHaste = (pl.abilityHaste || 0) + 18; pl.titanSigilSpellDmg = Math.max(pl.titanSigilSpellDmg || 0, 0.025); pl.titanSigilCd = 2.0; }
  },
  {
    id: 'sorc_t3_slow', name: "Glacial Sigil", cost: 500,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.58, ahFlat: 9, slowOnSpell: 0.25 },
    apply: (pl) => { addAdaptive(pl, 0.58); pl.abilityHaste = (pl.abilityHaste || 0) + 9; pl.onSpellHitSlow = Math.max(pl.onSpellHitSlow || 0, 0.25); }
  },

  // ==========================================
  // 3. TITAN TREE (Tank / Frontline)
  // ==========================================
  {
    id: 'titan_t1', name: 'Ruby Shard', cost: 300,
    treeId: 'titan', treeBranch: 'core',
    stats: { hpPct: 0.12 },
    apply: (pl) => { const b = Math.round((pl.baseMaxHp || pl.maxHp) * 0.12); pl.maxHp += b; pl.hp += b; }
  },
  {
    id: 'titan_t2_ar', name: 'Chain Vest', cost: 400,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t1',
    stats: { hpPct: 0.15, armorPct: 0.30 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.30); }
  },
  {
    id: 'titan_t3_sun', name: 'Blazing Bulwark', cost: 600,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t2_ar', unique: true,
    stats: { hpPct: 0.20, armorPct: 0.35, burnAura: true },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.20); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.35); pl.hasAoeBurn = true; }
  },
  {
    id: 'titan_t2_mr', name: 'Negatron Cloak', cost: 400,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t1',
    stats: { hpPct: 0.15, mrPct: 0.35 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.35); }
  },
  {
    id: 'titan_t3_spirit', name: 'Soulwarden Aegis', cost: 600,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t2_mr', unique: true,
    stats: { hpPct: 0.20, mrPct: 0.35, healPower: 0.13 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.20); pl.maxHp += h; pl.hp += h; pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.35); pl.healPower = (pl.healPower || 0) + 0.13; }
  },

  // ==========================================
  // 4. COMBAT TREE (Bruiser / Fighter)
  // ==========================================
  {
    id: 'comb_t1', name: 'Phage Shard', cost: 300,
    treeId: 'combat', treeBranch: 'core',
    stats: { power: 0.25, hpPct: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.25); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.10); pl.maxHp += h; pl.hp += h; }
  },
  {
    id: 'comb_t2', name: 'Waraxe', cost: 450,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t1',
    stats: { power: 0.50, hpPct: 0.30, ahFlat: 10 },
    apply: (pl) => { addAdaptive(pl, 0.50); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.30); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 10; }
  },
  {
    id: 'comb_t3_cleave', name: 'Splitblade', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2', unique: true,
    stats: { power: 0.70, hpPct: 0.28, penPct: 0.15 },
    apply: (pl) => { addAdaptive(pl, 0.70); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.28); pl.maxHp += h; pl.hp += h; pl.adaptivePen = (pl.adaptivePen || 0) + 0.15; }
  },
  {
    id: 'comb_t3_iron', name: 'Ironheart Mantle', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2', unique: true,
    stats: { power: 0.65, hpPct: 0.38, mrPct: 0.32, lifestealPct: 0.08 },
    apply: (pl) => {
      addAdaptive(pl, 0.65);
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.38); pl.maxHp += h; pl.hp += h;
      pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.32);
      pl.lifesteal = (pl.lifesteal || 0) + 0.08;
    }
  },

  // ==========================================
  // 5. BENEVOLENCE TREE (Support / Healer)
  // ==========================================
  {
    id: 'ben_t1', name: 'Faerie Charm', cost: 300,
    treeId: 'benevolence', treeBranch: 'core',
    stats: { power: 0.10, hpPct: 0.15, ahFlat: 5 },
    apply: (pl) => { addAdaptive(pl, 0.10); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'ben_t2', name: 'Mender\'s Idol', cost: 400,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t1',
    stats: { power: 0.15, hpPct: 0.35, ahFlat: 15, healPower: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.15); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.35); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    id: 'ben_t3_red', name: 'Absolution', cost: 500,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t2', unique: true,
    stats: { power: 0.20, hpPct: 0.42, ahFlat: 17, healPower: 0.13 },
    apply: (pl) => { addAdaptive(pl, 0.20); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.42); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 17; pl.healPower = (pl.healPower || 0) + 0.13; }
  },
  {
    id: 'ben_t2b', name: "Warden's Charm", cost: 400,
    treeId: 'benevolence', treeBranch: 'warden_branch', requires: 'ben_t1',
    stats: { power: 0.10, hpPct: 0.50, armorPct: 0.70, healPower: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.10); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.50); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.70); pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    id: 'ben_t3_locket', name: 'Aegis of Devotion', cost: 600,
    treeId: 'benevolence', treeBranch: 'warden_branch', requires: 'ben_t2b', unique: true,
    stats: { power: 0.12, hpPct: 0.55, armorPct: 0.82, healPower: 0.13 },
    apply: (pl) => { addAdaptive(pl, 0.12); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.55); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.82); pl.healPower = (pl.healPower || 0) + 0.13; }
  },

  // ==========================================
  // 6. BLIGHT TREE (Grievous Wounds / Anti-Heal)
  // ==========================================
  {
    id: 'blight_t1', name: 'Blighted Shard', cost: 300,
    treeId: 'blight', treeBranch: 'core',
    stats: { power: 0.10, antiHeal: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.10); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.20); }
  },
  {
    id: 'blight_t2_off', name: 'Plague Edge', cost: 450,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t1',
    stats: { power: 0.35, antiHeal: 0.40 },
    apply: (pl) => { addAdaptive(pl, 0.35); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    id: 'blight_t3_off', name: "Blightreaper", cost: 600,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t2_off', unique: true,
    stats: { power: 0.55, penPct: 0.10, antiHeal: 0.45 },
    apply: (pl) => { addAdaptive(pl, 0.55); pl.adaptivePen = (pl.adaptivePen || 0) + 0.10; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.45); }
  },
  {
    id: 'blight_t2_tank', name: 'Bramble Vest', cost: 450,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t1',
    stats: { hpPct: 0.15, armorPct: 0.20, antiHeal: 0.40 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.20); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    id: 'blight_t3_tank', name: 'Thornplate', cost: 600,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t2_tank', unique: true,
    stats: { hpPct: 0.20, armorPct: 0.33, antiHeal: 0.45 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.20); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.33); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.45); }
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
    id: 'pen_t1', name: 'Serrated Edge', cost: 300,
    treeId: 'penetration', treeBranch: 'core',
    stats: { power: 0.08, penPct: 0.08 },
    apply: (pl) => { addAdaptive(pl, 0.08); pl.adaptivePen = (pl.adaptivePen || 0) + 0.08; }
  },
  {
    id: 'pen_t2', name: 'Void Edge', cost: 450,
    treeId: 'penetration', treeBranch: 'hybrid_branch', requires: 'pen_t1',
    stats: { power: 0.28, penPct: 0.18, asPct: 0.08, ahFlat: 5 },
    apply: (pl) => { addAdaptive(pl, 0.28); pl.adaptivePen = (pl.adaptivePen || 0) + 0.18; pl.attackSpeed += 0.08; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'pen_t2_def', name: "Breaker's Plating", cost: 450,
    treeId: 'penetration', treeBranch: 'def_branch', requires: 'pen_t1',
    stats: { power: 0.30, penPct: 0.18, hpPct: 0.15, armorPct: 0.15 },
    apply: (pl) => {
      addAdaptive(pl, 0.30);
      pl.adaptivePen = (pl.adaptivePen || 0) + 0.18;
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h;
      pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.15);
    }
  },
  {
    id: 'pen_t3_as', name: "Dominion's Edge", cost: 600,
    treeId: 'penetration', treeBranch: 'hybrid_branch', requires: 'pen_t2', unique: true,
    stats: { power: 0.55, penPct: 0.32, asPct: 0.18 },
    apply: (pl) => { addAdaptive(pl, 0.55); pl.adaptivePen = (pl.adaptivePen || 0) + 0.32; pl.attackSpeed += 0.18; }
  },
  {
    id: 'pen_t3_ah', name: 'Nullweave Staff', cost: 600,
    treeId: 'penetration', treeBranch: 'hybrid_branch', requires: 'pen_t2', unique: true,
    stats: { power: 0.55, penPct: 0.32, ahFlat: 18 },
    apply: (pl) => { addAdaptive(pl, 0.55); pl.adaptivePen = (pl.adaptivePen || 0) + 0.32; pl.abilityHaste = (pl.abilityHaste || 0) + 18; }
  },
  {
    id: 'pen_t3_def', name: "Titan's Resolve", cost: 600,
    treeId: 'penetration', treeBranch: 'def_branch', requires: 'pen_t2_def', unique: true,
    stats: { power: 0.40, penPct: 0.28, hpPct: 0.25, armorPct: 0.25 },
    apply: (pl) => {
      addAdaptive(pl, 0.40);
      pl.adaptivePen = (pl.adaptivePen || 0) + 0.28;
      const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.25); pl.maxHp += h; pl.hp += h;
      pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.25);
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
