const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
export const game = {
  autoTarget: true, autoPlay: isMobile, showDebug: false, started: false,
  players: [], projectiles: [], minions: [], towers: [], damageNumbers: [], particles: [], effectTexts: [], walls: [],
  shake: 0, screenDamageFlash: 0, screenHealFlash: 0, nexus: {0:500, 1:500}, gameOver: false, winner: null, startDelay: 10.0,
  heals: [], powerup: null, isHost: false, isSpectator: false,
  killFeed: []
};

export const camera = { x: 0, y: 0, scale: 1.52 }; // Přiblíženo o 10%
export const TEAM_COLOR = ['#486FED', '#FF4E4E'];
export const NEUTRAL_COLOR = '#999999';
export const RANGED_ATTACK_RANGE = 320;
export const MELEE_ATTACK_RANGE = 80;

export const BOT_WEIGHTS = {
    attackVisionRange: 500, // Zkráceno, aby nehonili přes půl mapy
    enemyBaseScore: 850,     // Sníženo o 15%
    heroKillScore: 425,      // Sníženo o 15%
    lowHpScore: 255,         // Sníženo o 15%
    
    towerBaseScore: 11500,   // Zvýšeno o 15%
    laneMatchScore: 5750,    // Zvýšeno o 15%
    neutralTowerScore: 6900, // Zvýšeno o 15%
    emptyTowerScore: 3450,   // Zvýšeno o 15%
    overcrowdedTowerPenalty: 20000,
    
    minionPushBaseScore: 20700, // Zvýšeno o 15%
    objectiveHysteresis: 1500,
    objectiveFocusThreshold: 14950, // Zvýšeno o 15%
    
    healScore: 14000,
    powerupScore: 16000,
    enemyBasePenalty: 100000 // Zvýšeno o 100% - absolutní zákaz vstupu na cizí spawn
};