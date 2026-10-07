// Motor do jogo: estado, jogadas e regras de vitória/derrota.
// Lógica pura e determinística (sem Phaser, sem Math.random). Usado pela tela
// de jogo, pelo solver, pelo gerador e pelos testes – as regras ficam num só lugar.
//
// FORMATO DA FASE (JSON) – ver docs/LEVEL_FORMAT.md
//   { format, id, cols, rows, slots, challenge, tutorial,
//     buses: [{ id, x, y, dir, type, color,          // id = índice no array
//               hidden?, lock?, garage? }],          // mecânicas (abaixo)
//     lines: [[cor, ...], ...],                      // filas do ponto (ou `queue` = 1 fila só)
//     calm: n,                                       // paciência das filas (jogadas, ver HUMOR)
//     priority: [{ line, index, patience }],
//     cones: [{ x, y, until }], garages: [{ id, x, y, dir }],
//     solution: [busId, ...], mechanics: [...], meta: {} }
//
// MECÂNICAS
//   - hidden  (ônibus coberto): a cor fica escondida na tela até o caminho dele
//     ficar livre. Não muda as regras (só a informação mostrada).
//   - lock    (cadeado): o ônibus só sai depois que o ônibus-chave (id em `lock`)
//     tiver saído do estacionamento. Antes disso, tocar nele "bate" (conta jogada).
//   - cones   (obra): a casa fica bloqueada enquanto moves < until.
//   - garages (terminal): casa fixa que bloqueia passagem e solta, um de cada vez,
//     os ônibus com `garage = id` (na ordem do array) assim que as casas à frente
//     ficam livres. O ônibus nasce apontando para fora do terminal.
//
// ESTADO
//   { inLot: Uint8Array (0 = já saiu, 1 = no estacionamento, 2 = esperando no terminal),
//     slots: Array(slotCount) de null | { bus, filled },
//     q: [próximo passageiro de cada fila], moves: jogadas feitas,
//     wait: [jogadas seguidas sem embarque, por fila], mood: [humor de cada fila],
//     status: 'playing' | 'won' | 'lost', reason: null | 'slots' | 'patience' | 'stuck' }
//
// REGRAS
//   - Tocar num ônibus com caminho livre até a borda: ele sai e ocupa a vaga livre
//     de menor índice. Caminho bloqueado (ou cadeado): "bate". Os dois contam jogada.
//   - Depois de cada jogada, embarques em rodízio: fila 0, 1, 2, 0, 1… – o primeiro
//     de cada fila embarca no ônibus da mesma cor com lugar (vaga de menor índice);
//     a rodada se repete até ninguém mais embarcar. Ônibus cheio parte. Depois os
//     terminais soltam ônibus, se houver espaço.
//   - Vitória: todas as filas esvaziaram.
//
// HUMOR DAS FILAS (define as estrelas – ver src/core/stars.js)
//   Cada fila começa FELIZ (2). A cada jogada (batidas incluídas) em que uma fila
//   com gente não embarca ninguém, a espera dela sobe 1; embarcar zera a espera.
//   Quando a espera chega a `calm`, a fila piora um nível (feliz -> impaciente ->
//   nervosa) e a espera recomeça. O humor nunca melhora. Fila vazia não muda mais.
//   - Derrota: (a) prioritário sem embarcar com a paciência esgotada (moves >= patience);
//     (b) todas as vagas ocupadas (nenhum ônibus serve para a frente de nenhuma fila); (c) nenhum ônibus pode sair e nada vai mudar
//     (sem obra para terminar).

import { DIRS, busCells, busCap, busLen, BUS_TYPES, COLORS } from './rules.js';

export const LEVEL_FORMAT = 1;

// Valores especiais na grade de ocupação
export const OCC_FREE = -1;
export const OCC_GARAGE = -2;
export const OCC_CONE = -3;
export const BLOCK_LOCK = -4; // "bloqueador" de uma batida por cadeado

