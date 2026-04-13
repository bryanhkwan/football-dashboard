// ============================================================
// Cloudflare Worker — Football Dashboard API Proxy & Cache
// Worker: still-haze-bb4e.bryanhkwan.workers.dev
//
// Secrets:  football-api  (CFBD Bearer token)
// KV:      FOOTBALL_CACHE (30-day TTL cache)
// ============================================================

const CFBD_BASE = 'https://api.collegefootballdata.com';
const CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-Cache',
};

// ── Helpers ──────────────────────────────────────────────────

function corsOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonResp(body, hit, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': hit ? 'HIT' : 'MISS',
      ...CORS_HEADERS,
    },
  });
}

function errResp(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function kvGet(env, key) {
  try {
    const val = await env.FOOTBALL_CACHE.get(key, 'json');
    return val;
  } catch {
    return null;
  }
}

async function kvPut(env, key, data) {
  try {
    await env.FOOTBALL_CACHE.put(key, JSON.stringify(data), {
      expirationTtl: CACHE_TTL,
    });
  } catch (e) {
    console.error('KV put error:', e);
  }
}

async function fetchCFBD(env, path) {
  const apiKey = env['football-api'];
  if (!apiKey) throw new Error('Missing football-api secret');

  const resp = await fetch(`${CFBD_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`CFBD ${resp.status}: ${text.slice(0, 200)}`);
  }

  return resp.json();
}

// ── Cached endpoint handler ──────────────────────────────────

async function cachedEndpoint(env, cacheKey, cfbdPath) {
  // Check KV cache first
  const cached = await kvGet(env, cacheKey);
  if (cached !== null) {
    return jsonResp(cached, true);
  }

  // Cache miss — fetch from CFBD
  const data = await fetchCFBD(env, cfbdPath);

  // Store in KV (non-blocking)
  env.ctx.waitUntil(kvPut(env, cacheKey, data));

  return jsonResp(data, false);
}

// ── Route handlers ───────────────────────────────────────────

async function handleRoster(env, url) {
  const team = url.searchParams.get('team') || 'Toledo';
  const year = url.searchParams.get('year') || '2025';
  const cacheKey = `roster:${team}:${year}`;
  const cfbdPath = `/roster?team=${encodeURIComponent(team)}&year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handlePlayerStats(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const team = url.searchParams.get('team');
  const category = url.searchParams.get('category') || '';
  let cfbdPath = `/stats/player/season?year=${year}`;
  let cacheKey = `stats:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  if (category) {
    cfbdPath += `&category=${encodeURIComponent(category)}`;
    cacheKey += `:${category}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handlePlayerUsage(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const team = url.searchParams.get('team');
  let cfbdPath = `/player/usage?year=${year}`;
  let cacheKey = `usage:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handlePPA(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const team = url.searchParams.get('team');
  let cfbdPath = `/ppa/players/season?year=${year}`;
  let cacheKey = `ppa:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handleTeams(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const cacheKey = `teams:fbs:${year}`;
  const cfbdPath = `/teams/fbs?year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handleRatings(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const cacheKey = `ratings:sp:${year}`;
  const cfbdPath = `/ratings/sp?year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handlePortal(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const cacheKey = `portal:${year}`;
  const cfbdPath = `/player/portal?year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handleRecruiting(env, url) {
  const year = url.searchParams.get('year') || '2025';
  const team = url.searchParams.get('team');
  let cfbdPath = `/recruiting/players?year=${year}`;
  let cacheKey = `recruiting:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

async function handleSearch(env, url) {
  const q = url.searchParams.get('q') || '';
  if (!q || q.length < 2) return errResp('Search query too short (min 2 chars)');
  // Search is live — no caching (too dynamic)
  const data = await fetchCFBD(env, `/player/search?searchTerm=${encodeURIComponent(q)}`);
  return jsonResp(data, false);
}

async function handleConferences(env, url) {
  const cacheKey = 'conferences';
  const cfbdPath = '/conferences';
  return cachedEndpoint(env, cacheKey, cfbdPath);
}

// Generic proxy — forwards any CFBD path (no cache)
async function handleProxy(env, path) {
  const data = await fetchCFBD(env, path);
  return jsonResp(data, false);
}

// ── Cache admin ──────────────────────────────────────────────

async function handleCacheClear(env, url) {
  const prefix = url.searchParams.get('prefix') || '';
  if (!prefix) return errResp('prefix query param required');

  // List and delete keys matching prefix
  let cursor = undefined;
  let deleted = 0;
  do {
    const list = await env.FOOTBALL_CACHE.list({ prefix, cursor, limit: 100 });
    for (const key of list.keys) {
      await env.FOOTBALL_CACHE.delete(key.name);
      deleted++;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return jsonResp({ deleted, prefix }, false);
}

// ── Router ───────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // Attach ctx for waitUntil
    env.ctx = ctx;

    if (request.method === 'OPTIONS') return corsOptions();

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Cached football endpoints
      if (path === '/api/roster')       return handleRoster(env, url);
      if (path === '/api/stats')        return handlePlayerStats(env, url);
      if (path === '/api/usage')        return handlePlayerUsage(env, url);
      if (path === '/api/ppa')          return handlePPA(env, url);
      if (path === '/api/teams')        return handleTeams(env, url);
      if (path === '/api/ratings')      return handleRatings(env, url);
      if (path === '/api/portal')       return handlePortal(env, url);
      if (path === '/api/recruiting')   return handleRecruiting(env, url);
      if (path === '/api/conferences')  return handleConferences(env, url);
      if (path === '/api/search')       return handleSearch(env, url);

      // Cache admin
      if (path === '/api/cache/clear')  return handleCacheClear(env, url);

      // Generic proxy for any CFBD path
      if (path.startsWith('/api/proxy/')) {
        const cfbdPath = '/' + path.replace('/api/proxy/', '');
        return handleProxy(env, cfbdPath + url.search);
      }

      // Health check
      if (path === '/' || path === '/health') {
        return jsonResp({ status: 'ok', service: 'football-dashboard-api' }, true);
      }

      return errResp('Not found', 404);
    } catch (e) {
      console.error('Worker error:', e);
      return errResp(e.message || 'Internal error', 500);
    }
  },
};
