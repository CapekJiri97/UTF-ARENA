import { dist, distToPoly, smoothPolygon, expForLevel } from './Utils.js';
import { shopItems, canBuyShopItem, getShopItem, getBuyBlockReason, calcTotalCost } from './items.js';
import { CLASSES, SUMMONER_SPELLS } from './classes.js';
import { game, camera, TEAM_COLOR, NEUTRAL_COLOR } from './State.js';
import { world, spawnPoints, mapBoundary } from './MapConfig.js';
import { canvas, ctx, keys, player, socket, startGame, buyItem, drawHealthBar } from './main.js';

const computeDominionPCS = (p) => {
    if (!p) return { total: 0, breakdown: {} };

    const breakdown = {
        
        kills: (p.kills || 0) * 120,
        assists: (p.assists || 0) * 75,
        deaths: -(p.deaths || 0) * 180,
        dmgDealt: (p.stats?.dmgDealt || 0) * 0.02,
        hpHealed: (p.stats?.hpHealed || 0) * 0.05,
        towerCaptures: (p.towerCaptures || 0) * 1400,
        towerDefends: (p.towerDefends || 0) * 60,
        towerAssaultTime: (p.towerAssaultTime || 0) * 16,
        objectivePresenceTime: (p.objectivePresenceTime || 0) * 6,
        powerupsCollected: (p.powerupsCollected || 0) * 300,
        powerupUptime: (p.powerupUptime || 0) * 4
    };

    const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return { total: Math.max(0, Math.round(total)), breakdown };
};

const getTeamDominionSummary = (teamId) => {
    const members = game.players.filter(p => p.team === teamId && p.className);
    const count = members.length;
    if (count === 0) {
        return { count: 0, avgLevel: 0, avgGold: 0, avgPCS: 0 };
    }

    const totalLevel = members.reduce((sum, p) => sum + (p.level || 1), 0);
    const totalGold = members.reduce((sum, p) => sum + (p.totalGold || p.gold || 0), 0);
    const totalPCS = members.reduce((sum, p) => sum + computeDominionPCS(p).total, 0);

    return {
        count,
        avgLevel: totalLevel / count,
        avgGold: totalGold / count,
        avgPCS: totalPCS / count
    };
};

const SHOP_TREE_CONFIGS = {
    ad: {
        title: 'ATTACK DAMAGE TREE',
        note: 'Green links show the next item in the branch is currently buyable.',
        columns: 3,
        nodes: [
            { id: 'ad',      col: 2, row: 1 },
            { id: 'ad_ls',   col: 1, row: 2 },
            { id: 'ad_slow', col: 2, row: 2 },
            { id: 'ad_pen',  col: 3, row: 2 },
            { id: 'ad_ls2',  col: 1, row: 3 },
            { id: 'slow',    col: 2, row: 3 },
            { id: 'ad_pen2', col: 3, row: 3 }
        ],
        links: [
            ['ad', 'ad_ls'], ['ad', 'ad_slow'], ['ad', 'ad_pen'],
            ['ad_ls', 'ad_ls2'], ['ad_slow', 'slow'], ['ad_pen', 'ad_pen2']
        ]
    },
    ap: {
        title: 'ABILITY POWER TREE',
        note: 'Green links show the next item in the branch is currently buyable.',
        columns: 3,
        nodes: [
            { id: 'ap',      col: 2, row: 1 },
            { id: 'ap_vamp', col: 1, row: 2 },
            { id: 'ap_slow', col: 2, row: 2 },
            { id: 'ap_pen',  col: 3, row: 2 },
            { id: 'ap_vamp2', col: 1, row: 3 },
            { id: 'slow_ms', col: 2, row: 3 },
            { id: 'ap_pen2', col: 3, row: 3 }
        ],
        links: [
            ['ap', 'ap_vamp'], ['ap', 'ap_slow'], ['ap', 'ap_pen'],
            ['ap_vamp', 'ap_vamp2'], ['ap_slow', 'slow_ms'], ['ap_pen', 'ap_pen2']
        ]
    },
    as: {
        title: 'ATTACK SPEED TREE',
        note: 'Green links show the next item in the branch is currently buyable.',
        columns: 3,
        nodes: [
            { id: 'as', col: 2, row: 1 },
            { id: 'as_ms', col: 1, row: 2 },
            { id: 'as_dmg', col: 3, row: 2 },
            { id: 'as_ms2', col: 1, row: 3 },
            { id: 'as_dmg2', col: 3, row: 3 }
        ],
        links: [
            ['as', 'as_ms'],
            ['as', 'as_dmg'],
            ['as_ms', 'as_ms2'],
            ['as_dmg', 'as_dmg2']
        ]
    },
    ah: {
        title: 'ABILITY HASTE TREE',
        note: 'Green links show the next item in the branch is currently buyable.',
        columns: 3,
        nodes: [
            { id: 'ah', col: 2, row: 1 },
            { id: 'ah_ms', col: 1, row: 2 },
            { id: 'ah_hp', col: 3, row: 2 },
            { id: 'ah_ms2', col: 1, row: 3 },
            { id: 'ah_hp2', col: 3, row: 3 }
        ],
        links: [
            ['ah', 'ah_ms'],
            ['ah', 'ah_hp'],
            ['ah_ms', 'ah_ms2'],
            ['ah_hp', 'ah_hp2']
        ]
    },
    def: {
        title: 'DEFENSE TREE',
        note: 'Green links show the next item in the branch is currently buyable.',
        columns: 3,
        nodes: [
            { id: 'hp',          col: 2, row: 1 },
            { id: 'def_ar',      col: 1, row: 2 },
            { id: 'titan_shard', col: 2, row: 2 },
            { id: 'def_mr',      col: 3, row: 2 },
            { id: 'def_ar2',     col: 1, row: 3 },
            { id: 'titan_sigil', col: 2, row: 3 },
            { id: 'def_mr2',     col: 3, row: 3 }
        ],
        links: [
            ['hp', 'def_ar'], ['hp', 'titan_shard'], ['hp', 'def_mr'],
            ['def_ar', 'def_ar2'], ['titan_shard', 'titan_sigil'], ['def_mr', 'def_mr2']
        ]
    },
    anti: {
        title: 'ANTI-HEAL TREE',
        note: 'Green links show the next item in the branch is currently buyable.',
        columns: 3,
        nodes: [
            { id: 'anti_base', col: 2, row: 1 },
            { id: 'ah_heal', col: 1, row: 2 },
            { id: 'ah_heal_ap', col: 3, row: 2 },
            { id: 'ah_heal2', col: 1, row: 3 },
            { id: 'ah_heal_ap2', col: 3, row: 3 }
        ],
        links: [
            ['anti_base', 'ah_heal'],
            ['anti_base', 'ah_heal_ap'],
            ['ah_heal', 'ah_heal2'],
            ['ah_heal_ap', 'ah_heal_ap2']
        ]
    },
};

const SHOP_TREE_ORDER = ['ad', 'ap', 'as', 'ah', 'def', 'anti'];

const formatShopStats = (desc = '') => desc.split(',').map((part) => part.trim()).filter(Boolean);

const createShopStatPill = (text) => {
    const pill = document.createElement('span');
    pill.className = 'shop-stat-pill';
    pill.textContent = text;
    return pill;
};

const createShopCard = (item, currentPlayer, { tree = false } = {}) => {
    const buyCheck = canBuyShopItem(currentPlayer, item);
    const canAfford = currentPlayer && (currentPlayer.gold || 0) >= item.cost;
    const count = currentPlayer && Array.isArray(currentPlayer.items) ? currentPlayer.items.filter((ownedId) => ownedId === item.id).length : 0;

    // State: 'buy' = can buy, 'prereq' = missing item, 'gold' = not enough gold
    const state = buyCheck.ok && canAfford ? 'buy' : (buyCheck.ok && !canAfford ? 'gold' : 'prereq');

    const card = document.createElement('div');
    card.className = `shop-card${tree ? ' shop-card-tree' : ''} shop-state-${state}`;
    card.dataset.shopItem = item.id;

    const left = document.createElement('div');
    left.className = 'shop-card-left';

    // ── Name + cost row ──────────────────────────────────────────────
    const nameWrap = document.createElement('div');
    nameWrap.className = 'shop-card-name-wrap';

    const name = document.createElement('div');
    name.className = 'shop-card-name';
    name.textContent = item.name;
    if (count > 0) {
        const countBadge = document.createElement('span');
        countBadge.className = 'shop-card-count';
        countBadge.textContent = `×${count}`;
        name.appendChild(countBadge);
    }

    const cost = document.createElement('div');
    cost.className = 'shop-card-cost';
    const totalCost = currentPlayer ? calcTotalCost(currentPlayer, item) : item.cost;
    if (totalCost > item.cost) {
        cost.textContent = `${totalCost}g total`;
        cost.title = `${item.cost}g item + ${totalCost - item.cost}g prerequisites`;
        cost.style.color = '#ffaa44';
    } else {
        cost.textContent = `${item.cost}g`;
    }

    nameWrap.appendChild(name);
    nameWrap.appendChild(cost);
    left.appendChild(nameWrap);

    // ── Stat pills ───────────────────────────────────────────────────
    const stats = document.createElement('div');
    stats.className = 'shop-card-stats';
    for (const statText of formatShopStats(item.desc)) {
        stats.appendChild(createShopStatPill(statText));
    }
    left.appendChild(stats);

    // ── Prereq chain line ────────────────────────────────────────────
    const reqs = Array.isArray(item.requires) ? item.requires : (item.requires ? [item.requires] : []);
    if (reqs.length > 0) {
        const reqLine = document.createElement('div');
        reqLine.className = 'shop-card-req';
        const ownedIds = currentPlayer?.items || [];
        const parts = reqs.map(reqId => {
            const reqItem = getShopItem(reqId);
            const owned = ownedIds.includes(reqId);
            return `<span class="req-item${owned ? ' req-owned' : ' req-missing'}">${reqItem ? reqItem.name : reqId}</span>`;
        });
        reqLine.innerHTML = '► ' + parts.join(' + ');
        left.appendChild(reqLine);
    }

    // ── Buy button ───────────────────────────────────────────────────
    const btn = document.createElement('button');
    btn.className = 'shop-buy-btn';
    const canActuallyBuy = buyCheck.ok && canAfford;
    if (state === 'buy') {
        btn.textContent = '[BUY]';
        btn.title = '';
    } else if (state === 'gold') {
        const deficit = item.cost - Math.floor(currentPlayer?.gold || 0);
        btn.textContent = `+${deficit}g`;
        btn.title = `Need ${deficit} more gold`;
    } else {
        btn.textContent = '[REQ]';
        btn.title = buyCheck.reason || 'Missing prerequisite';
    }
    btn.disabled = !canActuallyBuy;
    btn.addEventListener('click', () => buyItem(item.id));

    card.appendChild(left);
    card.appendChild(btn);

    return card;
};

