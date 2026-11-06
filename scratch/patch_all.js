import fs from 'fs';

// ── 1. Patch main.js ─────────────────────────────────────────────────────────
{
  const p = 'utf-arena-main/main.js';
  let raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  // Import GameMode_Horde
  if (!content.includes('GameMode_Horde')) {
    content = content.replace(
      "import { GameMode_Arena } from './gamemodes/GameMode_Arena.js';",
      "import { GameMode_Arena } from './gamemodes/GameMode_Arena.js';\nimport { GameMode_Horde } from './gamemodes/GameMode_Horde.js';"
    );
    content = content.replace(
      "  arena:   GameMode_Arena,\n};",
      "  arena:   GameMode_Arena,\n  horde:   GameMode_Horde,\n};"
    );
    console.log('main.js GAME_MODES updated with horde.');
  }

  // Attach window helpers
  if (!content.includes('window.showEnd = showEnd;')) {
    const windowAttach = `if (typeof window !== 'undefined') {
  window.playSound = playSound;
  window.flashMessage = flashMessage;
  window.showEnd = showEnd;
}\n`;
    content = content.replace('export let activeGameMode = GameMode_Classic;', windowAttach + 'export let activeGameMode = GameMode_Classic;');
    console.log('main.js window helpers attached.');
  }

  // grantMinionKillRewards minion param
  const oldRewards = `  export function grantMinionKillRewards(killer, minionPos) {
    if (!killer) return;
    let totalLevel = 0, pCount = 0;
    for (const p of game.players) { if (p.team >= 0) { totalLevel += p.level; pCount++; } }
    const avgLevel = pCount > 0 ? totalLevel / pCount : 1;
    const snowMult = (pl) => pl.level >= avgLevel + 2 ? 0.5 : pl.level <= avgLevel - 2 ? 1.5 : 1.0;

    // Gold AND Exp shared among all nearby allies (same area table)
    const nearby = game.players.filter(p => p.alive && p.team === killer.team && dist(p.pos, minionPos) <= 300);
    const recipients = nearby.length > 0 ? nearby : [killer];
    const pct = _MINION_EXP_PCT[Math.min(recipients.length - 1, _MINION_EXP_PCT.length - 1)];
    const modeMult = ((activeGameMode && activeGameMode.name === 'arena') ? 1.5 : 1.0)
      * ((activeGameMode && activeGameMode.rewardMultiplier) || 1);
    for (const p of recipients) {
      const m = snowMult(p) * modeMult;
      const prevGold = p.gold;
      grantRewards(p, Math.round(20 * pct * m), Math.round(30 * pct * m));`;

  const newRewards = `  export function grantMinionKillRewards(killer, minionPos, minion = null) {
    if (!killer) return;
    let totalLevel = 0, pCount = 0;
    for (const p of game.players) { if (p.team >= 0) { totalLevel += p.level; pCount++; } }
    const avgLevel = pCount > 0 ? totalLevel / pCount : 1;
    const snowMult = (pl) => pl.level >= avgLevel + 2 ? 0.5 : pl.level <= avgLevel - 2 ? 1.5 : 1.0;

    // Gold AND Exp shared among all nearby allies (same area table)
    const nearby = game.players.filter(p => p.alive && p.team === killer.team && dist(p.pos, minionPos) <= 300);
    const recipients = nearby.length > 0 ? nearby : [killer];
    const pct = _MINION_EXP_PCT[Math.min(recipients.length - 1, _MINION_EXP_PCT.length - 1)];
    const modeMult = ((activeGameMode && activeGameMode.name === 'arena') ? 1.5 : 1.0)
      * ((activeGameMode && activeGameMode.rewardMultiplier) || 1);
    const baseGold = (minion && minion.goldReward) ? minion.goldReward : 20;
    const baseExp  = (minion && minion.expReward)  ? minion.expReward  : 30;
    for (const p of recipients) {
      const m = snowMult(p) * modeMult;
      const prevGold = p.gold;
      grantRewards(p, Math.round(baseGold * pct * m), Math.round(baseExp * pct * m));`;

  if (!content.includes('const baseGold = (minion && minion.goldReward)')) {
    if (content.includes(oldRewards)) {
      content = content.replace(oldRewards, newRewards);
      console.log('main.js grantMinionKillRewards updated with custom rewards.');
    } else {
      console.error('oldRewards not found in main.js!');
    }
  }

  // Offline bot spawn: no team 1 bots in horde
  const oldOfflineBots = `    spawnOfflineBotsForTeam(0, 'blue', humansBlue, bluePicked, redPicked);
    spawnOfflineBotsForTeam(1, 'red',  humansRed,  redPicked,  bluePicked);`;
  const newOfflineBots = `    spawnOfflineBotsForTeam(0, 'blue', humansBlue, bluePicked, redPicked);
    if (activeGameMode.name !== 'horde') {
      spawnOfflineBotsForTeam(1, 'red',  humansRed,  redPicked,  bluePicked);
    }`;
  if (!content.includes("if (activeGameMode.name !== 'horde') {\n      spawnOfflineBotsForTeam(1")) {
    if (content.includes(oldOfflineBots)) {
      content = content.replace(oldOfflineBots, newOfflineBots);
      console.log('main.js offline bot spawn updated for horde.');
    } else {
      console.error('oldOfflineBots not found in main.js!');
    }
  }

  // Networked bot spawn: no team 1 bots in horde
  const oldNetBots = `    spawnBotsForTeam(0, 'blue', humansBlue, bluePicked, redPicked);
    spawnBotsForTeam(1, 'red',  humansRed,  redPicked,  bluePicked);`;
  const newNetBots = `    spawnBotsForTeam(0, 'blue', humansBlue, bluePicked, redPicked);
    if (activeGameMode.name !== 'horde') {
      spawnBotsForTeam(1, 'red',  humansRed,  redPicked,  bluePicked);
    }`;
  if (!content.includes("if (activeGameMode.name !== 'horde') {\n      spawnBotsForTeam(1")) {
    if (content.includes(oldNetBots)) {
      content = content.replace(oldNetBots, newNetBots);
      console.log('main.js networked bot spawn updated for horde.');
    } else {
      console.error('oldNetBots not found in main.js!');
    }
  }

  if (hadCRLF) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, content, 'utf8');
}

