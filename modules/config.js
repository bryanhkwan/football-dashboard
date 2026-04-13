// ============ CONFIG MODULE ============
// Dependencies: none
// Contains: URLs, constants, utility functions

const WORKER_URL = 'https://still-haze-bb4e.bryanhkwan.workers.dev';

const STORAGE_KEY  = 'football-dashboard-v1';
const MATCHING_KEY = 'football-matching-v1';
const MATCHING_APPROVAL_KEY = 'football-matching-approval-v1';
const WATCHLIST_KEY = 'football-watchlist-v1';
const CFBD_SEASON  = '2025';

const YEAR_ORDER = ['Fr', 'So', 'Jr', 'Sr', 'Grad', 'FR', 'SO', 'JR', 'SR', 'GR'];

const POSITION_GROUPS = {
  'QB':  'Offense', 'RB':  'Offense', 'FB':  'Offense',
  'WR':  'Offense', 'TE':  'Offense',
  'OL':  'Offense', 'OT':  'Offense', 'OG':  'Offense', 'C':   'Offense', 'T': 'Offense', 'G': 'Offense',
  'DL':  'Defense', 'DE':  'Defense', 'DT':  'Defense', 'NT':  'Defense',
  'LB':  'Defense', 'ILB': 'Defense', 'OLB': 'Defense', 'MLB': 'Defense',
  'CB':  'Defense', 'S':   'Defense', 'SS':  'Defense', 'FS':  'Defense', 'DB': 'Defense',
  'K':   'Special', 'P':   'Special', 'LS':  'Special', 'KR':  'Special', 'PR':  'Special',
  'ATH': 'Other',
};

const STAT_CATEGORIES = [
  'passing', 'rushing', 'receiving', 'fumbles', 'defensive',
  'interceptions', 'punting', 'kicking',
];

// ── Utility Functions ────────────────────────────────────────

function safeNum(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function fmtMoney(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtNum(n, dec = 1) {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(dec);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function positionGroup(pos) {
  return POSITION_GROUPS[(pos || '').toUpperCase()] || 'Other';
}
