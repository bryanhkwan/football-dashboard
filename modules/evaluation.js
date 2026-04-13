// ============ EVALUATION MODULE ============
// Shared position benchmarks, player scoring, and watchlist state.

const EVAL_POSITION_MAP = {
  QB: 'QB',
  RB: 'RB', FB: 'RB',
  WR: 'WR',
  TE: 'TE',
  CB: 'DB', DB: 'DB', S: 'DB', SS: 'DB', FS: 'DB',
  LB: 'LB', ILB: 'LB', OLB: 'LB', MLB: 'LB',
  DL: 'DL', DE: 'DL', DT: 'DL', NT: 'DL',
  K: 'K',
  P: 'P',
};

const EVAL_MODELS = {
  QB: {
    label: 'Quarterback',
    metrics: [
      { key: 'passing_TD', label: 'TD Production', weight: 0.24 },
      { key: 'passing_PCT', label: 'Accuracy', weight: 0.2 },
      { key: 'passing_YDS', label: 'Passing Volume', weight: 0.16 },
      { key: 'passing_YPA', label: 'Explosiveness', weight: 0.16 },
      { key: 'rushing_YDS', label: 'Run Value', weight: 0.1 },
      { key: 'rushing_TD', label: 'Rush TD', weight: 0.06 },
      { key: 'passing_INT', label: 'Ball Security', weight: 0.08, inverse: true },
    ],
  },
  RB: {
    label: 'Running Back',
    metrics: [
      { key: 'rushing_YDS', label: 'Rushing Volume', weight: 0.3 },
      { key: 'rushing_YPC', label: 'Efficiency', weight: 0.22 },
      { key: 'rushing_TD', label: 'TD Production', weight: 0.18 },
      { key: 'receiving_REC', label: 'Receiving Usage', weight: 0.1 },
      { key: 'receiving_YDS', label: 'Receiving Value', weight: 0.12 },
      { key: 'fumbles_LOST', label: 'Ball Security', weight: 0.08, inverse: true },
    ],
  },
  WR: {
    label: 'Wide Receiver',
    metrics: [
      { key: 'receiving_YDS', label: 'Receiving Volume', weight: 0.32 },
      { key: 'receiving_REC', label: 'Catch Volume', weight: 0.22 },
      { key: 'receiving_TD', label: 'TD Production', weight: 0.18 },
      { key: 'receiving_YPR', label: 'Explosiveness', weight: 0.18 },
      { key: 'fumbles_LOST', label: 'Ball Security', weight: 0.1, inverse: true },
    ],
  },
  TE: {
    label: 'Tight End',
    metrics: [
      { key: 'receiving_YDS', label: 'Receiving Volume', weight: 0.3 },
      { key: 'receiving_REC', label: 'Catch Volume', weight: 0.24 },
      { key: 'receiving_TD', label: 'TD Production', weight: 0.2 },
      { key: 'receiving_YPR', label: 'Explosiveness', weight: 0.16 },
      { key: 'fumbles_LOST', label: 'Ball Security', weight: 0.1, inverse: true },
    ],
  },
  DB: {
    label: 'Defensive Back',
    metrics: [
      { key: 'interceptions_INT', label: 'Takeaways', weight: 0.28 },
      { key: 'defensive_PD', label: 'Pass Disruption', weight: 0.22 },
      { key: 'defensive_TACKLES', label: 'Tackle Volume', weight: 0.22 },
      { key: 'defensive_TFL', label: 'Backfield Plays', weight: 0.12 },
      { key: 'defensive_SACKS', label: 'Pressure', weight: 0.16 },
    ],
  },
  LB: {
    label: 'Linebacker',
    metrics: [
      { key: 'defensive_TACKLES', label: 'Tackle Volume', weight: 0.32 },
      { key: 'defensive_TFL', label: 'Backfield Plays', weight: 0.2 },
      { key: 'defensive_SACKS', label: 'Pressure', weight: 0.18 },
      { key: 'interceptions_INT', label: 'Takeaways', weight: 0.1 },
      { key: 'defensive_SOLO', label: 'Solo Stops', weight: 0.2 },
    ],
  },
  DL: {
    label: 'Defensive Line',
    metrics: [
      { key: 'defensive_SACKS', label: 'Pressure', weight: 0.34 },
      { key: 'defensive_TFL', label: 'Backfield Plays', weight: 0.28 },
      { key: 'defensive_TACKLES', label: 'Tackle Volume', weight: 0.18 },
      { key: 'defensive_SOLO', label: 'Solo Stops', weight: 0.1 },
      { key: 'defensive_PD', label: 'Pass Disruption', weight: 0.1 },
    ],
  },
  K: {
    label: 'Kicker',
    metrics: [
      { key: 'kicking_FG_PCT', label: 'Accuracy', weight: 0.32 },
      { key: 'kicking_FGM', label: 'Field Goal Volume', weight: 0.24 },
      { key: 'kicking_LONG', label: 'Range', weight: 0.2 },
      { key: 'kicking_XPM', label: 'PAT Volume', weight: 0.16 },
      { key: 'kicking_XPA', label: 'PAT Attempts', weight: 0.08 },
    ],
  },
  P: {
    label: 'Punter',
    metrics: [
      { key: 'punting_YPP', label: 'Punt Average', weight: 0.38 },
      { key: 'punting_IN 20', label: 'Inside 20', weight: 0.26 },
      { key: 'punting_LONG', label: 'Range', weight: 0.2 },
      { key: 'punting_TB', label: 'Touchbacks', weight: 0.16, inverse: true },
    ],
  },
};

