// Janela do presente diário (sequência de 7 dias). "Dobrar" abre um anúncio
// recompensado (opcional); "Pegar" dá o presente normal.

import { modal, toast } from './dom.js';
import { t } from '../i18n/index.js';
import { DailyReward } from '../services/DailyReward.js';
import { AdManager } from '../services/AdManager.js';
import { Sound } from '../services/Sound.js';
import { track } from '../analytics.ts';
import { ITEM_ICON, itemsText } from './items.js';

function tileHtml(reward, k, today) {
  const parts = Object.entries(reward)
    .map(([kind, n]) => (kind === 'lives' ? '❤️' : `${ITEM_ICON[kind]}${n > 1 ? `<b>${n}</b>` : ''}`))
    .join(' ');
  const cls = k + 1 < today ? 'done' : k + 1 === today ? 'today' : '';
  return `<div class="fds-day ${cls} ${k === 6 ? 'big' : ''}"><small>${t('daily.day', { n: k + 1 })}</small><span>${k + 1 < today ? '✓' : parts}</span></div>`;
}

/** Abre o presente do dia se ainda não foi pego hoje. Devolve true se abriu. */
export function openDailyReward(onDone) {
  const st = DailyReward.status();
  if (!st.available) return false;
  const html = `<div class="fds-daily">${DailyReward.days()
    .map((r, k) => tileHtml(r, k, st.day))
    .join('')}</div>`;
  const finish = (close, got, mult) => {
    close();
    Sound.reward();
    track('daily_reward', { day: got.day, doubled: mult === 2 });
    toast(`🎁 ${itemsText(got)}`, 3000);
    onDone?.();
  };
  modal({
    tone: 'win',
    title: t('daily.title'),
    text: t('daily.info', { n: st.day }),
    html,
    closable: false,
    buttons: [
      {
        label: t('daily.double'),
        kind: 'ad',
        onClick: async (close) => {
          let got = null;
          await AdManager.showRewarded(() => (got = DailyReward.claim(2)), 'daily_double');
          if (got) finish(close, got, 2);
        },
      },
      {
        label: t('daily.claim'),
        kind: 'ok',
        onClick: (close) => {
          const got = DailyReward.claim(1);
          if (got) finish(close, got, 1);
          else close();
        },
      },
    ],
  });
  return true;
}
