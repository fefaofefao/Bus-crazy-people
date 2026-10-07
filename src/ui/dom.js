// Pequenos utilitários de sobreposição em HTML (usados pelos anúncios e compras
// de teste, pelo toast e pelo painel de debug). Ficam acima do canvas do Phaser.

const STOP_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
/** Impede que toques num elemento HTML cheguem ao canvas do jogo. */
export function isolate(e) {
  for (const ev of STOP_EVENTS) e.addEventListener(ev, (x) => x.stopPropagation());
  return e;
}

export function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * Cria uma sobreposição de tela cheia e devolve { root, box, close() }.
 * closable = true: o botão "voltar" do Android fecha a janela.
 */
export function openOverlay(className = '', { closable = false } = {}) {
  const root = el('div', `fds-overlay ${className}`);
  const box = el('div', 'fds-box');
  root.appendChild(box);
  isolate(root);
  document.body.appendChild(root);
  // força o fade-in
  requestAnimationFrame(() => root.classList.add('show'));
  const close = () => {
    root.classList.remove('show');
    root.dataset.back = '';
    setTimeout(() => root.remove(), 180);
  };
  if (closable) {
    root.dataset.back = 'close';
    root.__close = close;
  }
  return { root, box, close };
}

export function button(label, className, onClick) {
  const b = el('button', `fds-btn ${className || ''}`, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

let toastTimer = null;
/** Mensagem curta no rodapé. */
export function toast(msg, ms = 2200) {
  let t = document.querySelector('.fds-toast');
  if (!t) {
    t = el('div', 'fds-toast');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** Abre uma página HTML do próprio app (ex.: política de privacidade) numa janela com "Fechar". */
export function openPage(url, title, closeLabel = 'Fechar') {
  const ov = openOverlay('fds-page', { closable: true });
  const head = el('div', 'fds-page-head');
  head.appendChild(el('strong', '', title));
  head.appendChild(button(closeLabel, 'secondary', () => ov.close()));
  const frame = el('iframe');
  frame.src = url;
  frame.title = title;
  ov.box.append(head, frame);
  return ov;
}

/** Janela "Como jogar" (fecha com o botão ou com o "voltar" do Android). */
export async function openHelp() {
  const { t } = await import('../i18n/index.js');
  const ov = openOverlay('fds-help', { closable: true });
  ov.box.appendChild(el('h2', '', t('help.title')));
  const list = el('ol', 'fds-help-list');
  for (const step of t('help.steps')) list.appendChild(el('li', '', step));
  ov.box.appendChild(list);
  ov.box.appendChild(button(t('help.ok'), 'ok', () => ov.close()));
  return ov;
}

/**
 * Janela com título, texto e botões (vitória, derrota, confirmações).
 * buttons: [{ label, kind: ''|'secondary'|'ok'|'ad'|'danger', onClick(close) }]
 * kind 'ad' mostra o selo "▶ anúncio". Devolve { close }.
 */
export function modal({ title, text, badge, tone = '', buttons = [], closable = true, onClose }) {
  const ov = openOverlay(`fds-modal ${tone}`, { closable });
  if (badge) ov.box.appendChild(el('div', 'fds-modal-badge', badge));
  if (title) ov.box.appendChild(el('h2', '', title));
  if (text) ov.box.appendChild(el('p', '', text));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ov.close();
    onClose?.();
  };
  if (closable) ov.root.__close = close;
  for (const b of buttons) {
    const btn = button(b.label, b.kind || '', () => b.onClick?.(close));
    if (b.kind === 'ad') btn.prepend(el('span', 'fds-ad-tag', '▶'));
    ov.box.appendChild(btn);
  }
  return { close, root: ov.root };
}
