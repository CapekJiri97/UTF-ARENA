const fs = require('fs');
const path = require('path');
const report = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'balance_report.json'), 'utf8'));

function topBy(key, level, items, n=3) {
  const arr = report.filter(r=>r.level===level && r.items===items).sort((a,b)=>b[key]-a[key]);
  return arr.slice(0,n).map(x=>({class:x.className, val:x[key]}));
}

function bottomBy(key, level, items, n=3) {
  const arr = report.filter(r=>r.level===level && r.items===items).sort((a,b)=>a[key]-b[key]);
  return arr.slice(0,n).map(x=>({class:x.className, val:x[key]}));
}

const scenarios = [ {L:1,items:0},{L:1,items:3},{L:1,items:6},{L:10,items:0},{L:10,items:6} ];

for(const s of scenarios) {
  console.log(`\n=== Level ${s.L}, items ${s.items} ===`);
  console.log('Top Burst Dmg:', topBy('burstDmg', s.L, s.items, 3));
  console.log('Top DPS:', topBy('totalDPS', s.L, s.items, 5));
  console.log('Top HPS:', topBy('hps', s.L, s.items, 5));
  console.log('Top Utility/CC:', topBy('utility', s.L, s.items, 4));
  console.log('Top Phase Score:', topBy('phaseScore', s.L, s.items, 5));
  console.log('Top Control Score:', topBy('controlScore', s.L, s.items, 5));
}

// Identify consistently strong/weak across scenarios
const classes = [...new Set(report.map(r=>r.className))];
function avgAcrossScenarios(className, key) {
  const rows = report.filter(r=>r.className===className);
  return rows.reduce((s,r)=>s+r[key],0)/rows.length;
}

const avgList = classes.map(c=>({
  class:c,
  avgBurst:Number(avgAcrossScenarios(c,'burstDmg').toFixed(1)),
  avgDPS:Number(avgAcrossScenarios(c,'totalDPS').toFixed(1)),
  avgHPS:Number(avgAcrossScenarios(c,'hps').toFixed(1)),
  avgUtil:Number(avgAcrossScenarios(c,'utility').toFixed(1)),
  avgControl:Number(avgAcrossScenarios(c,'controlScore').toFixed(1)),
  avgPhase:Number(avgAcrossScenarios(c,'phaseScore').toFixed(1)),
  avgSurvivability:Number(avgAcrossScenarios(c,'survivability').toFixed(1))
}));

function printTier(title, rows, sortKey, take = 8) {
  console.log(`\n=== ${title} ===`);
  console.log(rows.sort((a,b)=>b[sortKey]-a[sortKey]).slice(0, take).map(x => `${x.class.padEnd(12)} | Phase: ${x.avgPhase.toString().padEnd(7)} | DPS: ${x.avgDPS.toString().padEnd(6)} | Burst: ${x.avgBurst.toString().padEnd(6)} | HPS: ${x.avgHPS.toString().padEnd(5)} | Util: ${x.avgUtil.toString().padEnd(5)} | Ctrl: ${x.avgControl}`));
}

printTier('OVERALL PHASE POWER', [...avgList], 'avgPhase', 8);
printTier('OVERALL CONTROL', [...avgList], 'avgControl', 8);
printTier('OVERALL DPS', [...avgList], 'avgDPS', 8);

console.log('\n=== LIKELY WEAKS (Bottom phase power) ===');
console.log([...avgList].sort((a,b)=>a.avgPhase-b.avgPhase).slice(0, 8).map(x => `${x.class.padEnd(12)} | Phase: ${x.avgPhase.toString().padEnd(7)} | DPS: ${x.avgDPS.toString().padEnd(6)} | HPS: ${x.avgHPS.toString().padEnd(5)} | Util: ${x.avgUtil.toString().padEnd(5)} | Ctrl: ${x.avgControl}`));
