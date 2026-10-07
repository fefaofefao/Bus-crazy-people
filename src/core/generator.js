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
// 3. Filas: a fila única é repartida em pedaços (mesma cor) entre as N filas do
//    ponto, sempre para a fila mais curta – assim todas andam ao longo da partida.
//    A ordem O precisa continuar vencendo com o embarque em rodízio.
// 4. Humor: simula a ordem O e mede a maior espera de cada fila; `calm` = essa
//    espera + 1 + folga. Logo, seguindo O todas as filas terminam felizes (3 ★).
// 5. Prioritários: escolhidos nas filas; a paciência = momento em que embarcam na
//    ordem O + uma folga.
// 6. O solver confirma que há solução sem boosters (o gerador rejeita o resto) e
//    as métricas de dificuldade são calculadas (ver measure()).

import { mulberry32 } from './prng.js';
import { DIRS, DIR_KEYS, BUS_TYPES, busCells } from './rules.js';
import { LEVEL_FORMAT, replay, initialState, tap, legalExits, occupancy, validateLevel, scanPath, isLocked, spawnFromGarages, garageSpawnPos, frontColors, happyLines, linesOf, OCC_FREE } from './engine.js';
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
        // jogador "ingênuo": prefere a cor de algum passageiro da frente
        const want = frontColors(level, s);
        const m = opts.filter((id) => want.includes(level.buses[id].color));
        if (m.length) pick = m[rng.int(0, m.length - 1)];
      }
      s = tap(level, s, pick).state;
    }
    return s.status !== 'won' ? false : happyLines(s) === nLines ? 3 : true;
  };
  let rw = 0;
  let gw = 0;
  let g3 = 0; // vitórias do ingênuo com todas as filas felizes (3 estrelas)
  const nLines = linesOf(level).length;
  for (let i = 0; i < playouts; i++) {
    if (run(false)) rw++;
    const r = run(true);
    if (r) gw++;
    if (r === 3) g3++;
  }
  const randomWin = rw / playouts;
  const greedyWin = gw / playouts;
  // "jogadas erradas possíveis": ao longo da solução, quantos toques legais levam a
  // um estado sem saída (provado pelo solver) – armadilhas; e quantos, mesmo
  // vencíveis, já não deixam terminar com todas as filas felizes – armadilhas de estrela
  let traps = 0;
  let starTraps = 0;
  let options = 0;
  if (level.solution) {
    let s = initialState(level);
    for (const id of level.solution) {
      for (const o of legalExits(level, s)) {
        options++;
        const n = tap(level, s, o).state;
        if (!solve(level, { state: n, maxNodes: 40000 }).solvable) traps++;
        else if (o !== id && !solve(level, { state: n, maxNodes: 20000, keepHappy: true }).solvable) starTraps++;
      }
      s = tap(level, s, id).state;
    }
  }
  const trapRatio = options ? traps / options : 0;
  const starTrapRatio = options ? starTraps / options : 0;
  const greedy3 = g3 / playouts;
  const colors = new Set(level.buses.map((b) => b.color)).size;
  const score =
    0.45 * level.buses.length +
    0.9 * colors +
    12 * (1 - randomWin) +
    38 * (1 - greedyWin) +
    120 * trapRatio +
    40 * starTrapRatio +
    10 * (1 - greedy3) +
    3 * (level.priority?.length ?? 0) +
    1.5 * (level.mechanics?.length ?? 0) +
    2.5 * Math.max(0, 5 - level.slots);
  const r2 = (x) => Math.round(x * 1000) / 1000;
  return {
    randomWin: r2(randomWin),
    greedyWin: r2(greedyWin),
    greedy3: r2(greedy3),
    traps,
    trapRatio: r2(trapRatio),
    starTraps,
    starTrapRatio: r2(starTrapRatio),
    score: Math.round(score * 100) / 100,
  };
}

/**
 * Gera UMA fase a partir de parâmetros e semente. Retorna a fase (com solução
 * e métricas) ou null se a tentativa não servir.
 */
/**
 * Mecânicas (ver src/core/engine.js). p.mech = { hidden, cones, locks, garages }
 * com a quantidade de cada uma. Ônibus dos terminais são acrescentados ao fim de buses.
 */
