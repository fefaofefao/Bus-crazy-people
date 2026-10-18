// Presente diário com sequência de 7 dias (CONFIG.dailyReward.days).
// - Um presente por dia (data local). Voltou no dia seguinte: a sequência avança;
//   pulou um dia: recomeça no dia 1. Depois do dia 7, recomeça no 1.
// - "Dobrar" (anúncio recompensado) multiplica as ajudas por 2 (as vidas não).

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';
import { Inventory } from './Inventory.js';
import { Lives } from './Lives.js';
import { localDay } from './Offers.js';

function yesterday(now) {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localDay(d);
}

export const DailyReward = {
  days: () => CONFIG.dailyReward.days,

  /** { available, day (1–7), reward } */
  status(now = new Date()) {
    const r = Storage.data.reward;
    const today = localDay(now);
    const available = r.day !== today;
    let day;
    if (!available) day = r.streak;
    else day = r.day === yesterday(now) ? (r.streak % 7) + 1 : 1;
    return { available, day, reward: CONFIG.dailyReward.days[day - 1] };
  },

  /** Pega o presente de hoje (mult = 2 com o anúncio). Devolve o que foi dado, ou null. */
  claim(mult = 1, now = new Date()) {
    const st = this.status(now);
    if (!st.available) return null;
    const got = {};
    for (const [k, v] of Object.entries(st.reward)) if (k !== 'lives') got[k] = v * mult;
    Inventory.add(got);
    if (st.reward.lives) Lives.refill();
    Storage.update((d) => (d.reward = { day: localDay(now), streak: st.day }));
    return { ...got, lives: !!st.reward.lives, day: st.day };
  },
};
