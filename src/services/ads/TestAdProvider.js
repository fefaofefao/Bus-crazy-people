// Implementação de TESTE dos anúncios: uma sobreposição de tela cheia com
// "ANÚNCIO DE TESTE" e contagem regressiva. Não usa rede nem SDK nenhum.
//
// Contrato de um "provider" de anúncios (o mesmo que o AdMobProvider deve seguir):
//   init(): Promise<void>
//   showInterstitial(): Promise<void>          -> resolve quando o anúncio fecha
//   showRewarded(): Promise<{ rewarded: boolean }>  -> rewarded=true só se assistiu até o fim

import { CONFIG } from '../../config.js';
import { el, openOverlay, button } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';

function countdownOverlay({ title, subtitle, onTick, onDone }) {
  const ov = openOverlay('fds-ad');
  ov.box.appendChild(el('div', 'fds-ad-label', t('testAd.label')));
  ov.box.appendChild(el('p', '', title));
  const count = el('div', 'fds-ad-count', String(CONFIG.ads.testAdSeconds));
  ov.box.appendChild(count);
  const sub = el('p', '', subtitle);
  ov.box.appendChild(sub);
  let left = CONFIG.ads.testAdSeconds;
  const timer = setInterval(() => {
    left--;
    count.textContent = String(Math.max(0, left));
    onTick?.(left);
    if (left <= 0) {
      clearInterval(timer);
      onDone({ count, sub });
    }
  }, 1000);
  return { ov, stop: () => clearInterval(timer) };
}

export const TestAdProvider = {
  async init() {},

  showInterstitial() {
    return new Promise((resolve) => {
      let skip;
      const { ov } = countdownOverlay({
        title: t('testAd.interstitial'),
        subtitle: t('testAd.interstitialInfo'),
        onDone: ({ count, sub }) => {
          count.textContent = '✓';
          sub.textContent = t('testAd.canSkip');
          skip.classList.remove('hidden');
        },
      });
      skip = button(t('testAd.skip'), 'hidden', () => {
        ov.close();
        resolve();
      });
      ov.box.appendChild(skip);
    });
  },

  showRewarded() {
    return new Promise((resolve) => {
      let finished = false;
      let close;
      const { ov, stop } = countdownOverlay({
        title: t('testAd.rewarded'),
        subtitle: t('testAd.rewardedInfo'),
        onDone: ({ count, sub }) => {
          finished = true;
          count.textContent = '✓';
          sub.textContent = t('testAd.rewardReady');
          close.textContent = t('testAd.closeAndGet');
          close.classList.add('ok');
        },
      });
      // "Fechar" sempre visível; a recompensa só vale se a contagem terminou
      close = button(t('testAd.close'), 'secondary', () => {
        stop();
        ov.close();
        resolve({ rewarded: finished, shown: true });
      });
      ov.box.appendChild(close);
    });
  },
};
