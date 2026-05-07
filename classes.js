export const SUMMONER_SPELLS = {
  Heal: { name: 'Heal', desc: 'Restores 150 HP + 20 per level.', cd: 60 },
  Ghost: { name: 'Ghost', desc: 'Increases movement speed by +40% for 5s.', cd: 45 },
  Boost: { name: 'Boost', desc: 'Increases all stats (+10%) for 5s.', cd: 30 },
  Rally: { name: 'Rally', desc: 'Speeds up capture, heals and empowers nearby minions.', cd: 45 },
  Revive: { name: 'Revive', desc: 'Instantly revive upon death.', cd: 90 },
  Exhaust: { name: 'Exhaust', desc: 'Slows nearby enemies (300 units) by 40% for 2s.', cd: 45 }
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
// ==========================================
export const CLASSES = {
  // ==========================================
  // FIGHTER
  // ==========================================

  Vanguard: {
    glyph: 'V', role: 'FIGHTER', range: false, dmgType: 'physical', aaScale: 0.50,
    respawnBase: 7, respawnPerLevel: 1, hpRegen: 2.0,
    hp: 1000, speed: 120, attackDelay: 1.4,
    baseAtk: 45, baseAD: 45, baseAP: 0,
    baseArmor: 35, baseMR: 30,
    Q: {
      baseCooldown: 6.0, castTime: 0.05,
      baseDamage: 75, scaleAP: 0.2, scaleAD: 0.25, dashTime: 0.2,
      type: 'dash', distance: 198, radius: 104, slowDuration: 1.5, slowMod: 0.4,
      desc: 'Dashes forward, dealing damage and heavily slowing enemies in the path.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.25,
      baseDamage: 90, scaleAP: 0.15, scaleAD: 0.35,
      type: 'aoe', radius: 136,
      desc: 'Performs a circular strike, dealing damage to all nearby enemies.'
    }
  },

  Jirina: {
    glyph: '❋', role: 'FIGHTER', range: false, dmgType: 'magical', aaScale: 0.30,
    hp: 950, speed: 118, attackDelay: 1.2,
    baseAtk: 40, baseAD: 0, baseAP: 55,
    baseArmor: 38, baseMR: 38,
    Q: {
      baseCooldown: 5.5, castTime: 0.1,
      baseDamage: 65, scaleAP: 0.45, scaleAD: 0.2,
      type: 'aoe_knockback', radius: 144,
      desc: 'Creates a pressure wave that damages and knocks back nearby enemies.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 0, amount: 85, scaleAP: 0.55, scaleAD: 0.15,
      type: 'heal_aoe', radius: 200,
      desc: 'Heals herself and all allies in range.'
    }
  },

  Bruiser: {
    glyph: 'B', role: 'FIGHTER', range: false, dmgType: 'physical', aaScale: 0.50,
    hp: 880, speed: 120, attackDelay: 1.1,
    baseAtk: 50, baseAD: 48, baseAP: 0,
    baseArmor: 33, baseMR: 28,
    Q: {
      baseCooldown: 6.0, castTime: 0.1,
      baseDamage: 60, scaleAP: 0.2, scaleAD: 0.55,
      type: 'projectile', pGlyph: 'D', pSpeed: 600, life: 0.4,
      desc: 'Hurls a heavy weapon that hits the first enemy in its path. Damage scales heavily with Attack Damage.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.05,
      baseDamage: 45, scaleAP: 0.25, scaleAD: 0.5, dashTime: 0.2,
      type: 'dash', distance: 198, radius: 110,
      desc: 'Leaps to a target location, dealing damage to nearby enemies on landing. Damage scales heavily with Attack Damage.'
    }
  },

  // ==========================================
  // TANK
  // ==========================================

  Ironclad: {
    glyph: 'I', role: 'TANK', range: false, dmgType: 'physical', aaScale: 0.35,
    hp: 1100, speed: 100, attackDelay: 1.4,
    baseAtk: 50, baseAD: 35, baseAP: 0,
    baseArmor: 48, baseMR: 43,
    Q: {
      baseCooldown: 9.5, castTime: 0.1,
      baseDamage: 45, scaleAP: 0.25, scaleAD: 0.25, bonusMaxHpDmg: 0.03,
      type: 'shield_explode', amount: 125, duration: 4.0, radius: 144,
      desc: 'Creates a temporary shield. If the shield is broken or expires, it explodes and damages nearby enemies.'
    },
    E: {
      baseCooldown: 10.5, castTime: 0.25,
      baseDamage: 74, scaleAP: 0.15, scaleAD: 0.15,
      type: 'aoe', radius: 144, stunDuration: 1.0,
      desc: 'Slams the ground, dealing damage to all nearby enemies and stunning them for 1 second.'
    }
  },

  Hana: {
    glyph: '✿', role: 'TANK', range: false, dmgType: 'magical', aaScale: 0.35, customMeleeAoE: 'ring',
    hp: 1050, speed: 120, attackDelay: 1.2,
    baseAtk: 50, baseAD: 0, baseAP: 50,
    baseArmor: 40, baseMR: 40,
    Q: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'hana_q', duration: 5.0, bonusHpDmg: 0.018, bonusAsMult: 1.25,
      desc: 'For 5 seconds, empowers her attacks to deal bonus damage based on her max HP. Also gains bonus attack speed and minor regeneration.'
    },
    E: {
      baseCooldown: 7.5, castTime: 0.05,
      baseDamage: 65, scaleAP: 0.5, scaleAD: 0.25, dashTime: 0.2,
      type: 'dash_def', distance: 225, radius: 128, slowDuration: 1.5, slowMod: 0.3,
      desc: 'Performs a quick dash and temporarily increases her defense. On landing, damages and heavily slows nearby enemies.'
    }
  },

  Jailer: {
    glyph: 'J', role: 'TANK', range: false, dmgType: 'magical', aaScale: 0.30,
    hp: 1150, speed: 105, attackDelay: 1.5,
    baseAtk: 40, baseAD: 0, baseAP: 45,
    baseArmor: 45, baseMR: 45,
    Q: {
      baseCooldown: 10.0, castTime: 0.3,
      baseDamage: 55, scaleAP: 0.5, scaleAD: 0,
      type: 'projectile', pGlyph: 'J', pSpeed: 820, life: 0.6,
      pullToCaster: true, bonusMaxHpDmg: 0.04,
      desc: 'Fires a hook that damages the first enemy hit and pulls them toward the caster.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.2,
      baseDamage: 70, scaleAP: 0.4, scaleAD: 0,
      type: 'aoe', radius: 120, slowDuration: 2.0, slowMod: 0.45,
      desc: 'Slams the ground, dealing damage to nearby enemies and slowing them by 55% for 2 seconds.'
    }
  },

  Goliath: {
    glyph: 'G', role: 'TANK', range: false, dmgType: 'physical', aaScale: 0.40,
    hp: 1200, speed: 96, attackDelay: 1.6,
    baseAtk: 55, baseAD: 40, baseAP: 0,
    baseArmor: 50, baseMR: 50,
    Q: {
      baseCooldown: 7.5, castTime: 0.15,
      baseDamage: 25, scaleAP: 0.2, scaleAD: 0.35, bonusCurrentHpDmg: 0.025, dashTime: 0.2,
      type: 'dash', distance: 225, radius: 120,
      desc: 'Performs an unstoppable charge forward, dealing damage to all enemies in the path.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.1,
      baseDamage: 50, scaleAP: 0.25, scaleAD: 0, dashTime: 0.15,
      type: 'dash_heal_silence', amount: 80, distance: 80, radius: 120, silenceDuration: 1.5,
      desc: 'Performs a short dash, heals a portion of HP, and silences all nearby enemies for 1.5 seconds on landing.'
    }
  },

  // ==========================================
  // DPS
  // ==========================================

  Lynx: {
    glyph: 'L', role: 'SLAYER', range: false, dmgType: 'physical', aaScale: 0.55,
    hp: 580, speed: 130, attackDelay: 0.8,
    baseAtk: 50, baseAD: 55, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    Q: {
      baseCooldown: 5.0, castTime: 0.05,
      baseDamage: 65, scaleAP: 0.15, scaleAD: 0.2,
      type: 'projectile', count: 3, spread: 0.45,
      pGlyph: 'd', pSpeed: 960, life: 0.21,
      desc: 'Throws three daggers in a cone, dealing damage to enemies hit. High base damage.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.05,
      baseDamage: 95, scaleAP: 0.25, scaleAD: 0.45,
      type: 'aoe', radius: 96,
      desc: 'Creates a blade explosion that damages all enemies in close proximity.'
    }
  },

  Zephyr: {
    glyph: 'Z', role: 'SPLITPUSHER', range: false, dmgType: 'magical', aaScale: 0.20,
    hp: 650, speed: 135, attackDelay: 0.9,
    baseAtk: 40, baseAD: 0, baseAP: 55,
    baseArmor: 25, baseMR: 25,
    Q: {
      baseCooldown: 10.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0.001, scaleAD: 0.003,
      type: 'buff_ms', amount: 0.2, duration: 3.0,
      desc: 'Briefly increases movement speed. Bonus scales with Ability Power.'
    },
    E: {
      baseCooldown: 5.0, castTime: 0.25,
      baseDamage: 75, scaleAP: 0.7, scaleAD: 0.2,
      type: 'aoe_knockback', radius: 90,
      desc: 'Creates a powerful air burst that damages and violently knocks back nearby enemies.'
    }
  },

  Reaper: {
    glyph: 'R', role: 'SPLITPUSHER', range: false, dmgType: 'magical', aaScale: 0.50,
    hp: 500, speed: 120, attackDelay: 0.82,
    baseAtk: 35, baseAD: 0, baseAP: 40,
    baseArmor: 18, baseMR: 20,
    Q: {
      baseCooldown: 10.0, castTime: 0.15,
      baseDamage: 20, scaleAP: 0.40, scaleAD: 0.15,
      type: 'reaper_q', charges: 3, bonusRange: 70, scaleLevel: 6,
      desc: 'For 4 seconds, empowers the next 3 basic attacks. They gain extended range, bonus damage, and slow the target by 40% for 1s.'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0.7, scaleAD: 0.25, amount: 60, dashTime: 0.15,
      type: 'reaper_e', distance: 80, duration: 1.5,
      desc: 'Short dash (100). Grants a shield and 40% movement speed for 1.5s. Instantly resets the Q cooldown!'
    }
  },

  Wanderer: {
    glyph: 'W', role: 'SLAYER', range: false, dmgType: 'physical', aaScale: 0.50,
    hp: 600, speed: 125, attackDelay: 0.9,
    baseAtk: 45, baseAD: 60, baseAP: 0,
    baseArmor: 25, baseMR: 25,
    Q: {
      baseCooldown: 9.0, castTime: 0.0,
      baseDamage: 18, scaleAP: 0, scaleAD: 0.2, scaleLevel: 2,
      type: 'spin_to_win', duration: 2.0, tickRate: 0.25, radius: 80,
      desc: 'Blade Whirl: Spins in place for 2.5 seconds, dealing damage to nearby enemies with slightly increased speed. You can move while spinning!'
    },
    E: {
      baseCooldown: 16.0, castTime: 0.35,
      baseDamage: 46, scaleAP: 0, scaleAD: 0.45, scaleLevel: 8,
      type: 'omnislash', count: 4, tickRate: 0.2, distance: 150, dashTime: 0.12,
      desc: 'Omnislash: Dashes forward with lightning speed. If an enemy is hit, becomes invulnerable and blinks 5 times to random nearby enemies, striking each one hard.'
    }
  },

  Kratoma: {
    glyph: 'K', role: 'SLAYER', range: true, attackRange: 160, dmgType: 'physical', aaScale: 0.40,
    hp: 600, speed: 115, attackDelay: 1.0,
    baseAtk: 35, baseAD: 65, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    projCount: 3, projSpread: 0.3,
    Q: {
      baseCooldown: 12.0, castTime: 0.7,
      baseDamage: 46, scaleAP: 0.25, scaleAD: 0.55,
      type: 'projectile_summon', pGlyph: 'b', pSpeed: 800,
      summonGlyph: 'b', summonHp: 80, summonAd: 50, slowDuration: 2,
      desc: 'Fires a projectile that damages and slows the first enemy hit. On impact, summons a Pheasant to fight at her side.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'buff_ad_as', duration: 4.0, amount: 0.25, shieldAmount: 70,
      desc: 'For 4 seconds, increases Attack Damage and Attack Speed. Also gains a small protective shield.'
    }
  },

  Quiller: {
    glyph: 'Q', role: 'SLAYER', range: true, dmgType: 'physical', aaScale: 0.50,
    hp: 550, speed: 110, attackDelay: 1.2,
    baseAtk: 55, baseAD: 80, baseAP: 0,
    baseArmor: 15, baseMR: 15,
    Q: {
      baseCooldown: 3.0, castTime: 0.4,
      baseDamage: 60, scaleAP: 0.25, scaleAD: 0.7,
      type: 'projectile', pGlyph: '»', pSpeed: 1200,
      desc: 'Fires a long-range bolt that damages the first enemy hit. Damage scales heavily with Attack Damage.'
    },
    E: {
      baseCooldown: 13.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'dash', distance: 297, dashTime: 0.2,
      desc: 'Performs a long dash, allowing rapid repositioning.'
    }
  },

  Fusilier: {
    glyph: 'F', role: 'SLAYER', range: true, dmgType: 'physical', aaScale: 0.40,
    hp: 580, speed: 115, attackDelay: 0.9,
    baseAtk: 40, baseAD: 78, baseAP: 0,
    baseArmor: 17, baseMR: 17,
    Q: {
      baseCooldown: 5.0, castTime: 0.15,
      baseDamage: 40, scaleAP: 0, scaleAD: 0.3,
      type: 'projectile', count: 5, spread: 0.25, pGlyph: ':', pSpeed: 1100, life: 0.25,
      desc: 'Fires a volley of 5 projectiles in a wide cone. Great for area damage or a massive point-blank shotgun burst.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 68, scaleAP: 0, scaleAD: 0.55,
      type: 'cone_knockback', radius: 110, cone: 90 * Math.PI / 180,
      desc: 'Fires a sweeping arc forward, dealing damage and violently knocking back enemies.'
    }
  },

  // ==========================================
  // MAGE
  // ==========================================

  Mage: {
    glyph: 'M', role: 'SLAYER', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 620, speed: 112, attackDelay: 1.4,
    baseAtk: 35, baseAD: 0, baseAP: 70,
    baseArmor: 15, baseMR: 30,
    Q: {
      baseCooldown: 3.5, castTime: 0.3,
      baseDamage: 115, scaleAP: 0.55, scaleAD: 0.15,
      type: 'projectile', pGlyph: 'O', pSpeed: 750,
      desc: 'Fires a magic orb that damages the first enemy hit. High base damage.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.6,
      baseDamage: 100, scaleAP: 0.60, scaleAD: 0.2,
      type: 'aoe', radius: 160,
      desc: 'Creates an area explosion of magic energy at a target location, dealing damage to all enemies in the area.'
    }
  },

  Summoner: {
    glyph: 'S', role: 'SLAYER', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 620, speed: 108, attackDelay: 1.3,
    baseAtk: 30, baseAD: 0, baseAP: 80,
    baseArmor: 22, baseMR: 22,
    Q: {
      baseCooldown: 4.0, castTime: 0.3,
      baseDamage: 85, scaleAP: 0.75, scaleAD: 0.2,
      type: 'projectile', pGlyph: '~', pSpeed: 750,
      desc: 'Fires a shadow projectile that damages the first enemy hit. Damage scales heavily with Ability Power.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.6,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0.15,
      type: 'summon', count: 2, mGlyph: 'g',
      desc: 'Summons two ghouls that fight at his side, attacking nearby enemies.'
    }
  },

  Pyromancer: {
    glyph: 'P', role: 'SLAYER', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 600, speed: 110, attackDelay: 1.3,
    baseAtk: 30, baseAD: 0, baseAP: 75,
    baseArmor: 18, baseMR: 25,
    Q: {
      baseCooldown: 8.0, castTime: 0.0,
      baseDamage: 250, scaleAP: 0.90, scaleAD: 0, scaleLevel: 20,
      type: 'flamethrower', duration: 3.0, range: 160, cone: 40 * Math.PI / 180, tickRate: 0.10,
      desc: 'Flamethrower: For 3.0 seconds, unleashes a continuous stream of fire in a cone. Massively damages enemies while allowing free movement!'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 80, scaleAP: 0.45, scaleAD: 0, scaleLevel: 10,
      type: 'aoe_knockback', radius: 140,
      desc: 'Scorching Wave: Instant fire explosion around you, massively damaging and knocking back all nearby enemies.'
    }
  },

  Tamer: {
    glyph: 'T', role: 'MAGE', range: true, attackRange: 205, dmgType: 'magical', aaScale: 0.15,
    hp: 530, speed: 110, attackDelay: 1.1,
    baseAtk: 25, baseAD: 0, baseAP: 62,
    baseArmor: 15, baseMR: 20,
    Q: {
      baseCooldown: 6.0, castTime: 0.2,
      baseDamage: 76, scaleAP: 0.45, scaleAD: 0,
      type: 'tamer_q', pGlyph: '°', pSpeed: 850, life: 0.4, noHitParticles: true,
      desc: 'Fires a magic sphere that damages an enemy and marks them. Your Wolf (pet) will aggressively prioritize the marked target.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.2,
      baseDamage: 0, scaleAP: 0.6, scaleAD: 0, amount: 195, scaleLevel: 22,
      type: 'tamer_e',
      desc: 'If your Wolf is alive, immediately heals it for a large amount. If it died, begins a 3-second ritual to revive it with 50% HP (interrupted by stun, which triggers the cooldown).'
    }
  },

  // ==========================================
  // SUPPORT
  // ==========================================

  Healer: {
    glyph: 'H', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.13,
    hp: 650, speed: 104, attackDelay: 1.1,
    baseAtk: 25, baseAD: 0, baseAP: 65,
    baseArmor: 25, baseMR: 30,
    Q: {
      baseCooldown: 4.5, castTime: 0.3,
      baseDamage: 65, scaleAP: 0.6, scaleAD: 0.2,
      type: 'projectile', pGlyph: '+', pSpeed: 660, slowDuration: 1.5, slowMod: 0.5,
      desc: 'Fires a beam of light that damages and slows the first enemy hit.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 0, amount: 150, scaleAP: 0.80, scaleAD: 0.15,
      type: 'heal_aoe', radius: 200,
      desc: 'Creates an energy wave that heals all allies in a wide area.'
    }
  },

  Cleric: {
    glyph: 'C', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 630, speed: 108, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 80,
    baseArmor: 20, baseMR: 25,
    Q: {
      baseCooldown: 6.0, castTime: 0.3,
      baseDamage: 0, amount: 80, scaleAP: 0.65, scaleAD: 0.2,
      type: 'heal_aoe', radius: 120, selfHealPenalty: 0.7,
      desc: 'Creates a healing wave that heals nearby allies. Healing strength scales with Ability Power.'
    },
    E: {
      baseCooldown: 6.5, castTime: 0.4,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0.15,
      type: 'projectile', count: 3, spread: 0.25, silenceDuration: 1.0,
      pGlyph: '*', pSpeed: 850,
      desc: 'Fires three magic bolts in a cone. Damages enemies hit and silences them for 1 second.'
    }
  },

  Eggchanter: {
    glyph: 'E', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 640, speed: 105, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 50,
    baseArmor: 22, baseMR: 25,
    Q: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 30, scaleAP: 0.75, scaleAD: 0.2, amount: 5,
      type: 'projectile_egg', pSpeed: 400, life: 0.625, healInterval: 1.0,
      desc: 'Throws an egg (range 250) that damages the target. On impact, a large Hen hatches. It follows you, heals you, and damages nearby enemies every second.'
    },
    E: {
      baseCooldown: 18.0, castTime: 0.4,
      baseDamage: 0, amount: 5, scaleAP: 0.35, scaleAD: 0.15,
      type: 'summon_healers', healInterval: 2,
      desc: 'Summons 3 small support Chicks. They find the nearest ally (max 1 for Keeper, max 2 for others). They follow, heal, and damage nearby enemies every second.'
    }
  },

  Oracle: {
    glyph: 'O', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 610, speed: 106, attackDelay: 1.3,
    baseAtk: 25, baseAD: 0, baseAP: 70,
    baseArmor: 20, baseMR: 25,
    Q: {
      baseCooldown: 11.0, castTime: 0.25,
      baseDamage: 70, scaleAP: 0.6, scaleAD: 0, scaleLevel: 10,
      type: 'projectile_pull', pSpeed: 650, life: 0.5, radius: 100, pGlyph: 'O', stunDuration: 1.0,
      desc: 'Fires a sphere. On impact or hitting a target, it explodes, dealing damage to enemies in the area, pulling them to the center, and briefly stunning them.'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.2,
      baseDamage: 0, scaleAP: 0.5, scaleAD: 0, amount: 80, scaleLevel: 15, duration: 5.0,
      type: 'shield_aoe', radius: 250,
      desc: 'Creates a magic barrier around you. You and all nearby allies gain a strong shield for 5 seconds.'
    }
  },

  Doctor: {
    glyph: 'D', role: 'SUPPORT', range: false, dmgType: 'magical', aaScale: 0.25,
    hp: 600, speed: 115, attackDelay: 1.2,
    baseAtk: 30, baseAD: 0, baseAP: 60,
    baseArmor: 20, baseMR: 20,
    Q: {
      baseCooldown: 6.2, castTime: 0.0,
      baseDamage: 0, scaleAP: 0.065, scaleAD: 0, amount: 2.6, scaleLevel: 0.65, range: 200, tickRate: 0.1,
      type: 'heal_beam',
      desc: 'Heal Beam: Toggle ability. Connects to the nearest ally (200 range) and continuously heals both of you. After 5s, automatically triggers a brief Uber effect.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.15,
      baseDamage: 60, scaleAP: 0.2, scaleAD: 0.2, scaleLevel: 8,
      type: 'cone_slow_shield', radius: 120, cone: 90 * Math.PI / 180, slowDuration: 1.5, slowMod: 0.6, shieldAmount: 90, duration: 2.5,
      desc: 'Support Slash: Slash forward, damaging and slowing enemies. The Medic gains a shield.'
    }
  }
};