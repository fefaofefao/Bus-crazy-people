// Medidas de tela: tamanho do jogo, densidade de pixels, áreas seguras e
// a "unidade" u (1u ≈ 1px CSS num celular de 390px de largura).

import { CONFIG } from '../config.js';

// Fredoka (fonte embutida, licença OFL) com fontes do sistema como reserva
export const FONT = "Fredoka, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
// Fonte de títulos e botões (Lilita One, licença OFL): pesada e arredondada, cara de letreiro de ônibus
export const DISPLAY = "'Lilita One', Fredoka, system-ui, sans-serif";

let renderRatio = null; // pixels do canvas por px CSS (definido pelo main.js)

/** Densidade usada no canvas: pixels físicos reais da tela (com limite de segurança). */
export function getDpr() {
  return renderRatio ?? Math.min(window.devicePixelRatio || 1, CONFIG.layout.maxDevicePixelRatio);
}

export function setRenderRatio(r) {
  renderRatio = r;
}

/** Áreas seguras em px CSS (lidas via env(safe-area-inset-*) numa div sonda). */
export function getSafeAreaCss() {
  let probe = document.getElementById('safe-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'safe-probe';
    document.body.appendChild(probe);
  }
  const s = getComputedStyle(probe);
  return {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
}

/** Layout em px de jogo (já multiplicados pela densidade). */
export function getLayout(scene) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const dpr = getDpr();
  const sa = getSafeAreaCss();
  const safe = { top: sa.top * dpr, right: sa.right * dpr, bottom: sa.bottom * dpr, left: sa.left * dpr };
  const usableW = W - safe.left - safe.right;
  const usableH = H - safe.top - safe.bottom;
  const u = Math.min(usableW / CONFIG.layout.designWidth, usableH / CONFIG.layout.designHeight);
  return {
    W,
    H,
    dpr,
    u,
    safe,
    left: safe.left,
    right: W - safe.right,
    top: safe.top,
    bottom: H - safe.bottom,
    cx: safe.left + usableW / 2,
    usableW,
    usableH,
  };
}

/** Converte um número 0xRRGGBB em '#rrggbb'. */
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
