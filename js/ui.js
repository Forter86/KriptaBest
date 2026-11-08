import { state, updateState } from './state.js';
import { el, clearChildren, setText } from './utils.js';

let toastSeq = 0;

export function showToast(message, type = 'info', timeout = 4500) {
  const id = ++toastSeq;
  updateState((s) => {
    s.ui.toasts = [...s.ui.toasts, { id, message, type }];
  }, { silent: true });
  renderToasts();
  if (timeout > 0) {
    setTimeout(() => dismissToast(id), timeout);
  }
}

export function dismissToast(id) {
  updateState((s) => {
    s.ui.toasts = s.ui.toasts.filter((t) => t.id !== id);
  }, { silent: true });
  renderToasts();
}

export function showErrorModal(title, message) {
  updateState((s) => {
    s.ui.modal = { title, message };
  });
}

export function closeModal() {
  updateState((s) => {
    s.ui.modal = null;
  });
}

export function renderToasts() {
  const root = document.getElementById('toast-root');
  if (!root) return;
  clearChildren(root);

  state.ui.toasts.forEach((t) => {
    const toast = el('div', {
      className: `toast toast-${t.type}`,
      role: 'status',
    });
    const row = el('div', { className: 'flex items-start justify-between gap-3' });
    const msg = el('p', { className: 'text-sm text-slateish-800 m-0' });
    setText(msg, t.message);
    const btn = el('button', {
      className: 'text-slateish-400 hover:text-slateish-700 text-lg leading-none',
      type: 'button',
      attrs: { 'aria-label': 'Закрыть' },
      events: { click: () => dismissToast(t.id) },
      text: '×',
    });
    row.append(msg, btn);
    toast.appendChild(row);
    root.appendChild(toast);
  });
}

export function renderModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  clearChildren(root);

  const modal = state.ui.modal;
  if (!modal) return;

  const backdrop = el('div', {
    className: 'modal-backdrop',
    events: {
      click: (e) => {
        if (e.target === backdrop) closeModal();
      },
    },
  });

  const box = el('div', { className: 'modal', role: 'dialog', attrs: { 'aria-modal': 'true' } });
  const title = el('h2', { className: 'text-lg font-semibold text-brand-800 m-0 mb-2' });
  setText(title, modal.title);
  const body = el('p', { className: 'text-sm text-slateish-600 m-0 mb-4' });
  setText(body, modal.message);
  const actions = el('div', { className: 'flex justify-end' });
  const ok = el('button', {
    className: 'btn btn-primary',
    type: 'button',
    text: 'Понятно',
    events: { click: closeModal },
  });
  actions.appendChild(ok);
  box.append(title, body, actions);
  backdrop.appendChild(box);
  root.appendChild(backdrop);
}

export function handleApiError(err, { asModal = false } = {}) {
  const message = err?.message || 'Неизвестная ошибка';
  if (err?.code === 'RATE_LIMIT' || asModal) {
    showErrorModal('Ошибка API', message);
  } else {
    showToast(message, 'error');
  }
}
