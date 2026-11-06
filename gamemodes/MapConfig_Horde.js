import { smoothPolygon } from '../shared/Utils.js';

function makeHex(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

// ── Horde Survival Map Config — Kruhová / oktagonální aréna s centrální svatyní ──

export const world = { width: 2200, height: 2200 };
export const teamSize = 3;

// Střed mapy
export const mapCenter = { x: 1100, y: 1100 };

// Spawny:
// Index 0: Tým přeživších (spodní strana nádvoří u svatyně)
// Index 1: Invazní brána (sever)
export const spawnPoints = [
  { x: 1100, y: 1260 }, // Modrý tým (Hráč + spojenci)
  { x: 1100, y: 180 },  // Horda (základní referenční bod)
];

// Spawny vln hordy ze všech světových stran
export const hordeSpawns = [
  { x: 1100, y: 160 },  // Sever
  { x: 2040, y: 1100 }, // Východ
  { x: 1100, y: 2040 }, // Jih
  { x: 160,  y: 1100 }, // Západ
  { x: 320,  y: 320 },  // Severozápad
  { x: 1880, y: 320 },  // Severovýchod
  { x: 320,  y: 1880 }, // Jihozápad
  { x: 1880, y: 1880 }, // Jihovýchod
];

// Jediná věž — Centrální Svatyně (Nexus Shrine), kterou hráči brání
export const towerPositions = [
  { x: 1100, y: 1100 },
];

export const nexusTowerIndex = { 0: 0 };
export const MINION_SPAWN_POINTS = [];

// 4 léčivé relikvie na nádvoří
export const healPickupPositions = [
  { x: 800,  y: 800 },
  { x: 1400, y: 800 },
  { x: 800,  y: 1400 },
  { x: 1400, y: 1400 },
];

export const powerupPosition = null;

// 4 kiting sloupy / překážky kolem středu
export const rawPolys = [
  makeHex(700,  1100, 38),
  makeHex(1500, 1100, 38),
  makeHex(1100, 700,  38),
  makeHex(1100, 1500, 38),
];

export const nexusHexWalls = [];

// Hranice arény — velký oktagon
export const rawMapBoundary = [
  { x: 550,  y: 90 },
  { x: 1650, y: 90 },
  { x: 2110, y: 550 },
  { x: 2110, y: 1650 },
  { x: 1650, y: 2110 },
  { x: 550,  y: 2110 },
  { x: 90,   y: 1650 },
  { x: 90,   y: 550 },
];
export const mapBoundary = smoothPolygon(rawMapBoundary, 3);

// Vision config
export const visionRings = {
  ringPush: 50,
  powerupRadius: 300,
  towerRadius: 350,
  interpolatedRadius: 260,
  interpolationStep: 200,
};
