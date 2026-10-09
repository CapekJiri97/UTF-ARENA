import { game, camera } from '../shared/State.js';
import { GameMode_Classic } from './GameMode_Classic.js';
// ── Dominion Speed mode ───────────────────────────────────────────────────
// Rychlejší verze Classic módu: Nexus začíná na 350 bodech
// Pasivní příjem má navíc 3× základní násobek; společné tempo je 1,5×.

export const GameMode_Speed = {
  ...GameMode_Classic,
  name: 'speed',
  passiveIncomeMultiplier: 3.0,
  init() {
    game.nexus = { 0: 350, 1: 350 };
    camera.scale = 1.52;
  }
};