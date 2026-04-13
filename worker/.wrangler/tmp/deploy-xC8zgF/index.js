var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var CFBD_BASE = "https://api.collegefootballdata.com";
var CACHE_TTL = 30 * 24 * 60 * 60;
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "X-Cache"
};
function corsOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
__name(corsOptions, "corsOptions");
function jsonResp(body, hit, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Cache": hit ? "HIT" : "MISS",
      ...CORS_HEADERS
    }
  });
}
__name(jsonResp, "jsonResp");
function errResp(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}
__name(errResp, "errResp");
async function kvGet(env, key) {
  try {
    const val = await env.FOOTBALL_CACHE.get(key, "json");
    return val;
  } catch {
    return null;
  }
}
__name(kvGet, "kvGet");
async function kvPut(env, key, data) {
  try {
    await env.FOOTBALL_CACHE.put(key, JSON.stringify(data), {
      expirationTtl: CACHE_TTL
    });
  } catch (e) {
    console.error("KV put error:", e);
  }
}
__name(kvPut, "kvPut");
async function fetchCFBD(env, path) {
  const apiKey = env["football-api"];
  if (!apiKey) throw new Error("Missing football-api secret");
  const resp = await fetch(`${CFBD_BASE}${path}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json"
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`CFBD ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}
__name(fetchCFBD, "fetchCFBD");
async function cachedEndpoint(env, cacheKey, cfbdPath) {
  const cached = await kvGet(env, cacheKey);
  if (cached !== null) {
    return jsonResp(cached, true);
  }
  const data = await fetchCFBD(env, cfbdPath);
  env.ctx.waitUntil(kvPut(env, cacheKey, data));
  return jsonResp(data, false);
}
__name(cachedEndpoint, "cachedEndpoint");
async function handleRoster(env, url) {
  const team = url.searchParams.get("team") || "Toledo";
  const year = url.searchParams.get("year") || "2025";
  const cacheKey = `roster:${team}:${year}`;
  const cfbdPath = `/roster?team=${encodeURIComponent(team)}&year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handleRoster, "handleRoster");
async function handlePlayerStats(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const team = url.searchParams.get("team");
  const category = url.searchParams.get("category") || "";
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
__name(handlePlayerStats, "handlePlayerStats");
async function handlePlayerUsage(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const team = url.searchParams.get("team");
  let cfbdPath = `/player/usage?year=${year}`;
  let cacheKey = `usage:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handlePlayerUsage, "handlePlayerUsage");
async function handlePPA(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const team = url.searchParams.get("team");
  let cfbdPath = `/ppa/players/season?year=${year}`;
  let cacheKey = `ppa:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handlePPA, "handlePPA");
async function handleTeams(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const cacheKey = `teams:fbs:${year}`;
  const cfbdPath = `/teams/fbs?year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handleTeams, "handleTeams");
async function handleRatings(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const cacheKey = `ratings:sp:${year}`;
  const cfbdPath = `/ratings/sp?year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handleRatings, "handleRatings");
async function handlePortal(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const cacheKey = `portal:${year}`;
  const cfbdPath = `/player/portal?year=${year}`;
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handlePortal, "handlePortal");
async function handleRecruiting(env, url) {
  const year = url.searchParams.get("year") || "2025";
  const team = url.searchParams.get("team");
  let cfbdPath = `/recruiting/players?year=${year}`;
  let cacheKey = `recruiting:${year}`;
  if (team) {
    cfbdPath += `&team=${encodeURIComponent(team)}`;
    cacheKey += `:${team}`;
  }
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handleRecruiting, "handleRecruiting");
async function handleSearch(env, url) {
  const q = url.searchParams.get("q") || "";
  if (!q || q.length < 2) return errResp("Search query too short (min 2 chars)");
  const data = await fetchCFBD(env, `/player/search?searchTerm=${encodeURIComponent(q)}`);
  return jsonResp(data, false);
}
__name(handleSearch, "handleSearch");
async function handleConferences(env, url) {
  const cacheKey = "conferences";
  const cfbdPath = "/conferences";
  return cachedEndpoint(env, cacheKey, cfbdPath);
}
__name(handleConferences, "handleConferences");
async function handleProxy(env, path) {
  const data = await fetchCFBD(env, path);
  return jsonResp(data, false);
}
__name(handleProxy, "handleProxy");
async function handleCacheClear(env, url) {
  const prefix = url.searchParams.get("prefix") || "";
  if (!prefix) return errResp("prefix query param required");
  let cursor = void 0;
  let deleted = 0;
  do {
    const list = await env.FOOTBALL_CACHE.list({ prefix, cursor, limit: 100 });
    for (const key of list.keys) {
      await env.FOOTBALL_CACHE.delete(key.name);
      deleted++;
    }
    cursor = list.list_complete ? void 0 : list.cursor;
  } while (cursor);
  return jsonResp({ deleted, prefix }, false);
}
__name(handleCacheClear, "handleCacheClear");
var index_default = {
  async fetch(request, env, ctx) {
    env.ctx = ctx;
    if (request.method === "OPTIONS") return corsOptions();
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/roster") return handleRoster(env, url);
      if (path === "/api/stats") return handlePlayerStats(env, url);
      if (path === "/api/usage") return handlePlayerUsage(env, url);
      if (path === "/api/ppa") return handlePPA(env, url);
      if (path === "/api/teams") return handleTeams(env, url);
      if (path === "/api/ratings") return handleRatings(env, url);
      if (path === "/api/portal") return handlePortal(env, url);
      if (path === "/api/recruiting") return handleRecruiting(env, url);
      if (path === "/api/conferences") return handleConferences(env, url);
      if (path === "/api/search") return handleSearch(env, url);
      if (path === "/api/cache/clear") return handleCacheClear(env, url);
      if (path.startsWith("/api/proxy/")) {
        const cfbdPath = "/" + path.replace("/api/proxy/", "");
        return handleProxy(env, cfbdPath + url.search);
      }
      if (path === "/" || path === "/health") {
        return jsonResp({ status: "ok", service: "football-dashboard-api" }, true);
      }
      return errResp("Not found", 404);
    } catch (e) {
      console.error("Worker error:", e);
      return errResp(e.message || "Internal error", 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
