/**
 * SimUI.js — Self-contained simulation control panel.
 * Toggle: Ctrl+Shift+S  (the "SIM" button is intentionally hidden)
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
let _engine    = null;
let _results   = [];
let _aggregate = null;
let _startTs   = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init);
else _init();

function _init() {
    _injectStyles();
    _buildPanel();
    _buildToggleBtn();
    _bindHotkey();
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _injectStyles() {
    const css = `
#simPanel {
    position: fixed; bottom: 48px; right: 14px; z-index: 99999;
    width: 500px; max-height: 92vh;
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
.sim-row span.val { flex: 0 0 42px; text-align: right; color: #fc0; font-size: 12px; }

.sim-btns { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.sim-btn { padding: 5px 12px; border-radius: 5px; border: none; font: inherit; font-size: 12px; cursor: pointer; }
.sim-btn:disabled { opacity: .45; cursor: not-allowed; }
.sim-btn-start  { background: #4c4; color: #000; font-weight: bold; }
.sim-btn-stop   { background: #c44; color: #fff; }
.sim-btn-export { background: #448; color: #eef; }
.sim-btn-json   { background: #484; color: #eff; }
.sim-btn-clear  { background: #333; color: #aaa; }

#simProgress { margin-top: 8px; }
.sim-prog-bar-wrap { background: #222; border-radius: 4px; height: 12px; overflow: hidden; margin-bottom: 3px; border: 1px solid #333; }
.sim-prog-bar { height: 100%; background: #fc0; transition: width .2s; width: 0; }
.sim-prog-text { font-size: 11px; color: #888; }

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

  <!-- Config -->
  <div class="sim-row">
    <label>Game mode</label>
    <select id="simGameMode">
      <option value="random" selected>🎲 Random (all modes)</option>
      <option value="arena">Arena (4v4)</option>
      <option value="classic">Dominion (5v5)</option>
      <option value="speed">Speed Dominion (5v5)</option>
      <option value="aram">ARAM</option>
    </select>
  </div>

  <div class="sim-row">
    <label>Draft mode</label>
    <select id="simDraftMode">
      <option value="random" selected>Random (all classes)</option>
      <option value="clever">Clever (smart draft)</option>
      <option value="mixed">Mixed (team0 clever / team1 random)</option>
    </select>
  </div>

  <div class="sim-row">
    <label>Games</label>
    <input id="simNumGames" type="number" min="1" max="10000" value="150" style="width:80px">
  </div>

  <div class="sim-row">
    <label>CPU budget (ms/burst)</label>
    <input id="simSpeed" type="range" min="10" max="200" value="150">
    <span class="val" id="simSpeedVal">150ms</span>
  </div>

  <div class="sim-row">
    <label>Yield (ms pause)</label>
    <input id="simYield" type="range" min="0" max="50" value="1">
    <span class="val" id="simYieldVal">1ms</span>
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

  <!-- Buttons -->
  <div class="sim-btns">
    <button id="simStartBtn" class="sim-btn sim-btn-start">▶ Run</button>
    <button id="simStopBtn"  class="sim-btn sim-btn-stop" disabled>■ Stop</button>
    <button id="simClearBtn" class="sim-btn sim-btn-clear" disabled>✕ Clear</button>
  </div>

  <!-- Progress -->
  <div id="simProgress" style="display:none; margin-top:6px;">
    <div class="sim-prog-bar-wrap"><div class="sim-prog-bar" id="simProgBar"></div></div>
    <div class="sim-prog-text" id="simProgText">Starting…</div>
  </div>

  <!-- Results -->
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

    // Slider labels
    $('simSpeed').addEventListener('input', () => $('simSpeedVal').textContent = $('simSpeed').value + 'ms');
    $('simYield').addEventListener('input', () => $('simYieldVal').textContent = $('simYield').value + 'ms');

    // Class pool picker
    $('simClassMode').addEventListener('change', () => {
        $('simClassPicker').style.display = $('simClassMode').value === 'fixed' ? 'block' : 'none';
    });
    const cbBox = $('simClassCheckboxes');
    for (const cls of ALL_CLASSES) {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:2px;background:#1a1a1a;padding:2px 5px;border-radius:3px;cursor:pointer;';
        lbl.innerHTML = `<input type="checkbox" value="${cls}" checked> ${cls}`;
        cbBox.appendChild(lbl);
    }

    // Buttons
    $('simStartBtn').addEventListener('click', _start);
    $('simStopBtn') .addEventListener('click', _stop);
    $('simClearBtn').addEventListener('click', _clear);

    // Export
    $('simExportPlayers') .addEventListener('click', () => _results.length  && downloadFile(`sim_players_${Date.now()}.csv`,    exportPlayerCSV(_results)));
    $('simExportClass')   .addEventListener('click', () => _aggregate       && downloadFile(`sim_classes_${Date.now()}.csv`,    exportClassCSV(_aggregate)));
    $('simExportItems')   .addEventListener('click', () => _aggregate       && downloadFile(`sim_items_${Date.now()}.csv`,      exportItemCSV(_aggregate)));
    $('simExportBuilds')  .addEventListener('click', () => _aggregate       && downloadFile(`sim_builds_${Date.now()}.csv`,     exportBuildCSV(_aggregate)));
    $('simExportGameMode').addEventListener('click', () => _aggregate       && downloadFile(`sim_gamemodes_${Date.now()}.csv`,  exportGameModeCSV(_aggregate)));
    $('simExportStrategy').addEventListener('click', () => _aggregate       && downloadFile(`sim_strategies_${Date.now()}.csv`, exportStrategyCSV(_aggregate)));
    $('simExportJSON')    .addEventListener('click', () => _aggregate       && downloadFile(`sim_full_${Date.now()}.json`,      exportJSON(_aggregate, _results), 'application/json'));
}

// ─── Toggle button ────────────────────────────────────────────────────────────
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

// ─── Config ───────────────────────────────────────────────────────────────────
function _buildConfig() {
    const $ = id => document.getElementById(id);
    const numGames  = Math.max(1, Math.min(10000, +$('simNumGames').value || 150));
    const budgetMs  = Math.max(10, Math.min(200,  +$('simSpeed').value   || 150));
    const yieldMs   = Math.max(0,  Math.min(50,   +$('simYield').value   || 1));
    const gameMode  = $('simGameMode').value  || 'random';
    const draftMode = $('simDraftMode').value || 'random';
    const classMode = $('simClassMode').value;

    let classFilter = null;
    if (classMode === 'fixed') {
        classFilter = [...document.querySelectorAll('#simClassCheckboxes input:checked')].map(cb => cb.value);
        if (classFilter.length < 2) { alert('Select at least 2 classes.'); return null; }
    } else if (classMode === 'random') {
        classFilter = ALL_CLASSES;
    }

    return { numGames, budgetMs, yieldMs, difficulty: 1.0, gameMode, draftMode, classFilter };
}

// ─── Run ──────────────────────────────────────────────────────────────────────
function _start() {
    const cfg = _buildConfig();
    if (!cfg) return;
    if (_engine) return;

    _results   = [];
    _aggregate = null;
    _startTs   = performance.now();

    const $ = id => document.getElementById(id);
    $('simStartBtn').disabled = true;
    $('simStopBtn').disabled  = false;
    $('simClearBtn').disabled = true;
    $('simProgress').style.display = 'block';
    $('simProgBar').style.width    = '0%';
    $('simProgText').textContent   = 'Initialising…';

    _engine = new SimulationEngine();

    _engine.start(cfg, {
        onProgress: ({ current, total, simTime }) => {
            const pct = total > 0 ? Math.round(current / total * 100) : 0;
            const eta = _estimateETA(_startTs, current, total);
            $('simProgBar').style.width  = pct + '%';
            $('simProgText').textContent =
                `${current}/${total} (${pct}%)` +
                (simTime ? `  · last: ${Math.round(simTime)}s` : '') +
                (eta     ? `  · ETA ~${eta}` : '');
        },
        onComplete: (aggregate, results) => {
            _engine    = null;
            _results   = results;
            _aggregate = aggregate;
            _renderResults(aggregate, results, performance.now() - _startTs);
            $('simStartBtn').disabled = false;
            $('simStopBtn').disabled  = true;
            $('simClearBtn').disabled = false;
        },
    }).catch(err => {
        if (err.message.includes('Stopped')) return;
        console.error('[SimUI] error:', err);
        _engine = null;
        $('simStartBtn').disabled = false;
        $('simStopBtn').disabled  = true;
    });
}

function _stop() {
    if (!_engine) return;
    const partial = _engine.results.slice();
    _engine.stop();
    _engine = null;

    const $ = id => document.getElementById(id);
    $('simStartBtn').disabled = false;
    $('simStopBtn').disabled  = true;

    if (partial.length > 0) {
        _results   = partial;
        _aggregate = computeAggregateStats(partial);
        _renderResults(_aggregate, partial);
        $('simClearBtn').disabled = false;
    }
}

function _clear() {
    _stop();
    _results   = [];
    _aggregate = null;
    const $ = id => document.getElementById(id);
    $('simResults').style.display  = 'none';
    $('simProgress').style.display = 'none';
    $('simProgBar').style.width    = '0%';
    $('simClearBtn').disabled      = true;
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
    const sortedItems = Object.entries(aggregate.itemStats)
        .filter(([, d]) => d.appearances >= 5)
        .sort((a, b) => b[1].winRate - a[1].winRate);
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
    if (rem < 5)  return '<5s';
    if (rem < 60) return Math.round(rem) + 's';
    return Math.round(rem / 60) + 'min ' + (Math.round(rem) % 60) + 's';
}
