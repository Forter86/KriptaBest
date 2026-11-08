import {
  state,
  setRender,
  updateState,
  PORTFOLIO_KEY,
  setPortfolioFromStorage,
} from './state.js';
import { initRouter } from './router.js';
import { fetchTopCoins } from './api.js';
import { handleApiError, renderToasts, renderModal, showToast } from './ui.js';
import { formatDateTime, setText, clearChildren } from './utils.js';

import { mountHome, updateHome, unmountHome } from './pages/home.js';
import { mountCoin, updateCoin, unmountCoin, loadCoinData } from './pages/coin.js';
import { mountPortfolio, updatePortfolio, unmountPortfolio } from './pages/portfolio.js';
import { mountPromoRoulette } from './promo-roulette.js';

const POLL_INTERVAL_MS = 45000;

let currentPage = null;
let currentCoinId = null;
let pollTimer = null;
let marketAbort = null;
let lastMarketUpdated = null;
let lastPortfolioFingerprint = '';

function portfolioFingerprint() {
  return JSON.stringify(state.portfolio.transactions);
}

function updateHeaderStatus() {
  const indicator = document.getElementById('poll-indicator');
  const lastUpdated = document.getElementById('last-updated');

  if (indicator) {
    const show =
      state.market.updating ||
      (state.market.loading && state.market.coins.length > 0);
    indicator.classList.toggle('hidden', !show);
    indicator.classList.toggle('flex', show);
  }

  if (lastUpdated) {
    setText(
      lastUpdated,
      state.market.lastUpdated
        ? `обн. ${formatDateTime(state.market.lastUpdated)}`
        : ''
    );
  }

  let bar = document.getElementById('global-progress');
  const updating = state.market.updating || state.market.loading;
  if (updating) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'global-progress';
      bar.className = 'progress-bar';
      document.querySelector('header')?.appendChild(bar);
    }
  } else if (bar) {
    bar.remove();
  }

  document.querySelectorAll('.nav-link').forEach((link) => {
    const route = link.dataset.route;
    const active =
      (route === 'home' && state.route.page === 'home') ||
      (route === 'portfolio' && state.route.page === 'portfolio');
    link.classList.toggle('active', active);
  });
}

function renderPage() {
  const main = document.getElementById('main');
  if (!main) return;

  const page = state.route.page;
  const coinId = state.route.params.id || null;
  const pageChanged =
    page !== currentPage || (page === 'coin' && coinId !== currentCoinId);

  const marketChanged = state.market.lastUpdated !== lastMarketUpdated;
  const portfolioChanged = portfolioFingerprint() !== lastPortfolioFingerprint;

  if (pageChanged) {
    if (currentPage === 'home') unmountHome();
    if (currentPage === 'coin') unmountCoin();
    if (currentPage === 'portfolio') unmountPortfolio();

    clearChildren(main);
    currentPage = page;
    currentCoinId = coinId;

    if (page === 'home') mountHome(main);
    else if (page === 'coin') {

      updateState((s) => {
        s.coin.id = coinId;
        s.coin.meta = s.market.coins.find((c) => c.id === coinId) || null;
        s.coin.chart = null;
        s.coin.loading = !s.coin.meta;
        s.coin.chartLoading = true;
        s.coin.error = null;
      }, { silent: true });
      mountCoin(main);
      if (coinId) loadCoinData(coinId);
    } else if (page === 'portfolio') mountPortfolio(main);
  } else if (page === 'home') {
    updateHome({ dataChanged: marketChanged });
  } else if (page === 'coin') {
    updateCoin();
  } else if (page === 'portfolio' && (portfolioChanged || marketChanged)) {
    updatePortfolio();
  }

  lastMarketUpdated = state.market.lastUpdated;
  lastPortfolioFingerprint = portfolioFingerprint();

  updateHeaderStatus();
  renderToasts();
  renderModal();
}

async function loadMarket({ isPoll = false } = {}) {
  if (marketAbort) marketAbort.abort();
  marketAbort = new AbortController();

  updateState((s) => {
    if (isPoll || s.market.coins.length > 0) s.market.updating = true;
    else s.market.loading = true;
    s.market.error = null;
  });

  try {
    const coins = await fetchTopCoins(marketAbort.signal);
    updateState((s) => {
      s.market.coins = Array.isArray(coins) ? coins : [];
      s.market.loading = false;
      s.market.updating = false;
      s.market.lastUpdated = Date.now();
      s.market.error = null;
    });
  } catch (err) {
    if (err?.name === 'AbortError') return;
    const isFirst = state.market.coins.length === 0;
    updateState((s) => {
      s.market.loading = false;
      s.market.updating = false;
      s.market.error = err.message;
    });
    handleApiError(err, { asModal: err?.code === 'RATE_LIMIT' || isFirst });
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => loadMarket({ isPoll: true }), POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function initCrossTabSync() {
  window.addEventListener('storage', (e) => {
    if (e.key !== PORTFOLIO_KEY) return;
    try {
      const data = e.newValue ? JSON.parse(e.newValue) : [];
      setPortfolioFromStorage(Array.isArray(data) ? data : []);
      showToast('Портфель обновлён из другой вкладки', 'info');
    } catch {
      
    }
  });

  if (typeof BroadcastChannel === 'undefined') return;

  const channel = new BroadcastChannel('kriptabest_portfolio');
  channel.addEventListener('message', (event) => {
    if (event.data?.type !== 'portfolio-updated') return;
    if (!Array.isArray(event.data.transactions)) return;
    if (portfolioFingerprint() === JSON.stringify(event.data.transactions)) return;
    setPortfolioFromStorage(event.data.transactions);
    showToast('Портфель обновлён из другой вкладки', 'info');
  });

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItemPatched(key, value) {
    originalSetItem.call(this, key, value);
    if (key === PORTFOLIO_KEY) {
      try {
        channel.postMessage({
          type: 'portfolio-updated',
          transactions: JSON.parse(value),
        });
      } catch {
        
      }
    }
  };
}

function init() {
  setRender(renderPage);
  initRouter();
  initCrossTabSync();

  renderPage();
  loadMarket({ isPoll: false })
    .catch(() => {})
    .finally(() => {
      startPolling();

      mountPromoRoulette(document.body);
    });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadMarket({ isPoll: true });
    }
  });
}

init();
