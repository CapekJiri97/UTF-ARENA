import { pathToFileURL } from 'url';
import path from 'path';

// Mock DOM
const mockEl = () => ({
  appendChild: () => {},
  querySelector: () => mockEl(),
  querySelectorAll: () => [],
  addEventListener: () => {},
  scrollBy: () => {},
  style: {},
  dataset: {},
  classList: { add: () => {}, remove: () => {} },
  getContext: () => ({ fillRect: () => {}, strokeRect: () => {}, fillText: () => {}, beginPath: () => {}, arc: () => {}, stroke: () => {} })
});
globalThis.document = {
  createElement: mockEl,
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  getElementById: mockEl,
  querySelector: mockEl,
  querySelectorAll: () => []
};
globalThis.requestAnimationFrame = () => {};
globalThis.cancelAnimationFrame = () => {};
globalThis.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  requestAnimationFrame: () => {},
  cancelAnimationFrame: () => {},
  flashMessage: (msg) => console.log(`[FLASH] ${msg}`),
  playSound: (snd) => {},
  showEnd: (winner) => console.log(`[SHOW_END] Winner: ${winner === 0 ? 'SURVIVORS' : 'HORDE'}`)
};

const projectRoot = 'c:/Users/Jiří Čapek/OneDrive/VISUAL STUDIO CODE - KODY/UTF ARENA RENDER/utf-arena-main';

const main = await import(pathToFileURL(path.join(projectRoot, 'main.js')).href);
const { game } = await import(pathToFileURL(path.join(projectRoot, 'shared/State.js')).href);
const { GameMode_Horde, HORDE_WAVES, MONSTER_DEFS } = await import(pathToFileURL(path.join(projectRoot, 'gamemodes/GameMode_Horde.js')).href);
const HordeMap = await import(pathToFileURL(path.join(projectRoot, 'gamemodes/MapConfig_Horde.js')).href);
const { BotPlayer, Player } = await import(pathToFileURL(path.join(projectRoot, 'entities/Player.js')).href);
const { Tower, Minion, HealPickup } = await import(pathToFileURL(path.join(projectRoot, 'entities/Entities.js')).href);
const { HordeBrain } = await import(pathToFileURL(path.join(projectRoot, 'entities/BotBrain.js')).href);

console.log('====================================================');
console.log('   STARTING HORDE SURVIVAL PVE VERIFICATION SUITE   ');
console.log('====================================================\n');

// 1. Activation and Map Checks
console.log('--- 1. Testing Mode Activation & Map Initialization ---');
main.setActiveMode('horde');
if (main.activeGameMode.name !== 'horde') throw new Error('Failed to activate horde mode!');
main.initWalls();
main.initTowers();
main.activeGameMode.init();

console.log(`Active mode: ${main.activeGameMode.name}`);
console.log(`World size: ${HordeMap.world.width}x${HordeMap.world.height}`);
console.log(`Horde spawn gates: ${HordeMap.hordeSpawns.length}`);
if (HordeMap.hordeSpawns.length !== 8) throw new Error('Expected 8 invasion gates!');

if (game.towers.length !== 1) throw new Error(`Expected 1 central tower, got ${game.towers.length}`);
const shrine = game.towers[0];
console.log(`Central Shrine: HP=${shrine.hp}/${shrine.maxHp}, owner=${shrine.owner}, pos=(${shrine.pos.x}, ${shrine.pos.y})`);
if (shrine.maxHp !== 4000 || shrine.hp !== 4000 || shrine.owner !== 0) {
  throw new Error('Shrine not correctly initialized!');
}
console.log('✓ Shrine properly initialized at center with 4000 HP and Team 0 ownership.\n');

