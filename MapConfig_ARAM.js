import { smoothPolygon } from './Utils.js';

// ── ARAM mapa — jedna horizontální linka ──────────────────────────────────────
//
// Layout (leva→pravá):
//   [Blue spawn] [T0 blue] ─────── střed ─────── [T1 red] [Red spawn]
//
// T0 = blue "nexus" věž — zničení červenými = výhra červených
// T1 = red  "nexus" věž — zničení modrými  = výhra modrých
// Věže mají HP, nejdou capture, pouze střílí jako v LoL.
// Žádné zdi, žádné healy, žádné powerupy.

export const world = { width: 3200, height: 1000 };

// Spawn hráčů — za věžemi
export const spawnPoints = [
  { x: 160, y: 500 },   // modrý tým — vlevo
  { x: 3040, y: 500 },  // červený tým — vpravo
];

// 2 věže — T0 blue (vlevo), T1 red (vpravo)
export const towerPositions = [
  { x: 600,  y: 500 }, // T0 — blue nexus věž
  { x: 2600, y: 500 }, // T1 — red nexus věž
];

// Nexus věže — obě věže jsou nexusy
export const nexusTowerIndex = { 0: 0, 1: 1 };

// Minion spawn pointy — těsně za věžemi (směrem ke středu)
export const MINION_SPAWN_POINTS = [
  { x: 820,  y: 500 }, // modrý tým spawní za T0
  { x: 2380, y: 500 }, // červený tým spawní za T1
];

// Žádné heal pickupy — ARAM styl
export const healPickupPositions = [];

// Žádný powerup
export const powerupPosition = null;

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
