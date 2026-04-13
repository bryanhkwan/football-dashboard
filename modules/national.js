// ============ NATIONAL PLAYERS MODULE ============
// Dependencies: config.js, cache.js, matching.js
// Tab 2: Browse all FBS players from CFBD, search/filter/click -> profile

// ── State ────────────────────────────────────────────────────
let natState = {
  allStats:     [],
  teams:        [],
  conferences:  [],
  roster:       {},
  loading:      false,
  loaded:       false,
  error:        null,
  search:       '',
  teamFilter:   '',
  confFilter:   '',
  posFilter:    '',
  sort:         { key: 'name', dir: 'asc' },
  page:         0,
  pageSize:     50,
  programLoading: false,
  programLoaded: false,
  program: {
    ratings: [],
    portal: [],
    recruiting: [],
    toledoUsage: [],
    toledoPpa: [],
  },
};

// ── Data Loading ─────────────────────────────────────────────

async function natLoadData() {
  if (natState.loading) return;
  natState.loading = true;
  natState.error = null;
  natRenderLoading();

  try {
    const [teams, conferences, toledoRoster] = await Promise.all([
      apiFetch('/api/teams', { year: CFBD_SEASON }),
      apiFetch('/api/conferences'),
      apiFetch('/api/roster', { team: 'Toledo', year: CFBD_SEASON }),
    ]);

    natState.teams = teams;
    natState.conferences = conferences;
    natState.program = { ratings: [], portal: [], recruiting: [], toledoUsage: [], toledoPpa: [] };
    natState.programLoaded = false;
    natState.programLoading = false;
    cfbdRoster = toledoRoster;

    const catResults = await Promise.all(
      STAT_CATEGORIES.map(cat =>
        apiFetch('/api/stats', { year: CFBD_SEASON, category: cat }).catch(() => [])
      )
    );

    const playerMap = {};
    for (let ci = 0; ci < STAT_CATEGORIES.length; ci++) {
      const cat = STAT_CATEGORIES[ci];
      const rows = catResults[ci];
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        const key = String(row.playerId);
        if (!playerMap[key]) {
          playerMap[key] = {
            playerId: row.playerId,
            name: row.player,
            team: row.team,
            conference: row.conference,
            stats: {},
          };
        }

        const player = playerMap[key];
        if (!player.team && row.team) player.team = row.team;
        if (!player.conference && row.conference) player.conference = row.conference;

        if (row.statType && row.stat !== undefined) {
          const statKey = `${cat}_${row.statType}`;
          player.stats[statKey] = safeNum(row.stat);
        }
      }
    }

    const rosterMap = {};
    for (const rosterPlayer of toledoRoster) {
      rosterMap[String(rosterPlayer.id)] = rosterPlayer;
    }

    natState.allStats = Object.values(playerMap);

    for (const player of natState.allStats) {
      const rosterPlayer = rosterMap[String(player.playerId)];
      if (rosterPlayer) {
        player.position = rosterPlayer.position || '';
        player.height = rosterPlayer.height || null;
        player.weight = rosterPlayer.weight || null;
        player.jersey = rosterPlayer.jersey || null;
        player.year = rosterPlayer.year ? String(rosterPlayer.year) : '';
        player.isToledo = true;
      } else {
        player.position = player.position || '';
        player.isToledo = (player.team || '').toLowerCase() === 'toledo';
      }
    }

    natState.loaded = true;
    natState.loading = false;

    if (expState.players.length > 0 && cfbdRoster.length > 0) {
      const matches = matchAllPlayers(expState.players);
      setCurrentMatches(matches);
    }

    natRenderPage();
    natLoadProgramContext();

  } catch (e) {
    natState.loading = false;
    natState.error = e.message;
    natRenderError();
  }
}

