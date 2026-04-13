/** Format a number as USD currency (no decimals). */
export const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
};

/** Top-level budget summary. */
export function getStats(players, totalBudget) {
  const totalCommitted = players.reduce((s, p) => s + (p.totalCompensation || 0), 0);
  return {
    totalBudget: totalBudget ?? 0,
    totalCommitted,
    remaining: (totalBudget ?? 0) - totalCommitted,
    playerCount: players.length,
  };
}

/** Total spend grouped by position, sorted descending. */
export function getSpendByPosition(players) {
  const map = {};
  players.forEach((p) => {
    const k = p.position || 'Unknown';
    map[k] = (map[k] || 0) + p.totalCompensation;
  });
  return Object.entries(map)
    .map(([position, total]) => ({ position, total }))
    .sort((a, b) => b.total - a.total);
}

const YEAR_ORDER = ['Fr', 'So', 'Jr', 'Sr'];

/** Total spend grouped by class year, sorted by class order. */
export function getSpendByYear(players) {
  const map = {};
  players.forEach((p) => {
    const k = p.year || 'Unknown';
    map[k] = (map[k] || 0) + p.totalCompensation;
  });
  return Object.entries(map)
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => {
      const ai = YEAR_ORDER.indexOf(a.year);
      const bi = YEAR_ORDER.indexOf(b.year);
      if (ai === -1 && bi === -1) return a.year.localeCompare(b.year);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

/** Player count and total spend grouped by campus status. */
export function getCampusBreakdown(players) {
  const map = {};
  players.forEach((p) => {
    const k = p.campus || 'Unknown';
    if (!map[k]) map[k] = { name: k, count: 0, total: 0 };
    map[k].count++;
    map[k].total += p.totalCompensation;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

/** Player count grouped by contract length. */
export function getContractBreakdown(players) {
  const map = {};
  players.forEach((p) => {
    const k = p.contractLength !== null ? `${p.contractLength}-Month` : 'Unknown';
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const an = parseFloat(a.name);
      const bn = parseFloat(b.name);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.name.localeCompare(b.name);
    });
}
