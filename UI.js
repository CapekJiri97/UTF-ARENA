import { dist, distToPoly, smoothPolygon, expForLevel } from './Utils.js';
import { shopItems } from './items.js';
import { CLASSES, SUMMONER_SPELLS, AA_SCALES } from './classes.js';
import { game, camera, TEAM_COLOR, NEUTRAL_COLOR } from './State.js';
import { world, spawnPoints, mapBoundary } from './MapConfig.js';
import { canvas, ctx, keys, player, socket, startGame, buyItem, drawHealthBar } from './main.js';

const style = document.createElement('style');
style.innerHTML = `
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; background: #070707; }
  canvas { touch-action: none; user-select: none; -webkit-user-select: none; outline: none; -webkit-tap-highlight-color: transparent; }
  #hud, #hp, #gold, #exp, #level, #respawn, #nexusBlue, #nexusRed { display: none !important; }
  #qbar, #ebar, #qlv, #elv, #qcd, #ecd, .cooldown-container { display: none !important; }
  #minimap { width: 300px !important; height: 300px !important; border: 2px solid #444; border-radius: 50% !important; overflow: hidden !important; box-shadow: 0 0 10px rgba(0,0,0,0.8); }
  #shopOverlay { display: block !important; position: fixed !important; left: auto !important; right: 0 !important; top: 0 !important; width: 100% !important; max-width: 400px !important; height: 100% !important; background: rgba(0,0,0,0.95) !important; border-left: 2px solid #555 !important; padding: 20px 20px 25vh 20px !important; overflow-y: auto !important; color: #fff !important; font-family: monospace !important; transition: transform 0.3s ease !important; transform: translateX(0); z-index: 10000 !important; box-sizing: border-box !important; }
  #shopOverlay.hidden { transform: translateX(100%) !important; }
  #menu, #roomBrowser, #roomLobby, #shopOverlay, #endStats, #roomListContainer { -webkit-overflow-scrolling: touch !important; overscroll-behavior-y: contain !important; touch-action: pan-y !important; }
  #portraitWarning { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; color: #ffcc00; z-index: 9999999; flex-direction: column; justify-content: center; align-items: center; text-align: center; font-family: monospace; }
  @media screen and (max-width: 900px) and (orientation: portrait) {
      #portraitWarning { display: flex !important; }
  }
  @media (max-height: 600px), (max-width: 900px) { 
      #minimap { 
          width: 30vh !important; 
          height: 30vh !important; 
          position: absolute !important;
          right: 2vw !important;
          bottom: 2vh !important;
          top: auto !important;
          left: auto !important;
          margin: 0 !important;
          transform: none !important;
          border-radius: 50% !important;
      } 
  }
  .shop-col { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .shop-col-title { font-weight: bold; color: #ffcc00; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 3px; }
  @media (max-height: 600px) {
      #roomLobby, #roomBrowser { padding: 2vh !important; }
      #roomLobby h1, #roomBrowser h1 { font-size: 4vh !important; margin-bottom: 1vh !important; }
      #roomLobby p, #roomLobby li, #roomBrowser li, #roomLobby button, #roomBrowser button { font-size: 3vh !important; padding: 1vh 2vh !important; }
      #roomLobby h3 { font-size: 3vh !important; margin-bottom: 1vh !important; }
      #classBtns button, #spellBtns button { padding: 1.5vh !important; font-size: 2.5vh !important; }
      .shop-col { margin-bottom: 5px !important; }
  }
`;
document.head.appendChild(style);

if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    document.head.appendChild(meta);
}

// Vytvoření chybějících UI elementů, pokud nejsou v HTML, aby hra nespadla při startu
if (!document.getElementById('minimap')) {
    const mm = document.createElement('div');
    mm.id = 'minimap';
    document.body.appendChild(mm);
}
if (!document.getElementById('shopOverlay')) {
    const so = document.createElement('div');
    so.id = 'shopOverlay';
    so.className = 'hidden';
    so.addEventListener('touchstart', (e) => e.stopPropagation(), {passive: true});
    so.addEventListener('touchmove', (e) => e.stopPropagation(), {passive: true});
    so.addEventListener('touchend', (e) => e.stopPropagation(), {passive: true});
    so.addEventListener('wheel', (e) => e.stopPropagation(), {passive: true});
    document.body.appendChild(so);
}
if (!document.getElementById('inventory')) {
    const inv = document.createElement('div');
    inv.id = 'inventory';
    document.body.appendChild(inv);
}
if (!document.getElementById('portraitWarning')) {
    const pw = document.createElement('div');
    pw.id = 'portraitWarning';
    pw.innerHTML = '<h1>ROTATE DEVICE</h1><p>Please rotate your phone<br>to landscape mode to play.</p><div style="font-size: 48px; margin-top: 20px;">↻</div>';
    document.body.appendChild(pw);
}

// --- ZABRÁNĚNÍ NATIVNÍHO ZOOMU A POHYBU STRÁNKY PROHLÍŽEČEM ---
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
        e.preventDefault();
    }
});
window.addEventListener('touchmove', (e) => {
    if (e.scale !== 1 || e.touches.length > 1) { e.preventDefault(); }
}, { passive: false });
export function requestLandscapeFullscreen() {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;
    const el = document.documentElement;
    const rfs = el.requestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (rfs) {
        rfs.call(el).then(() => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(e => console.warn('Orientation lock ignored by browser'));
            }
        }).catch(e => console.warn('Fullscreen ignored by browser'));
    }
}
export function updateLobbyUI(playersData, roomName = "OFFLINE") {
  const rb = document.getElementById('roomBrowser'); if (rb) rb.style.display = 'none';
  const rl = document.getElementById('roomLobby'); if (rl) rl.style.display = 'block';
  
  const title = document.getElementById('lobbyTitle');
  if (title) title.textContent = `ROOM: ${roomName}`;

  const list = document.getElementById('lobbyList'); if(!list) return;
  list.innerHTML = '';
  
  let myTeam = -1;
  let myClass = '';
  let myReady = false;
  let allReady = true;
  let playerCount = 0;
  const blueTaken = new Set();
  const redTaken = new Set();

  Object.values(playersData).forEach(p => {
      playerCount++;
      const tColor = p.team === 0 ? '#486FED' : '#FF4E4E'; 
      const isMe = (socket && p.id === socket.id);
      if (isMe) {
          myTeam = p.team;
          myClass = p.className;
          myReady = p.ready;
      }
      
      const readyText = p.ready ? '<span style="color:#0f0;">[READY]</span>' : '<span style="color:#888;">[WAITING]</span>';
      
      if (p.team === -1) {
          list.innerHTML += `<li style="color:#aaa; margin-bottom:6px; font-size:16px;">[SPECTATOR] ${p.id.substring(0,4)}... ${isMe ? ' (TY)' : ''} ${readyText}</li>`;
      } else {
          list.innerHTML += `<li style="color:${tColor}; margin-bottom:6px; font-size:16px;">[${p.className} | ${p.summonerSpell}] ${p.id.substring(0,4)}... ${isMe ? ' (TY)' : ''} ${readyText}</li>`;
      }
      
      if (p.team === 0) blueTaken.add(p.className);
      else redTaken.add(p.className);

      if (!p.ready) allReady = false;
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

  const startBtn = document.getElementById('startBtn');
  const readyBtn = document.getElementById('readyBtn');
  if (socket) {
      if (readyBtn) {
          readyBtn.style.borderColor = myReady ? '#0f0' : '#555';
          readyBtn.style.color = myReady ? '#0f0' : '#fff';
          readyBtn.textContent = myReady ? 'READY!' : 'READY';
      }
      if (startBtn) {
          if (playerCount === 0 || !allReady) {
              startBtn.disabled = true;
              startBtn.style.opacity = '0.3';
              startBtn.style.cursor = 'not-allowed';
              startBtn.textContent = 'WAITING FOR READY';
          } else {
              startBtn.disabled = false;
              startBtn.style.opacity = '1';
              startBtn.style.cursor = 'pointer';
              startBtn.textContent = 'START MATCH (Everyone)';
          }
      }
  }
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

  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const contentZoom = isMobile ? 'zoom: 0.5;' : '';

  overlay.innerHTML = `
    <div style="${contentZoom}">
        <div style="position: sticky; top: -20px; background: rgba(0,0,0,0.98); z-index: 10; margin: -20px -20px 15px -20px; padding: 20px; border-bottom: 2px solid #444;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
              <h2 style="color:#fff; margin:0;">SHOP</h2>
              <button id="closeShopX" style="background:transparent; color:#ff4e4e; border:none; font-size:32px; font-weight:bold; cursor:pointer; line-height:1; padding:0 10px;">&times;</button>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="shopUpBtn" style="flex:1; padding:12px; font-size:18px; font-weight:bold; background:#222; color:#fff; border:1px solid #555; cursor:pointer;">▲</button>
                <button id="shopDownBtn" style="flex:1; padding:12px; font-size:18px; font-weight:bold; background:#222; color:#fff; border:1px solid #555; cursor:pointer;">▼</button>
            </div>
        </div>
        <div id="shopList"></div>
        <button id="closeShopBtn" style="width:100%; padding:15px; margin-top:20px; background:#444; color:#fff; border:none; cursor:pointer; font-weight:bold; font-size:18px;">CLOSE SHOP</button>
    </div>
  `; 
  document.getElementById('closeShopBtn').onclick = closeShop; 
  document.getElementById('closeShopX').onclick = closeShop; 

  const upBtn = document.getElementById('shopUpBtn');
  const downBtn = document.getElementById('shopDownBtn');
  const doScrollUp = (e) => { if(e) e.preventDefault(); overlay.scrollBy({ top: -300, behavior: 'smooth' }); };
  const doScrollDown = (e) => { if(e) e.preventDefault(); overlay.scrollBy({ top: 300, behavior: 'smooth' }); };
  upBtn.onclick = doScrollUp; upBtn.ontouchstart = doScrollUp;
  downBtn.onclick = doScrollDown; downBtn.ontouchstart = doScrollDown;

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
          const btn = document.createElement('button'); btn.textContent='Buy'; btn.style.background='#222'; btn.style.color='#0f0'; btn.style.border='1px solid #0f0'; btn.style.padding='8px 12px'; btn.style.cursor='pointer'; btn.style.fontWeight='bold';
          btn.addEventListener('click', ()=> buyItem(it.id)); div.appendChild(btn); col.appendChild(div); 
      } list.appendChild(col); 
  } 
}