// ── 2. Patch ServerEngine.js ────────────────────────────────────────────────
{
  const p = 'utf-arena-main/ServerEngine.js';
  let raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  if (!content.includes('GameMode_Horde')) {
    content = content.replace(
      "import { GameMode_Speed }   from './gamemodes/GameMode_Speed.js';",
      "import { GameMode_Speed }   from './gamemodes/GameMode_Speed.js';\nimport { GameMode_Horde }   from './gamemodes/GameMode_Horde.js';"
    );
    content = content.replace(
      "const GAME_MODES = { classic: GameMode_Classic, aram: GameMode_ARAM, arena: GameMode_Arena, speed: GameMode_Speed };",
      "const GAME_MODES = { classic: GameMode_Classic, aram: GameMode_ARAM, arena: GameMode_Arena, speed: GameMode_Speed, horde: GameMode_Horde };"
    );
    console.log('ServerEngine.js GAME_MODES updated with horde.');
  }

  const oldRedBotCnt = `  const redBotCnt  = Math.max(0, teamSize - humansRed);`;
  const newRedBotCnt = `  const isHorde    = activeMode.name === 'horde';\n  const redBotCnt  = isHorde ? 0 : Math.max(0, teamSize - humansRed);`;
  if (!content.includes('const isHorde    = activeMode.name === \'horde\';')) {
    if (content.includes(oldRedBotCnt)) {
      content = content.replace(oldRedBotCnt, newRedBotCnt);
      console.log('ServerEngine.js redBotCnt updated for horde.');
    } else {
      console.error('oldRedBotCnt not found in ServerEngine.js!');
    }
  }

  if (hadCRLF) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, content, 'utf8');
}

