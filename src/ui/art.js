// Arte gerada por código (sem arquivos de imagem): ônibus, passageiros e símbolos.
// Para trocar por arte desenhada, veja docs/ARTE.md – basta substituir as funções
// busTexture() e drawPassenger() por imagens carregadas no BootScene.

import { COLORS, BUS_TYPES } from '../core/rules.js';
import { CONFIG } from '../config.js';

const shade = (c, f) => {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
};
export { shade };

/** Símbolo do modo daltônico centrado em (x, y), tamanho s. */
export function drawSymbol(g, kind, x, y, s, color, alpha = 1) {
  g.fillStyle(color, alpha);
  const r = s / 2;
  switch (kind) {
    case 'circle':
      g.fillCircle(x, y, r * 0.8);
      break;
    case 'triangle':
      g.fillTriangle(x, y - r * 0.9, x + r * 0.9, y + r * 0.7, x - r * 0.9, y + r * 0.7);
      break;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.42 : r;
        pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
      }
      g.fillPoints(pts, true);
      break;
    }
    case 'square':
      g.fillRect(x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
      break;
    case 'diamond':
      g.fillPoints(
        [
          { x, y: y - r },
          { x: x + r * 0.8, y },
          { x, y: y + r },
          { x: x - r * 0.8, y },
        ],
        true,
      );
      break;
    case 'cross':
      g.fillRect(x - r * 0.28, y - r * 0.9, r * 0.56, r * 1.8);
      g.fillRect(x - r * 0.9, y - r * 0.28, r * 1.8, r * 0.56);
      break;
    case 'heart':
      g.fillCircle(x - r * 0.42, y - r * 0.25, r * 0.46);
      g.fillCircle(x + r * 0.42, y - r * 0.25, r * 0.46);
      g.fillTriangle(x - r * 0.86, y - r * 0.08, x + r * 0.86, y - r * 0.08, x, y + r * 0.85);
      break;
    case 'hexagon': {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        pts.push({ x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9 });
      }
      g.fillPoints(pts, true);
      break;
    }
    default:
      g.fillCircle(x, y, r * 0.8);
  }
}

/**
 * Textura de ônibus visto de cima, apontando para CIMA (a frente fica no topo).
 * w = largura em px; len = comprimento em px. Rotacione a imagem para outras direções.
 * Devolve a chave da textura (gerada uma vez e reaproveitada).
 */
export function busTexture(scene, { type, color, w, len, symbol, hidden = false, pips = 0 }) {
  w = Math.round(w);
  len = Math.round(len);
  const key = `bus_${type}_${hidden ? 'h' : color}_${w}_${len}_${symbol && !hidden ? 1 : 0}_${pips}`;
  if (scene.textures.exists(key)) return key;
  const base = hidden ? 0x8d96a8 : COLORS[color].hex;
  const dark = shade(base, 0.68);
  const light = shade(base, 1.18);
  const pad = Math.ceil(w * 0.08);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const x0 = pad;
  const y0 = pad;
  const r = w * 0.24;
  // sombra
  g.fillStyle(CONFIG.colors.ink, 0.55);
  g.fillRoundedRect(x0 + w * 0.05, y0 + w * 0.08, w, len, r);
  // rodas (aparecem nas laterais)
  g.fillStyle(0x1b1f27, 1);
  const wheel = (cy) => {
    g.fillRoundedRect(x0 - w * 0.05, cy - w * 0.13, w * 0.14, w * 0.26, w * 0.05);
    g.fillRoundedRect(x0 + w * 0.91, cy - w * 0.13, w * 0.14, w * 0.26, w * 0.05);
  };
  wheel(y0 + len * 0.2);
  wheel(y0 + len * 0.8);
  // contorno azul-marinho (estilo adesivo) + carroceria
  g.fillStyle(CONFIG.colors.ink, 1);
  g.fillRoundedRect(x0 - w * 0.04, y0 - w * 0.04, w * 1.08, len + w * 0.08, r * 1.1);
  g.fillStyle(dark, 1);
  g.fillRoundedRect(x0, y0, w, len, r);
  g.fillStyle(base, 1);
  g.fillRoundedRect(x0 + w * 0.06, y0 + w * 0.04, w * 0.88, len - w * 0.1, r * 0.85);
  // faixa lateral branca (estilo ônibus urbano)
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(x0 + w * 0.06, y0 + w * 0.42, w * 0.07, len - w * 0.78);
  g.fillRect(x0 + w * 0.87, y0 + w * 0.42, w * 0.07, len - w * 0.78);
  // para-brisa (frente)
  g.fillStyle(0x1d2b3d, 1);
  g.fillRoundedRect(x0 + w * 0.12, y0 + w * 0.08, w * 0.76, w * 0.3, { tl: r * 0.7, tr: r * 0.7, bl: w * 0.04, br: w * 0.04 });
  g.fillStyle(0x9fd8ff, 0.45);
  g.fillTriangle(x0 + w * 0.18, y0 + w * 0.12, x0 + w * 0.42, y0 + w * 0.12, x0 + w * 0.18, y0 + w * 0.3);
  // letreiro (frente)
  g.fillStyle(0xffd23f, 1);
  g.fillRect(x0 + w * 0.3, y0 + w * 0.41, w * 0.4, w * 0.06);
  // faróis
  g.fillStyle(0xfff4c2, 1);
  g.fillCircle(x0 + w * 0.17, y0 + w * 0.05, w * 0.06);
  g.fillCircle(x0 + w * 0.83, y0 + w * 0.05, w * 0.06);
  // teto: ar-condicionado e escotilhas
  g.fillStyle(light, 1);
  g.fillRoundedRect(x0 + w * 0.2, y0 + w * 0.55, w * 0.6, len - w * 0.95, w * 0.1);
  if (pips > 0) {
    // lugares do ônibus (UX: capacidade visível antes de tirar do estacionamento)
    const rows = Math.ceil(pips / 2);
    const top = y0 + w * 0.68;
    const step = Math.min((len - w * 1.1) / rows, w * 0.24);
    for (let k = 0; k < pips; k++) {
      const cx = x0 + w / 2 + (k % 2 ? 1 : -1) * w * 0.13;
      const cy = top + Math.floor(k / 2) * step + step / 2;
      g.fillStyle(CONFIG.colors.ink, 0.45);
      g.fillCircle(cx, cy, Math.max(1.5, w * 0.075));
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(cx, cy, Math.max(1, w * 0.05));
    }
  }
  g.fillStyle(0xffffff, pips > 0 ? 0 : 0.55);
  const units = Math.max(1, Math.round((len - w) / (w * 0.75)));
  const span = len - w * 1.15;
  for (let i = 0; i < units; i++) {
    const cy = y0 + w * 0.65 + (span * (i + 0.5)) / units;
    g.fillRoundedRect(x0 + w * 0.3, cy - w * 0.12, w * 0.4, w * 0.24, w * 0.05);
  }
  // vidro traseiro
  g.fillStyle(0x1d2b3d, 0.85);
  g.fillRect(x0 + w * 0.22, y0 + len - w * 0.2, w * 0.56, w * 0.08);
  // ônibus coberto: lona cinza com "?"
  if (hidden) {
    const cx = x0 + w / 2;
    const cy = y0 + len / 2 + w * 0.08;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, w * 0.3);
    g.lineStyle(w * 0.08, 0x3b4252, 1);
    g.beginPath();
    g.arc(cx, cy - w * 0.06, w * 0.11, Math.PI * 1.05, Math.PI * 0.45, false);
    g.strokePath();
    g.fillStyle(0x3b4252, 1);
    g.fillRect(cx - w * 0.035, cy + w * 0.02, w * 0.07, w * 0.08);
    g.fillCircle(cx, cy + w * 0.17, w * 0.045);
  } else if (symbol) {
    // símbolo (modo daltônico)
    const cy = y0 + len / 2 + w * 0.1;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x0 + w / 2, cy, w * 0.28);
    drawSymbol(g, COLORS[color].symbol, x0 + w / 2, cy, w * 0.38, shade(base, 0.8));
  }
  g.generateTexture(key, w + pad * 2 + Math.ceil(w * 0.06), len + pad * 2 + Math.ceil(w * 0.1));
  g.destroy();
  return key;
}

