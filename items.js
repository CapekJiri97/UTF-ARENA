// Adaptive Power helper — gives AD/AP as % of hero's base stat (cross-class safe)
export const addAdaptive = (pl, pct) => {
  if (pl.dmgType === 'magical') pl.AP = (pl.AP || 0) + Math.round((pl.baseAP_stat || 0) * pct);
  else pl.AD = (pl.AD || 0) + Math.round((pl.baseAD_stat || 0) * pct);
};

export const shopItems = [
  // ==========================================
  // 1. OFFENSE TREE (Marksman / Auto-Attack Carry)
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
    id: 'off_t3_ls', name: 'Bloodthirster', desc: '+~50 Power, +30% AS, +10% Lifesteal', cost: 600,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.85, asPct: 0.30, lifestealPct: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.85); pl.attackSpeed += 0.30; pl.lifesteal = (pl.lifesteal || 0) + 0.10; }
  },
  {
    id: 'off_t3_pen', name: 'Last Whisper', desc: '+~55 Power, +20% AS, +25% Pen', cost: 500,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as', unique: true,
    stats: { power: 0.95, asPct: 0.20, penPct: 0.25 },
    apply: (pl) => { addAdaptive(pl, 0.95); pl.attackSpeed += 0.20; pl.adaptivePen = (pl.adaptivePen || 0) + 0.25; }
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
    id: 'sorc_t3_vamp', name: 'Hextech Core', desc: '+~60 Power, +20 AH, +10% Lifesteal', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.85, ahFlat: 20, lifestealPct: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.85); pl.abilityHaste = (pl.abilityHaste || 0) + 20; pl.lifesteal = (pl.lifesteal || 0) + 0.10; }
  },
  {
    id: 'sorc_t3_burn', name: "Liandry's Torch", desc: '+~50 Power, +25 AH, +3% Max HP Spell Dmg', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.70, ahFlat: 25, spellDmg: 0.03 },
    apply: (pl) => { addAdaptive(pl, 0.70); pl.abilityHaste = (pl.abilityHaste || 0) + 25; pl.titanSigilSpellDmg = Math.max(pl.titanSigilSpellDmg || 0, 0.03); pl.titanSigilCd = 4.0; }
  },
  {
    id: 'sorc_t3_slow', name: "Rylai's Crystal", desc: '+~55 Power, +15 AH, 30% Slow on Spells', cost: 500,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah', unique: true,
    stats: { power: 0.80, ahFlat: 15, slowOnSpell: 0.30 },
    apply: (pl) => { addAdaptive(pl, 0.80); pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.onSpellHitSlow = Math.max(pl.onSpellHitSlow || 0, 0.30); }
  },

  // ==========================================
  // 3. TITAN TREE (Tank / Frontline)
  // ==========================================
  {
    id: 'titan_t1', name: 'Ruby Shard', desc: '+15% Base HP', cost: 300,
    treeId: 'titan', treeBranch: 'core',
    stats: { hpPct: 0.15 },
    apply: (pl) => { const b = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += b; pl.hp += b; }
  },
  {
    id: 'titan_t2_ar', name: 'Chain Vest', desc: '+20% Base HP, +40% Base Armor', cost: 400,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t1',
    stats: { hpPct: 0.20, armorPct: 0.40 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.20); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.40); }
  },
  {
    id: 'titan_t3_sun', name: 'Sunfire Aegis', desc: '+40% Base HP, +70% Base Armor, Proximity Burn Aura (2%/s)', cost: 600,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t2_ar', unique: true,
    stats: { hpPct: 0.40, armorPct: 0.70, burnAura: true },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.40); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.70); pl.hasAoeBurn = true; }
  },
  {
    id: 'titan_t2_mr', name: 'Negatron Cloak', desc: '+20% Base HP, +50% Base MR', cost: 400,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t1',
    stats: { hpPct: 0.20, mrPct: 0.50 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.20); pl.maxHp += h; pl.hp += h; pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.50); }
  },
  {
    id: 'titan_t3_spirit', name: 'Spirit Visage', desc: '+40% Base HP, +70% Base MR, +20% Heal Power', cost: 600,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t2_mr', unique: true,
    stats: { hpPct: 0.40, mrPct: 0.70, healPower: 0.20 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.40); pl.maxHp += h; pl.hp += h; pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.70); pl.healPower = (pl.healPower || 0) + 0.20; }
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
    id: 'comb_t3_cleave', name: 'Black Cleaver', desc: '+~45 Power, +45% Base HP, +20% Pen', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2', unique: true,
    stats: { power: 0.95, hpPct: 0.45, penPct: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.95); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.45); pl.maxHp += h; pl.hp += h; pl.adaptivePen = (pl.adaptivePen || 0) + 0.20; }
  },
  {
    id: 'comb_t3_dance', name: "Death's Dance", desc: '+~50 Power, +35% Base HP, +90% Base Armor, +15% Lifesteal', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2', unique: true,
    stats: { power: 1.05, hpPct: 0.35, armorPct: 0.90, lifestealPct: 0.15 },
    apply: (pl) => { addAdaptive(pl, 1.05); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.35); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.90); pl.lifesteal = (pl.lifesteal || 0) + 0.15; }
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
    id: 'ben_t2', name: 'Forbidden Idol', desc: '+~10 Power, +35% Base HP, +15 AH, +10% Heal Power', cost: 400,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t1',
    stats: { power: 0.15, hpPct: 0.35, ahFlat: 15, healPower: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.15); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.35); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    id: 'ben_t3_red', name: 'Redemption', desc: '+~15 Power, +60% Base HP, +25 AH, +20% Heal Power', cost: 500,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t2', unique: true,
    stats: { power: 0.25, hpPct: 0.60, ahFlat: 25, healPower: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.25); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.60); pl.maxHp += h; pl.hp += h; pl.abilityHaste = (pl.abilityHaste || 0) + 25; pl.healPower = (pl.healPower || 0) + 0.20; }
  },
  {
    id: 'ben_t2b', name: "Warden's Charm", desc: '+~5 Power, +50% Base HP, +100% Base Armor, +10% Heal Power', cost: 400,
    treeId: 'benevolence', treeBranch: 'warden_branch', requires: 'ben_t1',
    stats: { power: 0.10, hpPct: 0.50, armorPct: 1.00, healPower: 0.10 },
    apply: (pl) => { addAdaptive(pl, 0.10); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.50); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 1.00); pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    id: 'ben_t3_locket', name: 'Locket of Solari', desc: '+~10 Power, +85% Base HP, +175% Base Armor, +20% Heal Power', cost: 600,
    treeId: 'benevolence', treeBranch: 'warden_branch', requires: 'ben_t2b', unique: true,
    stats: { power: 0.15, hpPct: 0.85, armorPct: 1.75, healPower: 0.20 },
    apply: (pl) => { addAdaptive(pl, 0.15); const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.85); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 1.75); pl.healPower = (pl.healPower || 0) + 0.20; }
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
    id: 'blight_t3_off', name: "Executioner's Reaper", desc: '+~45 Power, +10% Pen, 60% Grievous Wounds', cost: 600,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t2_off', unique: true,
    stats: { power: 0.80, penPct: 0.10, antiHeal: 0.60 },
    apply: (pl) => { addAdaptive(pl, 0.80); pl.adaptivePen = (pl.adaptivePen || 0) + 0.10; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.60); }
  },
  {
    id: 'blight_t2_tank', name: 'Bramble Vest', desc: '+15% Base HP, +30% Base Armor, 40% Grievous Wounds', cost: 450,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t1',
    stats: { hpPct: 0.15, armorPct: 0.30, antiHeal: 0.40 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.15); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.30); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    id: 'blight_t3_tank', name: 'Thornmail Carapace', desc: '+30% Base HP, +70% Base Armor, 60% Grievous Wounds', cost: 600,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t2_tank', unique: true,
    stats: { hpPct: 0.30, armorPct: 0.70, antiHeal: 0.60 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.30); pl.maxHp += h; pl.hp += h; pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.70); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.60); }
  }
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
    if (!it) return sum;
    const reqs = Array.isArray(it.requires) ? it.requires : (it.requires ? [it.requires] : []);
    return sum + reqs.filter(r => r === itemId).length;
  }, 0);
  return owned - consumed;
}

export function canBuyShopItem(player, item) {
  if (!player || !item) return { ok: false, reason: 'Invalid' };

  // Unique: can only own one copy
  if (item.unique && (player.items || []).includes(item.id)) {
    return { ok: false, reason: `${item.name} is unique — already owned` };
  }

  // Prerequisite check
  const reqs = Array.isArray(item.requires) ? item.requires : (item.requires ? [item.requires] : []);
  for (const reqId of reqs) {
    if (countFreeItems(player, reqId) <= 0) {
      const reqItem = getShopItem(reqId);
      return { ok: false, reason: `Requires ${reqItem ? reqItem.name : reqId}` };
    }
  }

  // Tree branch conflict: once you buy a non-core branch item in a tree, you're locked into that branch
  if (item.treeBranch && item.treeBranch !== 'core' && item.treeId) {
    const ownedBranch = getOwnedTreeBranch(player, item.treeId);
    if (ownedBranch && ownedBranch !== item.treeBranch) {
      return { ok: false, reason: `Already on a different ${item.treeId} path` };
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
