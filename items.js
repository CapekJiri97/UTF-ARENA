// Adaptive Power helper — gives AD/AP as % of hero's base stat (cross-class safe)
export const addAdaptive = (pl, pct) => {
  if (pl.dmgType === 'magical') pl.AP = (pl.AP || 0) + Math.round((pl.baseAP_stat || 0) * pct);
  else pl.AD = (pl.AD || 0) + Math.round((pl.baseAD_stat || 0) * pct);
};

/*
OLD ITEMS (commented out per request)

export const shopItems = [
  // ... previous tree-based items ...
];
*/

const BASIC_COST = 250;
const BASIC_STEP = 25;
const SPECIAL_COST = 500;
const SPECIAL_STEP = 40;

const capAdd = (current, add, cap) => {
  if (cap === undefined || cap === null) return current + add;
  return Math.min(cap, current + add);
};

const applyMoveSpeedPct = (pl, pctAdd, capPct) => {
  const base = pl.baseSpeed_stat || pl.speed || 0;
  const currentPct = base > 0 ? (pl.speed - base) / base : 0;
  const nextPct = capPct !== undefined ? Math.min(capPct, currentPct + pctAdd) : (currentPct + pctAdd);
  pl.speed = Math.round(base * (1 + nextPct));
};

export const shopItems = [
  // ── BASIC STATS (250g, +25g per same item) ───────────────────────────
  // Hybrid flat+% design: flat favours low-base carries, % favours high-base tanks.
  // Net result: tanks stay tankier on tank items, carries get a meaningful boost on power items.
  {
    id: 'basic_power', name: 'Basic Power', group: 'basic',
    costBase: BASIC_COST, costStep: BASIC_STEP,
    // 8% base + 7 flat adaptive power
    // Carry (AP 75): +6 AP + 7 = 13 total   Tank (AP 55): +4.4 + 7 = 11.4 total
    // Carries benefit more from repeated stacks; tanks still gain but less per %.
    stats: { powerPct: 0.08, powerFlat: 7 },
    apply: (pl) => { addAdaptive(pl, 0.08); if (pl.dmgType === 'magical') pl.AP = (pl.AP || 0) + 7; else pl.AD = (pl.AD || 0) + 7; }
  },
  {
    id: 'basic_hp', name: 'Basic HP', group: 'basic',
    costBase: BASIC_COST, costStep: BASIC_STEP,
    // 5% base HP + 55 flat HP  (% sníženo o 50%)
    // Carry (HP 590): +30 + 55 = 85 total   Tank (HP 1050): +53 + 55 = 108 total
    stats: { hpPct: 0.05, hpFlat: 55 },
    apply: (pl) => { const h = Math.round((pl.baseMaxHp || pl.maxHp) * 0.05) + 55; pl.maxHp += h; pl.hp += h; }
  },
  {
    id: 'basic_armor', name: 'Basic Armor', group: 'basic',
    costBase: BASIC_COST, costStep: BASIC_STEP,
    // 10% base armor + 3 flat
    // Carry (armor 19): +2 + 3 = 5 total   Tank (armor 42): +4.2 + 3 = 7.2 total
    stats: { armorPct: 0.10, armorFlat: 3 },
    apply: (pl) => { pl.armor += Math.round((pl.baseArmor_stat || pl.armor) * 0.10) + 3; }
  },
  {
    id: 'basic_mr', name: 'Basic MR', group: 'basic',
    costBase: BASIC_COST, costStep: BASIC_STEP,
    // 10% base MR + 3 flat
    stats: { mrPct: 0.10, mrFlat: 3 },
    apply: (pl) => { pl.mr += Math.round((pl.baseMR_stat || pl.mr) * 0.10) + 3; }
  },
  {
    id: 'basic_haste', name: 'Basic Haste', group: 'basic',
    costBase: BASIC_COST, costStep: BASIC_STEP,
    // Pure flat — class-agnostic by nature
    stats: { ahFlat: 13 },
    apply: (pl) => { pl.abilityHaste = (pl.abilityHaste || 0) + 13; }
  },
  {
    id: 'basic_as', name: 'Basic Attack Speed', group: 'basic',
    costBase: BASIC_COST, costStep: BASIC_STEP,
    // Pure flat — class-agnostic (everyone starts at 1.0 base)
    stats: { asFlat: 0.12 },
    apply: (pl) => { pl.attackSpeed += 0.12; }
  },

  // ── SPECIAL EFFECTS (500g, +40g per same item) ───────────────────────
  {
    id: 'special_lifesteal', name: 'Special Lifesteal', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { lifestealPct: 0.05 }, caps: { lifestealPct: 0.25 },
    apply: (pl) => { pl.lifesteal = capAdd(pl.lifesteal || 0, 0.05, 0.25); }
  },
  {
    id: 'special_heal_power', name: 'Special Heal Power', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { healPower: 0.15 }, caps: { healPower: 0.45 },
    apply: (pl) => { pl.healPower = capAdd(pl.healPower || 0, 0.15, 0.45); }
  },
  {
    id: 'special_movespeed', name: 'Special Move Speed', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { msPct: 0.04 }, caps: { msPct: 0.20 },
    apply: (pl) => { applyMoveSpeedPct(pl, 0.04, 0.20); }
  },
  {
    id: 'special_pen', name: 'Special Penetration', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { penPct: 0.18}, caps: { penPct: 0.60 },
    apply: (pl) => { pl.adaptivePen = capAdd(pl.adaptivePen || 0, 0.18, 0.60); }
  },
  {
    id: 'special_burn', name: 'Special Burn Aura', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { maxHpDmgPct: 0.015 }, caps: { maxHpDmgPct: 0.045 },
    apply: (pl) => {
      pl.aoeBurnPct = capAdd(pl.aoeBurnPct || 0, 0.015, 0.045);
    }
  },
  {
    id: 'special_strike_burn', name: 'Special Strike Burn', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { strikeBurnPct: 0.015 }, caps: { strikeBurnPct: 0.045 },
    apply: (pl) => { pl.strikeBurnPct = capAdd(pl.strikeBurnPct || 0, 0.015, 0.045); }
  },
  {
    id: 'special_slow', name: 'Special Slow', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { slowOnHit: 0.06 }, caps: { slowOnHit: 0.30 },
    apply: (pl) => { 
      pl.onHitSlow = capAdd(pl.onHitSlow || 0, 0.06, 0.30); 
      pl.onSpellHitSlow = pl.onHitSlow;
    }
  },
  {
    id: 'special_gw', name: 'Special Grievous Wounds', group: 'special',
    costBase: SPECIAL_COST, costStep: SPECIAL_STEP,
    stats: { grievousWounds: 0.20 }, caps: { grievousWounds: 0.60 },
    apply: (pl) => { pl.antiHeal = capAdd(pl.antiHeal || 0, 0.20, 0.60); }
  }
];

