/**
 * SimUI.js — Self-contained simulation control panel.
 *
 * Injects a floating HTML panel into the page.
 * Import this module once (e.g. from a <script type="module"> tag in index.html)
 * and it initialises itself automatically.
 *
 * The panel is toggled with the keyboard shortcut  Ctrl+Shift+S
 * or via the small "SIM" button anchored to the bottom-right corner.
 */

import { SimulationEngine, ALL_CLASSES } from './Simulation.js';
import {
    computeAggregateStats,
    exportPlayerCSV,
    exportClassCSV,
    exportItemCSV,
    exportJSON,
    downloadFile,
} from './SimStats.js';

// ─── Singleton engine ─────────────────────────────────────────────────────────
let _engine    = null;
let _aggregate = null;
let _results   = [];
let _startTs   = null;

// ─── Bootstrap on DOMContentLoaded ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
} else {
    _init();
}

function _init() {
    _injectStyles();
    _buildPanel();
    _buildToggleBtn();
    _bindHotkey();
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _injectStyles() {
    const css = `
/* ── SimUI panel ──────────────────────────────────────────────────────── */
#simPanel {
    position: fixed; bottom: 48px; right: 14px; z-index: 99999;
    width: 440px; max-height: 92vh;
    background: rgba(10,10,14,0.97); border: 1px solid #fc0;
    border-radius: 8px; color: #ddd; font: 13px/1.5 monospace;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 4px 32px rgba(0,0,0,0.8);
    transition: opacity .15s;
}
#simPanel.sim-hidden { display: none !important; }

#simPanel header {
    padding: 8px 12px 6px; background: rgba(255,204,0,0.12);
    border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;
    user-select: none; cursor: default;
}
#simPanel header h2 { margin: 0; font-size: 14px; color: #fc0; letter-spacing: 1px; }
#simPanel header small { color: #888; font-size: 11px; }

#simPanel .sim-body { padding: 10px 12px; overflow-y: auto; flex: 1; }

/* Config rows */
.sim-row { display: flex; align-items: center; margin-bottom: 6px; gap: 8px; }
.sim-row label { flex: 0 0 130px; color: #aaa; font-size: 12px; }
.sim-row input[type=number], .sim-row select {
    flex: 1; background: #111; color: #eee; border: 1px solid #444;
    padding: 3px 6px; border-radius: 4px; font: inherit;
}
.sim-row input[type=range] { flex: 1; accent-color: #fc0; }
.sim-row span.val { flex: 0 0 38px; text-align: right; color: #fc0; font-size: 12px; }

/* Buttons */
.sim-btns { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.sim-btn {
    padding: 5px 12px; border-radius: 5px; border: none;
    font: inherit; font-size: 12px; cursor: pointer; transition: opacity .1s;
}
.sim-btn:disabled { opacity: .45; cursor: not-allowed; }
.sim-btn-start  { background: #4c4; color: #000; font-weight: bold; }
.sim-btn-stop   { background: #c44; color: #fff; }
.sim-btn-export { background: #448; color: #eef; }
.sim-btn-json   { background: #484; color: #eff; }
.sim-btn-clear  { background: #333; color: #aaa; }

/* Progress */
#simProgress { margin-top: 10px; }
.sim-prog-bar-wrap {
    background: #222; border-radius: 4px; height: 14px;
    overflow: hidden; margin-bottom: 4px; border: 1px solid #333;
}
.sim-prog-bar { height: 100%; background: #fc0; transition: width .2s; width: 0; }
.sim-prog-text { font-size: 11px; color: #888; }

/* Results table */
#simResults { margin-top: 12px; }
#simResults h3 { font-size: 13px; color: #fc0; margin: 0 0 6px; }
.sim-table-wrap { overflow-x: auto; }
.sim-tbl {
    width: 100%; border-collapse: collapse; font-size: 11px;
    white-space: nowrap;
}
.sim-tbl th { background: #1a1a1a; color: #fc0; padding: 3px 6px; text-align: right; border-bottom: 1px solid #333; }
.sim-tbl th:first-child { text-align: left; }
.sim-tbl td { padding: 2px 6px; text-align: right; border-bottom: 1px solid #1e1e1e; }
.sim-tbl td:first-child { text-align: left; color: #fc0; }
.sim-tbl tr:hover td { background: rgba(255,204,0,0.06); }
.sim-wr-high { color: #4f4; }
.sim-wr-low  { color: #f44; }
.sim-wr-mid  { color: #fa4; }

/* Toggle button */
#simToggleBtn {
    position: fixed; bottom: 10px; right: 14px; z-index: 99999;
    background: rgba(255,204,0,0.85); color: #000;
    border: none; border-radius: 5px; padding: 4px 10px;
    font: bold 12px monospace; cursor: pointer; letter-spacing: 1px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
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
  <h2>⚙ SIMULATION</h2>
  <small>Ctrl+Shift+S to toggle</small>
</header>
<div class="sim-body">

  <!-- Config ─────────────────────────────────────────── -->
  <div class="sim-row">
    <label>Game mode</label>
    <select id="simGameMode">
      <option value="arena">Arena (4v4)</option>
      <option value="classic">Dominion (5v5)</option>
      <option value="speed">Speed Dominion (5v5)</option>
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
    <button id="simStartBtn"  class="sim-btn sim-btn-start">▶ Run</button>
    <button id="simStopBtn"   class="sim-btn sim-btn-stop"  disabled>■ Stop</button>
    <button id="simClearBtn"  class="sim-btn sim-btn-clear" disabled>✕ Clear</button>
  </div>

  <!-- Progress ─────────────────────────────────────────── -->
  <div id="simProgress" style="display:none;">
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
            <th>HPS</th><th>SurvRate</th><th>GPM</th>
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

    <!-- Export buttons -->
    <div class="sim-btns" style="margin-top:10px;">
      <button id="simExportPlayers" class="sim-btn sim-btn-export">↓ Player CSV</button>
      <button id="simExportClass"   class="sim-btn sim-btn-export">↓ Class CSV</button>
      <button id="simExportItems"   class="sim-btn sim-btn-export">↓ Item CSV</button>
      <button id="simExportJSON"    class="sim-btn sim-btn-json">↓ Full JSON</button>
    </div>
  </div>

</div>`;

    document.body.appendChild(panel);

    // ── Wire up controls ──────────────────────────────────────────────────────
    const $  = id => document.getElementById(id);

    // Speed/yield slider labels
    $('simSpeed').addEventListener('input', () => {
        $('simSpeedVal').textContent = $('simSpeed').value + 'ms';
    });
    $('simYield').addEventListener('input', () => {
        $('simYieldVal').textContent = $('simYield').value + 'ms';
    });

    // Difficulty slider label
    $('simDiff').addEventListener('input', () => {
        $('simDiffVal').textContent = (_r1(+$('simDiff').value / 100)).toFixed(1);
    });

    // Class picker visibility
    $('simClassMode').addEventListener('change', () => {
        const show = $('simClassMode').value === 'fixed';
        $('simClassPicker').style.display = show ? 'block' : 'none';
    });

    // Populate class checkboxes
    const cbBox = $('simClassCheckboxes');
    for (const cls of ALL_CLASSES) {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:2px;background:#1a1a1a;padding:2px 5px;border-radius:3px;cursor:pointer;';
        lbl.innerHTML = `<input type="checkbox" value="${cls}" checked> ${cls}`;
        cbBox.appendChild(lbl);
    }

    // Start
    $('simStartBtn').addEventListener('click', _onStart);
    $('simStopBtn') .addEventListener('click', _onStop);
    $('simClearBtn').addEventListener('click', _onClear);

    // Export
    $('simExportPlayers').addEventListener('click', () => {
        downloadFile(`sim_players_${Date.now()}.csv`, exportPlayerCSV(_results));
    });
    $('simExportClass').addEventListener('click', () => {
        downloadFile(`sim_classes_${Date.now()}.csv`, exportClassCSV(_aggregate));
    });
    $('simExportItems').addEventListener('click', () => {
        downloadFile(`sim_items_${Date.now()}.csv`, exportItemCSV(_aggregate));
    });
    $('simExportJSON').addEventListener('click', () => {
        downloadFile(`sim_full_${Date.now()}.json`, exportJSON(_aggregate, _results), 'application/json');
    });
}

// ─── Toggle button ────────────────────────────────────────────────────────────
function _buildToggleBtn() {
    const btn = document.createElement('button');
    btn.id          = 'simToggleBtn';
    btn.textContent = 'SIM';
    btn.addEventListener('click', _togglePanel);
    document.body.appendChild(btn);
}

function _togglePanel() {
    const panel = document.getElementById('simPanel');
    panel.classList.toggle('sim-hidden');
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

// ─── Event handlers ───────────────────────────────────────────────────────────
function _onStart() {
    const $ = id => document.getElementById(id);

    const numGames      = Math.max(1, Math.min(10000, +$('simNumGames').value || 100));
    const budgetMs      = Math.max(10, Math.min(200,  +$('simSpeed').value    || 50));
    const yieldMs       = Math.max(0,  Math.min(50,   +$('simYield').value    || 8));
    const difficulty    = _r1(+$('simDiff').value / 100);
    const gameMode      = $('simGameMode').value || 'arena';
    const classMode     = $('simClassMode').value;

    let classFilter = null;
    if (classMode === 'fixed') {
        classFilter = [...document.querySelectorAll('#simClassCheckboxes input:checked')]
            .map(cb => cb.value);
        if (classFilter.length < 2) {
            alert('Select at least 2 classes for the fixed pool.');
            return;
        }
    } else if (classMode === 'random') {
        classFilter = ALL_CLASSES; // pool = all, random draft
    }

    // Reset previous results
    _aggregate = null;
    _results   = [];
    $('simResults').style.display  = 'none';
    $('simProgress').style.display = 'block';
    $('simProgBar').style.width    = '0%';
    $('simProgText').textContent   = 'Initialising…';
    $('simStartBtn').disabled      = true;
    $('simStopBtn').disabled       = false;
    $('simClearBtn').disabled      = true;

    _startTs = performance.now();
    const startTs = _startTs;

    _engine = new SimulationEngine();
    _engine.start(
        { numGames, budgetMs, yieldMs, difficulty, classFilter, gameMode },
        {
            onProgress: ({ current, total, simTime }) => {
                const pct  = total > 0 ? Math.round(current / total * 100) : 0;
                const eta  = _estimateETA(startTs, current, total);
                $('simProgBar').style.width  = pct + '%';
                $('simProgText').textContent =
                    `Game ${current} / ${total}  (${pct}%)` +
                    (simTime ? `  ·  last game: ${Math.round(simTime)}s sim` : '') +
                    (eta      ? `  ·  ETA ~${eta}` : '');
            },
            onComplete: (aggregate, results) => {
                _aggregate = aggregate;
                _results   = results;
                _onSimComplete(aggregate, results, performance.now() - startTs);
            },
        }
    ).catch(err => {
        if (err.message.includes('Stopped')) return;
        console.error('[SimUI] Simulation error:', err);
        $('simProgText').textContent = '⚠ Error: ' + err.message;
    });
}

function _onStop() {
    const $ = id => document.getElementById(id);
    if (_engine) {
        // Grab whatever games finished before stopping
        const partial = _engine.results.slice();
        _engine.stop();
        _engine = null;

        if (partial.length > 0) {
            _results   = partial;
            _aggregate = computeAggregateStats(partial);
            _onSimComplete(_aggregate, partial, performance.now() - _startTs);
            $('simProgText').textContent = `Stopped — ${partial.length} games saved.`;
            return;
        }
    }
    $('simStartBtn').disabled = false;
    $('simStopBtn').disabled  = true;
    $('simClearBtn').disabled = _results.length === 0;
    $('simProgText').textContent = 'Stopped.';
}

function _onClear() {
    _aggregate = null; _results = [];
    const $ = id => document.getElementById(id);
    $('simResults').style.display  = 'none';
    $('simProgress').style.display = 'none';
    $('simClearBtn').disabled      = true;
}

// ─── Render results ───────────────────────────────────────────────────────────
function _onSimComplete(aggregate, results, wallMs) {
    const $ = id => document.getElementById(id);

    $('simStartBtn').disabled = false;
    $('simStopBtn').disabled  = true;
    $('simClearBtn').disabled = false;
    $('simProgBar').style.width  = '100%';
    $('simProgText').textContent =
        `✓ ${results.length} games done in ${(wallMs / 1000).toFixed(1)} s real time.`;

    // ── Meta summary ─────────────────────────────────────────────────────────
    $('simMeta').textContent =
        `Avg duration: ${aggregate.avgGameDuration}s  ·  ` +
        `Min: ${aggregate.minGameDuration}s  ·  Max: ${aggregate.maxGameDuration}s  ·  ` +
        `Blue WR: ${aggregate.team0WinRate}%  ·  Red WR: ${aggregate.team1WinRate}%`;

    // ── Class table ───────────────────────────────────────────────────────────
    const tbody = $('simClassTbody');
    tbody.innerHTML = '';

    const sorted = Object.entries(aggregate.classStats)
        .sort((a, b) => b[1].winRate - a[1].winRate);

    for (const [cls, data] of sorted) {
        const s   = data.stats;
        const wr  = data.winRate;
        const wrClass = wr >= 55 ? 'sim-wr-high' : wr <= 45 ? 'sim-wr-low' : 'sim-wr-mid';
        const tr  = document.createElement('tr');
        tr.innerHTML = `
<td>${cls}</td>
<td>${data.gamesPlayed}</td>
<td class="${wrClass}">${wr}%</td>
<td>${s.kda?.avg ?? '–'}</td>
<td>${s.dpsToHeroes?.avg ?? '–'}</td>
<td>${s.maxBurst1s?.avg ?? '–'}</td>
<td>${s.maxBurst3s?.avg ?? '–'}</td>
<td>${s.hpsHealed?.avg ?? '–'}</td>
<td>${s.survivalRate?.avg ?? '–'}</td>
<td>${s.goldPerMin?.avg ?? '–'}</td>`;
        tbody.appendChild(tr);
    }

    // ── Item table ────────────────────────────────────────────────────────────
    const iBody = $('simItemTbody');
    iBody.innerHTML = '';

    const sortedItems = Object.entries(aggregate.itemStats)
        .filter(([, d]) => d.appearances >= 5)
        .sort((a, b) => b[1].winRate - a[1].winRate);

    for (const [id, data] of sortedItems) {
        const wr      = data.winRate;
        const wrClass = wr >= 55 ? 'sim-wr-high' : wr <= 45 ? 'sim-wr-low' : 'sim-wr-mid';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${id}</td><td>${data.appearances}</td><td class="${wrClass}">${wr}%</td>`;
        iBody.appendChild(tr);
    }

    $('simResults').style.display = 'block';
    $('simResultsTitle').textContent = `Results — ${results.length} games`;
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
