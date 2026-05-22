/**
 * SimUI.js — Self-contained simulation control panel.
 *
 * Toggle: Ctrl+Shift+S  (the "SIM" button is intentionally hidden)
 *
 * Supports up to 8 parallel simulation workers, each with independent
 * config (game mode, draft, class pool, etc.).
 */

import { SimulationEngine, ALL_CLASSES } from './Simulation.js';
import {
    computeAggregateStats,
    exportPlayerCSV,
    exportClassCSV,
    exportItemCSV,
    exportBuildCSV,
    exportGameModeCSV,
    exportStrategyCSV,
    exportJSON,
    downloadFile,
} from './SimStats.js';

// ─── State ────────────────────────────────────────────────────────────────────
const MAX_SLOTS  = 8;
const _slots     = Array.from({ length: MAX_SLOTS }, () => ({
    engine:    null,
    results:   [],
    aggregate: null,
    startTs:   null,
    running:   false,
}));

// Merged results across all slots (for combined export)
let _mergedResults   = [];
let _mergedAggregate = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init);
else _init();

function _init() {
    _injectStyles();
    _buildPanel();
    // Toggle button is hidden by default — only Ctrl+Shift+S opens the panel
    _buildToggleBtn();
    _bindHotkey();
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _injectStyles() {
    const css = `
#simPanel {
    position: fixed; bottom: 48px; right: 14px; z-index: 99999;
    width: 520px; max-height: 92vh;
    background: rgba(10,10,14,0.97); border: 1px solid #fc0;
    border-radius: 8px; color: #ddd; font: 13px/1.5 monospace;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 4px 32px rgba(0,0,0,0.8);
}
#simPanel.sim-hidden { display: none !important; }
#simPanel header {
    padding: 8px 12px 6px; background: rgba(255,204,0,0.12);
    border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;
    user-select: none;
}
#simPanel header h2 { margin: 0; font-size: 14px; color: #fc0; letter-spacing: 1px; }
#simPanel header small { color: #888; font-size: 11px; }
#simPanel .sim-body { padding: 10px 12px; overflow-y: auto; flex: 1; }

.sim-row { display: flex; align-items: center; margin-bottom: 5px; gap: 8px; }
.sim-row label { flex: 0 0 138px; color: #aaa; font-size: 12px; }
.sim-row input[type=number], .sim-row select {
    flex: 1; background: #111; color: #eee; border: 1px solid #444;
    padding: 3px 6px; border-radius: 4px; font: inherit;
}
.sim-row input[type=range] { flex: 1; accent-color: #fc0; }
.sim-row span.val { flex: 0 0 38px; text-align: right; color: #fc0; font-size: 12px; }

.sim-btns { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.sim-btn { padding: 5px 12px; border-radius: 5px; border: none; font: inherit; font-size: 12px; cursor: pointer; }
.sim-btn:disabled { opacity: .45; cursor: not-allowed; }
.sim-btn-start  { background: #4c4; color: #000; font-weight: bold; }
.sim-btn-stop   { background: #c44; color: #fff; }
.sim-btn-export { background: #448; color: #eef; }
.sim-btn-json   { background: #484; color: #eff; }
.sim-btn-clear  { background: #333; color: #aaa; }
.sim-btn-all    { background: #a64; color: #fff; font-weight: bold; }

/* Slot tabs */
.sim-slots { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
.sim-slot-tab {
    padding: 3px 10px; border-radius: 4px; border: 1px solid #444;
    background: #1a1a1a; color: #888; font: 11px monospace; cursor: pointer;
}
.sim-slot-tab.active    { border-color: #fc0; color: #fc0; background: rgba(255,204,0,0.1); }
.sim-slot-tab.running   { border-color: #4c4; color: #4c4; }
.sim-slot-tab.done      { border-color: #448; color: #aaf; }

/* Progress */
#simProgress { margin-top: 8px; }
.sim-prog-bar-wrap { background: #222; border-radius: 4px; height: 12px; overflow: hidden; margin-bottom: 3px; border: 1px solid #333; }
.sim-prog-bar { height: 100%; background: #fc0; transition: width .2s; width: 0; }
.sim-prog-text { font-size: 11px; color: #888; }

/* Per-slot progress rows */
.sim-all-progress { margin-top: 8px; }
.sim-slot-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; font-size: 11px; }
.sim-slot-row .slot-label { flex: 0 0 42px; color: #888; }
.sim-slot-row .slot-bar-wrap { flex: 1; background: #222; border-radius: 3px; height: 10px; overflow: hidden; }
.sim-slot-row .slot-bar { height: 100%; background: #fc0; transition: width .15s; width: 0; }
.sim-slot-row .slot-info { flex: 0 0 90px; text-align: right; color: #888; }

/* Results */
#simResults { margin-top: 10px; }
#simResults h3 { font-size: 13px; color: #fc0; margin: 0 0 6px; }
.sim-table-wrap { overflow-x: auto; }
.sim-tbl { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
.sim-tbl th { background: #1a1a1a; color: #fc0; padding: 3px 6px; text-align: right; border-bottom: 1px solid #333; }
.sim-tbl th:first-child { text-align: left; }
.sim-tbl td { padding: 2px 6px; text-align: right; border-bottom: 1px solid #1e1e1e; }
.sim-tbl td:first-child { text-align: left; color: #fc0; }
.sim-tbl tr:hover td { background: rgba(255,204,0,0.06); }
.sim-wr-high { color: #4f4; } .sim-wr-low { color: #f44; } .sim-wr-mid { color: #fa4; }

/* Hidden toggle button (still in DOM for programmatic use) */
#simToggleBtn { display: none; }
`;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
}

// ─── Build panel ──────────────────────────────────────────────────────────────
function _buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'simPanel';
    panel.className = 'sim-hidden';
    panel.innerHTML = `
<header>
  <h2>⚙ SIMULATION LAB</h2>
  <small>Ctrl+Shift+S to toggle</small>
</header>
<div class="sim-body">

  <!-- Slot selector -->
  <div style="font-size:11px;color:#888;margin-bottom:4px;">Simulation slot (run up to 8 in parallel):</div>
  <div class="sim-slots" id="simSlotTabs"></div>

  <!-- Config ─────────────────────────────────────────── -->
  <div class="sim-row">
    <label>Game mode</label>
    <select id="simGameMode">
      <option value="random">🎲 Random (all modes)</option>
      <option value="arena">Arena (4v4)</option>
      <option value="classic">Dominion (5v5)</option>
      <option value="speed">Speed Dominion (5v5)</option>
      <option value="aram">ARAM</option>
    </select>
  </div>

  <div class="sim-row">
    <label>Draft mode</label>
    <select id="simDraftMode">
      <option value="clever">Clever (smart draft)</option>
      <option value="random">Random (all classes)</option>
      <option value="mixed">Mixed (team0 clever / team1 random)</option>
    </select>
  </div>

  <div class="sim-row">
    <label>Games</label>
    <input id="simNumGames" type="number" min="1" max="10000" value="200" style="width:80px">
  </div>

  <div class="sim-row">
    <label>CPU budget (ms/burst)</label>
    <input id="simSpeed" type="range" min="10" max="200" value="50">
    <span class="val" id="simSpeedVal">50ms</span>
  </div>

  <div class="sim-row">
    <label>Yield (ms pause)</label>
    <input id="simYield" type="range" min="0" max="50" value="8">
    <span class="val" id="simYieldVal">8ms</span>
  </div>

  <div class="sim-row">
    <label>Difficulty</label>
    <input id="simDiff" type="range" min="50" max="200" step="5" value="200">
    <span class="val" id="simDiffVal">2.0</span>
  </div>

  <div class="sim-row">
    <label>Class pool</label>
    <select id="simClassMode">
      <option value="smart">Smart draft (auto)</option>
      <option value="random">Random from all</option>
      <option value="fixed">Fixed selection…</option>
    </select>
  </div>

  <div id="simClassPicker" style="display:none; margin-bottom:6px;">
    <div style="font-size:11px;color:#888;margin-bottom:4px;">Select classes for the pool (min 2):</div>
    <div id="simClassCheckboxes" style="display:flex;flex-wrap:wrap;gap:4px;"></div>
  </div>

  <!-- Buttons ─────────────────────────────────────────── -->
  <div class="sim-btns">
    <button id="simStartBtn"   class="sim-btn sim-btn-start">▶ Run slot</button>
    <button id="simStartAllBtn" class="sim-btn sim-btn-all">▶▶ Run all 8</button>
    <button id="simStopBtn"    class="sim-btn sim-btn-stop"  disabled>■ Stop slot</button>
    <button id="simStopAllBtn" class="sim-btn sim-btn-stop"  disabled>■■ Stop all</button>
    <button id="simClearBtn"   class="sim-btn sim-btn-clear" disabled>✕ Clear all</button>
  </div>

  <!-- Per-slot progress bars -->
  <div class="sim-all-progress" id="simAllProgress"></div>

  <!-- Active slot progress (detailed) -->
  <div id="simProgress" style="display:none;margin-top:6px;">
    <div class="sim-prog-bar-wrap"><div class="sim-prog-bar" id="simProgBar"></div></div>
    <div class="sim-prog-text" id="simProgText">Starting…</div>
  </div>

  <!-- Results ─────────────────────────────────────────── -->
  <div id="simResults" style="display:none;">
    <h3 id="simResultsTitle">Results</h3>
    <div style="font-size:11px;color:#888;margin-bottom:6px;" id="simMeta"></div>

    <div class="sim-table-wrap">
      <table class="sim-tbl" id="simClassTable">
        <thead>
          <tr>
            <th>Class</th><th>Games</th><th>WR%</th>
            <th>KDA</th><th>DPS</th><th>Burst1s</th><th>Burst3s</th>
            <th>HPS</th><th>Surv%</th><th>GPM</th><th>PCS</th>
          </tr>
        </thead>
        <tbody id="simClassTbody"></tbody>
      </table>
    </div>

    <div style="margin-top:10px;">
      <div style="font-size:12px;color:#fc0;margin-bottom:4px;">Item Win Rates</div>
      <div class="sim-table-wrap">
        <table class="sim-tbl" id="simItemTable">
          <thead><tr><th>Item</th><th>Appearances</th><th>WR%</th></tr></thead>
          <tbody id="simItemTbody"></tbody>
        </table>
      </div>
    </div>

    <div class="sim-btns" style="margin-top:10px;">
      <button id="simExportPlayers"  class="sim-btn sim-btn-export">↓ Player CSV</button>
      <button id="simExportClass"    class="sim-btn sim-btn-export">↓ Class CSV</button>
      <button id="simExportItems"    class="sim-btn sim-btn-export">↓ Item CSV</button>
      <button id="simExportBuilds"   class="sim-btn sim-btn-export">↓ Build CSV</button>
      <button id="simExportGameMode" class="sim-btn sim-btn-export">↓ GameMode CSV</button>
      <button id="simExportStrategy" class="sim-btn sim-btn-export">↓ Strategy CSV</button>
      <button id="simExportJSON"     class="sim-btn sim-btn-json">↓ Full JSON</button>
    </div>
  </div>

</div>`;

    document.body.appendChild(panel);
    const $ = id => document.getElementById(id);

    // ── Slot tabs ─────────────────────────────────────────────────────────────
    const tabsEl = $('simSlotTabs');
    for (let i = 0; i < MAX_SLOTS; i++) {
        const tab = document.createElement('button');
        tab.className     = 'sim-slot-tab' + (i === 0 ? ' active' : '');
        tab.dataset.slot  = i;
        tab.textContent   = `S${i + 1}`;
        tab.addEventListener('click', () => _selectSlot(i));
        tabsEl.appendChild(tab);
    }

    // Per-slot progress bars
    const allProg = $('simAllProgress');
    for (let i = 0; i < MAX_SLOTS; i++) {
        const row = document.createElement('div');
        row.className = 'sim-slot-row';
        row.id        = `slotRow${i}`;
        row.innerHTML = `<span class="slot-label">S${i+1}</span>
            <div class="slot-bar-wrap"><div class="slot-bar" id="slotBar${i}"></div></div>
            <span class="slot-info" id="slotInfo${i}">idle</span>`;
        allProg.appendChild(row);
    }

    // ── Slider labels ─────────────────────────────────────────────────────────
    $('simSpeed').addEventListener('input', () => $('simSpeedVal').textContent = $('simSpeed').value + 'ms');
    $('simYield').addEventListener('input', () => $('simYieldVal').textContent = $('simYield').value + 'ms');
    $('simDiff').addEventListener('input',  () => $('simDiffVal').textContent  = (_r1(+$('simDiff').value / 100)).toFixed(1));
    $('simClassMode').addEventListener('change', () => {
        $('simClassPicker').style.display = $('simClassMode').value === 'fixed' ? 'block' : 'none';
    });

    // Class checkboxes
    const cbBox = $('simClassCheckboxes');
    for (const cls of ALL_CLASSES) {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:2px;background:#1a1a1a;padding:2px 5px;border-radius:3px;cursor:pointer;';
        lbl.innerHTML = `<input type="checkbox" value="${cls}" checked> ${cls}`;
        cbBox.appendChild(lbl);
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    $('simStartBtn')   .addEventListener('click', () => _startSlot(_activeSlot()));
    $('simStartAllBtn').addEventListener('click', _startAllSlots);
    $('simStopBtn')    .addEventListener('click', () => _stopSlot(_activeSlot()));
    $('simStopAllBtn') .addEventListener('click', _stopAllSlots);
    $('simClearBtn')   .addEventListener('click', _clearAll);

    // ── Export ────────────────────────────────────────────────────────────────
    $('simExportPlayers') .addEventListener('click', () => downloadFile(`sim_players_${Date.now()}.csv`,  exportPlayerCSV(_mergedResults)));
    $('simExportClass')   .addEventListener('click', () => _mergedAggregate && downloadFile(`sim_classes_${Date.now()}.csv`,    exportClassCSV(_mergedAggregate)));
    $('simExportItems')   .addEventListener('click', () => _mergedAggregate && downloadFile(`sim_items_${Date.now()}.csv`,      exportItemCSV(_mergedAggregate)));
    $('simExportBuilds')  .addEventListener('click', () => _mergedAggregate && downloadFile(`sim_builds_${Date.now()}.csv`,     exportBuildCSV(_mergedAggregate)));
    $('simExportGameMode').addEventListener('click', () => _mergedAggregate && downloadFile(`sim_gamemodes_${Date.now()}.csv`,  exportGameModeCSV(_mergedAggregate)));
    $('simExportStrategy').addEventListener('click', () => _mergedAggregate && downloadFile(`sim_strategies_${Date.now()}.csv`, exportStrategyCSV(_mergedAggregate)));
    $('simExportJSON')    .addEventListener('click', () => _mergedAggregate && downloadFile(`sim_full_${Date.now()}.json`,      exportJSON(_mergedAggregate, _mergedResults), 'application/json'));
}

// ─── Toggle button (hidden, but kept for hotkey reference) ────────────────────
function _buildToggleBtn() {
    const btn = document.createElement('button');
    btn.id = 'simToggleBtn';
    btn.textContent = 'SIM';
    btn.addEventListener('click', _togglePanel);
    document.body.appendChild(btn);
}
function _togglePanel() {
    document.getElementById('simPanel').classList.toggle('sim-hidden');
}

// ─── Hotkey ───────────────────────────────────────────────────────────────────
function _bindHotkey() {
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            _togglePanel();
        }
    });
}

