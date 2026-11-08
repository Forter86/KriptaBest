const WIN_LABEL = 'IT-Бригада';
const LOSS_LABEL = 'Проигрыш';
const SPIN_MS = 4800;


let dismissedThisPage = false;
let scheduled = false;


function buildDeck() {
  const deck = [];

  for (let i = 0; i < 48; i += 1) {
    deck.push(i % 4 === 2 ? { type: 'win', label: WIN_LABEL } : { type: 'loss', label: LOSS_LABEL });
  }
  return deck;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mountPromoRoulette(root = document.body) {
  if (dismissedThisPage || scheduled) return null;
  if (document.getElementById('promo-roulette')) return null;

  scheduled = true;
  const delayMs = 7000 + Math.floor(Math.random() * 8001);
  const timerId = setTimeout(() => {
    if (dismissedThisPage) return;
    if (document.getElementById('promo-roulette')) return;
    createPromoRoulette(root);
  }, delayMs);

  return { cancel: () => clearTimeout(timerId) };
}

function createPromoRoulette(root = document.body) {
  const deck = buildDeck();

  let targetIndex = deck.findIndex((c, i) => c.type === 'win' && i >= 28 && i <= 36);
  if (targetIndex < 0) {
    targetIndex = deck.findIndex((c, i) => c.type === 'win' && i > 20);
  }

  const widget = createEl('aside', 'promo-roulette');
  widget.id = 'promo-roulette';
  widget.setAttribute('role', 'dialog');
  widget.setAttribute('aria-label', 'Рекламный розыгрыш');


  const header = createEl('div', 'promo-roulette__header');
  const title = createEl('h2', 'promo-roulette__title', 'Твой шанс получить крутую команду');
  const headerRight = createEl('div', 'promo-roulette__header-right');

  const badge = createEl('div', 'promo-roulette__badge promo-roulette__badge--hidden');
  badge.setAttribute('aria-hidden', 'true');
  const badgeDot = createEl('span', 'promo-roulette__badge-dot');
  const badgeText = createEl('span', null, 'Завершено');
  badge.append(badgeDot, badgeText);

  const closeBtn = createEl('button', 'promo-roulette__close promo-roulette__close--locked');
  closeBtn.type = 'button';
  closeBtn.disabled = true;
  closeBtn.setAttribute('aria-label', 'Закрыть рекламу');
  closeBtn.setAttribute('title', 'Дождитесь окончания прокрутки');
  closeBtn.textContent = '×';

  headerRight.append(badge, closeBtn);
  header.append(title, headerRight);


  const viewport = createEl('div', 'promo-roulette__viewport');
  const marker = createEl('div', 'promo-roulette__marker');
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = `
    <span class="promo-roulette__marker-tri promo-roulette__marker-tri--top"></span>
    <span class="promo-roulette__marker-line"></span>
    <span class="promo-roulette__marker-tri promo-roulette__marker-tri--bottom"></span>
  `;

  const track = createEl('div', 'promo-roulette__track');
  const cardNodes = deck.map((item, index) => {
    const card = createEl('div', `promo-roulette__card promo-roulette__card--${item.type}`);
    card.dataset.index = String(index);
    card.dataset.type = item.type;
    const label = createEl('div', 'promo-roulette__card-label', item.label);
    const dash = createEl('div', 'promo-roulette__card-dash');
    card.append(label, dash);
    track.appendChild(card);
    return card;
  });

  viewport.append(marker, track);

  widget.append(header, viewport);
  root.appendChild(widget);

  let rafId = null;
  let closed = false;
  let canClose = false;

  function dismiss() {
    if (closed || !canClose) return;
    closed = true;
    dismissedThisPage = true;
    if (rafId) cancelAnimationFrame(rafId);
    widget.classList.add('promo-roulette--leaving');
    setTimeout(() => widget.remove(), 220);
  }

  closeBtn.addEventListener('click', dismiss);

  function measure() {
    const first = cardNodes[0];
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap) || 12;
    const cardWidth = first.getBoundingClientRect().width;
    const stride = cardWidth + gap;
    const viewportWidth = viewport.getBoundingClientRect().width;
    return { cardWidth, gap, stride, viewportWidth };
  }

  
  function offsetForIndex(index, metrics) {
    const cardCenter = index * metrics.stride + metrics.cardWidth / 2;
    return metrics.viewportWidth / 2 - cardCenter;
  }

  function setTransform(x) {
    track.style.transform = `translate3d(${x}px, -50%, 0)`;
  }

  function finish(targetCard) {
    targetCard.classList.add('promo-roulette__card--won');
    badge.classList.remove('promo-roulette__badge--hidden');
    badge.setAttribute('aria-hidden', 'false');
    widget.classList.add('promo-roulette--done');
    canClose = true;
    closeBtn.disabled = false;
    closeBtn.classList.remove('promo-roulette__close--locked');
    closeBtn.removeAttribute('title');
  }

  function startSpin() {
    const metrics = measure();

    const endX = offsetForIndex(targetIndex, metrics);
    const travelCards = 18;
    const startX = endX - travelCards * metrics.stride;


    setTransform(startX);

    const t0 = performance.now();

    function frame(now) {
      if (closed) return;
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / SPIN_MS);
      const eased = easeOutCubic(t);
      const x = startX + (endX - startX) * eased;
      setTransform(x);

      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {

        const m = measure();
        const precise = offsetForIndex(targetIndex, m);
        setTransform(precise);
        finish(cardNodes[targetIndex]);
      }
    }

    rafId = requestAnimationFrame(frame);
  }


  requestAnimationFrame(() => {
    requestAnimationFrame(startSpin);
  });

  return { dismiss, widget };
}
