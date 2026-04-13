// ============ PROFILE MODULE ============
// Dependencies: config.js, cache.js, matching.js, expenses.js, national.js
// Player dossier modal — shows stats, workload, value-added, roster context, and spend linkage.

let profileModal = null;
let profileBackdrop = null;
const profileTeamCache = {
  usage: Object.create(null),
  ppa: Object.create(null),
};

const PROFILE_CATEGORY_LABELS = {
  passing: 'Passing',
  rushing: 'Rushing',
  receiving: 'Receiving',
  defensive: 'Defense',
  interceptions: 'Takeaways',
  fumbles: 'Ball Security',
  kicking: 'Kicking',
  punting: 'Punting',
};

const PROFILE_STAT_ORDER = {
  passing: ['YDS', 'TD', 'INT', 'COMPLETIONS', 'ATT', 'PCT', 'YPA', 'LONG'],
  rushing: ['YDS', 'TD', 'CAR', 'YPC', 'LONG'],
  receiving: ['YDS', 'TD', 'REC', 'YPR', 'LONG'],
  defensive: ['TACKLES', 'SOLO', 'AST', 'TFL', 'SACKS', 'PD'],
  interceptions: ['INT', 'YDS', 'TD', 'LONG'],
  fumbles: ['FUM', 'REC', 'LOST'],
  kicking: ['FGM', 'FGA', 'FG_PCT', 'XPM', 'XPA', 'LONG'],
  punting: ['NO', 'YPP', 'YDS', 'LONG', 'IN 20', 'TB'],
};

const PROFILE_STAT_LABELS = {
  ATT: 'Attempts',
  AST: 'Assists',
  CAR: 'Carries',
  COMPLETIONS: 'Completions',
  FG_PCT: 'Field Goal %',
  FGA: 'FG Attempts',
  FGM: 'Field Goals',
  FUM: 'Fumbles',
  INT: 'Interceptions',
  LONG: 'Long',
  LOST: 'Lost',
  NO: 'Punts',
  PD: 'Pass Breakups',
  PCT: 'Completion %',
  REC: 'Receptions',
  SACKS: 'Sacks',
  SOLO: 'Solo Tackles',
  TACKLES: 'Tackles',
  TB: 'Touchbacks',
  TD: 'Touchdowns',
  TFL: 'TFL',
  XPA: 'PAT Attempts',
  XPM: 'PAT Made',
  YDS: 'Yards',
  YPA: 'Yards / Attempt',
  YPC: 'Yards / Carry',
  YPP: 'Punt Avg',
  YPR: 'Yards / Catch',
  'IN 20': 'Inside 20',
};

