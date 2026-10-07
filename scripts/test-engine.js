// Testes das regras do motor (src/core/engine.js) e do solver.
// Uso: npm run test:engine

import assert from 'node:assert/strict';
import { initialState, tap, addSlot, validateLevel, replay, LEVEL_FORMAT, garageSpawnPos, happyLines, MOOD_HAPPY, MOOD_ANNOYED, MOOD_ANGRY } from '../src/core/engine.js';
import { starsFor } from '../src/core/stars.js';
import { solve, nextMove } from '../src/core/solver.js';

const L = (o) => ({ format: LEVEL_FORMAT, id: 0, challenge: false, tutorial: null, priority: [], mechanics: [], ...o, buses: o.buses.map((b, id) => ({ id, ...b })) });
let n = 0;
const test = (name, fn) => {
  fn();
  n++;
  console.log('  ✓ ' + name);
};

// Fase base: vermelho (0) bloqueia azul (1); azul aponta para cima, vermelho sai pela direita.
const base = L({
  cols: 3,
  rows: 5,
  slots: 2,
  buses: [
    { x: 1, y: 1, dir: 'right', type: 'small', color: 0 },
    { x: 1, y: 3, dir: 'up', type: 'small', color: 1 },
  ],
  queue: [1, 1, 1, 1, 0, 0, 0, 0],
});

test('fase válida passa na validação', () => assert.deepEqual(validateLevel(base), []));

test('passageiros ≠ lugares é rejeitado', () => assert.ok(validateLevel({ ...base, queue: [0, 0, 0] }).length > 0));

test('ônibus bloqueado bate, conta jogada e não sai', () => {
  const r = tap(base, initialState(base), 1);
  assert.equal(r.events[0].type, 'bump');
  assert.equal(r.events[0].blocker, 0);
  assert.equal(r.state.moves, 1);
  assert.equal(r.state.inLot[1], 1);
});

test('ônibus livre sai para a vaga de menor índice e espera sem passageiros da cor', () => {
  const r = tap(base, initialState(base), 0);
  assert.equal(r.events[0].type, 'exit');
  assert.equal(r.events[0].slot, 0);
  assert.equal(r.state.slots[0].bus, 0);
  assert.deepEqual(r.state.q, [0]); // a frente é azul: ninguém embarca
});

test('embarque automático, partida ao lotar e vitória', () => {
  let s = tap(base, initialState(base), 0).state;
  const r = tap(base, s, 1);
  const types = r.events.map((e) => e.type);
  assert.deepEqual(types, ['exit', 'board', 'board', 'board', 'board', 'depart', 'board', 'board', 'board', 'board', 'depart', 'win']);
  assert.equal(r.state.status, 'won');
});

test('derrota quando todas as vagas lotam sem combinar', () => {
  const lv = L({
    cols: 3,
    rows: 3,
    slots: 1,
    buses: [
      { x: 0, y: 0, dir: 'up', type: 'small', color: 0 },
      { x: 2, y: 0, dir: 'up', type: 'small', color: 1 },
    ],
    queue: [1, 1, 1, 1, 0, 0, 0, 0],
  });
  const r = tap(lv, initialState(lv), 0);
  assert.equal(r.state.status, 'lost');
  assert.equal(r.state.reason, 'slots');
});

test('vaga extra (booster) tira da derrota por vagas', () => {
  const lv = L({
    cols: 3,
    rows: 3,
    slots: 1,
    buses: [
      { x: 0, y: 0, dir: 'up', type: 'small', color: 0 },
      { x: 2, y: 0, dir: 'up', type: 'small', color: 1 },
    ],
    queue: [1, 1, 1, 1, 0, 0, 0, 0],
  });
  let s = tap(lv, initialState(lv), 0).state;
  s = addSlot(lv, s);
  assert.equal(s.status, 'playing');
  s = tap(lv, s, 1).state;
  assert.equal(s.status, 'won');
});

test('prioritário: perde quando a paciência acaba', () => {
  const lv = { ...base, slots: 3, priority: [{ index: 0, patience: 2 }] };
  let s = initialState(lv);
  s = tap(lv, s, 1).state; // batida (1 jogada)
  assert.equal(s.status, 'playing');
  s = tap(lv, s, 1).state; // outra batida (2 jogadas) -> paciência zerou
  assert.equal(s.status, 'lost');
  assert.equal(s.reason, 'patience');
});

test('prioritário: embarcar exatamente na última jogada da paciência vale', () => {
  const lv = { ...base, slots: 3, priority: [{ index: 0, patience: 2 }] };
  const s = replay(lv, [0, 1]);
  assert.equal(s.status, 'won');
});

test('estado original nunca é alterado (desfazer seguro)', () => {
  const s0 = initialState(base);
  const copy = JSON.stringify({ ...s0, inLot: [...s0.inLot] });
  tap(base, s0, 0);
  tap(base, s0, 1);
  assert.equal(JSON.stringify({ ...s0, inLot: [...s0.inLot] }), copy);
});