export function updateInventory(){ if(!player) return; const inv = document.getElementById('inventory'); inv.innerHTML = ''; for(const id of player.items){ const it = shopItems.find(s=>s.id===id); const slot = document.createElement('div'); slot.className='invSlot'; slot.textContent = it? it.name : id; inv.appendChild(slot); } }

export function drawBackground(ctx){ 
  if (!game.bgCanvas) {
      game.bgCanvas = document.createElement('canvas');
      game.bgCanvas.width = world.width; game.bgCanvas.height = world.height;
      let bgCtx = game.bgCanvas.getContext('2d');
      bgCtx.fillStyle = '#070707'; bgCtx.fillRect(0,0,world.width, world.height);

      let sb = smoothPolygon(mapBoundary, 3);
      let accumDist = 0; const spacing = 45; let boundVis = [];
      for(let i=0; i<sb.length; i++) { let p1 = sb[i], p2 = sb[(i+1)%sb.length]; let d = Math.hypot(p2.x-p1.x, p2.y-p1.y);
          while(accumDist <= d) {
              let bx = p1.x + (p2.x-p1.x)*(accumDist/d); let by = p1.y + (p2.y-p1.y)*(accumDist/d);
              boundVis.push({ x: bx, y: by, char: '#' });
              accumDist += spacing;
          }
          accumDist -= d;
      }

      bgCtx.fillStyle = 'rgba(255,255,255,0.2)'; bgCtx.font = '16px monospace'; bgCtx.textAlign='center'; bgCtx.textBaseline='middle';
      for(let p of boundVis) { bgCtx.fillText(p.char, p.x, p.y); }
      for(let sp of spawnPoints){
        bgCtx.fillStyle = 'rgba(255,255,255,0.2)'; bgCtx.font = '16px monospace';
        for(let a=0; a<Math.PI*2; a+=0.15) bgCtx.fillText('#', sp.x + Math.cos(a)*200, sp.y + Math.sin(a)*200);
      }

      bgCtx.font = '16px monospace'; const natureColors = ['#334d1e', '#426b27', '#528530', '#4d3d26', '#614f33', '#2a3b18'];
      for (let w of game.walls) {
        let startX = Math.floor((w.bbox.minX - w.r)/20)*20, endX = Math.ceil((w.bbox.maxX + w.r)/20)*20;
        let startY = Math.floor((w.bbox.minY - w.r)/20)*20, endY = Math.ceil((w.bbox.maxY + w.r)/20)*20;
        for (let wx = startX; wx <= endX; wx += 20) {
          for (let wy = startY; wy <= endY; wy += 20) {
            let info = distToPoly(wx, wy, w.pts);
            if (info.inside || info.minDist <= w.r) {
              bgCtx.fillStyle = natureColors[(Math.abs(wx * 7 + wy * 13)) % natureColors.length];
              if (!info.inside && info.minDist > w.r - 15) bgCtx.fillText('L', wx, wy); else bgCtx.fillText('#', wx, wy);
            }
          }
        }
      }
  }
  ctx.drawImage(game.bgCanvas, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.font = '14px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  if (game.towers && game.towers.length > 0) {
      for(let i=0; i<game.towers.length; i++){ let t1 = game.towers[i], t2 = game.towers[(i+1)%game.towers.length]; let d = dist(t1.pos, t2.pos);
          for(let step=0; step<d; step+=40) ctx.fillText(':', t1.pos.x + (t2.pos.x - t1.pos.x) * (step/d), t1.pos.y + (t2.pos.y - t1.pos.y) * (step/d));
      }
  }
}