async function natLoadProgramContext() {
  if (!natState.loaded || natState.programLoading || natState.programLoaded) return;
  natState.programLoading = true;
  natRenderPage();

  try {
    const [toledoUsage, toledoPpa, ratings, portal, recruiting] = await Promise.all([
      apiFetch('/api/usage', { year: CFBD_SEASON, team: 'Toledo' }).catch(() => []),
      apiFetch('/api/ppa', { year: CFBD_SEASON, team: 'Toledo' }).catch(() => []),
      apiFetch('/api/ratings', { year: CFBD_SEASON }).catch(() => []),
      apiFetch('/api/portal', { year: CFBD_SEASON }).catch(() => []),
      apiFetch('/api/recruiting', { year: CFBD_SEASON, team: 'Toledo' }).catch(() => []),
    ]);

    natState.program = {
      ratings: Array.isArray(ratings) ? ratings : [],
      portal: Array.isArray(portal)
        ? portal.filter(entry => entry.destination === 'Toledo' || entry.origin === 'Toledo')
        : [],
      recruiting: Array.isArray(recruiting) ? recruiting : [],
      toledoUsage: Array.isArray(toledoUsage) ? toledoUsage : [],
      toledoPpa: Array.isArray(toledoPpa) ? toledoPpa : [],
    };
    natState.programLoaded = true;
  } finally {
    natState.programLoading = false;
    if (natState.loaded) natRenderPage();
  }
}

// ── Shared helpers for profile module ───────────────────────

function natGetTeamRating(team) {
  return (natState.program.ratings || []).find(row => row.team === team) || null;
}

function natFindToledoPortalEntry(playerName) {
  const target = normName(playerName);
  return (natState.program.portal || []).find(entry =>
    normName(`${entry.firstName} ${entry.lastName}`) === target
  ) || null;
}

function natFindToledoRecruit(playerName) {
  const target = normName(playerName);
  return (natState.program.recruiting || []).find(entry => normName(entry.name) === target) || null;
}

// ── Filtering & Sorting ──────────────────────────────────────

function natGetFiltered() {
  let list = natState.allStats;
  const query = natState.search.toLowerCase();

  if (query) {
    list = list.filter(player =>
      (player.name || '').toLowerCase().includes(query) ||
      (player.team || '').toLowerCase().includes(query)
    );
  }
  if (natState.teamFilter) {
    list = list.filter(player => player.team === natState.teamFilter);
  }
  if (natState.confFilter) {
    list = list.filter(player => player.conference === natState.confFilter);
  }
  if (natState.posFilter) {
    list = list.filter(player => {
      const group = positionGroup(player.position);
      return group === natState.posFilter || (player.position || '').toUpperCase() === natState.posFilter.toUpperCase();
    });
  }

  const { key, dir } = natState.sort;
  list = list.slice().sort((a, b) => {
    if (a.isToledo && !b.isToledo) return -1;
    if (!a.isToledo && b.isToledo) return 1;

    let av;
    let bv;
    if (key === 'name') {
      av = a.name || '';
      bv = b.name || '';
    } else if (key === 'team') {
      av = a.team || '';
      bv = b.team || '';
    } else if (key === 'conference') {
      av = a.conference || '';
      bv = b.conference || '';
    } else if (key === 'position') {
      av = a.position || '';
      bv = b.position || '';
    } else if (key === 'score') {
      av = evalGetPlayerAssessment(a)?.score ?? -Infinity;
      bv = evalGetPlayerAssessment(b)?.score ?? -Infinity;
    } else {
      av = a.stats[key] ?? -Infinity;
      bv = b.stats[key] ?? -Infinity;
    }

    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });

  return list;
}

function natGetPage(filtered) {
  const start = natState.page * natState.pageSize;
  return filtered.slice(start, start + natState.pageSize);
}

// ── Stat display columns ─────────────────────────────────────

const NAT_DISPLAY_COLS = [
  { key: 'passing_YDS', label: 'Pass YDS' },
  { key: 'passing_TD', label: 'Pass TD' },
  { key: 'passing_INT', label: 'INT' },
  { key: 'passing_PCT', label: 'Pass %' },
  { key: 'rushing_YDS', label: 'Rush YDS' },
  { key: 'rushing_TD', label: 'Rush TD' },
  { key: 'rushing_CAR', label: 'CAR' },
  { key: 'receiving_YDS', label: 'Rec YDS' },
  { key: 'receiving_TD', label: 'Rec TD' },
  { key: 'receiving_REC', label: 'REC' },
  { key: 'defensive_TACKLES', label: 'Tackles' },
  { key: 'defensive_SACKS', label: 'Sacks' },
  { key: 'interceptions_INT', label: 'Def INT' },
];

// ── Formatting helpers ───────────────────────────────────────

function natFmtPct(value, decimals = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(decimals)}%` : '—';
}

function natFmtSigned(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}`;
}

function natFmtStat(key, value) {
  if (!Number.isFinite(value)) return '—';
  if (key.includes('PCT')) return natFmtPct(value, 1);
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return fmtNum(value, 0);
  return fmtNum(value, 1);
}