test('solver encontra a solução e a dica aponta a próxima jogada', () => {
  const r = solve(base);
  assert.ok(r.solvable);
  assert.deepEqual(r.path, [0, 1]);
  assert.equal(nextMove(base, initialState(base)), 0);
});

test('solver prova que um estado sem saída não tem solução', () => {
  const lv = L({
    cols: 3,
    rows: 3,
    slots: 1,
    buses: [
      { x: 0, y: 0, dir: 'up', type: 'small', color: 0 },
      { x: 2, y: 0, dir: 'up', type: 'small', color: 1 },
    ],
    queue: [1, 1, 1, 1, 0, 0, 0, 0],
  });
  // com 1 vaga, tirar o vermelho primeiro perde; o solver deve escolher o azul
  assert.deepEqual(solve(lv).path, [1, 0]);
  const dead = { ...lv, priority: [{ index: 4, patience: 1 }] };
  assert.equal(solve(dead).solvable, false);
});


// ---------------------------------------------------------------------------
// Mecânicas
// ---------------------------------------------------------------------------
const two = (extra) =>
  L({
    cols: 4,
    rows: 4,
    slots: 3,
    buses: [
      { x: 0, y: 0, dir: 'up', type: 'small', color: 0 },
      { x: 3, y: 0, dir: 'up', type: 'small', color: 1 },
    ],
    queue: [0, 0, 0, 0, 1, 1, 1, 1],
    ...extra,
  });

test('cadeado: bate enquanto a chave não saiu; abre depois', () => {
  const lv = two({});
  lv.buses[0].lock = 1; // vermelho trancado; chave = azul
  assert.deepEqual(validateLevel(lv), []);
  let r = tap(lv, initialState(lv), 0);
  assert.equal(r.events[0].type, 'bump');
  assert.equal(r.events[0].key, 1);
  r = tap(lv, r.state, 1);
  assert.ok(r.events.some((e) => e.type === 'unlock' && e.bus === 0));
  r = tap(lv, r.state, 0);
  assert.equal(r.state.status, 'won');
});

test('cadeado: ciclo é rejeitado', () => {
  const lv = two({});
  lv.buses[0].lock = 1;
  lv.buses[1].lock = 0;
  assert.ok(validateLevel(lv).some((e) => e.includes('ciclo')));
});

test('obra: cone bloqueia até a jogada `until` e esperar (bater) faz o tempo passar', () => {
  const lv = two({ cones: [{ x: 0, y: 0, until: 2 }] });
  lv.buses[0] = { id: 0, x: 0, y: 2, dir: 'up', type: 'small', color: 0 };
  assert.deepEqual(validateLevel(lv), []);
  let r = tap(lv, initialState(lv), 0);
  assert.equal(r.events[0].type, 'bump'); // cone na frente (jogada 1)
  r = tap(lv, r.state, 1); // azul sai (jogada 2): obra termina
  assert.ok(r.events.some((e) => e.type === 'cones'));
  r = tap(lv, r.state, 0);
  assert.equal(r.state.status, 'won');
  // o solver também sabe esperar
  const lv2 = { ...lv, buses: [lv.buses[0], { ...lv.buses[1], color: 0 }], queue: [0, 0, 0, 0, 0, 0, 0, 0], cones: [{ x: 0, y: 0, until: 3 }] };
  const sol = solve(lv2);
  assert.ok(sol.solvable);
  assert.equal(replay(lv2, sol.path).status, 'won');
});

test('terminal: solta o próximo ônibus quando a casa fica livre', () => {
  const g = { id: 0, x: 1, y: 3, dir: 'up' };
  const p = garageSpawnPos(g, 'small'); // nasce em (1,1)-(1,2)
  const lv = L({
    cols: 3,
    rows: 4,
    slots: 3,
    garages: [g],
    buses: [
      { ...p, type: 'small', color: 0, garage: 0 },
      { ...p, type: 'small', color: 1, garage: 0 },
    ],
    queue: [0, 0, 0, 0, 1, 1, 1, 1],
  });
  assert.deepEqual(validateLevel(lv), []);
  let s = initialState(lv);
  assert.deepEqual([...s.inLot], [1, 2]);
  const r = tap(lv, s, 0);
  assert.ok(r.events.some((e) => e.type === 'spawn' && e.bus === 1));
  assert.equal(tap(lv, r.state, 1).state.status, 'won');
});

