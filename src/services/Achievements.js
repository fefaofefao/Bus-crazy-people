// Conquistas: definições, progresso e desbloqueio.
// Tudo é calculado a partir do save (Storage.data), então não há como
// "perder" uma conquista: Achievements.check() pode rodar a qualquer momento.
//
// Para adicionar uma conquista: um item em LIST (id, icon, target, value(d)) e os
// textos achievements.<id>.title/desc em src/i18n/*.

import { Storage } from './Storage.js';
import { LEVELS, isChallenge } from '../levels/index.js';

const totalStars = (d) => Object.values(d.stars).reduce((a, b) => a + b, 0);
const challengesDone = (d) => d.completed.filter((n) => isChallenge(n)).length;
const CHALLENGES = LEVELS.filter((l) => l.challenge).length;

export const LIST = [
  { id: 'first_ride', icon: 'bus', target: 1, value: (d) => d.completed.length },
  { id: 'perfect', icon: 'star', target: 1, value: (d) => Object.values(d.stars).filter((s) => s === 3).length },
  { id: 'levels_25', icon: 'flag', target: 25, value: (d) => d.completed.length },
  { id: 'levels_100', icon: 'flag', target: 100, value: (d) => d.completed.length },
  { id: 'levels_200', icon: 'flag', target: 200, value: (d) => d.completed.length },
  { id: 'levels_all', icon: 'crown', target: LEVELS.length, value: (d) => d.completed.length },
  { id: 'stars_75', icon: 'star', target: 75, value: totalStars },
  { id: 'stars_300', icon: 'star', target: 300, value: totalStars },
  { id: 'stars_600', icon: 'star', target: 600, value: totalStars },
  { id: 'stars_all', icon: 'crown', target: LEVELS.length * 3, value: totalStars },
  { id: 'challenge_1', icon: 'flame', target: 1, value: challengesDone },
  { id: 'challenge_10', icon: 'flame', target: 10, value: challengesDone },
  { id: 'challenge_all', icon: 'crown', target: CHALLENGES, value: challengesDone },
  { id: 'challenge_perfect', icon: 'flame', target: 1, value: (d) => Object.entries(d.stars).filter(([k, s]) => s === 3 && isChallenge(+k)).length },
  { id: 'streak_10', icon: 'bolt', target: 10, value: (d) => d.stats.bestStreak },
  { id: 'combo_3', icon: 'bolt', target: 3, value: (d) => d.stats.maxCombo },
  { id: 'hurry_25', icon: 'clock', target: 25, value: (d) => d.stats.hurried },
  { id: 'explorer', icon: 'map', target: 4, value: (d) => d.stats.mechanicsWon.length },
];

export const Achievements = {
  list() {
    const d = Storage.data;
    return LIST.map((a) => {
      const v = Math.min(a.target, a.value(d));
      return { ...a, current: v, unlocked: d.achievements.includes(a.id) };
    });
  },

  /** Desbloqueia o que já foi cumprido. Devolve as conquistas NOVAS. */
  check() {
    const d = Storage.data;
    const fresh = LIST.filter((a) => !d.achievements.includes(a.id) && a.value(d) >= a.target);
    if (fresh.length) Storage.update((x) => x.achievements.push(...fresh.map((a) => a.id)));
    return fresh;
  },

  /**
   * Registra uma vitória e devolve { best, newBest, unlocked }.
   * info = { level, stars, maxCombo, hurried, mechanics }
   */
  recordWin({ level, stars, maxCombo = 0, hurried = 0, mechanics = [] }) {
    const prev = Storage.data.stars[level] ?? 0;
    Storage.update((d) => {
      if (stars > prev) d.stars[level] = stars;
      const st = d.stats;
      st.perfectStreak = stars === 3 ? st.perfectStreak + 1 : 0;
      st.bestStreak = Math.max(st.bestStreak, st.perfectStreak);
      st.maxCombo = Math.max(st.maxCombo, maxCombo);
      st.hurried += hurried;
      st.mechanicsWon = [...new Set([...st.mechanicsWon, ...mechanics])];
    });
    return { best: Math.max(prev, stars), newBest: stars > prev && prev > 0, unlocked: this.check() };
  },

  totalStars() {
    return totalStars(Storage.data);
  },

  count() {
    return Storage.data.achievements.length;
  },
};
