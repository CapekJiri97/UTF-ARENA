export const SUMMONER_SPELLS = {
  Heal: { name: 'Heal', desc: 'Léčí 150 HP + 20 za level.', cd: 60 },
  Ghost: { name: 'Ghost', desc: 'Zvýší rychlost o +40% na 5s.', cd: 45 },
  Boost: { name: 'Boost', desc: 'Zvýší staty (+10%) na 5s.', cd: 45 },
  Rally: { name: 'Rally', desc: 'Zrychlí obsazování, léčí a posílí okolní miniony.', cd: 60 },
  Revive: { name: 'Revive', desc: 'Okamžité oživení při smrti.', cd: 90 },
  Exhaust: { name: 'Exhaust', desc: 'Zpomalí nepřátele (300 unitů) o 40% na 2s.', cd: 45 }
};

export const AA_SCALES = {
  Vanguard: 0.50,
  Jirina:   0.30,
  Bruiser:  0.55,
  Tank:     0.35,
  Hana:     0.35,
  Goliath:  0.40,
  Assassin: 0.55,
  Runner:   0.20,
  Kratoma:  0.40,
  Marksman: 0.50,
  Mage:     0.20,
  Summoner: 0.20,
  Healer:   0.13,
  Acolyte:  0.20,
};

export const CLASSES = {
  // ==========================================
  // FIGHTER
  // ==========================================

  Vanguard: {
    glyph: 'V', range: false, dmgType: 'physical',
    hp: 1000, speed: 120, attackDelay: 1.4,
    baseAtk: 45, baseAD: 45, baseAP: 0,
    baseArmor: 35, baseMR: 30,
    Q: {
      baseCooldown: 6.0, castTime: 0.2,
      baseDamage: 75, scaleAP: 0, scaleAD: 0.25,
      type: 'dash', distance: 198, radius: 104,
      desc: 'Výpad štítem, zraní cíl dopadu.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 90, scaleAP: 0, scaleAD: 0.35,
      type: 'aoe', radius: 136,
      desc: 'Máchne zbraní a zničí vše okolo.'
    }
  },

  Jirina: {
    glyph: '❋', range: false, dmgType: 'magical',
    hp: 950, speed: 118, attackDelay: 1.2,
    baseAtk: 40, baseAD: 0, baseAP: 55,
    baseArmor: 38, baseMR: 38,
    Q: {
      baseCooldown: 5.5, castTime: 0.2,
      baseDamage: 65, scaleAP: 0.45, scaleAD: 0,
      type: 'aoe_knockback', radius: 144,
      desc: 'Tlaková vlna, která odhodí nepřátele.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 0, amount: 85, scaleAP: 0.55, scaleAD: 0,
      type: 'heal_aoe', radius: 200,
      desc: 'Plošně vyléčí sebe i spojence.'
    }
  },

  Bruiser: {
    glyph: 'B', range: false, dmgType: 'physical',
    hp: 880, speed: 120, attackDelay: 1.1,
    baseAtk: 50, baseAD: 55, baseAP: 0,
    baseArmor: 33, baseMR: 28,
    Q: {
      baseCooldown: 6.0, castTime: 0.2,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.55,
      type: 'projectile', pGlyph: 'D', pSpeed: 600, life: 0.4,
      desc: 'Vrhne těžkou zbraň (vysoký scaling).'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.1,
      baseDamage: 45, scaleAP: 0, scaleAD: 0.5,
      type: 'dash', distance: 198, radius: 110,
      desc: 'Skočí vpřed a zraní okolí (vysoký scaling).'
    }
  },

  // ==========================================
  // TANK
  // ==========================================

  Tank: {
    glyph: 'T', range: false, dmgType: 'physical',
    hp: 1100, speed: 100, attackDelay: 1.4,
    baseAtk: 50, baseAD: 35, baseAP: 0,
    baseArmor: 48, baseMR: 43,
    Q: {
      baseCooldown: 9.0, castTime: 0.1,
      baseDamage: 80, scaleAP: 0, scaleAD: 0.3,
      type: 'shield_explode', amount: 140, duration: 4.0, radius: 144,
      desc: 'Získá štít na 4s. Po zničení nebo vypršení exploduje a zraní okolí.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.4,
      baseDamage: 80, scaleAP: 0, scaleAD: 0.15,
      type: 'aoe', radius: 144,
      desc: 'Drtivý úder do země.'
    }
  },

  Hana: {
    glyph: '✿', range: false, dmgType: 'magical',
    hp: 1050, speed: 120, attackDelay: 1.2,
    baseAtk: 50, baseAD: 0, baseAP: 50,
    baseArmor: 40, baseMR: 40,
    Q: {
      baseCooldown: 10.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'hana_q', duration: 5.0,
      desc: 'Na 5s získá Attack Speed, AA dávají bonus poškození z Max HP a mírně regeneruje.'
    },
    E: {
      baseCooldown: 7.5, castTime: 0.1,
      baseDamage: 65, scaleAP: 0.5, scaleAD: 0,
      type: 'dash_def', distance: 225, radius: 128, slowDuration: 1.5, slowMod: 0.3,
      desc: 'Dash se zvýšením obrany. Při dopadu udělí 70% slow na 1.5s.'
    }
  },

  Goliath: {
    glyph: 'G', range: false, dmgType: 'physical',
    hp: 1200, speed: 96, attackDelay: 1.6,
    baseAtk: 55, baseAD: 40, baseAP: 0,
    baseArmor: 50, baseMR: 50,
    Q: {
      baseCooldown: 7.5, castTime: 0.3,
      baseDamage: 50, scaleAP: 0, scaleAD: 0.45,
      type: 'dash', distance: 225, radius: 120,
      desc: 'Nezastavitelný náraz do nepřátel.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.1,
      baseDamage: 50, scaleAP: 0, scaleAD: 0,
      type: 'dash_heal_silence', amount: 80, distance: 80, radius: 120, silenceDuration: 1.5,
      desc: 'Malý dash, který vyléčí 80 HP a plošně umlčí nepřátele na 1.5s.'
    }
  },

  // ==========================================
  // DPS
  // ==========================================

  Assassin: {
    glyph: 'A', range: false, dmgType: 'physical',
    hp: 580, speed: 130, attackDelay: 0.8,
    baseAtk: 50, baseAD: 55, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    Q: {
      baseCooldown: 5.0, castTime: 0.1,
      baseDamage: 65, scaleAP: 0, scaleAD: 0.2,
      type: 'projectile', count: 3, spread: 0.45,
      pGlyph: '-', pSpeed: 960, life: 0.21,
      desc: 'Vrhne 3 dýky v kuželu (vysoký základ).'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.1,
      baseDamage: 95, scaleAP: 0, scaleAD: 0.45,
      type: 'aoe', radius: 96,
      desc: 'Krvavá exploze nožů kolem sebe.'
    }
  },

  Runner: {
    glyph: 'R', range: false, dmgType: 'magical',
    hp: 650, speed: 135, attackDelay: 0.9,
    baseAtk: 40, baseAD: 0, baseAP: 55,
    baseArmor: 25, baseMR: 25,
    Q: {
      baseCooldown: 8.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'buff_ms', amount: 0.5, duration: 3.0,
      desc: 'Zvýší rychlost pohybu o 50% na 3s.'
    },
    E: {
      baseCooldown: 5.0, castTime: 0.5,
      baseDamage: 60, scaleAP: 0.6, scaleAD: 0,
      type: 'aoe', radius: 120,
      desc: 'Magická exploze v blízkém okolí.'
    }
  },

  Kratoma: {
    glyph: 'K', range: true, attackRange: 160, dmgType: 'physical',
    hp: 600, speed: 115, attackDelay: 1.0,
    baseAtk: 35, baseAD: 65, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    projCount: 3, projSpread: 0.3,
    Q: {
      baseCooldown: 10.0, castTime: 1,
      baseDamage: 50, scaleAP: 0, scaleAD: 0.6,
      type: 'projectile_summon', pGlyph: 'b', pSpeed: 800,
      summonGlyph: 'b', summonHp: 120, summonAd: 50, slowDuration: 2,
      desc: 'Zraní a zpomalí první cíl. Vyvolá Bažanta.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'buff_ad_as', duration: 4.0, amount: 0.25, shieldAmount: 80,
      desc: 'Zvýší AD a AS o 25% a získá štít 80 na 4s.'
    }
  },

  Marksman: {
    glyph: 'S', range: true, dmgType: 'physical',
    hp: 550, speed: 110, attackDelay: 1.2,
    baseAtk: 55, baseAD: 80, baseAP: 0,
    baseArmor: 15, baseMR: 15,
    Q: {
      baseCooldown: 4.0, castTime: 0.6,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.7,
      type: 'projectile', pGlyph: '»', pSpeed: 1200,
      desc: 'Průrazná střela (vysoký scaling).'
    },
    E: {
      baseCooldown: 13.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'dash', distance: 297,
      desc: 'Dlouhý taktický úskok do bezpečí.'
    }
  },

  // ==========================================
  // MAGE
  // ==========================================

  Mage: {
    glyph: 'M', range: true, dmgType: 'magical',
    hp: 620, speed: 112, attackDelay: 1.4,
    baseAtk: 35, baseAD: 0, baseAP: 70,
    baseArmor: 15, baseMR: 30,
    Q: {
      baseCooldown: 3.5, castTime: 0.5,
      baseDamage: 115, scaleAP: 0.55, scaleAD: 0,
      type: 'projectile', pGlyph: 'O', pSpeed: 750,
      desc: 'Magická koule (vysoký základ).'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.8,
      baseDamage: 115, scaleAP: 0.65, scaleAD: 0,
      type: 'aoe', radius: 160,
      desc: 'Plošná exploze magické energie.'
    }
  },

  Summoner: {
    glyph: 'S', range: true, dmgType: 'magical',
    hp: 620, speed: 108, attackDelay: 1.3,
    baseAtk: 30, baseAD: 0, baseAP: 80,
    baseArmor: 22, baseMR: 22,
    Q: {
      baseCooldown: 4.0, castTime: 0.5,
      baseDamage: 85, scaleAP: 0.75, scaleAD: 0,
      type: 'projectile', pGlyph: '~', pSpeed: 750,
      desc: 'Stínový projektil.'
    },
    E: {
      baseCooldown: 11.0, castTime: 1.0,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0,
      type: 'summon', count: 2, mGlyph: 'g',
      desc: 'Vyvolá 2 silné ghúly.'
    }
  },

  // ==========================================
  // SUPPORT
  // ==========================================

  Healer: {
    glyph: 'H', range: true, dmgType: 'magical',
    hp: 650, speed: 104, attackDelay: 1.1,
    baseAtk: 25, baseAD: 0, baseAP: 65,
    baseArmor: 25, baseMR: 30,
    Q: {
      baseCooldown: 4.5, castTime: 0.5,
      baseDamage: 85, scaleAP: 0.6, scaleAD: 0,
      type: 'projectile', pGlyph: '+', pSpeed: 660,
      desc: 'Zraňující paprsek světla.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.8,
      baseDamage: 0, amount: 110, scaleAP: 0.4, scaleAD: 0,
      type: 'heal_aoe', radius: 200,
      desc: 'Plošné léčení spojenců.'
    }
  },

  Acolyte: {
    glyph: 'C', range: true, dmgType: 'magical',
    hp: 630, speed: 108, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 80,
    baseArmor: 20, baseMR: 25,
    Q: {
      baseCooldown: 4.0, castTime: 0.6,
      baseDamage: 0, amount: 55, scaleAP: 0.45, scaleAD: 0,
      type: 'heal_aoe', radius: 240,
      desc: 'Rychlá léčivá vlna (scaling).'
    },
    E: {
      baseCooldown: 5.5, castTime: 0.7,
      baseDamage: 55, scaleAP: 0.65, scaleAD: 0,
      type: 'projectile', count: 3, spread: 0.3,
      pGlyph: '*', pSpeed: 850,
      desc: '3 magické střely (scaling).'
    }
  }
};