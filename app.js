// ============================================================
// APP.JS — THIN COORDINATOR
// All business logic lives in modules/*.js
// This file: page navigation, DOMContentLoaded init
// ============================================================

let activePage = 'pageExpenses';
const PAGE_META = {
  pageExpenses: 'Compensation Dashboard',
  pagePlayers: 'Football Operations Board',
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
      natRenderPage(); // Shows "Load" prompt
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

  // Prepare players page (just render the load prompt)
  natRenderPage();
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