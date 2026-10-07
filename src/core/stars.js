// Estrelas por fase, a partir do HUMOR DAS FILAS no fim da partida vencida
// (ver "HUMOR DAS FILAS" em src/core/engine.js).
//
// Com 3 filas:  3 felizes = ★★★ (perfeito) · 2 felizes = ★★ · 1 ou 0 = ★ (ruim).
// Fases com menos filas (tutorial) usam a mesma régua: cada fila infeliz tira 1
// estrela, com mínimo de 1. Toda fase tem uma solução que deixa todas as filas
// felizes (a ordem gravada em `solution`, conferida em npm run test:levels).

export const MAX_STARS = 3;

/** happy = filas felizes; lines = total de filas da fase. */
export function starsFor(happy, lines = 3) {
  return Math.max(1, Math.min(MAX_STARS, MAX_STARS - (lines - happy)));
}
