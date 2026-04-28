export const shopItems = [
  { id:'ad', name:'Long Sword', desc:'+15 AD', cost:300, apply: (pl)=>{ pl.AD += 15 } },
  { id:'ap', name:'Amplifying Tome', desc:'+15 AP', cost:300, apply: (pl)=>{ pl.AP += 15 } },
  { id:'as', name:'Dagger', desc:'+35% Attack Speed', cost:300, apply: (pl)=>{ pl.attackSpeed += 0.35 } },
  { id:'armor', name:'Cloth Armor', desc:'+15 Armor', cost:300, apply: (pl)=>{ pl.armor += 15 } },
  { id:'mr', name:'Null-Magic Mantle', desc:'+15 Magic Resist', cost:300, apply: (pl)=>{ pl.mr += 15 } },
  { id:'hp', name:'Ruby Crystal', desc:'+110 HP, +1.5 HP Regen', cost:300, apply: (pl)=>{ pl.maxHp += 110; pl.hp += 110; pl.hpRegen += 1.5; } },
  { id:'boots', name:'Boots of Speed', desc:'+40 Speed (Unique)', cost:300, apply: (pl)=>{ pl.speed += 40; pl.hasBoots = true; } }
];