export function debounce(fn, delay = 300) {
  let timer = null;
  return function debounced(...args) {
    const context = this;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(context, args);
    }, delay);
  };
}

export function formatPrice(value, currency = 'USD') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const abs = Math.abs(n);
  const digits = abs === 0 || abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return `$${n.toFixed(digits)}`;
  }
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('ru-RU', {
    notation: Number(value) >= 1e9 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatDateTime(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
}


export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? '' : String(text);
}


export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  const { className, dataset, attrs, events, text, ...rest } = props;

  if (className) node.className = className;
  if (text != null) node.textContent = String(text);

  if (dataset) {
    Object.entries(dataset).forEach(([k, v]) => {
      node.dataset[k] = String(v);
    });
  }

  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    });
  }

  Object.entries(rest).forEach(([k, v]) => {
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null) {
      node[k] = v;
    }
  });

  if (events) {
    Object.entries(events).forEach(([name, handler]) => {
      node.addEventListener(name, handler);
    });
  }

  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  });

  return node;
}

export function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseNumberInput(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
