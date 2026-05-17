// GameContext.js
// Centrální injection hub — odděluje herní logiku od browser/audio/UI závislostí.
//
// CLIENT: main.js zaregistruje skutečné implementace přes registerGameContext().
// SERVER: importuje gc přímo a zaregistruje server-side implementace.
//         Vizuální/audio funkce zůstávají jako no-op (výchozí stav).

export const gc = {
  // ── Runtime references ────────────────────────────────────────────────────
  socket: null,
  localPlayer: null,       // pouze client — lokálně ovládaný hrdina
  keys: null,
  mouse: null,
  activeGameMode: null,

  // ── Herní logika (musí být zaregistrována před startem hry) ───────────────
  applyDamage:            () => 0,
  applyHeal:              () => {},
  handlePlayerKill:       () => {},
  moveEntityWithCollision:() => {},
  grantRewards:           () => {},
  grantMinionKillRewards: () => {},
  recalcPlayerItemStats:  () => {},
  buyItem:                () => {},
  drawHealthBar:          () => {},
  flashMessage:           () => {},

  // ── Vizuální/audio — no-op (server nikdy nepřepisuje) ─────────────────────
  spawnParticles:   () => {},
  updateSpellLabels:() => {},
  playSound:        () => {},
  showEnd:          () => {},

  // ── Vizuální třídy — stub implementace (client je přepíše reálnými) ────────
  Particle:     class { constructor() {} update() { return false; } draw() {} },
  EffectText:   class { constructor() {} update() { return false; } draw() {} },
  DamageNumber: class { constructor() {} update() { return false; } draw() {} },
};

/**
 * Zaregistruj implementace do gc — volá main.js (client) nebo server engine.
 * @param {Partial<typeof gc>} overrides
 */
export function registerGameContext(overrides) {
  Object.assign(gc, overrides);
}