const renderShopSection = (container, title, itemIds, currentPlayer) => {
    const section = document.createElement('section');
    section.className = 'shop-section';

    const head = document.createElement('div');
    head.className = 'shop-section-head';

    const titleEl = document.createElement('div');
    titleEl.className = 'shop-section-title';
    titleEl.textContent = title;

    head.appendChild(titleEl);
    section.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'shop-card-grid';

    for (const id of itemIds) {
        const item = getShopItem(id) || shopItems.find((shopItem) => shopItem.id === id);
        if (!item) continue;
        grid.appendChild(createShopCard(item, currentPlayer));
    }

    section.appendChild(grid);
    container.appendChild(section);
};

const drawShopTreeLinks = (treeWrap, currentPlayer, config) => {
    if (!treeWrap) return;
    const svg = treeWrap.querySelector('.shop-tree-lines');
    const grid = treeWrap.querySelector('.shop-tree-grid');
    if (!svg || !grid) return;

    const gridRect = grid.getBoundingClientRect();
    if (!gridRect.width || !gridRect.height) return;

    const ns = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', `0 0 ${gridRect.width} ${gridRect.height}`);
    svg.setAttribute('width', gridRect.width);
    svg.setAttribute('height', gridRect.height);
    svg.innerHTML = '';

    for (const [fromId, toId] of (config?.links || [])) {
        const fromEl = grid.querySelector(`[data-shop-node="${fromId}"]`);
        const toEl = grid.querySelector(`[data-shop-node="${toId}"]`);
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const toItem = getShopItem(toId);
        const active = !!(currentPlayer && toItem && canBuyShopItem(currentPlayer, toItem).ok);

        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', String(fromRect.left - gridRect.left + fromRect.width / 2));
        line.setAttribute('y1', String(fromRect.bottom - gridRect.top - 4));
        line.setAttribute('x2', String(toRect.left - gridRect.left + toRect.width / 2));
        line.setAttribute('y2', String(toRect.top - gridRect.top + 4));
        line.setAttribute('stroke', active ? '#46f26b' : '#5e646f');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', active ? '0.95' : '0.65');
        svg.appendChild(line);
    }
};

// Pamatuje si které stromy jsou otevřené mezi re-rendery
const _openTrees = new Set();

const renderTreeSection = (container, currentPlayer, treeId) => {
    const config = SHOP_TREE_CONFIGS[treeId];
    if (!config) return;

    const isOpen = _openTrees.has(treeId);

    const section = document.createElement('section');
    section.className = 'shop-section shop-tree-section';
    section.dataset.treeId = treeId;
    section.dataset.treeOpen = String(isOpen);

    const head = document.createElement('div');
    head.className = 'shop-section-head shop-tree-toggle';

    const titleEl = document.createElement('div');
    titleEl.className = 'shop-section-title';
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle-icon';
    toggle.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
    toggle.textContent = '▶ ';
    titleEl.appendChild(toggle);
    titleEl.appendChild(document.createTextNode(config.title));

    head.appendChild(titleEl);
    section.appendChild(head);

    const treeWrap = document.createElement('div');
    treeWrap.className = 'shop-tree-wrap';
    treeWrap.dataset.treeId = treeId;
    treeWrap.style.setProperty('--shop-tree-cols', String(config.columns));
    if (!isOpen) treeWrap.style.display = 'none';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('shop-tree-lines');
    svg.setAttribute('aria-hidden', 'true');

    const grid = document.createElement('div');
    grid.className = 'shop-tree-grid';

    for (const node of config.nodes) {
        const item = getShopItem(node.id) || shopItems.find((shopItem) => shopItem.id === node.id);
        if (!item) continue;
        const card = createShopCard(item, currentPlayer, { tree: true });
        card.dataset.shopNode = node.id;
        card.style.gridColumn = String(node.col);
        card.style.gridRow = String(node.row);
        grid.appendChild(card);
    }

    treeWrap.appendChild(svg);
    treeWrap.appendChild(grid);
    section.appendChild(treeWrap);
    container.appendChild(section);

    head.addEventListener('click', () => {
        const nowOpen = section.dataset.treeOpen !== 'true';
        section.dataset.treeOpen = String(nowOpen);
        toggle.style.transform = nowOpen ? 'rotate(90deg)' : 'rotate(0deg)';
        treeWrap.style.display = nowOpen ? '' : 'none';
        if (nowOpen) {
            _openTrees.add(treeId);
            requestAnimationFrame(() => drawShopTreeLinks(treeWrap, currentPlayer, config));
        } else {
            _openTrees.delete(treeId);
        }
    });

    if (isOpen) {
        requestAnimationFrame(() => drawShopTreeLinks(treeWrap, currentPlayer, config));
    }
};

