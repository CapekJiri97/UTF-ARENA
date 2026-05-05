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
}

// Identify consistently strong/weak across scenarios
const classes = [...new Set(report.map(r=>r.className))];
function avgAcrossScenarios(className, key) {
  const rows = report.filter(r=>r.className===className);
  return rows.reduce((s,r)=>s+r[key],0)/rows.length;
}

const avgList = classes.map(c=>({class:c, avgBurst:Number(avgAcrossScenarios(c,'burstDmg').toFixed(1)), avgDPS:Number(avgAcrossScenarios(c,'totalDPS').toFixed(1)), avgHPS:Number(avgAcrossScenarios(c,'hps').toFixed(1)), avgUtil:Number(avgAcrossScenarios(c,'utility').toFixed(1))})).sort((a,b)=>b.avgDPS-a.avgDPS);
console.log('\n=== OVERALL TIERS (Average across all scenarios) ===');
console.log('Top 8 DPS/Burst:');
console.log(avgList.slice(0,8).map(x => `${x.class.padEnd(10)} | DPS: ${x.avgDPS.toString().padEnd(5)} | Burst: ${x.avgBurst.toString().padEnd(5)} | HPS: ${x.avgHPS.toString().padEnd(4)} | Util: ${x.avgUtil}`));
console.log('\nBottom 8 DPS (Usually Tanks/Support with high Utility):');
console.log(avgList.slice(-8).sort((a,b)=>b.avgUtil-a.avgUtil).map(x => `${x.class.padEnd(10)} | DPS: ${x.avgDPS.toString().padEnd(5)} | Burst: ${x.avgBurst.toString().padEnd(5)} | HPS: ${x.avgHPS.toString().padEnd(4)} | Util: ${x.avgUtil}`));
