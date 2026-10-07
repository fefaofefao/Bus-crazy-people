// Estrelas por fase, a partir dos ERROS cometidos na tentativa vencedora.
// Erro = batida (ônibus bloqueado, trancado ou na obra) ou ajuda usada
// (desfazer, dica, vaga extra). Toda fase tem solução sem nenhum erro
// (conferido em npm run test:levels), então 3 estrelas são sempre possíveis.

export const STAR_RULES = {
  three: 0, // até 0 erros => ★★★
  two: 2, // até 2 erros => ★★ ; mais que isso => ★
};

export function starsFor(errors) {
  if (errors <= STAR_RULES.three) return 3;
  if (errors <= STAR_RULES.two) return 2;
  return 1;
}
