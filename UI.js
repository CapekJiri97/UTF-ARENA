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
  #minimap { width: 300px !important; height: 300px !important; border: 2px solid #444; border-radius: 50% !important; overflow: hidden !important; box-shadow: 0 0 10px rgba(0,0,0,0.8); }
  #shopOverlay { display: block !important; position: fixed !important; left: auto !important; right: 0 !important; top: 0 !important; width: 350px !important; height: 100vh !important; background: rgba(0,0,0,0.95) !important; border-left: 2px solid #555 !important; padding: 20px !important; overflow-y: auto !important; color: #fff !important; font-family: monospace !important; transition: transform 0.3s ease !important; transform: translateX(0); z-index: 10000 !important; box-sizing: border-box !important; }
  #shopOverlay.hidden { transform: translateX(100%) !important; }
  .shop-col { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .shop-col-title { font-weight: bold; color: #ffcc00; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 3px; }
`;
document.head.appendChild(style);

export function updateLobbyUI(playersData, roomName = "OFFLINE") {
  const rb = document.getElementById('roomBrowser'); if (rb) rb.style.display = 'none';
  const rl = document.getElementById('roomLobby'); if (rl) rl.style.display = 'block';
  
  const title = document.getElementById('lobbyTitle');
  if (title) title.textContent = `ROOM: ${roomName}`;

  const list = document.getElementById('lobbyList'); if(!list) return;
  list.innerHTML = '';
  
  let myTeam = -1;
  let myClass = '';
  const blueTaken = new Set();
  const redTaken = new Set();

  Object.values(playersData).forEach(p => {
      const tColor = p.team === 0 ? '#486FED' : '#FF4E4E'; 
      const isMe = (socket && p.id === socket.id);
      if (isMe) {
          myTeam = p.team;
          myClass = p.className;
      }
      
      if (p.team === -1) {
          list.innerHTML += `<li style="color:#aaa; margin-bottom:6px; font-size:16px;">[SPECTATOR] ${p.id.substring(0,4)}... ${isMe ? ' (TY)' : ''}</li>`;
      } else {
          list.innerHTML += `<li style="color:${tColor}; margin-bottom:6px; font-size:16px;">[${p.className} | ${p.summonerSpell}] ${p.id.substring(0,4)}... ${isMe ? ' (TY)' : ''}</li>`;
      }
      
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

export function updateRoomListUI(rooms) {
    const list = document.getElementById('roomList');
    if (!list) return;
    list.innerHTML = '';
    if (rooms.length === 0) {
        list.innerHTML = '<li style="color:#666;">No active rooms. Create one above!</li>';
        return;
    }
    rooms.forEach(r => {
        const li = document.createElement('li');
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '8px'; li.style.paddingBottom = '8px'; li.style.borderBottom = '1px solid #222';
        
        const info = document.createElement('span');
        info.textContent = `${r.name} - ${r.players} Player(s) ${r.started ? '[IN GAME]' : ''}`;
        info.style.color = r.started ? '#888' : '#fff';
        
        const btn = document.createElement('button');
        btn.textContent = 'JOIN';
        btn.style.padding = '4px 12px'; btn.style.background = '#000'; btn.style.color = r.started ? '#666' : '#0f0'; btn.style.border = '1px solid ' + (r.started ? '#666' : '#0f0'); btn.style.cursor = r.started ? 'not-allowed' : 'pointer';
        btn.disabled = r.started;
        btn.onclick = () => { if(socket) socket.emit('join_room', r.name); };
        
        li.appendChild(info); li.appendChild(btn);
        list.appendChild(li);
    });
}

export function openShop(){ populateShop(); document.getElementById('shopOverlay').classList.remove('hidden'); }
export function closeShop(){ document.getElementById('shopOverlay').classList.add('hidden'); }
export function toggleShop(){ const o = document.getElementById('shopOverlay'); if(o.classList.contains('hidden')) openShop(); else closeShop(); }

export function populateShop() { 
  const overlay = document.getElementById('shopOverlay'); 
  if(!overlay) return; 
  overlay.innerHTML = '<h2 style="color:#fff; text-align:center; border-bottom:1px solid #444; padding-bottom:10px; margin-top:0;">SHOP</h2><div id="shopList"></div><button id="closeShopBtn" style="width:100%; padding:10px; margin-top:20px; background:#444; color:#fff; border:none; cursor:pointer; font-weight:bold;">CLOSE</button>'; 
  document.getElementById('closeShopBtn').onclick = closeShop; 

  const list = document.getElementById('shopList'); 
  const cats = { 'DMG': ['ad', 'ap'], 'ARMOR': ['armor', 'mr', 'hp'], 'SPEED': ['boots', 'as', 'ah'] }; 

  for(let catName in cats) { 
      let col = document.createElement('div'); col.className = 'shop-col'; 
      let title = document.createElement('div'); title.className = 'shop-col-title'; title.textContent = catName; 
      col.appendChild(title); 

      for(let id of cats[catName]) { 
          const it = shopItems.find(x => x.id === id); 
          if(!it) continue; 
          let count = 0; if(player && player.items) count = player.items.filter(i=>i===it.id).length; 
          const div = document.createElement('div'); div.style.background = '#111'; div.style.border = '1px solid #333'; div.style.padding = '8px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; 
          div.innerHTML = `<div style="flex-grow:1;"><b>${it.name}</b> ${count>0?`<span style="color:#0f0;">(${count}x)</span>`:''}<br><span style="font-size:10px; color:#aaa;">${it.desc}</span><br><span style="color:#ffcc00; font-size:12px;">${it.cost}g</span></div>`; 
          const btn = document.createElement('button'); btn.textContent='Buy'; btn.style.background='#222'; btn.style.color='#0f0'; btn.style.border='1px solid #0f0'; btn.style.padding='4px 8px'; btn.style.cursor='pointer'; 
          btn.addEventListener('click', ()=> buyItem(it.id)); div.appendChild(btn); col.appendChild(div); 
      } list.appendChild(col); 
  } 
}

export function updateInventory(){ if(!player) return; const inv = document.getElementById('inventory'); inv.innerHTML = ''; for(const id of player.items){ const it = shopItems.find(s=>s.id===id); const slot = document.createElement('div'); slot.className='invSlot'; slot.textContent = it? it.name : id; inv.appendChild(slot); } }

export function drawBackground(ctx){ 
  ctx.fillStyle = '#070707'; ctx.fillRect(0,0,world.width, world.height);
  if (!game.boundaryVisuals) {
      game.boundaryVisuals = []; let sb = smoothPolygon(mapBoundary, 3);
      for(let i=0; i<sb.length; i++) { let p1 = sb[i], p2 = sb[(i+1)%sb.length]; let d = Math.hypot(p2.x-p1.x, p2.y-p1.y);
          for(let step=0; step<d; step+=25) { 
              let bx = p1.x + (p2.x-p1.x)*(step/d); let by = p1.y + (p2.y-p1.y)*(step/d);
              game.boundaryVisuals.push({ x: bx, y: by, char: '#' });
          }
      }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '16px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(let p of game.boundaryVisuals) { ctx.fillText(p.char, p.x, p.y); }
  for(let sp of spawnPoints){
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '16px monospace';
    for(let a=0; a<Math.PI*2; a+=0.15){
        ctx.fillText('#', sp.x + Math.cos(a)*200, sp.y + Math.sin(a)*200);
    }
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
      ctx.strokeStyle = 'rgba(54, 39, 255, 0.5)'; // default for debug
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
        ctx.strokeStyle = p.team === 0 ? 'rgba(72, 111, 237, 0.5)' : 'rgba(255, 78, 78, 0.5)';
        ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(p.pos.x, p.pos.y); ctx.lineTo(p.objective.pos.x, p.objective.pos.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  ctx.setTransform(1,0,0,1,0,0); 
  
  // --- SCREEN FLASH EFFECTS ---
  if (game.screenDamageFlash > 0 || game.screenHealFlash > 0) {
      let maxDmg = Math.max(0, game.screenDamageFlash);
      let maxHeal = Math.max(0, game.screenHealFlash);
      let particleCount = Math.floor(20 + (maxDmg * 60) + (maxHeal * 60));
      
      ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let chars = ['#', '%', '&', '=', 'X', '@'];
      
      for(let i=0; i<particleCount; i++) {
          let rx, ry;
          if (Math.random() > 0.5) {
              rx = Math.random() * canvas.width;
              ry = Math.random() > 0.5 ? Math.random() * 120 : canvas.height - Math.random() * 120;
          } else {
              rx = Math.random() > 0.5 ? Math.random() * 120 : canvas.width - Math.random() * 120;
              ry = Math.random() * canvas.height;
          }
          
          if (maxDmg > 0 && Math.random() < maxDmg) {
              ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.8 * maxDmg})`;
              ctx.fillText(chars[Math.floor(Math.random() * chars.length)], rx, ry);
          }
          if (maxHeal > 0 && Math.random() < maxHeal) {
              ctx.fillStyle = `rgba(0, 255, 0, ${Math.random() * 0.7 * maxHeal})`;
              ctx.fillText(chars[Math.floor(Math.random() * chars.length)], rx, ry);
          }
      }
  }
  
  drawMinimap();
  if(game.startDelay > 0 && game.started) { ctx.font = '40px monospace'; ctx.fillStyle = '#ffcc00'; ctx.textAlign='center'; ctx.fillText(`MATCH STARTS IN ${Math.ceil(game.startDelay)}`, canvas.width/2, 100); }

  if(game.started) {
    // --- TOP LEFT CONTROLS ---
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '12px monospace'; ctx.fillStyle = '#888';
    ctx.fillText('B - SHOP', 20, 20); ctx.fillText('C - CHAR. INFO', 20, 36); ctx.fillText('M - GENERAL INFO', 20, 52);

    // --- TOP CENTER SCORE ---
    let tBlue = game.towers.filter(t=>t.owner===0).length; let tRed = game.towers.filter(t=>t.owner===1).length;
    let cxTop = canvas.width / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#fff'; ctx.fillText(' : ', cxTop, 20);
    ctx.textAlign = 'right'; ctx.fillStyle = '#486FED'; ctx.fillText(Math.floor(game.nexus[0]), cxTop - 15, 20);
    ctx.textAlign = 'left'; ctx.fillStyle = '#FF4E4E'; ctx.fillText(Math.floor(game.nexus[1]), cxTop + 15, 20);
    
    ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(' X ', cxTop, 55);
    ctx.textAlign = 'right'; ctx.fillStyle = '#486FED'; ctx.fillText(`(${tBlue})`, cxTop - 15, 55);
    ctx.textAlign = 'left'; ctx.fillStyle = '#FF4E4E'; ctx.fillText(`(${tRed})`, cxTop + 15, 55);

    if (game.isSpectator) {
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 20px monospace';
        ctx.fillText('SPECTATOR MODE - WASD TO MOVE CAMERA', canvas.width / 2, 90);
    }

    // Kill Feed & Objectives (Uprostřed pod skóre)
    if (game.killFeed && game.killFeed.length > 0) {
        let kfY = 85;
        ctx.font = 'bold 13px monospace';
        for (let kf of game.killFeed) {
            let kStr = kf.killer; let vStr = kf.victim; let mStr = kf.isCapture ? ' 🚩 ' : ' ⚔ ';
            let wK = ctx.measureText(kStr).width; let wM = ctx.measureText(mStr).width; let wV = ctx.measureText(vStr).width;
            let totalW = wK + wM + wV; let startX = cxTop - totalW/2;
            
            ctx.textAlign = 'left';
            ctx.fillStyle = kf.killerTeam === 0 ? '#486FED' : (kf.killerTeam === 1 ? '#FF4E4E' : '#aaa');
            ctx.fillText(kStr, startX, kfY);
            ctx.fillStyle = '#fff'; ctx.fillText(mStr, startX + wK, kfY);
            ctx.fillStyle = kf.victimTeam === 0 ? '#486FED' : (kf.victimTeam === 1 ? '#FF4E4E' : '#aaa');
            ctx.fillText(vStr, startX + wK + wM, kfY);
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
              let bar = '[' + '|'.repeat(f) + ' '.repeat(maxBoxes - f) + ']'; ctx.fillStyle = bot.alive ? (bot.team === 0 ? '#486FED' : '#FF4E4E') : '#444'; ctx.fillText(bar, canvas.width - 20, y); 
          }
      }
      
      let cx = canvas.width / 2; const cy = canvas.height - 65; 
      if (cx + 300 > canvas.width - 320) cx = Math.max(300, canvas.width - 620); // Responzivní uhnutí minimapě

      if (player.currentTarget && player.currentTarget.hp > 0 && !player.currentTarget.dead) {
          const t = player.currentTarget; const tw = 280, th = 85; const tx = cx - tw/2, ty = cy - 180;
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.strokeStyle = (t.team >= 0) ? TEAM_COLOR[t.team] : NEUTRAL_COLOR; ctx.lineWidth = 2; ctx.fillRect(tx, ty, tw, th); ctx.strokeRect(tx, ty, tw, th);
          
          ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; let tName = t.className || 'Minion'; ctx.fillText(`${tName} ${t.level ? 'LV'+t.level : ''}`, tx + 15, ty + 25);

          let fT = Math.max(0, Math.min(15, Math.round((Math.max(0,t.hp)/(t.effectiveMaxHp || t.maxHp)) * 15) || 0)); let hpBarStr = '[' + '#'.repeat(fT) + '-'.repeat(15 - fT) + ']';
          ctx.fillStyle = (t.team >= 0) ? TEAM_COLOR[t.team] : NEUTRAL_COLOR; ctx.font = 'bold 14px monospace'; ctx.fillText(hpBarStr, tx + 15, ty + 48);
          ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText(`${Math.floor(t.hp)}/${t.effectiveMaxHp || t.maxHp}`, tx + 15, ty + 68);
          
          if (t.AD !== undefined) { 
              ctx.fillStyle = '#aaa'; ctx.font = '11px monospace'; let stX = tx + 150;
              ctx.fillText(`AD:${Math.round(t.AD*(t.hasPowerup?1.2:1))}`, stX, ty + 30);
              ctx.fillText(`AP:${Math.round(t.AP*(t.hasPowerup?1.2:1))}`, stX, ty + 55);
              ctx.fillText(`AR:${Math.round(t.armor*(t.hasPowerup?1.2:1))}`, stX + 45, ty + 30);
              ctx.fillText(`MR:${Math.round(t.mr*(t.hasPowerup?1.2:1))}`, stX + 45, ty + 55);
              ctx.fillText(`SP:${Math.round(t.speed*(t.hasPowerup?1.2:1))}`, stX + 90, ty + 30);
              ctx.fillText(`AS:${(t.attackDelay / t.attackSpeed).toFixed(2)}`, stX + 90, ty + 55); 
          }
      }

      ctx.textBaseline = 'middle';
      // ASCII HP BAR
      ctx.fillStyle = player.team === 0 ? '#486FED' : '#FF4E4E';
      ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
      let maxHpBoxes = 30; let filledHp = Math.max(0, Math.min(maxHpBoxes, Math.round((player.hp / player.effectiveMaxHp) * maxHpBoxes) || 0));
      let hpStr = '[' + '#'.repeat(filledHp) + '-'.repeat(maxHpBoxes - filledHp) + ']';
      let hpBarW = ctx.measureText(hpStr).width;
      ctx.fillText(hpStr, cx - hpBarW/2 - 20, cy - 70);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; 
      ctx.fillText(`${Math.floor(player.hp)} / ${player.effectiveMaxHp}`, cx + hpBarW/2 - 10, cy - 72);

      // ASCII VERTICAL EXP BAR
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      let maxExpBoxes = 8;
      const expPct = player.exp / expForLevel(player.level);
      let filledExp = Math.max(0, Math.min(maxExpBoxes, Math.round(expPct * maxExpBoxes) || 0));
      for(let i=0; i<maxExpBoxes; i++) {
          let isFilled = (maxExpBoxes - 1 - i) < filledExp;
          ctx.fillStyle = isFilled ? '#8a2be2' : '#555';
          ctx.fillText(isFilled ? '=' : '|', cx - 115, cy - 55 + i * 10);
      }
      ctx.fillStyle = '#aaa'; ctx.font = '9px monospace'; ctx.fillText('XP', cx - 115, cy + 35);

      // HERO CIRCLE
      ctx.beginPath(); ctx.arc(cx - 50, cy, 35, 0, Math.PI*2);
      ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle = '#777'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.fillText(player.glyph, cx - 50, cy + 2);

      // LEVEL CIRCLE
      ctx.beginPath(); ctx.arc(cx - 78, cy - 25, 12, 0, Math.PI*2);
      ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.fillText(player.level, cx - 78, cy - 25);

      // GOLD BOX
      ctx.fillStyle = '#111'; ctx.fillRect(cx - 30, cy + 20, 60, 22);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(cx - 30, cy + 20, 60, 22);
      ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 12px monospace'; ctx.fillText(Math.floor(player.gold) + 'g', cx, cy + 31);

      // SPELLS
      const qKey = game.autoTarget ? 'J' : 'Q'; const eKey = game.autoTarget ? 'K' : 'E'; const sumKey = game.autoTarget ? 'L' : 'F';
      const getTypeLabel = (type) => { if(!type) return 'Spell'; if(type.includes('heal')) return 'Heal'; if(type.includes('dash')) return 'Dash'; if(type.includes('buff')) return 'Buff'; if(type.includes('summon')) return 'Summon'; if(type.includes('knockback')) return 'Knock'; return 'Dmg'; };
      const drawSpell = (x, y, key, lvl, cd, maxCd, isSum, typeLabel) => {
          ctx.fillStyle = '#aaa'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(typeLabel, x+20, y - 8);
          ctx.fillStyle = '#111'; ctx.fillRect(x, y, 40, 40); ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 40, 40);
          if (cd > 0) {
              ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x, y, 40, 40);
              ctx.fillStyle = '#888'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText(cd.toFixed(1), x+20, y+20);
          } else { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText(key, x+20, y+20); }
          ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.fillText(isSum ? 'S' : ('LV'+lvl), x+20, y+48);
      };
      drawSpell(cx + 10, cy - 20, qKey, player.spells.Q.level, player.spells.Q.cd, player.computeSpellCooldown('Q'), false, getTypeLabel(player.spells.Q.type));
      drawSpell(cx + 60, cy - 20, eKey, player.spells.E.level, player.spells.E.cd, player.computeSpellCooldown('E'), false, getTypeLabel(player.spells.E.type));
      drawSpell(cx + 110, cy - 20, sumKey, 0, player.summonerCooldown, SUMMONER_SPELLS[player.summonerSpell].cd, true, player.summonerSpell);

      // Lvl Up indikátor (+)
      if (player.spellPoints > 0) {
          ctx.fillStyle = (performance.now() % 1000 > 500) ? '#fff' : '#888'; 
          ctx.font = 'bold 18px monospace';
          ctx.fillText('+', cx + 30, cy - 45);
          ctx.fillText('+', cx + 80, cy - 45);
      }

      // STATS TABLE
      ctx.fillStyle = '#111'; ctx.fillRect(cx + 160, cy - 40, 180, 75);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(cx + 160, cy - 40, 180, 75);
      ctx.fillStyle = '#aaa'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`AD:${Math.round(player.AD * (player.hasPowerup?1.2:1))}`, cx + 165, cy - 25);
      ctx.fillText(`AP:${Math.round(player.AP * (player.hasPowerup?1.2:1))}`, cx + 165, cy - 5);
      ctx.fillText(`AR:${Math.round(player.armor * (player.hasPowerup?1.2:1))}`, cx + 225, cy - 25);
      ctx.fillText(`MR:${Math.round(player.mr * (player.hasPowerup?1.2:1))}`, cx + 225, cy - 5);
      ctx.fillText(`HP:${player.effectiveMaxHp}`, cx + 225, cy + 15);
      ctx.fillText(`AS:${(player.attackDelay / player.attackSpeed).toFixed(2)}`, cx + 285, cy - 25);
      ctx.fillText(`SP:${Math.round(player.speed * (player.hasPowerup?1.2:1))}`, cx + 285, cy - 5);
      ctx.fillText(`AH:${player.abilityHaste}`, cx + 285, cy + 15);
    }
    if (keys['tab']) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(100, 100, canvas.width - 200, canvas.height - 200); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(100, 100, canvas.width - 200, canvas.height - 200);
        ctx.fillStyle = '#fff'; ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.fillText('SCOREBOARD', canvas.width/2, 140); ctx.font = '16px monospace'; ctx.textAlign = 'left'; ctx.fillText('BLUE TEAM', 130, 180);
        let blueTeam = game.players.filter(p => p.team === 0); for(let i=0; i<blueTeam.length; i++) { let p = blueTeam[i]; let stat = p.alive ? 'ALIVE' : `DEAD(${Math.ceil(p.respawnTimer)}s)`; ctx.fillStyle = (player && p.id === player.id) ? '#0f0' : '#486FED'; ctx.fillText(`${p.className} [${p.dmgType === 'magical' ? 'AP' : 'AD'}] (LV${p.level}) - ${stat} - Items: ${p.items.length} | K/D/A: ${p.kills}/${p.deaths}/${p.assists} | Gold: ${Math.floor(p.totalGold)}`, 130, 210 + i*25); }
        ctx.fillStyle = '#fff'; ctx.fillText('RED TEAM', canvas.width/2 + 30, 180); let redTeam = game.players.filter(p => p.team === 1);
        for(let i=0; i<redTeam.length; i++) { let p = redTeam[i]; let stat = p.alive ? 'ALIVE' : `DEAD(${Math.ceil(p.respawnTimer)}s)`; ctx.fillStyle = '#FF4E4E'; ctx.fillText(`${p.className} [${p.dmgType === 'magical' ? 'AP' : 'AD'}] (LV${p.level}) - ${stat} - Items: ${p.items.length} | K/D/A: ${p.kills}/${p.deaths}/${p.assists} | Gold: ${Math.floor(p.totalGold)}`, canvas.width/2 + 30, 210 + i*25); }
    }
    
    let vw = canvas.width / 100;
    let vh = canvas.height / 100;

    if (keys['c'] && player) {
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, 30 * vw, 100 * vh);
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 30 * vw, 100 * vh);
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(13, 1.6 * vw)}px monospace`; ctx.textAlign = 'left';
        ctx.fillText('CHARACTER INFO', 2 * vw, 5 * vh);
        
        ctx.font = `${Math.max(10, 0.96 * vw)}px monospace`;
        ctx.fillText(`Class: ${player.className}`, 2 * vw, 10 * vh);
        ctx.fillText(`Level: ${player.level} (${Math.floor(player.exp)}/${expForLevel(player.level)} XP)`, 2 * vw, 13 * vh);
        ctx.fillText(`HP: ${Math.floor(player.hp)} / ${player.effectiveMaxHp}`, 2 * vw, 16 * vh);
        ctx.fillText(`Gold: ${Math.floor(player.gold)}`, 2 * vw, 19 * vh);
        ctx.fillText(`Kills: ${player.kills} | Deaths: ${player.deaths}`, 2 * vw, 22 * vh);
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`ATTRIBUTES`, 2 * vw, 28 * vh);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`AD: ${Math.round(player.AD*(player.hasPowerup?1.2:1))}`, 2 * vw, 31 * vh);
        ctx.fillText(`AP: ${Math.round(player.AP*(player.hasPowerup?1.2:1))}`, 15 * vw, 31 * vh);
        ctx.fillText(`Armor: ${Math.round(player.armor*(player.hasPowerup?1.2:1))}`, 2 * vw, 34 * vh);
        ctx.fillText(`MR: ${Math.round(player.mr*(player.hasPowerup?1.2:1))}`, 15 * vw, 34 * vh);
        ctx.fillText(`Attack Speed: ${player.attackSpeed.toFixed(2)}`, 2 * vw, 37 * vh);
        ctx.fillText(`Move Speed: ${Math.round(player.speed*(player.hasPowerup?1.2:1))}`, 15 * vw, 37 * vh);
        ctx.fillText(`Ability Haste: ${player.abilityHaste}`, 2 * vw, 40 * vh);
        
        let baScale = player.dmgType === 'magical' ? (player.className === 'Hana' ? 0.4 : 0.15) : 0.6;
        let baDmg = Math.round(CLASSES[player.className].baseAtk + (player.dmgType === 'magical' ? player.AP*baScale : player.AD*baScale)); 
        ctx.fillStyle = '#fff'; ctx.fillText(`Basic Attack: Base ${CLASSES[player.className].baseAtk} + (${Math.round(baScale*100)}% ${player.dmgType === 'magical' ? 'AP' : 'AD'}) = ${baDmg} Dmg`, 2 * vw, 44 * vh);
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`SPELLS`, 2 * vw, 50 * vh);
        const q = player.spells.Q, e = player.spells.E;
        ctx.fillStyle = '#fff'; ctx.fillText(`[Q] Level ${q.level} - Cooldown: ${player.computeSpellCooldown('Q').toFixed(1)}s`, 2 * vw, 54 * vh); 
        ctx.fillStyle = '#aaa'; ctx.fillText(`    ${q.desc}`, 2 * vw, 57 * vh); ctx.fillStyle = '#fff';
        let qTotal = q.type.includes('heal') ? Math.round((q.amount||0) + (player.AP * (q.scaleAP||0)) + (player.AD * (q.scaleAD||0)) + q.level*10) : Math.round((q.baseDamage||0) + (player.AP * (q.scaleAP||0)) + (player.AD * (q.scaleAD||0)) + q.level*8);
        ctx.fillText(`    Dmg: Base ${q.baseDamage||q.amount||0} + (${(q.scaleAD||0)*100}% AD) + (${(q.scaleAP||0)*100}% AP) = ${qTotal}`, 2 * vw, 60 * vh);
        
        ctx.fillText(`[E] Level ${e.level} - Cooldown: ${player.computeSpellCooldown('E').toFixed(1)}s`, 2 * vw, 65 * vh);
        ctx.fillStyle = '#aaa'; ctx.fillText(`    ${e.desc}`, 2 * vw, 68 * vh); ctx.fillStyle = '#fff';
        let eTotal = e.type.includes('heal') ? Math.round((e.amount||0) + (player.AP * (e.scaleAP||0)) + (player.AD * (e.scaleAD||0)) + e.level*10) : Math.round((e.baseDamage||0) + (player.AP * (e.scaleAP||0)) + (player.AD * (e.scaleAD||0)) + e.level*8);
        ctx.fillText(`    Dmg: Base ${e.baseDamage||e.amount||0} + (${(e.scaleAD||0)*100}% AD) + (${(e.scaleAP||0)*100}% AP) = ${eTotal}`, 2 * vw, 71 * vh);
    }

    if (keys['m']) {
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, 30 * vw, 100 * vh);
        ctx.strokeStyle = '#486FED'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 30 * vw, 100 * vh);
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(13, 1.6 * vw)}px monospace`; ctx.textAlign = 'left';
        ctx.fillText('GENERAL INFO', 2 * vw, 5 * vh);
        
        ctx.font = `${Math.max(10, 0.96 * vw)}px monospace`;
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`CONTROLS`, 2 * vw, 12 * vh); 
        ctx.fillStyle = '#fff';
        ctx.fillText(`[W,A,S,D]     : Move`, 2 * vw, 16 * vh);
        ctx.fillText(`[ARROWS]      : Manual Aim`, 2 * vw, 19 * vh);
        ctx.fillText(`[SPACE]       : Basic Attack`, 2 * vw, 22 * vh);
        ctx.fillText(`[Q] / [E]     : Cast Spells`, 2 * vw, 25 * vh);
        ctx.fillText(`[F] / [L]     : Summoner Spell`, 2 * vw, 28 * vh);
        ctx.fillText(`[SHIFT + Q/E] : Level Up Spell`, 2 * vw, 31 * vh);
        ctx.fillText(`[B] : Shop | [TAB] : Scoreboard`, 2 * vw, 34 * vh);
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`DEBUG & SETTINGS`, 2 * vw, 42 * vh);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`[SHIFT + U]   : Toggle Auto-Target Aim Assist`, 2 * vw, 46 * vh);
        ctx.fillText(`[SHIFT + I]   : Toggle Auto-Play (Bot Mode)`, 2 * vw, 49 * vh);
        ctx.fillText(`[SHIFT + O]   : Toggle Mouse Target`, 2 * vw, 52 * vh);
        ctx.fillText(`[SHIFT + V]   : Toggle Debug Visuals`, 2 * vw, 55 * vh);
    }
  }
}