// ─── Slot management ──────────────────────────────────────────────────────────
let _currentSlot = 0;

function _activeSlot() { return _currentSlot; }

function _selectSlot(idx) {
    _currentSlot = idx;
    document.querySelectorAll('.sim-slot-tab').forEach((t, i) => {
        t.classList.toggle('active', i === idx);
    });
    // Refresh progress/results for this slot
    const slot = _slots[idx];
    if (slot.aggregate) _renderResults(slot.aggregate, slot.results);
    const $ = id => document.getElementById(id);
    $('simStartBtn').disabled = slot.running;
    $('simStopBtn').disabled  = !slot.running;
}

function _buildConfig() {
    const $ = id => document.getElementById(id);
    const numGames   = Math.max(1, Math.min(10000, +$('simNumGames').value || 200));
    const budgetMs   = Math.max(10, Math.min(200,  +$('simSpeed').value   || 50));
    const yieldMs    = Math.max(0,  Math.min(50,   +$('simYield').value   || 8));
    const difficulty = _r1(+$('simDiff').value / 100);
    const gameMode   = $('simGameMode').value || 'random';
    const draftMode  = $('simDraftMode').value || 'clever';
    const classMode  = $('simClassMode').value;

    let classFilter = null;
    if (classMode === 'fixed') {
        classFilter = [...document.querySelectorAll('#simClassCheckboxes input:checked')].map(cb => cb.value);
        if (classFilter.length < 2) { alert('Select at least 2 classes.'); return null; }
    } else if (classMode === 'random') {
        classFilter = ALL_CLASSES;
    }

    return { numGames, budgetMs, yieldMs, difficulty, gameMode, draftMode, classFilter };
}

