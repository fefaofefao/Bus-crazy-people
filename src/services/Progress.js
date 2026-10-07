// Progresso: quais fases estão liberadas e qual é a próxima a jogar.
// Regra: a fase N+1 libera quando a N foi vencida OU quando a N é Desafio
// (Desafios são opcionais e podem ser pulados).

import { Storage } from './Storage.js';
import { LEVEL_COUNT, isChallenge } from '../levels/index.js';

export const Progress = {
  isCompleted(n) {
    return Storage.data.completed.includes(n);
  },

  /** Maior fase liberada. */
  frontier() {
    const done = new Set(Storage.data.completed);
    let n = 1;
    while (n < LEVEL_COUNT && (done.has(n) || isChallenge(n))) n++;
    return n;
  },

  isUnlocked(n) {
    return n >= 1 && n <= this.frontier();
  },

  /** Fase do botão "Jogar": a primeira liberada ainda não vencida (pulando Desafios), ou a última. */
  nextToPlay() {
    const f = this.frontier();
    for (let n = 1; n <= f; n++) if (!this.isCompleted(n) && !isChallenge(n)) return n;
    return this.isCompleted(f) ? null : f;
  },

  countCompleted() {
    return Storage.data.completed.length;
  },

  allDone() {
    return this.nextToPlay() === null;
  },

  complete(n) {
    Storage.update((d) => {
      if (!d.completed.includes(n)) d.completed.push(n);
      d.skipped = d.skipped.filter((x) => x !== n);
    });
  },

  skip(n) {
    Storage.update((d) => {
      if (!d.skipped.includes(n)) d.skipped.push(n);
    });
  },
};