function initProfileModal() {
  if (document.getElementById('profileBackdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'profileBackdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closePlayerProfile();
  });

  const modal = document.createElement('div');
  modal.id = 'profileModal';
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-header">
      <div class="profile-title">
        <p class="section-kicker" id="profile-kicker">Player Dossier</p>
        <h2 id="profile-name">—</h2>
        <p id="profile-sub" class="profile-subline">—</p>
      </div>
      <button class="btn-close" id="profile-close">×</button>
    </div>
    <div class="profile-body" id="profile-body">
      <div class="spinner"></div>
    </div>`;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  profileModal = modal;
  profileBackdrop = backdrop;

  document.getElementById('profile-close').addEventListener('click', closePlayerProfile);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePlayerProfile();
  });
}

function closePlayerProfile() {
  if (profileBackdrop) profileBackdrop.classList.remove('open');
}

async function openPlayerProfile(cfbdPlayerId) {
  initProfileModal();
  profileBackdrop.classList.add('open');
  if (profileModal) profileModal.scrollTop = 0;

  const kickerEl = document.getElementById('profile-kicker');
  const nameEl = document.getElementById('profile-name');
  const subEl = document.getElementById('profile-sub');
  const bodyEl = document.getElementById('profile-body');

  kickerEl.textContent = 'Player Dossier';
  nameEl.textContent = 'Loading…';
  subEl.textContent = '';
  bodyEl.innerHTML = '<div class="spinner"></div>';

  try {
    const player = natState.allStats.find(p => String(p.playerId) === String(cfbdPlayerId));
    const rosterPlayer = cfbdRoster.find(r => String(r.id) === String(cfbdPlayerId));
    const expensePlayer = profileFindExpensePlayer(cfbdPlayerId);

    const name = rosterPlayer
      ? `${rosterPlayer.firstName} ${rosterPlayer.lastName}`
      : (player ? player.name : `Player #${cfbdPlayerId}`);
    const team = rosterPlayer?.team || player?.team || '';
    const position = rosterPlayer?.position || player?.position || '';
    const jersey = rosterPlayer?.jersey || player?.jersey || '';
    const height = profileHeight(rosterPlayer?.height || player?.height);
    const weight = rosterPlayer?.weight || player?.weight || null;
    const classYear = profileClassLabel(rosterPlayer?.year || player?.year);
    const hometown = rosterPlayer?.homeCity
      ? `${rosterPlayer.homeCity}${rosterPlayer.homeState ? `, ${rosterPlayer.homeState}` : ''}`
      : '';

    const [usageRow, ppaRow] = await Promise.all([
      profileLoadTeamUsage(team).then(rows => profileFindTeamRow(rows, cfbdPlayerId, name)),
      profileLoadTeamPpa(team).then(rows => profileFindTeamRow(rows, cfbdPlayerId, name)),
    ]);

    const teamRating = typeof natGetTeamRating === 'function' ? natGetTeamRating(team) : null;
    const portalEntry = team === 'Toledo' && typeof natFindToledoPortalEntry === 'function'
      ? natFindToledoPortalEntry(name)
      : null;
    const recruitEntry = team === 'Toledo' && typeof natFindToledoRecruit === 'function'
      ? natFindToledoRecruit(name)
      : null;
    const assessment = evalGetPlayerAssessment(player);
    const expenseValue = player && expensePlayer ? evalGetExpenseValue(player, expensePlayer) : null;
    const watchlisted = evalIsWatchlisted(cfbdPlayerId);

    nameEl.textContent = name;
    subEl.innerHTML = profileBuildSubline({ team, position, jersey, height, weight, classYear, hometown });
    bodyEl.innerHTML = profileRenderBody({
      player,
      rosterPlayer,
      expensePlayer,
      usageRow,
      ppaRow,
      teamRating,
      portalEntry,
      recruitEntry,
      name,
      team,
      position,
      assessment,
      expenseValue,
      cfbdPlayerId,
      watchlisted,
    });
    document.getElementById('profile-watch-toggle')?.addEventListener('click', () => {
      evalToggleWatchlist(cfbdPlayerId);
      openPlayerProfile(cfbdPlayerId);
      if (typeof natRenderPage === 'function' && activePage === 'pagePlayers' && natState.loaded) natRenderPage();
    });

  } catch (e) {
    bodyEl.innerHTML = `<p class="text-red">Error loading profile: ${esc(e.message)}</p>`;
  }
}

function profileFindExpensePlayer(cfbdPlayerId) {
  const matches = getCurrentMatches();
  for (const [internalId, match] of Object.entries(matches)) {
    if (match && match.match && String(match.match.id) === String(cfbdPlayerId)) {
      return expState.players.find(player => player.id === parseInt(internalId, 10)) || null;
    }
  }
  return null;
}

async function profileLoadTeamUsage(team) {
  if (!team) return [];
  if (team === 'Toledo' && natState.program?.toledoUsage?.length) return natState.program.toledoUsage;
  if (profileTeamCache.usage[team]) return profileTeamCache.usage[team];
  const rows = await apiFetch('/api/usage', { year: CFBD_SEASON, team }).catch(() => []);
  profileTeamCache.usage[team] = Array.isArray(rows) ? rows : [];
  return profileTeamCache.usage[team];
}

async function profileLoadTeamPpa(team) {
  if (!team) return [];
  if (team === 'Toledo' && natState.program?.toledoPpa?.length) return natState.program.toledoPpa;
  if (profileTeamCache.ppa[team]) return profileTeamCache.ppa[team];
  const rows = await apiFetch('/api/ppa', { year: CFBD_SEASON, team }).catch(() => []);
  profileTeamCache.ppa[team] = Array.isArray(rows) ? rows : [];
  return profileTeamCache.ppa[team];
}

function profileFindTeamRow(rows, playerId, name) {
  return rows.find(row => String(row.id) === String(playerId)) ||
    rows.find(row => normName(row.name) === normName(name)) ||
    null;
}

