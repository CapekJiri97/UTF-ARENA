import { smoothPolygon } from './Utils.js';

// ── ARAM mapa — jedna horizontální linka ──────────────────────────────────────
//
// Layout (leva→pravá):
//   [Blue spawn] [T0 blue] [T1 blue] [T2 blue/nexus] ── střed ── [T3 red/nexus] [T4 red] [T5 red] [Red spawn]
//
// Věže T2 a T3 jsou "nexus věže" — jejich zničení = výhra protivníka.
// Minionové se spawní u T0/T5 a tlačí k nepřátelskému nexusu.
// Hráči spawnují za svou nexus věží.

export const world = { width: 3200, height: 1400 };

// Spawn hráčů — za nejzazšími věžemi
export const spawnPoints = [
  { x: 220, y: 700 },   // modrý tým — vlevo
  { x: 2980, y: 700 },  // červený tým — vpravo
];

// 6 věží v linii — indexy 0-2 modré, 3-5 červené
// T2 = blue nexus věž, T3 = red nexus věž
export const towerPositions = [
  { x: 550,  y: 700 }, // T0 — blue outer
  { x: 950,  y: 700 }, // T1 — blue mid
  { x: 1350, y: 700 }, // T2 — blue nexus věž (game winning objective)
  { x: 1850, y: 700 }, // T3 — red nexus věž  (game winning objective)
  { x: 2250, y: 700 }, // T4 — red mid
  { x: 2650, y: 700 }, // T5 — red outer
];

// Nexus věže — indexy které při zničení (owner = nepřítel) ukončují hru
export const nexusTowerIndex = { 0: 2, 1: 3 }; // blue nexus = T2, red nexus = T3

// Minion spawn pointy — jeden na každou věž (minionové startují u své nejzazší věže)
export const MINION_SPAWN_POINTS = [
  { x: 400,  y: 700 }, // u T0
  { x: 750,  y: 700 }, // u T1
  { x: 1150, y: 700 }, // u T2
  { x: 2050, y: 700 }, // u T3
  { x: 2450, y: 700 }, // u T4
  { x: 2800, y: 700 }, // u T5
];

// Heal pickupy — rozmístěny podél linky
export const healPickupPositions = [
  { x: 700,  y: 560 },
  { x: 700,  y: 840 },
  { x: 1100, y: 560 },
  { x: 1100, y: 840 },
  { x: 1600, y: 700 }, // střed
  { x: 2100, y: 560 },
  { x: 2100, y: 840 },
  { x: 2500, y: 560 },
  { x: 2500, y: 840 },
];

// Powerup — přesně uprostřed linky
export const powerupPosition = { x: 1600, y: 700 };

// Zdi podél horní a dolní hranice linky + překážky uprostřed
export const rawPolys = [
  // Horní zeď levá část
  [{ x: 300, y: 400 }, { x: 1500, y: 400 }, { x: 1500, y: 480 }, { x: 300, y: 480 }],
  // Dolní zeď levá část
  [{ x: 300, y: 920 }, { x: 1500, y: 920 }, { x: 1500, y: 1000 }, { x: 300, y: 1000 }],
  // Horní zeď pravá část
  [{ x: 1700, y: 400 }, { x: 2900, y: 400 }, { x: 2900, y: 480 }, { x: 1700, y: 480 }],
  // Dolní zeď pravá část
  [{ x: 1700, y: 920 }, { x: 2900, y: 920 }, { x: 2900, y: 1000 }, { x: 1700, y: 1000 }],
  // Překážka střed horní
  [{ x: 1480, y: 480 }, { x: 1720, y: 480 }, { x: 1720, y: 570 }, { x: 1480, y: 570 }],
  // Překážka střed dolní
  [{ x: 1480, y: 830 }, { x: 1720, y: 830 }, { x: 1720, y: 920 }, { x: 1480, y: 920 }],
  // Malé pilíře u T1
  [{ x: 820, y: 530 }, { x: 880, y: 530 }, { x: 880, y: 590 }, { x: 820, y: 590 }],
  [{ x: 820, y: 810 }, { x: 880, y: 810 }, { x: 880, y: 870 }, { x: 820, y: 870 }],
  // Malé pilíře u T4
  [{ x: 2320, y: 530 }, { x: 2380, y: 530 }, { x: 2380, y: 590 }, { x: 2320, y: 590 }],
  [{ x: 2320, y: 810 }, { x: 2380, y: 810 }, { x: 2380, y: 870 }, { x: 2320, y: 870 }],
];

// Hex zdi u nexus věží (vizuální ochrana)
export const nexusHexWalls = [
  { x: 1280, y: 580, r: 35 },
  { x: 1280, y: 820, r: 35 },
  { x: 1920, y: 580, r: 35 },
  { x: 1920, y: 820, r: 35 },
];

// Hranice hrací plochy
export const rawMapBoundary = [
  { x: 80,   y: 380 }, { x: 300,  y: 300 }, { x: 1500, y: 300 },
  { x: 1600, y: 240 }, { x: 1700, y: 300 }, { x: 2900, y: 300 },
  { x: 3120, y: 380 }, { x: 3120, y: 1020 }, { x: 2900, y: 1100 },
  { x: 1700, y: 1100 }, { x: 1600, y: 1160 }, { x: 1500, y: 1100 },
  { x: 300,  y: 1100 }, { x: 80,   y: 1020 },
];
export const mapBoundary = smoothPolygon(rawMapBoundary, 5);

// Vision config pro fog-of-war
export const mapCenter = { x: 1600, y: 700 };
export const visionRings = {
  ringPush: 60,
  powerupRadius: 320,
  towerRadius: 380,
  interpolatedRadius: 280,
  interpolationStep: 220,
};
