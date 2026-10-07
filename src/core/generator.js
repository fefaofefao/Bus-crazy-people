// Gerador procedural de fases com semente (determinístico: mesma semente => mesma fase).
// Só é usado pelos scripts (npm run levels:generate); o app embarca o resultado pronto.
//
// COMO FUNCIONA
// 1. Estacionamento por construção reversa: os ônibus entram um a um e cada um só
//    é aceito se, naquele momento, tiver caminho livre até a borda. Assim, tirar os
//    ônibus na ordem inversa sempre funciona (ordem pretendida O).
// 2. Fila construída simulando a ordem O com as regras reais do motor: depois de
//    cada toque, uma "leva" de passageiros embarca. Levas curtas obrigam o jogador
//    a guardar ônibus nas vagas (é daí que vem a dificuldade). Restrições garantem
//    que a ordem O nunca lota as vagas.
// 3. Prioritários: escolhidos na fila; a paciência = momento em que embarcam na
//    ordem O + uma folga.
// 4. O solver confirma que há solução sem boosters (o gerador rejeita o resto) e
//    as métricas de dificuldade são calculadas (ver measure()).

import { mulberry32 } from './prng.js';
import { DIRS, DIR_KEYS, BUS_TYPES, busCells } from './rules.js';
import { LEVEL_FORMAT, initialState, tap, legalExits, occupancy, validateLevel } from './engine.js';
import { solve } from './solver.js';

/** Monta o estacionamento. Devolve { buses (ordem de inserção), ok }. */
function placeBuses(rng, p) {
  const { cols, rows } = p;
  const occ = new Int16Array(cols * rows).fill(-1);
  const buses = [];
  const typeKeys = Object.keys(p.typeWeights);
  const pickType = () => {
    const total = typeKeys.reduce((s, k) => s + p.typeWeights[k], 0);
    let r = rng.next() * total;
    for (const k of typeKeys) if ((r -= p.typeWeights[k]) < 0) return k;
    return typeKeys[0];
  };
  const pathFree = (b) => {
    const { dx, dy } = DIRS[b.dir];
    let x = b.x + dx;
    let y = b.y + dy;
    while (x >= 0 && y >= 0 && x < cols && y < rows) {
      if (occ[y * cols + x] !== -1) return false;
      x += dx;
      y += dy;
    }
    return true;
  };
  const fits = (b) => busCells(b).every((c) => c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows && occ[c.y * cols + c.x] === -1);

  let failures = 0;
  while (buses.length < p.buses && failures < 60) {
    const type = pickType();
    // candidatos válidos; fica com o de maior pontuação (prefere "enterrar" ônibus já livres)
    let best = null;
    for (let k = 0; k < 40; k++) {
      const b = { x: rng.int(0, cols - 1), y: rng.int(0, rows - 1), dir: DIR_KEYS[rng.int(0, 3)], type };
      if (!fits(b) || !pathFree(b)) continue;
      const cells = busCells(b);
      // quantos ônibus já colocados ficariam bloqueados por este
      let blocks = 0;
      for (const o of buses) {
        const { dx, dy } = DIRS[o.dir];
        let x = o.x + dx;
        let y = o.y + dy;
        while (x >= 0 && y >= 0 && x < cols && y < rows) {
          if (cells.some((c) => c.x === x && c.y === y)) {
            blocks++;
            break;
          }
          if (occ[y * cols + x] !== -1) break;
          x += dx;
          y += dy;
        }
      }
      const { dx, dy } = DIRS[b.dir];
      // distância da frente até a borda (ônibus "olhando para dentro" travam mais)
      const toEdge = dx > 0 ? cols - 1 - b.x : dx < 0 ? b.x : dy > 0 ? rows - 1 - b.y : b.y;
      const score = blocks * p.scoreBlock + toEdge * p.scoreDepth + rng.next();
      if (!best || score > best.score) best = { b, score };
    }
    if (!best) {
      failures++;
      continue;
    }
    const b = best.b;
    b.id = buses.length;
    for (const c of busCells(b)) occ[c.y * cols + c.x] = b.id;
    buses.push(b);
  }
  return { buses, ok: buses.length >= Math.max(2, p.buses - 1) };
}

