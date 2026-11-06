import { game, camera } from '../shared/State.js';
import * as HordeMap from './MapConfig_Horde.js';
import { HordeBrain } from '../entities/BotBrain.js';
import { Minion } from '../entities/Entities.js';
import { dist } from '../shared/Utils.js';

// ── Horde Survival PvE Mode — 10 Vln Kooperativního/Solo přežití ──────────────
// Hráči (Modrý tým 0) brání Centrální Svatyni (Nexus Shrine, Věž 0) proti
// 10 eskalujícím vlnám monster, sebevrahů, golemů a bossů (Červený tým 1).
// Pokud padne Svatyně -> Prohra.
// Pokud hráči porazí Vlnu 10 s Abyssal Titanem -> Vítězství!

export const MONSTER_DEFS = {
  goblin: {
    name: 'Goblin', glyph: 'g', color: '#81c784',
    radius: 8, speed: 110, maxHp: 110, attackDamage: 12, attackRange: 55,
    expReward: 35, goldReward: 20,
  },
  skeleton: {
    name: 'Skeleton', glyph: 's', color: '#e0e0e0',
    radius: 9, speed: 85, maxHp: 210, attackDamage: 22, attackRange: 55,
    expReward: 50, goldReward: 30,
  },
  archer: {
    name: 'Dark Archer', glyph: 'a', color: '#ce93d8', isRanged: true,
    radius: 8, speed: 75, maxHp: 150, attackDamage: 26, attackRange: 200,
    expReward: 60, goldReward: 35,
  },
  bomber: {
    name: 'Kamikaze Bomber', glyph: '!', color: '#ff3d00', isBomber: true,
    radius: 9, speed: 130, maxHp: 135, attackDamage: 10, attackRange: 45,
    expReward: 70, goldReward: 45,
  },
  golem: {
    name: 'Iron Golem', glyph: 'G', color: '#90a4ae',
    radius: 14, speed: 60, maxHp: 750, attackDamage: 48, attackRange: 60,
    expReward: 120, goldReward: 80,
  },
  wraith: {
    name: 'Spectral Wraith', glyph: 'w', color: '#00e5ff', slowOnHit: 0.35,
    radius: 9, speed: 95, maxHp: 320, attackDamage: 28, attackRange: 55,
    expReward: 80, goldReward: 55,
  },
  warlord: {
    name: 'Corrupted Warlord', glyph: 'W', color: '#d50000', isBoss: true,
    radius: 18, speed: 80, maxHp: 2800, attackDamage: 65, attackRange: 65,
    expReward: 600, goldReward: 400,
  },
  nemesis: {
    name: 'Shadow Nemesis', glyph: 'N', color: '#aa00ff', isBoss: true,
    radius: 20, speed: 85, maxHp: 3400, attackDamage: 75, attackRange: 70,
    expReward: 700, goldReward: 450,
  },
  titan: {
    name: 'Abyssal Titan', glyph: 'Ω', color: '#ff1744', isBoss: true, isFinalBoss: true,
    radius: 28, speed: 70, maxHp: 8500, attackDamage: 115, attackRange: 80,
    expReward: 2000, goldReward: 1000,
  },
};

