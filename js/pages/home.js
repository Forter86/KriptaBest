import { state, updateState } from '../state.js';
import { navigate } from '../router.js';
import {
  el,
  clearChildren,
  setText,
  formatPrice,
  formatNumber,
  formatPercent,
  debounce,
  parseNumberInput,
} from '../utils.js';

const SORT_COLUMNS = [
  { key: 'market_cap_rank', label: 'Ранг' },
  { key: 'name', label: 'Название' },
  { key: 'current_price', label: 'Цена' },
  { key: 'price_change_percentage_24h', label: '24ч' },
  { key: 'market_cap', label: 'Капитализация' },
];

let rootEl = null;
let searchInput = null;
let minInput = null;
let maxInput = null;
let tbody = null;
let emptyEl = null;
let countEl = null;

const applySearchDebounced = debounce((value) => {
  updateState((s) => {
    s.filters.search = value;
  });
}, 300);

function getFilteredCoins() {
  const { coins } = state.market;
  const { search, priceMin, priceMax, sortBy, sortDir } = state.filters;

  const q = search.trim().toLowerCase();
  const min = parseNumberInput(priceMin);
  const max = parseNumberInput(priceMax);

  let list = coins.filter((c) => {
    if (q) {
      const name = (c.name || '').toLowerCase();
      const symbol = (c.symbol || '').toLowerCase();
      if (!name.includes(q) && !symbol.includes(q)) return false;
    }
    const price = c.current_price;
    if (min != null && (price == null || price < min)) return false;
    if (max != null && (price == null || price > max)) return false;
    return true;
  });

  const dir = sortDir === 'desc' ? -1 : 1;
  list = [...list].sort((a, b) => {
    let av = a[sortBy];
    let bv = b[sortBy];
    if (sortBy === 'name') {
      av = (av || '').toLowerCase();
      bv = (bv || '').toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * dir;
  });

  return list;
}

function sortIndicator(key) {
  if (state.filters.sortBy !== key) return '';
  return state.filters.sortDir === 'asc' ? '▲' : '▼';
}

function toggleSort(key) {
  updateState((s) => {
    if (s.filters.sortBy === key) {
      s.filters.sortDir = s.filters.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      s.filters.sortBy = key;
      s.filters.sortDir = key === 'name' ? 'asc' : 'desc';
      if (key === 'market_cap_rank') s.filters.sortDir = 'asc';
    }
  });
}

function buildFilters(container) {
  const grid = el('div', {
    className: 'grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4',
  });

  const searchWrap = el('div');
  searchWrap.appendChild(el('label', { className: 'label', text: 'Поиск по названию' }));
  searchInput = el('input', {
    className: 'input',
    type: 'search',
    attrs: {
      placeholder: 'Bitcoin, ETH…',
      value: state.filters.search,
      autocomplete: 'off',
    },
    events: {
      input: (e) => {
        const value = e.target.value;
        applySearchDebounced(value);
      },
    },
  });
  searchWrap.appendChild(searchInput);

  const minWrap = el('div');
  minWrap.appendChild(el('label', { className: 'label', text: 'Цена от (USD)' }));
  minInput = el('input', {
    className: 'input',
    type: 'number',
    attrs: {
      placeholder: '0',
      min: '0',
      step: 'any',
      value: state.filters.priceMin,
    },
    events: {
      input: (e) => {
        updateState((s) => {
          s.filters.priceMin = e.target.value;
        });
      },
    },
  });
  minWrap.appendChild(minInput);

  const maxWrap = el('div');
  maxWrap.appendChild(el('label', { className: 'label', text: 'Цена до (USD)' }));
  maxInput = el('input', {
    className: 'input',
    type: 'number',
    attrs: {
      placeholder: '100000',
      min: '0',
      step: 'any',
      value: state.filters.priceMax,
    },
    events: {
      input: (e) => {
        updateState((s) => {
          s.filters.priceMax = e.target.value;
        });
      },
    },
  });
  maxWrap.appendChild(maxInput);

  grid.append(searchWrap, minWrap, maxWrap);
  container.appendChild(grid);
}

function buildTableShell(container) {
  const headRow = el('div', {
    className: 'flex items-center justify-between gap-3 mb-3',
  });
  headRow.appendChild(
    el('h1', { className: 'text-xl font-semibold text-brand-800 m-0', text: 'Топ-100 криптовалют' })
  );
  countEl = el('span', { className: 'text-sm text-slateish-500' });
  headRow.appendChild(countEl);
  container.appendChild(headRow);

  buildFilters(container);

  const wrap = el('div', { className: 'table-wrap', attrs: { id: 'coins-table-wrap' } });
  const table = el('table', { className: 'coins-table' });
  const thead = el('thead');
  const tr = el('tr');

  SORT_COLUMNS.forEach((col) => {
    const th = el('th', {
      events: { click: () => toggleSort(col.key) },
    });
    const label = el('span');
    setText(label, col.label);
    const ind = el('span', { className: 'sort-indicator' });
    setText(ind, sortIndicator(col.key));
    ind.dataset.sortKey = col.key;
    th.append(label, ind);
    tr.appendChild(th);
  });

  thead.appendChild(tr);
  tbody = el('tbody', { attrs: { id: 'coins-tbody' } });
  table.append(thead, tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);

  emptyEl = el('p', {
    className: 'text-center text-slateish-500 text-sm mt-4 hidden',
    text: 'Ничего не найдено по заданным фильтрам.',
  });
  container.appendChild(emptyEl);
}

function syncEmptyMessage(listLength) {
  if (!emptyEl) return;
  const noData = state.market.coins.length === 0;
  setText(
    emptyEl,
    noData
      ? 'Нет данных рынка. Проверьте соединение или подождите обновления.'
      : 'Ничего не найдено по заданным фильтрам.'
  );
  emptyEl.classList.toggle('hidden', listLength > 0);
}

function renderRow(coin) {
  const tr = el('tr', {
    dataset: { id: coin.id },
    events: {
      click: () => navigate('coin', { id: coin.id }),
    },
  });


  if (coin.market_cap_rank != null) {
    tr.appendChild(el('td', { text: String(coin.market_cap_rank) }));
  } else {
    tr.appendChild(el('td', { text: '—' }));
  }


  const nameTd = el('td');
  const nameWrap = el('div', { className: 'flex items-center gap-2' });
  if (coin.image) {
    const img = el('img', {
      className: 'coin-thumb',
      attrs: { src: coin.image, alt: '', width: '24', height: '24', loading: 'lazy' },
    });
    nameWrap.appendChild(img);
  }
  const nameText = el('div');
  const name = el('div', { className: 'font-medium text-slateish-900' });
  setText(name, coin.name || '—');
  const symbol = el('div', { className: 'text-xs text-slateish-500 uppercase' });
  setText(symbol, coin.symbol || '');
  nameText.append(name, symbol);
  nameWrap.appendChild(nameText);
  nameTd.appendChild(nameWrap);
  tr.appendChild(nameTd);


  if (coin.current_price != null) {
    tr.appendChild(el('td', { text: formatPrice(coin.current_price) }));
  } else {
    tr.appendChild(el('td', { text: '—' }));
  }


  const changeTd = el('td');
  const pct = formatPercent(coin.price_change_percentage_24h);
  if (pct == null) {
    setText(changeTd, '—');
  } else {
    changeTd.className =
      coin.price_change_percentage_24h >= 0 ? 'change-up' : 'change-down';
    setText(changeTd, pct);
  }
  tr.appendChild(changeTd);


  if (coin.market_cap != null) {
    tr.appendChild(el('td', { text: formatNumber(coin.market_cap) }));
  } else {
    tr.appendChild(el('td', { text: '—' }));
  }

  return tr;
}

function updateSortIndicators() {
  if (!rootEl) return;
  rootEl.querySelectorAll('.sort-indicator').forEach((node) => {
    setText(node, sortIndicator(node.dataset.sortKey));
  });
}

function updateTableBody({ flash = false } = {}) {
  if (!tbody) return;

  const wrap = document.getElementById('coins-table-wrap');
  const scrollTop = wrap ? wrap.scrollTop : 0;

  const list = getFilteredCoins();
  clearChildren(tbody);

  list.forEach((coin) => {
    const row = renderRow(coin);
    if (flash) row.classList.add('flash');
    tbody.appendChild(row);
  });

  syncEmptyMessage(list.length);
  if (countEl) {
    setText(countEl, `Показано: ${list.length} из ${state.market.coins.length}`);
  }

  updateSortIndicators();

  if (wrap) {
    wrap.scrollTop = scrollTop;
  }

  if (flash) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        tbody.querySelectorAll('tr.flash').forEach((r) => r.classList.remove('flash'));
      }, 400);
    });
  }
}