/** Remove texturas de ônibus de outros tamanhos (ao redimensionar a tela). */
export function pruneBusTextures(scene, keep) {
  for (const key of scene.textures.getTextureKeys()) {
    if (key.startsWith('bus_') && !keep(key)) scene.textures.remove(key);
  }
}

/**
 * Passageiro (visto de frente, estilizado) dentro de um Container já criado.
 * s = altura total. skin = índice do tom de pele.
 */
export function drawPassenger(g, { color, s, skin = 0, symbol, hair = 0 }) {
  const base = COLORS[color].hex;
  const C = CONFIG.colors;
  const ink = C.ink;
  const o = Math.max(1.5, s * 0.06);
  // sombra
  g.fillStyle(ink, 0.25);
  g.fillEllipse(0, s * 0.47, s * 0.62, s * 0.12);
  // corpo (contorno + cor + dobra)
  g.fillStyle(ink, 1);
  g.fillRoundedRect(-s * 0.27 - o, -s * 0.07 - o, s * 0.54 + o * 2, s * 0.5 + o * 2, s * 0.2);
  g.fillStyle(base, 1);
  g.fillRoundedRect(-s * 0.27, -s * 0.07, s * 0.54, s * 0.5, s * 0.18);
  g.fillStyle(shade(base, 0.78), 1);
  g.fillRoundedRect(-s * 0.27, s * 0.3, s * 0.54, s * 0.13, { tl: 0, tr: 0, bl: s * 0.18, br: s * 0.18 });
  // cabeça
  g.fillStyle(ink, 1);
  g.fillCircle(0, -s * 0.25, s * 0.2 + o);
  g.fillStyle(C.skin[skin % C.skin.length], 1);
  g.fillCircle(0, -s * 0.25, s * 0.2);
  // cabelo
  const hairColors = [0x2b1d14, 0x5a3a22, 0x111111, 0xc9a15a];
  g.fillStyle(hairColors[hair % hairColors.length], 1);
  g.slice(0, -s * 0.25, s * 0.2, Math.PI * 1.08, Math.PI * 1.92, false);
  g.fillPath();
  // olhos
  g.fillStyle(ink, 1);
  g.fillCircle(-s * 0.07, -s * 0.23, s * 0.028);
  g.fillCircle(s * 0.07, -s * 0.23, s * 0.028);
  if (symbol) {
    g.fillStyle(ink, 1);
    g.fillCircle(0, s * 0.14, s * 0.17);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, s * 0.14, s * 0.145);
    drawSymbol(g, COLORS[color].symbol, 0, s * 0.14, s * 0.2, shade(base, 0.75));
  }
}

/** Símbolos do modo daltônico em texto (lista da fila). */
export const SYMBOL_CHARS = { circle: '●', triangle: '▲', star: '★', square: '■', diamond: '◆', cross: '✚', heart: '♥', hexagon: '⬢' };

export const busCapacity = (type) => BUS_TYPES[type].cap;
