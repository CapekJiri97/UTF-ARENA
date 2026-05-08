// Adaptive Power helper — gives AD to physical heroes, AP to magical heroes
export const addAdaptive = (pl, amount) => {
  if (pl.dmgType === 'magical') pl.AP = (pl.AP || 0) + amount;
  else pl.AD = (pl.AD || 0) + amount;
};

export const shopItems = [
  // ==========================================
  // 1. OFFENSE TREE (Marksman / Auto-Attack Carry)
  // ==========================================
  {
    id: 'off_t1', name: 'Iron Shard', desc: '+10 Power, +5% AS, +5 AH', cost: 300,
    treeId: 'offense', treeBranch: 'core',
    apply: (pl) => { addAdaptive(pl, 10); pl.attackSpeed += 0.05; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'off_t2_as', name: 'Recurve Bow', desc: '+25 Power, +20% AS', cost: 400,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t1',
    apply: (pl) => { addAdaptive(pl, 25); pl.attackSpeed += 0.20; }
  },
  {
    id: 'off_t3_ls', name: 'Bloodthirster', desc: '+50 Power, +30% AS, +10% Lifesteal', cost: 600,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as',
    apply: (pl) => { addAdaptive(pl, 50); pl.attackSpeed += 0.30; pl.lifesteal = (pl.lifesteal || 0) + 0.10; }
  },
  {
    id: 'off_t3_pen', name: 'Last Whisper', desc: '+55 Power, +20% AS, +25% Pen', cost: 500,
    treeId: 'offense', treeBranch: 'as_branch', requires: 'off_t2_as',
    apply: (pl) => { addAdaptive(pl, 55); pl.attackSpeed += 0.20; pl.adaptivePen = (pl.adaptivePen || 0) + 0.25; }
  },

  // ==========================================
  // 2. SORCERY TREE (Mage / Ability Caster)
  // ==========================================
  {
    id: 'sorc_t1', name: 'Arcane Page', desc: '+15 Power, +10 AH', cost: 300,
    treeId: 'sorcery', treeBranch: 'core',
    apply: (pl) => { addAdaptive(pl, 15); pl.abilityHaste = (pl.abilityHaste || 0) + 10; }
  },
  {
    id: 'sorc_t2_ah', name: "Sage's Stone", desc: '+35 Power, +15 AH', cost: 400,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t1',
    apply: (pl) => { addAdaptive(pl, 35); pl.abilityHaste = (pl.abilityHaste || 0) + 15; }
  },
  {
    id: 'sorc_t3_vamp', name: 'Hextech Core', desc: '+60 Power, +20 AH, +12% Spellvamp', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah',
    apply: (pl) => { addAdaptive(pl, 60); pl.abilityHaste = (pl.abilityHaste || 0) + 20; pl.spellVamp = (pl.spellVamp || 0) + 0.12; }
  },
  {
    id: 'sorc_t3_burn', name: "Liandry's Torch", desc: '+50 Power, +25 AH, +3% Max HP Spell Dmg', cost: 600,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah',
    apply: (pl) => { addAdaptive(pl, 50); pl.abilityHaste = (pl.abilityHaste || 0) + 25; pl.titanSigilSpellDmg = Math.max(pl.titanSigilSpellDmg || 0, 0.03); pl.titanSigilCd = pl.titanSigilCd || 0; }
  },
  {
    id: 'sorc_t3_slow', name: "Rylai's Crystal", desc: '+55 Power, +15 AH, 30% Slow on Spells', cost: 500,
    treeId: 'sorcery', treeBranch: 'ah_branch', requires: 'sorc_t2_ah',
    apply: (pl) => { addAdaptive(pl, 55); pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.onSpellHitSlow = Math.max(pl.onSpellHitSlow || 0, 0.30); }
  },

  // ==========================================
  // 3. TITAN TREE (Tank / Frontline)
  // ==========================================
  {
    id: 'titan_t1', name: 'Ruby Shard', desc: '+150 HP', cost: 300,
    treeId: 'titan', treeBranch: 'core',
    apply: (pl) => { pl.maxHp += 150; pl.hp += 150; }
  },
  {
    id: 'titan_t2_ar', name: 'Chain Vest', desc: '+250 HP, +20 Armor', cost: 400,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t1',
    apply: (pl) => { pl.maxHp += 250; pl.hp += 250; pl.armor += 20; }
  },
  {
    id: 'titan_t3_sun', name: 'Sunfire Aegis', desc: '+450 HP, +35 Armor, AoE Burn (2% Max HP)', cost: 600,
    treeId: 'titan', treeBranch: 'armor_branch', requires: 'titan_t2_ar',
    apply: (pl) => { pl.maxHp += 450; pl.hp += 450; pl.armor += 35; pl.hasAoeBurn = true; }
  },
  {
    id: 'titan_t2_mr', name: 'Negatron Cloak', desc: '+250 HP, +25 MR', cost: 400,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t1',
    apply: (pl) => { pl.maxHp += 250; pl.hp += 250; pl.mr += 25; }
  },
  {
    id: 'titan_t3_spirit', name: 'Spirit Visage', desc: '+450 HP, +35 MR, +20% Heal Power', cost: 600,
    treeId: 'titan', treeBranch: 'mr_branch', requires: 'titan_t2_mr',
    apply: (pl) => { pl.maxHp += 450; pl.hp += 450; pl.mr += 35; pl.healPower = (pl.healPower || 0) + 0.20; }
  },

  // ==========================================
  // 4. COMBAT TREE (Bruiser / Fighter)
  // ==========================================
  {
    id: 'comb_t1', name: 'Phage Shard', desc: '+12 Power, +100 HP', cost: 300,
    treeId: 'combat', treeBranch: 'core',
    apply: (pl) => { addAdaptive(pl, 12); pl.maxHp += 100; pl.hp += 100; }
  },
  {
    id: 'comb_t2', name: 'Waraxe', desc: '+25 Power, +250 HP, +10 AH', cost: 450,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t1',
    apply: (pl) => { addAdaptive(pl, 25); pl.maxHp += 250; pl.hp += 250; pl.abilityHaste = (pl.abilityHaste || 0) + 10; }
  },
  {
    id: 'comb_t3_cleave', name: 'Black Cleaver', desc: '+45 Power, +400 HP, +20% Pen', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2',
    apply: (pl) => { addAdaptive(pl, 45); pl.maxHp += 400; pl.hp += 400; pl.adaptivePen = (pl.adaptivePen || 0) + 0.20; }
  },
  {
    id: 'comb_t3_dance', name: "Death's Dance", desc: '+50 Power, +300 HP, +30 Armor, +10% Lifesteal+Vamp', cost: 600,
    treeId: 'combat', treeBranch: 'bruiser_branch', requires: 'comb_t2',
    apply: (pl) => { addAdaptive(pl, 50); pl.maxHp += 300; pl.hp += 300; pl.armor += 30; pl.lifesteal = (pl.lifesteal || 0) + 0.10; pl.spellVamp = (pl.spellVamp || 0) + 0.10; }
  },

  // ==========================================
  // 5. BENEVOLENCE TREE (Support / Healer)
  // ==========================================
  {
    id: 'ben_t1', name: 'Faerie Charm', desc: '+5 Power, +100 HP, +5 AH', cost: 300,
    treeId: 'benevolence', treeBranch: 'core',
    apply: (pl) => { addAdaptive(pl, 5); pl.maxHp += 100; pl.hp += 100; pl.abilityHaste = (pl.abilityHaste || 0) + 5; }
  },
  {
    id: 'ben_t2', name: 'Forbidden Idol', desc: '+10 Power, +200 HP, +15 AH, +10% Heal Power', cost: 400,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t1',
    apply: (pl) => { addAdaptive(pl, 10); pl.maxHp += 200; pl.hp += 200; pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.healPower = (pl.healPower || 0) + 0.10; }
  },
  {
    id: 'ben_t3_red', name: 'Redemption', desc: '+15 Power, +350 HP, +25 AH, +20% Heal Power', cost: 500,
    treeId: 'benevolence', treeBranch: 'utility_branch', requires: 'ben_t2',
    apply: (pl) => { addAdaptive(pl, 15); pl.maxHp += 350; pl.hp += 350; pl.abilityHaste = (pl.abilityHaste || 0) + 25; pl.healPower = (pl.healPower || 0) + 0.20; }
  },

  // ==========================================
  // 6. BLIGHT TREE (Grievous Wounds / Anti-Heal)
  // ==========================================
  {
    id: 'blight_t1', name: 'Blighted Shard', desc: '+5 Power, 20% Grievous Wounds', cost: 300,
    treeId: 'blight', treeBranch: 'core',
    apply: (pl) => { addAdaptive(pl, 5); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.20); }
  },
  {
    id: 'blight_t2_off', name: 'Plague Edge', desc: '+20 Power, 40% Grievous Wounds', cost: 450,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t1',
    apply: (pl) => { addAdaptive(pl, 20); pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    id: 'blight_t3_off', name: "Executioner's Reaper", desc: '+45 Power, +10% Pen, 60% Grievous Wounds', cost: 600,
    treeId: 'blight', treeBranch: 'offense', requires: 'blight_t2_off',
    apply: (pl) => { addAdaptive(pl, 45); pl.adaptivePen = (pl.adaptivePen || 0) + 0.10; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.60); }
  },
  {
    id: 'blight_t2_tank', name: 'Bramble Vest', desc: '+150 HP, +15 Armor, 40% Grievous Wounds', cost: 450,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t1',
    apply: (pl) => { pl.maxHp += 150; pl.hp += 150; pl.armor += 15; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); }
  },
  {
    id: 'blight_t3_tank', name: 'Thornmail Carapace', desc: '+350 HP, +35 Armor, 60% Grievous Wounds', cost: 600,
    treeId: 'blight', treeBranch: 'tank', requires: 'blight_t2_tank',
    apply: (pl) => { pl.maxHp += 350; pl.hp += 350; pl.armor += 35; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.60); }
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
  if (!player || !item) return { ok: false, reason: 'Invalid item' };

  const reqs = Array.isArray(item.requires) ? item.requires : (item.requires ? [item.requires] : []);

  // Check prerequisites exist in inventory
  for (const reqId of reqs) {
    if (countFreeItems(player, reqId) <= 0) {
      const reqItem = getShopItem(reqId);
      return { ok: false, reason: `Need ${reqItem ? reqItem.name : reqId}` };
    }
  }

  // Inventory check: upgrading replaces a slot, root items take a new slot
  // slots after = current - prereqs_removed + 1
  const slotsAfter = (player.items ? player.items.length : 0) - reqs.length + 1;
  if (slotsAfter > 6) return { ok: false, reason: 'Inventory full (max 6)' };

  if (item.unique && player.items && player.items.includes(item.id)) {
    return { ok: false, reason: 'Already owned' };
  }

  return { ok: true };
}

