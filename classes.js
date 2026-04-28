export const SUMMONER_SPELLS = {
  Heal: { name: 'Heal', desc: 'Léčí 150 HP + 20 za level.', cd: 120 },
  Ghost: { name: 'Ghost', desc: 'Zvýší rychlost o +40% na 5s.', cd: 90 },
  Boost: { name: 'Boost', desc: 'Zvýší staty (+10%) na 5s.', cd: 90 },
  Rally: { name: 'Rally', desc: 'Zrychlí obsazování, léčí a posílí okolní miniony.', cd: 120 },
  Revive: { name: 'Revive', desc: 'Okamžité oživení při smrti.', cd: 180 },
  Exhaust: { name: 'Exhaust', desc: 'Zpomalí nepřátele (300 unitů) o 40% na 2s.', cd: 90 }
};

export const CLASSES = {
  Mage: { glyph: 'M', range: true, dmgType: 'magical', hp: 650, speed: 112, attackDelay: 1.4, baseAtk: 35, baseAD: 0, baseAP: 85, baseArmor: 15, baseMR: 30,
    Q: { baseCooldown: 3.5, castTime: 0.2, baseDamage: 105, scaleAP: 0.75, scaleAD: 0, type: 'projectile', pGlyph: 'O', pSpeed: 750, desc: 'Vystřelí silnou magickou kouli.' },
    E: { baseCooldown: 7.0, castTime: 0.2, baseDamage: 105, scaleAP: 0.95, scaleAD: 0, type: 'aoe', radius: 160, desc: 'Exploze magické energie v okolí.' }
  },
  Tank: { glyph: 'T', range: false, dmgType: 'physical', hp: 1050, speed: 96, attackDelay: 1.4, baseAtk: 45, baseAD: 30, baseAP: 0, baseArmor: 45, baseMR: 40,
    Q: { baseCooldown: 7.0, castTime: 0.1, baseDamage: 0, scaleAP: 0, scaleAD: 0, type: 'heal_self', amount: 90, desc: 'Vyléčí si část svých životů.' },
    E: { baseCooldown: 10.0, castTime: 0.4, baseDamage: 65, scaleAP: 0, scaleAD: 0.2, type: 'aoe', radius: 144, desc: 'Drtivý úder do země (plošné zranění).' }
  },
  Bruiser: { glyph: 'B', range: false, dmgType: 'physical', hp: 850, speed: 120, attackDelay: 1.1, baseAtk: 50, baseAD: 50, baseAP: 0, baseArmor: 30, baseMR: 25,
    Q: { baseCooldown: 6.0, castTime: 0.2, baseDamage: 77, scaleAP: 0, scaleAD: 0.4, type: 'projectile', pGlyph: 'D', pSpeed: 600, life: 0.35, desc: 'Vrhne těžkou zbraň před sebe.' },
    E: { baseCooldown: 10.0, castTime: 0.1, baseDamage: 55, scaleAP: 0, scaleAD: 0.3, type: 'dash', distance: 220, radius: 96, desc: 'Skočí vpřed a při dopadu zraní okolí.' }
  },
  Assassin: { glyph: 'A', range: false, dmgType: 'physical', hp: 550, speed: 130, attackDelay: 0.8, baseAtk: 50, baseAD: 60, baseAP: 0, baseArmor: 20, baseMR: 20,
    Q: { baseCooldown: 5.0, castTime: 0.1, baseDamage: 45, scaleAP: 0, scaleAD: 0.25, type: 'projectile', count: 3, spread: 0.45, pGlyph: '-', pSpeed: 960, life: 0.21, desc: 'Vrhne 3 dýky v kuželu před sebe.' },
    E: { baseCooldown: 8.0, castTime: 0.1, baseDamage: 85, scaleAP: 0, scaleAD: 0.7, type: 'aoe', radius: 112, desc: 'Krvavá exploze nožů kolem sebe.' }
  },
  Healer: { glyph: 'H', range: true, dmgType: 'magical', hp: 600, speed: 104, attackDelay: 1.1, baseAtk: 25, baseAD: 0, baseAP: 60, baseArmor: 20, baseMR: 25,
    Q: { baseCooldown: 4.5, castTime: 0.2, baseDamage: 75, scaleAP: 0.65, scaleAD: 0, type: 'projectile', pGlyph: '+', pSpeed: 660, desc: 'Zraňující paprsek světla.' },
    E: { baseCooldown: 9.0, castTime: 0.2, baseDamage: 0, scaleAP: 0.3, scaleAD: 0, type: 'heal_aoe', amount: 90, radius: 200, desc: 'Plošně vyléčí sebe i spojence.' }
  },
  Marksman: { glyph: '»', range: true, dmgType: 'physical', hp: 600, speed: 120, attackDelay: 0.9, baseAtk: 75, baseAD: 75, baseAP: 0, baseArmor: 15, baseMR: 15,
    Q: { baseCooldown: 4.0, castTime: 0.15, baseDamage: 95, scaleAP: 0, scaleAD: 0.5, type: 'projectile', pGlyph: '»', pSpeed: 1200, desc: 'Průrazná rychlá střela.' },
    E: { baseCooldown: 11.0, castTime: 0.1, baseDamage: 0, scaleAP: 0, scaleAD: 0, type: 'dash', distance: 250, desc: 'Taktický úskok do bezpečí.' }
  },
  Summoner: { glyph: 'S', range: true, dmgType: 'magical', hp: 600, speed: 108, attackDelay: 1.3, baseAtk: 30, baseAD: 0, baseAP: 85, baseArmor: 20, baseMR: 20,
    Q: { baseCooldown: 4.0, castTime: 0.2, baseDamage: 100, scaleAP: 0.85, scaleAD: 0, type: 'projectile', pGlyph: '~', pSpeed: 750, desc: 'Vystřelí stínový projektil.' },
    E: { baseCooldown: 12.0, castTime: 0.5, baseDamage: 35, scaleAP: 0.55, scaleAD: 0, type: 'summon', count: 2, mGlyph: 'g', desc: 'Vyvolá 2 ghúly na pomoc v boji.' }
  },
  Vanguard: { glyph: 'V', range: false, dmgType: 'physical', hp: 950, speed: 116, attackDelay: 1.4, baseAtk: 40, baseAD: 35, baseAP: 0, baseArmor: 35, baseMR: 30,
    Q: { baseCooldown: 7.0, castTime: 0.2, baseDamage: 55, scaleAP: 0, scaleAD: 0.3, type: 'dash', distance: 220, radius: 104, desc: 'Výpad štítem, zraní cíl dopadu.' },
    E: { baseCooldown: 9.0, castTime: 0.3, baseDamage: 77, scaleAP: 0, scaleAD: 0.4, type: 'aoe', radius: 136, desc: 'Máchne zbraní a zničí vše okolo.' }
  },
  Goliath: { glyph: 'G', range: false, dmgType: 'physical', hp: 1100, speed: 96, attackDelay: 1.8, baseAtk: 50, baseAD: 30, baseAP: 0, baseArmor: 45, baseMR: 45,
    Q: { baseCooldown: 8.0, castTime: 0.3, baseDamage: 60, scaleAP: 0, scaleAD: 0.3, type: 'dash', distance: 250, radius: 120, desc: 'Nezastavitelný náraz do nepřátel.' },
    E: { baseCooldown: 12.0, castTime: 0.1, baseDamage: 0, scaleAP: 0, scaleAD: 0, type: 'heal_self', amount: 110, desc: 'Zatne svaly a masivně se vyléčí.' }
  },
  Acolyte: { glyph: 'C', range: true, dmgType: 'magical', hp: 600, speed: 108, attackDelay: 1.2, baseAtk: 25, baseAD: 0, baseAP: 90, baseArmor: 15, baseMR: 20,
    Q: { baseCooldown: 4.0, castTime: 0.1, baseDamage: 0, scaleAP: 0.3, scaleAD: 0, type: 'heal_aoe', amount: 65, radius: 240, desc: 'Rychlá léčivá vlna pro spojence.' },
    E: { baseCooldown: 5.5, castTime: 0.2, baseDamage: 65, scaleAP: 0.55, scaleAD: 0, type: 'projectile', count: 3, spread: 0.3, pGlyph: '*', pSpeed: 850, desc: 'Vypustí 3 magické střely pro obranu.' }
  },
  Runner: { glyph: 'R', range: false, dmgType: 'magical', hp: 600, speed: 135, attackDelay: 0.9, baseAtk: 40, baseAD: 0, baseAP: 50, baseArmor: 20, baseMR: 20,
    Q: { baseCooldown: 8.0, castTime: 0.0, baseDamage: 0, scaleAP: 0, scaleAD: 0, type: 'buff_ms', amount: 0.5, duration: 3.0, desc: 'Zvýší rychlost pohybu o 50% na 3s.' },
    E: { baseCooldown: 5.0, castTime: 0.1, baseDamage: 55, scaleAP: 0.6, scaleAD: 0, type: 'aoe', radius: 120, desc: 'Malá magická exploze v blízkém okolí.' }
  },
  Hana: { glyph: '✿', range: false, dmgType: 'magical', hp: 1000, speed: 125, attackDelay: 1.2, baseAtk: 50, baseAD: 0, baseAP: 40, baseArmor: 35, baseMR: 35,
    Q: { baseCooldown: 11.0, castTime: 0.1, baseDamage: 0, scaleAP: 0, scaleAD: 0, type: 'hana_q', desc: '1s absolutní imunita, 6s masivní HP regen.' },
    E: { baseCooldown: 8.0, castTime: 0.1, baseDamage: 50, scaleAP: 0.4, scaleAD: 0, type: 'dash_def', distance: 250, radius: 128, desc: 'Plošný Dash se zvýšením obrany.' }
  },
  Jirina: { glyph: '❋', range: false, dmgType: 'magical', hp: 900, speed: 110, attackDelay: 1.2, baseAtk: 40, baseAD: 0, baseAP: 40, baseArmor: 35, baseMR: 35,
    Q: { baseCooldown: 6.0, castTime: 0.2, baseDamage: 45, scaleAP: 0.2, scaleAD: 0, type: 'aoe_knockback', radius: 144, desc: 'Tlaková vlna, která odhodí nepřátele.' },
    E: { baseCooldown: 10.0, castTime: 0.2, baseDamage: 0, amount: 65, scaleAP: 0.4, scaleAD: 0, type: 'heal_aoe', radius: 200, desc: 'Plošně vyléčí sebe i spojence.' }
  }
};