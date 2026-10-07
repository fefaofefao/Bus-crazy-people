// Solver: prova que uma fase tem solução SEM boosters e encontra a próxima jogada (dica).
//
// Busca em profundidade com memória de estados sem saída. É completa: como o
// estado inclui tudo o que importa (ônibus no estacionamento, vagas com a
// lotação de cada ônibus, posição na fila e número de jogadas), se a busca
// termina sem achar solução, a fase é impossível a partir daquele estado.
// Batidas só ajudam para "esperar" uma obra (cones) terminar; fora disso o solver
// só considera toques em ônibus que saem.
//
// keepHappy = true: só aceita caminhos em que todas as filas continuam felizes
// (3 estrelas). O estado memorizado passa a incluir a espera e o humor das filas.
//
// Ordenação dos candidatos (só acelera; não muda a resposta):
//   1. ônibus da cor de algum passageiro da frente;
//   2. cores que aparecem logo na fila;
//   3. ônibus que liberam mais caminhos.

import { initialState, tap, legalExits, occupancy, scanPath, stateKey, linesOf, MOOD_HAPPY } from './engine.js';

/**
 * Resolve a partir de `state` (padrão: início da fase).
 * Retorna { solvable, path, nodes, capped }:
 *   path   = ids dos ônibus a tocar, em ordem (null se não há solução);
 *   capped = true se parou por atingir maxNodes (resultado inconclusivo).
 */
export function solve(level, { state = null, maxNodes = 300000, keepHappy = false } = {}) {
  const start = state ?? initialState(level);
  if (start.status === 'won') return { solvable: true, path: [], nodes: 0, capped: false };
  if (start.status !== 'playing') return { solvable: false, path: null, nodes: 0, capped: false };
  const lines = linesOf(level);
  const unhappy = (s) => keepHappy && s.mood.some((m) => m !== MOOD_HAPPY);
  if (unhappy(start)) return { solvable: false, path: null, nodes: 0, capped: false };
  const keyOf = keepHappy ? (s) => stateKey(s) + '|' + s.wait.join('.') : stateKey;
  const dead = new Set();
  const path = [];
  let nodes = 0;
  let capped = false;

  // "quanto antes a cor é pedida em alguma fila" (para ordenar candidatos)
  const nextNeed = (s, color) => {
    let best = 99;
    lines.forEach((line, li) => {
      const q = s.q[li];
      for (let i = q, lim = Math.min(line.length, q + Math.min(best, 40)); i < lim; i++)
        if (line[i] === color) {
          best = Math.min(best, i - q);
          break;
        }
    });
    return best;
  };

  function dfs(s) {
    if (unhappy(s)) return false;
    if (s.status === 'won') return true;
    if (s.status !== 'playing') return false;
    if (++nodes > maxNodes) {
      capped = true;
      return false;
    }
    const key = keyOf(s);
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
    // Obra em andamento: "esperar" (tocar num ônibus que bate) também é uma jogada
    // possível – a obra termina com o número de jogadas. Só vale se houver cone ativo.
    if ((level.cones || []).some((c) => s.moves < c.until)) {
      const legal = new Set(cands);
      const waiter = level.buses.find((b) => s.inLot[b.id] === 1 && !legal.has(b.id));
      if (waiter) {
        const r = tap(level, s, waiter.id, occ);
        path.push(waiter.id);
        if (dfs(r.state)) return true;
        path.pop();
        if (capped) return false;
      }
    }
    dead.add(key);
    return false;
  }

  const ok = dfs(start);
  return { solvable: ok, path: ok ? path.slice() : null, nodes, capped };
}

/**
 * Próxima jogada correta a partir de um estado (dica). Prefere uma jogada que
 * mantém todas as filas felizes; se não houver, qualquer uma que ainda vence.
 * null = sem saída (ou inconclusivo).
 */
export function nextMove(level, state, maxNodes = 120000) {
  const happy = solve(level, { state, maxNodes: maxNodes / 2, keepHappy: true });
  if (happy.solvable && happy.path.length) return happy.path[0];
  const r = solve(level, { state, maxNodes });
  return r.solvable && r.path.length ? r.path[0] : null;
}
