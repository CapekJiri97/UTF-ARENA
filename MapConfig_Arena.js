import { smoothPolygon } from './Utils.js';

// ── Arena mapa — 85 % Dominionu, elipsový tvar ────────────────────────────────
//
// Rozměry: 3400 × 2678  (4000*0.85 × 3150*0.85)
// Spawny: vlevo a vpravo, uprostřed výška
// Jedna neutrální věž přesně uprostřed — obsadit ji = 5 bodů / 10 s
// Žádné zdi, žádní minioni, žádné healy/powerupy
// Hraje se 4v4, cíl = 150 bodů

export const world = { width: 3400, height: 2678 };

// Střed mapy
const CX = 1700;
const CY = 1339;

// Spawn hráčů — 4 sloty na tým, rozmístěné svisle
export const spawnPoints = [
  { x: 220,  y: CY }, // modrý tým — vlevo
  { x: 3180, y: CY }, // červený tým — vpravo
];

// Jediná věž — přesně uprostřed
export const towerPositions = [
  { x: CX, y: CY },
];

// Věž není nexus (v Arena módu není potřeba)
export const nexusTowerIndex = {};

// Žádní minioni
export const MINION_SPAWN_POINTS = [];

// Žádné healy ani powerup
export const healPickupPositions = [];
export const powerupPosition = null;

// Žádné vnitřní zdi
export const rawPolys = [];
export const nexusHexWalls = [];

// Hranice — elipsa aproximovaná polygonem (36 bodů)
// Rx = 1640 (necháme 60px okraj), Ry = 1240
const RX = 1640;
const RY = 1240;
const ELLIPSE_STEPS = 36;
export const rawMapBoundary = Array.from({ length: ELLIPSE_STEPS }, (_, i) => {
  const a = (i / ELLIPSE_STEPS) * Math.PI * 2;
  return {
    x: Math.round(CX + Math.cos(a) * RX),
    y: Math.round(CY + Math.sin(a) * RY),
  };
});
export const mapBoundary = smoothPolygon(rawMapBoundary, 4);

export const mapCenter = { x: CX, y: CY };
export const visionRings = {
  ringPush: 60,
  powerupRadius: 320,
  towerRadius: 400,
  interpolatedRadius: 280,
  interpolationStep: 220,
};

// Maximální počet hráčů na tým
export const teamSize = 4;
