import { smoothPolygon } from '../shared/Utils.js';

// ── ARAM mapa — Most 5v5 (Jedna linka, věže, heal relikvie) ───────────────────

export const world = { width: 3200, height: 1000 };

// Spawn hráčů — modrý vlevo, červený vpravo
export const spawnPoints = [
  { x: 200, y: 500 },  // modrý tým — střed vlevo
  { x: 3000, y: 500 }, // červený tým — střed vpravo
];

// Věže v lince (3 pro modré, 3 pro červené)
export const towerPositions = [
  { x: 1200, y: 500 }, // 0: Blue Outer
  { x: 800,  y: 500 }, // 1: Blue Inner
  { x: 400,  y: 500 }, // 2: Blue Base
  { x: 2000, y: 500 }, // 3: Red Outer
  { x: 2400, y: 500 }, // 4: Red Inner
  { x: 2800, y: 500 }, // 5: Red Base
];

// Žádné nexus věže
export const nexusTowerIndex = {};

export const MINION_SPAWN_POINTS = [];

// Místa odkud vyrážejí minioni
export const aramMinionSpawns = [
  { x: 300, y: 500 }, // Blue
  { x: 2900, y: 500 } // Red
];

// Heal relikvie podél mostu (2 vnitřní, 2 v contested zóně)
export const healPickupPositions = [
  { x: 1000, y: 350 }, // Blue inner
  { x: 1450, y: 650 }, // Blue mid
  { x: 1750, y: 350 }, // Red mid
  { x: 2200, y: 650 }, // Red inner
];

// Žádný powerup
export const powerupPosition = null;

// Žádné vnitřní zdi
export const rawPolys = [];

// Žádné nexus hex walls
export const nexusHexWalls = [];

// Hranice mostu — šířka mostu 540 jednotek (y: 230 až 770), centrováno na y: 500
export const rawMapBoundary = [
  { x: 80,   y: 260 },
  { x: 420,  y: 230 },
  { x: 1600, y: 230 },
  { x: 2780, y: 230 },
  { x: 3120, y: 260 },
  { x: 3120, y: 740 },
  { x: 2780, y: 770 },
  { x: 1600, y: 770 },
  { x: 420,  y: 770 },
  { x: 80,   y: 740 },
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
