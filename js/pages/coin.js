import { state, updateState } from '../state.js';
import { goBack } from '../router.js';
import { fetchMarketChart, fetchSimplePrices } from '../api.js';
import { handleApiError, showToast } from '../ui.js';
import {
  el,
  clearChildren,
  setText,
  formatPrice,
  formatPercent,
} from '../utils.js';

const TIMEFRAMES = [
  { id: '1', label: '1 день', days: 1 },
  { id: '7', label: '7 дней', days: 7 },
  { id: '30', label: '30 дней', days: 30 },
  { id: '365', label: '1 год', days: 365 },
];

let chartInstance = null;
let chartCanvas = null;
let abortCtrl = null;

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function getCoinFromMarket(id) {
  return state.market.coins.find((c) => c.id === id) || null;
}

function buildRates(coinId, priceData) {
  const coin = priceData?.[coinId] || {};
  const btc = priceData?.bitcoin || {};
  const usd = coin.usd ?? null;
  const eur = coin.eur ?? null;
  let btcRate = coin.btc ?? null;
  if (btcRate == null && usd != null && btc.usd) {
    btcRate = usd / btc.usd;
  }
  return { USD: usd, EUR: eur, BTC: btcRate };
}


function convertAmount(coinAmount, currency, rates) {
  if (coinAmount == null || Number.isNaN(coinAmount)) return null;
  const rate = rates?.[currency];
  if (rate == null || Number.isNaN(Number(rate))) return null;
  return coinAmount * Number(rate);
}

function formatConverted(value, currency) {
  if (value == null) return '—';
  if (currency === 'BTC') {
    return `${value.toFixed(8)} BTC`;
  }
  return formatPrice(value, currency);
}

function renderChart(prices) {
  if (!chartCanvas || typeof Chart === 'undefined') return;
  destroyChart();

  const labels = prices.map((p) => {
    const d = new Date(p[0]);
    return d.toLocaleString('ru-RU', {
      month: 'short',
      day: 'numeric',
      hour: state.coin.timeframe === '1' ? '2-digit' : undefined,
      minute: state.coin.timeframe === '1' ? '2-digit' : undefined,
    });
  });
  const data = prices.map((p) => p[1]);

  chartInstance = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Цена (USD)',
          data,
          borderColor: '#3a5d80',
          backgroundColor: 'rgba(74, 117, 156, 0.12)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatPrice(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, color: '#737c8c' },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: '#737c8c',
            callback: (v) => formatPrice(v),
          },
          grid: { color: '#eef0f3' },
        },
      },
    },
  });
}

export async function loadCoinData(coinId, { forceChart = true } = {}) {
  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();
  const { signal } = abortCtrl;

  updateState((s) => {
    s.coin.id = coinId;
    s.coin.loading = true;
    s.coin.chartLoading = forceChart;
    s.coin.error = null;
    s.coin.meta = getCoinFromMarket(coinId);
  });

  try {
    const [chart, prices] = await Promise.all([
      forceChart
        ? fetchMarketChart(coinId, Number(state.coin.timeframe), signal)
        : Promise.resolve(null),
      fetchSimplePrices(coinId, signal),
    ]);


    if (signal.aborted || state.coin.id !== coinId || state.route.params.id !== coinId) {
      return;
    }

    const rates = buildRates(coinId, prices);
    const meta = getCoinFromMarket(coinId) || {
      id: coinId,
      name: coinId,
      symbol: '',
      current_price: rates.USD,
      image: null,
      price_change_percentage_24h: null,
    };

    updateState((s) => {
      if (s.coin.id !== coinId) return;
      s.coin.meta = {
        ...meta,
        current_price: rates.USD ?? meta.current_price,
      };
      s.coin.rates = rates;
      if (chart?.prices) {
        s.coin.chart = chart.prices;
      }
      s.coin.loading = false;
      s.coin.chartLoading = false;
    });
  } catch (err) {
    if (err?.name === 'AbortError') return;
    if (state.coin.id !== coinId) return;
    updateState((s) => {
      if (s.coin.id !== coinId) return;
      s.coin.loading = false;
      s.coin.chartLoading = false;
      s.coin.error = err.message;
    });
    handleApiError(err, { asModal: err?.code === 'RATE_LIMIT' });
  }
}

