const PORTFOLIO_KEY = 'kriptabest_portfolio';

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const state = {
  route: {
    page: 'home',
    params: {},
  },
  market: {
    coins: [],
    loading: false,
    updating: false,
    lastUpdated: null,
    error: null,
  },
  filters: {
    search: '',
    priceMin: '',
    priceMax: '',
    sortBy: 'market_cap_rank',
    sortDir: 'asc',
  },
  coin: {
    id: null,
    meta: null,
    chart: null,
    timeframe: '7',
    converterAmount: 1,
    converterCurrency: 'USD',
    rates: { USD: 1, EUR: null, BTC: null },
    loading: false,
    chartLoading: false,
    error: null,
  },
  portfolio: {
    transactions: loadPortfolio(),
  },
  ui: {
    toasts: [],
    modal: null,
  },
};

let renderFn = null;

export function setRender(fn) {
  renderFn = fn;
}

export function render() {
  if (typeof renderFn === 'function') {
    renderFn();
  }
}



export function updateState(mutator, options = {}) {
  mutator(state);
  if (!options.silent) {
    render();
  }
}

export function savePortfolio() {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state.portfolio.transactions));
}

export function setPortfolioFromStorage(transactions) {
  state.portfolio.transactions = Array.isArray(transactions) ? transactions : [];
  render();
}

export { PORTFOLIO_KEY };
