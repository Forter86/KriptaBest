import { state, updateState } from './state.js';

function parseHash(hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const [pathPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { page: 'home', params: {} };
  }

  if (parts[0] === 'portfolio') {
    return { page: 'portfolio', params: {} };
  }

  if (parts[0] === 'coin' && parts[1]) {
    return { page: 'coin', params: { id: decodeURIComponent(parts[1]) } };
  }

  return { page: 'home', params: {} };
}

function applyRoute(route, { replace = false } = {}) {
  updateState((s) => {
    s.route.page = route.page;
    s.route.params = route.params;
  });

  const hash =
    route.page === 'home'
      ? '#/'
      : route.page === 'portfolio'
        ? '#/portfolio'
        : `#/coin/${encodeURIComponent(route.params.id)}`;

  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (replace) {
    window.history.replaceState(route, '', url);
  } else if (window.location.hash !== hash) {
    window.history.pushState(route, '', url);
  }
}

export function navigate(page, params = {}, { replace = false } = {}) {
  applyRoute({ page, params }, { replace });
}

export function initRouter() {
  const initial = parseHash(window.location.hash);
  applyRoute(initial, { replace: true });

  window.addEventListener('popstate', () => {
    const route = parseHash(window.location.hash);
    updateState((s) => {
      s.route.page = route.page;
      s.route.params = route.params;
    });
  });

  window.addEventListener('hashchange', () => {
    const route = parseHash(window.location.hash);
    if (
      state.route.page !== route.page ||
      state.route.params.id !== route.params.id
    ) {
      updateState((s) => {
        s.route.page = route.page;
        s.route.params = route.params;
      });
    }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    e.preventDefault();
    const route = parseHash(href);
    applyRoute(route);
  });
}

export function goBack() {
  window.history.back();
}

export function goForward() {
  window.history.forward();
}