// Humor das filas
export const MOOD_HAPPY = 2;
export const MOOD_ANNOYED = 1;
export const MOOD_ANGRY = 0;
export const DEFAULT_CALM = 6;

/** Filas da fase: `lines` ou, no formato antigo, `[queue]`. */
export const linesOf = (level) => level.lines ?? [level.queue ?? []];
export const calmOf = (level) => level.calm ?? DEFAULT_CALM;
/** Total de passageiros já embarcados. */
export const boardedCount = (s) => s.q.reduce((a, b) => a + b, 0);
/** Passageiro da frente de cada fila (cor), ou -1 se a fila acabou. */
export function frontColors(level, s) {
  return linesOf(level).map((line, i) => (s.q[i] < line.length ? line[s.q[i]] : -1));
}
/** Quantas filas terminaram (ou estão) felizes. */
export const happyLines = (s) => s.mood.filter((m) => m === MOOD_HAPPY).length;

export function initialState(level, extraSlots = 0) {
  const n = linesOf(level).length;
  const s = {
    inLot: new Uint8Array(level.buses.length),
    slots: new Array(level.slots + extraSlots).fill(null),
    q: new Array(n).fill(0),
    wait: new Array(n).fill(0),
    mood: new Array(n).fill(MOOD_HAPPY),
    moves: 0,
    status: 'playing',
    reason: null,
  };
  for (const b of level.buses) s.inLot[b.id] = b.garage != null ? 2 : 1;
  spawnFromGarages(level, s, []);
  return s;
}

export function cloneState(s) {
  return {
    inLot: s.inLot.slice(),
    slots: s.slots.map((x) => (x ? { bus: x.bus, filled: x.filled } : null)),
    q: s.q.slice(),
    wait: s.wait.slice(),
    mood: s.mood.slice(),
    moves: s.moves,
    status: s.status,
    reason: s.reason,
  };
}

export const coneActive = (c, s) => s.moves < c.until;

/** Grade de ocupação: id do ônibus, OCC_FREE, OCC_GARAGE ou OCC_CONE. */
export function occupancy(level, s) {
  const occ = new Int16Array(level.cols * level.rows).fill(OCC_FREE);
  for (const g of level.garages || []) occ[g.y * level.cols + g.x] = OCC_GARAGE;
  for (const c of level.cones || []) if (coneActive(c, s)) occ[c.y * level.cols + c.x] = OCC_CONE;
  for (const b of level.buses) {
    if (s.inLot[b.id] !== 1) continue;
    for (const c of busCells(b)) occ[c.y * level.cols + c.x] = b.id;
  }
  return occ;
}

/** Casas livres à frente do ônibus e quem bloqueia (-1 = caminho livre até a borda). */
export function scanPath(level, occ, bus) {
  const { dx, dy } = DIRS[bus.dir];
  let x = bus.x + dx;
  let y = bus.y + dy;
  let free = 0;
  while (x >= 0 && y >= 0 && x < level.cols && y < level.rows) {
    const o = occ[y * level.cols + x];
    if (o !== OCC_FREE && o !== bus.id) return { free, blockerId: o };
    free++;
    x += dx;
    y += dy;
  }
  return { free, blockerId: -1 };
}

/** O ônibus está trancado (a chave ainda não saiu)? */
export const isLocked = (level, s, bus) => bus.lock != null && s.inLot[bus.lock] !== 0;

export const freeSlotIndex = (s) => s.slots.indexOf(null);

/** Ônibus que podem sair agora (caminho livre, sem cadeado e com vaga disponível). */
export function legalExits(level, s, occ = occupancy(level, s)) {
  if (s.status !== 'playing' || freeSlotIndex(s) === -1) return [];
  const out = [];
  for (const b of level.buses) {
    if (s.inLot[b.id] !== 1 || isLocked(level, s, b)) continue;
    if (scanPath(level, occ, b).blockerId === -1) out.push(b.id);
  }
  return out;
}