function _startSlot(idx) {
    const cfg = _buildConfig();
    if (!cfg) return;
    const slot = _slots[idx];
    if (slot.running) return;

    slot.results   = [];
    slot.aggregate = null;
    slot.running   = true;
    slot.startTs   = performance.now();

    const $ = id => document.getElementById(id);
    $('simStartBtn').disabled   = true;
    $('simStopBtn').disabled    = false;
    $('simStopAllBtn').disabled = false;
    $('simProgress').style.display = 'block';
    $('simProgBar').style.width    = '0%';
    $('simProgText').textContent   = `Slot ${idx+1}: initialising…`;

    _updateSlotTab(idx, 'running');
    _updateSlotBar(idx, 0, 'running…');

    slot.engine = new SimulationEngine();
    const startTs = slot.startTs;

    slot.engine.start(cfg, {
        onProgress: ({ current, total, simTime }) => {
            if (_currentSlot !== idx) return;
            const pct = total > 0 ? Math.round(current / total * 100) : 0;
            const eta = _estimateETA(startTs, current, total);
            $('simProgBar').style.width  = pct + '%';
            $('simProgText').textContent =
                `Slot ${idx+1}: ${current}/${total} (${pct}%)` +
                (simTime ? `  · last: ${Math.round(simTime)}s` : '') +
                (eta ? `  · ETA ~${eta}` : '');
            _updateSlotBar(idx, pct, `${current}/${total}`);
        },
        onComplete: (aggregate, results) => {
            slot.results   = results;
            slot.aggregate = aggregate;
            slot.running   = false;
            slot.engine    = null;
            _rebuildMerged();
            _updateSlotTab(idx, 'done');
            _updateSlotBar(idx, 100, `✓ ${results.length}`);
            if (_currentSlot === idx) {
                _renderResults(aggregate, results, performance.now() - startTs);
                $('simStartBtn').disabled = false;
                $('simStopBtn').disabled  = true;
            }
            _refreshStopAllBtn();
        },
    }).catch(err => {
        if (err.message.includes('Stopped')) return;
        console.error(`[SimUI] Slot ${idx} error:`, err);
        slot.running = false;
        _updateSlotTab(idx, '');
        _updateSlotBar(idx, 0, '⚠ error');
    });
}

