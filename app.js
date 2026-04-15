// ============================================================
// APP.JS — THIN COORDINATOR
// All business logic lives in modules/*.js
// This file: page navigation, DOMContentLoaded init
// ============================================================

let activePage = 'pageExpenses';
const PAGE_META = {
  pageExpenses: 'Compensation Dashboard',
  pagePlayers: 'National Player Intelligence',
};

// ── Page Navigation ──────────────────────────────────────────

function updatePageChrome(pageId) {
  const navSub = document.getElementById('navSub');
  if (navSub) navSub.textContent = PAGE_META[pageId] || 'Dashboard';
  document.body.dataset.page = pageId;
}

function initPageNav() {
  document.querySelectorAll('.pageNavBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.dataset.page;
      switchPage(pageId);
    });
  });
}

function switchPage(pageId) {
  if (activePage === pageId) return;
  activePage = pageId;
  updatePageChrome(pageId);

  // Update nav buttons
  document.querySelectorAll('.pageNavBtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  // Show/hide pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === pageId);
  });

  // Lazy-load page content
  if (pageId === 'pageExpenses') {
    expRender();
  } else if (pageId === 'pagePlayers') {
    if (!natState.loaded && !natState.loading) {
      // Ping the Cloudflare worker health endpoint first so we don't accidentally
      // attempt a heavy CFBD pull from the worker if it's unreachable or misconfigured.
      fetch(WORKER_URL + '/health', { method: 'GET' })
        .then(res => res.ok ? natLoadData() : Promise.reject(new Error('health check failed ' + res.status)))
        .catch(err => {
          console.warn('Worker health check failed, showing Load prompt:', err);
          // Render the manual Load prompt so the user can retry.
          natRenderPage();
        });
    } else {
      natRenderPage();
    }
  }
}

// ── Error display ────────────────────────────────────────────

window.addEventListener('error', (e) => {
  console.error('Runtime error:', e.message);
});

// ── Boot ─────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  initPageNav();
  initExpenses();
  updatePageChrome(activePage);

  // Render initial page
  expRender();

  // Auto-load national player data in the background on boot.
  // All requests go through the Cloudflare worker cache (30-day TTL),
  // so this won't burn CFBD API quota on repeated opens.
  natLoadData();
});

// ── Window bridge (for debugging) ────────────────────────────
window._app = {
  get expState() { return expState; },
  get natState() { return natState; },
  get cfbdRoster() { return cfbdRoster; },
  get matches() { return getCurrentMatches(); },
  switchPage,
  natLoadData,
  openPlayerProfile,
};