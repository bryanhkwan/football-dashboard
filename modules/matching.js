// ============ MATCHING MODULE ============
// Dependencies: config.js (STORAGE_KEY, MATCHING_KEY, esc)
// Name matching engine: links internal CSV players to CFBD roster data

let matchingOverrides = {}; // { internalId: cfbdPlayerId }
let cfbdRoster = [];        // Raw CFBD roster for Toledo
let matchingApprovals = {}; // { internalId: cfbdPlayerId }

function loadMatchingOverrides() {
  try {
    const raw = localStorage.getItem(MATCHING_KEY);
    if (raw) matchingOverrides = JSON.parse(raw);
  } catch (_) {}
}

function saveMatchingOverrides() {
  try {
    localStorage.setItem(MATCHING_KEY, JSON.stringify(matchingOverrides));
  } catch (_) {}
}

function loadMatchingApprovals() {
  try {
    const raw = localStorage.getItem(MATCHING_APPROVAL_KEY);
    if (raw) matchingApprovals = JSON.parse(raw);
  } catch (_) {}
}

function saveMatchingApprovals() {
  try {
    localStorage.setItem(MATCHING_APPROVAL_KEY, JSON.stringify(matchingApprovals));
  } catch (_) {}
}

// Normalize a name for fuzzy comparison
function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '')
    .trim();
}

// Levenshtein distance (for typo tolerance)
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Find best CFBD match for an internal player
function findBestMatch(player) {
  // Manual override takes priority
  if (matchingOverrides[player.id]) {
    const override = cfbdRoster.find(r => String(r.id) === String(matchingOverrides[player.id]));
    if (override) return { match: override, confidence: 'manual', score: 1 };
  }

  const internalName = normName(`${player.firstName} ${player.lastName}`);
  if (!internalName) return null;

  let bestMatch = null;
  let bestScore = Infinity;

  for (const rp of cfbdRoster) {
    const cfbdName = normName(`${rp.firstName} ${rp.lastName}`);
    if (!cfbdName) continue;

    // Exact match
    if (internalName === cfbdName) {
      return { match: rp, confidence: 'exact', score: 0 };
    }

    // Position check (bonus for same position)
    const samePos = (player.position || '').toUpperCase() === (rp.position || '').toUpperCase();

    const dist = levenshtein(internalName, cfbdName);
    const adjusted = samePos ? dist - 0.5 : dist;
    if (adjusted < bestScore) {
      bestScore = adjusted;
      bestMatch = rp;
    }
  }

  // Accept fuzzy matches with distance ≤ 3
  if (bestMatch && bestScore <= 3) {
    const conf = bestScore <= 1 ? 'high' : bestScore <= 2 ? 'medium' : 'low';
    return { match: bestMatch, confidence: conf, score: bestScore };
  }

  return null;
}

// Match all internal players and return a map: { internalId: { match, confidence } }
function matchAllPlayers(internalPlayers) {
  const results = {};
  for (const p of internalPlayers) {
    results[p.id] = findBestMatch(p);
  }
  return results;
}

// Set manual override
function setMatchOverride(internalId, cfbdPlayerId) {
  if (cfbdPlayerId) {
    matchingOverrides[internalId] = cfbdPlayerId;
    matchingApprovals[internalId] = cfbdPlayerId;
  } else {
    delete matchingOverrides[internalId];
    delete matchingApprovals[internalId];
  }
  saveMatchingOverrides();
  saveMatchingApprovals();
}

function approveMatch(internalId, cfbdPlayerId) {
  if (!cfbdPlayerId) return;
  matchingApprovals[internalId] = String(cfbdPlayerId);
  saveMatchingApprovals();
}

function clearMatchApproval(internalId) {
  delete matchingApprovals[internalId];
  saveMatchingApprovals();
}

function isMatchApproved(internalId, cfbdPlayerId) {
  if (!cfbdPlayerId) return false;
  const approvedId = matchingApprovals[internalId];
  return approvedId ? String(approvedId) === String(cfbdPlayerId) : false;
}

function getMatchReviewState(internalId) {
  const current = _currentMatches[internalId];
  if (!current || !current.match) return 'unmatched';
  if (matchingOverrides[internalId]) return 'fixed';
  if (isMatchApproved(internalId, current.match.id)) return 'approved';
  if (current.confidence === 'low' || current.confidence === 'medium') return 'review';
  return 'pending';
}

// Get CFBD player ID for an internal player (if matched)
function getCfbdIdForPlayer(internalId) {
  if (matchingOverrides[internalId]) return matchingOverrides[internalId];
  // This will be called after matchAllPlayers populates _currentMatches
  return _currentMatches[internalId]?.match?.id || null;
}

let _currentMatches = {};
function setCurrentMatches(m) { _currentMatches = m; }
function getCurrentMatches() { return _currentMatches; }

loadMatchingOverrides();
loadMatchingApprovals();