function addMechanics(rng, level, p) {
  const m = p.mech || {};
  const { cols, rows } = level;
  const occ = () => {
    const o = new Int16Array(cols * rows).fill(OCC_FREE);
    for (const g of level.garages) o[g.y * cols + g.x] = -2;
    for (const c of level.cones) o[c.y * cols + c.x] = -3;
    for (const b of level.buses) if (b.garage == null) for (const c of busCells(b)) o[c.y * cols + c.x] = b.id;
    return o;
  };
  const emptyCells = () => {
    const o = occ();
    const out = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (o[y * cols + x] === OCC_FREE) out.push({ x, y });
    return out;
  };
  // terminais: ficam numa casa vazia e soltam 2–3 ônibus pequenos/médios
  for (let g = 0; g < (m.garages || 0); g++) {
    const cells = emptyCells();
    for (let tries = 0; tries < 30 && cells.length; tries++) {
      const c = cells[rng.int(0, cells.length - 1)];
      const dir = DIR_KEYS[rng.int(0, 3)];
      const n = rng.int(2, 3);
      const types = Array.from({ length: n }, () => (rng.next() < 0.35 ? 'medium' : 'small'));
      const gar = { id: level.garages.length, x: c.x, y: c.y, dir };
      const ok = types.every((type) => busCells({ ...garageSpawnPos(gar, type), type }).every((q) => q.x >= 0 && q.y >= 0 && q.x < cols && q.y < rows));
      if (!ok) continue;
      level.garages.push(gar);
      for (const type of types) level.buses.push({ id: level.buses.length, ...garageSpawnPos(gar, type), type, color: 0, garage: gar.id });
      break;
    }
  }
  // obras: cones em casas vazias, terminam numa jogada entre 2 e ~metade dos ônibus
  for (let k = 0; k < (m.cones || 0); k++) {
    const cells = emptyCells();
    if (!cells.length) break;
    const c = cells[rng.int(0, cells.length - 1)];
    level.cones.push({ x: c.x, y: c.y, until: rng.int(2, Math.max(3, Math.floor(level.buses.length * 0.5))) });
  }
  // cadeados: um ônibus trancado por outro (a chave)
  const lot = level.buses.filter((b) => b.garage == null);
  for (let k = 0; k < (m.locks || 0) && lot.length > 3; k++) {
    const a = lot[rng.int(0, lot.length - 1)];
    const b = lot[rng.int(0, lot.length - 1)];
    if (a === b || a.lock != null || b.lock != null || level.buses.some((x) => x.lock === a.id)) continue;
    a.lock = b.id;
  }
  // cobertos: cor escondida até o caminho ficar livre
  const pool = level.buses.filter((b) => b.lock == null);
  for (let k = 0; k < (m.hidden || 0) && pool.length; k++) pool.splice(rng.int(0, pool.length - 1), 1)[0].hidden = true;
}

/**
 * Ordem viável de saída do estacionamento (sem olhar a fila): simula as regras do
 * lote (cadeados, cones por jogada, terminais) preferindo a ordem inversa de
 * inserção, que "enterra" os ônibus. null = trava (fase descartada).
 */
function feasibleOrder(rng, level, rank) {
  const s = initialState(level, 99);
  const O = [];
  const total = level.buses.length;
  while (O.length < total) {
    const occ = occupancy(level, s);
    const free = level.buses.filter((b) => s.inLot[b.id] === 1 && !isLocked(level, s, b) && scanPath(level, occ, b).blockerId === -1);
    if (!free.length) return null;
    free.sort((a, b) => rank(b) - rank(a));
    const pick = rng.next() < 0.8 ? free[0] : free[rng.int(0, free.length - 1)];
    s.inLot[pick.id] = 0;
    s.moves++;
    O.push(pick.id);
    spawnFromGarages(level, s, []);
  }
  return O;
}

/**
 * Reparte a fila única em `n` filas: pedaços de 1–3 passageiros da mesma cor vão
 * para a fila mais curta (empate: sorteio). Devolve as filas.
 */
export function dealLines(rng, queue, n, map = null, maxChunk = 3) {
  if (n <= 1) {
    if (map) queue.forEach((_, i) => (map[i] = [0, i]));
    return [queue.slice()];
  }
  const lines = Array.from({ length: n }, () => []);
  let i = 0;
  while (i < queue.length) {
    let len = 1;
    const max = rng.int(1, maxChunk);
    while (len < max && i + len < queue.length && queue[i + len] === queue[i]) len++;
    const min = Math.min(...lines.map((l) => l.length));
    const cands = lines.map((l, k) => k).filter((k) => lines[k].length <= min + 1);
    const k = cands[rng.int(0, cands.length - 1)];
    for (let j = 0; j < len; j++) {
      if (map) map[i + j] = [k, lines[k].length];
      lines[k].push(queue[i + j]);
    }
    i += len;
  }
  // filas vazias (fila muito curta) somem; os índices do mapa acompanham
  const keep = lines.map((l, k) => k).filter((k) => lines[k].length);
  if (map) for (const m of map) m[0] = keep.indexOf(m[0]);
  return keep.map((k) => lines[k]);
}

/**
 * Simula a ordem O e mede, por fila, a maior espera (jogadas seguidas sem
 * embarcar) e em que jogada cada passageiro embarcou.
 * Devolve { won, maxWait, boardMove: [[jogada, ...] por fila] }.
 */
export function simulateOrder(level, O) {
  const lv = { ...level, calm: 1e9 };
  let s = initialState(lv);
  const boardMove = linesOf(lv).map((l) => new Array(l.length).fill(0));
  let maxWait = 0;
  O.forEach((id, k) => {
    const r = tap(lv, s, id);
    s = r.state;
    for (const e of r.events) if (e.type === 'board') boardMove[e.line][e.passenger] = k + 1;
    maxWait = Math.max(maxWait, ...s.wait);
  });
  return { won: s.status === 'won', maxWait, boardMove };
}

