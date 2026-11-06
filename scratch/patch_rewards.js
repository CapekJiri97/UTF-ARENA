import fs from 'fs';

const p = 'utf-arena-main/main.js';
let raw = fs.readFileSync(p, 'utf8');
const hadCRLF = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const oldBlock = `  export function grantMinionKillRewards(killer, minionPos) {
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
      const goldReward = Math.round(8 * pct * m);
      p.gold      += goldReward;
      p.totalGold += goldReward;
      showGoldGain(p, goldReward);
      if (socket && game.isHost && !simMode) {
        socket.emit('host_event', { type: 'gold_gain', playerId: p.id, amount: goldReward });
      }
      p.exp       += Math.round(11 * pct * m);
      p.totalExp   = (p.totalExp || 0) + Math.round(11 * pct * m);`;

const newBlock = `  export function grantMinionKillRewards(killer, minionPos, minion = null) {
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
    const baseGold = (minion && minion.goldReward) ? minion.goldReward : 8;
    const baseExp  = (minion && minion.expReward)  ? minion.expReward  : 11;
    for (const p of recipients) {
      const m = snowMult(p) * modeMult;
      const prevGold = p.gold;
      const goldReward = Math.round(baseGold * pct * m);
      p.gold      += goldReward;
      p.totalGold += goldReward;
      showGoldGain(p, goldReward);
      if (socket && game.isHost && !simMode) {
        socket.emit('host_event', { type: 'gold_gain', playerId: p.id, amount: goldReward });
      }
      p.exp       += Math.round(baseExp * pct * m);
      p.totalExp   = (p.totalExp || 0) + Math.round(baseExp * pct * m);`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  if (hadCRLF) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully updated grantMinionKillRewards in main.js');
} else {
  console.error('oldBlock not matched!');
}
