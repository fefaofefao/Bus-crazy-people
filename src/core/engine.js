// Motor do jogo: estado, jogadas e regras de vitória/derrota.
// Lógica pura e determinística (sem Phaser, sem Math.random). Usado pela tela
// de jogo, pelo solver, pelo gerador e pelos testes – as regras ficam num só lugar.
//
// FORMATO DA FASE (JSON) – ver docs/LEVEL_FORMAT.md
//   { format, id, cols, rows, slots, challenge, tutorial,
//     buses: [{ id, x, y, dir, type, color }],   // id = índice no array
//     queue: [cor, cor, ...],                    // fila; índice 0 = primeiro passageiro
//     priority: [{ index, patience }],           // passageiros prioritários
//     solution: [busId, ...],                    // ordem de toques que resolve (gravada pelo gerador)
//     mechanics: [], meta: {} }
//
// ESTADO
//   { inLot: Uint8Array (1 = ônibus ainda no estacionamento),
//     slots: Array(slotCount) de null | { bus, filled },
//     q: índice do próximo passageiro na fila, moves: jogadas feitas,
//     status: 'playing' | 'won' | 'lost', reason: null | 'slots' | 'patience' }
//
// REGRAS
//   - Tocar num ônibus com caminho livre até a borda: ele sai e ocupa a vaga livre
//     de menor índice. Caminho bloqueado: avança até o obstáculo e volta ("bate").
//     As duas coisas contam como jogada.
//   - Depois de cada jogada, o passageiro da frente embarca no ônibus da mesma cor
//     com lugar livre (vaga de menor índice), repetidamente. Ônibus cheio parte e
//     libera a vaga.
//   - Vitória: todos os passageiros embarcaram.
//   - Derrota: (a) um prioritário ainda não embarcou e sua paciência acabou
//     (moves >= patience); (b) todas as vagas ocupadas (o da frente não combina
//     com nenhum, senão teria embarcado).

import { DIRS, busCells, busCap, BUS_TYPES, COLORS } from './rules.js';

export const LEVEL_FORMAT = 1;

export function initialState(level, extraSlots = 0) {
  return {
    inLot: new Uint8Array(level.buses.length).fill(1),
    slots: new Array(level.slots + extraSlots).fill(null),
    q: 0,
    moves: 0,
    status: 'playing',
    reason: null,
  };
}

export function cloneState(s) {
  return {
    inLot: s.inLot.slice(),
    slots: s.slots.map((x) => (x ? { bus: x.bus, filled: x.filled } : null)),
    q: s.q,
    moves: s.moves,
    status: s.status,
    reason: s.reason,
  };
}

/** Grade de ocupação: occ[y * cols + x] = id do ônibus ou -1. */
export function occupancy(level, s) {
  const occ = new Int16Array(level.cols * level.rows).fill(-1);
  for (const b of level.buses) {
    if (!s.inLot[b.id]) continue;
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
    if (o !== -1 && o !== bus.id) return { free, blockerId: o };
    free++;
    x += dx;
    y += dy;
  }
  return { free, blockerId: -1 };
}

export const freeSlotIndex = (s) => s.slots.indexOf(null);

/** Ônibus que podem sair agora (caminho livre e vaga disponível). */
export function legalExits(level, s, occ = occupancy(level, s)) {
  if (s.status !== 'playing' || freeSlotIndex(s) === -1) return [];
  const out = [];
  for (const b of level.buses) if (s.inLot[b.id] && scanPath(level, occ, b).blockerId === -1) out.push(b.id);
  return out;
}

/** Paciência restante de cada prioritário que ainda não embarcou. */
export function waitingPriorities(level, s) {
  const out = [];
  for (const p of level.priority || []) if (p.index >= s.q) out.push({ index: p.index, remaining: p.patience - s.moves });
  return out;
}

/** Embarques automáticos + partidas. Altera s e acrescenta eventos. */
function resolveBoarding(level, s, events) {
  const queue = level.queue;
  while (s.q < queue.length) {
    const color = queue[s.q];
    let slot = -1;
    for (let i = 0; i < s.slots.length; i++) {
      const o = s.slots[i];
      if (o && level.buses[o.bus].color === color && o.filled < busCap(level.buses[o.bus])) {
        slot = i;
        break;
      }
    }
    if (slot === -1) break;
    const o = s.slots[slot];
    o.filled++;
    events.push({ type: 'board', passenger: s.q, bus: o.bus, slot, seat: o.filled });
    s.q++;
    if (o.filled === busCap(level.buses[o.bus])) {
      events.push({ type: 'depart', bus: o.bus, slot });
      s.slots[slot] = null;
    }
  }
}

