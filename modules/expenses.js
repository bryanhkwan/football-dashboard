// ============ EXPENSES MODULE ============
// Dependencies: config.js, matching.js
// Tab 1: CSV/XLSX upload, editable roster, expense charts
// (Refactored from the original app.js)

// ── Column defs ──────────────────────────────────────────────
const EXPENSE_COLUMNS = [
  { key: 'lastName',          label: 'Last Name',     type: 'text',   editable: true  },
  { key: 'firstName',         label: 'First Name',    type: 'text',   editable: true  },
  { key: 'position',          label: 'Position',      type: 'text',   editable: true  },
  { key: 'year',              label: 'Year',          type: 'text',   editable: true  },
  { key: 'campus',            label: 'Housing',       type: 'text',   editable: true  },
  { key: 'revShare',          label: 'Rev Share ($)', type: 'number', editable: true  },
  { key: 'stipend',           label: 'Stipend ($)',   type: 'number', editable: true  },
  { key: 'contractLength',    label: 'Contract (mo)', type: 'number', editable: true  },
  { key: 'totalCompensation', label: 'Total Comp',    type: 'number', editable: false },
];

// ── State ────────────────────────────────────────────────────
let expState = {
  players:     [],
  totalBudget: null,
  fileName:    '',
  nextId:      1,
  sort:        { key: null, dir: 'asc' },
  filter:      { search: '', position: '', year: '', campus: '' },
  editMode:    false,
  reviewFilter:'needs-action',
  subView:     'dashboard', // 'upload' | 'preview' | 'dashboard'
  previewData: null,
};

let expCharts = {};

// ── Persistence ──────────────────────────────────────────────
function expSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      players:     expState.players,
      totalBudget: expState.totalBudget,
      fileName:    expState.fileName,
      nextId:      expState.nextId,
    }));
  } catch (_) {}
}

function expLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.players) && saved.players.length > 0) {
      expState.players     = saved.players;
      expState.totalBudget = saved.totalBudget;
      expState.fileName    = saved.fileName || '';
      expState.nextId      = saved.nextId || (Math.max(...saved.players.map(p => p.id), 0) + 1);
      return true;
    }
  } catch (_) {}
  return false;
}

// ── CSV / XLSX parsing ───────────────────────────────────────
const HEADER_MAP = {
  'last name':                                   'lastName',
  'first name':                                  'firstName',
  'position':                                    'position',
  'year':                                        'year',
  'on/off campus':                               'campus',
  'rev share $':                                 'revShare',
  'contract length (6 months vs 12 months)':     'contractLength',
  'contract length':                             'contractLength',
  'stipend':                                     'stipend',
  'total compensation':                          'totalCompensation',
  'total budget':                                'totalBudget',
};

const normHeader = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function rowsToResult(rows) {
  let headerIdx = -1, rawHeaders = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const filled = rows[i].filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (filled.length >= 2) { rawHeaders = rows[i]; headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('Could not find a header row.');

  const colIdx = {};
  rawHeaders.forEach((h, i) => {
    const key = normHeader(h);
    if (key && HEADER_MAP[key]) colIdx[HEADER_MAP[key]] = i;
  });

  let totalBudget = null;
  if (colIdx.totalBudget !== undefined) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const v = rows[i]?.[colIdx.totalBudget];
      if (v !== null && v !== undefined && String(v).trim() !== '') { totalBudget = toNum(v); break; }
    }
  }

  const players = [], errors = [];
  let id = 1;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v === null || v === undefined || String(v).trim() === '')) continue;

    const lastName  = colIdx.lastName  !== undefined ? String(row[colIdx.lastName]  ?? '').trim() : '';
    const firstName = colIdx.firstName !== undefined ? String(row[colIdx.firstName] ?? '').trim() : '';
    if (!lastName && !firstName) continue;

    const revShare       = colIdx.revShare  !== undefined ? toNum(row[colIdx.revShare])  : 0;
    const stipend        = colIdx.stipend   !== undefined ? toNum(row[colIdx.stipend])   : 0;
    const rawContract    = colIdx.contractLength !== undefined ? String(row[colIdx.contractLength] ?? '').trim() : '';
    const contractLength = rawContract ? toNum(rawContract) : null;

    const player = {
      id: id++,
      lastName, firstName,
      position: String((colIdx.position !== undefined ? row[colIdx.position] : '') ?? '').trim(),
      year:     String((colIdx.year     !== undefined ? row[colIdx.year]     : '') ?? '').trim(),
      campus:   String((colIdx.campus   !== undefined ? row[colIdx.campus]   : '') ?? '').trim(),
      revShare, stipend, contractLength,
      totalCompensation: revShare + stipend,
    };

    if (!player.lastName || !player.firstName)
      errors.push({ row: i + 1, message: `Row ${i + 1}: Missing player name` });

    players.push(player);
  }

  return { players, totalBudget, errors };
}

function parseXLSX(buffer) {
  const wb   = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  return rowsToResult(rows);
}