let evalWatchlist = [];
let evalCache = { key: '', data: {} };

function evalGetNationalPlayers() {
  if (typeof natState !== 'undefined' && Array.isArray(natState.allStats)) return natState.allStats;
  return Array.isArray(window._app?.natState?.allStats) ? window._app.natState.allStats : [];
}

function evalGetExpensePlayers() {
  if (typeof expState !== 'undefined' && Array.isArray(expState.players)) return expState.players;
  return Array.isArray(window._app?.expState?.players) ? window._app.expState.players : [];
}

function evalLoadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (raw) evalWatchlist = JSON.parse(raw).map(String);
  } catch (_) {
    evalWatchlist = [];
  }
}

function evalSaveWatchlist() {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(evalWatchlist));
  } catch (_) {}
}

function evalGetPositionKey(pos) {
  const key = (pos || '').toUpperCase();
  return EVAL_POSITION_MAP[key] || null;
}

function evalGetModel(pos) {
  const key = evalGetPositionKey(pos);
  return key ? EVAL_MODELS[key] || null : null;
}

function evalBuildCache() {
  const players = evalGetNationalPlayers();
  const key = `${CFBD_SEASON}:${players.length}`;
  if (evalCache.key === key) return evalCache.data;

  const data = {};
  Object.keys(EVAL_MODELS).forEach(positionKey => {
    const model = EVAL_MODELS[positionKey];
    const peers = players.filter(player => {
      if (evalGetPositionKey(player.position) !== positionKey) return false;
      return model.metrics.some(metric => Number.isFinite(player.stats?.[metric.key]));
    });

    data[positionKey] = {
      sampleSize: peers.length,
      metrics: {},
    };

    model.metrics.forEach(metric => {
      const values = peers
        .map(player => player.stats?.[metric.key])
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      const median = values.length ? values[Math.floor(values.length / 2)] : null;
      data[positionKey].metrics[metric.key] = { values, avg, median };
    });
  });

  evalCache = { key, data };
  return data;
}

function evalPercentile(values, value, inverse) {
  if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(value)) return null;
  let count = 0;
  for (const v of values) {
    if (inverse ? v >= value : v <= value) count++;
  }
  return (count / values.length) * 100;
}

function evalStatus(percentile) {
  if (!Number.isFinite(percentile)) return { label: 'no benchmark', tone: 'neutral' };
  if (percentile >= 65) return { label: 'above average', tone: 'up' };
  if (percentile >= 40) return { label: 'neutral', tone: 'neutral' };
  return { label: 'below average', tone: 'down' };
}

function evalGrade(score) {
  if (!Number.isFinite(score)) return { label: 'Unscored', tone: 'neutral' };
  if (score >= 90) return { label: 'Elite', tone: 'up' };
  if (score >= 75) return { label: 'Impact', tone: 'up' };
  if (score >= 60) return { label: 'Starter', tone: 'neutral' };
  if (score >= 45) return { label: 'Rotation', tone: 'neutral' };
  return { label: 'Depth', tone: 'down' };
}

function evalFormatMetric(key, value) {
  if (!Number.isFinite(value)) return '—';
  if (key.includes('PCT')) return `${(value * 100).toFixed(1)}%`;
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return fmtNum(value, 0);
  return fmtNum(value, 1);
}