function _startAllSlots() {
    for (let i = 0; i < MAX_SLOTS; i++) {
        if (!_slots[i].running) setTimeout(() => _startSlot(i), i * 80);
    }
}

function _stopSlot(idx) {
    const slot = _slots[idx];
    if (!slot.running || !slot.engine) return;
    const partial = slot.engine.results.slice();
    slot.engine.stop();
    slot.engine  = null;
    slot.running = false;

    if (partial.length > 0) {
        slot.results   = partial;
        slot.aggregate = computeAggregateStats(partial);
        _rebuildMerged();
        _updateSlotTab(idx, 'done');
        _updateSlotBar(idx, 100, `✓ ${partial.length} (stopped)`);
        if (_currentSlot === idx) _renderResults(slot.aggregate, partial);
    } else {
        _updateSlotTab(idx, '');
        _updateSlotBar(idx, 0, 'idle');
    }

    const $ = id => document.getElementById(id);
    if (_currentSlot === idx) { $('simStartBtn').disabled = false; $('simStopBtn').disabled = true; }
    _refreshStopAllBtn();
}

function _stopAllSlots() {
    for (let i = 0; i < MAX_SLOTS; i++) _stopSlot(i);
}

function _clearAll() {
    _stopAllSlots();
    for (const slot of _slots) { slot.results = []; slot.aggregate = null; }
    _mergedResults = []; _mergedAggregate = null;
    document.querySelectorAll('.sim-slot-tab').forEach(t => { t.classList.remove('running', 'done'); });
    for (let i = 0; i < MAX_SLOTS; i++) _updateSlotBar(i, 0, 'idle');
    const $ = id => document.getElementById(id);
    $('simResults').style.display  = 'none';
    $('simProgress').style.display = 'none';
    $('simClearBtn').disabled      = true;
    $('simStartBtn').disabled      = false;
    $('simStopBtn').disabled       = true;
}

