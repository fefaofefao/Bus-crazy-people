// Pacote de fases embarcado no app (iguais para todos os jogadores).
// levels/levels.json é gerado por `npm run levels:generate` (tutorial feito à mão
// + fases procedurais aprovadas pelo solver) e conferido por `npm run test:levels`.

import pack from '../../levels/levels.json' with { type: 'json' };

export const LEVELS = pack.levels;
export const LEVELS_VERSION = pack.version;
export const LEVEL_COUNT = LEVELS.length;

export function getLevel(n) {
  return LEVELS[n - 1] ?? null;
}

export const isChallenge = (n) => getLevel(n)?.challenge === true;
