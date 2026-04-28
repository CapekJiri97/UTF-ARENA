import { dist, distToPoly, smoothPolygon, expForLevel } from './Utils.js';
import { shopItems } from './items.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { game, camera, TEAM_COLOR, NEUTRAL_COLOR } from './State.js';
import { world, spawnPoints, mapBoundary } from './MapConfig.js';
import { canvas, ctx, keys, player, socket, startGame, buyItem, drawHealthBar } from './main.js';

const style = document.createElement('style');
style.innerHTML = `
  #hud, #hp, #gold, #exp, #level, #respawn, #nexusBlue, #nexusRed { display: none !important; }
  #qbar, #ebar, #qlv, #elv, #qcd, #ecd, .cooldown-container { display: none !important; }
  #minimap { width: 300px !important; height: 300px !important; border: 2px solid #444; border-radius: 4px; box-shadow: 0 0 10px rgba(0,0,0,0.8); }
`;
document.head.appendChild(style);

export function updateLobbyUI(playersData) {
  const list = document.getElementById('lobbyList'); if(!list) return;
  list.innerHTML = '';
  
  let myTeam = -1;
  let myClass = '';
  const blueTaken = new Set();
  const redTaken = new Set();

  Object.values(playersData).forEach(p => {
      const tColor = p.team === 0 ? '#4da6ff' : '#ff6b6b'; 
      const isMe = (socket && p.id === socket.id);
      if (isMe) {
          myTeam = p.team;
          myClass = p.className;
      }
      
      list.innerHTML += `<li style="color:${tColor}; margin-bottom:6px; font-size:16px;">[${p.className} | ${p.summonerSpell}] ${p.id.substring(0,4)}... ${isMe ? ' (TY)' : ''}</li>`;
      
      if (p.team === 0) blueTaken.add(p.className);
      else redTaken.add(p.className);
  });

  const myTeamTakenByOthers = myTeam === 0 ? blueTaken : redTaken;
  
  const allClassBtns = document.querySelectorAll('#classBtns button');
  allClassBtns.forEach(btn => {
      const className = btn.dataset.className;
      const isMyClass = className === myClass;
      const isTakenByOther = myTeamTakenByOthers.has(className) && !isMyClass;
      
      btn.disabled = isTakenByOther;
      btn.style.opacity = isTakenByOther ? '0.4' : '1';
      btn.style.cursor = isTakenByOther ? 'not-allowed' : 'pointer';

      if (isMyClass) {
          btn.style.borderColor = '#0f0';
      } else if (isTakenByOther) {
          btn.style.borderColor = '#f00';
      } else {
          btn.style.borderColor = '#444';
      }
  });
}

export function openShop(){ populateShop(); document.getElementById('shopOverlay').classList.remove('hidden'); }
export function closeShop(){ document.getElementById('shopOverlay').classList.add('hidden'); }
export function toggleShop(){ const o = document.getElementById('shopOverlay'); if(o.classList.contains('hidden')) openShop(); else closeShop(); }

export function populateShop(){ const list = document.getElementById('shopList'); if(!list) return; list.innerHTML=''; for(const it of shopItems){ let count = 0; if(player && player.items) count = player.items.filter(id=>id===it.id).length; const title = count > 0 ? `${it.name} (${count}x)` : it.name; const div = document.createElement('div'); div.className='shopItem'; div.innerHTML = `<h4>${title}</h4><div>${it.desc}</div><div class="cost">${it.cost} gold</div>`; const btn = document.createElement('button'); btn.textContent='Buy'; btn.addEventListener('click', ()=> buyItem(it.id)); div.appendChild(btn); list.appendChild(div); } }

export function updateInventory(){ if(!player) return; const inv = document.getElementById('inventory'); inv.innerHTML = ''; for(const id of player.items){ const it = shopItems.find(s=>s.id===id); const slot = document.createElement('div'); slot.className='invSlot'; slot.textContent = it? it.name : id; inv.appendChild(slot); } }