function natFmtStars(stars) {
  return Number.isFinite(stars) ? `${stars}★` : '—';
}

function natRenderScore(player) {
  const assessment = evalGetPlayerAssessment(player);
  if (!assessment) return '<span class="nat-grade-pill is-empty">—</span>';
  return `
    <div class="nat-grade-stack">
      <span class="nat-grade-pill is-${assessment.grade.tone}">${esc(assessment.grade.label)}</span>
      <strong>${fmtNum(assessment.score, 0)}</strong>
    </div>`;
}

function natRenderBenchmarkPreview(player) {
  const assessment = evalGetPlayerAssessment(player);
  if (!assessment || assessment.highlightMetrics.length === 0) return '—';
  return `
    <div class="nat-benchmark-list">
      ${assessment.highlightMetrics.map(metric => `
        <span class="nat-benchmark-pill is-${metric.status.tone}">${esc(metric.label)} · ${esc(metric.status.label)}</span>
      `).join('')}
    </div>`;
}

function natRenderWatchlist() {
  const watchPlayers = evalGetWatchlistPlayers();
  if (watchPlayers.length === 0) {
    return `
      <section class="card nat-watchlist-card nat-watchlist-empty">
        <div>
          <p class="section-kicker">Watchlist Board</p>
          <h2>Pin players to compare them side by side</h2>
          <p class="text-muted">Use the star button in the player table or dossier. Pin Toledo players next to national targets to compare score, benchmarks, and context in one strip.</p>
        </div>
      </section>`;
  }

  return `
    <section class="card nat-watchlist-card">
      <div class="nat-watchlist-head">
        <div>
          <p class="section-kicker">Watchlist Board</p>
          <h2>${watchPlayers.length} pinned player${watchPlayers.length !== 1 ? 's' : ''}</h2>
        </div>
        <button class="btn btn-secondary btn-sm" id="nat-clear-watchlist">Clear Watchlist</button>
      </div>
      <div class="nat-watchlist-grid">
        ${watchPlayers.map(player => natRenderWatchCard(player)).join('')}
      </div>
    </section>`;
}

function natRenderWatchCard(player) {
  const assessment = evalGetPlayerAssessment(player);
  const comparison = evalGetToledoComparison(player);
  const benchmarkMarkup = assessment?.highlightMetrics?.map(metric =>
    `<span class="nat-benchmark-pill is-${metric.status.tone}">${esc(metric.label)} · ${esc(metric.status.label)}</span>`
  ).join('') || '<span class="nat-benchmark-pill is-neutral">Benchmark pending</span>';
  const comparisonMarkup = comparison && comparison.player
    ? `${esc(comparison.player.name)} · ${fmtNum(comparison.assessment.score, 0)} ${esc(comparison.assessment.grade.label)}`
    : 'No Toledo player at this position loaded yet';

  return `
    <article class="nat-watch-card ${player.isToledo ? 'is-toledo' : ''}" data-player-id="${player.playerId}">
      <div class="nat-watch-card-top">
        <div>
          <p class="section-kicker">${player.isToledo ? 'Toledo Player' : 'Pinned Target'}</p>
          <h3>${esc(player.name)}</h3>
          <p class="nat-watch-sub">${esc(player.team || '—')} · ${player.position ? esc(player.position) : '—'} · ${player.conference ? esc(player.conference) : '—'}</p>
        </div>
        <button class="nat-watch-pin is-active" data-watch-id="${player.playerId}" title="Remove from watchlist">★</button>
      </div>
      <div class="nat-watch-score">
        <span class="nat-watch-score-label">Score</span>
        <strong>${assessment ? fmtNum(assessment.score, 0) : '—'}</strong>
        <span class="nat-grade-pill is-${assessment?.grade?.tone || 'neutral'}">${esc(assessment?.grade?.label || 'Unscored')}</span>
      </div>
      <div class="nat-watch-benchmarks">${benchmarkMarkup}</div>
      <div class="nat-watch-compare">
        <span class="nat-watch-compare-label">Top Toledo comp</span>
        <strong>${comparisonMarkup}</strong>
      </div>
      <button class="btn btn-secondary btn-sm nat-watch-open" data-open-id="${player.playerId}">Open Dossier</button>
    </article>`;
}