export function mountHome(container) {
  rootEl = el('div', { className: 'fade-in', attrs: { id: 'page-home' } });

  if (state.market.loading && state.market.coins.length === 0) {
    const loading = el('div', { className: 'flex flex-col items-center gap-3 py-16' });
    loading.appendChild(el('div', { className: 'spinner' }));
    loading.appendChild(el('p', { className: 'text-sm text-slateish-500 m-0', text: 'Загрузка рынка…' }));
    rootEl.appendChild(loading);
    container.appendChild(rootEl);
    return;
  }

  buildTableShell(rootEl);
  container.appendChild(rootEl);
  updateTableBody();
}

export function updateHome({ dataChanged = false } = {}) {
  if (!document.getElementById('page-home')) return;


  if (searchInput && document.activeElement !== searchInput) {
    searchInput.value = state.filters.search;
  }
  if (minInput && document.activeElement !== minInput) {
    minInput.value = state.filters.priceMin;
  }
  if (maxInput && document.activeElement !== maxInput) {
    maxInput.value = state.filters.priceMax;
  }

  if (!tbody) {

    const main = document.getElementById('main');
    if (main) {
      clearChildren(main);
      mountHome(main);
    }
    return;
  }

  updateTableBody({ flash: dataChanged });
}

export function unmountHome() {
  rootEl = null;
  searchInput = null;
  minInput = null;
  maxInput = null;
  tbody = null;
  emptyEl = null;
  countEl = null;
}