export const HORDE_WAVES = [
  {
    number: 1,
    title: 'The Scavengers',
    description: 'A scouting pack of nimble goblins.',
    rewardGold: 300,
    rewardExp: 350,
    shrineHeal: 700,
    spawns: [
      { type: 'goblin', count: 14, interval: 0.8 },
    ],
  },
  {
    number: 2,
    title: 'Rattle & Bones',
    description: 'Skeletons reinforced with dark archers.',
    rewardGold: 360,
    rewardExp: 450,
    shrineHeal: 700,
    spawns: [
      { type: 'skeleton', count: 10, interval: 0.7 },
      { type: 'archer',   count: 5,  interval: 1.0 },
    ],
  },
  {
    number: 3,
    title: 'Unstable Fuel',
    description: 'Kamikaze bombers rushing the Shrine! Shoot them before they reach you!',
    rewardGold: 420,
    rewardExp: 550,
    shrineHeal: 700,
    spawns: [
      { type: 'bomber', count: 6,  interval: 1.2 },
      { type: 'goblin', count: 12, interval: 0.6 },
    ],
  },
  {
    number: 4,
    title: 'The Iron Vanguard',
    description: 'Armored iron golems shielded by ranged volleys.',
    rewardGold: 500,
    rewardExp: 650,
    shrineHeal: 700,
    spawns: [
      { type: 'golem',    count: 4, interval: 1.5 },
      { type: 'archer',   count: 6, interval: 0.8 },
      { type: 'skeleton', count: 8, interval: 0.7 },
    ],
  },
  {
    number: 5,
    title: 'Warlords Descent (MINIBOSS)',
    description: 'The Corrupted Warlord unleashes devastating ground slams!',
    rewardGold: 620,
    rewardExp: 900,
    shrineHeal: 800,
    spawns: [
      { type: 'warlord',  count: 1, interval: 0.1, gate: 0 },
      { type: 'skeleton', count: 8, interval: 0.8 },
      { type: 'bomber',   count: 6, interval: 1.1 },
    ],
  },
  {
    number: 6,
    title: 'Frost Wraiths',
    description: 'Spectral wraiths slowing defenders while bombers sprint in.',
    rewardGold: 700,
    rewardExp: 1050,
    shrineHeal: 700,
    spawns: [
      { type: 'wraith', count: 10, interval: 0.8 },
      { type: 'bomber', count: 8,  interval: 1.0 },
    ],
  },
  {
    number: 7,
    title: 'Siege of Ashes',
    description: 'Heavy golems and artillery archers storm all 8 gates.',
    rewardGold: 800,
    rewardExp: 1250,
    shrineHeal: 700,
    spawns: [
      { type: 'golem',  count: 6, interval: 1.4 },
      { type: 'archer', count: 8, interval: 0.7 },
      { type: 'bomber', count: 6, interval: 1.0 },
    ],
  },
  {
    number: 8,
    title: 'Twin Horrors (DUAL MINIBOSS)',
    description: 'Two Shadow Nemeses attacking simultaneously from North and South!',
    rewardGold: 900,
    rewardExp: 1500,
    shrineHeal: 800,
    spawns: [
      { type: 'nemesis', count: 1, interval: 0.1, gate: 0 }, // Sever
      { type: 'nemesis', count: 1, interval: 0.1, gate: 2 }, // Jih
      { type: 'wraith',  count: 8, interval: 0.8 },
      { type: 'goblin',  count: 12, interval: 0.5 },
    ],
  },
  {
    number: 9,
    title: 'The Abyssal Swarm',
    description: 'A relentless continuous surge from every single gate!',
    rewardGold: 1100,
    rewardExp: 1900,
    shrineHeal: 800,
    spawns: [
      { type: 'goblin',   count: 12, interval: 0.4 },
      { type: 'skeleton', count: 8,  interval: 0.5 },
      { type: 'wraith',   count: 6,  interval: 0.6 },
      { type: 'bomber',   count: 8,  interval: 0.7 },
      { type: 'golem',    count: 4,  interval: 1.1 },
    ],
  },
  {
    number: 10,
    title: 'The Abyssal Titan (FINAL BOSS)',
    description: 'Defeat the Titan before he reduces the Nexus Shrine to rubble!',
    rewardGold: 2500,
    rewardExp: 3500,
    shrineHeal: 0,
    spawns: [
      { type: 'titan',  count: 1, interval: 0.1, gate: 0 }, // Severní brána
      { type: 'golem',  count: 6, interval: 1.5 },
      { type: 'bomber', count: 8, interval: 1.1 },
      { type: 'archer', count: 8, interval: 0.8 },
    ],
  },
];

