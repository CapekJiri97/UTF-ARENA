export const shopItems = [
  { id:'ad', name:'Long Sword', desc:'+15 AD', cost:300, treeId:'ad', treeBranch:'core', apply: (pl)=>{ pl.AD += 15; } },
  { id:'ad_ls', name:'Vampiric Blade', desc:'+10 AD, +6% Lifesteal', cost:350, treeId:'ad', treeBranch:'lifesteal', requires:'ad', unique:true, apply: (pl)=>{ pl.AD += 10; pl.lifesteal = (pl.lifesteal || 0) + 0.06; } },
  { id:'ad_ls2', name:'Bloodletter Blade', desc:'+15 AD, +6% Lifesteal', cost:450, treeId:'ad', treeBranch:'lifesteal', requires:'ad_ls', unique:true, apply: (pl)=>{ pl.AD += 15; pl.lifesteal = (pl.lifesteal || 0) + 0.06; } },
  { id:'ad_pen', name:'Serrated Edge', desc:'+10 AD, +6 Armor Pen', cost:350, treeId:'ad', treeBranch:'armorpen', requires:'ad', unique:true, apply: (pl)=>{ pl.AD += 10; pl.armorPenFlat = (pl.armorPenFlat || 0) + 6; } },
  { id:'ad_pen2', name:'Executioner Edge', desc:'+15 AD, +6 Armor Pen', cost:450, treeId:'ad', treeBranch:'armorpen', requires:'ad_pen', unique:true, apply: (pl)=>{ pl.AD += 15; pl.armorPenFlat = (pl.armorPenFlat || 0) + 6; } },
  { id:'ap', name:'Amplifying Tome', desc:'+15 AP', cost:300, treeId:'ap', treeBranch:'core', apply: (pl)=>{ pl.AP += 15; } },
  { id:'ap_vamp', name:'Soul Talisman', desc:'+10 AP, +6% Spell Vamp', cost:350, treeId:'ap', treeBranch:'vamp', requires:'ap', unique:true, apply: (pl)=>{ pl.AP += 10; pl.spellVamp = (pl.spellVamp || 0) + 0.06; } },
  { id:'ap_vamp2', name:'Lifeweave Prism', desc:'+15 AP, +6% Spell Vamp', cost:450, treeId:'ap', treeBranch:'vamp', requires:'ap_vamp', unique:true, apply: (pl)=>{ pl.AP += 15; pl.spellVamp = (pl.spellVamp || 0) + 0.06; } },
  { id:'ap_pen', name:'Arcane Needle', desc:'+10 AP, +6 Magic Pen', cost:350, treeId:'ap', treeBranch:'magicpen', requires:'ap', unique:true, apply: (pl)=>{ pl.AP += 10; pl.magicPenFlat = (pl.magicPenFlat || 0) + 6; } },
  { id:'ap_pen2', name:'Void Prism', desc:'+15 AP, +6 Magic Pen', cost:450, treeId:'ap', treeBranch:'magicpen', requires:'ap_pen', unique:true, apply: (pl)=>{ pl.AP += 15; pl.magicPenFlat = (pl.magicPenFlat || 0) + 6; } },
  { id:'as', name:'Dagger', desc:'+20% Attack Speed', cost:300, treeId:'as', treeBranch:'core', apply: (pl)=>{ pl.attackSpeed += 0.20; } },
  { id:'as_ms', name:'Swift Dagger', desc:'+20% Attack Speed, +3% Move Speed', cost:350, treeId:'as', treeBranch:'tempo', requires:'as', unique:true, apply: (pl)=>{ pl.attackSpeed += 0.20; pl.speed *= 1.03; } },
  { id:'armor', name:'Cloth Armor', desc:'+15 Armor', cost:300, apply: (pl)=>{ pl.armor += 15; } },
  { id:'mr', name:'Null-Magic Mantle', desc:'+15 Magic Resist', cost:300, apply: (pl)=>{ pl.mr += 15; } },
  { id:'hp', name:'Ruby Crystal', desc:'+110 HP, +1.5 HP Regen', cost:300, apply: (pl)=>{ pl.maxHp += 110; pl.hp += 110; pl.hpRegen += 1.5; } },
  { id:'ah', name:'Kindlegem', desc:'+15 Ability Haste', cost:300, treeId:'ah', treeBranch:'core', apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; } },
  { id:'ah_ms', name:'Quick Gem', desc:'+15 Ability Haste, +3% Move Speed', cost:350, treeId:'ah', treeBranch:'tempo', requires:'ah', unique:true, apply: (pl)=>{ pl.abilityHaste = (pl.abilityHaste || 0) + 15; pl.speed *= 1.03; } }
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