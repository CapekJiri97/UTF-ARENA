export const SUMMONER_SPELLS = {
  Heal: { name: 'Heal', desc: 'Restore 150 HP (+20/level).', cd: 60 },
  Ghost: { name: 'Ghost', desc: '+40% movement speed for 5s.', cd: 45 },
  Boost: { name: 'Boost', desc: '+10% all stats for 5s.', cd: 30 },
  Rally: { name: 'Rally', desc: 'Speed up capture, heal + empower nearby minions.', cd: 45 },
  Revive: { name: 'Revive', desc: 'Instantly revive on next death.', cd: 90 },
  Exhaust: { name: 'Exhaust', desc: 'Slow nearby enemies 40% for 2s (range 300).', cd: 60 }
};

// ==========================================
// UTF ARENA - HERO EDITOR
// V tomto souboru můžete měnit veškeré parametry hrdinů.
// Vysvětlivky:
// role: 'FIGHTER' | 'TANK' | 'SLAYER' | 'SPLITPUSHER' | 'SUPPORT' - ovlivňuje chování AI bota.
// aaScale: škálování základního útoku (0.3 = 30%).
// hpRegen: základní regenerace HP za sekundu (default: 2.0).
// customMeleeAoE: 'ring' - změní tvar útoku nablízko z kuželu na kruh (např. Hana).
// scaleLevel: kolik poškození/léčení se přidá za každý vylepšený level spellu (defaultně 8 u poškození, 10 u léčení).
// --- LEVEL SCALING (za každý level) ---
// lvlHP:    +HP za level
// lvlArmor: +Armor za level
// lvlMR:    +Magic Resist za level
// lvlPower: +AD nebo +AP za level (podle dmgType)
// lvlAtk:   +baseAtk za level (velmi malý bonus k základnímu auto útoku)
// ==========================================
export const CLASSES = {
  // ==========================================
  // FIGHTER
  // ==========================================

  Vanguard: {
    glyph: 'V', role: 'FIGHTER', range: false, dmgType: 'physical', aaScale: 0.55,
    respawnBase: 7, respawnPerLevel: 1, hpRegen: 2.0,
    hp: 820, speed: 120, attackDelay: 1.4,
    baseAtk: 35, baseAD: 45, baseAP: 0,
    baseArmor: 35, baseMR: 30,
    lvlHP: 30, lvlArmor: 1.0, lvlMR: 0.7, lvlPower: 2.0, lvlAtk: 1.0,
    Q: {
      baseCooldown: 6.0, castTime: 0.05,
      baseDamage: 75, scaleAP: 0, scaleAD: 0.20, dashTime: 0.2,
      type: 'dash', distance: 170, radius: 104, slowDuration: 1.5, slowMod: 0.4,
      desc: 'Dash forward — damage + slow enemies in path (60%, 1.5s).'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.25,
      baseDamage: 90, scaleAP: 0, scaleAD: 0.25,
      type: 'aoe', radius: 140,
      desc: 'Circular AoE strike around self.'
    }
  },

  Jirina: {
    glyph: '❋', role: 'FIGHTER', range: false, dmgType: 'magical', aaScale: 0.35,
    hp: 780, speed: 118, attackDelay: 1.2,
    baseAtk: 45, baseAD: 0, baseAP: 50,
    baseArmor: 38, baseMR: 38,
    lvlHP: 28, lvlArmor: 1.0, lvlMR: 0.8, lvlPower: 1.8, lvlAtk: 1.0,
    Q: {
      baseCooldown: 5.5, castTime: 0.1,
      baseDamage: 65, scaleAP: 0.60, scaleAD: 0,
      type: 'aoe_knockback', radius: 145,
      desc: 'Pressure wave — damage + knock back nearby enemies.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 0, amount: 60, scaleAP: 0.45, scaleAD: 0,
      type: 'heal_aoe', radius: 200,
      desc: 'Heal self + all nearby allies.'
    }
  },

  Bruiser: {
    glyph: 'B', role: 'FIGHTER', range: false, dmgType: 'physical', aaScale: 0.60,
    hp: 760, speed: 120, attackDelay: 1.1,
    baseAtk: 47, baseAD: 48, baseAP: 0,
    baseArmor: 33, baseMR: 28,
    lvlHP: 35, lvlArmor: 1.0, lvlMR: 0.75, lvlPower: 2.2, lvlAtk: 1.0,
    Q: {
      baseCooldown: 6.0, castTime: 0.1,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.40,
      type: 'projectile', pGlyph: 'D', pSpeed: 600, life: 0.4, slowDuration: 1.0, slowMod: 0.25, piercing: true,
      desc: 'Throw weapon — damage + slow all enemies in path (25%, 1s). Pierces through targets.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.05,
      baseDamage: 45, scaleAP: 0, scaleAD: 0.35, dashTime: 0.2,
      type: 'dash', distance: 150, radius: 110,
      desc: 'Leap — damage nearby enemies on landing.'
    }
  },

  // ==========================================
  // TANK
  // ==========================================

  Ironclad: {
    glyph: 'I', role: 'TANK', range: false, dmgType: 'physical', aaScale: 0.45,
    hp: 780, speed: 110, attackDelay: 1.4,
    baseAtk: 45, baseAD: 35, baseAP: 0,
    baseArmor: 36, baseMR: 32,
    lvlHP: 38, lvlArmor: 0.9, lvlMR: 1.3, lvlPower: 2.2, lvlAtk: 0.8,
    Q: {
      baseCooldown: 9.5, castTime: 0.1,
      baseDamage: 25, scaleAP: 0, scaleAD: 0.25, bonusMaxHpDmg: 0.08,
      type: 'shield_explode', amount: 125, duration: 4.0, radius: 144,
      desc: 'Shield (4s). When it breaks or expires: AoE explosion around self.'
    },
    E: {
      baseCooldown: 10.5, castTime: 0.25,
      baseDamage: 70, scaleAP: 0, scaleAD: 0.25,
      type: 'aoe', radius: 135, stunDuration: 1.0,
      desc: 'Ground slam — damage + stun nearby enemies (1s).'
    }
  },

  Hana: {
    glyph: '✿', role: 'TANK', range: false, dmgType: 'magical', aaScale: 0.40, customMeleeAoE: 'ring',
    hp: 760, speed: 118, attackDelay: 1.4,
    baseAtk: 35, baseAD: 0, baseAP: 55,
    baseArmor: 29, baseMR: 29,
    lvlHP: 35, lvlArmor: 1.4, lvlMR: 1.5, lvlPower: 2.0, lvlAtk: 0.8,
    Q: {
      baseCooldown: 12.0, castTime: 0.15,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'hana_q', duration: 5.0, bonusHpDmg: 0.027, bonusAsMult: 1.25,
      desc: '5s: attacks deal bonus max HP damage + gain attack speed.'
    },
    E: {
      baseCooldown: 7.5, castTime: 0.05,
      baseDamage: 65, scaleAP: 0.5, scaleAD: 0, dashTime: 0.2,
      type: 'dash_def', distance: 180, radius: 130, slowDuration: 1.5, slowMod: 0.3,
      desc: 'Dash + defense boost. On landing: damage + slow nearby enemies (70%, 1.5s).'
    }
  },

  Jailer: {
    glyph: 'J', role: 'TANK', range: false, dmgType: 'magical', aaScale: 0.40,
    hp: 820, speed: 105, attackDelay: 1.5,
    baseAtk: 50, baseAD: 0, baseAP: 55,
    baseArmor: 34, baseMR: 34,
    lvlHP: 40, lvlArmor: 1.0, lvlMR: 1.7, lvlPower: 2.0, lvlAtk: 0.8,
    Q: {
      baseCooldown: 10.0, castTime: 0.3,
      baseDamage: 55, scaleAP: 0.5, scaleAD: 0,
      type: 'projectile', pGlyph: ';J;', pSpeed: 850, life: 0.6,
      pullToCaster: true, bonusMaxHpDmg: 0.09,
      desc: 'Hook — damage first enemy hit + pull them to you.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.2,
      baseDamage: 70, scaleAP: 0.4, scaleAD: 0,
      type: 'aoe', radius: 120, slowDuration: 2.0, slowMod: 0.45,
      desc: 'Ground slam — damage + slow nearby enemies (55%, 2s).'
    }
  },

  Goliath: {
    glyph: 'G', role: 'TANK', range: false, dmgType: 'physical', aaScale: 0.50,
    hp: 800, speed: 106, attackDelay: 1.6,
    baseAtk: 45, baseAD: 45, baseAP: 0,
    baseArmor: 34, baseMR: 36,
    lvlHP: 42, lvlArmor: 1.0, lvlMR: 1.6, lvlPower: 2.3, lvlAtk: 0.8,
    Q: {
      baseCooldown: 7.5, castTime: 0.15,
      baseDamage: 25, scaleAP: 0, scaleAD: 0.35, bonusCurrentHpDmg: 0.0375, dashTime: 0.2,
      type: 'dash', distance: 180, radius: 120,
      desc: 'Unstoppable charge — damage all enemies in path.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.1,
      baseDamage: 50, scaleAP: 0, scaleAD: 0, dashTime: 0.15,
      type: 'dash_heal_silence', amount: 80, distance: 50, radius: 120, silenceDuration: 1.5,
      desc: 'Short dash, heal self, silence nearby enemies on landing (1.5s).'
    }
  },

  // ==========================================
  // DPS
  // ==========================================

  Lynx: {
    glyph: 'L', role: 'SLAYER', range: false, dmgType: 'physical', aaScale: 0.60,
    hp: 680, speed: 130, attackDelay: 0.8,
    baseAtk: 55, baseAD: 58, baseAP: 0,
    baseArmor: 28, baseMR: 28,
    lvlHP: 10, lvlArmor: 0.3, lvlMR: 0.2, lvlPower: 1.5, lvlAtk: 0.5,
    Q: {
      baseCooldown: 5.0, castTime: 0.05,
      baseDamage: 45, scaleAP: 0, scaleAD: 0.2,
      type: 'projectile', count: 3, spread: 0.45,
      pGlyph: 'd', pSpeed: 960, life: 0.21,
      desc: '3 daggers in a cone — each hits first enemy in path.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.05,
      baseDamage: 75, scaleAP: 0, scaleAD: 0.35,
      type: 'dash', distance: 50, dashTime: 0.1, radius: 100, msBuff: 0.10, msBuffDuration: 1.0,
      desc: 'Short dash + blade burst — damage nearby enemies, gain 10% MS for 1s.'
    }
  },

  Zephyr: {
    glyph: 'Z', role: 'SPLITPUSHER', range: false, dmgType: 'magical', aaScale: 0.35,
    hp: 750, speed: 135, attackDelay: 0.9,
    baseAtk: 44, baseAD: 0, baseAP: 61,
    baseArmor: 31, baseMR: 31,
    lvlHP: 11, lvlArmor: 0.3, lvlMR: 0.3, lvlPower: 1.4, lvlAtk: 0.5,
    Q: {
      baseCooldown: 10.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0.001, scaleAD: 0,
      type: 'buff_ms', amount: 0.2, duration: 3.0,
      desc: '+20% movement speed for 3s.'
    },
    E: {
      baseCooldown: 5.0, castTime: 0.25,
      baseDamage: 70, scaleAP: 0.80, scaleAD: 0.2,
      type: 'aoe_knockback', radius: 90,
      desc: 'Air burst — damage + knock back nearby enemies.'
    }
  },

  Volstrov: {
    glyph: 'B', role: 'MAGE', range: true, attackRange: 180, dmgType: 'magical', aaScale: 0.60,
    hp: 720, speed: 118, attackDelay: 1.0,
    baseAtk: 30, baseAD: 0, baseAP: 79,
    baseArmor: 32, baseMR: 34,
    lvlHP: 11, lvlArmor: 0.3, lvlMR: 0.4, lvlPower: 1.5, lvlAtk: 0.5,
    Q: {
      baseCooldown: 13.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'volstrov_q', duration: 3.0, bonusAsMult: 1.5, bonusRange: 80, msSlow: 0.5,
      desc: '3s: attacks gain range (+80), pierce all enemies in path, +50% attack speed. -50% movement speed.'
    },
    E: {
      baseCooldown: 10.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0.30, scaleAD: 0, amount: 50, dashTime: 0.12,
      type: 'volstrov_e', distance: 60, duration: 1.5,
      desc: 'Short dash + small shield (1.5s). Reduces Q remaining cooldown by 50%.'
    }
  },

  Reaper: {
    glyph: 'R', role: 'SPLITPUSHER', range: false, dmgType: 'magical', aaScale: 0.40,
    hp: 650, speed: 120, attackDelay: 0.82,
    baseAtk: 45, baseAD: 0, baseAP: 58,
    baseArmor: 28, baseMR: 30,
    lvlHP: 10, lvlArmor: 0.2, lvlMR: 0.3, lvlPower: 1.5, lvlAtk: 0.5,
    Q: {
      baseCooldown: 10.0, castTime: 0.15,
      baseDamage: 20, scaleAP: 0.50, scaleAD: 0,
      type: 'reaper_q', charges: 3, bonusRange: 70, scaleLevel: 6,
      desc: '4s: next 3 attacks gain range, bonus damage + slow target (40%, 1s).'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0.7, scaleAD: 0, amount: 60, dashTime: 0.15,
      type: 'reaper_e', distance: 75, duration: 1.5,
      desc: 'Short dash. Shield + 40% MS for 1.5s. Resets Q cooldown!'
    }
  },

  Wanderer: {
    glyph: 'W', role: 'SLAYER', range: false, dmgType: 'physical', aaScale: 0.55,
    hp: 700, speed: 125, attackDelay: 0.9,
    baseAtk: 40, baseAD: 68, baseAP: 0,
    baseArmor: 31, baseMR: 31,
    lvlHP: 10, lvlArmor: 0.3, lvlMR: 0.2, lvlPower: 1.5, lvlAtk: 0.5,
    Q: {
      baseCooldown: 9.0, castTime: 0.0,
      baseDamage: 25, scaleAP: 0, scaleAD: 0.3, scaleLevel: 3,
      type: 'spin_to_win', duration: 2.0, tickRate: 0.25, radius: 80,
      desc: 'Spin 2s — repeatedly damage nearby enemies. Move while spinning.'
    },
    E: {
      baseCooldown: 16.0, castTime: 0.35,
      baseDamage: 40, scaleAP: 0, scaleAD: 0.4, scaleLevel: 8,
      type: 'omnislash', count: 5, tickRate: 0.2, distance: 250, dashTime: 0.2,
      desc: 'Dash — on hit: blink 5× to nearby enemies, strike each.'
    }
  },

  Kratoma: {
    glyph: 'K', role: 'SLAYER', range: true, attackRange: 160, dmgType: 'physical', aaScale: 0.5,
    hp: 650, speed: 115, attackDelay: 1.1,
    baseAtk: 30, baseAD: 65, baseAP: 0,
    baseArmor: 28, baseMR: 28,
    lvlHP: 10, lvlArmor: 0.3, lvlMR: 0.2, lvlPower: 1.5, lvlAtk: 0.5,
    projCount: 3, projSpread: 0.3,
    Q: {
      baseCooldown: 13.0, castTime: 0.7,
      baseDamage: 40, scaleAP: 0, scaleAD: 0.55,
      type: 'projectile_summon', pGlyph: 'b', pSpeed: 800,
      summonGlyph: 'b', summonHp: 50, summonAd: 30, slowDuration: 2, spawnDeathTimer: 6,
      desc: 'Projectile — damage + slow first enemy hit. Summons Pheasant pet on impact (dies in 6s).'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0.3,
      type: 'buff_ad_as', duration: 4.0, amount: 0.25, shieldAmount: 40, scaleLevel: 15,
      desc: '4s: bonus AD + AS. Gain a shield (+0.3 AD scaling).'
    }
  },

  Quiller: {
    glyph: 'Q', role: 'SLAYER', range: true, dmgType: 'physical', aaScale: 0.75,
    hp: 620, speed: 110, attackDelay: 0.9,
    baseAtk: 30, baseAD: 75, baseAP: 0,
    baseArmor: 25, baseMR: 27,
    lvlHP: 10, lvlArmor: 0.2, lvlMR: 0.2, lvlPower: 1.5, lvlAtk: 0.5,
    Q: {
      baseCooldown: 6.5, castTime: 0.4,
      baseDamage: 40, scaleAP: 0, scaleAD: 0.40,
      type: 'projectile', pGlyph: '»', pSpeed: 1200,
      desc: 'Long-range bolt — damages first enemy hit.'
    },
    E: {
      baseCooldown: 13.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'dash', distance: 250, dashTime: 0.2,
      desc: 'Long dash — repositioning (range 297).'
    }
  },

  Fusilier: {
    glyph: 'F', role: 'SLAYER', range: true, dmgType: 'physical', aaScale: 0.7,
    hp: 670, speed: 115, attackDelay: 0.85,
    baseAtk: 30, baseAD: 72, baseAP: 0,
    baseArmor: 27, baseMR: 28,
    lvlHP: 10, lvlArmor: 0.3, lvlMR: 0.2, lvlPower: 1.5, lvlAtk: 0.5,
    Q: {
      baseCooldown: 6.0, castTime: 0.25,
      baseDamage: 25, scaleAP: 0, scaleAD: 0.20,
      type: 'projectile', count: 5, spread: 0.25, pGlyph: 'x', pSpeed: 1100, life: 0.25,
      desc: '5-shot cone volley. Lethal at point-blank range.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 68, scaleAP: 0, scaleAD: 0.35,
      type: 'cone_knockback', radius: 80, cone: 90 * Math.PI / 180,
      desc: 'Sweeping arc forward — damage + knock back enemies.'
    }
  },

  // ==========================================
  // MAGE
  // ==========================================

  Mage: {
    glyph: 'M', role: 'MAGE', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 720, speed: 112, attackDelay: 1.4,
    baseAtk: 30, baseAD: 0, baseAP: 78,
    baseArmor: 34, baseMR: 36,
    lvlHP: 11, lvlArmor: 0.4, lvlMR: 0.4, lvlPower: 1.6, lvlAtk: 0.4,
    Q: {
      baseCooldown: 3.9, castTime: 0.3,
      baseDamage: 95, scaleAP: 0.65, scaleAD: 0,
      type: 'projectile', pGlyph: 'O', pSpeed: 750,
      desc: 'Magic orb — damages first enemy hit. Short CD.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.6,
      baseDamage: 95, scaleAP: 0.70, scaleAD: 0,
      type: 'aoe', radius: 140, slowDuration: 0.5, slowMod: 0.80,
      desc: 'AoE explosion at target location — damage + 20% slow (0.5s).'
    }
  },

  Summoner: {
    glyph: 'S', role: 'MAGE', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 710, speed: 108, attackDelay: 1.3,
    baseAtk: 30, baseAD: 0, baseAP: 83,
    baseArmor: 31, baseMR: 28,
    lvlHP: 11, lvlArmor: 0.3, lvlMR: 0.3, lvlPower: 1.5, lvlAtk: 0.4,
    Q: {
      baseCooldown: 6.0, castTime: 0.3,
      baseDamage: 55, scaleAP: 0.80, scaleAD: 0,
      type: 'projectile', pGlyph: 's', pSpeed: 750, silenceDuration: 1.0, slowDuration: 1.0, slowMod: 0.4,
      desc: 'Shadow bolt — damage + 60% slow + 1s silence.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.6,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0,
      type: 'summon', count: 2, mGlyph: 'g', spawnDeathTimer: 8,
      desc: 'Summon 2 ghouls that attack nearby enemies (die in 8s, 15% max HP/sec).'
    }
  },

  Pyromancer: {
    glyph: 'P', role: 'SLAYER', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 660, speed: 115, attackDelay: 1.3,
    baseAtk: 34, baseAD: 0, baseAP: 84,
    baseArmor: 28, baseMR: 31,
    lvlHP: 10, lvlArmor: 0.3, lvlMR: 0.3, lvlPower: 1.5, lvlAtk: 0.4,
    Q: {
      baseCooldown: 8.0, castTime: 0.0,
      baseDamage: 250, scaleAP: 1.07, scaleAD: 0, scaleLevel: 20,
      type: 'flamethrower', duration: 3.0, range: 160, cone: 40 * Math.PI / 180, tickRate: 0.10,
      desc: '3s cone flamethrower. Move freely while channeling.'
    },
    E: {
      baseCooldown: 10.0, castTime: 0.2,
      baseDamage: 60, scaleAP: 0.55, scaleAD: 0, scaleLevel: 10,
      type: 'aoe_knockback', radius: 140,
      desc: 'Instant fire explosion — damage + knock back nearby enemies.'
    }
  },

  Tamer: {
    glyph: 'T', role: 'MAGE', range: true, attackRange: 205, dmgType: 'magical', aaScale: 0.2,
    hp: 600, speed: 110, attackDelay: 1.1,
    baseAtk: 25, baseAD: 0, baseAP: 72,
    baseArmor: 21, baseMR: 26,
    lvlHP: 10, lvlArmor: 0.2, lvlMR: 0.3, lvlPower: 1.4, lvlAtk: 0.4,
    Q: {
      baseCooldown: 7.0, castTime: 0.15,
      baseDamage: 76, scaleAP: 0.45, scaleAD: 0,
      type: 'tamer_q', pGlyph: 't', pSpeed: 850, life: 0.4, noHitParticles: true,
      desc: 'Magic sphere — damage + mark enemy. Wolf prioritizes marked target.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.3,
      baseDamage: 0, scaleAP: 0.6, scaleAD: 0, amount: 195, scaleLevel: 22,
      type: 'tamer_e',
      desc: 'Heal Wolf if alive. If dead: 3s revive ritual (50% HP). Interrupted by stun.'
    }
  },

  // ==========================================
  // SUPPORT
  // ==========================================

  Healer: {
    glyph: 'H', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.2,
    hp: 700, speed: 104, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 65,
    baseArmor: 40, baseMR: 35,
    lvlHP: 12, lvlArmor: 0.7, lvlMR: 0.6, lvlPower: 1.2, lvlAtk: 0.3,
    Q: {
      baseCooldown: 5.5, castTime: 0.3,
      baseDamage: 65, scaleAP: 0.6, scaleAD: 0,
      type: 'projectile', pGlyph: '+', pSpeed: 660, slowDuration: 1.5, slowMod: 0.5,
      desc: 'Light beam — damage + slow first enemy hit (50%, 1.5s).'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 0, amount: 150, scaleAP: 0.80, scaleAD: 0,
      type: 'heal_aoe', radius: 200,
      desc: 'Healing wave — heals all nearby allies.'
    }
  },

  Cleric: {
    glyph: 'C', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 680, speed: 108, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 70,
    baseArmor: 27, baseMR: 30,
    lvlHP: 12, lvlArmor: 0.5, lvlMR: 0.5, lvlPower: 1.2, lvlAtk: 0.3,
    Q: {
      baseCooldown: 6.0, castTime: 0.3,
      baseDamage: 0, amount: 80, scaleAP: 0.65, scaleAD: 0,
      type: 'heal_aoe', radius: 120, selfHealPenalty: 0.7,
      desc: 'Healing pulse — heals nearby allies.'
    },
    E: {
      baseCooldown: 6.5, castTime: 0.4,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0,
      type: 'projectile', count: 3, spread: 0.25, silenceDuration: 1.0,
      pGlyph: '*', pSpeed: 850,
      desc: '3 bolts in a cone — damage + silence enemies hit (1s).'
    }
  },

  Eggchanter: {
    glyph: 'E', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 690, speed: 105, attackDelay: 1.3,
    baseAtk: 27, baseAD: 0, baseAP: 66,
    baseArmor: 27, baseMR: 30,
    lvlHP: 12, lvlArmor: 0.5, lvlMR: 0.5, lvlPower: 1.2, lvlAtk: 0.3,
    Q: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 30, scaleAP: 0.83, scaleAD: 0, amount: 6.6,
      type: 'projectile_egg', pSpeed: 400, life: 0.625, healInterval: 1.0, slowDuration: 0.5, slowMod: 0.20,
      desc: 'Throw egg — damage + slow target. On impact: Hen hatches, heals + damages nearby enemies.'
    },
    E: {
      baseCooldown: 18.0, castTime: 0.4,
      baseDamage: 0, amount: 6.6, scaleAP: 0.46, scaleAD: 0,
      type: 'summon_healers', healInterval: 2,
      desc: 'Summon 3 Chicks — follow allies, heal them + damage nearby enemies.'
    }
  },

  Oracle: {
    glyph: 'O', role: 'MAGE', range: true, dmgType: 'physical', aaScale: 0.65,
    hp: 670, speed: 110, attackDelay: 1.1,
    baseAtk: 25, baseAD: 70, baseAP: 0,
    baseArmor: 28, baseMR: 31,
    lvlHP: 11, lvlArmor: 0.3, lvlMR: 0.3, lvlPower: 1.4, lvlAtk: 0.5,
    Q: {
      baseCooldown: 13.0, castTime: 0.25,
      baseDamage: 90, scaleAP: 0, scaleAD: 0.30, scaleLevel: 10,
      type: 'projectile_pull', pSpeed: 650, life: 0.5, radius: 120, pGlyph: 'O', stunDuration: 1.2,
      desc: 'Orb — AoE explosion on impact: damage + pull + stun nearby enemies (1.2s).'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.2,
      baseDamage: 0, scaleAP: 0, scaleAD: 0.50, amount: 80, scaleLevel: 12, duration: 5.0,
      type: 'shield_aoe', radius: 250,
      desc: 'Shield self + all nearby allies (5s).'
    }
  },

  Doctor: {
    glyph: 'D', role: 'SUPPORT', range: false, dmgType: 'physical', aaScale: 0.40,
    hp: 650, speed: 118, attackDelay: 1.1,
    baseAtk: 30, baseAD: 55, baseAP: 0,
    baseArmor: 27, baseMR: 27,
    lvlHP: 12, lvlArmor: 0.5, lvlMR: 0.5, lvlPower: 1.2, lvlAtk: 0.3,
    Q: {
      baseCooldown: 6.2, castTime: 0.0,
      baseDamage: 0, scaleAP: 0, scaleAD: 0.065, amount: 2.6, scaleLevel: 0.65, range: 200, tickRate: 0.1,
      type: 'heal_beam',
      desc: 'Toggle: continuous heal beam to nearest ally (range 200). Auto Uber after 5s.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.15,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.2, scaleLevel: 8,
      type: 'cone_slow_shield', radius: 120, cone: 90 * Math.PI / 180, slowDuration: 1.5, slowMod: 0.6, shieldAmount: 90, duration: 2.5,
      desc: 'Slash forward — damage + slow enemies. Gain a shield.'
    }
  }
};