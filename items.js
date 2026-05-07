export const shopItems = [
  // AD
  { id:'ad', name:'Iron Shard', desc:'+15 AD', cost:300, treeId:'ad', treeBranch:'core', apply: (pl)=>{ pl.AD += 15; } },
  { id:'ad_ls', name:'Vampiric Blade', desc:'+12 AD, +4% Lifesteal', cost:350, treeId:'ad', treeBranch:'lifesteal', requires:'ad', apply: (pl)=>{ pl.AD += 12; pl.lifesteal = (pl.lifesteal || 0) + 0.04; } },
  { id:'ad_ls2', name:'Bloodletter Blade', desc:'+15 AD, +6% Lifesteal', cost:450, treeId:'ad', treeBranch:'lifesteal', requires:'ad_ls', apply: (pl)=>{ pl.AD += 15; pl.lifesteal = (pl.lifesteal || 0) + 0.06; } },
  { id:'ad_pen', name:'Jagged Cleaver', desc:'+12 AD, +6 Armor Pen', cost:350, treeId:'ad', treeBranch:'armorpen', requires:'ad', apply: (pl)=>{ pl.AD += 12; pl.armorPenFlat = (pl.armorPenFlat || 0) + 6; } },
  { id:'ad_pen2', name:'Guillotine Blade', desc:'+15 AD, +8 Armor Pen', cost:450, treeId:'ad', treeBranch:'armorpen', requires:'ad_pen', apply: (pl)=>{ pl.AD += 15; pl.armorPenFlat = (pl.armorPenFlat || 0) + 8; } },
  // AP
  { id:'ap', name:'Arcane Scroll', desc:'+15 AP', cost:300, treeId:'ap', treeBranch:'core', apply: (pl)=>{ pl.AP += 15; } },
  { id:'ap_vamp', name:'Soul Talisman', desc:'+12 AP, +4% Spell Vamp', cost:350, treeId:'ap', treeBranch:'vamp', requires:'ap', apply: (pl)=>{ pl.AP += 12; pl.spellVamp = (pl.spellVamp || 0) + 0.04; } },
  { id:'ap_vamp2', name:'Lifeweave Prism', desc:'+15 AP, +6% Spell Vamp', cost:450, treeId:'ap', treeBranch:'vamp', requires:'ap_vamp', apply: (pl)=>{ pl.AP += 15; pl.spellVamp = (pl.spellVamp || 0) + 0.06; } },
  { id:'ap_pen', name:'Arcane Needle', desc:'+12 AP, +6 Magic Pen', cost:350, treeId:'ap', treeBranch:'magicpen', requires:'ap', apply: (pl)=>{ pl.AP += 12; pl.magicPenFlat = (pl.magicPenFlat || 0) + 6; } },
  { id:'ap_pen2', name:'Shadow Prism', desc:'+15 AP, +8 Magic Pen', cost:450, treeId:'ap', treeBranch:'magicpen', requires:'ap_pen', apply: (pl)=>{ pl.AP += 15; pl.magicPenFlat = (pl.magicPenFlat || 0) + 8; } },
  // AS
  { id:'as', name:'Dagger', desc:'+20% Attack Speed', cost:300, treeId:'as', treeBranch:'core', apply: (pl)=>{ pl.attackSpeed += 0.20; } },
  { id:'as_ms', name:'Swift Dagger', desc:'+15% Attack Speed, +3% Move Speed', cost:350, treeId:'as', treeBranch:'tempo', requires:'as', apply: (pl)=>{ pl.attackSpeed += 0.15; pl.speed *= 1.03; } },
  { id:'as_ms2', name:'Ghoststep Blade', desc:'+20% Attack Speed, +4% Move Speed', cost:450, treeId:'as', treeBranch:'tempo', requires:'as_ms', apply: (pl)=>{ pl.attackSpeed += 0.20; pl.speed *= 1.04; } },
  { id:'as_dmg', name:'Hunting Bow', desc:'+15% Attack Speed, +10 AD', cost:350, treeId:'as', treeBranch:'damage', requires:'as', apply: (pl)=>{ pl.attackSpeed += 0.15; pl.AD += 10; } },
  { id:'as_dmg2', name:'Fangblade', desc:'+20% Attack Speed, +12 AD', cost:450, treeId:'as', treeBranch:'damage', requires:'as_dmg', apply: (pl)=>{ pl.attackSpeed += 0.20; pl.AD += 12; } },
  // AH
  { id:'ah', name:'Focus Crystal', desc:'+18 Ability Haste', cost:300, treeId:'ah', treeBranch:'core', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 18; } },
  { id:'ah_ms', name:'Quick Gem', desc:'+12 Ability Haste, +3% Move Speed', cost:350, treeId:'ah', treeBranch:'tempo', requires:'ah', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 12; pl.speed *= 1.03; } },
  { id:'ah_ms2', name:'Wind Wisp', desc:'+15 Ability Haste, +4% Move Speed', cost:450, treeId:'ah', treeBranch:'tempo', requires:'ah_ms', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.speed *= 1.04; } },
  { id:'ah_hp', name:'Vitality Gem', desc:'+10 Ability Haste, +80 HP', cost:350, treeId:'ah', treeBranch:'vitality', requires:'ah', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 10; pl.maxHp += 80; pl.hp += 80; } },
  { id:'ah_hp2', name:'Colossus Heart', desc:'+15 Ability Haste, +120 HP', cost:450, treeId:'ah', treeBranch:'vitality', requires:'ah_hp', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.maxHp += 120; pl.hp += 120; } },
  // DEFENSE
  { id:'hp', name:'Bloodstone', desc:'+100 HP, +1.5 HP Regen', cost:300, treeId:'def', treeBranch:'core', apply: (pl)=>{ pl.maxHp += 100; pl.hp += 100; pl.hpRegen += 1.5; } },
  { id:'def_ar', name:'Sentinel Mail', desc:'+80 HP, +15 Armor', cost:350, treeId:'def', treeBranch:'armor', requires:'hp', apply: (pl)=>{ pl.maxHp += 80; pl.hp += 80; pl.armor += 15; } },
  { id:'def_ar2', name:'Blazing Plate', desc:'+120 HP, +20 Armor', cost:450, treeId:'def', treeBranch:'armor', requires:'def_ar', apply: (pl)=>{ pl.maxHp += 120; pl.hp += 120; pl.armor += 20; } },
  { id:'def_mr', name:'Mystic Hood', desc:'+80 HP, +15 Magic Resist', cost:350, treeId:'def', treeBranch:'mr', requires:'hp', apply: (pl)=>{ pl.maxHp += 80; pl.hp += 80; pl.mr += 15; } },
  { id:'def_mr2', name:'Soul Ward', desc:'+120 HP, +20 Magic Resist', cost:450, treeId:'def', treeBranch:'mr', requires:'def_mr', apply: (pl)=>{ pl.maxHp += 120; pl.hp += 120; pl.mr += 20; } },
  // ANTI-HEAL
  { id:'anti_base', name:'Grievous Shard', desc:'-20% Heal reduction (2s, no stack)', cost:300, treeId:'anti', treeBranch:'core', apply: (pl)=>{ pl.antiHeal = Math.max(pl.antiHeal || 0, 0.20); } },
  { id:'ah_heal', name:'Plague Axe', desc:'+12 AD, -40% Heal on hit (2s, no stack)', cost:320, treeId:'anti', treeBranch:'physical', requires:'anti_base', apply: (pl)=>{ pl.AD += 12; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); } },
  { id:'ah_heal2', name:'Blight Edge', desc:'+18 AD, -60% Heal on hit (2s, no stack)', cost:480, treeId:'anti', treeBranch:'physical', requires:'ah_heal', apply: (pl)=>{ pl.AD += 18; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.60); } },
  { id:'ah_heal_ap', name:'Plague Scroll', desc:'+12 AP, -40% Heal on hit (2s, no stack)', cost:320, treeId:'anti', treeBranch:'magical', requires:'anti_base', apply: (pl)=>{ pl.AP += 12; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.40); } },
  { id:'ah_heal_ap2', name:'Anguish Prism', desc:'+18 AP, -60% Heal on hit (2s, no stack)', cost:480, treeId:'anti', treeBranch:'magical', requires:'ah_heal_ap', apply: (pl)=>{ pl.AP += 18; pl.antiHeal = Math.max(pl.antiHeal || 0, 0.60); } },
  // AD SLOW branch (part of AD tree)
  { id:'ad_slow', name:'Chilling Blade', desc:'+10 AD, +40 HP, 10% Slow on hit', cost:350, treeId:'ad', treeBranch:'slow', requires:'ad', apply: (pl)=>{ pl.AD += 10; pl.maxHp += 40; pl.hp += 40; pl.onHitSlow = Math.max(pl.onHitSlow || 0, 0.10); } },
  { id:'slow', name:'Glacial Mantle', desc:'+80 HP, +15 Armor, 20% Slow on hit', cost:350, treeId:'ad', treeBranch:'slow', requires:'ad_slow', apply: (pl)=>{ pl.maxHp += 80; pl.hp += 80; pl.armor += 15; pl.onHitSlow = Math.max(pl.onHitSlow || 0, 0.20); } },
  // AP SLOW branch (part of AP tree)
  { id:'ap_slow', name:'Glacial Tome', desc:'+10 AP, 12% Slow on Spells', cost:350, treeId:'ap', treeBranch:'slow', requires:'ap', apply: (pl)=>{ pl.AP += 10; pl.onSpellHitSlow = Math.max(pl.onSpellHitSlow || 0, 0.12); } },
  { id:'slow_ms', name:'Frostbind Staff', desc:'+15 AP, 25% Slow on Spells', cost:350, treeId:'ap', treeBranch:'slow', requires:'ap_slow', apply: (pl)=>{ pl.AP += 15; pl.onSpellHitSlow = Math.max(pl.onSpellHitSlow || 0, 0.25); } },
  // SHIELD branch (part of Defense tree)
  { id:'shield', name:'Barrier Core', desc:'+80 HP, +15 MR, Shield on Hit', cost:350, treeId:'def', treeBranch:'shield', requires:'hp', apply: (pl)=>{ pl.maxHp += 80; pl.hp += 80; pl.mr += 15; pl.shieldOnHit = 120; } },
  { id:'shield_ad', name:'Gilded Bulwark', desc:'+10 AD, +80 HP, +15 Armor, Enhanced Shield', cost:480, treeId:'def', treeBranch:'shield', requires:'shield', apply: (pl)=>{ pl.AD += 10; pl.maxHp += 80; pl.hp += 80; pl.armor += 15; pl.shieldOnHit = 180; } },
  // TITAN TREE — spell-only % max HP passive, two-tier
  { id:'titan_shard', name:"Titan's Shard", desc:'+20 HP, +5 Armor, +5 MR | Passive: Spells deal +1% target Max HP as bonus magic dmg (4s CD)', cost:420, treeId:'def', treeBranch:'titan', requires:'hp', apply: (pl)=>{ pl.maxHp += 20; pl.hp += 20; pl.armor += 5; pl.mr += 5; pl.titanSigilSpellDmg = Math.max(pl.titanSigilSpellDmg || 0, 0.01); pl.titanSigilCd = pl.titanSigilCd || 0; } },
  { id:'titan_sigil', name:"Titan's Sigil", desc:'+40 HP, +5 Armor, +5 MR | Passive: Spells deal +2.5% target Max HP as bonus magic dmg (4s CD)', cost:680, treeId:'def', treeBranch:'titan', requires:'titan_shard', apply: (pl)=>{ pl.maxHp += 40; pl.hp += 40; pl.armor += 5; pl.mr += 5; pl.titanSigilSpellDmg = Math.max(pl.titanSigilSpellDmg || 0, 0.025); pl.titanSigilCd = pl.titanSigilCd || 0; } }
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

// Počet "volných" (nespotřebovaných) kusů daného itemu v inventáři.
// Každý item co vyžaduje reqId spotřebuje jeden kus.
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
  if (player.items && player.items.length >= 25) return { ok: false, reason: 'Inventory full (max 25)' };

  const requiredItems = item.requires ? (Array.isArray(item.requires) ? item.requires : [item.requires]) : [];
  for (const reqId of requiredItems) {
    if (countFreeItems(player, reqId) <= 0) {
      const reqItem = getShopItem(reqId);
      return { ok: false, reason: `Need ${reqItem ? reqItem.name : reqId}` };
    }
  }

  if (item.unique && player.items.includes(item.id)) {
    return { ok: false, reason: `Already owned` };
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
// Returns item.cost if all prereqs are already freely owned.
export function calcTotalCost(player, item) {
  if (!item) return 0;
  // Simulate inventory so we don't double-count shared base items
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
        sim.push(reqId); // mark as "virtually owned" so multi-level chains don't double-count
        walkUp(reqItem);
      }
    }
  }

  walkUp(item);
  return total;
}