const itemById = new Map(shopItems.map((item) => [item.id, item]));

export function getShopItem(id) {
  return itemById.get(id) || null;
}

export function getItemCount(player, itemId) {
  if (!player || !Array.isArray(player.items)) return 0;
  return player.items.filter((id) => id === itemId).length;
}

export function getUniqueItemCount(player) {
  if (!player || !Array.isArray(player.items)) return 0;
  return new Set(player.items).size;
}

export function getTotalItemCount(player) {
  if (!player || !Array.isArray(player.items)) return 0;
  return player.items.length;
}

export function getItemBuyCost(player, item) {
  if (!item) return 0;
  const owned = player ? getItemCount(player, item.id) : 0;
  const base = item.costBase || item.cost || 0;
  const step = item.costStep || 0;
  return base + step * owned;
}

export function getItemSellPrice(player, item) {
  if (!item) return 0;
  const owned = player ? getItemCount(player, item.id) : 0;
  if (owned <= 0) return 0;
  const base = item.costBase || item.cost || 0;
  const step = item.costStep || 0;
  const paid = base + step * (owned - 1);
  return Math.floor(paid * 0.6);
}

export function canBuyShopItem(player, item) {
  if (!player || !item) return { ok: false, reason: 'Invalid' };

  const total = getTotalItemCount(player);
  if (total >= 20) return { ok: false, reason: 'Max total items reached (20)' };

  const uniqueCount = getUniqueItemCount(player);
  const ownsThis = getItemCount(player, item.id) > 0;
  if (!ownsThis && uniqueCount >= 6) {
    return { ok: false, reason: 'Max different items reached (6)' };
  }

  return { ok: true, reason: '' };
}

export function getBuyBlockReason(player, item) {
  return canBuyShopItem(player, item).reason;
}

export function calcTotalCost(player, item) {
  return getItemBuyCost(player, item);
}