export function drawBackground(ctx){ 
  ctx.fillStyle = '#070707'; ctx.fillRect(0,0,world.width, world.height);
  ctx.beginPath(); ctx.ellipse(world.width/2, world.height/2, 1250, 1150, 0, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 100; ctx.stroke();
  if (!game.boundaryVisuals) {
      game.boundaryVisuals = []; let sb = smoothPolygon(mapBoundary, 3);
      for(let i=0; i<sb.length; i++) { let p1 = sb[i], p2 = sb[(i+1)%sb.length]; let d = Math.hypot(p2.x-p1.x, p2.y-p1.y);
          for(let step=0; step<d; step+=10) { game.boundaryVisuals.push({ x: p1.x + (p2.x-p1.x)*(step/d), y: p1.y + (p2.y-p1.y)*(step/d) }); }
      }
  }
  ctx.fillStyle = '#555'; ctx.font = '16px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(let p of game.boundaryVisuals) { ctx.fillText('#', p.x, p.y); }
  for(let sp of spawnPoints){
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 200, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke(); ctx.font = '20px monospace'; ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.fillText('SPAWN', sp.x, sp.y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.font = '14px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  if (game.towers && game.towers.length > 0) {
      for(let i=0; i<game.towers.length; i++){ let t1 = game.towers[i], t2 = game.towers[(i+1)%game.towers.length]; let d = dist(t1.pos, t2.pos);
          for(let step=0; step<d; step+=40) ctx.fillText(':', t1.pos.x + (t2.pos.x - t1.pos.x) * (step/d), t1.pos.y + (t2.pos.y - t1.pos.y) * (step/d));
      }
  }
  ctx.font = '16px monospace'; const natureColors = ['#334d1e', '#426b27', '#528530', '#4d3d26', '#614f33', '#2a3b18'];
  for (let w of game.walls) {
    let startX = Math.floor((w.bbox.minX - w.r)/20)*20, endX = Math.ceil((w.bbox.maxX + w.r)/20)*20;
    let startY = Math.floor((w.bbox.minY - w.r)/20)*20, endY = Math.ceil((w.bbox.maxY + w.r)/20)*20;
    for (let wx = startX; wx <= endX; wx += 20) {
      for (let wy = startY; wy <= endY; wy += 20) {
        let info = distToPoly(wx, wy, w.pts);
        if (info.inside || info.minDist <= w.r) {
          ctx.fillStyle = natureColors[(Math.abs(wx * 7 + wy * 13)) % natureColors.length];
          if (!info.inside && info.minDist > w.r - 15) ctx.fillText('L', wx, wy); else ctx.fillText('#', wx, wy);
        }
      }
    }
  }
}

export function draw(){ 
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(camera.scale,0,0,camera.scale, -camera.x*camera.scale, -camera.y*camera.scale);
  if (game.shake > 0) { const mag = game.shake * 20; ctx.translate((Math.random()-0.5)*mag, (Math.random()-0.5)*mag); }
  drawBackground(ctx);
  for(let h of game.heals) h.draw(ctx); if(game.powerup) game.powerup.draw(ctx);
  for(let t of game.towers) t.draw(ctx); for(let m of game.minions) m.draw(ctx); for(let p of game.projectiles) p.draw(ctx); for(let pl of game.players) pl.draw(ctx); for(let d of game.damageNumbers) d.draw(ctx); for(let pt of game.particles) pt.draw(ctx);
  
  // ==========================================
  // 🛠️ DEBUG VIZUALIZACE (SHIFT + V) 🛠️
  // ==========================================
  if (game.showDebug) {
    ctx.save();
    // 1. Vykreslení odpuzovacích zón zdí (w.r + 60)
    ctx.lineJoin = 'round';
    for (let w of game.walls) {
      ctx.beginPath(); ctx.moveTo(w.pts[0].x, w.pts[0].y);
      for(let i=1; i<w.pts.length; i++) ctx.lineTo(w.pts[i].x, w.pts[i].y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.25)';
      ctx.lineWidth = (w.r + 60) * 2; 
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.fill();
    }

    // 2. Vykreslení dráhy naklikaných waypointů
    if (window._waypoints && window._waypoints.length > 0) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < window._waypoints.length; i++) {
        let wp = window._waypoints[i];
        if (i===0) ctx.moveTo(wp.x, wp.y); else ctx.lineTo(wp.x, wp.y);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'; ctx.fillRect(wp.x-2, wp.y-2, 4, 4);
      }
      ctx.stroke();
    }

    // 3. Čáry cílů botů (Kam se zrovna snaží jít)
    for (let p of game.players) {
      if (p.alive && p.objective && p.objective.pos) {
        ctx.strokeStyle = p.team === 0 ? 'rgba(77, 166, 255, 0.5)' : 'rgba(255, 107, 107, 0.5)';
        ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(p.pos.x, p.pos.y); ctx.lineTo(p.objective.pos.x, p.objective.pos.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  ctx.setTransform(1,0,0,1,0,0); drawMinimap();
  if(game.startDelay > 0 && game.started) { ctx.font = '40px monospace'; ctx.fillStyle = '#ffcc00'; ctx.textAlign='center'; ctx.fillText(`MATCH STARTS IN ${Math.ceil(game.startDelay)}`, canvas.width/2, 100); }

  if(game.started) {
    ctx.font = '16px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#4da6ff'; ctx.fillText(`Blue Nexus: ${Math.floor(game.nexus[0])}`, 20, 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ff6b6b'; ctx.fillText(`Red Nexus: ${Math.floor(game.nexus[1])}`, canvas.width - 20, 30);
    
    if (game.isSpectator) {
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 20px monospace';
        ctx.fillText('SPECTATOR MODE (2x SPEED) - WASD TO MOVE', canvas.width / 2, 30);
    }

    // Kill Feed (Vpravo nahoře)
    if (game.killFeed && game.killFeed.length > 0) {
        let kfY = 60;
        ctx.font = 'bold 13px monospace';
        for (let kf of game.killFeed) {
            let x = canvas.width - 20;
            
            ctx.textAlign = 'right';
            ctx.fillStyle = kf.victimTeam === 0 ? '#4da6ff' : (kf.victimTeam === 1 ? '#ff6b6b' : '#aaa');
            ctx.fillText(kf.victim, x, kfY);
            x -= ctx.measureText(kf.victim).width + 5;
            
            ctx.fillStyle = '#fff'; ctx.fillText(' ⚔ ', x, kfY);
            x -= ctx.measureText(' ⚔ ').width + 5;
            
            ctx.fillStyle = kf.killerTeam === 0 ? '#4da6ff' : (kf.killerTeam === 1 ? '#ff6b6b' : '#aaa');
            ctx.fillText(kf.killer, x, kfY);
            kfY += 22;
        }
    }

    if(player) {
      if (!keys['tab']) {
          ctx.textAlign = 'right'; ctx.font = '14px monospace'; let allyBots = game.players.filter(p => p.team === player.team && p.id !== player.id); let startY = canvas.height - 330;
          ctx.fillStyle = '#aaa'; ctx.fillText('TEAMMATES', canvas.width - 20, startY - allyBots.length*25 - 10);
          for(let i=0; i<allyBots.length; i++) {
              let bot = allyBots[i]; let y = startY - (allyBots.length - 1 - i)*25;
              ctx.fillStyle = bot.alive ? '#fff' : '#666'; ctx.fillText(`${bot.className} LV${bot.level}`, canvas.width - 80, y);
              let maxBoxes = 5; let f = Math.max(0, Math.min(maxBoxes, Math.round((Math.max(0, bot.hp) / bot.maxHp) * maxBoxes) || 0));
              let bar = '[' + '|'.repeat(f) + ' '.repeat(maxBoxes - f) + ']'; ctx.fillStyle = bot.alive ? (bot.team === 0 ? '#4da6ff' : '#ff6b6b') : '#444'; ctx.fillText(bar, canvas.width - 20, y); 
          }
      }
      const cx = canvas.width / 2; const cy = canvas.height; const w = 720, h = 90;
      if (player.currentTarget && player.currentTarget.hp > 0 && !player.currentTarget.dead) {
          const t = player.currentTarget; const tw = 260, th = 55; const tx = cx - tw/2, ty = cy - h - th - 10;
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.strokeStyle = t.team === player.team ? '#4da6ff' : '#ff6b6b'; ctx.lineWidth = 2; ctx.fillRect(tx, ty, tw, th); ctx.strokeRect(tx, ty, tw, th);
          ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'left'; let tName = t.className || 'Minion'; ctx.fillText(`${tName} ${t.level ? 'LV'+t.level : ''}`, tx + 10, ty + 22);
          ctx.font = '12px monospace'; ctx.fillText(`HP: ${Math.floor(t.hp)}/${t.effectiveMaxHp || t.maxHp}`, tx + 10, ty + 42);
          let fT = Math.max(0, Math.min(15, Math.round((Math.max(0,t.hp)/(t.effectiveMaxHp || t.maxHp)) * 15) || 0)); let hpBarStr = '[' + '='.repeat(fT) + ' '.repeat(15 - fT) + ']';
          ctx.fillStyle = t.team===0 ? '#4da6ff' : '#ff6b6b'; ctx.fillText(hpBarStr, tx + 110, ty + 42);
          if (t.AD !== undefined) { ctx.fillStyle = '#aaa'; ctx.fillText(`AD:${Math.round(t.AD*(t.hasPowerup?1.2:1))} AP:${Math.round(t.AP*(t.hasPowerup?1.2:1))} ARM:${Math.round(t.armor*(t.hasPowerup?1.2:1))} MR:${Math.round(t.mr*(t.hasPowerup?1.2:1))}`, tx + 110, ty + 22); }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.fillRect(cx - w/2, cy - h, w, h); ctx.strokeRect(cx - w/2, cy - h, w, h);
      ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.textAlign = 'left'; ctx.fillText(`LVL: ${player.level}${player.spellPoints>0 ? ' (SP:'+player.spellPoints+')' : ''}`, cx - w/2 + 20, cy - h + 25);
      ctx.font = '12px monospace'; ctx.fillText(`EXP: ${Math.floor(player.exp)}/${expForLevel(player.level)}`, cx - w/2 + 20, cy - h + 45); ctx.fillStyle = '#ffcc00'; ctx.fillText(`GLD: ${Math.floor(player.gold)}`, cx - w/2 + 20, cy - h + 65);
      let fP = Math.max(0, Math.min(15, Math.round((Math.max(0,player.hp)/player.effectiveMaxHp) * 15) || 0)); let hpBarStr = '[' + '='.repeat(fP) + ' '.repeat(15 - fP) + ']';
      ctx.fillStyle = player.team===0 ? '#4da6ff' : '#ff6b6b'; ctx.font = '16px monospace'; ctx.fillText(`HP: ${Math.floor(player.hp)}/${player.effectiveMaxHp}`, cx - w/2 + 140, cy - h + 30); ctx.fillText(hpBarStr, cx - w/2 + 140, cy - h + 55);
      if(!player.alive) { ctx.fillStyle='#f00'; ctx.fillText(`DEAD (${Math.ceil(player.respawnTimer)}s)`, cx - w/2 + 140, cy - h + 75); }
      const qPct = player.spells.Q.cd>0 ? (player.spells.Q.cd / player.computeSpellCooldown('Q')) : 0; const ePct = player.spells.E.cd>0 ? (player.spells.E.cd / player.computeSpellCooldown('E')) : 0;
      const qKeyStr = game.autoTarget ? 'J' : 'Q'; const eKeyStr = game.autoTarget ? 'K' : 'E';
      ctx.fillStyle = qPct > 0 ? '#555' : '#fff'; ctx.fillText(`[${qKeyStr}] LV${player.spells.Q.level}`, cx - w/2 + 330, cy - h + 30); if(qPct>0) ctx.fillText(`${player.spells.Q.cd.toFixed(1)}s`, cx - w/2 + 330, cy - h + 55); else ctx.fillText(`READY`, cx - w/2 + 330, cy - h + 55);
      ctx.fillStyle = ePct > 0 ? '#555' : '#fff'; ctx.fillText(`[${eKeyStr}] LV${player.spells.E.level}`, cx - w/2 + 420, cy - h + 30); if(ePct>0) ctx.fillText(`${player.spells.E.cd.toFixed(1)}s`, cx - w/2 + 420, cy - h + 55); else ctx.fillText(`READY`, cx - w/2 + 420, cy - h + 55);
      const sumPct = player.summonerCooldown>0 ? (player.summonerCooldown / SUMMONER_SPELLS[player.summonerSpell].cd) : 0;
      const sumKeyStr = game.autoTarget ? 'L' : 'F';
      ctx.fillStyle = sumPct > 0 ? '#555' : '#ffcc00'; ctx.fillText(`[${sumKeyStr}] ${player.summonerSpell}`, cx - w/2 + 510, cy - h + 30);
      if(sumPct>0) ctx.fillText(`${player.summonerCooldown.toFixed(1)}s`, cx - w/2 + 510, cy - h + 55); else ctx.fillText(`READY`, cx - w/2 + 510, cy - h + 55);
      ctx.fillStyle = '#ffcc00'; ctx.font = '14px monospace'; ctx.fillText(`[B] SHOP | [C] INFO (Items: ${player.items.length})`, cx - w/2 + 600, cy - h + 20);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx + w/2 - 200, cy - h + 28, 190, 56); ctx.fillStyle = '#ddd'; ctx.font = '11px monospace';
      ctx.fillText(`AD:  ${Math.round(player.AD * (player.hasPowerup?1.2:1))}`, cx + w/2 - 190, cy - h + 43); ctx.fillText(`AP:  ${Math.round(player.AP * (player.hasPowerup?1.2:1))}`, cx + w/2 - 110, cy - h + 43); ctx.fillText(`ARM: ${Math.round(player.armor * (player.hasPowerup?1.2:1))}`, cx + w/2 - 190, cy - h + 58); ctx.fillText(`MR:  ${Math.round(player.mr * (player.hasPowerup?1.2:1))}`, cx + w/2 - 110, cy - h + 58); ctx.fillText(`SPD: ${Math.round(player.speed * (player.hasPowerup?1.2:1))}`, cx + w/2 - 190, cy - h + 73); ctx.fillText(`AS:  ${(player.attackDelay / player.attackSpeed).toFixed(2)}s`, cx + w/2 - 110, cy - h + 73);
    }
    if (keys['tab']) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(100, 100, canvas.width - 200, canvas.height - 200); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(100, 100, canvas.width - 200, canvas.height - 200);
        ctx.fillStyle = '#fff'; ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.fillText('SCOREBOARD', canvas.width/2, 140); ctx.font = '16px monospace'; ctx.textAlign = 'left'; ctx.fillText('BLUE TEAM', 130, 180);
        let blueTeam = game.players.filter(p => p.team === 0); for(let i=0; i<blueTeam.length; i++) { let p = blueTeam[i]; let stat = p.alive ? 'ALIVE' : `DEAD(${Math.ceil(p.respawnTimer)}s)`; ctx.fillStyle = p.id === (player?player.id:null) ? '#0f0' : '#4da6ff'; ctx.fillText(`${p.className} [${p.dmgType === 'magical' ? 'AP' : 'AD'}] (LV${p.level}) - ${stat} - Items: ${p.items.length} | K/D/A: ${p.kills}/${p.deaths}/${p.assists} | Gold: ${Math.floor(p.totalGold)}`, 130, 210 + i*25); }
        ctx.fillStyle = '#fff'; ctx.fillText('RED TEAM', canvas.width/2 + 30, 180); let redTeam = game.players.filter(p => p.team === 1);
        for(let i=0; i<redTeam.length; i++) { let p = redTeam[i]; let stat = p.alive ? 'ALIVE' : `DEAD(${Math.ceil(p.respawnTimer)}s)`; ctx.fillStyle = '#ff6b6b'; ctx.fillText(`${p.className} [${p.dmgType === 'magical' ? 'AP' : 'AD'}] (LV${p.level}) - ${stat} - Items: ${p.items.length} | K/D/A: ${p.kills}/${p.deaths}/${p.assists} | Gold: ${Math.floor(p.totalGold)}`, canvas.width/2 + 30, 210 + i*25); }
    }
    if (keys['c'] && player) {
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(100, 100, canvas.width - 200, canvas.height - 200); ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.strokeRect(100, 100, canvas.width - 200, canvas.height - 200);
        ctx.fillStyle = '#fff'; ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.fillText('CHARACTER INFO', canvas.width/2, 140); ctx.font = '18px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`Class: ${player.className}`, 150, 200); ctx.fillText(`Level: ${player.level} (${Math.floor(player.exp)}/${expForLevel(player.level)} XP)`, 150, 230); ctx.fillText(`HP: ${Math.floor(player.hp)} / ${player.effectiveMaxHp}`, 150, 260); ctx.fillText(`Gold: ${Math.floor(player.gold)}`, 150, 290); ctx.fillText(`Kills: ${player.kills} | Deaths: ${player.deaths}`, 150, 320);
        ctx.fillText(`ATTRIBUTES`, 150, 370); ctx.fillText(`AD (Attack Dmg): ${Math.round(player.AD*(player.hasPowerup?1.2:1))}`, 150, 400); ctx.fillText(`Armor: ${Math.round(player.armor*(player.hasPowerup?1.2:1))}`, 150, 430); ctx.fillText(`Attack Speed: ${player.attackSpeed.toFixed(2)}`, 150, 460); ctx.fillText(`Movement Speed: ${Math.round(player.speed*(player.hasPowerup?1.2:1))}`, 150, 490); ctx.fillText(`Ability Haste: ${player.abilityHaste}`, 150, 520);
        ctx.fillText(`SPELLS`, 450, 200); const q = player.spells.Q, e = player.spells.E; ctx.fillText(`[Q] Level ${q.level} - Cooldown: ${player.computeSpellCooldown('Q').toFixed(1)}s`, 450, 230); 
        ctx.fillStyle = '#aaa'; ctx.fillText(`    ${q.desc}`, 450, 250); ctx.fillStyle = '#fff'; let qTotal = q.type.includes('heal') ? Math.round((q.amount||0) + (player.AP * (q.scaleAP||0)) + (player.AD * (q.scaleAD||0)) + q.level*10) : Math.round((q.baseDamage||0) + (player.AP * (q.scaleAP||0)) + (player.AD * (q.scaleAD||0)) + q.level*8);
        ctx.fillText(`    Dmg: Base ${q.baseDamage||q.amount||0} + (${(q.scaleAD||0)*100}% AD) + (${(q.scaleAP||0)*100}% AP) = ${qTotal}`, 450, 270);
        ctx.fillText(`[E] Level ${e.level} - Cooldown: ${player.computeSpellCooldown('E').toFixed(1)}s`, 450, 310); ctx.fillStyle = '#aaa'; ctx.fillText(`    ${e.desc}`, 450, 330); ctx.fillStyle = '#fff';
        let eTotal = e.type.includes('heal') ? Math.round((e.amount||0) + (player.AP * (e.scaleAP||0)) + (player.AD * (e.scaleAD||0)) + e.level*10) : Math.round((e.baseDamage||0) + (player.AP * (e.scaleAP||0)) + (player.AD * (e.scaleAD||0)) + e.level*8); ctx.fillText(`    Dmg: Base ${e.baseDamage||e.amount||0} + (${(e.scaleAD||0)*100}% AD) + (${(e.scaleAP||0)*100}% AP) = ${eTotal}`, 450, 350);
        let baScale = player.dmgType === 'magical' ? (player.className === 'Hana' ? 0.4 : 0.15) : 0.6;
        let baDmg = Math.round(CLASSES[player.className].baseAtk + (player.dmgType === 'magical' ? player.AP*baScale : player.AD*baScale)); ctx.fillText(`Basic Attack: Base ${CLASSES[player.className].baseAtk} + (${Math.round(baScale*100)}% ${player.dmgType === 'magical' ? 'AP' : 'AD'}) = ${baDmg} Dmg`, 150, 560);
        
        ctx.fillStyle = '#ffcc00'; ctx.font = '18px monospace'; ctx.fillText(`CONTROLS`, 450, 400); 
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText(`[W,A,S,D]     : Move`, 450, 425);
        ctx.fillText(`[ARROWS]      : Manual Aim`, 450, 445);
        ctx.fillText(`[SPACE]       : Basic Attack`, 450, 465);
        ctx.fillText(`[Q] / [E]     : Cast Spells (J/K if AutoTarget ON)`, 450, 485);
        ctx.fillText(`[F] / [L]     : Summoner Spell`, 450, 505);
        ctx.fillText(`[SHIFT + Q/E] : Level Up Spell`, 450, 525);
        ctx.fillText(`[B] : Shop  |  [TAB] : Scoreboard  |  [C] : Info`, 450, 545);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`[SHIFT + U]   : Toggle Auto-Target Aim Assist`, 450, 575);
        ctx.fillText(`[SHIFT + I]   : Toggle Auto-Play (Bot Mode)`, 450, 595);
        ctx.fillText(`[SHIFT + V]   : Toggle Debug Visuals`, 450, 615);
    }
  }
}

export function drawMinimap(){ const mm = document.getElementById('minimap'); const w = mm.clientWidth, h = mm.clientHeight; const ctxm = mm._ctx || (function(){ const c = document.createElement('canvas'); c.width = w; c.height = h; mm.appendChild(c); mm._ctx = c.getContext('2d'); return mm._ctx; })(); ctxm.clearRect(0,0,w,h); ctxm.fillStyle='#000'; ctxm.fillRect(0,0,w,h);
  const scaleX = w / world.width; const scaleY = h / world.height; for(let t of game.towers){ const x = t.pos.x * scaleX; const y = t.pos.y * scaleY; ctxm.fillStyle = t.owner===0? '#4da6ff' : t.owner===1? '#ff6b6b' : '#777'; ctxm.fillRect(x-3,y-3,6,6); }
  ctxm.beginPath(); ctxm.moveTo(mapBoundary[0].x * scaleX, mapBoundary[0].y * scaleY); for(let i=1; i<mapBoundary.length; i++) ctxm.lineTo(mapBoundary[i].x * scaleX, mapBoundary[i].y * scaleY); ctxm.closePath(); ctxm.strokeStyle = '#333'; ctxm.stroke();
  ctxm.fillStyle = '#444'; ctxm.strokeStyle = '#444'; ctxm.lineJoin = 'round';
  for(let w of game.walls) { ctxm.beginPath(); ctxm.moveTo(w.pts[0].x * scaleX, w.pts[0].y * scaleY); for(let i=1; i<w.pts.length; i++) ctxm.lineTo(w.pts[i].x * scaleX, w.pts[i].y * scaleY); ctxm.closePath(); ctxm.fill(); ctxm.lineWidth = w.r * 2 * scaleX; ctxm.stroke(); }
  for(let m of game.minions){ const x = m.pos.x * scaleX; const y = m.pos.y * scaleY; ctxm.fillStyle = m.team===0? '#b3ffb3':'#ffb3b3'; ctxm.fillRect(x-1,y-1,2,2); }
  
  for(let p of game.players){ 
    if (!p.alive) continue;
    const x = p.pos.x * scaleX; const y = p.pos.y * scaleY; 
    ctxm.fillStyle = p.team === 0 ? '#4da6ff' : '#ff6b6b';
    ctxm.beginPath(); ctxm.arc(x, y, p === player ? 4.5 : 3.5, 0, Math.PI*2); ctxm.fill();
    if (p === player) { ctxm.strokeStyle = '#fff'; ctxm.lineWidth = 1.5; ctxm.stroke(); } else { ctxm.strokeStyle = '#000'; ctxm.lineWidth = 1; ctxm.stroke(); }
  }
}

export function showEnd(winner){ 
  const overlay = document.getElementById('endOverlay'); 
  if (overlay) {
      const txt = document.getElementById('endText'); if(txt) txt.textContent = winner===0? 'Blue Team Wins!' : 'Red Team Wins!'; 
      let statsDiv = document.getElementById('endStats');
      if (!statsDiv) {
          statsDiv = document.createElement('div'); statsDiv.id = 'endStats'; statsDiv.style.marginTop = '20px'; statsDiv.style.textAlign = 'left'; statsDiv.style.fontSize = '14px'; statsDiv.style.maxHeight = '400px'; statsDiv.style.overflowY = 'auto'; statsDiv.style.background = '#111'; statsDiv.style.padding = '15px'; statsDiv.style.borderRadius = '8px';
          let restartBtn = document.getElementById('restartBtn'); if (restartBtn && restartBtn.parentNode) restartBtn.parentNode.insertBefore(statsDiv, restartBtn); else overlay.querySelector('div') ? overlay.querySelector('div').appendChild(statsDiv) : overlay.appendChild(statsDiv);
      }
      let html = '<table style="width:100%; border-collapse: collapse;">'; html += '<tr style="border-bottom:1px solid #444;"><th>Hero</th><th>K/D/A</th><th>Dmg Dealt</th><th>Dmg Taken</th><th>Healed</th><th>Gold</th></tr>';
      let sorted = [...game.players].sort((a,b)=>(b.kills*2+b.assists)-(a.kills*2+a.assists));
      for(let p of sorted) {
          let color = p.team === 0 ? '#4da6ff' : '#ff6b6b'; if (p === player) color = '#0f0';
          html += `<tr style="color:${color}; text-align:center;"><td style="text-align:left; padding:4px;">${p.className}</td><td>${p.kills}/${p.deaths}/${p.assists}</td><td>${p.stats.dmgDealt}</td><td>${p.stats.dmgTaken}</td><td>${Math.round(p.stats.hpHealed)}</td><td>${Math.floor(p.totalGold)}</td></tr>`;
      }
      html += '</table>'; statsDiv.innerHTML = html; overlay.classList.remove('hidden'); 
  }
}

export function buildMenu() {
  let m = document.getElementById('menu'); if(!m) { m = document.createElement('div'); m.id = 'menu'; document.body.appendChild(m); }
  m.style.position = 'fixed'; m.style.top = '0'; m.style.left = '0'; m.style.width = '100%'; m.style.height = '100%'; m.style.zIndex = '9999'; m.style.display = 'flex'; m.style.justifyContent = 'center'; m.style.alignItems = 'center'; m.style.background = 'rgba(0,0,0,0.85)';
  let selectedClass = 'Bruiser'; let selectedTeam = 0; let selectedSpell = 'Heal';
  m.innerHTML = `
    <div style="background:#111; padding:30px; border:1px solid #444; border-radius: 8px; color:#fff; text-align:center; width: 850px;">
      <div id="roomSelector" style="margin-bottom: 15px; display:flex; justify-content: center; gap: 10px;">
          <button class="roomBtn" data-room="Room 1" style="padding:8px 20px; cursor:pointer; font-weight:bold; background:#000; color:#fff; border:2px solid #0f0;">Room 1</button>
          <button class="roomBtn" data-room="Room 2" style="padding:8px 20px; cursor:pointer; font-weight:bold; background:#000; color:#fff; border:2px solid #444;">Room 2</button>
          <button class="roomBtn" data-room="Room 3" style="padding:8px 20px; cursor:pointer; font-weight:bold; background:#000; color:#fff; border:2px solid #444;">Room 3</button>
      </div>
      <h1 style="margin-top:0;">UTF Arena - MULTIPLAYER LOBBY</h1>
      <div style="display:flex; justify-content: space-between; margin-top: 20px;">
        <div style="width: 65%; text-align: left;">
          <p style="color:#aaa; margin-bottom: 5px;">1. Select Team:</p>
          <button id="btnBlue" style="padding:10px; width:100%; margin-bottom:5px; cursor:pointer; font-weight:bold; background:#000; color:#4da6ff; border:2px solid #4da6ff;">BLUE TEAM</button>
          <button id="btnRed" style="padding:10px; width:100%; margin-bottom:15px; cursor:pointer; font-weight:bold; background:#000; color:#ff6b6b; border:2px solid #444;">RED TEAM</button>
          <p style="color:#aaa; margin-bottom: 5px;">2. Select Class:</p>
          <div id="classBtns" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px;"></div>
          <p style="color:#aaa; margin-bottom: 5px;">3. Select Summoner Spell:</p>
          <div id="spellBtns" style="display:flex; flex-wrap:wrap; gap:5px;"></div>
        </div>
        <div style="width: 32%; text-align: left; background:#000; padding: 15px; border:1px solid #333; border-radius: 4px;">
          <h3 style="margin-top:0; color:#aaa; border-bottom:1px solid #444; padding-bottom:10px;">Players in Room:</h3>
          <ul id="lobbyList" style="list-style: none; padding: 0; margin: 0; font-family: monospace;"><li>Connecting to Server...</li></ul>
        </div>
      </div>
      <button id="startBtn" style="margin-top:25px; padding:15px 24px; width: 100%; font-size:18px; font-weight:bold; cursor:pointer; background:#222; color:#0f0; border:2px solid #0f0;">START MATCH (Everyone)</button>
      <button id="spectateBtn" style="margin-top:10px; padding:10px 24px; width: 100%; font-size:16px; font-weight:bold; cursor:pointer; background:#222; color:#fff; border:2px solid #888;">SPECTATE BOTS (2x SPEED)</button>
    </div>`;
    
  const roomBtns = m.querySelectorAll('.roomBtn');
  roomBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
          roomBtns.forEach(b => b.style.borderColor = '#444');
          e.target.style.borderColor = '#0f0';
          if(socket) socket.emit('join_room', e.target.getAttribute('data-room'));
      });
  });

  document.getElementById('btnBlue').onclick = (e) => { selectedTeam = 0; e.target.style.border = '2px solid #4da6ff'; document.getElementById('btnRed').style.border = '2px solid #444'; notifyServer(); };
  document.getElementById('btnRed').onclick = (e) => { selectedTeam = 1; e.target.style.border = '2px solid #ff6b6b'; document.getElementById('btnBlue').style.border = '2px solid #444'; notifyServer(); };
  const cBtns = document.getElementById('classBtns');
  const catGroups = { 
      'FIGHTER': ['Bruiser', 'Vanguard', 'Jirina'], 
      'TANK': ['Tank', 'Goliath', 'Hana'], 
      'DPS': ['Assassin', 'Marksman', 'Runner'], 
      'MAGE': ['Mage', 'Summoner'], 
      'SUPPORT': ['Healer', 'Acolyte'] 
  };
  const allBtns = [];
  for(let cat in catGroups) {
      let col = document.createElement('div'); col.style.display = 'flex'; col.style.flexDirection = 'column'; col.style.gap = '5px'; col.style.flexGrow = '1';
      let title = document.createElement('div'); title.textContent = cat; title.style.color = '#ffcc00'; title.style.fontSize = '12px'; title.style.fontWeight = 'bold'; title.style.marginBottom = '2px'; title.style.textAlign = 'center';
      col.appendChild(title);
      catGroups[cat].forEach(c => {
          const classInfo = CLASSES[c]; if(!classInfo) return;
          const type = classInfo.dmgType === 'physical' ? 'AD' : 'AP';
          let btn = document.createElement('button'); btn.textContent = `${c} (${type})`; btn.dataset.className = c; btn.style.padding = '6px 10px'; btn.style.background = '#000'; btn.style.color = '#fff'; btn.style.border = '1px solid #444'; btn.style.cursor = 'pointer';
          btn.onclick = () => { selectedClass = c; notifyServer(); }; 
          col.appendChild(btn); allBtns.push(btn);
      });
      cBtns.appendChild(col);
  } setTimeout(() => { let b = allBtns.find(x => x.textContent === 'Bruiser'); if(b) b.click(); }, 50); // Default Bruiser

  const sBtns = document.getElementById('spellBtns');
  const allSpells = [];
  for (let s in SUMMONER_SPELLS) {
      let btn = document.createElement('button'); btn.textContent = s; btn.dataset.spell = s; btn.style.padding = '6px 10px'; btn.style.background = '#000'; btn.style.color = '#fff'; btn.style.border = '1px solid #444'; btn.style.cursor = 'pointer';
      btn.onclick = () => { selectedSpell = s; allSpells.forEach(b => b.style.borderColor = '#444'); btn.style.borderColor = '#0f0'; notifyServer(); };
      sBtns.appendChild(btn); allSpells.push(btn);
  } setTimeout(() => { let b = allSpells.find(x => x.textContent === 'Heal'); if(b) b.click(); }, 50);

  function notifyServer() { if(socket) socket.emit('update_selection', { className: selectedClass, team: selectedTeam, summonerSpell: selectedSpell }); }
  document.getElementById('startBtn').addEventListener('click', () => { if(socket) socket.emit('start_game'); else { m.style.display = 'none'; startGame(selectedClass, selectedTeam); } });
  document.getElementById('spectateBtn').addEventListener('click', () => { if(socket) socket.disconnect(); m.style.display = 'none'; startGame(selectedClass, selectedTeam, true); });
}

export function updateSpellLabels() {}

const restartBtn = document.getElementById('restartBtn'); if(restartBtn) restartBtn.addEventListener('click', ()=>{ location.reload(); });
const closeShopBtn = document.getElementById('closeShop'); if(closeShopBtn) closeShopBtn.addEventListener('click', ()=> closeShop());