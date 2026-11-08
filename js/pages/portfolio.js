import { state, updateState, savePortfolio } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../ui.js';
import {
  el,
  clearChildren,
  setText,
  formatPrice,
  formatNumber,
  uid,
  parseNumberInput,
} from '../utils.js';

function calcHoldings() {
  const map = new Map();

  state.portfolio.transactions.forEach((tx) => {
    const prev = map.get(tx.coinId) || {
      coinId: tx.coinId,
      coinName: tx.coinName,
      symbol: tx.symbol,
      amount: 0,
      invested: 0,
    };
    prev.amount += Number(tx.amount) || 0;
    prev.invested += (Number(tx.amount) || 0) * (Number(tx.buyPrice) || 0);
    map.set(tx.coinId, prev);
  });

  const rows = [];
  let totalValue = 0;
  let totalInvested = 0;

  map.forEach((h) => {
    const market = state.market.coins.find((c) => c.id === h.coinId);
    const price = market?.current_price ?? null;
    const value = price != null ? h.amount * price : null;
    const pnl = value != null ? value - h.invested : null;
    const pnlPct =
      pnl != null && h.invested > 0 ? (pnl / h.invested) * 100 : null;

    if (value != null) totalValue += value;
    totalInvested += h.invested;

    rows.push({
      ...h,
      price,
      value,
      pnl,
      pnlPct,
      image: market?.image || null,
    });
  });

  const totalPnl = totalValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;

  return { rows, totalValue, totalInvested, totalPnl, totalPnlPct };
}

function addTransaction({ coinId, amount, buyPrice }) {
  const coin = state.market.coins.find((c) => c.id === coinId);
  if (!coin) {
    showToast('Выберите монету из списка', 'warning');
    return false;
  }
  if (!(amount > 0) || !(buyPrice >= 0)) {
    showToast('Проверьте количество и цену покупки', 'warning');
    return false;
  }

  const tx = {
    id: uid(),
    coinId: coin.id,
    coinName: coin.name,
    symbol: coin.symbol,
    amount,
    buyPrice,
    createdAt: Date.now(),
  };

  updateState((s) => {
    s.portfolio.transactions = [tx, ...s.portfolio.transactions];
  }, { silent: true });
  savePortfolio();
  updateState(() => {});
  showToast('Транзакция добавлена', 'success');
  return true;
}

function removeTransaction(id) {
  updateState((s) => {
    s.portfolio.transactions = s.portfolio.transactions.filter((t) => t.id !== id);
  }, { silent: true });
  savePortfolio();
  updateState(() => {});
  showToast('Транзакция удалена', 'info');
}