function natProgramStatus() {
  if (natState.programLoading) return 'Loading Toledo program context…';
  if (natState.programLoaded) return 'Toledo context live';
  return 'Toledo context pending';
}

function natGetProgramSummary() {
  const ratings = natGetTeamRating('Toledo');
  const portal = natState.program.portal || [];
  const recruiting = natState.program.recruiting || [];
  const usageLeader = (natState.program.toledoUsage || [])
    .filter(row => Number.isFinite(row?.usage?.overall))
    .sort((a, b) => b.usage.overall - a.usage.overall)[0] || null;
  const ppaLeader = (natState.program.toledoPpa || [])
    .filter(row => Number.isFinite(row?.totalPPA?.all))
    .sort((a, b) => b.totalPPA.all - a.totalPPA.all)[0] || null;
  const topRecruit = recruiting.slice().sort((a, b) => {
    const ratingDelta = (b.rating ?? -Infinity) - (a.rating ?? -Infinity);
    if (ratingDelta !== 0) return ratingDelta;
    return (a.ranking ?? Infinity) - (b.ranking ?? Infinity);
  })[0] || null;
  const linkedCount = Object.values(getCurrentMatches()).filter(match => match && match.match).length;
  const expenseCount = expState.players.length;

  return {
    ratings,
    usageLeader,
    ppaLeader,
    topRecruit,
    linkedCount,
    expenseCount,
    rosterSize: cfbdRoster.length,
    incomingTransfers: portal.filter(entry => entry.destination === 'Toledo').length,
    outgoingTransfers: portal.filter(entry => entry.origin === 'Toledo').length,
  };
}

// ── Rendering ────────────────────────────────────────────────

function natRenderLoadPrompt() {
  return `
    <div class="dash-body nat-shell">
      <section class="card nat-load-card">
        <div class="nat-load-copy">
          <p class="section-kicker">Football Operations Board</p>
          <h1>Load National Player Intelligence</h1>
          <p>Pull the national CFBD player dataset, then layer in Toledo context for usage, SP+, transfer movement, recruiting, and internal spend matching.</p>
        </div>
        <div class="nat-load-feature-grid">
          <div class="nat-load-feature">
            <span class="nat-load-feature-label">Production</span>
            <strong>Season stat board</strong>
            <p>Passing, rushing, receiving, defense, and special teams production for players across the country.</p>
          </div>
          <div class="nat-load-feature">
            <span class="nat-load-feature-label">Operations</span>
            <strong>Usage + PPA context</strong>
            <p>Show who actually carries a workload and who adds efficient value on a per-play and season basis.</p>
          </div>
          <div class="nat-load-feature">
            <span class="nat-load-feature-label">Roster Movement</span>
            <strong>Portal + recruiting</strong>
            <p>Keep transfer flow and incoming class context visible when evaluating Toledo roster decisions.</p>
          </div>
          <div class="nat-load-feature">
            <span class="nat-load-feature-label">Caching</span>
            <strong>30-day worker cache</strong>
            <p>The worker stores upstream CFBD responses for a month so you do not burn API volume on repeated opens.</p>
          </div>
        </div>
        <div class="nat-load-actions">
          <button class="btn btn-primary" id="nat-load">Load Player Data</button>
          <span class="nat-load-meta">Initial pull may take a few seconds. Cached data reloads much faster.</span>
        </div>
      </section>
    </div>`;
}

function natRenderLoading() {
  const el = document.getElementById('natContent');
  if (!el) return;
  el.innerHTML = `
    <div class="dash-body nat-shell">
      <div class="card nat-loading-card">
        <div class="spinner"></div>
        <p class="section-kicker">Loading Data</p>
        <h2>Building the national player board</h2>
        <p>Pulling season production first, then layering in Toledo context and roster intelligence.</p>
      </div>
    </div>`;
}

function natRenderError() {
  const el = document.getElementById('natContent');
  if (!el) return;
  el.innerHTML = `
    <div class="dash-body nat-shell">
      <div class="card nat-loading-card">
        <p class="section-kicker">Load Failed</p>
        <h2>Unable to build the player board</h2>
        <p class="text-muted">${esc(natState.error)}</p>
        <button class="btn btn-primary" id="nat-retry">Retry</button>
      </div>
    </div>`;
  document.getElementById('nat-retry')?.addEventListener('click', natLoadData);
}

