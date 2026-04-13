// ============ CACHE MODULE ============
// Dependencies: config.js (WORKER_URL)
// Client-side in-memory cache + fetch wrapper for the worker

const _memCache = Object.create(null);

async function apiFetch(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = WORKER_URL + path + (qs ? '?' + qs : '');
  const cacheKey = url;

  // In-memory cache (survives within session)
  if (_memCache[cacheKey]) return _memCache[cacheKey];

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const hit = resp.headers.get('X-Cache') === 'HIT';

  // Cache in memory
  _memCache[cacheKey] = data;

  // Track API misses
  if (!hit) {
    const mk = 'cfbd_miss_' + new Date().toISOString().slice(0, 7);
    const n = parseInt(localStorage.getItem(mk) || '0', 10) + 1;
    localStorage.setItem(mk, String(n));
  }

  return data;
}

function clearMemCache() {
  for (const k in _memCache) delete _memCache[k];
}