export async function changeTimeframe(tf) {
  if (state.coin.timeframe === tf) return;
  updateState((s) => {
    s.coin.timeframe = tf;
    s.coin.chartLoading = true;
  }, { silent: true });


  document.querySelectorAll('.timeframe-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tf === tf);
  });

  const chartBox = document.getElementById('chart-status');
  if (chartBox) {
    clearChildren(chartBox);
    const row = el('div', { className: 'flex items-center gap-2 text-sm text-slateish-500 py-8 justify-center' });
    row.appendChild(el('div', { className: 'spinner' }));
    row.appendChild(el('span', { text: 'Загрузка графика…' }));
    chartBox.appendChild(row);
  }

  try {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const coinId = state.coin.id;
    const chart = await fetchMarketChart(
      coinId,
      Number(tf),
      abortCtrl.signal
    );
    if (abortCtrl.signal.aborted || state.coin.id !== coinId) return;
    updateState((s) => {
      if (s.coin.id !== coinId) return;
      s.coin.chart = chart.prices || [];
      s.coin.chartLoading = false;
    });
  } catch (err) {
    if (err?.name === 'AbortError') return;
    updateState((s) => {
      s.coin.chartLoading = false;
    });
    handleApiError(err);
    showToast('Не удалось загрузить график', 'warning');
  }
}

function buildHeader(container, meta) {
  const top = el('div', { className: 'flex flex-wrap items-start justify-between gap-3 mb-4' });

  const left = el('div', { className: 'flex items-center gap-3' });
  left.appendChild(
    el('button', {
      className: 'btn btn-ghost',
      type: 'button',
      text: '← Назад',
      events: { click: () => goBack() },
    })
  );

  const titleWrap = el('div', { className: 'flex items-center gap-3' });
  if (meta?.image) {
    titleWrap.appendChild(
      el('img', {
        className: 'w-10 h-10 rounded-full',
        attrs: { src: meta.image, alt: '', width: '40', height: '40' },
      })
    );
  }
  const titles = el('div');
  const h1 = el('h1', { className: 'text-xl font-semibold text-brand-800 m-0' });
  setText(h1, meta?.name || state.coin.id || 'Монета');
  const sub = el('div', { className: 'text-sm text-slateish-500 uppercase' });
  setText(sub, meta?.symbol || '');
  titles.append(h1, sub);
  titleWrap.appendChild(titles);
  left.appendChild(titleWrap);

  const right = el('div', { className: 'text-right' });
  const price = el('div', { className: 'text-2xl font-semibold text-slateish-900' });
  setText(price, formatPrice(meta?.current_price));
  const change = el('div', { className: 'text-sm' });
  const pct = formatPercent(meta?.price_change_percentage_24h);
  if (pct != null) {
    change.className =
      meta.price_change_percentage_24h >= 0
        ? 'text-sm change-up'
        : 'text-sm change-down';
    setText(change, `${pct} за 24ч`);
  } else {
    setText(change, '');
  }
  right.append(price, change);

  top.append(left, right);
  container.appendChild(top);

  const navBtns = el('div', { className: 'flex gap-2 mb-4' });
  navBtns.append(
    el('button', {
      className: 'btn btn-secondary',
      type: 'button',
      text: '◀ Назад',
      events: { click: () => goBack() },
    }),
    el('button', {
      className: 'btn btn-secondary',
      type: 'button',
      text: 'Вперёд ▶',
      events: { click: () => window.history.forward() },
    })
  );
  container.appendChild(navBtns);
}

function buildTimeframes(container) {
  const row = el('div', { className: 'flex flex-wrap gap-2 mb-3' });
  TIMEFRAMES.forEach((tf) => {
    const btn = el('button', {
      className: `btn btn-secondary timeframe-btn${state.coin.timeframe === tf.id ? ' active' : ''}`,
      type: 'button',
      text: tf.label,
      dataset: { tf: tf.id },
      events: { click: () => changeTimeframe(tf.id) },
    });
    row.appendChild(btn);
  });
  container.appendChild(row);
}

