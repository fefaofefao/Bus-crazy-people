// Vidas (fora das fases): perder todos os corações de uma fase gasta 1 vida.
// Vencer nunca gasta. Sem vidas, espera a recarga ou assiste a um anúncio para encher.
// A recarga é calculada pelo relógio (funciona com o app fechado).
// Configuração em CONFIG.lives.

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';

const regenMs = () => CONFIG.lives.regenMinutes * 60 * 1000;

/** Aplica a recarga pelo tempo passado. */
function settle() {
  const max = CONFIG.lives.max;
  const now = Date.now();
  const d = Storage.data;
  if (d.lives >= max) {
    if (d.lives > max || d.livesAt !== 0) Storage.update((s) => ((s.lives = Math.min(s.lives, max)), (s.livesAt = 0)));
    return;
  }
  let at = d.livesAt || now;
  if (at > now) at = now; // relógio voltou no tempo
  const gained = Math.floor((now - at) / regenMs());
  if (gained > 0 || d.livesAt !== at) {
    Storage.update((s) => {
      s.lives = Math.min(max, s.lives + gained);
      s.livesAt = s.lives >= max ? 0 : at + gained * regenMs();
    });
  }
}

export const Lives = {
  /** { lives, max, nextInMs } — nextInMs = 0 quando cheio */
  get() {
    settle();
    const d = Storage.data;
    const max = CONFIG.lives.max;
    const nextInMs = d.lives >= max ? 0 : Math.max(0, d.livesAt + regenMs() - Date.now());
    return { lives: d.lives, max, nextInMs };
  },
  has() {
    return this.get().lives > 0;
  },
  /** Fases do tutorial não gastam vida. */
  exempt(level) {
    return level <= CONFIG.lives.freeUntilLevel;
  },
  consume() {
    settle();
    Storage.update((d) => {
      if (d.lives >= CONFIG.lives.max) d.livesAt = Date.now(); // começa a contar a recarga
      d.lives = Math.max(0, d.lives - 1);
    });
  },
  /** Devolve 1 vida (ex.: continuou a fase com o anúncio de +1 coração). */
  refund() {
    settle();
    Storage.update((d) => {
      d.lives = Math.min(CONFIG.lives.max, d.lives + 1);
      if (d.lives >= CONFIG.lives.max) d.livesAt = 0;
    });
  },
  refill() {
    Storage.update((d) => ((d.lives = CONFIG.lives.max), (d.livesAt = 0)));
  },
  /** 754000 -> "12:34" */
  format(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  },
};