// ── 3. Patch entities/Player.js ─────────────────────────────────────────────
{
  const p = 'utf-arena-main/entities/Player.js';
  let raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  // Laser immunity
  const oldLaser = `        // Fountain laser — jen v Classic módu (v ARAM je spawn na kraji mapy, laser by zabil respawnující hráče)
        if (activeGameMode.name !== 'aram') {`;
  const newLaser = `        // Fountain laser — jen v Classic módu (v ARAM a Horde je spawn jinde / bez laseru)
        if (activeGameMode.name !== 'aram' && activeGameMode.name !== 'horde') {`;
  if (!content.includes("activeGameMode.name !== 'horde'")) {
    if (content.includes(oldLaser)) {
      content = content.replace(oldLaser, newLaser);
      console.log('Player.js laser immunity updated for horde.');
    } else {
      console.error('oldLaser not found in Player.js!');
    }
  }

  // pointDiff for horde
  const oldPointDiff = `        let pointDiff = activeGameMode.name === 'aram'
            ? game.towers.filter(t => t.owner === team).length - game.towers.filter(t => t.owner === 1 - team).length
            : activeGameMode.name === 'arena'
            ? (game.score?.[team] || 0) - (game.score?.[1 - team] || 0)
            : game.nexus[team] - game.nexus[1-team];`;

  const newPointDiff = `        let pointDiff = activeGameMode.name === 'aram'
            ? game.towers.filter(t => t.owner === team).length - game.towers.filter(t => t.owner === 1 - team).length
            : activeGameMode.name === 'arena'
            ? (game.score?.[team] || 0) - (game.score?.[1 - team] || 0)
            : activeGameMode.name === 'horde'
            ? 0
            : (game.nexus ? game.nexus[team] - game.nexus[1-team] : 0);`;

  if (!content.includes("activeGameMode.name === 'horde'")) {
    if (content.includes(oldPointDiff)) {
      content = content.replace(oldPointDiff, newPointDiff);
      console.log('Player.js pointDiff updated for horde.');
    } else {
      console.error('oldPointDiff not found in Player.js!');
    }
  }

  // Cowardice threshold for brawl modes
  content = content.replace(
    "if (activeGameMode && (activeGameMode.name === 'arena' || activeGameMode.name === 'aram')) {\n                      cowardiceThreshold -= 0.15;",
    "if (activeGameMode && (activeGameMode.name === 'arena' || activeGameMode.name === 'aram' || activeGameMode.name === 'horde')) {\n                      cowardiceThreshold -= 0.15;"
  );

  if (hadCRLF) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, content, 'utf8');
}

// ── 4. Patch client/UI.js ───────────────────────────────────────────────────
{
  const p = 'utf-arena-main/client/UI.js';
  let raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  // Lobby mode buttons: add ARAM & HORDE
  const oldButtons = `<button class="mode-btn" data-mode="arena"   style="padding:6px 12px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#444;   border:2px solid #444;   letter-spacing:1px;">ARENA</button>`;
  const newButtons = `<button class="mode-btn" data-mode="arena"   style="padding:6px 12px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#444;   border:2px solid #444;   letter-spacing:1px;">ARENA</button>
              <button class="mode-btn" data-mode="aram"    style="padding:6px 12px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#444;   border:2px solid #444;   letter-spacing:1px;">ARAM</button>
              <button class="mode-btn" data-mode="horde"   style="padding:6px 12px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#444;   border:2px solid #444;   letter-spacing:1px;">HORDE PVE</button>`;

  if (!content.includes('data-mode="horde"')) {
    if (content.includes(oldButtons)) {
      content = content.replace(oldButtons, newButtons);
      console.log('UI.js lobby buttons updated with ARAM & HORDE.');
    } else {
      console.error('oldButtons not found in UI.js!');
    }
  }

  // Minimap boundary for horde
  content = content.replace(
    "if (activeGameMode.name === 'arena' || activeGameMode.name === 'aram') {",
    "if (activeGameMode.name === 'arena' || activeGameMode.name === 'aram' || activeGameMode.name === 'horde') {"
  );

  // Minimap visibility: all monsters visible in horde
  const oldMmVis = `    if (activeGameMode.name === 'aram' && wx >= 80 && wx <= 3120 && wy >= 200 && wy <= 800) return true;`;
  const newMmVis = `    if (activeGameMode.name === 'aram' && wx >= 80 && wx <= 3120 && wy >= 200 && wy <= 800) return true;
    if (activeGameMode.name === 'horde') return true;`;
  if (!content.includes("if (activeGameMode.name === 'horde') return true;")) {
    if (content.includes(oldMmVis)) {
      content = content.replace(oldMmVis, newMmVis);
      console.log('UI.js minimap horde visibility updated.');
    } else {
      console.error('oldMmVis not found in UI.js!');
    }
  }

  if (hadCRLF) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, content, 'utf8');
}

console.log('All patches completed!');