const priWaiting = (p, s) => p.index >= s.q[p.line ?? 0];

/** Paciência restante de cada prioritário que ainda não embarcou. */
export function waitingPriorities(level, s) {
  const out = [];
  for (const p of level.priority || []) if (priWaiting(p, s)) out.push({ line: p.line ?? 0, index: p.index, remaining: p.patience - s.moves });
  return out;
}

/** Terminais soltam o próximo ônibus se as casas dele estiverem livres. */
export function spawnFromGarages(level, s, events) {
  if (!level.garages?.length) return;
  let occ = occupancy(level, s);
  for (const g of level.garages) {
    const next = level.buses.find((b) => b.garage === g.id && s.inLot[b.id] === 2);
    if (!next) continue;
    if (busCells(next).every((c) => occ[c.y * level.cols + c.x] === OCC_FREE)) {
      s.inLot[next.id] = 1;
      events.push({ type: 'spawn', bus: next.id, garage: g.id });
      occ = occupancy(level, s);
    }
  }
}

/** Embarques automáticos (rodízio entre as filas) + partidas. Altera s, devolve as filas atendidas. */
function resolveBoarding(level, s, events) {
  const lines = linesOf(level);
  const served = new Array(lines.length).fill(false);
  let any = true;
  while (any) {
    any = false;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (s.q[li] >= line.length) continue;
      const color = line[s.q[li]];
      let slot = -1;
      for (let i = 0; i < s.slots.length; i++) {
        const o = s.slots[i];
        if (o && level.buses[o.bus].color === color && o.filled < busCap(level.buses[o.bus])) {
          slot = i;
          break;
        }
      }
      if (slot === -1) continue;
      const o = s.slots[slot];
      o.filled++;
      events.push({ type: 'board', line: li, passenger: s.q[li], bus: o.bus, slot, seat: o.filled });
      s.q[li]++;
      served[li] = true;
      any = true;
      if (o.filled === busCap(level.buses[o.bus])) {
        events.push({ type: 'depart', bus: o.bus, slot });
        s.slots[slot] = null;
      }
    }
  }
  return served;
}

/** Humor: filas com gente que não embarcaram nesta jogada esperam mais um pouco. */
function updateMoods(level, s, served, events) {
  const lines = linesOf(level);
  const calm = calmOf(level);
  for (let li = 0; li < lines.length; li++) {
    if (served[li]) {
      s.wait[li] = 0;
      continue;
    }
    if (s.q[li] >= lines[li].length) continue;
    s.wait[li]++;
    if (s.wait[li] >= calm) {
      s.wait[li] = 0;
      if (s.mood[li] > MOOD_ANGRY) {
        s.mood[li]--;
        events.push({ type: 'mood', line: li, mood: s.mood[li] });
      }
    }
  }
}

function checkEnd(level, s, events) {
  if (linesOf(level).every((line, i) => s.q[i] >= line.length)) {
    s.status = 'won';
    events.push({ type: 'win' });
    return;
  }
  const lose = (reason, extra = {}) => {
    s.status = 'lost';
    s.reason = reason;
    events.push({ type: 'lose', reason, ...extra });
  };
  for (const p of level.priority || []) if (priWaiting(p, s) && s.moves >= p.patience) return lose('patience', { line: p.line ?? 0, passenger: p.index });
  if (freeSlotIndex(s) === -1) return lose('slots');
  // travado: nenhum ônibus sai e nenhuma obra vai terminar (esperar não adianta)
  if (!legalExits(level, s).length && !(level.cones || []).some((c) => coneActive(c, s))) lose('stuck');
}

/**
 * Toque num ônibus. Não altera `s`: devolve { state, events, moved }.
 * moved = false quando o toque é ignorado (ônibus fora do estacionamento / jogo terminado / sem vaga).
 */
