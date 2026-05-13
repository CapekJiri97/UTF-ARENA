import { smoothPolygon } from './Utils.js';

// ── Arena mapa — 85 % Dominionu, elipsový tvar ────────────────────────────────
//
// Rozměry: 3400 × 1339  (4000*0.85 × 3150*0.425)
// Spawny: vlevo a vpravo, uprostřed výška
// Jedna neutrální věž přesně uprostřed — obsadit ji = 5 bodů / 10 s
// Žádné zdi, žádní minioni, žádné healy/powerupy
// Hraje se 4v4, cíl = 150 bodů

export const world = { width: 3400, height: 1339 };

// Střed mapy
const CX = 1700;
const CY = 670;

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

export const arenaMinionSpawns = [
  [{x: 451, y: 512}, {x: 454, y: 807}],
  [{x: 2949, y: 512}, {x: 2946, y: 807}]
];

// Healy rozmístěny symetricky na horní a spodní stranu mapy
export const healPickupPositions = [
  {x: 1368, y: 120},
  {x: 2011, y: 139},
  {x: 1368, y: 1219},
  {x: 2011, y: 1200}
];
export const powerupPosition = null;

const basePolys = [
  [{x: 1666, y: 175}, {x: 1640, y: 177}, {x: 1602, y: 189}, {x: 1587, y: 201}, {x: 1581, y: 216}, {x: 1614, y: 230}, {x: 1676, y: 236}, {x: 1745, y: 242}, {x: 1806, y: 235}, {x: 1834, y: 204}, {x: 1822, y: 179}, {x: 1751, y: 160}, {x: 1672, y: 153}],
  [{x: 871, y: 294}, {x: 833, y: 303}, {x: 819, y: 322}, {x: 813, y: 340}, {x: 822, y: 357}, {x: 869, y: 364}, {x: 944, y: 368}, {x: 1021, y: 366}, {x: 1084, y: 354}, {x: 1140, y: 327}, {x: 1122, y: 300}, {x: 1005, y: 283}, {x: 919, y: 275}],
  [{x: 2271, y: 279}, {x: 2217, y: 274}, {x: 2163, y: 272}, {x: 2105, y: 281}, {x: 2101, y: 304}, {x: 2184, y: 335}, {x: 2278, y: 352}, {x: 2367, y: 359}, {x: 2419, y: 337}, {x: 2405, y: 307}, {x: 2351, y: 285}, {x: 2285, y: 270}, {x: 2249, y: 262}],
  [{x: 1638, y: 452}, {x: 1662, y: 450}, {x: 1710, y: 449}, {x: 1731, y: 446}, {x: 1752, y: 436}, {x: 1740, y: 421}, {x: 1700, y: 408}, {x: 1660, y: 405}, {x: 1625, y: 413}, {x: 1610, y: 427}, {x: 1633, y: 446}],
  [{x: 421, y: 666}, {x: 420, y: 649}, {x: 418, y: 630}, {x: 419, y: 604}, {x: 425, y: 579}, {x: 437, y: 557}, {x: 452, y: 536}, {x: 465, y: 524}, {x: 486, y: 518}, {x: 504, y: 522}, {x: 514, y: 533}, {x: 514, y: 546}, {x: 509, y: 559}, {x: 487, y: 589}, {x: 481, y: 599}, {x: 479, y: 614}, {x: 477, y: 635}, {x: 477, y: 651}, {x: 479, y: 666}, {x: 471, y: 676}, {x: 453, y: 681}, {x: 431, y: 686}, {x: 418, y: 668}]
];

export const rawPolys = [
  ...basePolys,
  ...basePolys.map(poly => poly.map(p => ({ x: p.x, y: 1339 - p.y })))
];
export const nexusHexWalls = [];

// Hranice — elipsa aproximovaná polygonem (36 bodů)
// Rx = 1640 (necháme 60px okraj), Ry = 620
const RX = 1640;
const RY = 620;
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
