// Oferta de "Vidas infinitas" na hora certa: além da tela "Sem vidas", aparece
// UMA vez por dia na tela de derrota, a partir da 3ª derrota do dia que gastou
// vida (CONFIG.offers.lossesPerDay). Nunca para quem já tem vidas infinitas.

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';

/** Data local AAAA-MM-DD (o "dia" do jogador, no fuso dele). */
export function localDay(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function rollDay(d, day) {
  if (d.daily.day !== day) d.daily = { day, losses: 0, offered: false };
}

export const Offers = {
  /** Uma derrota gastou vida: conta no dia. */
  recordLoss(now = new Date()) {
    const day = localDay(now);
    Storage.update((d) => {
      rollDay(d, day);
      d.daily.losses++;
    });
  },

  /** É a hora de mostrar a oferta na tela de derrota? (não marca como mostrada) */
  shouldOffer(now = new Date()) {
    if (!CONFIG.purchases.enabled || Storage.data.infiniteLives) return false;
    const d = Storage.data.daily;
    return d.day === localDay(now) && !d.offered && d.losses >= CONFIG.offers.lossesPerDay;
  },

  markOffered(now = new Date()) {
    const day = localDay(now);
    Storage.update((d) => {
      rollDay(d, day);
      d.daily.offered = true;
    });
  },
};