export function drawMinimap(){ const mm = document.getElementById('minimap'); const w = mm.clientWidth, h = mm.clientHeight; const ctxm = mm._ctx || (function(){ const c = document.createElement('canvas'); c.width = w; c.height = h; mm.appendChild(c); mm._ctx = c.getContext('2d'); return mm._ctx; })(); ctxm.clearRect(0,0,w,h); ctxm.fillStyle='#222'; ctxm.fillRect(0,0,w,h);
  const scaleX = w / world.width; const scaleY = h / world.height; 
  ctxm.save(); ctxm.beginPath(); ctxm.arc(w/2, h/2, w/2, 0, Math.PI*2); ctxm.clip();
  ctxm.fillStyle='#111'; ctxm.fillRect(0,0,w,h);
  
  for(let t of game.towers){ const x = t.pos.x * scaleX; const y = t.pos.y * scaleY; ctxm.fillStyle = t.owner===0? '#486FED' : t.owner===1? '#FF4E4E' : '#777'; ctxm.fillRect(x-3,y-3,6,6); }
  ctxm.beginPath(); ctxm.moveTo(mapBoundary[0].x * scaleX, mapBoundary[0].y * scaleY); for(let i=1; i<mapBoundary.length; i++) ctxm.lineTo(mapBoundary[i].x * scaleX, mapBoundary[i].y * scaleY); ctxm.closePath(); ctxm.strokeStyle = '#555'; ctxm.stroke();
  ctxm.fillStyle = '#555'; ctxm.font = '10px monospace'; ctxm.textAlign='center'; ctxm.textBaseline='middle';
  for(let w of game.walls) {
      let startX = Math.floor((w.bbox.minX - w.r)/60)*60, endX = Math.ceil((w.bbox.maxX + w.r)/60)*60;
      let startY = Math.floor((w.bbox.minY - w.r)/60)*60, endY = Math.ceil((w.bbox.maxY + w.r)/60)*60;
      for (let wx = startX; wx <= endX; wx += 60) {
          for (let wy = startY; wy <= endY; wy += 60) {
              let info = distToPoly(wx, wy, w.pts);
              if (info.inside || info.minDist <= w.r) { ctxm.fillText('#', wx * scaleX, wy * scaleY); }
          }
      }
  }
  for(let m of game.minions){ const x = m.pos.x * scaleX; const y = m.pos.y * scaleY; ctxm.fillStyle = m.team===0? '#b3ffb3':'#ffb3b3'; ctxm.fillRect(x-1,y-1,2,2); }
  
  for(let p of game.players){ 
    if (!p.alive) continue;
    const x = p.pos.x * scaleX; const y = p.pos.y * scaleY; 
    ctxm.fillStyle = p.team === 0 ? '#486FED' : '#FF4E4E';
    ctxm.font = (p === player ? 'bold 16px' : 'bold 12px') + ' monospace';
    ctxm.textAlign = 'center'; ctxm.textBaseline = 'middle';
    ctxm.fillText(p.glyph, x, y);
  }
  
  ctxm.lineWidth = 15; ctxm.strokeStyle = 'rgba(0,0,0,0.8)';
  ctxm.beginPath(); ctxm.arc(w/2, h/2, w/2, 0, Math.PI*2); ctxm.stroke();
  ctxm.restore();
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
          let color = p.team === 0 ? '#486FED' : '#FF4E4E'; if (p === player) color = '#0f0';
          html += `<tr style="color:${color}; text-align:center;"><td style="text-align:left; padding:4px;">${p.className}</td><td>${p.kills}/${p.deaths}/${p.assists}</td><td>${p.stats.dmgDealt}</td><td>${p.stats.dmgTaken}</td><td>${Math.round(p.stats.hpHealed)}</td><td>${Math.floor(p.totalGold)}</td></tr>`;
      }
      html += '</table>'; statsDiv.innerHTML = html; overlay.classList.remove('hidden'); 
  }
}

