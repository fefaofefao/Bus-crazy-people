// Ponto de entrada: cria o jogo Phaser em tela cheia, nítido em telas de alta densidade.

import Phaser from 'phaser';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/lilita-one/latin-400.css';
import './style.css';
import { CONFIG } from './config.js';
import { setRenderRatio } from './ui/layout.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { LanguageScene } from './scenes/LanguageScene.js';
import { LevelsScene } from './scenes/LevelsScene.js';
import { AchievementsScene } from './scenes/AchievementsScene.js';
import { initDebug } from './debug.js';
import { initBackButton } from './services/BackButton.js';

const parent = document.getElementById('game');

// NITIDEZ: o canvas precisa ter exatamente 1 pixel por pixel físico da tela. Se a
// proporção não for exata (ex.: densidade 2,75 com largura arredondada), o navegador
// reamostra a imagem inteira e tudo fica levemente borrado. Por isso:
//   - o canvas ocupa 100% do #game via CSS (style.css);
//   - a resolução vem do ResizeObserver 'device-pixel-content-box', que informa os
//     pixels físicos exatos do elemento (com reserva por getBoundingClientRect × dpr).
function measure() {
  const r = parent.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.layout.maxDevicePixelRatio);
  return { w: Math.max(1, Math.round(r.width * dpr)), h: Math.max(1, Math.round(r.height * dpr)), cssW: r.width || 1 };
}

// Espera a fonte carregar antes de desenhar textos (no máximo 2 s)
const fontsReady = Promise.race([
  Promise.all(['500 20px Fredoka', '700 20px Fredoka', '400 20px "Lilita One"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2000)),
]).catch(() => {});

await fontsReady;
const s = measure();
setRenderRatio(s.w / s.cssW);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  backgroundColor: CONFIG.colors.ink,
  // Resolução física; o tamanho na tela é 100% do #game (CSS)
  scale: { mode: Phaser.Scale.NONE, width: s.w, height: s.h, zoom: s.cssW / s.w },
  // roundPixels: imagens e textos em pixel inteiro (sem meio-pixel borrado)
  render: { antialias: true, antialiasGL: true, roundPixels: true },
  // windowEvents: false => toques nas sobreposições HTML (anúncio, compra, debug) não chegam ao jogo
  input: { activePointers: 3, windowEvents: false },
  scene: [BootScene, LanguageScene, MenuScene, LevelsScene, AchievementsScene, GameScene, SettingsScene],
});

/** Aplica um novo tamanho físico (w × h pixels) para um elemento de cssW px CSS. */
function applySize(w, h, cssW) {
  if (!w || !h) return;
  setRenderRatio(w / cssW);
  if (w === game.scale.width && h === game.scale.height) return;
  game.scale.setZoom(cssW / w);
  game.scale.resize(w, h);
}

let exactPixels = false;
try {
  const ro = new ResizeObserver((entries) => {
    const e = entries[0];
    const box = e.devicePixelContentBoxSize?.[0];
    const cssW = e.contentRect.width;
    const dpr = window.devicePixelRatio || 1;
    // só confia no valor se ele bater com a densidade da tela (alguns ambientes informam errado)
    if (!box || !cssW || Math.abs(box.inlineSize / cssW - dpr) / dpr > 0.03 || dpr > CONFIG.layout.maxDevicePixelRatio) {
      exactPixels = false;
      const n = measure();
      applySize(n.w, n.h, n.cssW);
      return;
    }
    exactPixels = true;
    applySize(box.inlineSize, box.blockSize, cssW);
  });
  ro.observe(game.canvas, { box: 'device-pixel-content-box' });
} catch {
  /* navegador sem device-pixel-content-box: usa o cálculo por dpr abaixo */
}

let resizeTimer = null;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (exactPixels) return; // o ResizeObserver já cuida
    const n = measure();
    applySize(n.w, n.h, n.cssW);
  }, 120);
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

window.__game = game; // útil para depuração no console
initDebug(game);
initBackButton(game);