const style = document.createElement('style');
style.innerHTML = `
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; background: #070707; }
  canvas { touch-action: none; user-select: none; -webkit-user-select: none; outline: none; -webkit-tap-highlight-color: transparent; }
  #hud, #hp, #gold, #exp, #level, #respawn, #nexusBlue, #nexusRed { display: none !important; }
  #qbar, #ebar, #qlv, #elv, #qcd, #ecd, .cooldown-container { display: none !important; }
  #minimap { width: 300px !important; height: 300px !important; border: 2px solid #444; border-radius: 50% !important; overflow: hidden !important; box-shadow: 0 0 10px rgba(0,0,0,0.8); }
    #shopOverlay { display: block !important; position: fixed !important; left: auto !important; right: 0 !important; top: 0 !important; width: min(760px, 100vw) !important; max-width: 100vw !important; height: 100% !important; background: linear-gradient(180deg, rgba(10,10,14,0.99), rgba(5,5,7,0.99)) !important; border-left: 1px solid #2d3138 !important; padding: 16px 16px 25vh 16px !important; overflow-y: auto !important; color: #fff !important; font-family: monospace !important; transition: transform 0.3s ease !important; transform: translateX(0); z-index: 10000 !important; box-sizing: border-box !important; -webkit-overflow-scrolling: touch !important; touch-action: auto !important; pointer-events: auto !important; }
  #shopOverlay.hidden { transform: translateX(100%) !important; }
  #menu, #roomBrowser, #roomLobby, #endStats, #roomListContainer, #classBtns, .player-list, .roster-scroll-area { -webkit-overflow-scrolling: touch !important; overscroll-behavior-y: contain !important; touch-action: auto !important; pointer-events: auto !important; }
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
  /* ═══ RETRO ASCII SHOP ═══ */
  * { box-sizing: border-box; }
  .shop-shell { display: flex; flex-direction: column; gap: 4px; font-family: monospace; }
  .shop-toolbar { position: sticky; top: -16px; z-index: 10; background: #000; padding: 8px 0 6px 0; border-bottom: 1px solid #444; }
  .shop-toolbar-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
  .shop-title { margin: 0; color: #0f0; font-size: 18px; font-family: monospace; letter-spacing: 2px; }
  .shop-toolbar-actions { display: flex; gap: 6px; }
  .shop-nav-btn { padding: 4px 10px; font-size: 14px; background: #000; color: #888; border: 1px solid #444; cursor: pointer; font-family: monospace; }
  .shop-nav-btn:hover { color: #0f0; border-color: #0f0; }
  .shop-hint { color: #555; font-size: 10px; font-family: monospace; }
  /* Filter buttons */
  .shop-filters { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .shop-filter-btn { padding: 2px 8px; border: 1px solid #444; background: #000; color: #888; font-size: 11px; font-family: monospace; cursor: pointer; letter-spacing: 1px; }
  .shop-filter-btn:hover { border-color: #ffcc00; color: #ffcc00; }
  .shop-filter-btn.active { border-color: #ffcc00; color: #ffcc00; background: #111; }
  /* Tree sections */
  .shop-section { background: #000; border: 1px solid #333; padding: 0; margin-bottom: 2px; }
  .shop-section-head { padding: 0; margin: 0; }
  .shop-section-title { font-weight: bold; color: #ffcc00; font-size: 11px; font-family: monospace; letter-spacing: 2px; }
  .shop-section-note { display: none; }
  .shop-tree-toggle { cursor: pointer; user-select: none; padding: 5px 8px; border-bottom: 1px solid #222; display: flex; align-items: center; gap: 4px; }
  .shop-tree-toggle:hover { background: #0a0a0a; }
  .tree-toggle-icon { display: inline-block; transition: transform 0.15s ease; color: #555; font-size: 10px; }
  /* Cards */
  .shop-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 6px; align-items: center; background: #050505; border: 1px solid #222; padding: 8px 10px; min-width: 0; margin: 0; }
  .shop-card-tree { background: #050505; border-color: #1a1a1a; }
  .shop-card-left { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .shop-card-title-row { display: flex; flex-direction: row; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .shop-card-name-wrap { display: flex; flex-direction: row; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .shop-card-name { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: bold; color: #ddd; font-family: monospace; }
  .shop-card-count { color: #0f0; font-size: 10px; }
  .shop-card-cost { color: #ffcc00; font-size: 11px; font-family: monospace; white-space: nowrap; }
  .shop-card-stats { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 1px; }
  .shop-stat-pill { display: inline; color: #aaa; font-size: 10px; font-family: monospace; white-space: nowrap; }
  .shop-stat-pill::before { content: '['; color: #555; }
  .shop-stat-pill::after  { content: ']'; color: #555; }
  .shop-card-req { font-size: 10px; font-family: monospace; margin-top: 2px; color: #666; }
  .req-item { font-size: 10px; }
  .req-owned  { color: #4a4; }
  .req-missing { color: #a64; }
  /* State colors */
  .shop-state-buy { border-color: #1a3a1a !important; }
  .shop-state-buy .shop-card-name { color: #cfc; }
  .shop-state-buy .shop-buy-btn { border-color: #0f0; color: #0f0; background: #010f01; }
  .shop-state-buy .shop-buy-btn:hover { background: #001800; }
  .shop-state-prereq { border-color: #2a1a00 !important; opacity: 0.85; }
  .shop-state-prereq .shop-card-name { color: #997744; }
  .shop-state-prereq .shop-buy-btn { border-color: #664400; color: #997700; background: #0a0800; cursor: not-allowed; }
  .shop-state-gold { border-color: #1a0000 !important; opacity: 0.65; }
  .shop-state-gold .shop-card-name { color: #664444; }
  .shop-state-gold .shop-buy-btn { border-color: #440000; color: #884444; background: #050000; cursor: not-allowed; }
  /* Buy button */
  .shop-buy-btn { padding: 4px 8px; border: 1px solid #333; background: #000; color: #888; font-size: 11px; font-family: monospace; cursor: pointer; white-space: nowrap; font-weight: bold; }
  .shop-buy-btn:disabled { cursor: not-allowed; }
  /* Owned items bar */
  .shop-owned-bar { background: #000; border: 1px solid #333; padding: 6px 8px; margin-bottom: 4px; }
  .shop-owned-title { color: #ffcc00; font-size: 10px; font-family: monospace; letter-spacing: 1px; margin-bottom: 4px; }
  .shop-owned-list { display: flex; flex-wrap: wrap; gap: 3px; }
  .shop-owned-tag { font-size: 10px; font-family: monospace; color: #0f0; border: 1px solid #1a3a1a; padding: 1px 5px; background: #010f01; }
  .shop-owned-empty { font-size: 10px; font-family: monospace; color: #444; font-style: italic; }
  .shop-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2px; }
  .shop-tree-stack { display: flex; flex-direction: column; gap: 3px; }
  .shop-tree-wrap { position: relative; padding: 8px; }
  .shop-tree-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
  .shop-tree-grid { position: relative; display: grid; grid-template-columns: repeat(var(--shop-tree-cols,3), minmax(0,1fr)); gap: 10px; }
  .shop-tree-grid .shop-card { width: 100%; }
  /* ═══ RETRO LOBBY / CHAMP SELECT ═══ */
  .three-col-layout { display: flex; flex-wrap: nowrap !important; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; }
  .team-box { flex: 0 0 210px !important; width: 210px !important; background: #000; border: 1px solid #333; display: flex; flex-direction: column; scroll-snap-align: center; font-family: monospace; }
  .center-roster { flex: 1 1 380px !important; min-width: 280px; background: #000; border: 1px solid #333; display: flex; flex-direction: column; overflow: hidden; scroll-snap-align: center; font-family: monospace; }
  .team-header { padding: 7px; font-weight: bold; text-align: center; letter-spacing: 2px; font-family: monospace; font-size: 12px; }
  .team-footer { padding: 8px; border-top: 1px solid #222; flex-shrink: 0; margin-top: auto; }
  .blue-header { background: #000; color: #4488ff; border-bottom: 1px solid #4488ff; }
  .red-header  { background: #000; color: #ff4444; border-bottom: 1px solid #ff4444; }
  .player-list { list-style: none; padding: 6px; margin: 0; flex-grow: 1; overflow-y: auto; min-height: 80px; text-align: left; }
  .player-item { padding: 4px 6px; margin-bottom: 2px; background: #050505; border: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-family: monospace; }
  .champ-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 3px; padding-bottom: 8px; }
  .champ-btn { background: #050505; border: 1px solid #2a2a2a; color: #888; padding: 6px 3px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; font-family: monospace; }
  .champ-btn:hover:not(.taken) { border-color: #888; color: #ccc; background: #0a0a0a; }
  .champ-btn.selected { border: 2px solid #0f0 !important; color: #0f0 !important; background: #002800 !important; box-shadow: inset 0 0 8px rgba(0,255,0,0.25); }
  .champ-btn.taken { opacity: 0.3; cursor: not-allowed; border-color: #400; color: #400; }
  .champ-icon { font-size: 22px; font-weight: bold; }
  .champ-name { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; letter-spacing: 0; }
  @media screen and (max-width: 900px), screen and (max-height: 600px) {
      #shopOverlay { width: clamp(300px, 65vw, 680px) !important; padding: 10px 10px 18vh 10px !important; }
      .shop-card-grid { grid-template-columns: 1fr; }
      .shop-tree-grid { gap: 3px; }
      .team-box { flex: 0 0 170px !important; width: 170px !important; }
      .center-roster { flex: 0 0 280px !important; width: 280px !important; min-width: 280px !important; }
      .champ-grid { grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important; gap: 2px !important; }
      .champ-btn { padding: 3px !important; }
      .champ-icon { font-size: 16px !important; }
      .champ-name { font-size: 9px !important; }
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
    if (e.touches && e.touches.length > 1) { e.preventDefault(); }
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
export function updateLobbyUI(playersData, roomName = "OFFLINE", settings = null) {
  const rb = document.getElementById('roomBrowser'); if (rb) rb.style.display = 'none';
  const rl = document.getElementById('roomLobby'); if (rl) rl.style.display = 'flex';
  
  const title = document.getElementById('lobbyTitle');
  if (title) title.textContent = `ROOM: ${roomName}`;

  const blueList = document.getElementById('blueTeamList');
  const redList = document.getElementById('redTeamList');
  const specList = document.getElementById('specList');
  if (blueList) blueList.innerHTML = '';
  if (redList) redList.innerHTML = '';
  if (specList) specList.innerHTML = '';
  
  let myTeam = -1;
  let myClass = '';
  let mySpell = 'Heal';
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
          mySpell = p.summonerSpell;
          myReady = p.ready;
      }
      
      const readyHTML = p.ready ? '<span style="color:#0f0; font-size: 10px;">READY</span>' : '<span style="color:#888; font-size: 10px;">WAITING</span>';
      const meTag = isMe ? '<span style="color:#ffcc00; font-size:10px; margin-left:4px;">(YOU)</span>' : '';
      
      if (p.team === -1) {
          if (specList) specList.innerHTML += `<li>[SPECTATOR] ${p.id.substring(0,4)}... ${meTag}</li>`;
      } else {
          const targetList = p.team === 0 ? blueList : redList;
          if (targetList) {
              const cInfo = CLASSES[p.className];
              const dmgStr = cInfo ? (cInfo.dmgType === 'physical' ? 'AD' : 'AP') : '';
              const dmgColor = dmgStr === 'AD' ? '#ffcc00' : '#d270ff';
              const dmgTag = dmgStr ? `<span style="color:${dmgColor}; font-size:10px; margin-left:4px;">[${dmgStr}]</span>` : '';
              
              targetList.innerHTML += `<li class="player-item" style="border-left: 3px solid ${tColor};">
                  <div><strong style="color:${tColor};">${p.className}</strong>${dmgTag}<span style="color:#aaa; font-size:10px; margin-left:4px;">[${p.summonerSpell}]</span>${meTag}</div>
                  <div>${readyHTML}</div>
              </li>`;
          }
      }
      
      if (p.team === 0) blueTaken.add(p.className);
      else redTaken.add(p.className);

      if (!p.ready) allReady = false;
  });

  const myTeamTakenByOthers = myTeam === 0 ? blueTaken : redTaken;
  
  const allClassBtns = document.querySelectorAll('.champ-btn');
  allClassBtns.forEach(btn => {
      const className = btn.dataset.className;
      const isMyClass = className === myClass;
      const isTakenByOther = myTeamTakenByOthers.has(className) && !isMyClass;
      
      btn.disabled = isTakenByOther;
      if (isTakenByOther) {
          btn.classList.add('taken');
          btn.classList.remove('selected');
      } else if (isMyClass) {
          btn.classList.add('selected');
          btn.classList.remove('taken');
      } else {
          btn.classList.remove('taken');
          btn.classList.remove('selected');
      }
  });

  const allSpellBtns = document.querySelectorAll('#spellBtns button');
  if(allSpellBtns.length > 0) {
      allSpellBtns.forEach(b => {
          const active = b.dataset.spell === mySpell;
          b.style.borderColor = active ? '#0f0' : '#333';
          b.style.background = active ? '#010f01' : '#000';
          b.style.color = active ? '#0f0' : '#888';
      });
  }

  if (settings) {
      const blueSlider = document.getElementById('blueBotSlider');
      const blueLabel = document.getElementById('blueBotLabel');
      if (blueSlider && blueLabel && blueSlider.value != settings.blueBotDiff) {
          blueSlider.value = settings.blueBotDiff;
          blueLabel.textContent = settings.blueBotDiff + '%';
      }
      const redSlider = document.getElementById('redBotSlider');
      const redLabel = document.getElementById('redBotLabel');
      if (redSlider && redLabel && redSlider.value != settings.redBotDiff) {
          redSlider.value = settings.redBotDiff;
          redLabel.textContent = settings.redBotDiff + '%';
      }
      if (!socket) {
          game.blueBotDifficulty = settings.blueBotDiff / 100;
          game.redBotDifficulty = settings.redBotDiff / 100;
      }
  }

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

// Filtr pro shop - jaké kategorie jsou viditelné
const TREE_FILTER_MAP = {
    AD:    ['ad', 'anti'],
    AP:    ['ap', 'anti'],
    AS:    ['as'],
    AH:    ['ah'],
    Armor: ['def'],
    MR:    ['def'],
};
let _shopFilter = null; // null = vše

export function populateShop() {
  const overlay = document.getElementById('shopOverlay');
  if (!overlay) return;
  const gold = player ? Math.floor(player.gold || 0) : 0;
  overlay.innerHTML = `
    <div class="shop-shell">
      <div class="shop-toolbar">
        <div class="shop-toolbar-top">
          <h2 class="shop-title">[ SHOP ] <span id="shopGoldDisplay" style="color:#ffcc00;font-size:16px;margin-left:10px;">[G] ${gold}g</span></h2>
          <button id="closeShopX" style="background:transparent;color:#ff4e4e;border:none;font-size:32px;font-weight:bold;cursor:pointer;line-height:1;padding:0 10px;">&times;</button>
        </div>
        <div id="shopFilters" class="shop-filters"></div>
        <div class="shop-toolbar-actions">
          <button id="shopUpBtn" class="shop-nav-btn">▲</button>
          <button id="shopDownBtn" class="shop-nav-btn">▼</button>
        </div>
      </div>
      <div id="shopOwnedBar"></div>
      <div id="shopTreeMount"></div>
      <button id="closeShopBtn" style="width:100%;padding:10px;margin-top:8px;background:#000;color:#ff4444;border:1px solid #ff4444;cursor:pointer;font-weight:bold;font-size:14px;font-family:monospace;letter-spacing:2px;">[ CLOSE SHOP ]</button>
    </div>
  `;
  document.getElementById('closeShopBtn').onclick = closeShop;
  document.getElementById('closeShopX').onclick = closeShop;
  overlay.querySelector('#shopUpBtn').onclick = () => overlay.scrollBy({ top: -320, behavior: 'smooth' });
  overlay.querySelector('#shopDownBtn').onclick = () => overlay.scrollBy({ top: 320, behavior: 'smooth' });

  // Filter buttons
  const filtersEl = document.getElementById('shopFilters');
  const allBtn = document.createElement('button');
  allBtn.className = `shop-filter-btn${_shopFilter === null ? ' active' : ''}`;
  allBtn.textContent = 'All';
  allBtn.onclick = () => { _shopFilter = null; populateShop(); };
  filtersEl.appendChild(allBtn);
  for (const [label, trees] of Object.entries(TREE_FILTER_MAP)) {
    const btn = document.createElement('button');
    btn.className = `shop-filter-btn${_shopFilter === label ? ' active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => { _shopFilter = label; populateShop(); };
    filtersEl.appendChild(btn);
  }

  // Owned items bar
  const ownedBar = document.getElementById('shopOwnedBar');
  if (ownedBar) {
    const ownedItems = player ? (player.items || []) : [];
    ownedBar.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'shop-owned-bar';
    const title = document.createElement('div');
    title.className = 'shop-owned-title';
    title.textContent = `OWNED ITEMS  (${ownedItems.length}/25)`;
    wrap.appendChild(title);
    const list = document.createElement('div');
    list.className = 'shop-owned-list';
    if (ownedItems.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'shop-owned-empty';
      empty.textContent = 'No items purchased yet';
      list.appendChild(empty);
    } else {
      // Count duplicates
      const counts = {};
      for (const id of ownedItems) counts[id] = (counts[id] || 0) + 1;
      for (const [id, cnt] of Object.entries(counts)) {
        const it = getShopItem(id);
        if (!it) continue;
        const tag = document.createElement('span');
        tag.className = 'shop-owned-tag';
        tag.textContent = cnt > 1 ? `${it.name} ×${cnt}` : it.name;
        tag.title = it.desc;
        list.appendChild(tag);
      }
    }
    wrap.appendChild(list);
    ownedBar.appendChild(wrap);
  }

  const treeMount = document.getElementById('shopTreeMount');
  if (treeMount) {
    treeMount.className = 'shop-tree-stack';
    const visibleTrees = _shopFilter ? TREE_FILTER_MAP[_shopFilter] : SHOP_TREE_ORDER;
    for (const treeId of visibleTrees) {
      if (SHOP_TREE_CONFIGS[treeId]) renderTreeSection(treeMount, player, treeId);
    }
  }
}

