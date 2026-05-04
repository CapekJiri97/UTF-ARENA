export const SUMMONER_SPELLS = {
  Heal: { name: 'Heal', desc: 'Léčí 150 HP + 20 za level.', cd: 60 },
  Ghost: { name: 'Ghost', desc: 'Zvýší rychlost o +40% na 5s.', cd: 45 },
  Boost: { name: 'Boost', desc: 'Zvýší staty (+10%) na 5s.', cd: 30 },
  Rally: { name: 'Rally', desc: 'Zrychlí obsazování, léčí a posílí okolní miniony.', cd: 45 },
  Revive: { name: 'Revive', desc: 'Okamžité oživení při smrti.', cd: 90 },
  Exhaust: { name: 'Exhaust', desc: 'Zpomalí nepřátele (300 unitů) o 40% na 2s.', cd: 45 }
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
      desc: 'Vrhne se vpřed, zraní a výrazně zpomalí nepřátele, se kterými se srazí.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.25,
      baseDamage: 90, scaleAP: 0.15, scaleAD: 0.35,
      type: 'aoe', radius: 136,
      desc: 'Provede kruhový úder, který zraní všechny nepřátele v okolí.'
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
      desc: 'Vytvoří tlakovou vlnu, která zraní a odhodí blízké nepřátele.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 0, amount: 85, scaleAP: 0.55, scaleAD: 0.15,
      type: 'heal_aoe', radius: 200,
      desc: 'Vyléčí sebe a všechny spojence v dosahu.'
    }
  },

  Bruiser: {
    glyph: 'B', role: 'FIGHTER', range: false, dmgType: 'physical', aaScale: 0.55,
    hp: 880, speed: 120, attackDelay: 1.1,
    baseAtk: 50, baseAD: 55, baseAP: 0,
    baseArmor: 33, baseMR: 28,
    Q: {
      baseCooldown: 6.0, castTime: 0.1,
      baseDamage: 60, scaleAP: 0.2, scaleAD: 0.55,
      type: 'projectile', pGlyph: 'D', pSpeed: 600, life: 0.4,
      desc: 'Vrhne těžkou zbraň, která zraní prvního zasaženého nepřítele. Poškození se výrazně zvyšuje s útočným poškozením.'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.05,
      baseDamage: 45, scaleAP: 0.25, scaleAD: 0.5, dashTime: 0.2,
      type: 'dash', distance: 198, radius: 110,
      desc: 'Skočí na cílové místo a při dopadu zraní nepřátele v okolí. Poškození se výrazně zvyšuje s útočným poškozením.'
    }
  },

  // ==========================================
  // TANK
  // ==========================================

  Tank: {
    glyph: 'T', role: 'TANK', range: false, dmgType: 'physical', aaScale: 0.35,
    hp: 1100, speed: 100, attackDelay: 1.4,
    baseAtk: 50, baseAD: 35, baseAP: 0,
    baseArmor: 48, baseMR: 43,
    Q: {
      baseCooldown: 9.0, castTime: 0.1,
      baseDamage: 80, scaleAP: 0.3, scaleAD: 0.3,
      type: 'shield_explode', amount: 140, duration: 4.0, radius: 144,
      desc: 'Vytvoří dočasný štít. Pokud je štít zničen nebo vyprší, exploduje a zraní okolní nepřátele.'
    },
    E: {
      baseCooldown: 10.0, castTime: 0.25,
      baseDamage: 80, scaleAP: 0.15, scaleAD: 0.15,
      type: 'aoe', radius: 144, stunDuration: 1.0,
      desc: 'Udeří do země, zraní všechny nepřátele v blízkém okolí a na 1 sekundu je omráčí (Stun).'
    }
  },

  Hana: {
    glyph: '✿', role: 'TANK', range: false, dmgType: 'magical', aaScale: 0.35, customMeleeAoE: 'ring',
    hp: 1050, speed: 120, attackDelay: 1.2,
    baseAtk: 50, baseAD: 0, baseAP: 50,
    baseArmor: 40, baseMR: 40,
    Q: {
      baseCooldown: 10.0, castTime: 0.1,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'hana_q', duration: 5.0, bonusHpDmg: 0.03, bonusAsMult: 1.25,
      desc: 'Na 5 sekund posílí své útoky, které způsobují bonusové poškození dle jejích maximálních životů. Také získá bonus k rychlosti útoku a mírnou regeneraci.'
    },
    E: {
      baseCooldown: 7.5, castTime: 0.05,
      baseDamage: 65, scaleAP: 0.5, scaleAD: 0.25, dashTime: 0.2,
      type: 'dash_def', distance: 225, radius: 128, slowDuration: 1.5, slowMod: 0.3,
      desc: 'Provede rychlý úskok a dočasně si zvýší obranu. Při dopadu zraní a výrazně zpomalí nepřátele v okolí.'
    }
  },

  Gaoler: {
    glyph: 'J', role: 'TANK', range: false, dmgType: 'magical', aaScale: 0.30,
    hp: 1150, speed: 105, attackDelay: 1.5,
    baseAtk: 40, baseAD: 0, baseAP: 45,
    baseArmor: 45, baseMR: 45,
    Q: {
      baseCooldown: 14.0, castTime: 0.3,
      baseDamage: 80, scaleAP: 0.6, scaleAD: 0,
      type: 'projectile', pGlyph: 'J', pSpeed: 820, life: 0.6,
      pullToCaster: true,
      desc: 'Vystřelí hák, který zraní prvního zasaženého nepřítele a přitáhne ho k sobě.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.2,
      baseDamage: 70, scaleAP: 0.4, scaleAD: 0,
      type: 'aoe', radius: 130, slowDuration: 3.0, slowMod: 0.45,
      desc: 'Udeří do země, zraní nepřátele v okolí a na 3 sekundy je zpomalí o 55%.'
    }
  },

  Goliath: {
    glyph: 'G', role: 'TANK', range: false, dmgType: 'physical', aaScale: 0.40,
    hp: 1200, speed: 96, attackDelay: 1.6,
    baseAtk: 55, baseAD: 40, baseAP: 0,
    baseArmor: 50, baseMR: 50,
    Q: {
      baseCooldown: 7.5, castTime: 0.15,
      baseDamage: 50, scaleAP: 0.2, scaleAD: 0.45, dashTime: 0.2,
      type: 'dash', distance: 225, radius: 120,
      desc: 'Provede nezastavitelný náraz vpřed, který zraní všechny nepřátele po cestě.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.1,
      baseDamage: 50, scaleAP: 0.25, scaleAD: 0, dashTime: 0.15,
      type: 'dash_heal_silence', amount: 80, distance: 80, radius: 120, silenceDuration: 1.5,
      desc: 'Provede krátký úskok, vyléčí si část zdraví a při dopadu umlčí všechny nepřátele v okolí na 1.5 sekundy.'
    }
  },

  // ==========================================
  // DPS
  // ==========================================

  Assassin: {
    glyph: 'A', role: 'SLAYER', range: false, dmgType: 'physical', aaScale: 0.55,
    hp: 580, speed: 130, attackDelay: 0.8,
    baseAtk: 50, baseAD: 55, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    Q: {
      baseCooldown: 5.0, castTime: 0.05,
      baseDamage: 65, scaleAP: 0.15, scaleAD: 0.2,
      type: 'projectile', count: 3, spread: 0.45,
      pGlyph: 'd', pSpeed: 960, life: 0.21,
      desc: 'Vrhne tři dýky v kuželu, které zraní zasažené nepřátele. Kouzlo má vysoké základní poškození.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.05,
      baseDamage: 95, scaleAP: 0.25, scaleAD: 0.45,
      type: 'aoe', radius: 96,
      desc: 'Vytvoří explozi nožů, která zraní všechny nepřátele v těsné blízkosti.'
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
      desc: 'Krátkodobě si zvýší rychlost pohybu Bonus se výrazně zvyšuje s magickou silou (AP).'
    },
    E: {
      baseCooldown: 5.0, castTime: 0.25,
      baseDamage: 75, scaleAP: 0.7, scaleAD: 0.2,
      type: 'aoe_knockback', radius: 90,
      desc: 'Vytvoří silný vzdušný poryv, který zraní a prudce odhodí nepřátele v okolí.'
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
      desc: 'Na 4 sekundy posílí další 3 základní útoky. Získají větší dosah, bonusové poškození a zpomalí cíl o 40% na 1s.'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0.7, scaleAD: 0.25, amount: 60, dashTime: 0.15,
      type: 'reaper_e', distance: 80, duration: 1.5,
      desc: 'Krátký úskok (100). Získá štít a 40% rychlost pohybu na 1.5s. Okamžitě resetuje cooldown kouzla Q!'
    }
  },

  Ronin: {
    glyph: '⛩', role: 'SLAYER', range: false, dmgType: 'physical', aaScale: 0.50,
    hp: 600, speed: 125, attackDelay: 0.9,
    baseAtk: 45, baseAD: 65, baseAP: 0,
    baseArmor: 25, baseMR: 25,
    Q: {
      baseCooldown: 9.0, castTime: 0.0,
      baseDamage: 25, scaleAP: 0, scaleAD: 0.25, scaleLevel: 5,
      type: 'spin_to_win', duration: 2.5, tickRate: 0.25, radius: 150,
      desc: 'Čepelová smršť: Roztočí se, po 2.5 sekundy zraňuje nepřátele v okolí a má zvýšenou rychlost. Můžeš se u toho pohybovat!'
    },
    E: {
      baseCooldown: 16.0, castTime: 0.1,
      baseDamage: 60, scaleAP: 0, scaleAD: 0.60, scaleLevel: 10,
      type: 'omnislash', count: 5, tickRate: 0.2, distance: 180, dashTime: 0.2,
      desc: 'Všesek (Omnislash): Provede bleskový výpad vpřed. Pokud zasáhne nepřítele, stane se nezranitelným a 5x se teleportuje k náhodným cílům v okolí, kterým zasadí tvrdou ránu.'
    }
  },

  Kratoma: {
    glyph: 'K', role: 'SLAYER', range: true, attackRange: 160, dmgType: 'physical', aaScale: 0.40,
    hp: 600, speed: 115, attackDelay: 1.0,
    baseAtk: 35, baseAD: 65, baseAP: 0,
    baseArmor: 20, baseMR: 20,
    projCount: 3, projSpread: 0.3,
    Q: {
      baseCooldown: 10.0, castTime: 0.7,
      baseDamage: 50, scaleAP: 0.25, scaleAD: 0.6,
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
    glyph: 'N', role: 'SLAYER', range: true, dmgType: 'physical', aaScale: 0.50,
    hp: 550, speed: 110, attackDelay: 1.2,
    baseAtk: 55, baseAD: 80, baseAP: 0,
    baseArmor: 15, baseMR: 15,
    Q: {
      baseCooldown: 4.0, castTime: 0.4,
      baseDamage: 60, scaleAP: 0.25, scaleAD: 0.7,
      type: 'projectile', pGlyph: '»', pSpeed: 1200,
      desc: 'Vystřelí střelu s dlouhým dosahem, která zraní prvního zasaženého nepřítele. Poškození se výrazně zvyšuje s útočným poškozením.'
    },
    E: {
      baseCooldown: 13.0, castTime: 0.05,
      baseDamage: 0, scaleAP: 0, scaleAD: 0,
      type: 'dash', distance: 297, dashTime: 0.2,
      desc: 'Provede dlouhý úskok, který jí umožní rychle změnit pozici.'
    }
  },

  Gunner: {
    glyph: 'F', role: 'SLAYER', range: true, dmgType: 'physical', aaScale: 0.40,
    hp: 550, speed: 115, attackDelay: 0.95,
    baseAtk: 35, baseAD: 70, baseAP: 0,
    baseArmor: 15, baseMR: 15,
    Q: {
      baseCooldown: 5.0, castTime: 0.15,
      baseDamage: 25, scaleAP: 0, scaleAD: 0.25,
      type: 'projectile', count: 5, spread: 0.25, pGlyph: ':', pSpeed: 1100, life: 0.35,
      desc: 'Vystřelí salvu 5 projektilů v širokém kuželu. Skvělé pro plošné poškození nebo masivní "brokovnicový" burst zblízka.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.1,
      baseDamage: 50, scaleAP: 0, scaleAD: 0.5,
      type: 'cone_knockback', radius: 110, cone: 90 * Math.PI / 180,
      desc: 'Vypálí výseč před sebou, která zraní a prudce odhodí nepřátele.'
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
      desc: 'Vystřelí magickou kouli, která zraní prvního zasaženého nepřítele. Kouzlo má vysoké základní poškození.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.6,
      baseDamage: 100, scaleAP: 0.60, scaleAD: 0.2,
      type: 'aoe', radius: 160,
      desc: 'Vytvoří na cílovém místě plošnou explozi magické energie, která zraní všechny nepřátele v oblasti.'
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
      desc: 'Vystřelí stínový projektil, který zraní prvního zasaženého nepřítele. Poškození se výrazně zvyšuje s magickou silou.'
    },
    E: {
      baseCooldown: 11.0, castTime: 0.6,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0.15,
      type: 'summon', count: 2, mGlyph: 'g',
      desc: 'Vyvolá dva ghúly, kteří budou bojovat po jeho boku a útočit na nepřátele.'
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
      desc: 'Plamenomet: Na 3.0 sekundy před sebe chrlí nepřetržitý proud ohně v kuželu. Masivně zraňuje nepřátele a umožňuje ti se u toho plynule pohybovat!'
    },
    E: {
      baseCooldown: 9.0, castTime: 0.2,
      baseDamage: 80, scaleAP: 0.45, scaleAD: 0, scaleLevel: 10,
      type: 'aoe_knockback', radius: 140,
      desc: 'Spalující vlna: Okamžitá ohnivá exploze kolem sebe, která masivně zraní a odhodí všechny dotírající nepřátele.'
    }
  },

  Tamer: {
    glyph: 'Y', role: 'MAGE', range: true, attackRange: 180, dmgType: 'magical', aaScale: 0.15,
    hp: 500, speed: 110, attackDelay: 1.1,
    baseAtk: 25, baseAD: 0, baseAP: 50,
    baseArmor: 15, baseMR: 20,
    Q: {
      baseCooldown: 6.0, castTime: 0.2,
      baseDamage: 60, scaleAP: 0.4, scaleAD: 0,
      type: 'tamer_q', pGlyph: '°', pSpeed: 850, life: 0.4,
      desc: 'Vystřelí magickou sféru, která zraní nepřítele a označí ho. Tvůj Vlk (pet) bude označený cíl agresivně prioritizovat.'
    },
    E: {
      baseCooldown: 12.0, castTime: 0.2,
      baseDamage: 0, scaleAP: 0.6, scaleAD: 0, amount: 150, scaleLevel: 25,
      type: 'tamer_e',
      desc: 'Pokud tvůj Vlk žije, okamžitě ho výrazně vyléčí. Pokud zemřel, začneš 3 sekundy dlouhý rituál, který ho oživí s 50% HP (při stunu se přeruší a naskočí CD).'
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
      desc: 'Vystřelí paprsek světla, který zraní a zpomalí prvního zasaženého nepřítele.'
    },
    E: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 0, amount: 150, scaleAP: 0.80, scaleAD: 0.15,
      type: 'heal_aoe', radius: 200,
      desc: 'Vytvoří vlnu energie, která vyléčí všechny spojence v širokém okolí.'
    }
  },

  Acolyte: {
    glyph: 'C', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 630, speed: 108, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 80,
    baseArmor: 20, baseMR: 25,
    Q: {
      baseCooldown: 6.0, castTime: 0.3,
      baseDamage: 0, amount: 80, scaleAP: 0.65, scaleAD: 0.2,
      type: 'heal_aoe', radius: 120, selfHealPenalty: 0.7,
      desc: 'Vytvoří léčivou vlnu, která vyléčí spojence v okolí. Síla léčení se zvyšuje s magickou silou.'
    },
    E: {
      baseCooldown: 6.5, castTime: 0.4,
      baseDamage: 45, scaleAP: 0.65, scaleAD: 0.15,
      type: 'projectile', count: 3, spread: 0.25, silenceDuration: 1.0,
      pGlyph: '*', pSpeed: 850,
      desc: 'Vystřelí tři magické střely v kuželu. Zraní zasažené nepřátele a na 1 sekundu je umlčí (Silence).'
    }
  },

  Keeper: {
    glyph: 'E', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 640, speed: 105, attackDelay: 1.2,
    baseAtk: 25, baseAD: 0, baseAP: 50,
    baseArmor: 22, baseMR: 25,
    Q: {
      baseCooldown: 8.0, castTime: 0.3,
      baseDamage: 30, scaleAP: 0.75, scaleAD: 0.2, amount: 5,
      type: 'projectile_egg', pSpeed: 400, life: 0.625, healInterval: 1.0,
      desc: 'Hodí vajíčko (dosah 250), které poškodí cíl. Po dopadu nebo zásahu se vylíhne velká slepice. Následuje tě, léčí tě a každou sekundu zraňuje blízké nepřátele.'
    },
    E: {
      baseCooldown: 18.0, castTime: 0.4,
      baseDamage: 0, amount: 5, scaleAP: 0.35, scaleAD: 0.15,
      type: 'summon_healers', healInterval: 2,
      desc: 'Vyvolá 3 malé podpůrné slepičky. Najdou si nejbližšího spojence (max 1 u Keepera, max 2 u jiného). Následují ho, léčí ho a každou sekundu zraňují blízké nepřátele.'
    }
  },

  Oracle: {
    glyph: 'Ω', role: 'SUPPORT', range: true, dmgType: 'magical', aaScale: 0.20,
    hp: 610, speed: 106, attackDelay: 1.3,
    baseAtk: 25, baseAD: 0, baseAP: 70,
    baseArmor: 20, baseMR: 25,
    Q: {
      baseCooldown: 11.0, castTime: 0.25,
      baseDamage: 70, scaleAP: 0.6, scaleAD: 0, scaleLevel: 10,
      type: 'projectile_pull', pSpeed: 650, life: 0.5, radius: 80, pGlyph: 'O', stunDuration: 1.0,
      desc: 'Vystřelí sféru. Při dopadu nebo zasažení cíle exploduje, zraní nepřátele v oblasti, vcucne je do středu a krátce omráčí.'
    },
    E: {
      baseCooldown: 14.0, castTime: 0.2,
      baseDamage: 0, scaleAP: 0.5, scaleAD: 0, amount: 80, scaleLevel: 15, duration: 5.0,
      type: 'spin_to_win', duration: 2.5, tickRate: 0.25, radius: 80,
      desc: 'Čepelová smršť: Roztočí se, po 2.5 sekundy zraňuje nepřátele v okolí a má mírně zvýšenou rychlost. Můžeš se u toho pohybovat!'
    }
  },

  Medic: {
      type: 'omnislash', count: 5, tickRate: 0.2, distance: 180, dashTime: 0.12,
    hp: 600, speed: 115, attackDelay: 1.2,
    baseAtk: 20, baseAD: 0, baseAP: 60,
    baseArmor: 20, baseMR: 20,
    Q: {
      baseCooldown: 4.0, castTime: 0.0,
      baseDamage: 0, scaleAP: 0.05, scaleAD: 0, amount: 2, scaleLevel: 0.5, range: 150, tickRate: 0.1,
      type: 'heal_beam',
      desc: 'Léčivý paprsek: Přepínatelné kouzlo. Připojí se k nejbližšímu spojenci (150) a trvale ho léčí. Při přerušení (nebo opětovném Q) naběhne 4s cooldown.'
    },
    E: {
      baseCooldown: 18.0, castTime: 0.2,
      baseDamage: 0, scaleAP: 0, scaleAD: 0, duration: 3.0,
      type: 'ubercharge',
      desc: 'UberCharge: Lze použít pouze pokud nepřetržitě léčíš cíl alespoň 5 sekund! Ty a cíl získáte nezranitelnost a 30% rychlost na 3 sekundy.'
    }
  }
};