function buildSummary(container, stats) {
  const grid = el('div', {
    className: 'grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4',
  });

  const cards = [
    { label: 'Стоимость портфеля', value: formatPrice(stats.totalValue) },
    { label: 'Вложено', value: formatPrice(stats.totalInvested) },
    {
      label: 'PnL',
      value:
        stats.totalPnlPct == null
          ? formatPrice(stats.totalPnl)
          : `${formatPrice(stats.totalPnl)} (${stats.totalPnlPct >= 0 ? '+' : ''}${stats.totalPnlPct.toFixed(2)}%)`,
      cls: stats.totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative',
    },
  ];

  cards.forEach((c) => {
    const card = el('div', { className: 'card' });
    card.appendChild(el('div', { className: 'text-xs text-slateish-500 mb-1', text: c.label }));
    const val = el('div', { className: `text-lg font-semibold ${c.cls || 'text-slateish-900'}` });
    setText(val, c.value);
    card.appendChild(val);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function buildForm(container) {
  const card = el('div', { className: 'card mb-4' });
  card.appendChild(
    el('h2', { className: 'text-base font-semibold text-brand-800 m-0 mb-3', text: 'Добавить транзакцию' })
  );

  const form = el('form', {
    className: 'grid grid-cols-1 sm:grid-cols-4 gap-3 items-end',
    events: {
      submit: (e) => {
        e.preventDefault();
        const coinId = form.elements.coinId.value;
        const amount = parseNumberInput(form.elements.amount.value);
        const buyPrice = parseNumberInput(form.elements.buyPrice.value);
        const ok = addTransaction({ coinId, amount, buyPrice });
        if (ok) {
          form.reset();

        }
      },
    },
  });

  const coinWrap = el('div');
  coinWrap.appendChild(el('label', { className: 'label', text: 'Монета' }));
  const select = el('select', {
    className: 'select',
    attrs: { name: 'coinId', required: true },
  });
  select.appendChild(el('option', { attrs: { value: '' }, text: 'Выберите…' }));
  state.market.coins.forEach((c) => {
    const opt = el('option', {
      attrs: { value: c.id },
      text: `${c.name} (${(c.symbol || '').toUpperCase()})`,
    });
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    const coin = state.market.coins.find((c) => c.id === select.value);
    if (coin?.current_price != null && form.elements.buyPrice) {
      form.elements.buyPrice.value = String(coin.current_price);
    }
  });
  coinWrap.appendChild(select);

  const amountWrap = el('div');
  amountWrap.appendChild(el('label', { className: 'label', text: 'Количество' }));
  amountWrap.appendChild(
    el('input', {
      className: 'input',
      type: 'number',
      attrs: { name: 'amount', min: '0', step: 'any', required: true, placeholder: '0.01' },
    })
  );

  const priceWrap = el('div');
  priceWrap.appendChild(el('label', { className: 'label', text: 'Цена покупки (USD)' }));
  priceWrap.appendChild(
    el('input', {
      className: 'input',
      type: 'number',
      attrs: { name: 'buyPrice', min: '0', step: 'any', required: true, placeholder: '0' },
    })
  );

  const btnWrap = el('div');
  btnWrap.appendChild(
    el('button', {
      className: 'btn btn-primary w-full',
      type: 'submit',
      text: 'Добавить',
    })
  );

  form.append(coinWrap, amountWrap, priceWrap, btnWrap);
  card.appendChild(form);

  if (state.market.coins.length === 0) {
    card.appendChild(
      el('p', {
        className: 'text-sm text-slateish-500 mt-3 mb-0',
        text: 'Список монет ещё загружается — дождитесь обновления рынка.',
      })
    );
  }

  container.appendChild(card);
}

function buildHoldings(container, rows) {
  const card = el('div', { className: 'card mb-4' });
  card.appendChild(
    el('h2', { className: 'text-base font-semibold text-brand-800 m-0 mb-3', text: 'Холдинги' })
  );

  if (rows.length === 0) {
    card.appendChild(
      el('p', {
        className: 'text-sm text-slateish-500 m-0',
        text: 'Портфель пуст. Добавьте первую транзакцию.',
      })
    );
    container.appendChild(card);
    return;
  }

  const wrap = el('div', { className: 'overflow-auto' });
  const table = el('table', { className: 'coins-table' });
  const thead = el('thead');
  const headTr = el('tr');
  ['Монета', 'Кол-во', 'Ср. цена', 'Текущая', 'Стоимость', 'PnL'].forEach((h) => {
    headTr.appendChild(el('th', { text: h, attrs: { style: 'cursor:default' } }));
  });
  thead.appendChild(headTr);

  const tbody = el('tbody');
  rows.forEach((r) => {
    const tr = el('tr', {
      events: {
        click: () => navigate('coin', { id: r.coinId }),
      },
    });

    const nameTd = el('td');
    const nameWrap = el('div', { className: 'flex items-center gap-2' });
    if (r.image) {
      nameWrap.appendChild(
        el('img', {
          className: 'coin-thumb',
          attrs: { src: r.image, alt: '', width: '24', height: '24' },
        })
      );
    }
    const name = el('span', { className: 'font-medium' });
    setText(name, r.coinName);
    nameWrap.appendChild(name);
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    tr.appendChild(el('td', { text: formatNumber(r.amount) }));
    const avg = r.amount > 0 ? r.invested / r.amount : null;
    tr.appendChild(el('td', { text: formatPrice(avg) }));
    tr.appendChild(el('td', { text: formatPrice(r.price) }));
    tr.appendChild(el('td', { text: formatPrice(r.value) }));

    const pnlTd = el('td');
    if (r.pnl == null) {
      setText(pnlTd, '—');
    } else {
      pnlTd.className = r.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      const pct =
        r.pnlPct == null
          ? ''
          : ` (${r.pnlPct >= 0 ? '+' : ''}${r.pnlPct.toFixed(2)}%)`;
      setText(pnlTd, `${formatPrice(r.pnl)}${pct}`);
    }
    tr.appendChild(pnlTd);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  container.appendChild(card);
}

function buildHistory(container) {
  const card = el('div', { className: 'card' });
  card.appendChild(
    el('h2', { className: 'text-base font-semibold text-brand-800 m-0 mb-3', text: 'История транзакций' })
  );

  const txs = state.portfolio.transactions;
  if (txs.length === 0) {
    card.appendChild(
      el('p', { className: 'text-sm text-slateish-500 m-0', text: 'Транзакций пока нет.' })
    );
    container.appendChild(card);
    return;
  }

  const list = el('div', { className: 'flex flex-col gap-2' });
  txs.forEach((tx) => {
    const row = el('div', {
      className: 'flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slateish-100',
    });
    const left = el('div');
    const title = el('div', { className: 'font-medium text-sm' });
    setText(title, `${tx.coinName} · ${formatNumber(tx.amount)} @ ${formatPrice(tx.buyPrice)}`);
    const date = el('div', { className: 'text-xs text-slateish-500' });
    setText(date, new Date(tx.createdAt).toLocaleString('ru-RU'));
    left.append(title, date);

    const del = el('button', {
      className: 'btn btn-danger',
      type: 'button',
      text: 'Удалить',
      events: {
        click: (e) => {
          e.stopPropagation();
          removeTransaction(tx.id);
        },
      },
    });
    row.append(left, del);
    list.appendChild(row);
  });

  card.appendChild(list);
  container.appendChild(card);
}

export function mountPortfolio(container) {
  const root = el('div', { className: 'fade-in', attrs: { id: 'page-portfolio' } });
  root.appendChild(
    el('h1', { className: 'text-xl font-semibold text-brand-800 m-0 mb-4', text: 'Инвестиционный портфель' })
  );

  const stats = calcHoldings();
  buildSummary(root, stats);
  buildForm(root);
  buildHoldings(root, stats.rows);
  buildHistory(root);

  container.appendChild(root);
}

export function updatePortfolio() {
  const page = document.getElementById('page-portfolio');
  if (!page) return;
  const main = document.getElementById('main');
  clearChildren(main);
  mountPortfolio(main);
}

export function unmountPortfolio() {

}