function natRenderPage() {
  const el = document.getElementById('natContent');
  if (!el) return;

  if (!natState.loaded) {
    el.innerHTML = natRenderLoadPrompt();
    document.getElementById('nat-load')?.addEventListener('click', natLoadData);
    return;
  }

  const filtered = natGetFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / natState.pageSize));
  const page = natGetPage(filtered);
  const summary = natGetProgramSummary();
  const teamNames = [...new Set(natState.allStats.map(player => player.team).filter(Boolean))].sort();
  const confNames = [...new Set(natState.allStats.map(player => player.conference).filter(Boolean))].sort();

  const ratingCardValue = summary.ratings ? `#${summary.ratings.ranking}` : (natState.programLoading ? 'Loading…' : '—');
  const ratingCardMeta = summary.ratings
    ? `SP+ ${fmtNum(summary.ratings.rating, 1)} · Off #${summary.ratings.offense?.ranking || '—'} · Def #${summary.ratings.defense?.ranking || '—'}`
    : 'Overall team strength context for Toledo.';
  const linkedMeta = summary.expenseCount > 0
    ? `${summary.linkedCount} of ${summary.expenseCount} internal spend records linked to CFBD roster.`
    : 'Upload expense data to track internal spend linkage.';
  const portalValue = natState.programLoading
    ? 'Loading…'
    : `${summary.incomingTransfers} in / ${summary.outgoingTransfers} out`;
  const topRecruitValue = summary.topRecruit
    ? esc(summary.topRecruit.name)
    : (natState.programLoading ? 'Loading…' : 'No Toledo recruit file');
  const topRecruitMeta = summary.topRecruit
    ? `${natFmtStars(summary.topRecruit.stars)} ${esc(summary.topRecruit.position || 'ATH')} · #${summary.topRecruit.ranking || '—'} national`
    : 'Highest-rated Toledo commitment in the 2025 class.';
  const usageHeadline = summary.usageLeader
    ? esc(summary.usageLeader.name)
    : (natState.programLoading ? 'Loading…' : 'Not available');
  const usageMeta = summary.usageLeader
    ? `${natFmtPct(summary.usageLeader.usage.overall, 1)} overall usage · ${natFmtPct(summary.usageLeader.usage.thirdDown, 1)} on third down`
    : 'Usage share shows how much of the offense flows through a player.';
  const ppaHeadline = summary.ppaLeader
    ? esc(summary.ppaLeader.name)
    : (natState.programLoading ? 'Loading…' : 'Not available');
  const ppaMeta = summary.ppaLeader
    ? `${natFmtSigned(summary.ppaLeader.totalPPA.all, 1)} total PPA · ${natFmtSigned(summary.ppaLeader.averagePPA.all, 3)} avg per play`
    : 'PPA estimates value added in points on a play and across the season.';
  const watchlistMarkup = natRenderWatchlist();

  el.innerHTML = `
    <div class="dash-body nat-shell">
      <section class="nat-hero">
        <div class="nat-hero-copy">
          <p class="section-kicker">Football Operations Board</p>
          <h1>National Player Intelligence</h1>
          <p>Scan national production, keep Toledo program context in frame, and open player dossiers with workload, efficiency, transfer, recruiting, and internal spend signals.</p>
        </div>
        <div class="nat-summary-grid">
          <article class="nat-summary-card tone-gold">
            <p class="nat-summary-label">Toledo SP+</p>
            <div class="nat-summary-value">${ratingCardValue}</div>
            <p class="nat-summary-meta">${ratingCardMeta}</p>
          </article>
          <article class="nat-summary-card tone-blue">
            <p class="nat-summary-label">Toledo Roster</p>
            <div class="nat-summary-value">${summary.rosterSize || '—'}</div>
            <p class="nat-summary-meta">Active Toledo players loaded from the current CFBD roster.</p>
          </article>
          <article class="nat-summary-card tone-green">
            <p class="nat-summary-label">Expense Links</p>
            <div class="nat-summary-value">${summary.expenseCount > 0 ? `${summary.linkedCount}/${summary.expenseCount}` : '—'}</div>
            <p class="nat-summary-meta">${linkedMeta}</p>
          </article>
          <article class="nat-summary-card tone-slate">
            <p class="nat-summary-label">Portal Flow</p>
            <div class="nat-summary-value">${portalValue}</div>
            <p class="nat-summary-meta">2025 inbound and outbound Toledo transfer movement.</p>
          </article>
        </div>
      </section>

      <section class="nat-insight-grid">
        <article class="card nat-insight-card">
          <p class="section-kicker">Usage Leader</p>
          <h3>${usageHeadline}</h3>
          <p class="nat-insight-meta">${usageMeta}</p>
          <p class="nat-insight-copy">Usage is the share of team offensive plays involving that player. It is the fastest way to spot true workload and leverage.</p>
        </article>
        <article class="card nat-insight-card">
          <p class="section-kicker">Value Leader</p>
          <h3>${ppaHeadline}</h3>
          <p class="nat-insight-meta">${ppaMeta}</p>
          <p class="nat-insight-copy">Average PPA is per-play efficiency. Total PPA is the season-long accumulation of value added.</p>
        </article>
        <article class="card nat-insight-card">
          <p class="section-kicker">Top Recruit</p>
          <h3>${topRecruitValue}</h3>
          <p class="nat-insight-meta">${topRecruitMeta}</p>
          <p class="nat-insight-copy">Recruiting context helps tie incoming talent level to current roster and future spend planning.</p>
        </article>
        <article class="card nat-insight-card nat-guide-card">
          <p class="section-kicker">Metric Guide</p>
          <div class="nat-guide-list">
            <div>
              <strong>Usage</strong>
              <span>Percent of plays that run through a player.</span>
            </div>
            <div>
              <strong>Avg PPA</strong>
              <span>Per-play efficiency measured in point value added.</span>
            </div>
            <div>
              <strong>Total PPA</strong>
              <span>Cumulative season impact across all touches or plays.</span>
            </div>
          </div>
        </article>
      </section>

      ${watchlistMarkup}

      <section class="card nat-filter-card">
        <div class="nat-filter-head">
          <div>
            <p class="section-kicker">Player Board</p>
            <h2>National Search + Toledo Context</h2>
          </div>
          <div class="nat-filter-meta">
            <span>${filtered.length.toLocaleString()} players</span>
            <span>Page ${natState.page + 1} of ${totalPages}</span>
            <span class="nat-inline-pill${natState.programLoading ? ' is-loading' : ''}">${natProgramStatus()}</span>
          </div>
        </div>
        <div class="nat-search-row">
          <input class="filter-input nat-search" type="text" id="nat-search" placeholder="Search players or teams…" value="${esc(natState.search)}" />
          <select class="filter-select" id="nat-conf-filter">
            <option value="">All Conferences</option>
            ${confNames.map(conf => `<option value="${esc(conf)}" ${natState.confFilter === conf ? 'selected' : ''}>${esc(conf)}</option>`).join('')}
          </select>
          <select class="filter-select" id="nat-team-filter">
            <option value="">All Teams</option>
            ${teamNames.map(team => `<option value="${esc(team)}" ${natState.teamFilter === team ? 'selected' : ''}>${esc(team)}</option>`).join('')}
          </select>
          <select class="filter-select" id="nat-pos-filter">
            <option value="">All Positions</option>
            <option value="Offense" ${natState.posFilter === 'Offense' ? 'selected' : ''}>Offense</option>
            <option value="Defense" ${natState.posFilter === 'Defense' ? 'selected' : ''}>Defense</option>
            <option value="Special" ${natState.posFilter === 'Special' ? 'selected' : ''}>Special Teams</option>
          </select>
        </div>
      </section>

      <div class="card nat-table-card">
        <div class="table-wrap nat-table-wrap">
          <table class="data-table nat-table" id="nat-table">
            <thead>
              <tr>
                <th class="nat-pin-col">★</th>
                <th class="sortable${natState.sort.key === 'name' ? ' sorted' : ''}" data-sort="name">Player <span class="sort-ind">${natState.sort.key === 'name' ? (natState.sort.dir === 'asc' ? '↑' : '↓') : ''}</span></th>
                <th class="sortable${natState.sort.key === 'team' ? ' sorted' : ''}" data-sort="team">Team <span class="sort-ind">${natState.sort.key === 'team' ? (natState.sort.dir === 'asc' ? '↑' : '↓') : ''}</span></th>
                <th>Conf</th>
                <th>Pos</th>
                <th class="sortable" data-sort="score">Score <span class="sort-ind">${natState.sort.key === 'score' ? (natState.sort.dir === 'asc' ? '↑' : '↓') : ''}</span></th>
                <th>Benchmarks</th>
                ${NAT_DISPLAY_COLS.map(col => `
                  <th class="num sortable${natState.sort.key === col.key ? ' sorted' : ''}" data-sort="${col.key}">${col.label} <span class="sort-ind">${natState.sort.key === col.key ? (natState.sort.dir === 'asc' ? '↑' : '↓') : ''}</span></th>
                `).join('')}
              </tr>
            </thead>
            <tbody id="nat-tbody">
              ${page.map((player, index) => `
                <tr class="${player.isToledo ? 'row-toledo' : (index % 2 === 0 ? 'row-even' : 'row-odd')}" data-player-id="${player.playerId}">
                  <td class="nat-pin-cell"><button class="nat-watch-pin${evalIsWatchlisted(player.playerId) ? ' is-active' : ''}" data-watch-id="${player.playerId}" title="${evalIsWatchlisted(player.playerId) ? 'Remove from watchlist' : 'Add to watchlist'}">★</button></td>
                  <td class="nat-player-name">${player.isToledo ? '<span class="badge badge-toledo">TOL</span>' : ''}<span>${esc(player.name)}</span></td>
                  <td>${esc(player.team)}</td>
                  <td><span class="text-muted">${esc(player.conference)}</span></td>
                  <td>${player.position ? `<span class="badge badge-green">${esc(player.position)}</span>` : '—'}</td>
                  <td>${natRenderScore(player)}</td>
                  <td>${natRenderBenchmarkPreview(player)}</td>
                  ${NAT_DISPLAY_COLS.map(col => `<td class="num">${natFmtStat(col.key, player.stats[col.key])}</td>`).join('')}
                </tr>
              `).join('')}
              ${page.length === 0 ? `<tr><td colspan="${7 + NAT_DISPLAY_COLS.length}" class="table-empty">No players match your current filters.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>

      ${totalPages > 1 ? `
        <div class="nat-pagination">
          <button class="btn btn-secondary btn-sm" id="nat-prev" ${natState.page === 0 ? 'disabled' : ''}>← Previous</button>
          <span class="text-muted">Page ${natState.page + 1} of ${totalPages}</span>
          <button class="btn btn-secondary btn-sm" id="nat-next" ${natState.page >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>` : ''}
    </div>`;

  document.getElementById('nat-search')?.addEventListener('input', debounce(e => {
    natState.search = e.target.value;
    natState.page = 0;
    natRenderPage();
  }, 250));

  document.getElementById('nat-conf-filter')?.addEventListener('change', e => {
    natState.confFilter = e.target.value;
    natState.teamFilter = '';
    natState.page = 0;
    natRenderPage();
  });
  document.getElementById('nat-team-filter')?.addEventListener('change', e => {
    natState.teamFilter = e.target.value;
    natState.page = 0;
    natRenderPage();
  });
  document.getElementById('nat-pos-filter')?.addEventListener('change', e => {
    natState.posFilter = e.target.value;
    natState.page = 0;
    natRenderPage();
  });

  document.querySelector('#nat-table thead')?.addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.sort;
    if (natState.sort.key === key) natState.sort.dir = natState.sort.dir === 'asc' ? 'desc' : 'asc';
    else {
      natState.sort.key = key;
      natState.sort.dir = key === 'name' || key === 'team' ? 'asc' : 'desc';
    }
    natState.page = 0;
    natRenderPage();
  });

  document.getElementById('nat-prev')?.addEventListener('click', () => {
    if (natState.page > 0) {
      natState.page--;
      natRenderPage();
    }
  });
  document.getElementById('nat-next')?.addEventListener('click', () => {
    if (natState.page < totalPages - 1) {
      natState.page++;
      natRenderPage();
    }
  });

  document.getElementById('nat-clear-watchlist')?.addEventListener('click', () => {
    evalGetWatchlistIds().forEach(id => evalToggleWatchlist(id));
    natRenderPage();
  });

  document.querySelectorAll('[data-watch-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      evalToggleWatchlist(btn.dataset.watchId);
      natRenderPage();
    });
  });

  document.querySelectorAll('.nat-watch-open').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openPlayerProfile(btn.dataset.openId);
    });
  });

  document.getElementById('nat-tbody')?.addEventListener('click', e => {
    if (e.target.closest('[data-watch-id]')) return;
    const tr = e.target.closest('tr[data-player-id]');
    if (tr) openPlayerProfile(tr.dataset.playerId);
  });
}