// 2. Wave 1 Spawning & Goblins
console.log('--- 2. Testing Wave 1 & Goblin Mechanics ---');
const horde = main.activeGameMode;
console.log(`Initial waveState: ${horde.waveState}, timer: ${horde.stateTimer}s`);
// Fast-forward initial countdown
horde.tickSpawn(7.0, 0, 0);
console.log(`After 7s: waveState=${horde.waveState}, currentWave=${horde.currentWave}, totalEnemies=${horde.totalWaveEnemies}`);
if (horde.waveState !== 'WAVE' || horde.currentWave !== 1) throw new Error('Wave 1 did not start!');

// Spawn queued monsters
for (let step = 0; step < 25; step++) {
  horde.tickSpawn(1.0, 0, 0);
}
console.log(`Active monsters spawned: ${game.minions.length}`);
if (game.minions.length !== 14) throw new Error(`Expected 14 goblins spawned, got ${game.minions.length}`);

const goblin = game.minions[0];
console.log(`Goblin stats: glyph='${goblin.glyph}', color=${goblin.color}, hp=${goblin.hp}/${goblin.maxHp}, speed=${goblin.speed}`);
if (goblin.glyph !== 'g' || goblin.maxHp !== 110) throw new Error('Goblin attributes do not match specs!');
console.log('✓ Wave 1 spawned 14 goblins with correct stats.\n');

// 3. Testing Kamikaze Bomber Explosion
console.log('--- 3. Testing Kamikaze Bomber Explosion Mechanics ---');
game.players = [];
const testHero = new Player(1100, 1050, { team: 0, id: 'test_hero', className: 'Vanguard' });
game.players.push(testHero);
const heroStartHp = testHero.hp;
const shrineStartHp = shrine.hp;

const bomberDef = MONSTER_DEFS.bomber;
const bomber = new Minion(1100, 1070, 1, 0, {
  name: bomberDef.name,
  glyph: bomberDef.glyph,
  color: bomberDef.color,
  isBomber: true,
  maxHp: bomberDef.maxHp,
  speed: bomberDef.speed,
  goldReward: bomberDef.goldReward,
});
game.minions.push(bomber);

console.log(`Spawned bomber at (1100, 1070) - distance to hero: 20px, distance to shrine: 30px`);
// Trigger bomber update which should detonate
bomber.update(0.1);

if (!bomber.dead) throw new Error('Bomber did not detonate!');
console.log(`Bomber detonated! Hero HP: ${heroStartHp} -> ${testHero.hp} (Damage: ${heroStartHp - testHero.hp})`);
console.log(`Shrine HP: ${shrineStartHp} -> ${shrine.hp} (Damage: ${shrineStartHp - shrine.hp})`);
if (testHero.hp >= heroStartHp) throw new Error('Hero did not take explosion damage!');
if (shrine.hp >= shrineStartHp) throw new Error('Shrine did not take explosion damage!');
console.log('✓ Kamikaze Bomber detonated and dealt AoE damage to hero & shrine.\n');

// 4. Testing Miniboss Corrupted Warlord & Stomp Ability
console.log('--- 4. Testing Miniboss & Stomp Ability ---');
const warlordDef = MONSTER_DEFS.warlord;
const warlord = new Minion(1100, 1000, 1, 0, {
  name: warlordDef.name,
  glyph: warlordDef.glyph,
  color: warlordDef.color,
  isBoss: true,
  maxHp: warlordDef.maxHp,
  attackDamage: warlordDef.attackDamage,
});
game.minions.push(warlord);
console.log(`Warlord spawned: HP=${warlord.hp}/${warlord.maxHp}, isBoss=${warlord.isBoss}, bossAbilityCd=${warlord.bossAbilityCd}`);
if (warlord.hp !== 2800 || !warlord.isBoss) throw new Error('Warlord stats incorrect!');

// Fast-forward bossAbilityCd to 0 and update to trigger stomp
warlord.bossAbilityCd = 0.05;
const hpBeforeStomp = testHero.hp;
warlord.update(0.1);
console.log(`Warlord performed stomp! Hero HP: ${hpBeforeStomp} -> ${testHero.hp}, hero stunTimer: ${testHero.stunTimer}`);
if (testHero.hp >= hpBeforeStomp) throw new Error('Hero did not take damage from Boss Stomp!');
if (testHero.stunTimer <= 0) throw new Error('Hero was not stunned by Boss Stomp!');
console.log('✓ Miniboss stomp shockwave knocked back, stunned, and damaged nearby hero.\n');

