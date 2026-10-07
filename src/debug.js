// Modo de teste: abra o jogo com ?debug=1 na URL (nunca ativo no build de release).
// Botão "DEBUG" no canto: ir para fase, mostrar ordem de solução, liberar todas
// as fases, alternar "anúncios removidos", zerar temporizador de anúncios e
// zerar progresso. Mostra as métricas da fase atual.

import { el, isolate } from './ui/dom.js';
import { CONFIG } from './config.js';
import { Storage } from './services/Storage.js';
import { AdManager } from './services/AdManager.js';
import { Lives } from './services/Lives.js';
import { getLevel, LEVEL_COUNT } from './levels/index.js';

export const Debug = {
  enabled: !CONFIG.release && new URLSearchParams(location.search).get('debug') === '1',
  showSolution: false,
};

const changed = () => window.dispatchEvent(new Event('fds-debug-change'));

export function initDebug(game) {
  if (!Debug.enabled) return;
  const toggle = el('button', 'fds-debug-toggle', 'DEBUG');
  const panel = el('div', 'fds-debug');
  panel.innerHTML = `
    <h3>Modo de teste</h3>
    <div class="row"><input type="number" min="1" max="${LEVEL_COUNT}" step="1" placeholder="Nº da fase" id="dbg-level"><button id="dbg-go">Ir para fase</button></div>
    <label><input type="checkbox" id="dbg-sol"> Mostrar ordem de solução</label>
    <label><input type="checkbox" id="dbg-ads"> Anúncios removidos</label>
    <label><input type="checkbox" id="dbg-inf"> Vidas infinitas</label>
    <div class="row"><button id="dbg-unlock">Liberar todas as fases</button><button id="dbg-timer">Zerar timer de anúncio</button></div>
    <div class="row"><button id="dbg-lives-full">Vidas cheias</button><button id="dbg-lives-zero">Zerar vidas</button></div>
    <div class="row"><button class="warn" id="dbg-reset">Zerar tudo</button></div>
    <div class="info" id="dbg-info"></div>`;
  document.body.append(isolate(toggle), isolate(panel));
  const $ = (id) => panel.querySelector('#' + id);
  toggle.addEventListener('click', () => panel.classList.toggle('open'));
  const activeScene = () => game.scene.getScenes(true)[0];

  $('dbg-go').addEventListener('click', () => {
    const n = Math.floor(Number($('dbg-level').value));
    if (!Number.isFinite(n) || n < 1 || n > LEVEL_COUNT) return;
    activeScene()?.scene.start('Game', { level: n });
    panel.classList.remove('open');
  });
  $('dbg-sol').addEventListener('change', (e) => {
    Debug.showSolution = e.target.checked;
    changed();
  });
  $('dbg-ads').addEventListener('change', (e) => Storage.update((d) => (d.adsRemoved = e.target.checked)));
  $('dbg-inf').addEventListener('change', (e) => (Storage.update((d) => (d.infiniteLives = e.target.checked)), changed()));
  $('dbg-timer').addEventListener('click', () => AdManager.resetTimer());
  $('dbg-unlock').addEventListener('click', () => {
    Storage.update((d) => (d.completed = Array.from({ length: LEVEL_COUNT - 1 }, (_, i) => i + 1)));
    activeScene()?.scene.restart();
  });
  $('dbg-lives-full').addEventListener('click', () => {
    Lives.refill();
    activeScene()?.scene.restart();
  });
  $('dbg-lives-zero').addEventListener('click', () => {
    Storage.update((d) => ((d.lives = 0), (d.livesAt = Date.now())));
    activeScene()?.scene.restart();
  });
  $('dbg-reset').addEventListener('click', () => {
    if (!confirm('Zerar todo o progresso (inclusive idioma e compras de teste)?')) return;
    Storage.reset(false);
    activeScene()?.scene.start('Boot');
  });

  const refresh = () => {
    const d = Storage.data;
    $('dbg-ads').checked = d.adsRemoved;
    $('dbg-inf').checked = d.infiniteLives;
    const s = activeScene();
    let info = '';
    if (s?.scene.key === 'Game') {
      const lv = getLevel(s.levelId);
      info = `\nFase ${lv.id}: ${lv.cols}x${lv.rows}, ${lv.buses.length} ônibus, ${lv.lines.flat().length} passageiros em ${lv.lines.length} fila(s) (paciência ${lv.calm}), ${lv.slots} vagas, prioritários ${lv.priority.length} · mecânicas: ${(lv.mechanics || []).join(", ") || "—"}\nscore ${lv.meta.score} · vitória aleatória ${lv.meta.randomWin} · gulosa ${lv.meta.greedyWin} · semente ${lv.meta.seed}`;
    }
    $('dbg-info').textContent =
      `Vidas: ${Lives.get().lives} · Vencidas: ${d.completed.length} · vitórias desde intersticial: ${d.winsSinceInterstitial}/${CONFIG.ads.interstitial.everyNWins}\n` +
      `Segundos desde o último intersticial: ${AdManager.secondsSinceLastInterstitial()} (mín. ${CONFIG.ads.interstitial.minIntervalSeconds})` +
      info;
  };
  setInterval(() => panel.classList.contains('open') && refresh(), 1000);
  toggle.addEventListener('click', refresh);
}
