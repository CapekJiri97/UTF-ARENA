import { smoothPolygon } from './Utils.js';

// ── ARAM mapa — jedna horizontální linka ──────────────────────────────────────
//
// Layout (leva→pravá):
//   [Blue spawn] [T0] [T1] [T2/nexus] ── střed ── [T3/nexus] [T4] [T5] [Red spawn]
//
// Věže jsou silné (2000 HP), střílí primárně na miniony, pak na hrdiny.
// T2 a T3 jsou nexus věže — jejich dobytí = výhra.
// Žádné zdi, žádné heal pickupy — čistá linka jako v LoL ARAM.

export const world = { width: 3200, height: 1000 };

// Spawn hráčů — za nejzazšími věžemi
export const spawnPoints = [
  { x: 160, y: 500 },   // modrý tým — vlevo
  { x: 3040, y: 500 },  // červený tým — vpravo
];

// 6 věží v linii — indexy 0-2 modré, 3-5 červené
// T2 = blue nexus věž, T3 = red nexus věž
export const towerPositions = [
  { x: 500,  y: 500 }, // T0 — blue outer
  { x: 950,  y: 500 }, // T1 — blue inner
  { x: 1350, y: 500 }, // T2 — blue nexus věž
  { x: 1850, y: 500 }, // T3 — red nexus věž
  { x: 2250, y: 500 }, // T4 — red inner
  { x: 2700, y: 500 }, // T5 — red outer
];

// Nexus věže — dobytí = výhra protivníka
export const nexusTowerIndex = { 0: 2, 1: 3 };

// Minion spawn pointy — těsně za každou věží (směrem ke středu)
export const MINION_SPAWN_POINTS = [
  { x: 340,  y: 500 }, // u T0
  { x: 725,  y: 500 }, // u T1
  { x: 1150, y: 500 }, // u T2
  { x: 2050, y: 500 }, // u T3
  { x: 2475, y: 500 }, // u T4
  { x: 2860, y: 500 }, // u T5
];

// Žádné heal pickupy — ARAM styl
export const healPickupPositions = [];

// Powerup uprostřed linky
export const powerupPosition = { x: 1600, y: 500 };

// Žádné vnitřní zdi
export const rawPolys = [];

// Žádné nexus hex walls
export const nexusHexWalls = [];

// Hranice hrací plochy — úzký koridor
export const rawMapBoundary = [
  { x: 60,   y: 260 }, { x: 3140, y: 260 },
  { x: 3140, y: 740 }, { x: 60,   y: 740 },
];
export const mapBoundary = smoothPolygon(rawMapBoundary, 3);

// Vision config
export const mapCenter = { x: 1600, y: 500 };
export const visionRings = {
  ringPush: 50,
  powerupRadius: 300,
  towerRadius: 360,
  interpolatedRadius: 260,
  interpolationStep: 200,
};