function evalGetPlayerAssessment(player) {
  if (!player || !player.stats) return null;
  const positionKey = evalGetPositionKey(player.position);
  const model = positionKey ? EVAL_MODELS[positionKey] : null;
  if (!model) return null;

  const cache = evalBuildCache();
  const benchmark = cache[positionKey];
  if (!benchmark) return null;

  const metrics = [];
  for (const metric of model.metrics) {
    const value = player.stats?.[metric.key];
    if (!Number.isFinite(value)) continue;
    const peerMetric = benchmark.metrics[metric.key];
    if (!peerMetric || !peerMetric.values.length) continue;
    const percentile = evalPercentile(peerMetric.values, value, metric.inverse);
    if (!Number.isFinite(percentile)) continue;
    metrics.push({
      key: metric.key,
      label: metric.label,
      weight: metric.weight,
      value,
      display: evalFormatMetric(metric.key, value),
      percentile,
      status: evalStatus(percentile),
      average: peerMetric.avg,
      averageDisplay: evalFormatMetric(metric.key, peerMetric.avg),
      median: peerMetric.median,
      inverse: !!metric.inverse,
    });
  }

  if (metrics.length === 0) return null;

  const weightSum = metrics.reduce((sum, metric) => sum + metric.weight, 0) || 1;
  const score = metrics.reduce((sum, metric) => sum + (metric.percentile * metric.weight), 0) / weightSum;
  const grade = evalGrade(score);
  const highlightMetrics = metrics.slice().sort((a, b) => b.weight - a.weight).slice(0, 3);

  return {
    positionKey,
    modelLabel: model.label,
    score,
    scoreDisplay: fmtNum(score, 0),
    grade,
    sampleSize: benchmark.sampleSize,
    metrics,
    highlightMetrics,
  };
}

function evalResolvePlayer(cfbdPlayerId) {
  return evalGetNationalPlayers().find(player => String(player.playerId) === String(cfbdPlayerId)) || null;
}

function evalGetToledoComparison(player) {
  if (!player) return null;
  const positionKey = evalGetPositionKey(player.position);
  if (!positionKey) return null;
  const peers = evalGetNationalPlayers().filter(candidate => candidate.isToledo && evalGetPositionKey(candidate.position) === positionKey);
  if (!peers.length) return null;
  return peers
    .map(candidate => ({ player: candidate, assessment: evalGetPlayerAssessment(candidate) }))
    .filter(entry => entry.assessment)
    .sort((a, b) => b.assessment.score - a.assessment.score)[0] || null;
}

function evalGetExpenseValue(player, expensePlayer) {
  if (!player || !expensePlayer || !Number.isFinite(expensePlayer.totalCompensation) || expensePlayer.totalCompensation <= 0) return null;
  const assessment = evalGetPlayerAssessment(player);
  if (!assessment) return null;

  const efficiency = assessment.score / Math.max(expensePlayer.totalCompensation / 1000, 1);
  const peerEfficiencies = evalGetExpensePlayers().map(internalPlayer => {
    const match = window.getCurrentMatches?.()[internalPlayer.id];
    if (!match?.match || !Number.isFinite(internalPlayer.totalCompensation) || internalPlayer.totalCompensation <= 0) return null;
    const cfbdPlayer = evalResolvePlayer(match.match.id);
    const cfbdAssessment = evalGetPlayerAssessment(cfbdPlayer);
    if (!cfbdAssessment) return null;
    return cfbdAssessment.score / Math.max(internalPlayer.totalCompensation / 1000, 1);
  }).filter(Number.isFinite);

  const percentile = evalPercentile(peerEfficiencies, efficiency, false);
  const status = evalStatus(percentile);
  return {
    efficiency,
    percentile,
    index: Number.isFinite(percentile) ? Math.round(percentile) : null,
    status,
    label: percentile >= 65 ? 'Strong value' : percentile >= 40 ? 'Fair value' : 'Paying premium',
  };
}

function evalGetWatchlistIds() {
  return evalWatchlist.slice();
}

function evalIsWatchlisted(cfbdPlayerId) {
  return evalWatchlist.includes(String(cfbdPlayerId));
}

function evalToggleWatchlist(cfbdPlayerId) {
  const id = String(cfbdPlayerId);
  if (evalIsWatchlisted(id)) evalWatchlist = evalWatchlist.filter(entry => entry !== id);
  else evalWatchlist.push(id);
  evalSaveWatchlist();
  return evalIsWatchlisted(id);
}

function evalGetWatchlistPlayers() {
  return evalGetWatchlistIds().map(id => evalResolvePlayer(id)).filter(Boolean);
}

evalLoadWatchlist();