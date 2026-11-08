const BASE = 'https://api.coingecko.com/api/v3';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Сетевой сбой. Проверьте подключение к интернету.', {
      status: 0,
      code: 'NETWORK',
    });
  }

  if (response.status === 429) {
    throw new ApiError(
      'Превышен лимит запросов к API (429 Too Many Requests). Подождите немного и повторите.',
      { status: 429, code: 'RATE_LIMIT' }
    );
  }

  if (!response.ok) {
    throw new ApiError(`Ошибка API: HTTP ${response.status}`, {
      status: response.status,
      code: 'HTTP',
    });
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('Некорректный ответ API.', { status: response.status, code: 'PARSE' });
  }
}


export function fetchTopCoins(signal) {
  const q = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '100',
    page: '1',
    sparkline: 'false',
    price_change_percentage: '24h',
  });
  return request(`/coins/markets?${q}`, { signal });
}


export function fetchMarketChart(coinId, days, signal) {
  const q = new URLSearchParams({
    vs_currency: 'usd',
    days: String(days),
  });
  return request(`/coins/${encodeURIComponent(coinId)}/market_chart?${q}`, { signal });
}


export function fetchSimplePrices(coinId, signal) {
  const q = new URLSearchParams({
    ids: `${coinId},bitcoin`,
    vs_currencies: 'usd,eur,btc',
  });
  return request(`/simple/price?${q}`, { signal });
}