function buildConverter(container, meta) {
  const card = el('div', { className: 'card' });
  card.appendChild(
    el('h2', { className: 'text-base font-semibold text-brand-800 m-0 mb-3', text: 'Быстрый конвертер' })
  );

  const grid = el('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-3 items-end' });

  const amountWrap = el('div');
  amountWrap.appendChild(el('label', { className: 'label', text: 'Количество монет' }));
  const amountInput = el('input', {
    className: 'input',
    type: 'number',
    attrs: {
      min: '0',
      step: 'any',
      value: String(state.coin.converterAmount),
    },
    events: {
      input: (e) => {
        const v = Number(e.target.value);
        updateState((s) => {
          s.coin.converterAmount = Number.isFinite(v) ? v : 0;
        }, { silent: true });
        refreshConverterResult();
      },
    },
  });
  amountWrap.appendChild(amountInput);

  const currWrap = el('div');
  currWrap.appendChild(el('label', { className: 'label', text: 'Валюта' }));
  const select = el('select', {
    className: 'select',
    events: {
      change: (e) => {
        updateState((s) => {
          s.coin.converterCurrency = e.target.value;
        }, { silent: true });
        refreshConverterResult();
      },
    },
  });
  ['USD', 'EUR', 'BTC'].forEach((c) => {
    const opt = el('option', {
      attrs: { value: c },
      text: c,
    });
    if (c === state.coin.converterCurrency) opt.selected = true;
    select.appendChild(opt);
  });
  currWrap.appendChild(select);

  const resultWrap = el('div');
  resultWrap.appendChild(el('label', { className: 'label', text: 'Итого' }));
  const result = el('div', {
    className: 'input bg-slateish-50 font-semibold',
    attrs: { id: 'converter-result' },
  });
  const converted = convertAmount(
    state.coin.converterAmount || 0,
    state.coin.converterCurrency,
    state.coin.rates
  );
  setText(result, formatConverted(converted, state.coin.converterCurrency));
  resultWrap.appendChild(result);

  grid.append(amountWrap, currWrap, resultWrap);
  card.appendChild(grid);

  const hint = el('p', {
    className: 'text-xs text-slateish-500 mt-3 mb-0',
    text: 'Курс берётся из актуальных данных CoinGecko (USD / EUR / BTC).',
  });
  card.appendChild(hint);
  container.appendChild(card);
}

function refreshConverterResult() {
  const result = document.getElementById('converter-result');
  if (!result) return;
  const converted = convertAmount(
    state.coin.converterAmount || 0,
    state.coin.converterCurrency,
    state.coin.rates
  );
  setText(result, formatConverted(converted, state.coin.converterCurrency));
}

export function mountCoin(container) {
  const root = el('div', { className: 'fade-in', attrs: { id: 'page-coin' } });
  const meta = state.coin.meta || getCoinFromMarket(state.coin.id);

  if (state.coin.loading && !meta) {
    const loading = el('div', { className: 'flex flex-col items-center gap-3 py-16' });
    loading.appendChild(el('div', { className: 'spinner' }));
    loading.appendChild(el('p', { className: 'text-sm text-slateish-500 m-0', text: 'Загрузка монеты…' }));
    root.appendChild(loading);
    container.appendChild(root);
    return;
  }

  buildHeader(root, meta);

  const chartCard = el('div', { className: 'card mb-4' });
  chartCard.appendChild(
    el('h2', { className: 'text-base font-semibold text-brand-800 m-0 mb-3', text: 'История цены' })
  );
  buildTimeframes(chartCard);

  const chartStatus = el('div', { attrs: { id: 'chart-status' } });
  const chartWrap = el('div', {
    className: 'relative',
    attrs: { style: 'height: 320px' },
  });
  chartCanvas = el('canvas', { attrs: { id: 'price-chart' } });
  chartWrap.appendChild(chartCanvas);

  if (state.coin.chartLoading) {
    const row = el('div', { className: 'flex items-center gap-2 text-sm text-slateish-500 py-8 justify-center' });
    row.appendChild(el('div', { className: 'spinner' }));
    row.appendChild(el('span', { text: 'Загрузка графика…' }));
    chartStatus.appendChild(row);
    chartWrap.classList.add('hidden');
  } else if (state.coin.chart?.length) {

  } else {
    setText(chartStatus, 'Нет данных для графика.');
    chartWrap.classList.add('hidden');
  }

  chartCard.append(chartStatus, chartWrap);
  root.appendChild(chartCard);

  buildConverter(root, meta);
  container.appendChild(root);

  if (!state.coin.chartLoading && state.coin.chart?.length) {
    clearChildren(chartStatus);
    chartWrap.classList.remove('hidden');
    renderChart(state.coin.chart);
  }
}

export function updateCoin() {
  const page = document.getElementById('page-coin');
  if (!page) return;

  const titleEl = page.querySelector('h1');
  const titleText = titleEl?.textContent || '';
  const expectedName = state.coin.meta?.name || state.coin.id;
  const titleStale =
    !!expectedName &&
    (titleText === 'Монета' || (state.coin.meta?.name && titleText !== state.coin.meta.name));


  if (
    titleStale ||
    (page.querySelector('.spinner') && (state.coin.meta || !state.coin.loading))
  ) {
    const main = document.getElementById('main');
    destroyChart();
    clearChildren(main);
    mountCoin(main);
    return;
  }

  if (state.coin.chart && chartCanvas && !state.coin.chartLoading) {
    const chartStatus = document.getElementById('chart-status');
    const chartWrap = chartCanvas.parentElement;
    if (chartStatus) clearChildren(chartStatus);
    if (chartWrap) chartWrap.classList.remove('hidden');
    renderChart(state.coin.chart);
  }

  refreshConverterResult();
}

export function unmountCoin() {
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  destroyChart();
  chartCanvas = null;
}
