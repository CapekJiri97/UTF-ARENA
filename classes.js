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
  Zephyr:   0.20,
  Reaper:   0.25,
  Kratoma:  0.40,
  Marksman: 0.50,
  Mage:     0.20,
  Summoner: 0.20,
  Healer:   0.13,
  Acolyte:  0.20,
  Keeper:   0.20,
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
      baseCooldown: 6.0, castTime: 0.05,
      baseDamage: 75, scaleAP: 0, scaleAD: 0.25,
      type: 'dash', distance: 198, radius: 104,
      desc: 'Vrhne se vpřed a zraní nepřátele, se kterými se srazí.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.25,
      baseDamage: 90, scaleAP: 0, scaleAD: 0.35,
      type: 'aoe', radius: 136,
      desc: 'Provede kruhový úder, který zraní všechny nepřátele v okolí.'
    }
  },

  Jirina: {
    glyph: '❋', range: false, dmgType: 'magical',
    hp: 950, speed: 118, attackDelay: 1.2,
    baseAtk: 40, baseAD: 0, baseAP: 55,
    baseArmor: 38, baseMR: 38,
    Q: {
      baseCooldown: 5.5, castTime: 0.1,
      baseDamage: 65, scaleAP: 0.45, scaleAD: 0,
      type: 'aoe_knockback', radius: 144,
      desc: 'Vytvoří tlakovou vlnu, která zraní a odhodí blízké nepřátele.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 0, amount: 85, scaleAP: 0.55, scaleAD: 0,
      type: 'heal_aoe', radius: 200,
      desc: 'Vyléčí sebe a všechny spojence v dosahu.'
    }
  },

  Bruiser: {
    glyph: 'B', range: false, dmgType: 'physical',
    hp: 880, speed: 120, attackDelay: 1.1,
    baseAtk: 50, baseAD: 55, baseAP: 0,
    baseArmor: 33, baseMR: 28,
    Q: {
      baseCooldown: 6.0, castTime: 0.1,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.55,
      type: 'projectile', pGlyph: 'D', pSpeed: 600, life: 0.4,
      desc: 'Vrhne těžkou zbraň, která zraní prvního zasaženého nepřítele. Poškození se výrazně zvyšuje s útočným poškozením.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.05,
      baseDamage: 45, scaleAP: 0, scaleAD: 0.5,
      type: 'dash', distance: 198, radius: 110,
      desc: 'Skočí na cílové místo a při dopadu zraní nepřátele v okolí. Poškození se výrazně zvyšuje s útočným poškozením.'
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
      desc: 'Vytvoří dočasný štít. Pokud je štít zničen nebo vyprší, exploduje a zraní okolní nepřátele.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.1,
      baseDamage: 80, scaleAP: 0, scaleAD: 0.15,
      type: 'aoe', radius: 144,
      desc: 'Udeří do země a zraní všechny nepřátele v blízkém okolí.'
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
      desc: 'Na 5 sekund posílí své útoky, které způsobují bonusové poškození dle jejích maximálních životů. Také získá bonus k rychlosti útoku a mírnou regeneraci.'
    },
    E: {
      baseCooldown: 7.5, castTime: 0.05,
      baseDamage: 65, scaleAP: 0.5, scaleAD: 0,
      type: 'dash_def', distance: 225, radius: 128, slowDuration: 1.5, slowMod: 0.3,
      desc: 'Provede rychlý úskok a dočasně si zvýší obranu. Při dopadu zraní a výrazně zpomalí nepřátele v okolí.'
    }
  },

  Goliath: {
    glyph: 'G', range: false, dmgType: 'physical',
    hp: 1200, speed: 96, attackDelay: 1.6,
    baseAtk: 55, baseAD: 40, baseAP: 0,
    baseArmor: 50, baseMR: 50,
    Q: {
      baseCooldown: 7.5, castTime: 0.15,
      baseDamage: 50, scaleAP: 0, scaleAD: 0.45,
      type: 'dash', distance: 225, radius: 120,
      desc: 'Provede nezastavitelný náraz vpřed, který zraní všechny nepřátele po cestě.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.1,
      baseDamage: 50, scaleAP: 0, scaleAD: 0,
      type: 'dash_heal_silence', amount: 80, distance: 80, radius: 120, silenceDuration: 1.5,
      desc: 'Provede krátký úskok, vyléčí si část zdraví a při dopadu umlčí všechny nepřátele v okolí na 1.5 sekundy.'
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
      baseCooldown: 5.0, castTime: 0.05,
      baseDamage: 65, scaleAP: 0, scaleAD: 0.2,
      type: 'projectile', count: 3, spread: 0.45,
      pGlyph: '-', pSpeed: 960, life: 0.21,
      desc: 'Vrhne tři dýky v kuželu, které zraní zasažené nepřátele. Kouzlo má vysoké základní poškození.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.05,
      baseDamage: 95, scaleAP: 0, scaleAD: 0.45,
      type: 'aoe', radius: 96,
      desc: 'Vytvoří explozi nožů, která zraní všechny nepřátele v těsné blízkosti.'
    }
  },

  Zephyr: {
    glyph: 'Z', range: false, dmgType: 'magical',
    hp: 650, speed: 135, attackDelay: 0.9,
    baseAtk: 40, baseAD: 0, baseAP: 55,
    baseArmor: 25, baseMR: 25,
    Q: {
      baseCooldown: 8.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'buff_ms', amount: 0.5, duration: 3.0,
      desc: 'Krátkodobě si výrazně zvýší rychlost pohybu.'
    },
    E: {
      baseCooldown: 5.0, castTime: 0.1,
      baseDamage: 60, scaleAP: 0.6, scaleAD: 0,
      type: 'aoe', radius: 120,
      desc: 'Vytvoří magickou explozi, která zraní nepřátele v okolí.'
    }
  },

  Reaper: {
    glyph: '☠', range: false, dmgType: 'magical',
    hp: 520, speed: 125, attackDelay: 0.9,
    baseAtk: 25, baseAD: 0, baseAP: 40,
    baseArmor: 18, baseMR: 20,
    Q: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 20, scaleAP: 0.55, scaleAD: 0,
      type: 'reaper_q', charges: 3,
      desc: 'Posílí další 3 základní útoky. Získají větší dosah, masivní bonusové poškození a zpomalí cíl o 60% na 1.5s.'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0.7, scaleAD: 0, amount: 60,
      type: 'reaper_e', distance: 100, duration: 1.5,
      desc: 'Krátký úskok (100). Získá štít a 40% rychlost pohybu na 1.5s. Okamžitě resetuje cooldown kouzla Q!'
    }
  },

  Kratoma: {
    glyph: 'K', range: true, attackRange: 160, dmgType: 'physical',
    hp: 600, speed: 115, attackDelay: 1.0,
    baseAtk: 35, baseAD: 65, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    projCount: 3, projSpread: 0.3,
    Q: {
      baseCooldown: 10.0, castTime: 0.7,
      baseDamage: 50, scaleAP: 0, scaleAD: 0.6,
      type: 'projectile_summon', pGlyph: 'b', pSpeed: 800,
      summonGlyph: 'b', summonHp: 120, summonAd: 50, slowDuration: 2,
      desc: 'Vystřelí projektil, který zraní a zpomalí prvního zasaženého nepřítele. Po zásahu vyvolá Bažanta, který bude bojovat po jejím boku.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'buff_ad_as', duration: 4.0, amount: 0.25, shieldAmount: 80,
      desc: 'Na 4 sekundy si zvýší útočné poškození a rychlost útoku. Zároveň získá malý ochranný štít.'
    }
  },

  Marksman: {
    glyph: 'N', range: true, dmgType: 'physical',
    hp: 550, speed: 110, attackDelay: 1.2,
    baseAtk: 55, baseAD: 80, baseAP: 0,
    baseArmor: 15, baseMR: 15,
    Q: {
      baseCooldown: 4.0, castTime: 0.4,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.7,
      type: 'projectile', pGlyph: '»', pSpeed: 1200,
      desc: 'Vystřelí střelu s dlouhým dosahem, která zraní prvního zasaženého nepřítele. Poškození se výrazně zvyšuje s útočným poškozením.'
    },
    E: {
      baseCooldown: 13.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'dash', distance: 297,
      desc: 'Provede dlouhý úskok, který jí umožní rychle změnit pozici.'
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
      baseCooldown: 3.5, castTime: 0.3,
      baseDamage: 115, scaleAP: 0.55, scaleAD: 0,
      type: 'projectile', pGlyph: 'O', pSpeed: 750,
      desc: 'Vystřelí magickou kouli, která zraní prvního zasaženého nepřítele. Kouzlo má vysoké základní poškození.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.6,
      baseDamage: 115, scaleAP: 0.65, scaleAD: 0,
      type: 'aoe', radius: 160,
      desc: 'Vytvoří na cílovém místě plošnou explozi magické energie, která zraní všechny nepřátele v oblasti.'
    }
  },

  Summoner: {
    glyph: 'S', range: true, dmgType: 'magical',
    hp: 620, speed: 108, attackDelay: 1.3,
    baseAtk: 30, baseAD: 0, baseAP: 80,
    baseArmor: 22, baseMR: 22,
    Q: {
      baseCooldown: 4.0, castTime: 0.3,
      baseDamage: 85, scaleAP: 0.75, scaleAD: 0,
      type: 'projectile', pGlyph: '~', pSpeed: 750,
      desc: 'Vystřelí stínový projektil, který zraní prvního zasaženého nepřítele. Poškození se výrazně zvyšuje s magickou silou.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.6,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0,
      type: 'summon', count: 2, mGlyph: 'g',
      desc: 'Vyvolá dva ghúly, kteří budou bojovat po jeho boku a útočit na nepřátele.'
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
      baseCooldown: 4.5, castTime: 0.3,
      baseDamage: 85, scaleAP: 0.6, scaleAD: 0,
      type: 'projectile', pGlyph: '+', pSpeed: 660,
      desc: 'Vystřelí paprsek světla, který zraní prvního zasaženého nepřítele.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 0, amount: 110, scaleAP: 0.60, scaleAD: 0,
      type: 'heal_aoe', radius: 200,
      desc: 'Vytvoří vlnu energie, která vyléčí všechny spojence v širokém okolí.'
    }
  },

  Acolyte: {
    glyph: 'C', range: true, dmgType: 'magical',
    hp: 630, speed: 108, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 80,
    baseArmor: 20, baseMR: 25,
    Q: {
      baseCooldown: 6.0, castTime: 0.3,
      baseDamage: 0, amount: 55, scaleAP: 0.45, scaleAD: 0,
      type: 'heal_aoe', radius: 120,
      desc: 'Vytvoří léčivou vlnu, která vyléčí spojence v okolí. Síla léčení se zvyšuje s magickou silou.'
    },
    E: {
      baseCooldown: 5.5, castTime: 0.4,
      baseDamage: 55, scaleAP: 0.65, scaleAD: 0,
      type: 'projectile', count: 3, spread: 0.3,
      pGlyph: '*', pSpeed: 850,
      desc: 'Vystřelí tři magické střely v kuželu, které zraní zasažené nepřátele. Poškození se výrazně zvyšuje s magickou silou.'
    }
  },

  Keeper: {
    glyph: 'E', range: true, dmgType: 'magical',
    hp: 640, speed: 105, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 70,
    baseArmor: 22, baseMR: 25,
    Q: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 60, scaleAP: 0.55, scaleAD: 0, amount: 20,
      type: 'projectile_egg', pSpeed: 400, life: 0.625,
      desc: 'Hodí vajíčko (dosah 250), které poškodí cíl. Po dopadu nebo zásahu se vylíhne velká slepice, která tě následuje a léčí.'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.4,
      baseDamage: 0, amount: 15, scaleAP: 0.2, scaleAD: 0,
      type: 'summon_healers',
      desc: 'Vyvolá malou podpůrnou slepičku (max 1 aktivní). Najde si nejbližšího spojence, následuje ho a každou sekundu ho léčí.'
    }
  }
};