function parseCSVLine(line) {
  const fields = [];
  let inQuote = false, field = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { field += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(field); field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = text.split(/\r?\n/).map(parseCSVLine);
  return rowsToResult(rows);
}

// ── Calculations ─────────────────────────────────────────────
function expGetStats() {
  const totalCommitted = expState.players.reduce((s, p) => s + (p.totalCompensation || 0), 0);
  return {
    totalBudget:    expState.totalBudget ?? 0,
    totalCommitted,
    remaining:      (expState.totalBudget ?? 0) - totalCommitted,
    playerCount:    expState.players.length,
    avgPerPlayer:   expState.players.length > 0 ? totalCommitted / expState.players.length : 0,
  };
}

function getSpendByPosition() {
  const m = {};
  expState.players.forEach(p => { const k = p.position || 'Unknown'; m[k] = (m[k] || 0) + p.totalCompensation; });
  return Object.entries(m).map(([position, total]) => ({ position, total })).sort((a, b) => b.total - a.total);
}

function getSpendByYear() {
  const m = {};
  expState.players.forEach(p => { const k = p.year || 'Unknown'; m[k] = (m[k] || 0) + p.totalCompensation; });
  return Object.entries(m).map(([year, total]) => ({ year, total })).sort((a, b) => {
    const ai = YEAR_ORDER.indexOf(a.year), bi = YEAR_ORDER.indexOf(b.year);
    if (ai === -1 && bi === -1) return a.year.localeCompare(b.year);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function getCampusBreakdown() {
  const m = {};
  expState.players.forEach(p => {
    const k = p.campus || 'Unknown';
    if (!m[k]) m[k] = { name: k, count: 0, total: 0 };
    m[k].count++; m[k].total += p.totalCompensation;
  });
  return Object.values(m).sort((a, b) => b.total - a.total);
}

function getContractBreakdown() {
  const m = {};
  expState.players.forEach(p => { const k = p.contractLength !== null ? `${p.contractLength}-Month` : 'Unknown'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([name, count]) => ({ name, count }))
    .sort((a, b) => { const an = parseFloat(a.name), bn = parseFloat(b.name); return (!isNaN(an) && !isNaN(bn)) ? an - bn : a.name.localeCompare(b.name); });
}

// ── Chart Helpers ────────────────────────────────────────────
const EXP_COLORS = {
  green:  ['#22c55e','#16a34a','#4ade80','#15803d','#86efac','#166534','#bbf7d0'],
  blue:   ['#3b82f6','#2563eb','#60a5fa','#1d4ed8','#93c5fd'],
  amber:  ['#f59e0b','#d97706','#fbbf24','#b45309','#fde68a'],
  purple: ['#a855f7','#7c3aed','#c084fc','#6d28d9','#d8b4fe'],
};

const EXP_TOOLTIP = {
  backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
  titleColor: '#f1f5f9', bodyColor: '#94a3b8', padding: 10,
};
const EXP_TICK = { color: '#94a3b8', font: { size: 11 } };
const EXP_GRID_H = { color: '#334155', borderColor: 'transparent' };
const EXP_GRID_N = { color: 'transparent', borderColor: 'transparent' };

function expDestroyCharts() {
  Object.values(expCharts).forEach(c => { try { c.destroy(); } catch (_) {} });
  expCharts = {};
}

function expInitCharts() {
  expDestroyCharts();

  const posData = getSpendByPosition();
  expCharts.position = new Chart(document.getElementById('chart-position'), {
    type: 'bar',
    data: { labels: posData.map(d => d.position), datasets: [{ data: posData.map(d => d.total), backgroundColor: EXP_COLORS.green, borderRadius: 4, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...EXP_TOOLTIP, callbacks: { label: ctx => fmtMoney(ctx.raw) } } },
      scales: { x: { ticks: EXP_TICK, grid: EXP_GRID_N }, y: { ticks: { ...EXP_TICK, callback: v => `$${v}` }, grid: EXP_GRID_H } },
    },
  });

  const yearData = getSpendByYear();
  expCharts.year = new Chart(document.getElementById('chart-year'), {
    type: 'bar',
    data: { labels: yearData.map(d => d.year), datasets: [{ data: yearData.map(d => d.total), backgroundColor: EXP_COLORS.blue, borderRadius: 4, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...EXP_TOOLTIP, callbacks: { label: ctx => fmtMoney(ctx.raw) } } },
      scales: { x: { ticks: EXP_TICK, grid: EXP_GRID_N }, y: { ticks: { ...EXP_TICK, callback: v => `$${v}` }, grid: EXP_GRID_H } },
    },
  });

  const campusData = getCampusBreakdown();
  expCharts.campus = new Chart(document.getElementById('chart-campus'), {
    type: 'bar',
    data: { labels: campusData.map(d => d.name), datasets: [{ data: campusData.map(d => d.total), backgroundColor: EXP_COLORS.amber, borderRadius: 4, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...EXP_TOOLTIP, callbacks: { label: ctx => { const d = campusData[ctx.dataIndex]; return `${d.count} player${d.count !== 1 ? 's' : ''} — ${fmtMoney(ctx.raw)}`; } } } },
      scales: { x: { ticks: EXP_TICK, grid: EXP_GRID_N }, y: { ticks: { ...EXP_TICK, callback: v => `$${v}` }, grid: EXP_GRID_H } },
    },
  });

  const contractData = getContractBreakdown();
  expCharts.contract = new Chart(document.getElementById('chart-contract'), {
    type: 'doughnut',
    data: {
      labels: contractData.map(d => d.name),
      datasets: [{ data: contractData.map(d => d.count), backgroundColor: EXP_COLORS.purple, borderColor: '#0f172a', borderWidth: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } }, tooltip: { ...EXP_TOOLTIP, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} player${ctx.raw !== 1 ? 's' : ''}` } } },
    },
  });
}

function expUpdateCharts() {
  const posData = getSpendByPosition();
  if (expCharts.position) {
    expCharts.position.data.labels = posData.map(d => d.position);
    expCharts.position.data.datasets[0].data = posData.map(d => d.total);
    expCharts.position.data.datasets[0].backgroundColor = EXP_COLORS.green.slice(0, posData.length);
    expCharts.position.update();
  }
  const yearData = getSpendByYear();
  if (expCharts.year) {
    expCharts.year.data.labels = yearData.map(d => d.year);
    expCharts.year.data.datasets[0].data = yearData.map(d => d.total);
    expCharts.year.data.datasets[0].backgroundColor = EXP_COLORS.blue.slice(0, yearData.length);
    expCharts.year.update();
  }
  const campusData = getCampusBreakdown();
  if (expCharts.campus) {
    expCharts.campus.data.labels = campusData.map(d => d.name);
    expCharts.campus.data.datasets[0].data = campusData.map(d => d.total);
    expCharts.campus.data.datasets[0].backgroundColor = EXP_COLORS.amber.slice(0, campusData.length);
    expCharts.campus.update();
  }
  const contractData = getContractBreakdown();
  if (expCharts.contract) {
    expCharts.contract.data.labels = contractData.map(d => d.name);
    expCharts.contract.data.datasets[0].data = contractData.map(d => d.count);
    expCharts.contract.data.datasets[0].backgroundColor = EXP_COLORS.purple.slice(0, contractData.length);
    expCharts.contract.update();
  }
}

// ── Player helpers ───────────────────────────────────────────
function expGetFilteredSorted() {
  const { search, position, year, campus } = expState.filter;
  const q = search.toLowerCase();
  let list = expState.players.filter(p => {
    if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
    if (position && p.position !== position) return false;
    if (year && p.year !== year) return false;
    if (campus && p.campus !== campus) return false;
    return true;
  });
  const { key, dir } = expState.sort;
  if (key) {
    list = list.slice().sort((a, b) => {
      let av = a[key] ?? (typeof b[key] === 'number' ? 0 : '');
      let bv = b[key] ?? (typeof a[key] === 'number' ? 0 : '');
      const cmp = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  }
  return list;
}

function expGetUnique(field) {
  return [...new Set(expState.players.map(p => p[field]).filter(Boolean))].sort();
}

function expCellDisplay(field, player) {
  const val = player[field];
  if (field === 'position') return val ? `<span class="badge badge-green">${esc(val)}</span>` : '—';
  if (field === 'year')     return val ? `<span class="badge badge-blue">${esc(val)}</span>` : '—';
  if (field === 'revShare' || field === 'stipend') return fmtMoney(val);
  if (field === 'totalCompensation') return fmtMoney(val);
  if (field === 'contractLength')    return val !== null ? `${val}mo` : '—';
  return esc(val) || '—';
}

function expGetPlayerBundle(player) {
  const match = getCurrentMatches()[player.id] || null;
  const cfbdPlayer = match?.match ? evalResolvePlayer(match.match.id) : null;
  const assessment = cfbdPlayer ? evalGetPlayerAssessment(cfbdPlayer) : null;
  const expenseValue = cfbdPlayer ? evalGetExpenseValue(cfbdPlayer, player) : null;
  const reviewState = getMatchReviewState(player.id);
  return { match, cfbdPlayer, assessment, expenseValue, reviewState };
}

function expOpenPlayerFromRoster(id) {
  const player = expState.players.find(row => row.id === id);
  if (!player) return;
  const bundle = expGetPlayerBundle(player);
  if (bundle.match?.match?.id) openPlayerProfile(bundle.match.match.id);
  else openMatchingOverride(id);
}

function expGetEvaluationSummary() {
  const bundles = expState.players.map(player => ({ player, bundle: expGetPlayerBundle(player) }));
  const assessed = bundles.filter(entry => entry.bundle.assessment);
  const avgScore = assessed.length
    ? assessed.reduce((sum, entry) => sum + entry.bundle.assessment.score, 0) / assessed.length
    : null;
  const bestValue = bundles
    .filter(entry => entry.bundle.expenseValue?.index !== null && entry.bundle.expenseValue?.index !== undefined)
    .sort((a, b) => b.bundle.expenseValue.index - a.bundle.expenseValue.index)[0] || null;
  const topScore = assessed
    .slice()
    .sort((a, b) => b.bundle.assessment.score - a.bundle.assessment.score)[0] || null;
  const reviewCounts = bundles.reduce((acc, entry) => {
    const state = entry.bundle.reviewState;
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, { unmatched: 0, pending: 0, approved: 0, fixed: 0, review: 0 });

  return { avgScore, bestValue, topScore, reviewCounts };
}

function expGetReviewRows() {
  const rows = expState.players.map(player => ({ player, bundle: expGetPlayerBundle(player) }));
  if (expState.reviewFilter === 'all') return rows;
  if (expState.reviewFilter === 'approved') return rows.filter(entry => entry.bundle.reviewState === 'approved');
  if (expState.reviewFilter === 'fixed') return rows.filter(entry => entry.bundle.reviewState === 'fixed');
  if (expState.reviewFilter === 'unmatched') return rows.filter(entry => entry.bundle.reviewState === 'unmatched');
  return rows.filter(entry => ['pending', 'review', 'unmatched'].includes(entry.bundle.reviewState));
}

function expReviewLabel(state) {
  if (state === 'approved') return 'Approved';
  if (state === 'fixed') return 'Fixed';
  if (state === 'review') return 'Needs Review';
  if (state === 'pending') return 'Pending';
  return 'Unmatched';
}

function expReviewTone(state) {
  if (state === 'approved' || state === 'fixed') return 'green';
  if (state === 'review' || state === 'unmatched') return 'amber';
  return 'blue';
}

function expRenderScoreCell(bundle) {
  if (!bundle.assessment) return '<span class="text-faint">Awaiting CFBD profile</span>';
  return `
    <div class="exp-score-cell">
      <strong>${esc(bundle.assessment.scoreDisplay)}</strong>
      <span class="nat-grade-pill is-${bundle.assessment.grade.tone}">${esc(bundle.assessment.grade.label)}</span>
    </div>`;
}

function expRenderValueCell(bundle) {
  if (!bundle.expenseValue?.index && bundle.expenseValue?.index !== 0) return '<span class="text-faint">No value index</span>';
  return `
    <div class="exp-score-cell exp-value-cell">
      <strong>${fmtNum(bundle.expenseValue.index, 0)}</strong>
      <span class="nat-benchmark-pill is-${bundle.expenseValue.status.tone}">${esc(bundle.expenseValue.label)}</span>
    </div>`;
}

function expRenderEvalCards(summary) {
  const bestValue = summary.bestValue
    ? `${esc(summary.bestValue.player.firstName)} ${esc(summary.bestValue.player.lastName)} · ${fmtNum(summary.bestValue.bundle.expenseValue.index, 0)}`
    : 'No matched value index yet';
  const topScore = summary.topScore
    ? `${esc(summary.topScore.player.firstName)} ${esc(summary.topScore.player.lastName)} · ${esc(summary.topScore.bundle.assessment.scoreDisplay)}`
    : 'No scored player yet';

  return `
    <div class="stat-grid-4 exp-eval-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Roster Match Review</span><span class="stat-icon">↔</span></div>
        <p class="stat-value">${summary.reviewCounts.pending + summary.reviewCounts.review + summary.reviewCounts.unmatched}</p>
        <p class="stat-sub">${summary.reviewCounts.approved + summary.reviewCounts.fixed} approved or fixed</p>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Average Role Score</span><span class="stat-icon">◎</span></div>
        <p class="stat-value text-blue">${summary.avgScore !== null ? fmtNum(summary.avgScore, 0) : '—'}</p>
        <p class="stat-sub">Position-adjusted against the national pool</p>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Best Value Index</span><span class="stat-icon">▲</span></div>
        <p class="stat-value text-green">${summary.bestValue ? fmtNum(summary.bestValue.bundle.expenseValue.index, 0) : '—'}</p>
        <p class="stat-sub">${bestValue}</p>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Highest Rated Player</span><span class="stat-icon">★</span></div>
        <p class="stat-value">${summary.topScore ? esc(summary.topScore.bundle.assessment.scoreDisplay) : '—'}</p>
        <p class="stat-sub">${topScore}</p>
      </div>
    </div>`;
}

function expRenderMatchingReview(summary) {
  if (!cfbdRoster.length) {
    return `
      <div class="card exp-review-card">
        <div class="card-header exp-review-header">
          <div>
            <h2>Toledo Matching Review</h2>
            <p class="text-muted">Load Toledo CFBD data once to approve or fix NIL roster links here.</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-load-review-roster">Load Toledo Data</button>
        </div>
      </div>`;
  }

  const rows = expGetReviewRows();
  return `
    <div class="card exp-review-card">
      <div class="card-header exp-review-header">
        <div>
          <h2>Toledo Matching Review</h2>
          <p class="text-muted">Approve confident links, send edge cases to manual review, and open dossiers from one board.</p>
        </div>
        <div class="exp-review-controls">
          <select class="filter-select" id="exp-review-filter">
            <option value="needs-action" ${expState.reviewFilter === 'needs-action' ? 'selected' : ''}>Needs action</option>
            <option value="all" ${expState.reviewFilter === 'all' ? 'selected' : ''}>All players</option>
            <option value="approved" ${expState.reviewFilter === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="fixed" ${expState.reviewFilter === 'fixed' ? 'selected' : ''}>Fixed</option>
            <option value="unmatched" ${expState.reviewFilter === 'unmatched' ? 'selected' : ''}>Unmatched</option>
          </select>
        </div>
      </div>
      <div class="exp-review-summary">
        <span class="badge badge-muted">Pending ${summary.reviewCounts.pending}</span>
        <span class="badge badge-muted">Needs review ${summary.reviewCounts.review}</span>
        <span class="badge badge-muted">Unmatched ${summary.reviewCounts.unmatched}</span>
        <span class="badge badge-linked">Approved ${summary.reviewCounts.approved + summary.reviewCounts.fixed}</span>
      </div>
      <div class="table-wrap exp-review-table-wrap">
        <table class="data-table exp-review-table">
          <thead>
            <tr>
              <th>Expense Player</th>
              <th>CFBD Link</th>
              <th>Status</th>
              <th class="num">Score</th>
              <th class="td-action">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(entry => {
              const { player, bundle } = entry;
              const confidence = bundle.match?.confidence || 'none';
              const confidenceLabel = confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : confidence === 'low' ? 'Low confidence' : 'No auto match';
              return `
                <tr>
                  <td>
                    <div class="exp-review-player">
                      <strong>${esc(player.firstName)} ${esc(player.lastName)}</strong>
                      <span>${esc(player.position || 'No position')} · ${esc(player.year || 'No year')}</span>
                    </div>
                  </td>
                  <td>
                    ${bundle.match?.match ? `
                      <div class="exp-review-player">
                        <strong>${esc(bundle.match.match.firstName)} ${esc(bundle.match.match.lastName)}</strong>
                        <span>${esc(confidenceLabel)}</span>
                      </div>` : '<span class="text-faint">No CFBD link selected</span>'}
                  </td>
                  <td>
                    <div class="exp-review-status-cell">
                      <span class="exp-review-status is-${expReviewTone(bundle.reviewState)}">${expReviewLabel(bundle.reviewState)}</span>
                      <span class="text-faint">${bundle.reviewState === 'review' ? 'Low-confidence suggestion' : confidenceLabel}</span>
                    </div>
                  </td>
                  <td class="num">${bundle.assessment ? `<div class="exp-score-inline"><strong>${esc(bundle.assessment.scoreDisplay)}</strong><span class="nat-grade-pill is-${bundle.assessment.grade.tone}">${esc(bundle.assessment.grade.label)}</span></div>` : '<span class="text-faint">—</span>'}</td>
                  <td class="td-action">
                    <div class="exp-review-actions">
                      ${bundle.match?.match && !['approved', 'fixed'].includes(bundle.reviewState) ? `<button class="btn-link-sm" data-approve-match="${player.id}" data-cfbd-id="${bundle.match.match.id}">Approve</button>` : ''}
                      <button class="btn-link-sm" data-fix-match="${player.id}">${bundle.match?.match ? 'Fix Link' : 'Find Match'}</button>
                      ${bundle.match?.match ? `<button class="btn-link-sm" data-open-profile="${bundle.match.match.id}">Open Dossier</button>` : ''}
                    </div>
                  </td>
                </tr>`;
            }).join('') : `
              <tr>
                <td colspan="5" class="table-empty">No players match this review filter.</td>
              </tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── CRUD ─────────────────────────────────────────────────────
function expUpdatePlayer(id, field, value) {
  const p = expState.players.find(p => p.id === id);
  if (!p) return;
  p[field] = value;
  if (field === 'revShare' || field === 'stipend')
    p.totalCompensation = (p.revShare || 0) + (p.stipend || 0);
  expSave();
}

function expAddPlayer() {
  const player = {
    id: expState.nextId++,
    lastName: 'New', firstName: 'Player',
    position: '', year: '', campus: '',
    revShare: 0, stipend: 0, contractLength: null,
    totalCompensation: 0,
  };
  expState.players.push(player);
  expSave();
  expRender();
  setTimeout(() => {
    const rows = document.querySelectorAll('#exp-player-tbody .player-row');
    rows[rows.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function expDeletePlayer(id) {
  expState.players = expState.players.filter(p => p.id !== id);
  expSave();
  expRender();
}

// ── Inline editing ───────────────────────────────────────────
function expStartEdit(td) {
  if (td.dataset.editing === 'true') return;
  const id    = parseInt(td.closest('tr').dataset.id);
  const field = td.dataset.field;
  const type  = td.dataset.type;
  const p     = expState.players.find(p => p.id === id);
  if (!p) return;

  const rawVal = p[field];
  td.dataset.editing = 'true';
  td.innerHTML = '';

  const input = document.createElement('input');
  input.type  = type === 'number' ? 'number' : 'text';
  input.value = rawVal !== null && rawVal !== undefined ? rawVal : '';
  input.className = 'cell-input';
  input.step  = 'any';

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    let val = input.value.trim();
    if (type === 'number') val = val === '' ? (field === 'contractLength' ? null : 0) : (parseFloat(val) || 0);
    expUpdatePlayer(id, field, val);
    expRender();
  };
  const cancel = () => { committed = true; expRestoreCell(td, field, p); };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  td.appendChild(input);
  input.focus();
  if (type === 'text') input.select();
}

function expRestoreCell(td, field, player) {
  delete td.dataset.editing;
  td.innerHTML = expCellDisplay(field, player);
  if (field === 'revShare' || field === 'stipend') {
    const tr = td.closest('tr');
    const compTd = tr?.querySelector('.total-comp');
    if (compTd) compTd.textContent = fmtMoney(player.totalCompensation);
    expRenderTableFooter(expGetFilteredSorted());
  }
}

// ── Render helpers ───────────────────────────────────────────
function expRenderTableBody() {
  const tbody = document.getElementById('exp-player-tbody');
  if (!tbody) return;
  const players = expGetFilteredSorted();

  if (players.length === 0) {
    const msg = expState.players.length === 0
      ? `No players yet. ${expState.editMode ? 'Click <strong>+ Add Player</strong> to get started.' : 'Use Edit Roster to add or change players.'}`
      : 'No players match the current filters.';
    tbody.innerHTML = `<tr><td colspan="${EXPENSE_COLUMNS.length + 4}" class="table-empty">${msg}</td></tr>`;
    expRenderTableFooter(players);
    return;
  }

  tbody.innerHTML = players.map((p, i) => {
    const bundle = expGetPlayerBundle(p);
    const linked = bundle.match && bundle.match.match;
    const linkBadge = linked
      ? `<span class="badge badge-linked" title="Linked to CFBD: ${esc(bundle.match.match.firstName)} ${esc(bundle.match.match.lastName)} (${bundle.match.confidence})" data-cfbd-id="${bundle.match.match.id}" data-internal-id="${p.id}">⚡</span>`
      : `<span class="badge badge-unlinked" title="Not linked to CFBD data" data-internal-id="${p.id}">?</span>`;
    return `
    <tr class="player-row ${i % 2 === 0 ? 'row-even' : 'row-odd'} ${expState.editMode ? 'is-editing' : 'is-viewing'}" data-id="${p.id}">
      <td class="td-link">${linkBadge}</td>
      ${EXPENSE_COLUMNS.map(c => c.editable
        ? `<td class="${expState.editMode ? 'td-edit' : 'td-read'}${c.type === 'number' ? ' num' : ''}" data-field="${c.key}" data-type="${c.type}">${expCellDisplay(c.key, p)}</td>`
        : `<td class="num total-comp">${expCellDisplay(c.key, p)}</td>`
      ).join('')}
      <td class="num exp-score-col">${expRenderScoreCell(bundle)}</td>
      <td class="num exp-value-col">${expRenderValueCell(bundle)}</td>
      <td class="td-action">
        ${expState.editMode
          ? `<button class="btn-delete" data-id="${p.id}" title="Delete player">×</button>`
          : `<button class="btn-link-sm" data-open-row="${p.id}">View</button>`}
      </td>
    </tr>`;
  }).join('');

  expRenderTableFooter(players);
}

function expRenderTableFooter(players) {
  const tfoot = document.getElementById('exp-player-tfoot');
  if (!tfoot || !players) return;
  const allPlayers = players.length > 0 ? players : expGetFilteredSorted();
  const revShare   = allPlayers.reduce((s, p) => s + p.revShare, 0);
  const stipend    = allPlayers.reduce((s, p) => s + p.stipend, 0);
  const total      = allPlayers.reduce((s, p) => s + p.totalCompensation, 0);
  tfoot.innerHTML = allPlayers.length === 0 ? '' : `
    <tr class="tfoot-row">
      <td></td>
      <td colspan="5">Total (${allPlayers.length} player${allPlayers.length !== 1 ? 's' : ''})</td>
      <td class="num">${fmtMoney(revShare)}</td>
      <td class="num">${fmtMoney(stipend)}</td>
      <td></td>
      <td class="num total-comp">${fmtMoney(total)}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>`;
}

function expUpdateStats() {
  const s = expGetStats();
  const el = id => document.getElementById(id);
  if (el('stat-budget'))    el('stat-budget').textContent    = fmtMoney(s.totalBudget);
  if (el('stat-committed')) el('stat-committed').textContent = fmtMoney(s.totalCommitted);
  if (el('stat-players'))   el('stat-players').textContent   = s.playerCount;
  if (el('stat-avg'))       el('stat-avg').textContent       = `avg ${fmtMoney(s.avgPerPlayer)} / player`;
  if (el('stat-remaining')) {
    el('stat-remaining').textContent = fmtMoney(Math.abs(s.remaining));
    el('stat-remaining').className   = 'stat-value ' + (s.remaining < 0 ? 'text-red' : s.remaining === 0 ? 'text-muted' : 'text-green');
  }
  if (el('stat-remaining-label'))
    el('stat-remaining-label').textContent = s.remaining < 0 ? 'Over budget' : s.remaining === 0 ? 'Fully allocated' : 'Available';
  if (el('stat-remaining-icon'))
    el('stat-remaining-icon').textContent  = s.remaining < 0 ? '↓' : s.remaining === 0 ? '=' : '↑';
  if (el('budget-bar') && s.totalBudget > 0) {
    const pct = Math.min((s.totalCommitted / s.totalBudget) * 100, 100);
    el('budget-bar').style.width = pct + '%';
    el('budget-bar').className   = 'budget-bar-fill ' + (pct >= 90 ? 'bar-red' : pct >= 70 ? 'bar-amber' : 'bar-green');
    if (el('budget-pct'))            el('budget-pct').textContent             = pct.toFixed(1) + '%';
    if (el('budget-pct'))            el('budget-pct').className               = pct >= 100 ? 'text-red' : 'text-green font-bold';
    if (el('budget-committed-label')) el('budget-committed-label').textContent = `${fmtMoney(s.totalCommitted)} committed`;
    if (el('budget-total-label'))    el('budget-total-label').textContent     = `${fmtMoney(s.totalBudget)} total budget`;
  }
}

function expBuildFilterOptions(field, placeholder) {
  const opts = expGetUnique(field).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const cur  = esc(expState.filter[field] || '');
  return `<select class="filter-select" data-filter="${field}">
    <option value="" ${cur === '' ? 'selected' : ''}>${placeholder}</option>
    ${opts}</select>`;
}

function expSortBy(key) {
  if (expState.sort.key === key) expState.sort.dir = expState.sort.dir === 'asc' ? 'desc' : 'asc';
  else { expState.sort.key = key; expState.sort.dir = 'asc'; }
  expRenderTableBody();
  document.querySelectorAll('#pageExpenses th.sortable').forEach(th => {
    const k = th.dataset.sort;
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    if (k === expState.sort.key) { ind.textContent = expState.sort.dir === 'asc' ? '↑' : '↓'; th.classList.add('sorted'); }
    else { ind.textContent = ''; th.classList.remove('sorted'); }
  });
}

// ── Sub-view rendering (upload / preview / dashboard) ────────

function expRenderUpload() {
  const container = document.getElementById('expContent');
  container.innerHTML = `
    <div class="upload-page">
      <div class="upload-header">
        <div class="upload-icon">🏈</div>
        <h1>Toledo Football — Expense Dashboard</h1>
        <p>Upload your player expense CSV or Excel file to populate the dashboard</p>
      </div>
      <div class="drop-zone" id="drop-zone">
        <input type="file" id="file-input" accept=".csv,.xlsx,.xls" style="display:none" />
        <div class="drop-zone-icon" id="dz-icon">⬆</div>
        <p class="drop-zone-title" id="dz-title">Drag &amp; drop your file here</p>
        <p class="drop-zone-sub">or click to browse</p>
        <span class="badge badge-muted">.csv</span>
        <span class="badge badge-muted">.xlsx</span>
      </div>
      <div id="upload-error" class="error-box" style="display:none"></div>
      ${expState.players.length > 0 ? `<button class="btn-link" id="btn-view-dash">View current dashboard →</button>` : ''}
      <div class="column-hint">
        <p class="hint-label">Expected columns</p>
        <div class="hint-cols">
          ${['Last Name','First Name','Position','Year','On/Off Campus','Rev Share $','Contract Length','Stipend','Total Compensation','Total Budget']
            .map(c => `<span class="badge badge-muted">${c}</span>`).join('')}
        </div>
      </div>
    </div>`;

  const dz = document.getElementById('drop-zone');
  const fi = document.getElementById('file-input');
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragging'); const f = e.dataTransfer.files?.[0]; if (f) expHandleFile(f); });
  fi.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) expHandleFile(f); e.target.value = ''; });
  document.getElementById('btn-view-dash')?.addEventListener('click', () => { expState.subView = 'dashboard'; expRender(); });
}

function expHandleFile(file) {
  const isXLSX = file.name.match(/\.xlsx?$/i);
  const isCSV  = file.name.match(/\.csv$/i);
  if (!isXLSX && !isCSV) { const el = document.getElementById('upload-error'); if (el) { el.textContent = '⚠ Please upload a CSV or Excel file.'; el.style.display = 'block'; } return; }

  const reader = new FileReader();
  if (isXLSX) {
    reader.onload = e => {
      try {
        const result = parseXLSX(e.target.result);
        expState.previewData = { ...result, fileName: file.name };
        expState.subView = 'preview';
        expRender();
      } catch (err) { const el = document.getElementById('upload-error'); if (el) { el.textContent = '⚠ ' + err.message; el.style.display = 'block'; } }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = e => {
      try {
        const result = parseCSV(e.target.result);
        expState.previewData = { ...result, fileName: file.name };
        expState.subView = 'preview';
        expRender();
      } catch (err) { const el = document.getElementById('upload-error'); if (el) { el.textContent = '⚠ ' + err.message; el.style.display = 'block'; } }
    };
    reader.readAsText(file);
  }
}

function expRenderPreview() {
  const container = document.getElementById('expContent');
  const { players, totalBudget, errors, fileName } = expState.previewData;
  const totalCommitted = players.reduce((s, p) => s + p.totalCompensation, 0);
  container.innerHTML = `
    <div class="preview-page">
      <div class="preview-title">
        <span class="icon">📄</span>
        <div><h1>Import Preview</h1><p class="text-muted">${esc(fileName)}</p></div>
      </div>
      <div class="stat-grid-4">
        <div class="stat-card-sm"><p class="stat-sm-label">Players Found</p><p class="stat-sm-val">${players.length}</p></div>
        <div class="stat-card-sm"><p class="stat-sm-label">Total Budget</p><p class="stat-sm-val text-green">${totalBudget !== null ? fmtMoney(totalBudget) : 'Not found'}</p></div>
        <div class="stat-card-sm"><p class="stat-sm-label">Total Committed</p><p class="stat-sm-val text-blue">${fmtMoney(totalCommitted)}</p></div>
        <div class="stat-card-sm"><p class="stat-sm-label">Warnings</p><p class="stat-sm-val ${errors.length > 0 ? 'text-amber' : 'text-muted'}">${errors.length}</p></div>
      </div>
      ${errors.length > 0 ? `<div class="warning-box"><strong>⚠ ${errors.length} warning${errors.length !== 1 ? 's' : ''}</strong><ul>${errors.map(e => `<li>${esc(e.message)}</li>`).join('')}</ul></div>` : ''}
      <div class="card"><div class="card-header"><h2>Player Rows (${players.length})</h2></div>
        <div class="table-wrap"><table class="data-table"><thead><tr>
          <th>Name</th><th>Position</th><th>Year</th><th>Housing</th>
          <th class="num">Rev Share</th><th class="num">Stipend</th><th class="num">Total Comp</th><th>Contract</th>
        </tr></thead><tbody>
          ${players.map((p, i) => `<tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
            <td>${esc(p.firstName)} ${esc(p.lastName)}</td>
            <td>${p.position ? `<span class="badge badge-green">${esc(p.position)}</span>` : '—'}</td>
            <td>${p.year ? `<span class="badge badge-blue">${esc(p.year)}</span>` : '—'}</td>
            <td>${esc(p.campus) || '—'}</td>
            <td class="num">${fmtMoney(p.revShare)}</td><td class="num">${fmtMoney(p.stipend)}</td>
            <td class="num total-comp">${fmtMoney(p.totalCompensation)}</td>
            <td>${p.contractLength !== null ? p.contractLength + 'mo' : '—'}</td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="preview-actions">
        <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm" ${players.length === 0 ? 'disabled' : ''}>✓ Confirm Import</button>
      </div>
    </div>`;

  document.getElementById('btn-cancel').addEventListener('click', () => {
    expState.previewData = null;
    expState.subView = expState.players.length > 0 ? 'dashboard' : 'upload';
    expRender();
  });
  document.getElementById('btn-confirm').addEventListener('click', () => {
    const { players: np, totalBudget: nb, fileName: fn } = expState.previewData;
    expState.players = np; expState.totalBudget = nb; expState.fileName = fn;
    expState.nextId = np.length > 0 ? Math.max(...np.map(p => p.id)) + 1 : 1;
    expState.previewData = null;
    expState.sort = { key: null, dir: 'asc' };
    expState.filter = { search: '', position: '', year: '', campus: '' };
    expState.subView = 'dashboard';
    expSave();
    expRender();
    // Trigger matching after import
    if (cfbdRoster.length > 0) {
      const m = matchAllPlayers(expState.players);
      setCurrentMatches(m);
      expRender();
    }
  });
}

function expRenderDashboard() {
  const container = document.getElementById('expContent');
  const s = expGetStats();
  const evaluationSummary = expGetEvaluationSummary();
  const budgetPct      = s.totalBudget > 0 ? Math.min((s.totalCommitted / s.totalBudget) * 100, 100) : 0;
  const remainingClass = s.remaining < 0 ? 'text-red' : s.remaining === 0 ? 'text-muted' : 'text-green';
  const remainingLabel = s.remaining < 0 ? 'Over budget' : s.remaining === 0 ? 'Fully allocated' : 'Available';
  const remainingIcon  = s.remaining < 0 ? '↓' : s.remaining === 0 ? '=' : '↑';

  const colHeaders = EXPENSE_COLUMNS.map(c => `
    <th class="sortable${c.key === expState.sort.key ? ' sorted' : ''}${c.type === 'number' ? ' num' : ''}" data-sort="${c.key}">
      ${c.label}<span class="sort-ind">${c.key === expState.sort.key ? (expState.sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
    </th>`).join('');

  container.innerHTML = `
    <div class="dash-body">
      <div class="exp-toolbar">
        <div>
          <span class="text-muted" style="font-size:12px">${s.playerCount} players${expState.fileName ? ' · ' + esc(expState.fileName) : ''}</span>
        </div>
        <div class="exp-toolbar-actions">
          <button class="btn-link-sm" id="btn-clear">Clear data</button>
          <button class="btn btn-primary btn-sm" id="btn-upload">⬆ Upload New File</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2>Player Roster</h2>
            <p class="text-muted exp-roster-note">${expState.editMode ? 'Edit mode is on. Click any editable cell to change roster data.' : 'View mode is on. Click a player row to open the CFBD dossier.'}</p>
          </div>
          <div class="exp-roster-actions">
            ${expState.editMode ? '<button class="btn btn-secondary btn-sm" id="btn-add">+ Add Player</button>' : ''}
            <button class="btn ${expState.editMode ? 'btn-secondary' : 'btn-primary'} btn-sm" id="btn-edit-toggle">${expState.editMode ? 'Done Editing' : 'Edit Roster'}</button>
          </div>
        </div>
        <div class="filter-bar" id="filter-bar">
          <input class="filter-input" type="text" id="filter-search" placeholder="Search players…" value="${esc(expState.filter.search)}" />
          ${expBuildFilterOptions('position', 'All Positions')}
          ${expBuildFilterOptions('year', 'All Years')}
          ${expBuildFilterOptions('campus', 'All Housing')}
        </div>
        <div class="table-wrap">
          <table class="data-table" id="exp-player-table">
            <thead><tr><th class="td-link">Link</th>${colHeaders}<th class="num">Role Score</th><th class="num">Value Index</th><th class="td-action">Actions</th></tr></thead>
            <tbody id="exp-player-tbody"></tbody>
            <tfoot id="exp-player-tfoot"></tfoot>
          </table>
        </div>
      </div>

      ${expRenderEvalCards(evaluationSummary)}

      ${s.totalBudget > 0 ? `
        <div class="card budget-bar-card">
          <div class="budget-bar-header">
            <span>Budget Utilization</span>
            <span id="budget-pct" class="${budgetPct >= 100 ? 'text-red' : 'text-green'} font-bold">${budgetPct.toFixed(1)}%</span>
          </div>
          <div class="budget-bar-track">
            <div id="budget-bar" class="budget-bar-fill ${budgetPct >= 90 ? 'bar-red' : budgetPct >= 70 ? 'bar-amber' : 'bar-green'}" style="width:${budgetPct}%"></div>
          </div>
          <div class="budget-bar-labels">
            <span id="budget-committed-label" class="text-faint">${fmtMoney(s.totalCommitted)} committed</span>
            <span id="budget-total-label" class="text-faint">${fmtMoney(s.totalBudget)} total budget</span>
          </div>
        </div>` : ''}

      <div class="stat-grid-4">
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Total Budget</span><span class="stat-icon">$</span></div>
          <p class="stat-value" id="stat-budget">${fmtMoney(s.totalBudget)}</p><p class="stat-sub">${s.totalBudget === 0 ? 'Not set in file' : 'From uploaded file'}</p></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Total Committed</span><span class="stat-icon">$</span></div>
          <p class="stat-value text-blue" id="stat-committed">${fmtMoney(s.totalCommitted)}</p><p class="stat-sub">Rev share + stipends</p></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Remaining Budget</span><span class="stat-icon" id="stat-remaining-icon">${remainingIcon}</span></div>
          <p class="stat-value ${remainingClass}" id="stat-remaining">${fmtMoney(Math.abs(s.remaining))}</p><p class="stat-sub" id="stat-remaining-label">${remainingLabel}</p></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Players</span><span class="stat-icon">👥</span></div>
          <p class="stat-value" id="stat-players">${s.playerCount}</p><p class="stat-sub" id="stat-avg">avg ${fmtMoney(s.avgPerPlayer)} / player</p></div>
      </div>

      <div class="chart-grid">
        <div class="card chart-card"><h3 class="chart-title">Spend by Position</h3><div class="chart-wrap"><canvas id="chart-position"></canvas></div></div>
        <div class="card chart-card"><h3 class="chart-title">Spend by Year</h3><div class="chart-wrap"><canvas id="chart-year"></canvas></div></div>
        <div class="card chart-card"><h3 class="chart-title">Campus Breakdown</h3><div class="chart-wrap"><canvas id="chart-campus"></canvas></div></div>
        <div class="card chart-card"><h3 class="chart-title">Contract Length</h3><div class="chart-wrap"><canvas id="chart-contract"></canvas></div></div>
      </div>

      ${expRenderMatchingReview(evaluationSummary)}
    </div>`;

  // Wire events
  document.getElementById('btn-upload').addEventListener('click', () => { expState.subView = 'upload'; expRender(); });
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear all player data and return to the upload screen?')) return;
    expState.players = []; expState.totalBudget = null; expState.fileName = '';
    expState.sort = { key: null, dir: 'asc' }; expState.filter = { search: '', position: '', year: '', campus: '' };
    localStorage.removeItem(STORAGE_KEY);
    expState.subView = 'upload'; expRender();
  });
  document.getElementById('btn-edit-toggle').addEventListener('click', () => {
    expState.editMode = !expState.editMode;
    expRender();
  });
  document.getElementById('btn-add')?.addEventListener('click', expAddPlayer);
  document.querySelector('#exp-player-table thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (th) expSortBy(th.dataset.sort);
  });
  document.getElementById('filter-search').addEventListener('input', e => { expState.filter.search = e.target.value; expRenderTableBody(); });
  document.getElementById('filter-bar').addEventListener('change', e => {
    const sel = e.target.closest('.filter-select');
    if (sel) { expState.filter[sel.dataset.filter] = sel.value; expRenderTableBody(); }
  });
  document.getElementById('exp-review-filter')?.addEventListener('change', e => {
    expState.reviewFilter = e.target.value;
    expRender();
  });
  document.getElementById('btn-load-review-roster')?.addEventListener('click', async () => {
    window._app?.switchPage('pagePlayers');
    if (!natState.loaded && !natState.loading) await natLoadData();
    window._app?.switchPage('pageExpenses');
    expRender();
  });
  document.getElementById('exp-player-tbody').addEventListener('click', e => {
    const td  = e.target.closest('td.td-edit');
    const btn = e.target.closest('.btn-delete');
    const rowBtn = e.target.closest('[data-open-row]');
    const linkedBadge = e.target.closest('.badge-linked');
    const unlinkedBadge = e.target.closest('.badge-unlinked');
    if (td) {
      expStartEdit(td);
      return;
    }
    if (btn) {
      expDeletePlayer(parseInt(btn.dataset.id));
      return;
    }
    if (rowBtn) {
      expOpenPlayerFromRoster(parseInt(rowBtn.dataset.openRow));
      return;
    }
    if (linkedBadge) {
      const cfbdId = linkedBadge.dataset.cfbdId;
      if (cfbdId) openPlayerProfile(cfbdId);
      return;
    }
    if (unlinkedBadge) {
      const internalId = parseInt(unlinkedBadge.dataset.internalId);
      openMatchingOverride(internalId);
      return;
    }
    if (!expState.editMode) {
      const tr = e.target.closest('tr.player-row');
      if (tr) expOpenPlayerFromRoster(parseInt(tr.dataset.id));
    }
  });
  container.querySelector('.exp-review-card')?.addEventListener('click', e => {
    const approveBtn = e.target.closest('[data-approve-match]');
    const fixBtn = e.target.closest('[data-fix-match]');
    const profileBtn = e.target.closest('[data-open-profile]');
    if (approveBtn) {
      approveMatch(parseInt(approveBtn.dataset.approveMatch), approveBtn.dataset.cfbdId);
      expRender();
      return;
    }
    if (fixBtn) {
      openMatchingOverride(parseInt(fixBtn.dataset.fixMatch));
      return;
    }
    if (profileBtn) {
      openPlayerProfile(profileBtn.dataset.openProfile);
    }
  });

  expRenderTableBody();
  requestAnimationFrame(() => expInitCharts());
}

function expRender() {
  expDestroyCharts();
  if (expState.subView === 'upload')       expRenderUpload();
  else if (expState.subView === 'preview') expRenderPreview();
  else                                     expRenderDashboard();
}

// ── Init ─────────────────────────────────────────────────────
function initExpenses() {
  const hasData = expLoad();
  if (hasData) expState.subView = 'dashboard';
  else expState.subView = 'upload';
}