export function tap(level, s, busId, occ = null) {
  const bus = level.buses[busId];
  if (s.status !== 'playing' || !bus || s.inLot[busId] !== 1) return { state: s, events: [], moved: false };
  const slot = freeSlotIndex(s);
  if (slot === -1) return { state: s, events: [], moved: false };
  const n = cloneState(s);
  const events = [];
  n.moves++;
  let served = null;
  if (isLocked(level, s, bus)) {
    events.push({ type: 'bump', bus: busId, dist: 0, blocker: BLOCK_LOCK, key: bus.lock });
  } else {
    const path = scanPath(level, occ ?? occupancy(level, s), bus);
    if (path.blockerId !== -1) {
      events.push({ type: 'bump', bus: busId, dist: path.free, blocker: path.blockerId });
    } else {
      n.inLot[busId] = 0;
      n.slots[slot] = { bus: busId, filled: 0 };
      events.push({ type: 'exit', bus: busId, slot });
      for (const b of level.buses) if (b.lock === busId && n.inLot[b.id]) events.push({ type: 'unlock', bus: b.id });
      served = resolveBoarding(level, n, events);
    }
  }
  updateMoods(level, n, served ?? [], events);
  if ((level.cones || []).some((c) => c.until === n.moves)) events.push({ type: 'cones' });
  spawnFromGarages(level, n, events);
  checkEnd(level, n, events);
  return { state: n, events, moved: true };
}

/** Booster "vaga extra": acrescenta uma vaga (vale só para esta partida). */
export function addSlot(level, s) {
  const n = cloneState(s);
  n.slots.push(null);
  if (n.status === 'lost' && n.reason === 'slots') {
    n.status = 'playing';
    n.reason = null;
  }
  return n;
}

/** Reproduz uma sequência de toques a partir do início. */
export function replay(level, taps, extraSlots = 0) {
  let s = initialState(level, extraSlots);
  for (const id of taps) s = tap(level, s, id).state;
  return s;
}

/** Chave compacta do estado (para memorização no solver). */
export function stateKey(s) {
  let k = '';
  for (let i = 0; i < s.inLot.length; i++) k += s.inLot[i];
  k += '|' + s.q.join('.') + '|';
  for (const o of s.slots) k += o ? `${o.bus}.${o.filled},` : '_,';
  return k + '|' + s.moves;
}

/** Casas que um ônibus do terminal ocupa ao nascer (frente a `len` casas do terminal). */
export function garageSpawnPos(g, type) {
  const { dx, dy } = DIRS[g.dir];
  const len = BUS_TYPES[type].len;
  return { x: g.x + dx * len, y: g.y + dy * len, dir: g.dir };
}

/**
 * Confere a estrutura de uma fase. Devolve a lista de erros (vazia = ok).
 * Também garante que a soma das capacidades por cor = passageiros daquela cor.
 */
