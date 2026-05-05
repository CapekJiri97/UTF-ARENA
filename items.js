export const shopItems = [
  // AD
  { id:'ad', name:'Long Sword', desc:'+15 AD', cost:300, treeId:'ad', treeBranch:'core', apply: (pl)=>{ pl.AD += 15; } },
  { id:'ad_ls', name:'Vampiric Blade', desc:'+10 AD, +6% Lifesteal', cost:350, treeId:'ad', treeBranch:'lifesteal', requires:'ad', unique:true, apply: (pl)=>{ pl.AD += 10; pl.lifesteal = (pl.lifesteal || 0) + 0.06; } },
  { id:'ad_ls2', name:'Bloodletter Blade', desc:'+15 AD, +6% Lifesteal', cost:450, treeId:'ad', treeBranch:'lifesteal', requires:'ad_ls', unique:true, apply: (pl)=>{ pl.AD += 15; pl.lifesteal = (pl.lifesteal || 0) + 0.06; } },
  { id:'ad_pen', name:'Serrated Edge', desc:'+10 AD, +6 Armor Pen', cost:350, treeId:'ad', treeBranch:'armorpen', requires:'ad', unique:true, apply: (pl)=>{ pl.AD += 10; pl.armorPenFlat = (pl.armorPenFlat || 0) + 6; } },
  { id:'ad_pen2', name:'Executioner Edge', desc:'+15 AD, +6 Armor Pen', cost:450, treeId:'ad', treeBranch:'armorpen', requires:'ad_pen', unique:true, apply: (pl)=>{ pl.AD += 15; pl.armorPenFlat = (pl.armorPenFlat || 0) + 6; } },
  // AP
  { id:'ap', name:'Amplifying Tome', desc:'+15 AP', cost:300, treeId:'ap', treeBranch:'core', apply: (pl)=>{ pl.AP += 15; } },
  { id:'ap_vamp', name:'Soul Talisman', desc:'+10 AP, +6% Spell Vamp', cost:350, treeId:'ap', treeBranch:'vamp', requires:'ap', unique:true, apply: (pl)=>{ pl.AP += 10; pl.spellVamp = (pl.spellVamp || 0) + 0.06; } },
  { id:'ap_vamp2', name:'Lifeweave Prism', desc:'+15 AP, +6% Spell Vamp', cost:450, treeId:'ap', treeBranch:'vamp', requires:'ap_vamp', unique:true, apply: (pl)=>{ pl.AP += 15; pl.spellVamp = (pl.spellVamp || 0) + 0.06; } },
  { id:'ap_pen', name:'Arcane Needle', desc:'+10 AP, +6 Magic Pen', cost:350, treeId:'ap', treeBranch:'magicpen', requires:'ap', unique:true, apply: (pl)=>{ pl.AP += 10; pl.magicPenFlat = (pl.magicPenFlat || 0) + 6; } },
  { id:'ap_pen2', name:'Void Prism', desc:'+15 AP, +6 Magic Pen', cost:450, treeId:'ap', treeBranch:'magicpen', requires:'ap_pen', unique:true, apply: (pl)=>{ pl.AP += 15; pl.magicPenFlat = (pl.magicPenFlat || 0) + 6; } },
  // AS
  { id:'as', name:'Dagger', desc:'+20% Attack Speed', cost:300, treeId:'as', treeBranch:'core', apply: (pl)=>{ pl.attackSpeed += 0.20; } },
  { id:'as_ms', name:'Swift Dagger', desc:'+20% Attack Speed, +3% Move Speed', cost:350, treeId:'as', treeBranch:'tempo', requires:'as', unique:true, apply: (pl)=>{ pl.attackSpeed += 0.20; pl.speed *= 1.03; } },
  { id:'as_ms2', name:'Phantom Dancer', desc:'+30% Attack Speed, +6% Move Speed', cost:450, treeId:'as', treeBranch:'tempo', requires:'as_ms', unique:true, apply: (pl)=>{ pl.attackSpeed += 0.30; pl.speed *= 1.06; } },
  { id:'as_dmg', name:'Recurve Bow', desc:'+20% Attack Speed, +10 AD', cost:350, treeId:'as', treeBranch:'damage', requires:'as', unique:true, apply: (pl)=>{ pl.attackSpeed += 0.20; pl.AD += 10; } },
  { id:'as_dmg2', name:'Nashors Blade', desc:'+30% Attack Speed, +20 AD', cost:450, treeId:'as', treeBranch:'damage', requires:'as_dmg', unique:true, apply: (pl)=>{ pl.attackSpeed += 0.30; pl.AD += 20; } },
  // AH
  { id:'ah', name:'Kindlegem', desc:'+15 Ability Haste', cost:300, treeId:'ah', treeBranch:'core', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; } },
  { id:'ah_ms', name:'Quick Gem', desc:'+15 Ability Haste, +3% Move Speed', cost:350, treeId:'ah', treeBranch:'tempo', requires:'ah', unique:true, apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.speed *= 1.03; } },
  { id:'ah_ms2', name:'Aether Wisp', desc:'+25 Ability Haste, +6% Move Speed', cost:450, treeId:'ah', treeBranch:'tempo', requires:'ah_ms', unique:true, apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 25; pl.speed *= 1.06; } },
  { id:'ah_hp', name:'Vitality Gem', desc:'+15 Ability Haste, +100 HP', cost:350, treeId:'ah', treeBranch:'vitality', requires:'ah', unique:true, apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.maxHp += 100; pl.hp += 100; } },
  { id:'ah_hp2', name:'Warmogs Heart', desc:'+25 Ability Haste, +200 HP', cost:450, treeId:'ah', treeBranch:'vitality', requires:'ah_hp', unique:true, apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 25; pl.maxHp += 200; pl.hp += 200; } },
  // DEFENSE
  { id:'hp', name:'Ruby Crystal', desc:'+110 HP, +1.5 HP Regen', cost:300, treeId:'def', treeBranch:'core', apply: (pl)=>{ pl.maxHp += 110; pl.hp += 110; pl.hpRegen += 1.5; } },
  { id:'def_ar', name:'Wardens Mail', desc:'+110 HP, +20 Armor', cost:350, treeId:'def', treeBranch:'armor', requires:'hp', unique:true, apply: (pl)=>{ pl.maxHp += 110; pl.hp += 110; pl.armor += 20; } },
  { id:'def_ar2', name:'Sunfire Aegis', desc:'+150 HP, +35 Armor', cost:450, treeId:'def', treeBranch:'armor', requires:'def_ar', unique:true, apply: (pl)=>{ pl.maxHp += 150; pl.hp += 150; pl.armor += 35; } },
  { id:'def_mr', name:'Spectres Cowl', desc:'+110 HP, +20 Magic Resist', cost:350, treeId:'def', treeBranch:'mr', requires:'hp', unique:true, apply: (pl)=>{ pl.maxHp += 110; pl.hp += 110; pl.mr += 20; } },
  { id:'def_mr2', name:'Spirit Visage', desc:'+150 HP, +35 Magic Resist', cost:450, treeId:'def', treeBranch:'mr', requires:'def_mr', unique:true, apply: (pl)=>{ pl.maxHp += 150; pl.hp += 150; pl.mr += 35; } }
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

export function canBuyShopItem(player, item) {
  if (!player || !item) return { ok: false, reason: 'Invalid item' };
  if (player.items && player.items.length >= 25) return { ok: false, reason: 'Inventory is full! (Max 25)' };

  const requiredItems = item.requires ? (Array.isArray(item.requires) ? item.requires : [item.requires]) : [];
  for (const reqId of requiredItems) {
    if (!player.items.includes(reqId)) {
      const reqItem = getShopItem(reqId);
      return { ok: false, reason: `Requires ${reqItem ? reqItem.name : reqId}` };
    }
  }

  if (item.treeId) {
    const ownedBranch = getOwnedTreeBranch(player, item.treeId);
    if (ownedBranch && item.treeBranch && item.treeBranch !== 'core' && ownedBranch !== item.treeBranch) {
      return { ok: false, reason: `Choose one ${item.treeId.toUpperCase()} path` };
    }
    if (ownedBranch && item.treeBranch === 'core') {
      return { ok: false, reason: `${item.treeId.toUpperCase()} path already chosen` };
    }
  }

  if (item.unique && player.items.includes(item.id)) {
    return { ok: false, reason: `You already have ${item.name}!` };
  }

  return { ok: true };
}