export const GameMode_Horde = {
  name: 'horde',
  mapConfig: HordeMap,

  minionPathMode: 'linear',

  currentWave: 1,
  waveState: 'COUNTDOWN', // 'COUNTDOWN' | 'WAVE' | 'INTERMISSION' | 'VICTORY' | 'DEFEAT'
  stateTimer: 6.0,
  spawnQueue: [],
  spawnTimer: 0,
  totalWaveEnemies: 0,
  _spawnGateIdx: 0,

  init() {
    game.nexus = { 0: 1, 1: 1 };
    camera.scale = 1.35;

    // Nastavení Centrální Svatyně (Tower 0)
    if (game.towers && game.towers.length > 0) {
      const shrine = game.towers[0];
      shrine.owner = 0;
      shrine.control = 100;
      shrine.maxHp = 4000;
      shrine.hp = shrine.maxHp;
      shrine.attackDamage = 85;
      shrine.attackRange = 360;
      shrine.dead = false;
    }

    this.currentWave = 1;
    this.waveState = 'COUNTDOWN';
    this.stateTimer = 6.0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.totalWaveEnemies = 0;
    this._spawnGateIdx = 0;
  },

  _startWave(waveNum) {
    const waveIndex = waveNum - 1;
    const waveConfig = HORDE_WAVES[waveIndex];
    if (!waveConfig) return;

    this.currentWave = waveNum;
    this.waveState = 'WAVE';
    this.spawnQueue = [];

    // Naplň spawnQueue podle konfigurace
    for (const group of waveConfig.spawns) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({
          type: group.type,
          delay: group.interval || 0.8,
          gate: group.gate !== undefined ? group.gate : null,
        });
      }
    }

    // Zamíchej miniony kromě bossů (bossové jdou první nebo na specifické bráně)
    const bosses = this.spawnQueue.filter(item => item.gate !== null || MONSTER_DEFS[item.type]?.isBoss);
    const regulars = this.spawnQueue.filter(item => item.gate === null && !MONSTER_DEFS[item.type]?.isBoss);
    regulars.sort(() => Math.random() - 0.5);
    this.spawnQueue = [...bosses, ...regulars];

    this.totalWaveEnemies = this.spawnQueue.length;
    this.spawnTimer = 0.5;

    if (typeof window !== 'undefined' && typeof window.flashMessage === 'function') {
      window.flashMessage(`WAVE ${waveNum}: ${waveConfig.title.toUpperCase()}!`, 3.0);
    }
    if (typeof window !== 'undefined' && typeof window.playSound === 'function') {
      window.playSound('capture_tower', HordeMap.mapCenter);
    }
  },

  tickSpawn(dt, spawnTimer, _spawnInterval) {
    if (game.gameOver) return 0;

    // 1. Počáteční odpočet před Vlnou 1
    if (this.waveState === 'COUNTDOWN') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this._startWave(1);
      }
      return 0;
    }

    // 2. Probíhající vlna — postupné spawnování monster ze spawnQueue
    if (this.waveState === 'WAVE') {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const item = this.spawnQueue.shift();
          this.spawnTimer = item.delay || 0.7;

          // Určení brány pro spawn
          const gates = HordeMap.hordeSpawns;
          let gatePos;
          if (item.gate !== null && gates[item.gate]) {
            gatePos = gates[item.gate];
          } else {
            gatePos = gates[this._spawnGateIdx % gates.length];
            this._spawnGateIdx++;
          }

          const def = MONSTER_DEFS[item.type] || MONSTER_DEFS.goblin;
          const jitterX = (Math.random() - 0.5) * 40;
          const jitterY = (Math.random() - 0.5) * 40;

          // Spawn monstra do týmu 1 s cílem Svatyně (index 0)
          const m = new Minion(gatePos.x + jitterX, gatePos.y + jitterY, 1, 0, {
            name: def.name,
            glyph: def.glyph,
            color: def.color,
            radius: def.radius,
            speed: def.speed,
            maxHp: def.maxHp,
            attackDamage: def.attackDamage,
            attackRange: def.attackRange,
            isRanged: def.isRanged || false,
            isBomber: def.isBomber || false,
            isBoss: def.isBoss || false,
            isFinalBoss: def.isFinalBoss || false,
            slowOnHit: def.slowOnHit || 0,
            goldReward: def.goldReward,
            expReward: def.expReward,
          });
          game.minions.push(m);
        }
      } else {
        // Všechna monstra vypsána ze spawnQueue — zkontroluj, zda jsou všechna mrtvá
        const livingMonsters = game.minions.filter(m => !m.dead && m.team === 1);
        if (livingMonsters.length === 0) {
          // Vlna dokončena!
          if (this.currentWave >= 10) {
            // Vítězství! Vlna 10 poražena!
            this.waveState = 'VICTORY';
            this._triggerGameOver(0, null);
          } else {
            // Přejdi do Intermise
            this.waveState = 'INTERMISSION';
            this.stateTimer = 12.0;

            const waveConfig = HORDE_WAVES[this.currentWave - 1];
            const gReward = waveConfig ? waveConfig.rewardGold : 300;
            const eReward = waveConfig ? waveConfig.rewardExp : 400;

            // Odměň přeživší hráče a spojenecké boty
            for (const p of game.players) {
              if (p.team === 0) {
                p.gold = (p.gold || 0) + gReward;
                p.totalGold = (p.totalGold || 0) + gReward;
                if (typeof p.gainExp === 'function') p.gainExp(eReward);
                // Boti si nakoupí výbavu v pauze mezi vlnami
                if (p.constructor && typeof p.constructor.botBuyItems === 'function') {
                  try { p.constructor.botBuyItems(p, []); } catch (e) {}
                }
              }
            }

            // Oprav Centrální Svatyni
            const shrine = game.towers[0];
            if (shrine && !shrine.dead) {
              const healAmt = waveConfig ? waveConfig.shrineHeal : 700;
              shrine.hp = Math.min(shrine.maxHp, shrine.hp + healAmt);
            }

            if (typeof window !== 'undefined' && typeof window.flashMessage === 'function') {
              window.flashMessage(`WAVE ${this.currentWave} CLEARED! +${gReward}G / SHRINE REPAIRED`, 3.5);
            }
            if (typeof window !== 'undefined' && typeof window.playSound === 'function') {
              window.playSound('powerup_pickup', HordeMap.mapCenter);
            }
          }
        }
      }
      return 0;
    }

    // 3. Intermise mezi vlnami
    if (this.waveState === 'INTERMISSION') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this._startWave(this.currentWave + 1);
      }
      return 0;
    }

    return 0;
  },

  tickObjective(_dt, _nexusDrainRate, socket) {
    if (game.startDelay > 0 || game.gameOver) return;

    // Svatyně zničena -> Prohra!
    const shrine = game.towers[0];
    if (shrine && shrine.dead && !game.gameOver) {
      this.waveState = 'DEFEAT';
      this._triggerGameOver(1, socket);
    }
  },

  _triggerGameOver(winner, socket) {
    game.gameOver = true;
    game.winner = winner;

    if (typeof window !== 'undefined' && typeof window.showEnd === 'function') {
      try { window.showEnd(winner); } catch (e) {}
    }

    if (socket) {
      socket.emit('host_event', {
        type: 'game_over',
        winner,
        finalStats: game.players.map(p => ({
          id: p.id, stats: p.stats, kills: p.kills, deaths: p.deaths, assists: p.assists,
          totalGold: p.totalGold,
          pcs: p.pcs || 0, pcsBreakdown: p.pcsBreakdown || null,
        })),
      });
    }
  },

  drawHUD(ctx, cw, isMobile) {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    // 1. Horní informační lišta
    ctx.font = 'bold 12px monospace';
    if (this.waveState === 'COUNTDOWN') {
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`[ HORDE SURVIVAL ] INCOMING IN ${Math.ceil(this.stateTimer)}s`, cw / 2, 2);
    } else if (this.waveState === 'INTERMISSION') {
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(`WAVE ${this.currentWave} CLEARED! NEXT WAVE IN ${Math.ceil(this.stateTimer)}s (SHOP: [B])`, cw / 2, 2);
    } else if (this.waveState === 'VICTORY') {
      ctx.fillStyle = '#00ff66';
      ctx.fillText(`VICTORY! ALL 10 WAVES CLEARED!`, cw / 2, 2);
    } else {
      ctx.fillStyle = '#ff4e4e';
      const waveTitle = HORDE_WAVES[this.currentWave - 1]?.title || '';
      ctx.fillText(`WAVE ${this.currentWave} / 10 — "${waveTitle.toUpperCase()}"`, cw / 2, 2);
    }

    // 2. Centrální ukazatel stavu Svatyně (Shrine HP Bar)
    const shrine = game.towers[0];
    if (shrine) {
      const sHp = Math.max(0, Math.ceil(shrine.hp));
      const sMax = shrine.maxHp || 4000;
      const pct = Math.max(0, Math.min(1, sHp / sMax));

      const barW = isMobile ? 180 : 260;
      const barH = isMobile ? 12 : 14;
      const bx = cw / 2 - barW / 2;
      const by = isMobile ? 18 : 22;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

      // Barva podle zdraví svatyně
      const barColor = pct > 0.5 ? '#00e5ff' : pct > 0.25 ? '#ffcc00' : '#ff1744';
      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by, barW * pct, barH);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);

      ctx.font = isMobile ? 'bold 9px monospace' : 'bold 11px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`NEXUS SHRINE: ${sHp} / ${sMax} HP`, cw / 2, by + 1);
    }

    // 3. Počet zbývajících monster nebo Boss HP Bar
    if (this.waveState === 'WAVE') {
      const livingEnemies = game.minions.filter(m => !m.dead && m.team === 1);
      const activeBoss = livingEnemies.find(m => m.isBoss);

      if (activeBoss) {
        // Velký ukazatel bosse
        const bHp = Math.max(0, Math.ceil(activeBoss.hp));
        const bMax = activeBoss.maxHp;
        const bPct = Math.max(0, Math.min(1, bHp / bMax));

        const bossBarW = isMobile ? 220 : 320;
        const bossBarH = isMobile ? 14 : 16;
        const bbx = cw / 2 - bossBarW / 2;
        const bby = isMobile ? 36 : 42;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(bbx - 2, bby - 2, bossBarW + 4, bossBarH + 4);

        ctx.fillStyle = '#ff1744';
        ctx.fillRect(bbx, bby, bossBarW * bPct, bossBarH);

        ctx.strokeStyle = '#ff8888';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bbx, bby, bossBarW, bossBarH);

        ctx.font = isMobile ? 'bold 10px monospace' : 'bold 12px monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(`⚔ ${activeBoss.name.toUpperCase()}: ${bHp} / ${bMax} ⚔`, cw / 2, bby + 2);
      } else {
        const remaining = livingEnemies.length + this.spawnQueue.length;
        ctx.font = isMobile ? '10px monospace' : '12px monospace';
        ctx.fillStyle = '#bbb';
        ctx.fillText(`ENEMIES: ${remaining} REMAINING`, cw / 2, isMobile ? 36 : 42);
      }
    }
  },

  getBotLane(_idx) {
    return 'mid';
  },

  homeTowerIndexes: { 0: [0], 1: [] },

  botBrain: HordeBrain,
};