export function draw(){ 
  const cw = canvas.clientWidth; const ch = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = '#000'; ctx.fillRect(0,0,cw,ch);
  ctx.setTransform(camera.scale*dpr,0,0,camera.scale*dpr, -camera.x*camera.scale*dpr, -camera.y*camera.scale*dpr);
  if (game.shake > 0) { const mag = game.shake * 20; ctx.translate((Math.random()-0.5)*mag, (Math.random()-0.5)*mag); }
  drawBackground(ctx);
  for(let h of game.heals) h.draw(ctx); if(game.powerup) game.powerup.draw(ctx);
  for(let t of game.towers) t.draw(ctx); for(let m of game.minions) m.draw(ctx); for(let p of game.projectiles) p.draw(ctx); for(let pl of game.players) pl.draw(ctx); for(let d of game.damageNumbers) d.draw(ctx); for(let pt of game.particles) pt.draw(ctx);
  
  ctx.setTransform(dpr,0,0,dpr,0,0); 
  
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
              rx = Math.random() * cw;
              ry = Math.random() > 0.5 ? Math.random() * 120 : ch - Math.random() * 120;
          } else {
              rx = Math.random() > 0.5 ? Math.random() * 120 : cw - Math.random() * 120;
              ry = Math.random() * ch;
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
  if(game.startDelay > 0 && game.started) { ctx.font = '40px monospace'; ctx.fillStyle = '#ffcc00'; ctx.textAlign='center'; ctx.fillText(`MATCH STARTS IN ${Math.ceil(game.startDelay)}`, cw/2, 100); }

  if (player && !player.alive) {
      ctx.save();
      const isMob = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      ctx.font = (isMob ? 'bold 24px' : 'bold 40px') + ' monospace'; 
      ctx.fillStyle = '#ff4e4e'; ctx.textAlign='center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
      ctx.fillText('RESPAWNING IN ' + Math.ceil(player.respawnTimer) + 's', cw/2, ch/2 - (isMob ? 30 : 50));
      ctx.restore();
  }

  if(game.started) {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // --- TOP LEFT CONTROLS ---
    if (!isMobile) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '12px monospace'; ctx.fillStyle = '#888';
        ctx.fillText('B - SHOP', 20, 20); ctx.fillText('C - CHAR. INFO', 20, 36); ctx.fillText('M - GENERAL INFO', 20, 52);
    }

    // --- TOP CENTER SCORE ---
    let tBlue = game.towers.filter(t=>t.owner===0).length; let tRed = game.towers.filter(t=>t.owner===1).length;
    let cxTop = cw / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; 
    ctx.font = isMobile ? 'bold 18px monospace' : 'bold 28px monospace';
    ctx.fillStyle = '#fff'; ctx.fillText(' : ', cxTop, 20);
    ctx.textAlign = 'right'; ctx.fillStyle = '#486FED'; ctx.fillText(Math.floor(game.nexus[0]), cxTop - 15, 20);
    ctx.textAlign = 'left'; ctx.fillStyle = '#FF4E4E'; ctx.fillText(Math.floor(game.nexus[1]), cxTop + 15, 20);
    
    ctx.font = isMobile ? 'bold 12px monospace' : 'bold 18px monospace'; 
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(' X ', cxTop, isMobile ? 40 : 55);
    ctx.textAlign = 'right'; ctx.fillStyle = '#486FED'; ctx.fillText(`(${tBlue})`, cxTop - 15, isMobile ? 40 : 55);
    ctx.textAlign = 'left'; ctx.fillStyle = '#FF4E4E'; ctx.fillText(`(${tRed})`, cxTop + 15, isMobile ? 40 : 55);

    if (game.isSpectator) {
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffcc00'; ctx.font = isMobile ? 'bold 14px monospace' : 'bold 20px monospace';
        ctx.fillText('SPECTATOR MODE - WASD TO MOVE CAMERA', cw / 2, isMobile ? 65 : 90);
    }

    // Kill Feed & Objectives
    if (game.killFeed && game.killFeed.length > 0) {
        let kfY = isMobile ? 65 : 85;
        ctx.font = isMobile ? 'bold 10px monospace' : 'bold 13px monospace';
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
            kfY += (isMobile ? 14 : 22);
        }
    }

    if(player) {
      if (!keys['tab']) {
          let allyBots = game.players.filter(p => p.team === player.team && p.id !== player.id); 
          let shiftY = isMobile ? 16 : 25;
          // Na mobilu je přesuneme doleva nahoru, na PC zůstávají vpravo
          let startY = isMobile ? 30 + allyBots.length * shiftY : ch - 330; 
          let startX = isMobile ? 20 : cw - 20;
          ctx.textAlign = isMobile ? 'left' : 'right'; ctx.font = isMobile ? '10px monospace' : '14px monospace'; 
          ctx.fillStyle = '#aaa'; ctx.fillText('TEAMMATES', startX, startY - allyBots.length * shiftY - 10);
          for(let i=0; i<allyBots.length; i++) {
              let bot = allyBots[i]; let y = startY - (allyBots.length - 1 - i) * shiftY;
              ctx.fillStyle = bot.alive ? '#fff' : '#666'; ctx.fillText(`${bot.className} LV${bot.level}`, isMobile ? startX : cw - 80, y);
              let maxBoxes = 5; let f = Math.max(0, Math.min(maxBoxes, Math.round((Math.max(0, bot.hp) / bot.maxHp) * maxBoxes) || 0));
              let bar = '[' + '|'.repeat(f) + ' '.repeat(maxBoxes - f) + ']'; ctx.fillStyle = bot.alive ? (bot.team === 0 ? '#486FED' : '#FF4E4E') : '#444'; ctx.fillText(bar, cw - 20, y); 
              if (isMobile) ctx.fillText(bar, startX + 90, y); else ctx.fillText(bar, cw - 20, y); 
          }
      }
      
      let anchorX = cw / 2; const anchorY = ch - (isMobile ? 25 : 65); 
      if (!isMobile && anchorX + 300 > cw - 320) anchorX = Math.max(300, cw - 620); // Responzivní uhnutí minimapě

      // Vykreslení target okna PŘED hlavním HUDem, nezávisle na jeho pozici a velikosti (doleva dolů)
      if (player.currentTarget && player.currentTarget.hp > 0 && !player.currentTarget.dead) {
          ctx.save();
          let tgtScale = isMobile ? 0.5 : 1.0; // Zvětšeno o cca 20 % (z 0.4 na 0.5)
          let txBase = isMobile ? 15 : cw / 2 - 140;
          let tyBase = isMobile ? (ch / 2) - 20 : ch - 250; // Posunuto přesně doprostřed na levý okraj
          
          ctx.translate(txBase, tyBase);
          ctx.scale(tgtScale, tgtScale);
          ctx.globalAlpha = isMobile ? 0.4 : 0.3; // 40% průhlednost okna targetu na mobilu, 30% na PC

          const t = player.currentTarget; const tw = 280, th = 85; const tx = 0, ty = 0;
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.strokeStyle = (t.team >= 0) ? TEAM_COLOR[t.team] : NEUTRAL_COLOR; ctx.lineWidth = 2; ctx.fillRect(tx, ty, tw, th); ctx.strokeRect(tx, ty, tw, th);
          
          ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; let tName = t.className || 'Minion'; ctx.fillText(`${tName} ${t.level ? 'LV'+t.level : ''}`, tx + 15, ty + 25);

          let fT = Math.max(0, Math.min(15, Math.round((Math.max(0,t.hp)/(t.effectiveMaxHp || t.maxHp)) * 15) || 0)); let hpBarStr = '[' + '#'.repeat(fT) + '-'.repeat(15 - fT) + ']';
          ctx.fillStyle = (t.team >= 0) ? TEAM_COLOR[t.team] : NEUTRAL_COLOR; ctx.font = 'bold 14px monospace'; ctx.fillText(hpBarStr, tx + 15, ty + 48);
          ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText(`${Math.floor(t.hp)}/${t.effectiveMaxHp || t.maxHp}`, tx + 15, ty + 68);
          
          if (t.AD !== undefined) { 
              ctx.fillStyle = '#aaa'; ctx.font = '11px monospace'; let stX = tx + 150;
              let buffAdMultT = 1.0 + (t.adAsBuffTimer > 0 ? t.adAsBuffAmount : 0);
              let buffAsMultT = 1.0 + (t.adAsBuffTimer > 0 ? t.adAsBuffAmount : 0);
              ctx.fillText(`AD:${Math.round(t.AD*(t.hasPowerup?1.2:1)*buffAdMultT)}`, stX, ty + 30);
              ctx.fillText(`AP:${Math.round(t.AP*(t.hasPowerup?1.2:1))}`, stX, ty + 55);
              ctx.fillText(`AR:${Math.round(t.armor*(t.hasPowerup?1.2:1))}`, stX + 45, ty + 30);
              ctx.fillText(`MR:${Math.round(t.mr*(t.hasPowerup?1.2:1))}`, stX + 45, ty + 55);
              ctx.fillText(`SP:${Math.round(t.speed*(t.hasPowerup?1.2:1))}`, stX + 90, ty + 30);
              ctx.fillText(`AS:${(t.attackDelay / (t.attackSpeed * buffAsMultT)).toFixed(2)}`, stX + 90, ty + 55); 
          }
          ctx.restore();
      }

      ctx.save();
      // Zmenšené měřítko středového HUDu pro mobily (na 60%)
      let uiScale = isMobile ? 0.60 : 1; 
      ctx.translate(anchorX, anchorY);
      ctx.scale(uiScale, uiScale);
      
      let cx = 0; const cy = 0; 

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
      const qKey = (game.autoTarget && !game.mouseTarget) ? 'J' : 'Q'; const eKey = (game.autoTarget && !game.mouseTarget) ? 'K' : 'E'; const sumKey = (game.autoTarget && !game.mouseTarget) ? 'L' : 'F';
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
      let buffAdMult = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
      let buffAsMult = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
      ctx.fillText(`AD:${Math.round(player.AD * (player.hasPowerup?1.2:1) * buffAdMult)}`, cx + 165, cy - 25);
      ctx.fillText(`AP:${Math.round(player.AP * (player.hasPowerup?1.2:1))}`, cx + 165, cy - 5);
      ctx.fillText(`AR:${Math.round(player.armor * (player.hasPowerup?1.2:1))}`, cx + 225, cy - 25);
      ctx.fillText(`MR:${Math.round(player.mr * (player.hasPowerup?1.2:1))}`, cx + 225, cy - 5);
      ctx.fillText(`HP:${player.effectiveMaxHp}`, cx + 225, cy + 15);
      ctx.fillText(`AS:${(player.attackDelay / (player.attackSpeed * buffAsMult)).toFixed(2)}`, cx + 285, cy - 25);
      ctx.fillText(`SP:${Math.round(player.speed * (player.hasPowerup?1.2:1))}`, cx + 285, cy - 5);
      ctx.fillText(`AH:${player.abilityHaste}`, cx + 285, cy + 15);
      
      ctx.restore();
    }
    if (keys['tab']) {
        let padX = Math.max(20, cw * 0.05);
        let padY = Math.max(20, ch * 0.05);
        let boxW = cw - padX * 2;
        let boxH = ch - padY * 2;
        
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(padX, padY, boxW, boxH);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(padX, padY, boxW, boxH);
        
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; 
        ctx.fillText('SCOREBOARD', cw/2, padY + 35); 
        
        let fSize = Math.max(10, Math.min(14, boxW / 65));
        ctx.font = `${fSize}px monospace`; 
        ctx.textAlign = 'left';
        
        let startY = padY + 70;
        let rowH = fSize + 6;
        
        ctx.fillStyle = '#486FED'; ctx.fillText('BLUE TEAM', padX + 20, startY);
        startY += rowH;
        
        let blueTeam = game.players.filter(p => p.team === 0); 
        for(let i=0; i<blueTeam.length; i++) { 
            let p = blueTeam[i]; let stat = p.alive ? 'ALIVE' : `DEAD(${Math.ceil(p.respawnTimer)}s)`; 
            ctx.fillStyle = (player && p.id === player.id) ? '#0f0' : '#486FED'; 
            let cStr = `${p.className} [${p.dmgType === 'magical' ? 'AP' : 'AD'}] (LV${p.level})`.padEnd(24, ' ');
            let sStr = stat.padEnd(10, ' '); let iStr = `Items: ${p.items.length}`.padEnd(9, ' '); let kStr = `K/D/A: ${p.kills}/${p.deaths}/${p.assists}`.padEnd(14, ' ');
            ctx.fillText(`${cStr} | ${sStr} | ${iStr} | ${kStr} | Gold: ${Math.floor(p.totalGold)}`, padX + 20, startY); 
            startY += rowH;
        }
        
        startY += rowH;
        
        ctx.fillStyle = '#FF4E4E'; ctx.fillText('RED TEAM', padX + 20, startY);
        startY += rowH;
        
        let redTeam = game.players.filter(p => p.team === 1);
        for(let i=0; i<redTeam.length; i++) { 
            let p = redTeam[i]; let stat = p.alive ? 'ALIVE' : `DEAD(${Math.ceil(p.respawnTimer)}s)`; 
            ctx.fillStyle = '#FF4E4E'; 
            let cStr = `${p.className} [${p.dmgType === 'magical' ? 'AP' : 'AD'}] (LV${p.level})`.padEnd(24, ' ');
            let sStr = stat.padEnd(10, ' '); let iStr = `Items: ${p.items.length}`.padEnd(9, ' '); let kStr = `K/D/A: ${p.kills}/${p.deaths}/${p.assists}`.padEnd(14, ' ');
            ctx.fillText(`${cStr} | ${sStr} | ${iStr} | ${kStr} | Gold: ${Math.floor(p.totalGold)}`, padX + 20, startY); 
            startY += rowH;
        }
    }
    
    if (keys['c'] && player) {
        ctx.save();
        let isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        // Pokud je obrazovka menší než 650px na výšku, okno se oddálí (zmenší se scale), aby se vešlo
        let uiScale = isMobile ? Math.min(1, ch / 650) : 1; 
        ctx.scale(uiScale, uiScale);
        let invScale = 1 / uiScale;

        let panelW = Math.max(400, (cw * 0.35) * invScale); 
        let panelH = ch * invScale;
        
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, panelW, panelH);
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, panelW, panelH);
        
        let leftM = 20; let startY = 30;
        ctx.fillStyle = '#fff'; ctx.font = `bold 20px monospace`; ctx.textAlign = 'left';
        ctx.fillText('CHARACTER INFO  ▲ ▼', leftM, startY); startY += 30;
        
        ctx.font = `13px monospace`;
        ctx.fillText(`Class: ${player.className}`, leftM, startY); startY += 18;
        ctx.fillText(`Level: ${player.level} (${Math.floor(player.exp)}/${expForLevel(player.level)} XP)`, leftM, startY); startY += 18;
        ctx.fillText(`HP: ${Math.floor(player.hp)} / ${player.effectiveMaxHp}`, leftM, startY); startY += 18;
        ctx.fillText(`Gold: ${Math.floor(player.gold)}`, leftM, startY); startY += 18;
        ctx.fillText(`Kills: ${player.kills} | Deaths: ${player.deaths} | Assists: ${player.assists}`, leftM, startY); startY += 30;
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`ATTRIBUTES`, leftM, startY); startY += 20;
        let buffAdMultP = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
        let buffAsMultP = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
        let adVal = Math.round(player.AD*(player.hasPowerup?1.2:1)*buffAdMultP);
        let apVal = Math.round(player.AP*(player.hasPowerup?1.2:1));
        let arVal = Math.round(player.armor*(player.hasPowerup?1.2:1));
        let mrVal = Math.round(player.mr*(player.hasPowerup?1.2:1));
        let asVal = (player.attackSpeed * buffAsMultP).toFixed(2);
        let msVal = Math.round(player.speed*(player.hasPowerup?1.2:1));
        let ahVal = player.abilityHaste;
        
        ctx.fillStyle = '#aaa';
        ctx.fillText(`AD:    ${String(adVal).padEnd(5, ' ')} | AP:    ${apVal}`, leftM, startY); startY += 18;
        ctx.fillText(`Armor: ${String(arVal).padEnd(5, ' ')} | MR:    ${mrVal}`, leftM, startY); startY += 18;
        ctx.fillText(`A.Spd: ${String(asVal).padEnd(5, ' ')} | Speed: ${msVal}`, leftM, startY); startY += 18;
        ctx.fillText(`Haste: ${String(ahVal).padEnd(5, ' ')} |`, leftM, startY); startY += 25;
        
        let baScale = AA_SCALES[player.className] || 0.3;
        let baDmg = Math.round(CLASSES[player.className].baseAtk + ((player.dmgType === 'magical' ? player.AP : player.AD) * baScale)); 
        ctx.fillStyle = '#fff'; ctx.fillText(`Basic Attack: Base ${CLASSES[player.className].baseAtk} + (${Math.round(baScale*100)}% ${player.dmgType === 'magical' ? 'AP' : 'AD'}) = ${baDmg} Dmg`, leftM, startY); startY += 35;
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`SPELLS`, leftM, startY); startY += 20;
        const q = player.spells.Q, e = player.spells.E;
        
        const wrapText = (text, x, y, maxWidth, lineHeight) => {
            let words = text.split(' '), line = '', drawY = y;
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                if(ctx.measureText(testLine).width > maxWidth && n > 0) {
                    ctx.fillText(line, x, drawY); line = words[n] + ' '; drawY += lineHeight;
                } else { line = testLine; }
            }
            ctx.fillText(line, x, drawY); return drawY;
        };

        const getSpellStatString = (sp, player) => {
            let bAdMult = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
            let pAD = player.AD * (player.hasPowerup ? 1.2 : 1.0) * (player.boostTimer > 0 ? 1.1 : 1.0) * bAdMult;
            let pAP = player.AP * (player.hasPowerup ? 1.2 : 1.0) * (player.boostTimer > 0 ? 1.1 : 1.0);
            let bDmg = sp.baseDamage || 0; let amt = sp.amount || 0; let scAD = sp.scaleAD || 0; let scAP = sp.scaleAP || 0; let lvl = sp.level || 1;
            
            if (sp.type === 'heal_self' || sp.type === 'heal_aoe') {
                let total = Math.round(amt + (pAP * scAP) + (pAD * scAD) + lvl * 10);
                return `    Heal: Base ${amt} + (${Math.round(scAD*100)}% AD) + (${Math.round(scAP*100)}% AP) = ${total} HP`;
            } else if (sp.type === 'shield_explode') {
                let shield = Math.round(amt + (pAP * scAP) + (pAD * scAD) + lvl * 20);
                let dmg = Math.round(bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8);
                return `    Shield: ${shield} | Explode Dmg: ${dmg}`;
            } else if (sp.type === 'buff_ad_as') {
                let sh = Math.round((sp.shieldAmount||0) + (pAD * 0.3) + lvl * 15);
                return `    Buff: +${Math.round((sp.amount||0)*100)}% AD/AS | Shield: ${sh}`;
            } else if (sp.type === 'buff_ms') {
                return `    Buff: +${Math.round((sp.amount||0)*100)}% Speed for ${sp.duration}s`;
            } else if (sp.type === 'summon') {
                let mHp = Math.round((bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8) * 3);
                let mAd = Math.round((bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8) * 0.8);
                return `    Summons: ${sp.count||1}x Ghoul (HP: ${mHp}, AD: ${mAd})`;
            } else if (sp.type === 'projectile_summon') {
                let dmg = Math.round(bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8);
                return `    Dmg: ${dmg} | Summons 1x (HP: ${sp.summonHp}, AD: ${sp.summonAd})`;
            } else if (sp.type === 'dash_heal_silence') {
                let heal = Math.round(amt + (pAP * scAP) + (pAD * scAD) + lvl * 10);
                let dmg = Math.round(bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8);
                return `    Dmg: ${dmg} | Heal: ${heal} | Silence: ${sp.silenceDuration}s`;
            } else if (sp.type === 'hana_q') {
                let regen = Math.round(5 + (pAP * 0.1) + lvl * 2);
                return `    Regen: ${regen} HP/s | Duration: ${sp.duration}s`;
            } else if (sp.type === 'dash_def') {
                let dmg = Math.round(bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8);
                return `    Dmg: ${dmg} | Def Buff 4s | Slow: ${sp.slowDuration}s`;
            } else if (sp.type === 'aoe_knockback') {
                let dmg = Math.round(bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8);
                return `    Dmg: ${dmg} | Knockback enemies`;
            } else {
                let total = Math.round(bDmg + (pAP * scAP) + (pAD * scAD) + lvl * 8);
                return `    Dmg: Base ${bDmg} + (${Math.round(scAD*100)}% AD) + (${Math.round(scAP*100)}% AP) = ${total}`;
            }
        };

        ctx.fillStyle = '#fff'; ctx.fillText(`[Q] Level ${q.level} - Cooldown: ${player.computeSpellCooldown('Q').toFixed(1)}s`, leftM, startY); startY += 18;
        ctx.fillStyle = '#aaa'; startY = wrapText(`    ${q.desc}`, leftM, startY, panelW - 40, 16) + 16;
        ctx.fillStyle = '#fff'; ctx.fillText(getSpellStatString(q, player), leftM, startY); startY += 28;
        
        ctx.fillText(`[E] Level ${e.level} - Cooldown: ${player.computeSpellCooldown('E').toFixed(1)}s`, leftM, startY); startY += 18;
        ctx.fillStyle = '#aaa'; startY = wrapText(`    ${e.desc}`, leftM, startY, panelW - 40, 16) + 16;
        ctx.fillStyle = '#fff'; ctx.fillText(getSpellStatString(e, player), leftM, startY); startY += 28;

        ctx.fillStyle = '#ffcc00'; ctx.fillText(`SUMMONER SPELL`, leftM, startY); startY += 20;
        let sumSpell = SUMMONER_SPELLS[player.summonerSpell];
        ctx.fillStyle = '#fff'; ctx.fillText(`[F / L] ${player.summonerSpell} - Cooldown: ${sumSpell.cd}s`, leftM, startY); startY += 18;
        ctx.fillStyle = '#aaa'; startY = wrapText(`    ${sumSpell.desc}`, leftM, startY, panelW - 40, 16) + 16;

        ctx.restore();
    }

    if (keys['m']) {
        ctx.save();
        let isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        let uiScale = isMobile ? Math.min(1, ch / 500) : 1;
        ctx.scale(uiScale, uiScale);
        let invScale = 1 / uiScale;

        let panelW = Math.max(350, (cw * 0.30) * invScale);
        let panelH = ch * invScale;

        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, panelW, panelH);
        ctx.strokeStyle = '#486FED'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, panelW, panelH);
        
        let leftM = 20; let startY = 30;
        ctx.fillStyle = '#fff'; ctx.font = `bold 20px monospace`; ctx.textAlign = 'left';
        ctx.fillText('GENERAL INFO', leftM, startY); startY += 35;
        
        ctx.font = `13px monospace`;
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`CONTROLS`, leftM, startY); startY += 25;
        
        ctx.fillStyle = '#fff';
        ctx.fillText(`[W,A,S,D]     : Move`, leftM, startY); startY += 20;
        ctx.fillText(`[ARROWS]      : Manual Aim`, leftM, startY); startY += 20;
        ctx.fillText(`[SPACE]       : Basic Attack`, leftM, startY); startY += 20;
        ctx.fillText(`[Q] / [E]     : Cast Spells`, leftM, startY); startY += 20;
        ctx.fillText(`[F] / [L]     : Summoner Spell`, leftM, startY); startY += 20;
        ctx.fillText(`[SHIFT + Q/E] : Level Up Spell`, leftM, startY); startY += 20;
        ctx.fillText(`[B] : Shop | [TAB] : Scoreboard`, leftM, startY); startY += 35;
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`DEBUG & SETTINGS`, leftM, startY); startY += 25;
        ctx.fillStyle = '#aaa';
        ctx.fillText(`[SHIFT + U]   : Toggle Auto-Target Aim`, leftM, startY); startY += 20;
        ctx.fillText(`[SHIFT + I]   : Toggle Auto-Play (Bot)`, leftM, startY); startY += 20;
        ctx.fillText(`[SHIFT + O]   : Toggle Mouse Target`, leftM, startY); startY += 20;

        ctx.restore();
    }
    
    if (isMobile && player) {
        const mobQ = document.getElementById('mobBtnQ');
        const mobE = document.getElementById('mobBtnE');
        const mobS = document.getElementById('mobBtnS');
        const mobLvlQ = document.getElementById('mobLvlQ');
        const mobLvlE = document.getElementById('mobLvlE');
        const mobAuto = document.getElementById('mobBtnAuto');
        
        if (mobLvlQ && mobLvlE) {
            const showLvl = player.spellPoints > 0 ? 'flex' : 'none';
            if (mobLvlQ.style.display !== showLvl) {
                mobLvlQ.style.display = showLvl;
                mobLvlE.style.display = showLvl;
            }
        }
        
        if (mobQ) {
            let cd = player.spells.Q.cd;
            let txt = cd > 0 ? cd.toFixed(1) : 'Q';
            if (mobQ.textContent !== txt) { mobQ.textContent = txt; mobQ.style.color = cd > 0 ? '#ff4e4e' : 'rgba(255,255,255,0.8)'; }
        }
        if (mobE) {
            let cd = player.spells.E.cd;
            let txt = cd > 0 ? cd.toFixed(1) : 'E';
            if (mobE.textContent !== txt) { mobE.textContent = txt; mobE.style.color = cd > 0 ? '#ff4e4e' : 'rgba(255,255,255,0.8)'; }
        }
        if (mobS) {
            let cd = player.summonerCooldown;
            let txt = cd > 0 ? cd.toFixed(1) : 'S';
            if (mobS.textContent !== txt) { mobS.textContent = txt; mobS.style.color = cd > 0 ? '#ff4e4e' : 'rgba(255,255,255,0.8)'; }
        }
        if (mobAuto) {
            let aTxt = 'AUTO', aCol = 'rgba(255,255,255,0.8)';
            if (game.autoPlay && game.autoBuy) { aTxt = 'FULL'; aCol = '#0f0'; }
            else if (game.autoPlay) { aTxt = 'FIGHT'; aCol = '#ffcc00'; }
            if (mobAuto.textContent !== aTxt) { mobAuto.textContent = aTxt; mobAuto.style.color = aCol; }
        }
    }
  }
}