export function buildMenu() {
  let m = document.getElementById('menu'); if(!m) { m = document.createElement('div'); m.id = 'menu'; document.body.appendChild(m); }
  m.style.position = 'fixed'; m.style.top = '0'; m.style.left = '0'; m.style.width = '100%'; m.style.height = '100%'; m.style.zIndex = '9999'; m.style.display = 'flex'; m.style.justifyContent = 'center'; m.style.alignItems = 'center'; m.style.background = 'rgba(0,0,0,0.85)';
  let selectedClass = 'Bruiser'; let selectedTeam = 0; let selectedSpell = 'Heal'; let isSpectator = false;
  m.innerHTML = `
      <div id="roomBrowser" style="background:#111; padding:30px; border:1px solid #444; border-radius: 8px; color:#fff; text-align:center; width: 600px; display: ${socket ? 'block' : 'none'};">
          <h1 style="margin-top:0;">UTF Arena - BROWSE GAMES</h1>
          <div style="margin-bottom: 20px; display:flex; gap:10px; justify-content:center;">
              <input type="text" id="newRoomInput" placeholder="Enter Room Name..." style="padding:10px; font-size:16px; background:#000; color:#fff; border:1px solid #444; width: 60%;">
              <button id="createRoomBtn" style="padding:10px 20px; font-size:16px; font-weight:bold; cursor:pointer; background:#222; color:#0f0; border:2px solid #0f0;">CREATE ROOM</button>
          </div>
          <div style="text-align:left; background:#000; padding:15px; border:1px solid #333; border-radius:4px; min-height: 200px; max-height: 300px; overflow-y:auto;">
              <h3 style="margin-top:0; color:#aaa; border-bottom:1px solid #444; padding-bottom:10px;">Active Rooms:</h3>
              <ul id="roomList" style="list-style:none; padding:0; margin:0; font-family:monospace; font-size:16px;">
                  <li>Loading rooms...</li>
              </ul>
          </div>
      </div>
    <div id="roomLobby" style="display: ${socket ? 'none' : 'block'}; background:#111; padding:30px; border:1px solid #444; border-radius: 8px; color:#fff; text-align:center; width: 1000px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #333; padding-bottom: 15px; margin-bottom: 15px;">
          <h1 id="lobbyTitle" style="margin:0;">OFFLINE MODE</h1>
          <button id="leaveRoomBtn" style="display: ${socket ? 'block' : 'none'}; padding:8px 16px; cursor:pointer; background:#300; color:#ff6b6b; border:1px solid #ff6b6b; font-weight:bold; border-radius:4px;">LEAVE ROOM</button>
      </div>
      <div style="display:flex; justify-content: space-between; margin-top: 20px;">
        <div style="width: 70%; text-align: left;">
          <p style="color:#aaa; margin-bottom: 5px;">1. Select Team:</p>
          <div style="display:flex; gap: 5px; margin-bottom:15px;">
            <button id="btnBlue" style="padding:10px; flex-grow:1; cursor:pointer; font-weight:bold; background:#000; color:#486FED; border:2px solid #486FED;">BLUE TEAM</button>
            <button id="btnRed" style="padding:10px; flex-grow:1; cursor:pointer; font-weight:bold; background:#000; color:#FF4E4E; border:2px solid #444;">RED TEAM</button>
            <button id="btnSpec" style="padding:10px; flex-grow:1; cursor:pointer; font-weight:bold; background:#000; color:#aaa; border:2px solid #444;">SPECTATE</button>
          </div>
          <p style="color:#aaa; margin-bottom: 5px;">2. Select Class:</p>
          <div id="classBtns" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px;"></div>
          <p style="color:#aaa; margin-bottom: 5px;">3. Select Summoner Spell:</p>
          <div id="spellBtns" style="display:flex; flex-wrap:wrap; gap:5px;"></div>
        </div>
        <div style="width: 28%; text-align: left; background:#000; padding: 15px; border:1px solid #333; border-radius: 4px;">
          <h3 style="margin-top:0; color:#aaa; border-bottom:1px solid #444; padding-bottom:10px;">Players in Room:</h3>
          <ul id="lobbyList" style="list-style: none; padding: 0; margin: 0; font-family: monospace;"><li>Offline or Connecting...</li></ul>
        </div>
      </div>
      <button id="startBtn" style="margin-top:25px; padding:15px 24px; width: 100%; font-size:18px; font-weight:bold; cursor:pointer; background:#222; color:#0f0; border:2px solid #0f0;">START MATCH (Everyone)</button>
    </div>`;
    
  const createRoomBtn = document.getElementById('createRoomBtn');
  const newRoomInput = document.getElementById('newRoomInput');
  if (createRoomBtn) createRoomBtn.onclick = () => {
      if (socket && newRoomInput.value.trim() !== '') { socket.emit('create_room', newRoomInput.value.trim()); newRoomInput.value = ''; }
  };

  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  if (leaveRoomBtn) leaveRoomBtn.onclick = () => {
      if (socket) {
          socket.emit('leave_room');
          document.getElementById('roomLobby').style.display = 'none';
          document.getElementById('roomBrowser').style.display = 'block';
      }
  };

  const btnBlue = document.getElementById('btnBlue'), btnRed = document.getElementById('btnRed'), btnSpec = document.getElementById('btnSpec');
  const teamBtns = [btnBlue, btnRed, btnSpec];
  const selectionDivs = [document.getElementById('classBtns'), document.getElementById('spellBtns')];
  const startBtn = document.getElementById('startBtn');

  btnBlue.onclick = (e) => { selectedTeam = 0; isSpectator = false; teamBtns.forEach(b=>b.style.borderColor='#444'); e.target.style.borderColor='#486FED'; selectionDivs.forEach(d=>d.style.opacity=1); startBtn.disabled = false; startBtn.style.opacity = 1; notifyServer(); };
  btnRed.onclick = (e) => { selectedTeam = 1; isSpectator = false; teamBtns.forEach(b=>b.style.borderColor='#444'); e.target.style.borderColor='#FF4E4E'; selectionDivs.forEach(d=>d.style.opacity=1); startBtn.disabled = false; startBtn.style.opacity = 1; notifyServer(); };
  btnSpec.onclick = (e) => { selectedTeam = -1; isSpectator = true; teamBtns.forEach(b=>b.style.borderColor='#444'); e.target.style.borderColor='#aaa'; selectionDivs.forEach(d=>d.style.opacity=0.3); startBtn.disabled = false; startBtn.style.opacity = 1; notifyServer(); };

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
          let btn = document.createElement('button'); btn.textContent = `${c} (${type})`; btn.dataset.className = c; btn.style.padding = '8px 10px'; btn.style.background = '#000'; btn.style.color = '#fff'; btn.style.border = '1px solid #444'; btn.style.cursor = 'pointer';
          btn.onclick = () => { selectedClass = c; notifyServer(); }; 
          col.appendChild(btn); allBtns.push(btn);
      });
      cBtns.appendChild(col);
  } setTimeout(() => { let b = allBtns.find(x => x.dataset.className === 'Bruiser'); if(b) b.click(); }, 50); // Default Bruiser

  const sBtns = document.getElementById('spellBtns');
  const allSpells = [];
  const tooltip = document.createElement('div');
  tooltip.style.position = 'fixed'; tooltip.style.background = 'rgba(0,0,0,0.9)'; tooltip.style.border = '1px solid #888'; tooltip.style.color = '#fff'; tooltip.style.padding = '8px'; tooltip.style.borderRadius = '4px'; tooltip.style.display = 'none'; tooltip.style.pointerEvents = 'none'; tooltip.style.fontSize = '12px';
  document.body.appendChild(tooltip);

  for (let s in SUMMONER_SPELLS) {
      let btn = document.createElement('button'); btn.textContent = s; btn.dataset.spell = s; btn.style.padding = '8px 10px'; btn.style.background = '#000'; btn.style.color = '#fff'; btn.style.border = '1px solid #444'; btn.style.cursor = 'pointer'; btn.style.flexGrow = '1';
      btn.onclick = () => { selectedSpell = s; allSpells.forEach(b => b.style.borderColor = '#444'); btn.style.borderColor = '#0f0'; notifyServer(); };
      btn.onmouseover = (e) => { const spell = SUMMONER_SPELLS[s]; tooltip.innerHTML = `<b>${spell.name}</b><br>${spell.desc}<br><i>Cooldown: ${spell.cd}s</i>`; tooltip.style.display = 'block'; };
      btn.onmousemove = (e) => { tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY + 15) + 'px'; };
      btn.onmouseout = () => { tooltip.style.display = 'none'; };
      sBtns.appendChild(btn); allSpells.push(btn);
  } setTimeout(() => { let b = allSpells.find(x => x.textContent === 'Heal'); if(b) b.click(); }, 50);

  function notifyServer() { if(socket) socket.emit('update_selection', { className: selectedClass, team: selectedTeam, summonerSpell: selectedSpell }); }
  startBtn.addEventListener('click', () => { if(socket) socket.emit('start_game'); else { m.style.display = 'none'; startGame(selectedClass, selectedTeam, isSpectator); } });
}

export function updateSpellLabels() {}

const restartBtn = document.getElementById('restartBtn'); if(restartBtn) restartBtn.addEventListener('click', ()=>{ location.reload(); });
const closeShopBtn = document.getElementById('closeShop'); if(closeShopBtn) closeShopBtn.addEventListener('click', ()=> closeShop());