export function updateShopGold() {
  const el = document.getElementById('shopGoldDisplay');
  if (el && player) el.textContent = `[G] ${Math.floor(player.gold || 0)}g`;
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
  drawFogOfWar(ctx, cw, ch, dpr);

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
        
        let yOff = 76;
        if (player && player.macroOrder) {
            ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 12px monospace';
            ctx.fillText(`AI SUGGEST: ${player.macroOrder.type.replace('_', ' ')}`, 20, yOff);
            yOff += 24;
        }
        
        if (game.macroState) {
            ctx.font = '11px monospace';
            if (game.macroState[0]) {
                ctx.fillStyle = '#486FED'; ctx.fillText(`BLUE MACRO: [${game.macroState[0].phase}] ${game.macroState[0].currentStrat}`, 20, yOff); yOff += 16;
            }
            if (game.macroState[1]) {
                ctx.fillStyle = '#FF4E4E'; ctx.fillText(`RED MACRO:  [${game.macroState[1].phase}] ${game.macroState[1].currentStrat}`, 20, yOff);
            }
        }
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

          const t = player.currentTarget;
          const _tls = t.lifesteal || 0, _tsv = t.spellVamp || 0;
          const _tgw = t.antiHeal || 0, _tsw = t.onHitSlow || 0, _tss = t.onSpellHitSlow || 0;
          const _tHasItemStats = _tls > 0 || _tsv > 0 || _tgw > 0 || _tsw > 0 || _tss > 0;
          const tw = 280, th = _tHasItemStats ? 108 : 85; const tx = 0, ty = 0;
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
              if (_tHasItemStats) {
                  ctx.fillStyle = '#7cf'; ctx.font = '10px monospace';
                  let _tisx = stX, _tisy = ty + 78;
                  if (_tls > 0)  { ctx.fillText(`LS:${Math.round(_tls*100)}%`,  _tisx, _tisy); _tisx += 48; }
                  if (_tsv > 0)  { ctx.fillText(`SV:${Math.round(_tsv*100)}%`,  _tisx, _tisy); _tisx += 48; }
                  if (_tgw > 0)  { ctx.fillText(`GW:${Math.round(_tgw*100)}%`,  _tisx, _tisy); _tisx += 48; }
                  if (_tsw > 0)  { ctx.fillText(`SLW:${Math.round(_tsw*100)}%`, _tisx, _tisy); _tisx += 54; }
                  if (_tss > 0)  { ctx.fillText(`SSP:${Math.round(_tss*100)}%`, _tisx, _tisy); }
              }
          }
          ctx.restore();
      }

      ctx.save();
      // Zmenšené měřítko středového HUDu pro mobily (na 60%)
      let uiScale = isMobile ? 0.50 : 1; 
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
      const _ls = player.lifesteal || 0, _sv = player.spellVamp || 0;
      const _gw = player.antiHeal || 0, _sw = player.onHitSlow || 0;
      const _pa = player.armorPenFlat || 0, _pm = player.magicPenFlat || 0;
      let buffAdMult = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
      let buffAsMult = 1.0 + (player.adAsBuffTimer > 0 ? player.adAsBuffAmount : 0);
      ctx.fillStyle = '#111'; ctx.fillRect(cx + 160, cy - 40, 290, 75);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(cx + 160, cy - 40, 290, 75);
      ctx.fillStyle = '#aaa'; ctx.font = '1Opx monospace'; ctx.textAlign = 'left';
      ctx.fillText(`AD:${Math.round(player.AD * (player.hasPowerup?1.2:1) * buffAdMult)}`, cx + 165, cy - 25);
      ctx.fillText(`AP:${Math.round(player.AP * (player.hasPowerup?1.2:1))}`, cx + 165, cy - 5);
      ctx.fillText(`AR:${Math.round(player.armor * (player.hasPowerup?1.2:1))}`, cx + 225, cy - 25);
      ctx.fillText(`MR:${Math.round(player.mr * (player.hasPowerup?1.2:1))}`, cx + 225, cy - 5);
      ctx.fillText(`HP:${player.effectiveMaxHp}`, cx + 225, cy + 15);
      ctx.fillText(`AS:${(player.attackDelay / (player.attackSpeed * buffAsMult)).toFixed(2)}`, cx + 295, cy - 25);
      ctx.fillText(`SP:${Math.round(player.speed * (player.hasPowerup?1.2:1))}`, cx + 295, cy - 5);
      ctx.fillText(`AH:${player.abilityHaste}`, cx + 295, cy + 15);
      ctx.fillStyle = '#aaa'; ctx.font = '10px monospace';
      ctx.fillText(`LS:${Math.round(_ls*100)}%|SV:${Math.round(_sv*100)}%`, cx + 350, cy - 25);
      ctx.fillText(`PA:${_pa}|PM:${_pm}`, cx + 350, cy - 5);
      ctx.fillText(`SL:${Math.round(_sw*100)}%|AH:${Math.round(_gw*100)}%`, cx + 350, cy + 15);
      
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
            let sStr = stat.padEnd(10, ' '); let iStr = `Items: ${p.items.length}`.padEnd(9, ' '); let kStr = `K/D/A: ${p.kills}/${p.deaths}/${p.assists}`.padEnd(14, ' '); let pcsStr = `PCS: ${computeDominionPCS(p).total}`.padEnd(12, ' ');
            ctx.fillText(`${cStr} | ${sStr} | ${iStr} | ${kStr} | ${pcsStr} | Gold: ${Math.floor(p.totalGold)}`, padX + 20, startY); 
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
            let sStr = stat.padEnd(10, ' '); let iStr = `Items: ${p.items.length}`.padEnd(9, ' '); let kStr = `K/D/A: ${p.kills}/${p.deaths}/${p.assists}`.padEnd(14, ' '); let pcsStr = `PCS: ${computeDominionPCS(p).total}`.padEnd(12, ' ');
            ctx.fillText(`${cStr} | ${sStr} | ${iStr} | ${kStr} | ${pcsStr} | Gold: ${Math.floor(p.totalGold)}`, padX + 20, startY); 
            startY += rowH;
        }
    }
    
    if (keys['c'] && player) {
        ctx.save();
        let isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        // Zmenšíme měřítko, pokud je obrazovka na výšku menší než 850px (pro PC i mobily), aby se detailní texty vždy vešly
        let uiScale = Math.min(1, ch / 850); 
        ctx.scale(uiScale, uiScale);
        let invScale = 1 / uiScale;

        let panelW = Math.max(480, (cw * 0.38) * invScale); 
        let panelH = ch * invScale;
        
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, panelW, panelH);
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, panelW, panelH);
        
        let leftM = 20; let startY = 30;
        ctx.fillStyle = '#fff'; ctx.font = `bold 20px monospace`; ctx.textAlign = 'left';
        ctx.fillText('CHARACTER INFO  ▲ ▼', leftM, startY); startY += 35;
        
        ctx.font = `13px monospace`;
        ctx.fillText(`Class: ${player.className}`, leftM, startY); startY += 22;
        ctx.fillText(`Level: ${player.level} (${Math.floor(player.exp)}/${expForLevel(player.level)} XP)`, leftM, startY); startY += 22;
        ctx.fillText(`HP: ${Math.floor(player.hp)} / ${player.effectiveMaxHp}`, leftM, startY); startY += 22;
        ctx.fillText(`Gold: ${Math.floor(player.gold)}`, leftM, startY); startY += 22;
        ctx.fillText(`Kills: ${player.kills} | Deaths: ${player.deaths} | Assists: ${player.assists}`, leftM, startY); startY += 35;
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`ATTRIBUTES`, leftM, startY); startY += 25;
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
        ctx.fillText(`AD:    ${String(adVal).padEnd(5, ' ')} | AP:    ${apVal}`, leftM, startY); startY += 20;
        ctx.fillText(`Armor: ${String(arVal).padEnd(5, ' ')} | MR:    ${mrVal}`, leftM, startY); startY += 20;
        ctx.fillText(`A.Spd: ${String(asVal).padEnd(5, ' ')} | Speed: ${msVal}`, leftM, startY); startY += 20;
        ctx.fillText(`Haste: ${String(ahVal).padEnd(5, ' ')} |`, leftM, startY); startY += 18;

        const _cLs = player.lifesteal || 0, _cSv = player.spellVamp || 0;
        const _cGw = player.antiHeal || 0, _cSw = player.onHitSlow || 0, _cSs = player.onSpellHitSlow || 0;
        const _cAP = player.armorPenFlat || 0, _cMP = player.magicPenFlat || 0;
        ctx.fillStyle = '#7cf';
        ctx.fillText(`LS: ${Math.round(_cLs*100)}%  | SV: ${Math.round(_cSv*100)}%`, leftM, startY); startY += 18;
        ctx.fillText(`Pen A: ${_cAP}  | Pen M: ${_cMP}`, leftM, startY); startY += 18;
        ctx.fillText(`Slow: ${Math.round(_cSw*100)}%  | AH: ${Math.round(_cGw*100)}%`, leftM, startY); startY += 18;
        if (_cSs > 0) { ctx.fillText(`Spell Slow: ${Math.round(_cSs*100)}%`, leftM, startY); startY += 18; }
        startY += 12;

        let baScale = CLASSES[player.className].aaScale || 0.3;
        let baDmg = Math.round(CLASSES[player.className].baseAtk + ((player.dmgType === 'magical' ? apVal : adVal) * baScale)); 
        ctx.fillStyle = '#fff'; ctx.fillText(`Basic Attack: Base ${CLASSES[player.className].baseAtk} + (${Math.round(baScale*100)}% ${player.dmgType === 'magical' ? 'AP' : 'AD'}) = ${baDmg} Dmg`, leftM, startY); startY += 30;
        
        ctx.fillStyle = '#ffcc00'; ctx.fillText(`SPELLS`, leftM, startY); startY += 25;
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
            
            let lines = [];

            const buildBreakdown = (name, baseVal, sLvl, sAD, sAP) => {
                let vLvl = lvl * sLvl; let vAD = Math.round(pAD * sAD); let vAP = Math.round(pAP * sAP);
                let total = baseVal + vLvl + vAD + vAP;
                let parts = [`Base:${baseVal}`, `Lvl(+${sLvl}):+${vLvl}`];
                if (sAD > 0) parts.push(`${Math.round(sAD*100)}%AD:+${vAD}`);
                if (sAP > 0) parts.push(`${Math.round(sAP*100)}%AP:+${vAP}`);
                return [
                    { t: `    ${name}: ${total}`, c: '#fff' },
                    { t: `     ↳ ` + parts.join(' | '), c: '#aaa' }
                ];
            };

            if (sp.type === 'heal_self' || sp.type === 'heal_aoe') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 10;
                lines.push(...buildBreakdown('Heal', amt, scLvl, scAD, scAP));
            } else if (sp.type === 'shield_explode') {
                let scLvlSh = sp.scaleLevel !== undefined ? sp.scaleLevel : 20;
                let scLvlDmg = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Shield', amt, scLvlSh, scAD, scAP));
                lines.push(...buildBreakdown('Explode Dmg', bDmg, scLvlDmg, scAD, scAP));
            } else if (sp.type === 'buff_ad_as') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 15;
                lines.push({ t: `    Buff: +${Math.round((sp.amount||0)*100)}% AD/AS (Duration: ${sp.duration}s)`, c: '#fff' });
                lines.push(...buildBreakdown('Shield', sp.shieldAmount||0, scLvl, 0.3, 0));
            } else if (sp.type === 'buff_ms') {
                let spd = Math.round(((sp.amount||0) + (pAP * (sp.scaleAP||0))) * 100);
                lines.push({ t: `    Buff: +${spd}% Speed for ${sp.duration}s`, c: '#fff' });
                if(sp.scaleAP > 0) lines.push({ t: `     ↳ Scales with AP (+${Math.round(sp.scaleAP*10000)}% per 100 AP)`, c: '#aaa' });
            } else if (sp.type === 'summon') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Summon Power', bDmg, scLvl, scAD, scAP));
                let totalDmg = bDmg + (pAP * scAP) + (pAD * scAD) + lvl * scLvl;
                lines.push({ t: `    Summons: ${sp.count||1}x Pet (HP: ${Math.round(totalDmg*1.5)} | AD: ${Math.round(totalDmg*0.4)})`, c: '#fff' });
            } else if (sp.type === 'projectile_summon') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                let sumHp = Math.round((sp.summonHp || 120) + pAD * 0.5);
                let sumAd = Math.round((sp.summonAd || 50) + pAD * 0.2);
                lines.push({ t: `    Summons 1x Pet (HP: ${sumHp} | AD: ${sumAd})`, c: '#fff' });
                lines.push({ t: `     ↳ Pet scales with AD (HP: 50% AD | AD: 20% AD)`, c: '#aaa' });
            } else if (sp.type === 'dash_heal_silence') {
                let scLvlH = sp.scaleLevel !== undefined ? sp.scaleLevel : 10;
                let scLvlD = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Damage', bDmg, scLvlD, scAD, scAP));
                lines.push(...buildBreakdown('Heal', amt, scLvlH, scAD, scAP));
                lines.push({ t: `    Silence: ${sp.silenceDuration}s`, c: '#ffcc00' });
            } else if (sp.type === 'hana_q') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 2;
                lines.push(...buildBreakdown('HP Regen/s', 5, scLvl, 0, 0.1));
                lines.push({ t: `    Duration: ${sp.duration}s | +${Math.round(((sp.bonusAsMult||1.25) - 1)*100)}% Attack Speed`, c: '#fff' });
                lines.push({ t: `    Attacks deal +${Math.round((sp.bonusHpDmg||0.03)*100)}% Max HP bonus damage.`, c: '#aaa' });
            } else if (sp.type === 'dash_def') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Def Buff: +50 Armor/MR for 4s`, c: '#0f0' });
                if (sp.slowDuration) lines.push({ t: `    Slows enemies by ${Math.round((1-(sp.slowMod||0.6))*100)}% for ${sp.slowDuration}s`, c: '#ffcc00' });
            } else if (sp.type === 'aoe_knockback') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Knockback enemies away.`, c: '#ffcc00' });
            } else if (sp.type === 'cone_knockback') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                let coneDeg = Math.round((sp.cone || 0) * 180 / Math.PI);
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Cone: ${coneDeg}° | Range: ${sp.radius}`, c: '#ffcc00' });
            } else if (sp.type === 'cone_slow_shield') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                let coneDeg = Math.round((sp.cone || 0) * 180 / Math.PI);
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Cone: ${coneDeg}° | Range: ${sp.radius}`, c: '#ffcc00' });
                if (sp.slowDuration) lines.push({ t: `    Slow: ${Math.round((1-(sp.slowMod||0.6))*100)}% for ${sp.slowDuration}s`, c: '#ffcc00' });
                if (sp.shieldAmount) lines.push({ t: `    Shield: ${sp.shieldAmount} for ${sp.duration||2.5}s`, c: '#0ff' });
            } else if (sp.type === 'summon_healers') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 2;
                lines.push(...buildBreakdown('Heal per tick', amt || 15, scLvl, scAD, scAP));
                lines.push({ t: `    Heal Interval: Every ${sp.healInterval||1.0}s`, c: '#aaa' });
                lines.push({ t: `    Pulse Dmg: ${Math.round(5 + pAP*0.1)} (+10% AP)`, c: '#aaa' });
            } else if (sp.type === 'projectile_egg') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 4;
                lines.push(...buildBreakdown('Impact Damage', bDmg, 8, scAD, scAP));
                lines.push(...buildBreakdown('Chicken Heal', amt || 25, scLvl, 0, scAP));
                lines.push({ t: `    Heal Interval: Every ${sp.healInterval||1.0}s`, c: '#aaa' });
                lines.push({ t: `    Pulse Dmg: ${Math.round(10 + pAP*0.15)} (+15% AP)`, c: '#aaa' });
            } else if (sp.type === 'tamer_e') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 25;
                lines.push(...buildBreakdown('Heal Pet', amt || 150, scLvl, scAD, scAP));
                lines.push({ t: `    Revive Cast Time: 3.0s (Interruptible)`, c: '#ffcc00' });
                lines.push({ t: `    Pet stats scale with your AP and Level!`, c: '#aaa' });
            } else if (sp.type === 'tamer_q') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Marks target for your Pet.`, c: '#ffcc00' });
            } else if (sp.type === 'spin_to_win') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 5;
                lines.push(...buildBreakdown('Damage per tick', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Duration: ${sp.duration}s | Tick: ${sp.tickRate}s`, c: '#fff' });
                lines.push({ t: `    Moves faster (+5%) while spinning.`, c: '#aaa' });
            } else if (sp.type === 'omnislash') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 10;
                lines.push(...buildBreakdown('Damage per hit', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Dash: ${sp.distance || 180} | Hits: ${sp.count}x`, c: '#ffcc00' });
                lines.push({ t: `    Invulnerable during slashes.`, c: '#aaa' });
            } else if (sp.type === 'projectile_pull') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 10;
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                lines.push({ t: `    Pulls enemies towards the impact center.`, c: '#ffcc00' });
                if (sp.stunDuration) lines.push({ t: `    Stun: ${sp.stunDuration}s`, c: '#ffcc00' });
            } else if (sp.type === 'shield_aoe') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 15;
                lines.push(...buildBreakdown('Shield Amount', amt || 80, scLvl, scAD, scAP));
                lines.push({ t: `    Duration: ${sp.duration || 5.0}s | AoE Radius: ${sp.radius}`, c: '#0ff' });
            } else if (sp.type === 'heal_beam') {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 0.5;
                let tRate = sp.tickRate || 0.1;
                lines.push(...buildBreakdown('Heal per tick', amt || 2, scLvl, scAD, scAP));
                lines.push({ t: `    Duration: Toggle | Tick: Every ${tRate}s | Range: ${sp.range}`, c: '#0f0' });
                lines.push({ t: `    Breaks if target is > ${sp.range + 50} away.`, c: '#aaa' });
                lines.push({ t: `    Auto-Uber after 5s: 1.5s invuln + speed + 2x heal.`, c: '#ffcc00' });
            } else if (sp.type === 'ubercharge') {
                lines.push({ t: `    Duration: ${sp.duration}s`, c: '#ffcc00' });
                lines.push({ t: `    Requires 5 seconds of active Heal Beam!`, c: '#ff4e4e' });
                lines.push({ t: `    Grants Invulnerability and +30% Speed.`, c: '#fff' });
                lines.push({ t: `    Applies to YOU and your beamed TARGET.`, c: '#aaa' });
        } else if (sp.type === 'flamethrower') {
            let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 25;
            lines.push(...buildBreakdown('Total Damage', bDmg, scLvl, scAD, scAP));
            lines.push({ t: `    Duration: ${sp.duration}s | Range: ${sp.range} | Cone: ${Math.round((sp.cone||0) * 180 / Math.PI)}°`, c: '#fff' });
            lines.push({ t: `    Fires continuously in a cone. Castable while moving!`, c: '#aaa' });
            } else {
                let scLvl = sp.scaleLevel !== undefined ? sp.scaleLevel : 8;
                lines.push(...buildBreakdown('Damage', bDmg, scLvl, scAD, scAP));
                if (sp.slowDuration) lines.push({ t: `    Slow: ${Math.round((1-(sp.slowMod||0.6))*100)}% for ${sp.slowDuration}s`, c: '#ffcc00' });
                if (sp.stunDuration) lines.push({ t: `    Stun: ${sp.stunDuration}s`, c: '#ffcc00' });
                if (sp.silenceDuration) lines.push({ t: `    Silence: ${sp.silenceDuration}s`, c: '#ffcc00' });
            }
            if (sp.bonusMaxHpDmg) lines.push({ t: `    +${Math.round(sp.bonusMaxHpDmg*100)}% target Max HP as bonus magic dmg`, c: '#f9a' });
            if (sp.bonusCurrentHpDmg) lines.push({ t: `    +${Math.round(sp.bonusCurrentHpDmg*100)}% target Current HP as bonus magic dmg`, c: '#f9a' });
            return lines;
        };

        ctx.fillStyle = '#fff'; ctx.fillText(`[Q] Lvl ${q.level} | CD: ${player.computeSpellCooldown('Q').toFixed(1)}s (-5%/Lvl) | Cast: ${q.castTime || 0}s`, leftM, startY); startY += 20;
        ctx.fillStyle = '#ddd'; startY = wrapText(`    "${q.desc}"`, leftM, startY, panelW - 40, 18) + 12;
        let linesQ = getSpellStatString(q, player);
        for(let l of linesQ) { ctx.fillStyle = l.c; ctx.fillText(l.t, leftM, startY); startY += 18; }
        startY += 12;
        
        ctx.fillStyle = '#fff'; ctx.fillText(`[E] Lvl ${e.level} | CD: ${player.computeSpellCooldown('E').toFixed(1)}s (-5%/Lvl) | Cast: ${e.castTime || 0}s`, leftM, startY); startY += 20;
        ctx.fillStyle = '#ddd'; startY = wrapText(`    "${e.desc}"`, leftM, startY, panelW - 40, 18) + 12;
        let linesE = getSpellStatString(e, player);
        for(let l of linesE) { ctx.fillStyle = l.c; ctx.fillText(l.t, leftM, startY); startY += 18; }
        startY += 12;

        ctx.fillStyle = '#ffcc00'; ctx.fillText(`SUMMONER SPELL`, leftM, startY); startY += 25;
        let sumSpell = SUMMONER_SPELLS[player.summonerSpell];
        ctx.fillStyle = '#fff'; ctx.fillText(`[F / L] ${player.summonerSpell} - Cooldown: ${sumSpell.cd}s`, leftM, startY); startY += 20;
        ctx.fillStyle = '#ddd'; startY = wrapText(`    "${sumSpell.desc}"`, leftM, startY, panelW - 40, 18) + 18;

        // ── ITEMS ────────────────────────────────────────────────────────
        const ownedIds = player.items || [];
        ctx.fillStyle = '#ffcc00'; ctx.font = `bold 13px monospace`;
        ctx.fillText(`ITEMS  (${ownedIds.length})`, leftM, startY); startY += 6;
        // horizontal rule
        ctx.fillStyle = '#333';
        ctx.fillRect(leftM, startY, panelW - leftM * 2, 1); startY += 10;

        if (ownedIds.length === 0) {
            ctx.fillStyle = '#444'; ctx.font = `12px monospace`;
            ctx.fillText('  No items purchased yet', leftM, startY); startY += 18;
        } else {
            // Aggregate duplicates
            const counts = {};
            const order = [];
            for (const id of ownedIds) {
                if (!counts[id]) order.push(id);
                counts[id] = (counts[id] || 0) + 1;
            }
            for (const id of order) {
                if (startY > panelH - 20) break;
                const it = getShopItem(id);
                if (!it) continue;
                const cnt = counts[id];
                const cntStr = cnt > 1 ? ` ×${cnt}` : '';
                ctx.fillStyle = '#7cf'; ctx.font = `bold 11px monospace`;
                ctx.fillText(`  ${it.name}${cntStr}  ${it.cost}g`, leftM, startY); startY += 15;
                ctx.fillStyle = '#888'; ctx.font = `10px monospace`;
                const descLine = `    ${it.desc}`;
                if (ctx.measureText(descLine).width > panelW - leftM - 10) {
                    startY = wrapText(descLine, leftM, startY, panelW - leftM - 8, 14) + 6;
                } else {
                    ctx.fillText(descLine, leftM, startY); startY += 16;
                }
            }
        }

        // ── ITEM MECHANICS GUIDE ─────────────────────────────────────────
        const _mLs = player.lifesteal || 0, _mSv = player.spellVamp || 0;
        const _mGw = player.antiHeal || 0, _mSw = player.onHitSlow || 0, _mSs = player.onSpellHitSlow || 0;
        if (_mLs > 0 || _mSv > 0 || _mGw > 0 || _mSw > 0 || _mSs > 0) {
            if (startY < panelH - 30) {
                startY += 6;
                ctx.fillStyle = '#ffcc00'; ctx.font = `bold 12px monospace`;
                ctx.fillText('ITEM MECHANICS', leftM, startY); startY += 5;
                ctx.fillStyle = '#333'; ctx.fillRect(leftM, startY, panelW - leftM * 2, 1); startY += 10;
                const mLines = [];
                if (_mLs > 0) mLines.push(
                    { h: `LIFESTEAL  (${Math.round(_mLs*100)}%)`, c: '#cc88ff' },
                    { t: `Heals you for ${Math.round(_mLs*100)}% of basic-attack damage dealt.` },
                    { t: `AoE hits (e.g. splash) heal only 20% of the normal rate` },
                    { t: `to prevent heal-stacking when hitting multiple targets.` }
                );
                if (_mSv > 0) mLines.push(
                    { h: `SPELL VAMP  (${Math.round(_mSv*100)}%)`, c: '#cc88ff' },
                    { t: `Heals you for ${Math.round(_mSv*100)}% of spell damage dealt.` },
                    { t: `Same AoE cap as Lifesteal — 20% rate past the first target.` }
                );
                if (_mGw > 0) mLines.push(
                    { h: `ANTI-HEAL / GRIEVOUS WOUNDS  (${Math.round(_mGw*100)}%)`, c: '#ff8844' },
                    { t: `On-hit: applies GRIEVOUS WOUNDS to the enemy for 3 seconds.` },
                    { t: `Reduces ALL healing they receive by ${Math.round(_mGw*100)}% (heals, lifesteal,` },
                    { t: `spell vamp, HP regen). Does NOT stack — strongest effect wins.` }
                );
                if (_mSw > 0) mLines.push(
                    { h: `SLOW ON HIT  (${Math.round(_mSw*100)}%)`, c: '#44ccff' },
                    { t: `Basic attacks reduce enemy movement speed by ${Math.round(_mSw*100)}%` },
                    { t: `for a short duration after impact.` }
                );
                if (_mSs > 0) mLines.push(
                    { h: `SLOW ON SPELL  (${Math.round(_mSs*100)}%)`, c: '#44ccff' },
                    { t: `Spells reduce enemy movement speed by ${Math.round(_mSs*100)}%` },
                    { t: `for a short duration after impact.` }
                );
                for (const ml of mLines) {
                    if (startY > panelH - 14) break;
                    if (ml.h) {
                        ctx.fillStyle = ml.c; ctx.font = `bold 10px monospace`;
                        ctx.fillText(`  ${ml.h}`, leftM, startY); startY += 14;
                    } else {
                        ctx.fillStyle = '#777'; ctx.font = `10px monospace`;
                        ctx.fillText(`    ${ml.t}`, leftM, startY); startY += 13;
                    }
                }
            }
        }

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

// Returns world-space static vision zones: powerup center + tower ring path
function getStaticVisionPoints() {
  const pts = [{ x: 1993, y: 1567, r: 380 }]; // powerup center
  if (game.towers && game.towers.length > 0) {
    for (let i = 0; i < game.towers.length; i++) {
      const t1 = game.towers[i], t2 = game.towers[(i + 1) % game.towers.length];
      pts.push({ x: t1.pos.x, y: t1.pos.y, r: 420 });
      const dx = t2.pos.x - t1.pos.x, dy = t2.pos.y - t1.pos.y;
      const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / 260));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        pts.push({ x: t1.pos.x + dx * t, y: t1.pos.y + dy * t, r: 340 });
      }
    }
  }
  return pts;
}

function drawFogOfWar(ctx, cw, ch, dpr) {
  if (!player || !game.started || game.gameOver || game.isSpectator) return;
  const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  // Render fog at 1/8 resolution and scale up → chunky pixel blocks that fit the ASCII aesthetic
  const PIXEL = 8;
  const fw = Math.ceil(pw / PIXEL), fh = Math.ceil(ph / PIXEL);
  if (!game._fogCanvas || game._fogCanvas.width !== fw || game._fogCanvas.height !== fh) {
    game._fogCanvas = document.createElement('canvas');
    game._fogCanvas.width = fw; game._fogCanvas.height = fh;
    game._fogCtx = game._fogCanvas.getContext('2d');
  }
  const fc = game._fogCtx;
  fc.setTransform(1, 0, 0, 1, 0, 0);
  fc.globalCompositeOperation = 'source-over';
  fc.fillStyle = 'rgba(90,90,100,1.0)'; // solid in small canvas; alpha applied on upscale
  fc.fillRect(0, 0, fw, fh);
  fc.globalCompositeOperation = 'destination-out';
  const visionR = Math.min(cw, ch) * 0.676 * dpr; // full-res vision radius
  function cutCircle(wx, wy, rFull) {
    const sx = (wx - camera.x) * camera.scale * dpr / PIXEL;
    const sy = (wy - camera.y) * camera.scale * dpr / PIXEL;
    const r = rFull / PIXEL;
    // Short gradient so the edge is chunky when scaled up (70%→100% of radius only)
    const grad = fc.createRadialGradient(sx, sy, r * 0.70, sx, sy, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    fc.fillStyle = grad;
    fc.beginPath(); fc.arc(sx, sy, r, 0, Math.PI * 2); fc.fill();
  }
  for (const p of game.players) {
    if (!p.alive || p.team !== player.team) continue;
    cutCircle(p.pos.x, p.pos.y, visionR);
  }
  for (const sp of getStaticVisionPoints()) {
    cutCircle(sp.x, sp.y, sp.r * camera.scale * dpr);
  }
  fc.globalCompositeOperation = 'source-over';
  // Upscale with nearest-neighbour → pixelated blocks; 0.72 alpha → floor/walls dimly visible
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(game._fogCanvas, 0, 0, cw, ch);
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

export function drawMinimap(){
  const mm = document.getElementById('minimap');
  if (!game.started || game.gameOver) { mm.style.visibility = 'hidden'; return; }
  mm.style.visibility = 'visible';
  const w = mm.clientWidth, h = mm.clientHeight;
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
  // Vision radius matching what the player sees on screen (+30%)
  const cw_fog = canvas.clientWidth, ch_fog = canvas.clientHeight;
  const visionRWorld = (!player || game.isSpectator) ? Infinity : Math.min(cw_fog, ch_fog) * 0.676 / camera.scale;
  const visionRSq = visionRWorld * visionRWorld;
  const _staticVisionPts = getStaticVisionPoints();
  function mmVisible(wx, wy) {
    if (!isFinite(visionRSq)) return true;
    for (const ap of game.players) {
      if (!ap.alive || ap.team !== player.team) continue;
      const dx = wx - ap.pos.x, dy = wy - ap.pos.y;
      if (dx*dx + dy*dy <= visionRSq) return true;
    }
    for (const sp of _staticVisionPts) {
      const dx = wx - sp.x, dy = wy - sp.y;
      if (dx*dx + dy*dy <= sp.r * sp.r) return true;
    }
    return false;
  }

  for(let t of game.towers){ const x = t.pos.x * scaleX; const y = t.pos.y * scaleY; ctxm.fillStyle = t.owner===0? '#486FED' : t.owner===1? '#FF4E4E' : '#777'; ctxm.fillRect(x-3,y-3,6,6); }
  for(let m of game.minions){
    if (player && !game.isSpectator && m.team !== player.team && !mmVisible(m.pos.x, m.pos.y)) continue;
    const x = m.pos.x * scaleX; const y = m.pos.y * scaleY; ctxm.fillStyle = m.team===0? '#aaddff':'#ffb3b3'; ctxm.fillRect(x-1,y-1,2,2);
  }
  for(let p of game.players){
    if (!p.alive) continue;
    if (player && !game.isSpectator && p.team !== player.team && !mmVisible(p.pos.x, p.pos.y)) continue;
    const x = p.pos.x * scaleX; const y = p.pos.y * scaleY;
    ctxm.fillStyle = p.team === 0 ? '#486FED' : '#FF4E4E';
    ctxm.font = (p === player ? 'bold 16px' : 'bold 12px') + ' monospace';
    ctxm.textAlign = 'center'; ctxm.textBaseline = 'middle';
    ctxm.fillText(p.glyph, x, y);
  }

  // Fog overlay on minimap
  if (player && !game.isSpectator && isFinite(visionRWorld)) {
    const mmDpr = window.devicePixelRatio || 1;
    const mmFogW = Math.round(w * mmDpr), mmFogH = Math.round(h * mmDpr);
    if (!game._mmFogCanvas || game._mmFogCanvas.width !== mmFogW || game._mmFogCanvas.height !== mmFogH) {
      game._mmFogCanvas = document.createElement('canvas');
      game._mmFogCanvas.width = mmFogW; game._mmFogCanvas.height = mmFogH;
      game._mmFogCtx = game._mmFogCanvas.getContext('2d');
    }
    const fmCtx = game._mmFogCtx;
    fmCtx.setTransform(1, 0, 0, 1, 0, 0);
    fmCtx.globalCompositeOperation = 'source-over';
    fmCtx.fillStyle = 'rgba(90,90,100,0.76)';
    fmCtx.fillRect(0, 0, mmFogW, mmFogH);
    fmCtx.globalCompositeOperation = 'destination-out';
    const visionRMM = visionRWorld * scaleX * mmDpr;
    function mmCutCircle(wx, wy, rMM) {
      const mx = wx * scaleX * mmDpr, my = wy * scaleY * mmDpr;
      const grad = fmCtx.createRadialGradient(mx, my, rMM * 0.65, mx, my, rMM);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      fmCtx.fillStyle = grad;
      fmCtx.beginPath(); fmCtx.arc(mx, my, rMM, 0, Math.PI*2); fmCtx.fill();
    }
    for (const ap of game.players) {
      if (!ap.alive || ap.team !== player.team) continue;
      mmCutCircle(ap.pos.x, ap.pos.y, visionRMM);
    }
    for (const sp of _staticVisionPts) {
      mmCutCircle(sp.x, sp.y, sp.r * scaleX * mmDpr);
    }
    fmCtx.globalCompositeOperation = 'source-over';
    ctxm.drawImage(game._mmFogCanvas, 0, 0, w, h);
  }

  // Redraw map boundary + walls on top of fog so they're always visible
  if (!game.minimapOverlay || game.minimapOverlay.width !== Math.floor(w * (window.devicePixelRatio||1))) {
    const ovDpr = window.devicePixelRatio || 1;
    game.minimapOverlay = document.createElement('canvas');
    game.minimapOverlay.width = Math.floor(w * ovDpr); game.minimapOverlay.height = Math.floor(h * ovDpr);
    const ovCtx = game.minimapOverlay.getContext('2d');
    ovCtx.scale(ovDpr, ovDpr);
    ovCtx.strokeStyle = '#666'; ovCtx.lineWidth = 1;
    ovCtx.beginPath(); ovCtx.moveTo(mapBoundary[0].x * scaleX, mapBoundary[0].y * scaleY);
    for (let i = 1; i < mapBoundary.length; i++) ovCtx.lineTo(mapBoundary[i].x * scaleX, mapBoundary[i].y * scaleY);
    ovCtx.closePath(); ovCtx.stroke();
    const isMobileOv = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const mmSpacingOv = isMobileOv ? 90 : 66;
    ovCtx.fillStyle = '#666'; ovCtx.font = '10px monospace'; ovCtx.textAlign = 'center'; ovCtx.textBaseline = 'middle';
    for (const wObj of game.walls) {
      const sx0 = Math.floor((wObj.bbox.minX - wObj.r) / mmSpacingOv) * mmSpacingOv;
      const ex0 = Math.ceil((wObj.bbox.maxX + wObj.r) / mmSpacingOv) * mmSpacingOv;
      const sy0 = Math.floor((wObj.bbox.minY - wObj.r) / mmSpacingOv) * mmSpacingOv;
      const ey0 = Math.ceil((wObj.bbox.maxY + wObj.r) / mmSpacingOv) * mmSpacingOv;
      for (let wx = sx0; wx <= ex0; wx += mmSpacingOv) {
        for (let wy = sy0; wy <= ey0; wy += mmSpacingOv) {
          const info = distToPoly(wx, wy, wObj.pts);
          if (info.inside || info.minDist <= wObj.r) ovCtx.fillText('#', wx * scaleX, wy * scaleY);
        }
      }
    }
  }
  ctxm.drawImage(game.minimapOverlay, 0, 0, w, h);

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
            const blueSummary = getTeamDominionSummary(0);
            const redSummary = getTeamDominionSummary(1);
            let html = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; font-size:12px; font-family:monospace;">
                <div style="background:#000; border:1px solid #4488ff; padding:8px; color:#aac4ff;">
                    <div style="font-weight:bold; color:#4488ff; margin-bottom:4px; letter-spacing:2px;">[ BLUE TEAM ]</div>
                    <div>AVG LVL: ${blueSummary.avgLevel.toFixed(1)} | AVG GOLD: ${Math.round(blueSummary.avgGold)} | AVG PCS: ${Math.round(blueSummary.avgPCS)}</div>
                </div>
                <div style="background:#000; border:1px solid #ff4444; padding:8px; color:#ffaaaa;">
                    <div style="font-weight:bold; color:#ff4444; margin-bottom:4px; letter-spacing:2px;">[ RED TEAM ]</div>
                    <div>AVG LVL: ${redSummary.avgLevel.toFixed(1)} | AVG GOLD: ${Math.round(redSummary.avgGold)} | AVG PCS: ${Math.round(redSummary.avgPCS)}</div>
                </div>
            </div>`;
            html += '<table style="width:100%; border-collapse: collapse;">'; html += '<tr style="border-bottom:1px solid #444;"><th>Hero</th><th>K/D/A</th><th>Dmg Dealt</th><th>Dmg to Heroes</th><th>Dmg to Minions</th><th>Dmg Taken</th><th>Healed</th><th>Gold</th><th>PCS</th></tr>';
            let sorted = [...game.players].sort((a,b)=>computeDominionPCS(b).total - computeDominionPCS(a).total || (b.kills*2+b.assists)-(a.kills*2+a.assists));
      for(let p of sorted) {
          let color = p.team === 0 ? '#486FED' : '#FF4E4E'; if (p === player) color = '#0f0';
                    const pcs = computeDominionPCS(p);
                    html += `<tr style="color:${color}; text-align:center;"><td style="text-align:left; padding:4px;">${p.className}</td><td>${p.kills}/${p.deaths}/${p.assists}</td><td>${p.stats.dmgDealt}</td><td>${p.stats.dmgDealtToHeroes || 0}</td><td>${p.stats.dmgDealtToMinions || 0}</td><td>${p.stats.dmgTaken}</td><td>${Math.round(p.stats.hpHealed)}</td><td>${Math.floor(p.totalGold)}</td><td>${pcs.total}</td></tr>`;
      }
      html += '</table>'; statsDiv.innerHTML = html; overlay.classList.remove('hidden'); 
  }
}