function checkEnd(level, s, events) {
  if (s.q >= level.queue.length) {
    s.status = 'won';
    events.push({ type: 'win' });
    return;
  }
  for (const p of level.priority || []) {
    if (p.index >= s.q && s.moves >= p.patience) {
      s.status = 'lost';
      s.reason = 'patience';
      events.push({ type: 'lose', reason: 'patience', passenger: p.index });
      return;
    }
  }
  if (freeSlotIndex(s) === -1) {
    s.status = 'lost';
    s.reason = 'slots';
    events.push({ type: 'lose', reason: 'slots' });
  }
}

/**
 * Toque num ônibus. Não altera `s`: devolve { state, events, moved }.
 * moved = false quando o toque é ignorado (ônibus já saiu / jogo terminado / sem vaga).
 */
export function tap(level, s, busId, occ = null) {
  const bus = level.buses[busId];
  if (s.status !== 'playing' || !bus || !s.inLot[busId]) return { state: s, events: [], moved: false };
  const slot = freeSlotIndex(s);
  if (slot === -1) return { state: s, events: [], moved: false };
  const n = cloneState(s);
  const events = [];
  const path = scanPath(level, occ ?? occupancy(level, s), bus);
  n.moves++;
  if (path.blockerId !== -1) {
    events.push({ type: 'bump', bus: busId, dist: path.free, blocker: path.blockerId });
  } else {
    n.inLot[busId] = 0;
    n.slots[slot] = { bus: busId, filled: 0 };
    events.push({ type: 'exit', bus: busId, slot });
    resolveBoarding(level, n, events);
  }
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
  k += '|' + s.q + '|';
  for (const o of s.slots) k += o ? `${o.bus}.${o.filled},` : '_,';
  return k + '|' + s.moves;
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
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || cols > 12 || rows > 14) err('grade inválida');
  if (!Number.isInteger(level.slots) || level.slots < 1 || level.slots > 7) err('número de vagas inválido');
  if (!Array.isArray(level.buses) || !level.buses.length) return [...errors, `fase ${level.id}: sem ônibus`];
  const occ = new Int16Array(cols * rows).fill(-1);
  const capByColor = new Array(COLORS.length).fill(0);
  level.buses.forEach((b, i) => {
    if (b.id !== i) err(`ônibus ${i}: id deve ser igual ao índice`);
    if (!DIRS[b.dir]) err(`ônibus ${i}: direção inválida`);
    if (!BUS_TYPES[b.type]) err(`ônibus ${i}: tipo inválido`);
    if (!Number.isInteger(b.color) || b.color < 0 || b.color >= COLORS.length) err(`ônibus ${i}: cor inválida`);
    if (!DIRS[b.dir] || !BUS_TYPES[b.type]) return;
    capByColor[b.color] += busCap(b);
    for (const c of busCells(b)) {
      if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) {
        err(`ônibus ${i}: fora da grade`);
        continue;
      }
      if (occ[c.y * cols + c.x] !== -1) err(`ônibus ${i}: sobrepõe o ônibus ${occ[c.y * cols + c.x]}`);
      occ[c.y * cols + c.x] = i;
    }
  });
  const qByColor = new Array(COLORS.length).fill(0);
  for (const c of level.queue || []) {
    if (!Number.isInteger(c) || c < 0 || c >= COLORS.length) err('cor inválida na fila');
    else qByColor[c]++;
  }
  for (let c = 0; c < COLORS.length; c++)
    if (capByColor[c] !== qByColor[c]) err(`cor ${COLORS[c].key}: ${qByColor[c]} passageiros para ${capByColor[c]} lugares`);
  const seen = new Set();
  for (const p of level.priority || []) {
    if (!Number.isInteger(p.index) || p.index < 0 || p.index >= level.queue.length) err('prioritário com índice inválido');
    if (!Number.isInteger(p.patience) || p.patience < 1) err('paciência inválida');
    if (seen.has(p.index)) err('prioritário repetido');
    seen.add(p.index);
  }
  return errors;
}
