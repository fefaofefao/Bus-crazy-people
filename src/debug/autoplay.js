// =============================================================================
// AUTOPLAY – só no APK de TESTE de anúncios (build com VITE_AUTOPLAY=1).
// Nunca entra no build normal nem no da loja: main.js só importa este arquivo
// quando a variável existe (o Vite remove o código no build comum).
//
// Joga sozinho as fases 1…N pela solução gravada, toca "Próxima fase" na tela de
// vitória (é aí que o intersticial pode aparecer) e, no fim, abre a tela "Sem
// vidas" e toca "Assistir para ganhar 1 vida" (recompensado). Tudo vai para o
// logcat com os prefixos [Auto] e [Ads] (scripts/ci/ads-emulator-test.sh).
// =============================================================================

import { Storage } from '../services/Storage.js';

const LAST = Number(import.meta.env.VITE_AUTOPLAY_LEVELS || 8);
const log = (...a) => console.log('[Auto]', ...a);

/** Save inicial: idioma escolhido e novidades já vistas (sem janelas no caminho). */
export function prepareSave() {
  Storage.update((d) => {
    d.language ??= 'pt-BR';
    d.seen = ['mood', 'lines', 'hidden', 'cones', 'lock', 'garage'];
  });
}

export function startAutoplay(game) {
  let phase = 'levels';
  let lastWinLevel = 0;
  let rewardedAsked = false;
  log('start: levels 1 ..', LAST);
  const click = (btn, why) => {
    log('click', JSON.stringify(btn.textContent.trim()), why);
    btn.click();
  };
  setInterval(() => {
    try {
      const modalEl = [...document.querySelectorAll('.fds-overlay')].pop();
      const scene = game.scene.getScenes(true)[0];
      const key = scene?.scene.key;
      if (modalEl) {
        const btns = [...modalEl.querySelectorAll('.fds-btn')];
        if (!btns.length) return; // anúncio de teste / carregando
        if (modalEl.classList.contains('win')) {
          const next = btns.find((b) => b.classList.contains('ok'));
          if (next) click(next, `win level ${lastWinLevel} -> next (intersticial pode aparecer aqui)`);
          return;
        }
        if (phase === 'rewarded' && rewardedAsked) return; // anúncio na tela: não mexe na janela
        if (phase === 'rewarded' && !rewardedAsked) {
          const ad = btns.find((b) => b.classList.contains('ad'));
          if (ad) {
            rewardedAsked = true;
            click(ad, 'no lives -> rewarded');
          } else log('rewarded button NOT shown (anúncio ainda não carregado)');
          return;
        }
        if (phase === 'done') return;
        const ok = btns.find((b) => b.classList.contains('ok')) ?? btns[0];
        click(ok, 'close modal');
        return;
      }
      if (phase === 'done') return;
      if (key !== 'Game') {
        if (key === 'Menu' || key === 'Levels') {
          log('scene', key, '-> Game 1');
          scene.scene.start('Game', { level: 1 });
        }
        return;
      }
      const g = scene;
      if (g.state?.status === 'won' && g.levelId !== lastWinLevel) {
        lastWinLevel = g.levelId;
        log('level', g.levelId, 'won');
      }
      if (phase === 'levels' && g.levelId > LAST) {
        phase = 'rewarded';
        log('levels done -> testing rewarded on "no lives" screen');
        g.modalOpen = false;
        g.showNoLives(false);
        return;
      }
      if (phase === 'rewarded') {
        if (rewardedAsked && !document.querySelector('.fds-overlay')) {
          phase = 'done';
          log('done');
        }
        return;
      }
      if (g.busy || g.modalOpen || g.ended || g.state.status !== 'playing') return;
      const id = g.level.solution[g.history.length];
      if (id == null) return;
      g.play(id);
    } catch (e) {
      log('error', e?.message);
    }
  }, 450);
}