test('travado: sem saída e sem obra para terminar = derrota', () => {
  // vermelho aponta para o azul e vice-versa (impossível); qualquer toque perde por "stuck"
  const lv = L({
    cols: 4,
    rows: 1,
    slots: 3,
    buses: [
      { x: 1, y: 0, dir: 'right', type: 'small', color: 0 },
      { x: 2, y: 0, dir: 'left', type: 'small', color: 1 },
    ],
    queue: [0, 0, 0, 0, 1, 1, 1, 1],
  });
  const r = tap(lv, initialState(lv), 0);
  assert.equal(r.state.reason, 'stuck');
});

// ---------------------------------------------------------------------------
// Várias filas + humor
// ---------------------------------------------------------------------------
// Três ônibus livres (vermelho, azul, amarelo), um por coluna, saindo para cima.
const three = L({
  cols: 3,
  rows: 3,
  slots: 3,
  calm: 2,
  buses: [
    { x: 0, y: 0, dir: 'up', type: 'small', color: 0 },
    { x: 1, y: 0, dir: 'up', type: 'small', color: 1 },
    { x: 2, y: 0, dir: 'up', type: 'small', color: 2 },
  ],
  lines: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [2, 2, 2, 2],
  ],
});

test('várias filas: fase válida; fila vazia ou cor sem lugar é rejeitada', () => {
  assert.deepEqual(validateLevel(three), []);
  assert.ok(validateLevel({ ...three, lines: [[0, 0, 0, 0], [], [1, 1, 1, 1, 2, 2, 2, 2]] }).length > 0);
  assert.ok(validateLevel({ ...three, lines: [[0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2]] }).length > 0);
});

test('várias filas: só a fila da cor embarca; as outras esperam', () => {
  const r = tap(three, initialState(three), 1);
  assert.deepEqual(r.state.q, [0, 4, 0]);
  assert.deepEqual(r.state.wait, [1, 0, 1]);
  assert.ok(r.events.filter((e) => e.type === 'board').every((e) => e.line === 1));
});

test('embarque em rodízio entre as filas (0, 1, 0, 1…)', () => {
  const lv = L({ ...three, buses: [{ x: 0, y: 0, dir: 'up', type: 'large', color: 0 }], lines: [[0, 0, 0, 0], [0, 0, 0, 0]] });
  const r = tap(lv, initialState(lv), 0);
  assert.deepEqual(r.events.filter((e) => e.type === 'board').map((e) => e.line), [0, 1, 0, 1, 0, 1, 0, 1]);
  assert.equal(r.state.status, 'won');
});

test('humor: fila que espera `calm` jogadas piora (feliz -> impaciente -> nervosa) e não melhora', () => {
  // calm 2: a fila 2 (amarelo) espera 2 jogadas -> impaciente; mais 2 -> nervosa
  let s = initialState(three);
  s = tap(three, s, 0).state; // vermelho: filas 1 e 2 esperam 1
  s = tap(three, s, 1).state; // azul: fila 2 espera 2 -> impaciente
  assert.deepEqual(s.mood, [MOOD_HAPPY, MOOD_HAPPY, MOOD_ANNOYED]);
  s = tap(three, s, 2).state; // amarelo: fila 2 embarca, mas o humor fica
  assert.equal(s.status, 'won');
  assert.deepEqual(s.mood, [MOOD_HAPPY, MOOD_HAPPY, MOOD_ANNOYED]);
  assert.equal(happyLines(s), 2);
  // batidas também contam como espera
  const lv = { ...three, calm: 1 };
  const t1 = tap(lv, initialState(lv), 0).state;
  assert.deepEqual(t1.mood, [MOOD_HAPPY, MOOD_ANNOYED, MOOD_ANNOYED]);
  const t2 = tap(lv, t1, 1).state;
  assert.deepEqual(t2.mood, [MOOD_HAPPY, MOOD_ANNOYED, MOOD_ANGRY]);
});

test('estrelas = filas felizes: 3 = ★★★, 2 = ★★, 1 ou 0 = ★ (menos filas: cada infeliz tira 1)', () => {
  assert.equal(starsFor(3, 3), 3);
  assert.equal(starsFor(2, 3), 2);
  assert.equal(starsFor(1, 3), 1);
  assert.equal(starsFor(0, 3), 1);
  assert.equal(starsFor(1, 1), 3);
  assert.equal(starsFor(0, 1), 2);
  assert.equal(starsFor(2, 2), 3);
  assert.equal(starsFor(0, 2), 1);
});

test('solver keepHappy: acha a ordem que deixa todas as filas felizes', () => {
  // calm 3: qualquer ordem das 3 cores deixa todas felizes
  const lv = { ...three, calm: 3 };
  const r = solve(lv, { keepHappy: true });
  assert.ok(r.solvable);
  assert.equal(happyLines(replay(lv, r.path)), 3);
  // calm 1: toda jogada deixa duas filas esperando – não há como manter todas felizes
  assert.equal(solve({ ...three, calm: 1 }, { keepHappy: true }).solvable, false);
});

console.log(`✓ ${n} testes do motor passaram`);
