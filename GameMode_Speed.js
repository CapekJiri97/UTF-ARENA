import { game, camera } from './State.js';
import { GameMode_Classic } from './GameMode_Classic.js';
// ── Dominion Speed mode ───────────────────────────────────────────────────
// Rychlejší verze Classic módu: Nexus začíná na 350 bodech
// Pasivní příjem goldů a expů je zvýšen v main.js na trojnásobek (+200%).

export const GameMode_Speed = {
  ...GameMode_Classic,
  name: 'speed',
  init() {
    game.nexus = { 0: 350, 1: 350 };
    camera.scale = 1.52;
  }
};