export function getBuyBlockReason(player, item) {
  if (!player || !item) return 'invalid';
  if ((player.gold || 0) < item.cost) return 'gold';
  const result = canBuyShopItem(player, item);
  if (!result.ok) return 'prereq';
  return null;
}

// Total gold needed to buy an item including all unowned prerequisites.
export function calcTotalCost(player, item) {
  if (!item) return 0;
  const sim = player?.items ? [...player.items] : [];

  function freeCount(id) {
    const owned = sim.filter(i => i === id).length;
    const consumed = sim.reduce((s, i) => {
      const it = getShopItem(i);
      if (!it) return s;
      const reqs = Array.isArray(it.requires) ? it.requires : (it.requires ? [it.requires] : []);
      return s + reqs.filter(r => r === id).length;
    }, 0);
    return owned - consumed;
  }

  let total = item.cost;

  function walkUp(it) {
    const reqs = Array.isArray(it.requires) ? it.requires : (it.requires ? [it.requires] : []);
    for (const reqId of reqs) {
      const reqItem = getShopItem(reqId);
      if (!reqItem) continue;
      if (freeCount(reqId) <= 0) {
        total += reqItem.cost;
        sim.push(reqId);
        walkUp(reqItem);
      }
    }
  }

  walkUp(item);
  return total;
}