function profileRenderBody(ctx) {
  const summary = profileBuildSummary(ctx);
  const kpis = profileBuildKpis(ctx);
  const contextCards = profileBuildContextCards(ctx);
  const guideItems = profileBuildGuideItems(ctx);
  const statSections = profileBuildStatSections(ctx.player);
  const benchmarkCards = profileBuildBenchmarkCards(ctx.assessment);

  return `
    <div class="profile-banner">
      <div class="profile-banner-copy">
        <p class="section-kicker">Operations Summary</p>
        <p class="profile-summary">${esc(summary)}</p>
      </div>
      <div class="profile-banner-side">
        ${ctx.teamRating ? `
          <div class="profile-banner-rating tone-gold">
            <span>Team Context</span>
            <strong>#${ctx.teamRating.ranking}</strong>
            <small>${esc(ctx.team)} SP+ rank</small>
          </div>` : ''}
        <button class="btn btn-secondary btn-sm profile-watch-toggle${ctx.watchlisted ? ' is-active' : ''}" id="profile-watch-toggle">
          ${ctx.watchlisted ? '★ On Watchlist' : '☆ Add To Watchlist'}
        </button>
      </div>
    </div>

    ${kpis.length ? `
      <div class="profile-kpi-grid">
        ${kpis.map(profileRenderKpiCard).join('')}
      </div>` : ''}

    ${benchmarkCards.length ? `
      <div class="profile-section">
        <h3>${esc(ctx.assessment.modelLabel)} Benchmarks</h3>
        <div class="profile-context-grid">
          ${benchmarkCards.map(profileRenderBenchmarkCard).join('')}
        </div>
      </div>` : ''}

    ${contextCards.length ? `
      <div class="profile-section">
        <h3>Program Context</h3>
        <div class="profile-context-grid">
          ${contextCards.map(profileRenderContextCard).join('')}
        </div>
      </div>` : ''}

    ${ctx.expensePlayer ? profileRenderExpenseSection(ctx.expensePlayer) : ''}

    ${guideItems.length ? `
      <div class="profile-section">
        <h3>Football Ops Lens</h3>
        <div class="profile-guide-grid">
          ${guideItems.map(item => `
            <div class="profile-guide-card">
              <strong>${esc(item.label)}</strong>
              <p>${esc(item.copy)}</p>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

    ${statSections.length
      ? statSections.map(section => `
        <div class="profile-section">
          <h3>${esc(section.label)}</h3>
          <div class="profile-stat-grid">
            ${section.stats.map(stat => `
              <div class="profile-stat">
                <span class="profile-stat-label">${esc(stat.label)}</span>
                <span class="profile-stat-value">${stat.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
      : '<div class="profile-section"><p class="text-muted">No season stats available for this player.</p></div>'}
  `;
}

function profileBuildSummary(ctx) {
  const position = ctx.position || 'player';
  const usage = ctx.usageRow?.usage?.overall;
  const avgPpa = ctx.ppaRow?.averagePPA?.all;
  const totalPpa = ctx.ppaRow?.totalPPA?.all;
  const production = profileBuildProductionLine(ctx.player, position);
  const security = profileBuildSecurityLine(ctx.player, position);

  const parts = [];
  if (Number.isFinite(usage)) {
    parts.push(`${profileUsageDescriptor(usage)} ${position.toUpperCase()} involved on ${profileFmtPct(usage, 1)} of ${ctx.team || 'team'} plays`);
  } else if (ctx.team || position) {
    parts.push(`${ctx.team || 'Team'} ${position.toUpperCase()} production profile`);
  }
  if (Number.isFinite(avgPpa)) {
    const totalText = Number.isFinite(totalPpa) ? ` and ${profileFmtSigned(totalPpa, 1)} total PPA` : '';
    parts.push(`${profilePpaDescriptor(avgPpa)} efficiency at ${profileFmtSigned(avgPpa, 3)} average PPA per play${totalText}`);
  }
  if (production) parts.push(production);
  if (security) parts.push(security);

  return parts.filter(Boolean).join('. ') + '.';
}

function profileBuildProductionLine(player, position) {
  const pos = (position || '').toUpperCase();
  const group = positionGroup(pos);
  const passYds = profileStat(player, 'passing_YDS');
  const passTd = profileStat(player, 'passing_TD');
  const rushYds = profileStat(player, 'rushing_YDS');
  const rushTd = profileStat(player, 'rushing_TD');
  const rec = profileStat(player, 'receiving_REC');
  const recYds = profileStat(player, 'receiving_YDS');
  const recTd = profileStat(player, 'receiving_TD');
  const tackles = profileStat(player, 'defensive_TACKLES');
  const sacks = profileStat(player, 'defensive_SACKS');
  const defInt = profileStat(player, 'interceptions_INT');
  const fgMade = profileStat(player, 'kicking_FGM');
  const fgPct = profileStat(player, 'kicking_FG_PCT');
  const puntAvg = profileStat(player, 'punting_YPP');

  if (pos === 'QB' && (profileHasValue(passYds) || profileHasValue(rushYds))) {
    return `${profileWhole(passYds)} pass yards, ${profileWhole(passTd)} passing TD, and ${profileWhole(rushYds)} rush yards`;
  }
  if ((pos === 'RB' || pos === 'FB') && (profileHasValue(rushYds) || profileHasValue(rushTd))) {
    return `${profileWhole(rushYds)} rush yards with ${profileWhole(rushTd)} rushing TD`;
  }
  if ((pos === 'WR' || pos === 'TE') && (profileHasValue(recYds) || profileHasValue(recTd))) {
    return `${profileWhole(rec)} catches for ${profileWhole(recYds)} yards and ${profileWhole(recTd)} TD`;
  }
  if (group === 'Defense' && (profileHasValue(tackles) || profileHasValue(sacks) || profileHasValue(defInt))) {
    const chunks = [];
    if (profileHasValue(tackles)) chunks.push(`${profileWhole(tackles)} tackles`);
    if (profileHasValue(sacks)) chunks.push(`${profileCleanNum(sacks)} sacks`);
    if (profileHasValue(defInt)) chunks.push(`${profileWhole(defInt)} interceptions`);
    return chunks.join(', ');
  }
  if (pos === 'K' && (profileHasValue(fgMade) || profileHasValue(fgPct))) {
    return `${profileWhole(fgMade)} field goals made at ${profileFmtPct(fgPct, 1)}`;
  }
  if (pos === 'P' && profileHasValue(puntAvg)) {
    return `${profileCleanNum(puntAvg)} yards per punt`;
  }
  return '';
}

function profileBuildSecurityLine(player, position) {
  const pos = (position || '').toUpperCase();
  const passInt = profileStat(player, 'passing_INT');
  const lost = profileStat(player, 'fumbles_LOST');
  const recovered = profileStat(player, 'fumbles_REC');
  const defInt = profileStat(player, 'interceptions_INT');

  if (pos === 'QB' && profileHasValue(passInt)) {
    return `${profileWhole(passInt)} interceptions thrown`;
  }
  if ((pos === 'RB' || pos === 'FB' || pos === 'WR' || pos === 'TE') && profileHasValue(lost)) {
    return `${profileWhole(lost)} fumbles lost`;
  }
  if (positionGroup(pos) === 'Defense' && (profileHasValue(defInt) || profileHasValue(recovered))) {
    const takeaways = (defInt || 0) + (recovered || 0);
    return `${profileWhole(takeaways)} total takeaways created or recovered`;
  }
  return '';
}

function profileBuildKpis(ctx) {
  const cards = [];
  const usage = ctx.usageRow?.usage?.overall;
  const avgPpa = ctx.ppaRow?.averagePPA?.all;
  const totalPpa = ctx.ppaRow?.totalPPA?.all;

  if (ctx.assessment) {
    cards.push({
      label: `${ctx.assessment.modelLabel} Score`,
      value: fmtNum(ctx.assessment.score, 0),
      note: `${ctx.assessment.grade.label} against ${ctx.assessment.sampleSize.toLocaleString()} national peers.`,
      tone: `tone-${ctx.assessment.grade.tone === 'up' ? 'green' : ctx.assessment.grade.tone === 'down' ? 'gold' : 'slate'}`,
    });
  }

  if (Number.isFinite(usage)) {
    cards.push({
      label: 'Usage Share',
      value: profileFmtPct(usage, 1),
      note: 'Share of team offensive plays involving this player.',
      tone: 'tone-gold',
    });
  }
  if (Number.isFinite(avgPpa)) {
    cards.push({
      label: 'Avg PPA / Play',
      value: profileFmtSigned(avgPpa, 3),
      note: 'Per-play value added. Positive is better.',
      tone: 'tone-blue',
    });
  }
  if (Number.isFinite(totalPpa)) {
    cards.push({
      label: 'Total PPA',
      value: profileFmtSigned(totalPpa, 1),
      note: 'Cumulative season value added.',
      tone: 'tone-green',
    });
  }

  cards.push(...profileBuildRoleKpis(ctx.player, ctx.position));

  if (ctx.expenseValue?.index !== null && ctx.expenseValue?.index !== undefined) {
    cards.push({
      label: 'Value Index',
      value: `${ctx.expenseValue.index}`,
      note: `${ctx.expenseValue.label} relative to your current expense roster.`,
      tone: `tone-${ctx.expenseValue.status.tone === 'up' ? 'green' : ctx.expenseValue.status.tone === 'down' ? 'gold' : 'slate'}`,
    });
  }

  if (ctx.expensePlayer) {
    cards.push({
      label: 'Internal Comp',
      value: fmtMoney(ctx.expensePlayer.totalCompensation),
      note: 'Matched to your internal expense sheet.',
      tone: 'tone-slate',
    });
  }

  return cards.filter(card => card && card.value !== '—').slice(0, 8);
}

function profileBuildRoleKpis(player, position) {
  const pos = (position || '').toUpperCase();
  const group = positionGroup(pos);
  const cards = [];

  if (pos === 'QB') {
    const td = profileStat(player, 'passing_TD');
    const interceptions = profileStat(player, 'passing_INT');
    const pct = profileStat(player, 'passing_PCT');
    const passYds = profileStat(player, 'passing_YDS');
    const rushYds = profileStat(player, 'rushing_YDS');
    if (profileHasValue(td) || profileHasValue(interceptions)) {
      cards.push({ label: 'Pass TD / INT', value: `${profileWhole(td)} / ${profileWhole(interceptions)}`, note: 'Scoring against turnover risk.', tone: 'tone-slate' });
    }
    if (profileHasValue(pct)) cards.push({ label: 'Completion %', value: profileFmtPct(pct, 1), note: 'Passing accuracy.', tone: 'tone-slate' });
    if (profileHasValue(passYds)) cards.push({ label: 'Pass Yards', value: profileWhole(passYds), note: 'Season aerial production.', tone: 'tone-slate' });
    if (profileHasValue(rushYds)) cards.push({ label: 'Rush Yards', value: profileWhole(rushYds), note: 'Added run value.', tone: 'tone-slate' });
  } else if (pos === 'RB' || pos === 'FB') {
    const rushYds = profileStat(player, 'rushing_YDS');
    const ypc = profileStat(player, 'rushing_YPC');
    const td = profileStat(player, 'rushing_TD');
    if (profileHasValue(rushYds)) cards.push({ label: 'Rush Yards', value: profileWhole(rushYds), note: 'Ground production.', tone: 'tone-slate' });
    if (profileHasValue(ypc)) cards.push({ label: 'Yards / Carry', value: profileCleanNum(ypc), note: 'Rushing efficiency.', tone: 'tone-slate' });
    if (profileHasValue(td)) cards.push({ label: 'Rush TD', value: profileWhole(td), note: 'Touchdown output.', tone: 'tone-slate' });
  } else if (pos === 'WR' || pos === 'TE') {
    const rec = profileStat(player, 'receiving_REC');
    const recYds = profileStat(player, 'receiving_YDS');
    const ypr = profileStat(player, 'receiving_YPR');
    const td = profileStat(player, 'receiving_TD');
    if (profileHasValue(rec)) cards.push({ label: 'Receptions', value: profileWhole(rec), note: 'Catch volume.', tone: 'tone-slate' });
    if (profileHasValue(recYds)) cards.push({ label: 'Rec Yards', value: profileWhole(recYds), note: 'Receiving output.', tone: 'tone-slate' });
    if (profileHasValue(ypr)) cards.push({ label: 'Yards / Catch', value: profileCleanNum(ypr), note: 'Explosiveness per reception.', tone: 'tone-slate' });
    if (profileHasValue(td)) cards.push({ label: 'Rec TD', value: profileWhole(td), note: 'Scoring production.', tone: 'tone-slate' });
  } else if (group === 'Defense') {
    const tackles = profileStat(player, 'defensive_TACKLES');
    const sacks = profileStat(player, 'defensive_SACKS');
    const ints = profileStat(player, 'interceptions_INT');
    const tfl = profileStat(player, 'defensive_TFL');
    if (profileHasValue(tackles)) cards.push({ label: 'Tackles', value: profileWhole(tackles), note: 'Overall stop volume.', tone: 'tone-slate' });
    if (profileHasValue(sacks)) cards.push({ label: 'Sacks', value: profileCleanNum(sacks), note: 'Backfield disruption.', tone: 'tone-slate' });
    if (profileHasValue(tfl)) cards.push({ label: 'TFL', value: profileCleanNum(tfl), note: 'Negative plays created.', tone: 'tone-slate' });
    if (profileHasValue(ints)) cards.push({ label: 'Takeaways', value: profileWhole(ints), note: 'Interceptions created.', tone: 'tone-slate' });
  } else if (pos === 'K') {
    const fgm = profileStat(player, 'kicking_FGM');
    const fga = profileStat(player, 'kicking_FGA');
    const pct = profileStat(player, 'kicking_FG_PCT');
    const long = profileStat(player, 'kicking_LONG');
    if (profileHasValue(fgm) || profileHasValue(fga)) cards.push({ label: 'FG Made / Att', value: `${profileWhole(fgm)} / ${profileWhole(fga)}`, note: 'Field goal volume.', tone: 'tone-slate' });
    if (profileHasValue(pct)) cards.push({ label: 'FG %', value: profileFmtPct(pct, 1), note: 'Kicking accuracy.', tone: 'tone-slate' });
    if (profileHasValue(long)) cards.push({ label: 'Long', value: profileWhole(long), note: 'Longest field goal.', tone: 'tone-slate' });
  } else if (pos === 'P') {
    const avg = profileStat(player, 'punting_YPP');
    const inside20 = profileStat(player, 'punting_IN 20');
    const punts = profileStat(player, 'punting_NO');
    if (profileHasValue(avg)) cards.push({ label: 'Punt Avg', value: profileCleanNum(avg), note: 'Average punt distance.', tone: 'tone-slate' });
    if (profileHasValue(inside20)) cards.push({ label: 'Inside 20', value: profileWhole(inside20), note: 'Pins inside opponent 20.', tone: 'tone-slate' });
    if (profileHasValue(punts)) cards.push({ label: 'Punts', value: profileWhole(punts), note: 'Total punts.', tone: 'tone-slate' });
  }

  return cards.filter(card => card && card.value !== '—');
}

function profileBuildContextCards(ctx) {
  const cards = [];

  if (ctx.teamRating) {
    cards.push({
      label: `${ctx.team} Team Strength`,
      value: `#${ctx.teamRating.ranking} SP+`,
      meta: `Off #${ctx.teamRating.offense?.ranking || '—'} · Def #${ctx.teamRating.defense?.ranking || '—'} · ST ${profileFmtSigned(ctx.teamRating.specialTeams?.rating, 1)}`,
      tone: 'tone-gold',
    });
  }
  if (ctx.portalEntry) {
    const direction = ctx.portalEntry.destination === 'Toledo' ? 'Transfer In' : 'Transfer Out';
    cards.push({
      label: 'Portal File',
      value: direction,
      meta: `${ctx.portalEntry.origin || '—'} → ${ctx.portalEntry.destination || '—'} · ${profileStars(ctx.portalEntry.stars)} · ${ctx.portalEntry.eligibility || 'Eligibility TBD'}`,
      tone: 'tone-blue',
    });
  }
  if (ctx.recruitEntry) {
    const hometown = [ctx.recruitEntry.city, ctx.recruitEntry.stateProvince].filter(Boolean).join(', ');
    cards.push({
      label: 'Recruiting File',
      value: `${profileStars(ctx.recruitEntry.stars)} ${ctx.recruitEntry.position || 'ATH'}`,
      meta: `#${ctx.recruitEntry.ranking || '—'} national${hometown ? ` · ${hometown}` : ''}`,
      tone: 'tone-green',
    });
  }

  return cards;
}

function profileBuildBenchmarkCards(assessment) {
  if (!assessment || !assessment.highlightMetrics?.length) return [];
  return assessment.highlightMetrics.map(metric => ({
    label: metric.label,
    value: metric.display,
    meta: `National avg ${metric.averageDisplay} · ${metric.status.label}`,
    tone: `tone-${metric.status.tone === 'up' ? 'green' : metric.status.tone === 'down' ? 'gold' : 'slate'}`,
  }));
}

function profileBuildGuideItems(ctx) {
  const items = [];
  if (ctx.assessment) {
    items.push({
      label: 'Role Score',
      copy: 'This score compares the player only against national peers at the same position cluster, so a quarterback is measured like a quarterback and a DB like a DB.',
    });
  }
  if (ctx.usageRow) {
    items.push({
      label: 'Usage Share',
      copy: 'The percentage of team offensive plays that run through this player. Higher usage usually means more weekly role and decision weight.',
    });
  }
  if (ctx.ppaRow?.averagePPA?.all !== undefined) {
    items.push({
      label: 'Average PPA',
      copy: 'Per-play efficiency measured in estimated points added. Positive numbers mean the player is generally helping the offense or special teams create scoring value.',
    });
  }
  if (ctx.ppaRow?.totalPPA?.all !== undefined) {
    items.push({
      label: 'Total PPA',
      copy: 'Season-long value accumulation. Useful for balancing pure efficiency with actual workload and touch volume.',
    });
  }
  if (ctx.expensePlayer) {
    items.push({
      label: 'Spend Link',
      copy: 'This player is linked to your internal compensation sheet, which makes it easier to compare financial allocation to on-field role and impact.',
    });
  }
  if (ctx.expenseValue?.index !== null && ctx.expenseValue?.index !== undefined) {
    items.push({
      label: 'Value Index',
      copy: 'Value index compares this player’s score to how much you are paying versus the rest of your current expense roster. Higher means you are getting more role-adjusted production per dollar.',
    });
  }
  return items;
}

function profileBuildStatSections(player) {
  if (!player || !player.stats) return [];
  const groups = {};

  for (const [key, value] of Object.entries(player.stats)) {
    if (!Number.isFinite(value)) continue;
    const parts = key.split('_');
    const cat = parts[0];
    const type = parts.slice(1).join('_');
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ type, value });
  }

  return Object.entries(groups).map(([cat, stats]) => ({
    label: PROFILE_CATEGORY_LABELS[cat] || profileTitle(cat),
    stats: stats
      .sort((a, b) => profileStatSort(cat, a.type) - profileStatSort(cat, b.type) || a.type.localeCompare(b.type))
      .map(stat => ({
        label: profileStatLabel(stat.type),
        value: profileFormatStatValue(stat.type, stat.value),
      })),
  }));
}

function profileRenderExpenseSection(player) {
  return `
    <div class="profile-section">
      <h3>Internal Compensation</h3>
      <div class="profile-stat-grid">
        <div class="profile-stat">
          <span class="profile-stat-label">Rev Share</span>
          <span class="profile-stat-value text-green">${fmtMoney(player.revShare)}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Stipend</span>
          <span class="profile-stat-value">${fmtMoney(player.stipend)}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Total Comp</span>
          <span class="profile-stat-value text-green">${fmtMoney(player.totalCompensation)}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Contract</span>
          <span class="profile-stat-value">${player.contractLength ? `${player.contractLength} months` : '—'}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Housing</span>
          <span class="profile-stat-value">${esc(player.campus) || '—'}</span>
        </div>
      </div>
    </div>`;
}

function profileRenderKpiCard(card) {
  return `
    <div class="profile-kpi-card ${card.tone || ''}">
      <span class="profile-kpi-label">${esc(card.label)}</span>
      <strong class="profile-kpi-value">${card.value}</strong>
      <p class="profile-kpi-note">${esc(card.note)}</p>
    </div>`;
}

function profileRenderContextCard(card) {
  return `
    <div class="profile-context-card ${card.tone || ''}">
      <span class="profile-context-label">${esc(card.label)}</span>
      <strong class="profile-context-value">${esc(card.value)}</strong>
      <p class="profile-context-meta">${esc(card.meta)}</p>
    </div>`;
}

function profileRenderBenchmarkCard(card) {
  return `
    <div class="profile-context-card ${card.tone || ''}">
      <span class="profile-context-label">${esc(card.label)}</span>
      <strong class="profile-context-value">${esc(card.value)}</strong>
      <p class="profile-context-meta">${esc(card.meta)}</p>
    </div>`;
}

function profileBuildSubline(meta) {
  const tokens = [
    meta.team ? `<span class="profile-meta-pill is-team">${esc(meta.team)}</span>` : '',
    meta.position ? `<span class="profile-meta-pill is-accent">${esc(meta.position)}</span>` : '',
    meta.jersey ? `<span class="profile-meta-pill">#${esc(meta.jersey)}</span>` : '',
    meta.height ? `<span class="profile-meta-pill">${esc(meta.height)}</span>` : '',
    meta.weight ? `<span class="profile-meta-pill">${esc(meta.weight)} lbs</span>` : '',
    meta.classYear ? `<span class="profile-meta-pill is-muted">${esc(meta.classYear)}</span>` : '',
    meta.hometown ? `<span class="profile-meta-pill is-muted">${esc(meta.hometown)}</span>` : '',
  ].filter(Boolean);
  return tokens.join('');
}

function profileHeight(inches) {
  return Number.isFinite(inches) ? `${Math.floor(inches / 12)}'${inches % 12}"` : '';
}

function profileClassLabel(year) {
  const key = Number(year);
  const map = { 1: 'Fr', 2: 'So', 3: 'Jr', 4: 'Sr', 5: 'Grad', 6: 'Grad' };
  return map[key] || (year ? String(year) : '');
}

function profileStat(player, key) {
  const value = player?.stats?.[key];
  return Number.isFinite(value) ? value : null;
}

function profileStatSort(cat, type) {
  const order = PROFILE_STAT_ORDER[cat] || [];
  const idx = order.indexOf(type);
  return idx === -1 ? order.length + 1 : idx;
}

function profileStatLabel(type) {
  return PROFILE_STAT_LABELS[type] || profileTitle(type.replace(/_/g, ' '));
}

function profileFormatStatValue(type, value) {
  if (!Number.isFinite(value)) return '—';
  if (type.includes('PCT')) return profileFmtPct(value, 1);
  if (['YPA', 'YPC', 'YPR', 'YPP'].includes(type)) return profileCleanNum(value);
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return profileWhole(value);
  return profileCleanNum(value);
}

function profileFmtPct(value, decimals = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(decimals)}%` : '—';
}

function profileFmtSigned(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}`;
}

function profileCleanNum(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function profileWhole(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString();
}

function profileHasValue(value) {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function profileUsageDescriptor(value) {
  if (value >= 0.35) return 'High-volume';
  if (value >= 0.18) return 'Featured';
  if (value >= 0.08) return 'Rotational';
  return 'Situational';
}

function profilePpaDescriptor(value) {
  if (value >= 0.35) return 'Strong';
  if (value >= 0.15) return 'Positive';
  if (value >= 0) return 'Neutral';
  return 'Negative';
}

function profileStars(stars) {
  return Number.isFinite(stars) ? `${stars}★` : '—';
}

function profileTitle(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

// ── Manual matching override modal ───────────────────────────

function openMatchingOverride(internalId) {
  const player = expState.players.find(p => p.id === internalId);
  if (!player) return;

  initProfileModal();
  profileBackdrop.classList.add('open');
  if (profileModal) profileModal.scrollTop = 0;

  const kickerEl = document.getElementById('profile-kicker');
  const nameEl = document.getElementById('profile-name');
  const subEl = document.getElementById('profile-sub');
  const bodyEl = document.getElementById('profile-body');

  kickerEl.textContent = 'Manual Link';
  nameEl.textContent = `Link: ${player.firstName} ${player.lastName}`;
  subEl.innerHTML = '<span class="profile-meta-pill is-muted">Select the matching CFBD player</span>';

  if (cfbdRoster.length === 0) {
    bodyEl.innerHTML = '<p class="text-muted">CFBD roster not loaded yet. Go to the Players tab and load data first.</p>';
    return;
  }

  bodyEl.innerHTML = `
    <div class="matching-search">
      <input class="filter-input" type="text" id="match-search" placeholder="Search CFBD roster…" />
    </div>
    <div class="matching-list" id="match-list"></div>`;

  function renderMatchList(query) {
    const list = document.getElementById('match-list');
    let candidates = cfbdRoster;
    if (query) {
      const needle = query.toLowerCase();
      candidates = cfbdRoster.filter(row =>
        `${row.firstName} ${row.lastName}`.toLowerCase().includes(needle)
      );
    }

    list.innerHTML = candidates.slice(0, 30).map(row => `
      <div class="matching-item" data-cfbd-id="${row.id}">
        <span class="matching-item-name">${esc(row.firstName)} ${esc(row.lastName)}</span>
        <span class="badge badge-green">${esc(row.position || '—')}</span>
        <span class="text-muted">#${row.jersey || '—'}</span>
      </div>
    `).join('') + (candidates.length === 0 ? '<p class="text-muted" style="padding:12px">No matches found</p>' : '');

    list.querySelectorAll('.matching-item').forEach(item => {
      item.addEventListener('click', () => {
        const cfbdId = item.dataset.cfbdId;
        setMatchOverride(internalId, cfbdId);
        const matches = matchAllPlayers(expState.players);
        setCurrentMatches(matches);
        expRender();
        closePlayerProfile();
      });
    });
  }

  renderMatchList('');
  document.getElementById('match-search')?.addEventListener('input', debounce(e => {
    renderMatchList(e.target.value);
  }, 200));
}