// 5. Testing Wave Clear, Intermission & Shrine Healing
console.log('--- 5. Testing Wave Clear & Intermission ---');
// Clear all minions
game.minions.forEach(m => m.dead = true);
shrine.hp = 2500; // Simulate damaged shrine
testHero.gold = 100;

horde.spawnQueue = [];
horde.tickSpawn(0.1, 0, 0);

console.log(`WaveState after clearing wave: ${horde.waveState}, timer: ${horde.stateTimer}s`);
console.log(`Hero gold after wave reward: ${testHero.gold}`);
console.log(`Shrine HP after repair: ${shrine.hp}/${shrine.maxHp}`);
if (horde.waveState !== 'INTERMISSION') throw new Error('Expected INTERMISSION state!');
if (testHero.gold <= 100) throw new Error('Hero was not rewarded wave gold!');
if (shrine.hp <= 2500) throw new Error('Shrine was not repaired during wave clear!');
console.log('✓ Wave cleared: Intermission activated, gold awarded, shrine repaired.\n');

// 6. Testing Allied Bot AI (HordeBrain)
console.log('--- 6. Testing Allied Bot AI (HordeBrain) ---');
game.players = [];
const allyBot = new BotPlayer(1100, 1200, { team: 0, id: 'ally_bot_1', className: 'Reaper' });
game.players.push(allyBot);

// Spawn a dangerous bomber approaching the shrine
const threatBomber = new Minion(1100, 800, 1, 0, { isBomber: true, glyph: '!' });
game.minions = [threatBomber];

// Run HordeBrain macro assignment
let assignedOrder = null;
HordeBrain.assignMacroOrders({
  teamBots: [allyBot],
  unassigned: [allyBot],
  assign: (bot, type, target) => {
    assignedOrder = { type, target };
    bot.macroOrder = { type, target };
  }
});

console.log(`Ally Bot assigned order: type=${assignedOrder?.type}, target is bomber: ${assignedOrder?.target === threatBomber}`);
if (!assignedOrder || assignedOrder.type !== 'HUNT' || assignedOrder.target !== threatBomber) {
  throw new Error('Allied bot failed to prioritize intercepting the bomber!');
}
console.log('✓ Allied Bot correctly prioritized hunting down the Kamikaze Bomber!\n');

// 7. Testing Win & Lose Conditions
console.log('--- 7. Testing Win & Lose Conditions ---');
// Test Shrine Death -> Defeat
game.startDelay = 0;
game.gameOver = false;
shrine.dead = true;
horde.tickObjective(0.1, 0, null);
console.log(`Shrine destroyed -> gameOver=${game.gameOver}, winner=${game.winner} (1 = Horde Victory, Player Defeat)`);
if (!game.gameOver || game.winner !== 1) throw new Error('Game over defeat condition failed!');
console.log('✓ Defeat condition triggered when Shrine fell.');

// Test Wave 10 Clearance -> Victory
game.gameOver = false;
shrine.dead = false;
shrine.hp = 3000;
horde.currentWave = 10;
horde.waveState = 'WAVE';
horde.spawnQueue = [];
game.minions = []; // all 10th wave monsters dead

horde.tickSpawn(0.1, 0, null);
console.log(`Wave 10 cleared -> gameOver=${game.gameOver}, winner=${game.winner} (0 = Survivors Victory!)`);
if (!game.gameOver || game.winner !== 0) throw new Error('Game over victory condition failed!');
console.log('✓ Victory condition triggered when Wave 10 was conquered!');

console.log('\n====================================================');
console.log('   ALL HORDE SURVIVAL VERIFICATIONS PASSED (100%)   ');
console.log('====================================================');
process.exit(0);