export function drawMinimap(){ 
  const mm = document.getElementById('minimap'); const w = mm.clientWidth, h = mm.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  let c = mm.querySelector('canvas');
  if (!c) { c = document.createElement('canvas'); mm.appendChild(c); }
  if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
      mm._ctx = c.getContext('2d'); mm._ctx.scale(dpr, dpr);
  }
  const ctxm = mm._ctx;
  ctxm.clearRect(0,0,w,h);
  const scaleX = w / world.width; const scaleY = h / world.height; 
  ctxm.save(); ctxm.beginPath(); ctxm.arc(w/2, h/2, w/2, 0, Math.PI*2); ctxm.clip();
  ctxm.fillStyle='#111'; ctxm.fillRect(0,0,w,h);
  
  if (!game.minimapBg) {
      game.minimapBg = document.createElement('canvas');
      game.minimapBg.width = Math.floor(w * dpr); game.minimapBg.height = Math.floor(h * dpr);
      let bgCtx = game.minimapBg.getContext('2d');
      bgCtx.scale(dpr, dpr);
      bgCtx.fillStyle='#111'; bgCtx.fillRect(0,0,w,h);
      bgCtx.beginPath(); bgCtx.moveTo(mapBoundary[0].x * scaleX, mapBoundary[0].y * scaleY); for(let i=1; i<mapBoundary.length; i++) bgCtx.lineTo(mapBoundary[i].x * scaleX, mapBoundary[i].y * scaleY); bgCtx.closePath(); bgCtx.strokeStyle = '#555'; bgCtx.stroke();
      bgCtx.fillStyle = '#555'; bgCtx.font = '10px monospace'; bgCtx.textAlign='center'; bgCtx.textBaseline='middle';
      
      const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const mmSpacing = isMobile ? 90 : 66;

      for(let wObj of game.walls) {
          let startX = Math.floor((wObj.bbox.minX - wObj.r)/mmSpacing)*mmSpacing, endX = Math.ceil((wObj.bbox.maxX + wObj.r)/mmSpacing)*mmSpacing;
          let startY = Math.floor((wObj.bbox.minY - wObj.r)/mmSpacing)*mmSpacing, endY = Math.ceil((wObj.bbox.maxY + wObj.r)/mmSpacing)*mmSpacing;
          for (let wx = startX; wx <= endX; wx += mmSpacing) {
              for (let wy = startY; wy <= endY; wy += mmSpacing) {
                  let info = distToPoly(wx, wy, wObj.pts);
                  if (info.inside || info.minDist <= wObj.r) { bgCtx.fillText('#', wx * scaleX, wy * scaleY); }
              }
          }
      }
  }
  ctxm.drawImage(game.minimapBg, 0, 0, w, h);
  for(let t of game.towers){ const x = t.pos.x * scaleX; const y = t.pos.y * scaleY; ctxm.fillStyle = t.owner===0? '#486FED' : t.owner===1? '#FF4E4E' : '#777'; ctxm.fillRect(x-3,y-3,6,6); }
  for(let m of game.minions){ const x = m.pos.x * scaleX; const y = m.pos.y * scaleY; ctxm.fillStyle = m.team===0? '#aaddff':'#ffb3b3'; ctxm.fillRect(x-1,y-1,2,2); }
  
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
          
          let scrollBtns = document.createElement('div');
          scrollBtns.id = 'endScrollBtns';
          scrollBtns.style.display = 'flex'; scrollBtns.style.gap = '10px'; scrollBtns.style.marginTop = '10px'; scrollBtns.style.marginBottom = '10px';
          scrollBtns.innerHTML = `
                  <button id="endUpBtn" style="flex:1; padding:12px; font-size:18px; font-weight:bold; background:#222; color:#fff; border:1px solid #555; cursor:pointer;">▲</button>
                  <button id="endDownBtn" style="flex:1; padding:12px; font-size:18px; font-weight:bold; background:#222; color:#fff; border:1px solid #555; cursor:pointer;">▼</button>
          `;

          let restartBtn = document.getElementById('restartBtn'); 
          if (restartBtn && restartBtn.parentNode) {
              restartBtn.parentNode.insertBefore(statsDiv, restartBtn); 
              restartBtn.parentNode.insertBefore(scrollBtns, restartBtn);
          } else {
              let target = overlay.querySelector('div') ? overlay.querySelector('div') : overlay;
              target.appendChild(statsDiv);
              target.appendChild(scrollBtns);
          }

          setTimeout(() => {
              const doScrollUp = (e) => { if(e) e.preventDefault(); statsDiv.scrollBy({ top: -150, behavior: 'smooth' }); };
              const doScrollDown = (e) => { if(e) e.preventDefault(); statsDiv.scrollBy({ top: 150, behavior: 'smooth' }); };
              let upB = document.getElementById('endUpBtn'); let downB = document.getElementById('endDownBtn');
              if (upB) { upB.onclick = doScrollUp; upB.ontouchstart = doScrollUp; }
              if (downB) { downB.onclick = doScrollDown; downB.ontouchstart = doScrollDown; }
          }, 50);
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
  m.style.position = 'fixed'; m.style.top = '0'; m.style.left = '0'; m.style.width = '100%'; m.style.height = '100%'; m.style.zIndex = '9999'; m.style.display = 'block'; m.style.background = 'rgba(0,0,0,0.85)'; m.style.overflowY = 'auto'; m.style.padding = '5vh 0 25vh 0'; m.style.boxSizing = 'border-box';
  let selectedClass = 'Bruiser'; let selectedTeam = 0; let selectedSpell = 'Heal'; let isSpectator = false;
  m.innerHTML = `
      <div id="roomBrowser" style="zoom: 0.85; margin: 0 auto; background:#111; padding:2vw; border:1px solid #444; border-radius: 8px; color:#fff; text-align:center; width: 90vw; max-width: 600px; box-sizing:border-box; display: ${socket ? 'block' : 'none'};">
          <h1 style="margin-top:0;">UTF Arena - BROWSE GAMES</h1>
          <div style="margin-bottom: 20px; display:flex; gap:10px; justify-content:center;">
              <input type="text" id="newRoomInput" placeholder="Enter Room Name..." style="padding:10px; font-size:16px; background:#000; color:#fff; border:1px solid #444; width: 60%;">
              <button id="createRoomBtn" style="padding:10px 20px; font-size:16px; font-weight:bold; cursor:pointer; background:#222; color:#0f0; border:2px solid #0f0;">CREATE ROOM</button>
          </div>
          <div id="roomListContainer" style="text-align:left; background:#000; padding:15px; border:1px solid #333; border-radius:4px; min-height: 200px; max-height: 300px; overflow-y:auto;">
              <h3 style="margin-top:0; color:#aaa; border-bottom:1px solid #444; padding-bottom:10px;">Active Rooms:</h3>
              <ul id="roomList" style="list-style:none; padding:0; margin:0; font-family:monospace; font-size:16px;">
                  <li>Loading rooms...</li>
              </ul>
          </div>
      </div>
    <div id="roomLobby" style="zoom: 0.85; margin: 0 auto; display: ${socket ? 'none' : 'block'}; background:#111; padding:2vw; border:1px solid #444; border-radius: 8px; color:#fff; text-align:center; width: 95vw; max-width: 1000px; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #333; padding-bottom: 15px; margin-bottom: 15px;">
          <div style="display:flex; align-items:center; gap: 15px;">
              <h1 id="lobbyTitle" style="margin:0;">OFFLINE MODE</h1>
              <span style="color:#aaa; font-size:24px;">
                  <span id="lobbyUpBtn" style="cursor:pointer; padding:0 10px;">▲</span>
                  <span id="lobbyDownBtn" style="cursor:pointer; padding:0 10px;">▼</span>
              </span>
          </div>
          <button id="leaveRoomBtn" style="display: ${socket ? 'block' : 'none'}; padding:8px 16px; cursor:pointer; background:#300; color:#ff6b6b; border:1px solid #ff6b6b; font-weight:bold; border-radius:4px;">LEAVE ROOM</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; justify-content: space-between; margin-top: 10px; gap: 10px;">
        <div style="flex: 1 1 60%; min-width:300px; text-align: left;">
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
        <div style="flex: 1 1 30%; min-width:200px; text-align: left; background:#000; padding: 15px; border:1px solid #333; border-radius: 4px; box-sizing:border-box;">
          <h3 style="margin-top:0; color:#aaa; border-bottom:1px solid #444; padding-bottom:10px;">Players in Room:</h3>
          <ul id="lobbyList" style="list-style: none; padding: 0; margin: 0; font-family: monospace;"><li>Offline or Connecting...</li></ul>
        </div>
      </div>
      <div style="display:flex; gap:10px; margin-top:25px; padding-bottom:20px;">
         <button id="readyBtn" style="display: ${socket ? 'block' : 'none'}; padding:15px 24px; flex-grow:1; font-size:18px; font-weight:bold; cursor:pointer; background:#222; color:#fff; border:2px solid #555;">READY</button>
         <button id="startBtn" style="padding:15px 24px; flex-grow:1; width: 100%; font-size:18px; font-weight:bold; cursor:pointer; background:#222; color:#0f0; border:2px solid #0f0;">START MATCH</button>
      </div>
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

  const readyBtn = document.getElementById('readyBtn');
  let myReady = false;
  if (readyBtn) {
      readyBtn.onclick = () => {
          if (socket) {
              myReady = !myReady;
              socket.emit('toggle_ready', myReady);
          }
      };
  }

  const btnBlue = document.getElementById('btnBlue'), btnRed = document.getElementById('btnRed'), btnSpec = document.getElementById('btnSpec');
  const teamBtns = [btnBlue, btnRed, btnSpec];
  const selectionDivs = [document.getElementById('classBtns'), document.getElementById('spellBtns')];
  const startBtn = document.getElementById('startBtn');

  btnBlue.onclick = (e) => { selectedTeam = 0; isSpectator = false; teamBtns.forEach(b=>b.style.borderColor='#444'); e.target.style.borderColor='#486FED'; selectionDivs.forEach(d=>d.style.opacity=1); if(!socket){ startBtn.disabled = false; startBtn.style.opacity = 1; } notifyServer(); };
  btnRed.onclick = (e) => { selectedTeam = 1; isSpectator = false; teamBtns.forEach(b=>b.style.borderColor='#444'); e.target.style.borderColor='#FF4E4E'; selectionDivs.forEach(d=>d.style.opacity=1); if(!socket){ startBtn.disabled = false; startBtn.style.opacity = 1; } notifyServer(); };
  btnSpec.onclick = (e) => { selectedTeam = -1; isSpectator = true; teamBtns.forEach(b=>b.style.borderColor='#444'); e.target.style.borderColor='#aaa'; selectionDivs.forEach(d=>d.style.opacity=0.3); if(!socket){ startBtn.disabled = false; startBtn.style.opacity = 1; } notifyServer(); };

  const cBtns = document.getElementById('classBtns');
  const catGroups = { 
      'FIGHTER': ['Bruiser', 'Vanguard', 'Jirina'], 
      'TANK': ['Tank', 'Goliath', 'Hana'], 
      'ASSASSIN': ['Assassin', 'Zephyr', 'Reaper'],
      'RANGED': ['Marksman', 'Kratoma'],
      'MAGE': ['Mage', 'Summoner'], 
      'SUPPORT': ['Healer', 'Acolyte', 'Keeper'] 
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
  startBtn.addEventListener('click', () => { requestLandscapeFullscreen(); if(socket) socket.emit('start_game'); else { m.style.display = 'none'; startGame(selectedClass, selectedTeam, isSpectator); } });

  const lobbyUpBtn = document.getElementById('lobbyUpBtn');
  const lobbyDownBtn = document.getElementById('lobbyDownBtn');
  if (lobbyUpBtn) {
      const doScrollUp = (e) => { if(e) e.preventDefault(); m.scrollBy({ top: -250, behavior: 'smooth' }); };
      lobbyUpBtn.onclick = doScrollUp; lobbyUpBtn.ontouchstart = doScrollUp;
  }
  if (lobbyDownBtn) {
      const doScrollDown = (e) => { if(e) e.preventDefault(); m.scrollBy({ top: 250, behavior: 'smooth' }); };
      lobbyDownBtn.onclick = doScrollDown; lobbyDownBtn.ontouchstart = doScrollDown;
  }
}

export function updateSpellLabels() {}

const restartBtn = document.getElementById('restartBtn'); if(restartBtn) restartBtn.addEventListener('click', ()=>{ location.reload(); });
const closeShopBtn = document.getElementById('closeShop'); if(closeShopBtn) closeShopBtn.addEventListener('click', ()=> closeShop());

export function initMobileUI() {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    // Oddálení kamery na mobilu o 20% (z původních 1.0 na 0.8)
    camera.scale = 0.8;

    // Natvrdo zarovnáme minimapu pomocí JS pro případ, že CSS Media Queries na mobilech selžou
    const mm = document.getElementById('minimap');
    if (mm) {
        mm.style.position = 'fixed';
        mm.style.right = '2vw';
        mm.style.bottom = '2vh';
        mm.style.top = 'auto';
        mm.style.left = 'auto';
        mm.style.margin = '0';
        mm.style.transform = 'none';
        mm.style.width = '30vh';
        mm.style.height = '30vh';
        mm.style.zIndex = '4000';
        
        // PŘIDÁNO: Minimapa na mobilu funguje jako obří tlačítko pro Auto Attack!
        mm.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            mm.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
            window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        }, {passive: false});
        mm.addEventListener('touchend', (e) => { 
            e.preventDefault(); 
            mm.style.boxShadow = '0 0 10px rgba(0,0,0,0.8)';
            window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        }, {passive: false});
        mm.addEventListener('touchcancel', (e) => { 
            e.preventDefault(); 
            mm.style.boxShadow = '0 0 10px rgba(0,0,0,0.8)';
            window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        }, {passive: false});
    }
    
    const mc = document.createElement('div');
    mc.id = 'mobileControls';
    mc.style.position = 'fixed'; mc.style.top = '0'; mc.style.left = '0'; mc.style.width = '100%'; mc.style.height = '100%';
    mc.style.pointerEvents = 'none'; mc.style.zIndex = '5000'; mc.style.display = 'none';
    
    // DYNAMIC D-PAD ZONE (Levá polovina obrazovky)
    const dpadZone = document.createElement('div');
    dpadZone.style.position = 'absolute'; dpadZone.style.left = '0'; dpadZone.style.top = '0';
    dpadZone.style.width = '50vw'; dpadZone.style.height = '100vh'; 
    dpadZone.style.pointerEvents = 'auto';

    const dpadVisual = document.createElement('div');
    dpadVisual.style.position = 'absolute'; dpadVisual.style.width = '16vh'; dpadVisual.style.height = '16vh';
    dpadVisual.style.background = 'rgba(255,255,255,0.15)'; dpadVisual.style.borderRadius = '50%';
    dpadVisual.style.transform = 'translate(-50%, -50%)'; dpadVisual.style.display = 'none'; dpadVisual.style.pointerEvents = 'none';

    const dpadKnob = document.createElement('div');
    dpadKnob.style.position = 'absolute'; dpadKnob.style.width = '6vh'; dpadKnob.style.height = '6vh';
    dpadKnob.style.background = 'rgba(255,255,255,0.5)'; dpadKnob.style.borderRadius = '50%';
    dpadKnob.style.transform = 'translate(-50%, -50%)'; dpadKnob.style.left = '50%'; dpadKnob.style.top = '50%';
    dpadVisual.appendChild(dpadKnob); dpadZone.appendChild(dpadVisual);
    
    const triggerKey = (keyStr, shift = false) => { 
        if (shift) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: keyStr, shiftKey: shift, bubbles: true })); 
    };
    const releaseKey = (keyStr, shift = false) => { 
        window.dispatchEvent(new KeyboardEvent('keyup', { key: keyStr, shiftKey: shift, bubbles: true })); 
        if (shift) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    };
    
    const createBtn = (keyStr, label, shift = false, size = '15vh', fontSize = '5vh') => {
        const b = document.createElement('div');
        b.style.width = size; b.style.height = size; b.style.background = 'rgba(255,255,255,0.15)';
        b.style.borderRadius = '50%'; b.style.display = 'flex'; b.style.justifyContent = 'center'; b.style.alignItems = 'center';
        b.style.color = 'rgba(255,255,255,0.8)'; b.style.fontSize = fontSize; b.style.fontWeight = 'bold'; b.style.fontFamily = 'monospace';
        b.style.position = 'absolute'; b.style.pointerEvents = 'auto';
        b.textContent = label;
        b.addEventListener('touchstart', (e) => { e.preventDefault(); b.style.background = 'rgba(255,255,255,0.4)'; triggerKey(keyStr, shift); }, {passive:false});
        b.addEventListener('touchend', (e) => { e.preventDefault(); b.style.background = 'rgba(255,255,255,0.15)'; releaseKey(keyStr, shift); }, {passive:false});
        return b;
    };
    
    // TLAČÍTKA KOUZEL (Diagonálně nad minimapou vpravo)
    const btnQ = createBtn('j', 'Q'); btnQ.id = 'mobBtnQ'; btnQ.style.right = '35vh'; btnQ.style.bottom = '32vh';
    const btnE = createBtn('k', 'E'); btnE.id = 'mobBtnE'; btnE.style.right = '18vh'; btnE.style.bottom = '46vh';
    const btnS = createBtn('l', 'S'); btnS.id = 'mobBtnS'; btnS.style.right = '2vw'; btnS.style.bottom = '60vh';
    
    // DYNAMICKÁ TLAČÍTKA PRO LEVELOVÁNÍ (Vyskakují nad Q a E)
    const createLvlBtn = (spKey, right, bottom) => {
        const b = document.createElement('div');
        b.style.width = '6vh'; b.style.height = '6vh'; b.style.background = 'rgba(255,204,0,0.3)';
        b.style.border = '2px solid #ffcc00'; b.style.borderRadius = '50%'; 
        b.style.display = 'none'; // Ve výchozím stavu schované
        b.style.justifyContent = 'center'; b.style.alignItems = 'center';
        b.style.color = '#ffcc00'; b.style.fontSize = '4vh'; b.style.fontWeight = 'bold'; b.style.fontFamily = 'monospace';
        b.style.position = 'absolute'; b.style.pointerEvents = 'auto';
        b.style.right = right; b.style.bottom = bottom; b.textContent = '+';
        b.addEventListener('touchstart', (e) => { e.preventDefault(); b.style.background = 'rgba(255,204,0,0.6)'; if (player) player.allocateSpellPoint(spKey); }, {passive:false});
        b.addEventListener('touchend', (e) => { e.preventDefault(); b.style.background = 'rgba(255,204,0,0.3)'; }, {passive:false});
        return b;
    };
    const btnLvlQ = createLvlBtn('Q', '39.5vh', '49vh'); btnLvlQ.id = 'mobLvlQ';
    const btnLvlE = createLvlBtn('E', '22.5vh', '63vh'); btnLvlE.id = 'mobLvlE';

    // TLAČÍTKA -> PŘESUNUTO VLEVO DOLŮ HORIZONTÁLNĚ
    const sideBtns = document.createElement('div');
    sideBtns.style.position = 'absolute'; sideBtns.style.left = '2vw'; sideBtns.style.right = 'auto';
    sideBtns.style.bottom = '2vh'; sideBtns.style.top = 'auto';
    sideBtns.style.display = 'flex'; sideBtns.style.flexDirection = 'row'; sideBtns.style.gap = '10px'; sideBtns.style.pointerEvents = 'auto';

    sideBtns.appendChild(createBtn('b', 'SHOP', false, '8vh', '2vh'));
    sideBtns.appendChild(createBtn('c', 'INFO', false, '8vh', '2vh'));
    const btnAuto = createBtn('i', 'AUTO', true, '8vh', '2vh');
    btnAuto.id = 'mobBtnAuto';
    sideBtns.appendChild(btnAuto); // Shift+I zapíná/vypíná autoplay
    sideBtns.appendChild(createBtn('tab', 'TAB', false, '8vh', '2vh'));
    Array.from(sideBtns.children).forEach(b => b.style.position = 'relative'); // Vracíme na relative kvůli flex layoutu
    
    mc.appendChild(dpadZone); mc.appendChild(btnLvlQ); mc.appendChild(btnLvlE); mc.appendChild(btnQ); mc.appendChild(btnE); mc.appendChild(btnS); mc.appendChild(sideBtns); document.body.appendChild(mc);

    let activeDirs = { w:false, a:false, s:false, d:false };
    const updateDirs = (nw, na, ns, nd) => {
        if(nw !== activeDirs.w) { window.dispatchEvent(new KeyboardEvent(nw?'keydown':'keyup', {key:'w', bubbles:true})); activeDirs.w = nw; }
        if(na !== activeDirs.a) { window.dispatchEvent(new KeyboardEvent(na?'keydown':'keyup', {key:'a', bubbles:true})); activeDirs.a = na; }
        if(ns !== activeDirs.s) { window.dispatchEvent(new KeyboardEvent(ns?'keydown':'keyup', {key:'s', bubbles:true})); activeDirs.s = ns; }
        if(nd !== activeDirs.d) { window.dispatchEvent(new KeyboardEvent(nd?'keydown':'keyup', {key:'d', bubbles:true})); activeDirs.d = nd; }
    };

    let dpadTouchId = null;
    let dpadStartX = 0, dpadStartY = 0;

    dpadZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (dpadTouchId !== null) return;
        const t = e.changedTouches[0]; dpadTouchId = t.identifier;
        const rect = dpadZone.getBoundingClientRect();
        dpadStartX = t.clientX - rect.left; dpadStartY = t.clientY - rect.top;
        dpadVisual.style.display = 'block'; dpadVisual.style.left = dpadStartX + 'px'; dpadVisual.style.top = dpadStartY + 'px';
        dpadKnob.style.left = '50%'; dpadKnob.style.top = '50%';
        updateDirs(false, false, false, false);
    }, {passive:false});

    dpadZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (dpadTouchId === null) return;
        let t = null; for(let i=0; i<e.changedTouches.length; i++) if(e.changedTouches[i].identifier === dpadTouchId) t = e.changedTouches[i];
        if(!t) return;
        const rect = dpadZone.getBoundingClientRect();
        const curX = t.clientX - rect.left, curY = t.clientY - rect.top;
        const dx = curX - dpadStartX, dy = curY - dpadStartY; const dist = Math.hypot(dx, dy);
        const maxDist = window.innerHeight * 0.08; // Max posun kloboučku (cca 8vh)
        let kx = dx, ky = dy; if (dist > maxDist) { kx = (dx/dist)*maxDist; ky = (dy/dist)*maxDist; }
        dpadKnob.style.left = `calc(50% + ${kx}px)`; dpadKnob.style.top = `calc(50% + ${ky}px)`;
        
        let nw=false, na=false, ns=false, nd=false;
        if (dist > maxDist * 0.2) { let angle = Math.atan2(dy, dx); if (angle > -Math.PI*0.875 && angle < -Math.PI*0.125) nw = true; if (angle > Math.PI*0.125 && angle < Math.PI*0.875) ns = true; if (Math.abs(angle) > Math.PI*0.625) na = true; if (Math.abs(angle) < Math.PI*0.375) nd = true; }
        updateDirs(nw, na, ns, nd);
    }, {passive:false});

    dpadZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        let found = false; for(let i=0; i<e.changedTouches.length; i++) if(e.changedTouches[i].identifier === dpadTouchId) found = true;
        if(!found) return;
        dpadTouchId = null; dpadVisual.style.display = 'none'; updateDirs(false, false, false, false);
    }, {passive:false});
    dpadZone.addEventListener('touchcancel', (e) => { dpadTouchId = null; dpadVisual.style.display = 'none'; updateDirs(false, false, false, false); }, {passive:false});
}
initMobileUI();