export function validateLevel(level) {
  const errors = [];
  const err = (m) => errors.push(`fase ${level?.id}: ${m}`);
  if (!level || level.format !== LEVEL_FORMAT) return [`fase ${level?.id}: formato inválido`];
  const { cols, rows } = level;
  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < cols && y < rows;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || cols > 12 || rows > 14) err('grade inválida');
  if (!Number.isInteger(level.slots) || level.slots < 1 || level.slots > 7) err('número de vagas inválido');
  if (!Array.isArray(level.buses) || !level.buses.length) return [...errors, `fase ${level.id}: sem ônibus`];
  const occ = new Int16Array(cols * rows).fill(-1);
  const garages = level.garages || [];
  garages.forEach((g, i) => {
    if (g.id !== i) err(`terminal ${i}: id deve ser igual ao índice`);
    if (!DIRS[g.dir]) err(`terminal ${i}: direção inválida`);
    if (!inside(g.x, g.y)) return err(`terminal ${i}: fora da grade`);
    if (occ[g.y * cols + g.x] !== -1) err(`terminal ${i}: casa repetida`);
    occ[g.y * cols + g.x] = 1000 + i;
  });
  for (const c of level.cones || []) {
    if (!inside(c.x, c.y)) {
      err('cone fora da grade');
      continue;
    }
    if (!Number.isInteger(c.until) || c.until < 1) err('cone com "until" inválido');
    if (occ[c.y * cols + c.x] !== -1) err('cone em casa ocupada');
    occ[c.y * cols + c.x] = 2000;
  }
  const capByColor = new Array(COLORS.length).fill(0);
  level.buses.forEach((b, i) => {
    if (b.id !== i) err(`ônibus ${i}: id deve ser igual ao índice`);
    if (!DIRS[b.dir]) err(`ônibus ${i}: direção inválida`);
    if (!BUS_TYPES[b.type]) err(`ônibus ${i}: tipo inválido`);
    if (!Number.isInteger(b.color) || b.color < 0 || b.color >= COLORS.length) err(`ônibus ${i}: cor inválida`);
    if (!DIRS[b.dir] || !BUS_TYPES[b.type]) return;
    capByColor[b.color] += busCap(b);
    if (b.lock != null) {
      if (!Number.isInteger(b.lock) || !level.buses[b.lock] || b.lock === i) err(`ônibus ${i}: cadeado com chave inválida`);
      // sem ciclos de cadeado
      let k = b.lock;
      for (let steps = 0; k != null && steps <= level.buses.length; steps++) {
        if (k === i) {
          err(`ônibus ${i}: ciclo de cadeados`);
          break;
        }
        k = level.buses[k]?.lock;
      }
    }
    const cells = busCells(b);
    if (b.garage != null) {
      const g = garages[b.garage];
      if (!g) return err(`ônibus ${i}: terminal inexistente`);
      const p = garageSpawnPos(g, b.type);
      if (p.x !== b.x || p.y !== b.y || p.dir !== b.dir) err(`ônibus ${i}: posição não bate com o terminal`);
      for (const c of cells) if (!inside(c.x, c.y)) err(`ônibus ${i}: nasce fora da grade`);
      return; // ônibus do terminal podem "sobrepor" casas: só nascem quando elas ficam livres
    }
    for (const c of cells) {
      if (!inside(c.x, c.y)) {
        err(`ônibus ${i}: fora da grade`);
        continue;
      }
      if (occ[c.y * cols + c.x] !== -1) err(`ônibus ${i}: sobrepõe outra peça`);
      occ[c.y * cols + c.x] = i;
    }
  });
  const qByColor = new Array(COLORS.length).fill(0);
  const lines = level.lines ?? [level.queue ?? []];
  if (!Array.isArray(lines) || !lines.length || lines.length > 4 || lines.some((l) => !Array.isArray(l) || !l.length)) err('filas inválidas');
  if (level.calm != null && (!Number.isInteger(level.calm) || level.calm < 1)) err('"calm" inválido');
  for (const line of lines)
    for (const c of line || []) {
      if (!Number.isInteger(c) || c < 0 || c >= COLORS.length) err('cor inválida na fila');
      else qByColor[c]++;
    }
  for (let c = 0; c < COLORS.length; c++)
    if (capByColor[c] !== qByColor[c]) err(`cor ${COLORS[c].key}: ${qByColor[c]} passageiros para ${capByColor[c]} lugares`);
  const seen = new Set();
  for (const p of level.priority || []) {
    const li = p.line ?? 0;
    if (!lines[li] || !Number.isInteger(p.index) || p.index < 0 || p.index >= lines[li].length) err('prioritário com índice inválido');
    if (!Number.isInteger(p.patience) || p.patience < 1) err('paciência inválida');
    if (seen.has(`${li}.${p.index}`)) err('prioritário repetido');
    seen.add(`${li}.${p.index}`);
  }
  return errors;
}

export { busLen };