function _refreshStopAllBtn() {
    const anyRunning = _slots.some(s => s.running);
    document.getElementById('simStopAllBtn').disabled = !anyRunning;
}

// ─── Slot UI helpers ──────────────────────────────────────────────────────────
function _updateSlotTab(idx, state) {
    const tab = document.querySelectorAll('.sim-slot-tab')[idx];
    if (!tab) return;
    tab.classList.remove('running', 'done');
    if (state) tab.classList.add(state);
}

function _updateSlotBar(idx, pct, info) {
    const bar  = document.getElementById(`slotBar${idx}`);
    const infoEl = document.getElementById(`slotInfo${idx}`);
    if (bar) bar.style.width = pct + '%';
    if (infoEl) infoEl.textContent = info;
}

function _rebuildMerged() {
    _mergedResults = _slots.flatMap(s => s.results);
    _mergedAggregate = _mergedResults.length > 0 ? computeAggregateStats(_mergedResults) : null;
    document.getElementById('simClearBtn').disabled = _mergedResults.length === 0;
}

// ─── Render results ───────────────────────────────────────────────────────────
function _renderResults(aggregate, results, wallMs) {
    const $ = id => document.getElementById(id);

    $('simResultsTitle').textContent = `Results — ${results.length} games`;
    $('simMeta').textContent =
        `Avg: ${aggregate.avgGameDuration}s  Min: ${aggregate.minGameDuration}s  Max: ${aggregate.maxGameDuration}s  ·  ` +
        `Blue WR: ${aggregate.team0WinRate}%  Red WR: ${aggregate.team1WinRate}%` +
        (wallMs ? `  ·  ${(wallMs / 1000).toFixed(1)}s real` : '') +
        (aggregate.gameModeStats ? `  ·  modes: ${Object.keys(aggregate.gameModeStats).join(', ')}` : '');

    const tbody = $('simClassTbody');
    tbody.innerHTML = '';
    const sorted = Object.entries(aggregate.classStats).sort((a, b) => b[1].winRate - a[1].winRate);
    for (const [cls, data] of sorted) {
        const s   = data.stats;
        const wr  = data.winRate;
        const wrC = wr >= 55 ? 'sim-wr-high' : wr <= 45 ? 'sim-wr-low' : 'sim-wr-mid';
        const tr  = document.createElement('tr');
        tr.innerHTML = `
<td>${cls}</td><td>${data.gamesPlayed}</td><td class="${wrC}">${wr}%</td>
<td>${s.kda?.avg ?? '–'}</td><td>${s.dpsToHeroes?.avg ?? '–'}</td>
<td>${s.maxBurst1s?.avg ?? '–'}</td><td>${s.maxBurst3s?.avg ?? '–'}</td>
<td>${s.hpsHealed?.avg ?? '–'}</td>
<td>${s.survivalRate?.avg ?? '–'}</td>
<td>${s.goldPerMin?.avg ?? '–'}</td>
<td>${s.pcs?.avg ?? '–'}</td>`;
        tbody.appendChild(tr);
    }

    const iBody = $('simItemTbody');
    iBody.innerHTML = '';
    const sortedItems = Object.entries(aggregate.itemStats).filter(([, d]) => d.appearances >= 5).sort((a, b) => b[1].winRate - a[1].winRate);
    for (const [id, data] of sortedItems) {
        const wr  = data.winRate;
        const wrC = wr >= 55 ? 'sim-wr-high' : wr <= 45 ? 'sim-wr-low' : 'sim-wr-mid';
        const tr  = document.createElement('tr');
        tr.innerHTML = `<td>${id}</td><td>${data.appearances}</td><td class="${wrC}">${wr}%</td>`;
        iBody.appendChild(tr);
    }

    $('simResults').style.display = 'block';
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function _estimateETA(startTs, current, total) {
    if (current === 0) return '';
    const elapsed = (performance.now() - startTs) / 1000;
    const rem     = (elapsed / current) * (total - current);
    if (rem < 5)   return '<5s';
    if (rem < 60)  return Math.round(rem) + 's';
    return Math.round(rem / 60) + 'min ' + (Math.round(rem) % 60) + 's';
}
const _r1 = v => Math.round(v * 10) / 10;