export function buildMenu() {
  let m = document.getElementById('menu'); if(!m) { m = document.createElement('div'); m.id = 'menu'; document.body.appendChild(m); }
  m.style.position = 'fixed'; m.style.top = '0'; m.style.left = '0'; m.style.width = '100%'; m.style.height = '100%'; m.style.zIndex = '9999'; m.style.display = 'block'; m.style.background = 'rgba(0,0,0,0.85)'; m.style.overflowY = 'auto'; m.style.padding = '5vh 0 25vh 0'; m.style.boxSizing = 'border-box'; m.style.WebkitOverflowScrolling = 'touch'; m.style.touchAction = 'auto'; m.style.pointerEvents = 'auto';
  let selectedClass = 'Bruiser'; let selectedTeam = 0; let selectedSpell = 'Heal'; let isSpectator = false;
  m.innerHTML = `
      <div id="roomBrowser" style="margin: 0 auto; background:#000; padding:2vw; border:1px solid #333; color:#ccc; text-align:center; width: 90vw; max-width: 600px; box-sizing:border-box; font-family:monospace; display: ${socket ? 'block' : 'none'};">
          <h1 style="margin-top:0; color:#ffcc00; letter-spacing:3px; font-family:monospace;">[ UTF ARENA - BROWSE GAMES ]</h1>
          <div style="margin-bottom: 20px; display:flex; gap:10px; justify-content:center;">
              <input type="text" id="newRoomInput" placeholder="Enter Room Name..." style="padding:10px; font-size:14px; font-family:monospace; background:#000; color:#0f0; border:1px solid #444; width: 60%;">
              <button id="createRoomBtn" style="padding:10px 20px; font-size:14px; font-weight:bold; cursor:pointer; font-family:monospace; background:#000; color:#0f0; border:2px solid #0f0;">[ CREATE ROOM ]</button>
          </div>
          <div id="roomListContainer" style="text-align:left; background:#000; padding:15px; border:1px solid #333; min-height: 200px; max-height: 300px; overflow-y:auto;">
              <h3 style="margin-top:0; color:#ffcc00; border-bottom:1px solid #444; padding-bottom:10px; font-family:monospace; letter-spacing:2px;">-- ACTIVE ROOMS --</h3>
              <ul id="roomList" style="list-style:none; padding:0; margin:0; font-family:monospace; font-size:14px;">
                  <li>Loading rooms...</li>
              </ul>
          </div>
      </div>
      <div id="roomLobby" style="margin: 0 auto; display: ${socket ? 'none' : 'flex'}; background:#000; padding:1vw; border:1px solid #333; color:#ccc; text-align:center; width: 95vw; max-width: 1200px; box-sizing:border-box; font-family:monospace; flex-direction:column; max-height: 95vh; overflow: hidden;">
      <!-- Header -->
      <div style="display:flex; flex-shrink: 0; justify-content:space-between; align-items:center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
          <h1 id="lobbyTitle" style="margin:0; font-size: 20px; color: #ffcc00; font-family:monospace; letter-spacing:3px;">[ OFFLINE MODE ]</h1>
          <div style="display:flex; gap:10px;">
              <button id="btnSpec" style="padding:6px 12px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#aaa; border:1px solid #555;">[ SPECTATE ]</button>
              <button id="leaveRoomBtn" style="display: ${socket ? 'block' : 'none'}; padding:6px 12px; cursor:pointer; font-family:monospace; background:#000; color:#ff4444; border:1px solid #ff4444; font-weight:bold;">[ LEAVE ]</button>
          </div>
      </div>
      
      <!-- 3 Columns Layout -->
      <div class="three-col-layout" style="display:flex; flex-wrap: nowrap; flex-grow: 1; flex-shrink: 1; gap: 15px; min-height: 0; margin-bottom: 10px; overflow-x: auto; overflow-y: hidden; padding-bottom: 5px;">
          <!-- Left: Blue Team -->
          <div class="team-box">
              <div class="team-header blue-header">BLUE TEAM</div>
              <ul id="blueTeamList" class="player-list"></ul>
              <div class="team-footer">
                  <button id="btnBlue" style="width: 100%; padding:8px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#4488ff; border:1px solid #4488ff; margin-bottom: 5px;">[ JOIN BLUE ]</button>
                  <details style="text-align: left; background: #000; padding: 5px; border: 1px solid #222;">
                      <summary style="cursor:pointer; color:#888; font-size:11px; font-family:monospace; outline:none;">Bot Difficulty (<span id="blueBotLabel">100%</span>)</summary>
                      <input type="range" id="blueBotSlider" min="50" max="200" step="10" value="100" style="width:100%; margin-top: 5px;">
                  </details>
              </div>
          </div>

          <!-- Center: Champion Roster -->
          <div class="center-roster">
              <div style="background: #000; padding: 10px; font-weight: bold; border-bottom: 1px solid #333; color: #ffcc00; font-family:monospace; letter-spacing:2px; flex-shrink: 0;">-- CHOOSE YOUR HERO --</div>
              <div class="roster-scroll-area" style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column;">
                  <div id="classBtns" style="padding: 10px; text-align: left; flex-shrink: 0;"></div>

                  <!-- ZDE JE PŘESUNUTÝ FOOTER -->
                  <div style="flex-shrink: 0; background: #000; padding: 10px; border-top: 1px solid #333; display:flex; flex-direction:column; align-items:center; margin-top: auto;">
                      <div style="font-size: 11px; color: #ffcc00; margin-bottom: 4px; font-weight:bold; font-family:monospace; letter-spacing:2px;">-- SUMMONER SPELL --</div>
                      <div id="spellBtns" style="display:flex; gap: 5px; flex-wrap: wrap; justify-content:center;"></div>
                  </div>
                  <div class="footer-controls" style="flex-shrink: 0; background: #000; padding: 10px; border-top: 1px solid #333; display:flex; flex-direction:column; gap: 10px;">
                      <ul id="specList" style="list-style:none; padding:0; margin:0; font-size: 11px; color: #888; text-align: center; max-height: 40px; overflow-y:auto; display:flex; flex-direction:column; font-family:monospace;"></ul>
                      <div style="display:flex; align-items:center; gap: 10px; justify-content: center; flex-wrap: wrap;">
                          <span style="display:flex; gap: 5px;">
                              <button id="lobbyUpBtn" style="cursor:pointer; padding:8px 14px; background:#000; color:#aaa; border:1px solid #444; font-weight:bold; font-family:monospace;">▲</button>
                              <button id="lobbyDownBtn" style="cursor:pointer; padding:8px 14px; background:#000; color:#aaa; border:1px solid #444; font-weight:bold; font-family:monospace;">▼</button>
                          </span>
                          <button id="readyBtn" style="display: ${socket ? 'block' : 'none'}; padding:8px 18px; font-size:14px; font-weight:bold; cursor:pointer; font-family:monospace; background:#000; color:#aaa; border:2px solid #555; flex-grow:1;">[ READY ]</button>
                          <button id="startBtn" style="padding:8px 18px; font-size:14px; font-weight:bold; cursor:pointer; font-family:monospace; background:#010f01; color:#0f0; border:2px solid #0f0; flex-grow:1;">[ START MATCH ]</button>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Right: Red Team -->
          <div class="team-box">
              <div class="team-header red-header">RED TEAM</div>
              <ul id="redTeamList" class="player-list"></ul>
              <div class="team-footer">
                  <button id="btnRed" style="width: 100%; padding:8px; cursor:pointer; font-weight:bold; font-family:monospace; background:#000; color:#ff4444; border:1px solid #ff4444; margin-bottom: 5px;">[ JOIN RED ]</button>
                  <details style="text-align: left; background: #000; padding: 5px; border: 1px solid #222;">
                      <summary style="cursor:pointer; color:#888; font-size:11px; font-family:monospace; outline:none;">Bot Difficulty (<span id="redBotLabel">100%</span>)</summary>
                      <input type="range" id="redBotSlider" min="50" max="200" step="10" value="100" style="width:100%; margin-top: 5px;">
                  </details>
              </div>
          </div>
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
          if (socket && socket.connected) {
              myReady = !myReady;
              socket.emit('toggle_ready', myReady);
          }
      };
  }

  const btnBlue = document.getElementById('btnBlue'), btnRed = document.getElementById('btnRed'), btnSpec = document.getElementById('btnSpec');
  const teamBtns = [btnBlue, btnRed, btnSpec];
  const selectionDivs = [document.getElementById('classBtns'), document.getElementById('spellBtns')];
  const startBtn = document.getElementById('startBtn');

  btnBlue.onclick = (e) => { selectedTeam = 0; isSpectator = false; teamBtns.forEach(b=>{ b.style.borderColor='#444'; b.style.color='#888'; }); e.target.style.borderColor='#4488ff'; e.target.style.color='#4488ff'; selectionDivs.forEach(d=>d.style.opacity=1); if(!socket){ startBtn.disabled = false; startBtn.style.opacity = 1; } notifyServer(); };
  btnRed.onclick = (e) => { selectedTeam = 1; isSpectator = false; teamBtns.forEach(b=>{ b.style.borderColor='#444'; b.style.color='#888'; }); e.target.style.borderColor='#ff4444'; e.target.style.color='#ff4444'; selectionDivs.forEach(d=>d.style.opacity=1); if(!socket){ startBtn.disabled = false; startBtn.style.opacity = 1; } notifyServer(); };
  btnSpec.onclick = (e) => { selectedTeam = -1; isSpectator = true; teamBtns.forEach(b=>{ b.style.borderColor='#444'; b.style.color='#888'; }); e.target.style.borderColor='#aaa'; e.target.style.color='#aaa'; selectionDivs.forEach(d=>d.style.opacity=0.3); if(!socket){ startBtn.disabled = false; startBtn.style.opacity = 1; } notifyServer(); };

  const cBtns = document.getElementById('classBtns');
  const catGroups = { 
      'FIGHTER': ['Bruiser', 'Vanguard', 'Jirina'], 
      'TANK': ['Ironclad', 'Goliath', 'Hana', 'Jailer'], 
      'ASSASSIN': ['Lynx', 'Zephyr', 'Reaper', 'Wanderer'],
      'RANGED': ['Quiller', 'Kratoma', 'Fusilier'],
      'MAGE': ['Mage', 'Summoner', 'Pyromancer', 'Tamer'], 
      'SUPPORT': ['Healer', 'Cleric', 'Eggchanter', 'Oracle', 'Doctor'] 
  };
  const allBtns = [];
  for(let cat in catGroups) {
      let catTitle = document.createElement('div');
      catTitle.textContent = cat;
      catTitle.style.color = '#ffcc00'; catTitle.style.fontSize = '11px'; catTitle.style.fontWeight = 'bold'; catTitle.style.fontFamily = 'monospace'; catTitle.style.letterSpacing = '2px'; catTitle.style.marginBottom = '5px'; catTitle.style.borderBottom = '1px solid #333'; catTitle.style.paddingBottom = '3px';
      cBtns.appendChild(catTitle);
      
      let grid = document.createElement('div');
      grid.className = 'champ-grid';
      
      catGroups[cat].forEach(c => {
          const classInfo = CLASSES[c]; if(!classInfo) return;
          const type = classInfo.dmgType === 'physical' ? '#ffcc00' : '#d270ff'; // Yellow for AD, Purple for AP
          let btn = document.createElement('button'); 
          btn.className = 'champ-btn';
          btn.dataset.className = c; 
          btn.innerHTML = `<div class="champ-icon" style="color:${type}">${classInfo.glyph}</div><div class="champ-name">${c}</div>`;
          btn.onclick = () => {
              selectedClass = c;
              allBtns.forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              notifyServer();
          };
          grid.appendChild(btn); allBtns.push(btn);
      });
      cBtns.appendChild(grid);
  } setTimeout(() => { let b = allBtns.find(x => x.dataset.className === 'Bruiser'); if(b) b.click(); }, 50); // Default Bruiser

  const sBtns = document.getElementById('spellBtns');
  const allSpells = [];
  const tooltip = document.createElement('div');
  tooltip.style.position = 'fixed'; tooltip.style.background = '#000'; tooltip.style.border = '1px solid #555'; tooltip.style.color = '#ccc'; tooltip.style.padding = '8px'; tooltip.style.display = 'none'; tooltip.style.pointerEvents = 'none'; tooltip.style.fontSize = '12px'; tooltip.style.fontFamily = 'monospace';
  document.body.appendChild(tooltip);

  for (let s in SUMMONER_SPELLS) {
      let btn = document.createElement('button'); btn.textContent = s; btn.dataset.spell = s; btn.style.padding = '6px 10px'; btn.style.background = '#000'; btn.style.color = '#888'; btn.style.border = '1px solid #333'; btn.style.cursor = 'pointer'; btn.style.fontWeight = 'bold'; btn.style.fontFamily = 'monospace'; btn.style.fontSize = '11px';
      btn.onclick = () => { selectedSpell = s; allSpells.forEach(b => { b.style.borderColor = '#333'; b.style.background = '#000'; b.style.color = '#888'; }); btn.style.borderColor = '#0f0'; btn.style.background = '#010f01'; btn.style.color = '#0f0'; notifyServer(); };
      btn.onmouseover = (e) => { const spell = SUMMONER_SPELLS[s]; tooltip.innerHTML = `<b>${spell.name}</b><br>${spell.desc}<br><i>Cooldown: ${spell.cd}s</i>`; tooltip.style.display = 'block'; };
      btn.onmousemove = (e) => { tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY + 15) + 'px'; };
      btn.onmouseout = () => { tooltip.style.display = 'none'; };
      sBtns.appendChild(btn); allSpells.push(btn);
  } setTimeout(() => { let b = allSpells.find(x => x.textContent === 'Heal'); if(b) b.click(); }, 50);

  function notifyServer() { if(socket) socket.emit('update_selection', { className: selectedClass, team: selectedTeam, summonerSpell: selectedSpell }); }
  startBtn.addEventListener('click', () => { requestLandscapeFullscreen(); if(socket && socket.connected) socket.emit('start_game'); else { m.style.display = 'none'; startGame(selectedClass, selectedTeam, isSpectator, selectedSpell); } });

  let blueBotDiff = 100, redBotDiff = 100;
  const blueSlider = document.getElementById('blueBotSlider');
  const blueLabel = document.getElementById('blueBotLabel');
  const redSlider = document.getElementById('redBotSlider');
  const redLabel = document.getElementById('redBotLabel');

  if (blueSlider) {
      blueSlider.oninput = () => { blueLabel.textContent = blueSlider.value + '%'; };
      blueSlider.onchange = () => { blueBotDiff = parseInt(blueSlider.value);
          if (socket) socket.emit('update_settings', { blueBotDiff, redBotDiff }); else game.blueBotDifficulty = blueBotDiff / 100;
      };
  }
  if (redSlider) {
      redSlider.oninput = () => { redLabel.textContent = redSlider.value + '%'; };
      redSlider.onchange = () => { redBotDiff = parseInt(redSlider.value);
          if (socket) socket.emit('update_settings', { blueBotDiff, redBotDiff }); else game.redBotDifficulty = redBotDiff / 100;
      };
  }

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