/** Distribui cores: cada cor aparece pelo menos 1 vez; o resto aleatório. */
function assignColors(rng, buses, p) {
  const palette = [];
  const all = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = all.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [all[i], all[j]] = [all[j], all[i]];
  }
  for (let i = 0; i < Math.min(p.colors, buses.length); i++) palette.push(all[i]);
  const order = buses.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((bi, k) => (buses[bi].color = k < palette.length ? palette[k] : palette[rng.int(0, palette.length - 1)]));
}

/**
 * Constrói a fila simulando a ordem O (ids dos ônibus) com as regras do motor.
 * Devolve { queue, boardMove } ou null se a construção falhar.
 *   boardMove[i] = número de toques feitos quando o passageiro i embarcou (na ordem O).
 */
function buildQueue(rng, level, O, p) {
  const capOf = (id) => BUS_TYPES[level.buses[id].type].cap;
  const colorOf = (id) => level.buses[id].color;
  const slots = new Array(level.slots).fill(null); // { bus, filled }
  const queue = [];
  const boardMove = [];
  const seated = () => slots.filter((s) => s && s.filled < capOf(s.bus));
  const seatedColors = () => new Set(seated().map((s) => colorOf(s.bus)));
  // passageiro de cor c embarca no ônibus de menor vaga daquela cor com lugar (igual ao motor)
  const emit = (c, move) => {
    const i = slots.findIndex((s) => s && colorOf(s.bus) === c && s.filled < capOf(s.bus));
    slots[i].filled++;
    queue.push(c);
    boardMove.push(move);
    if (slots[i].filled === capOf(slots[i].bus)) slots[i] = null;
  };

  for (let k = 0; k < O.length; k++) {
    const id = O[k];
    const before = seatedColors();
    const free = slots.indexOf(null);
    if (free === -1) return null;
    slots[free] = { bus: id, filled: 0 };
    const move = k + 1;
    const last = k === O.length - 1;
    // a leva só pode começar se a cor do ônibus novo não estava esperando antes
    // (senão o passageiro já teria embarcado na leva anterior)
    if (before.has(colorOf(id)) && !last) continue;
    let first = true;
    while (seated().length) {
      const colors = seatedColors();
      const next = O[k + 1];
      const occupied = slots.filter(Boolean).length;
      const canStop =
        !last && !first && !colors.has(colorOf(next)) && occupied < level.slots && rng.next() < p.pStop;
      if (canStop) break;
      if (first && !colors.has(colorOf(id))) break; // cor já lotada por embarques anteriores
      let c;
      if (first) c = colorOf(id);
      else if (!last && colors.has(colorOf(next)) && rng.next() < 0.7) c = colorOf(next); // destrava o próximo
      else {
        // prefere ônibus mais antigos nas vagas (enchem e liberam vaga)
        const list = seated();
        const w = list.map((s, i) => 1 + (list.length - i) * p.fifoBias);
        let r = rng.next() * w.reduce((a, b) => a + b, 0);
        let pick = list[0];
        for (let i = 0; i < list.length; i++) if ((r -= w[i]) < 0) {
          pick = list[i];
          break;
        }
        c = colorOf(pick.bus);
      }
      emit(c, move);
      first = false;
      // parada "natural": a leva pode acabar já no 1º passageiro (pStop maior = mais vagas usadas)
      if (!last && !colors.has(colorOf(next)) && rng.next() < p.pStop * 0.5 && slots.filter(Boolean).length < level.slots) {
        if (!seatedColors().has(colorOf(next))) break;
      }
    }
  }
  if (slots.some(Boolean)) return null;
  return { queue, boardMove };
}

