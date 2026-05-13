import { smoothPolygon } from './Utils.js';

// ── ARAM mapa — čistá aréna 5v5 ──────────────────────────────────────────────
//
// Žádné věže, žádní minioni, žádné zdi, žádné healy, žádné powerupy.
// Pouze spawny pro oba týmy a hranice mapy.

export const world = { width: 3200, height: 2000 };

// Spawn hráčů — modrý vlevo, červený vpravo
// 5 spawn slotů na tým, rozmístěných svisle
export const spawnPoints = [
  { x: 200, y: 1000 },  // modrý tým — střed vlevo
  { x: 3000, y: 1000 }, // červený tým — střed vpravo
];

// Žádné věže
export const towerPositions = [];

// Žádné nexus věže
export const nexusTowerIndex = {};

// Žádné minion spawn pointy
export const MINION_SPAWN_POINTS = [];

// Žádné heal pickupy
export const healPickupPositions = [];

// Žádný powerup
export const powerupPosition = null;

// Žádné vnitřní zdi
export const rawPolys = [];

// Žádné nexus hex walls
export const nexusHexWalls = [];

// Hranice hrací plochy — otevřená aréna
export const rawMapBoundary = [
  { x: 60,   y: 60   },
  { x: 3140, y: 60   },
  { x: 3140, y: 1940 },
  { x: 60,   y: 1940 },
];
export const mapBoundary = smoothPolygon(rawMapBoundary, 3);

// Vision config
export const mapCenter = { x: 1600, y: 1000 };
export const visionRings = {
  ringPush: 50,
  powerupRadius: 300,
  towerRadius: 360,
  interpolatedRadius: 260,
  interpolationStep: 200,
};