/** A sequência de toques não tem nenhuma batida? */
function noBumps(level, path) {
  let s = initialState(level);
  for (const id of path) {
    const r = tap(level, s, id);
    if (r.events.some((e) => e.type === 'bump')) return false;
    s = r.state;
  }
  return true;
}

/** Paciência das filas para a ordem O deixar todas felizes, mais uma folga. */
export const calmFor = (maxWait, slack) => Math.max(2, maxWait + 1 + slack);

export function generateLevel(id, p, seed) {
  const rng = mulberry32(seed);
  const placed = placeBuses(rng, p);
  if (!placed.ok) return null;
  const level = {
    format: LEVEL_FORMAT,
    id,
    cols: p.cols,
    rows: p.rows,
    slots: p.slots,
    challenge: !!p.challenge,
    tutorial: null,
    buses: placed.buses.map((b) => ({ id: b.id, x: b.x, y: b.y, dir: b.dir, type: b.type, color: 0 })),
    queue: [],
    lines: [],
    calm: 0,
    priority: [],
    cones: [],
    garages: [],
    mechanics: [],
  };
  addMechanics(rng, level, p);
  assignColors(rng, level.buses, p);
  // ônibus de terminal: rank alto (saem assim que podem); os demais: ordem inversa de inserção
  const O = feasibleOrder(rng, level, (b) => (b.garage != null ? 1000 - b.id : b.id));
  if (!O) return null;
  const built = buildQueue(rng, level, O, p);
  if (!built) return null;
  // filas: várias repartições; fica a que a ordem O vence com a menor espera máxima
  const nLines = p.lines ?? 1;
  let best = null;
  for (let k = 0; k < (nLines > 1 ? 6 : 1); k++) {
    const lines = dealLines(rng, built.queue, nLines, null, p.dealMax ?? 3);
    const sim = simulateOrder({ ...level, lines }, O);
    if (sim.won && (!best || sim.maxWait < best.sim.maxWait)) best = { lines, sim };
  }
  if (!best) return null;
  delete level.queue;
  level.lines = best.lines;
  // paciência mais apertada que ainda permite deixar todas as filas felizes
  // (pode ser menor que a da ordem O: o solver procura outra ordem) + folga
  let tight = calmFor(best.sim.maxWait, 0);
  let happyPath = O;
  for (let c = tight - 1; c >= 2 && p.tightCalm !== false; c--) {
    const r = solve({ ...level, calm: c }, { keepHappy: true, maxNodes: 60000 });
    if (!r.solvable || !noBumps({ ...level, calm: c }, r.path)) break;
    tight = c;
    happyPath = r.path;
  }
  level.calm = tight + (p.calmSlack ?? 2);
  // limpa campos vazios e registra as mecânicas presentes
  if (!level.cones.length) delete level.cones;
  if (!level.garages.length) delete level.garages;
  const has = (k) => level.buses.some((b) => b[k] != null && b[k] !== false);
  level.mechanics = ['hidden', 'lock', 'garage'].filter(has);
  if (level.cones) level.mechanics.push('cones');

  // prioritários: passageiros que embarcam "tarde" na ordem O (para dar tensão)
  const nPri = p.priority ?? 0;
  const used = new Set();
  for (let k = 0; k < nPri; k++) {
    for (let tries = 0; tries < 20; tries++) {
      const line = rng.int(0, level.lines.length - 1);
      const len = level.lines[line].length;
      const lo = Math.floor(len * 0.15);
      const idx = rng.int(lo, Math.max(lo, Math.floor(len * 0.85)));
      if (used.has(`${line}.${idx}`)) continue;
      const needed = best.sim.boardMove[line][idx];
      if (needed < 3) continue;
      used.add(`${line}.${idx}`);
      level.priority.push({ line, index: idx, patience: needed + p.prioritySlack });
      break;
    }
  }
  level.priority.sort((a, b) => a.line - b.line || a.index - b.index);

  if (validateLevel(level).length) return null;
  const sol = solve(level, { maxNodes: p.maxSolverNodes ?? 250000 });
  if (!sol.solvable) return null;
  // solução gravada = ordem pretendida (sem nenhuma batida: prova que 3 estrelas são possíveis);
  // se por algum motivo ela não vencer, fica a do solver
  const final = replay(level, happyPath);
  if (final.status !== 'won' || happyLines(final) !== level.lines.length) return null;
  level.solution = happyPath;
  level.meta = { seed, ...measure(level, { seed: seed ^ 0x5bd1e995 }) };
  // fase trivial demais (vence quase sempre jogando ao acaso) é descartada fora do início
  if (p.maxRandomWin != null && level.meta.randomWin > p.maxRandomWin) return null;
  return level;
}
