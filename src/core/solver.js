// Solver: prova que uma fase tem solução SEM boosters e encontra a próxima jogada (dica).
//
// Busca em profundidade com memória de estados sem saída. É completa: como o
// estado inclui tudo o que importa (ônibus no estacionamento, vagas com a
// lotação de cada ônibus, posição na fila e número de jogadas), se a busca
// termina sem achar solução, a fase é impossível a partir daquele estado.
// Batidas nunca ajudam (só gastam paciência), então o solver só considera
// toques em ônibus com caminho livre – toda solução tem exatamente N toques.
//
// Ordenação dos candidatos (só acelera; não muda a resposta):
//   1. ônibus da cor do passageiro da frente;
//   2. cores que aparecem logo na fila;
//   3. ônibus que liberam mais caminhos.

import { initialState, tap, legalExits, occupancy, scanPath, stateKey } from './engine.js';

/**
 * Resolve a partir de `state` (padrão: início da fase).
 * Retorna { solvable, path, nodes, capped }:
 *   path   = ids dos ônibus a tocar, em ordem (null se não há solução);
 *   capped = true se parou por atingir maxNodes (resultado inconclusivo).
 */
export function solve(level, { state = null, maxNodes = 300000 } = {}) {
  const start = state ?? initialState(level);
  if (start.status === 'won') return { solvable: true, path: [], nodes: 0, capped: false };
  if (start.status !== 'playing') return { solvable: false, path: null, nodes: 0, capped: false };
  const dead = new Set();
  const path = [];
  let nodes = 0;
  let capped = false;

  // "quanto antes a cor é pedida na fila" (para ordenar candidatos)
  const nextNeed = (s, color) => {
    for (let i = s.q, lim = Math.min(level.queue.length, s.q + 40); i < lim; i++) if (level.queue[i] === color) return i - s.q;
    return 99;
  };

  function dfs(s) {
    if (s.status === 'won') return true;
    if (s.status !== 'playing') return false;
    if (++nodes > maxNodes) {
      capped = true;
      return false;
    }
    const key = stateKey(s);
    if (dead.has(key)) return false;
    const occ = occupancy(level, s);
    const cands = legalExits(level, s, occ);
    const scored = cands.map((id) => {
      const b = level.buses[id];
      let unblocks = 0;
      for (const o of level.buses) if (o.id !== id && s.inLot[o.id] && scanPath(level, occ, o).blockerId === id) unblocks++;
      return { id, score: nextNeed(s, b.color) * 10 - unblocks };
    });
    scored.sort((a, b) => a.score - b.score || a.id - b.id);
    for (const { id } of scored) {
      const r = tap(level, s, id, occ);
      path.push(id);
      if (dfs(r.state)) return true;
      path.pop();
      if (capped) return false;
    }
    dead.add(key);
    return false;
  }

  const ok = dfs(start);
  return { solvable: ok, path: ok ? path.slice() : null, nodes, capped };
}

/** Próxima jogada correta a partir de um estado (dica). null = sem saída (ou inconclusivo). */
export function nextMove(level, state, maxNodes = 120000) {
  const r = solve(level, { state, maxNodes });
  return r.solvable && r.path.length ? r.path[0] : null;
}