/** Metrificação de dificuldade (determinística: usa semente própria). */
export function measure(level, { playouts = 160, seed = 12345 } = {}) {
  const rng = mulberry32(seed);
  const run = (smart) => {
    let s = initialState(level);
    while (s.status === 'playing') {
      const opts = legalExits(level, s, occupancy(level, s));
      if (!opts.length) break;
      let pick = opts[rng.int(0, opts.length - 1)];
      if (smart) {
        // jogador "ingênuo": prefere a cor do passageiro da frente
        const want = level.queue[s.q];
        const m = opts.filter((id) => level.buses[id].color === want);
        if (m.length) pick = m[rng.int(0, m.length - 1)];
      }
      s = tap(level, s, pick).state;
    }
    return s.status === 'won';
  };
  let rw = 0;
  let gw = 0;
  for (let i = 0; i < playouts; i++) {
    if (run(false)) rw++;
    if (run(true)) gw++;
  }
  const randomWin = rw / playouts;
  const greedyWin = gw / playouts;
  // "jogadas erradas possíveis": ao longo da solução, quantos toques legais levam a
  // um estado sem saída (provado pelo solver)
  let traps = 0;
  let options = 0;
  if (level.solution) {
    let s = initialState(level);
    for (const id of level.solution) {
      for (const o of legalExits(level, s)) {
        options++;
        if (!solve(level, { state: tap(level, s, o).state, maxNodes: 40000 }).solvable) traps++;
      }
      s = tap(level, s, id).state;
    }
  }
  const trapRatio = options ? traps / options : 0;
  const colors = new Set(level.buses.map((b) => b.color)).size;
  const score =
    0.45 * level.buses.length +
    0.9 * colors +
    25 * (1 - randomWin) +
    20 * (1 - greedyWin) +
    70 * trapRatio +
    3 * (level.priority?.length ?? 0) +
    2.5 * Math.max(0, 5 - level.slots);
  const r2 = (x) => Math.round(x * 1000) / 1000;
  return { randomWin: r2(randomWin), greedyWin: r2(greedyWin), traps, trapRatio: r2(trapRatio), score: Math.round(score * 100) / 100 };
}

/**
 * Gera UMA fase a partir de parâmetros e semente. Retorna a fase (com solução
 * e métricas) ou null se a tentativa não servir.
 */
export function generateLevel(id, p, seed) {
  const rng = mulberry32(seed);
  const placed = placeBuses(rng, p);
  if (!placed.ok) return null;
  const buses = placed.buses;
  assignColors(rng, buses, p);
  const level = {
    format: LEVEL_FORMAT,
    id,
    cols: p.cols,
    rows: p.rows,
    slots: p.slots,
    challenge: !!p.challenge,
    tutorial: null,
    buses: buses.map((b) => ({ id: b.id, x: b.x, y: b.y, dir: b.dir, type: b.type, color: b.color })),
    queue: [],
    priority: [],
    mechanics: [],
  };
  const O = buses.map((b) => b.id).reverse();
  const built = buildQueue(rng, level, O, p);
  if (!built) return null;
  level.queue = built.queue;

  // prioritários: passageiros que embarcam "tarde" na ordem O (para dar tensão)
  const nPri = p.priority ?? 0;
  const used = new Set();
  for (let k = 0; k < nPri; k++) {
    const lo = Math.floor(level.queue.length * 0.15);
    const hi = Math.floor(level.queue.length * 0.85);
    for (let tries = 0; tries < 20; tries++) {
      const idx = rng.int(lo, Math.max(lo, hi));
      if (used.has(idx)) continue;
      const needed = built.boardMove[idx];
      if (needed < 3) continue;
      used.add(idx);
      level.priority.push({ index: idx, patience: needed + p.prioritySlack });
      break;
    }
  }
  level.priority.sort((a, b) => a.index - b.index);

  if (validateLevel(level).length) return null;
  const sol = solve(level, { maxNodes: p.maxSolverNodes ?? 250000 });
  if (!sol.solvable) return null;
  level.solution = sol.path;
  level.meta = { seed, ...measure(level, { seed: seed ^ 0x5bd1e995 }) };
  // fase trivial demais (vence quase sempre jogando ao acaso) é descartada fora do início
  if (p.maxRandomWin != null && level.meta.randomWin > p.maxRandomWin) return null;
  return level;
}
