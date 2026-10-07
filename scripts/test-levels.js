// Teste automatizado do pacote de fases (levels/levels.json).
//
// Para CADA fase confere:
//   1. estrutura válida (grade, ônibus dentro e sem sobreposição, cores,
//      passageiros por cor = lugares por cor, prioritários);
//   2. a solução gravada vence a fase SEM boosters (replay no motor real), sem
//      batidas e com TODAS as filas felizes (3 estrelas sempre possíveis);
//   3. o solver encontra solução sozinho, sem boosters e sem estourar o limite;
//   4. regras do pacote: 300 fases, 1–10 tutorial, Desafio a cada 10 (20..300),
//      máximo de 8 cores, ids em ordem;
//   5. curva gradual: nenhuma fase normal pula muito acima das anteriores (sem pico).
//
// Uso: npm run test:levels

import { readFileSync } from 'node:fs';
import { validateLevel, replay, initialState, tap, happyLines, linesOf } from '../src/core/engine.js';
import { solve } from '../src/core/solver.js';
import { COLORS } from '../src/core/rules.js';

const pack = JSON.parse(readFileSync(new URL('../levels/levels.json', import.meta.url), 'utf8'));
const levels = pack.levels;
const errors = [];
const fail = (m) => errors.push(m);
const t0 = Date.now();
let maxNodes = 0;
let maxNodesId = 0;

if (levels.length !== 300) fail(`esperado 300 fases, encontrado ${levels.length}`);
levels.forEach((lv, i) => {
  const id = i + 1;
  if (lv.id !== id) fail(`fase na posição ${id} tem id ${lv.id}`);
  for (const e of validateLevel(lv)) fail(e);
  if (new Set(lv.buses.map((b) => b.color)).size > COLORS.length) fail(`fase ${id}: mais de 8 cores`);
  // 2. solução gravada
  const s = replay(lv, lv.solution || []);
  if (s.status !== 'won') fail(`fase ${id}: solução gravada não vence (status ${s.status}${s.reason ? ', ' + s.reason : ''})`);
  else if (happyLines(s) !== linesOf(lv).length) fail(`fase ${id}: a solução gravada não deixa todas as filas felizes`);
  // filas: tutorial 1–3 com 1 fila, depois 2 e 3; todas as fases geradas com 3; paciência definida
  if (!Array.isArray(lv.lines) || !Number.isInteger(lv.calm)) fail(`fase ${id}: sem filas/paciência (lines, calm)`);
  else if (id > 6 && lv.lines.length !== 3) fail(`fase ${id}: esperado 3 filas, tem ${lv.lines.length}`);
  // 2b. a solução gravada não tem nenhuma batida => 3 estrelas (0 erros) são sempre possíveis
  {
    let st = initialState(lv);
    for (const id of lv.solution || []) {
      const r = tap(lv, st, id);
      if (r.events.some((e) => e.type === 'bump')) {
        fail(`fase ${id}: a solução gravada tem batida (3 estrelas não garantidas)`);
        break;
      }
      st = r.state;
    }
  }
  // 3. solver independente
  const r = solve(lv, { maxNodes: 400000 });
  if (!r.solvable) fail(`fase ${id}: solver não achou solução${r.capped ? ' (limite de nós)' : ''}`);
  else if (replay(lv, r.path).status !== 'won') fail(`fase ${id}: caminho do solver não vence`);
  if (r.nodes > maxNodes) {
    maxNodes = r.nodes;
    maxNodesId = id;
  }
  // 4. tutorial / desafio
  const tutorial = id <= 10;
  if (tutorial !== !!lv.tutorial) fail(`fase ${id}: marcação de tutorial errada`);
  const challenge = id >= 10 && id % 10 === 0;
  if (challenge !== !!lv.challenge) fail(`fase ${id}: marcação de Desafio errada`);
});

// 4b. estreia das mecânicas: fase de estreia tem só a mecânica nova; nenhuma aparece antes dela
const { GEN } = await import('./generator-config.js');
const MKEY = { hidden: 'hidden', cones: 'cones', locks: 'lock', garages: 'garage' };
for (const [k, cfg] of Object.entries(GEN.mechanics)) {
  const lv = levels[cfg.intro - 1];
  if (JSON.stringify(lv.mechanics) !== JSON.stringify([MKEY[k]])) fail(`fase ${cfg.intro}: deveria estrear só "${MKEY[k]}" (tem ${lv.mechanics})`);
  for (const l of levels.slice(0, cfg.intro - 1)) if ((l.mechanics || []).includes(MKEY[k])) fail(`fase ${l.id}: "${MKEY[k]}" antes da estreia (${cfg.intro})`);
}

// 4c. desafio moderado: armadilhas mínimas e piso de vitória do jogador ingênuo
for (const l of levels.slice(10)) {
  const min = GEN.minTraps.reduce((m, [from, k]) => (l.id >= from ? k : m), 0);
  const isIntro = Object.values(GEN.mechanics).some((m) => m.intro === l.id);
  const traps = l.meta.traps + (l.meta.starTraps ?? 0);
  if (traps < (isIntro ? 0 : min)) fail(`fase ${l.id}: só ${traps} armadilha(s) (mínimo ${min})`);
  const floor = l.challenge ? GEN.minGreedyWinChallenge : GEN.minGreedyWin;
  if (l.meta.greedyWin < floor) fail(`fase ${l.id}: dura demais (jogador ingênuo vence ${l.meta.greedyWin})`);
}

// 4d. cada Desafio (10, 20, 30…) é a fase mais difícil da sua dezena, com mais armadilhas
for (const l of levels.filter((x) => x.challenge)) {
  const decade = levels.slice(l.id - 10, l.id - 1);
  const top = decade.reduce((a, b) => (b.meta.score > a.meta.score ? b : a));
  if (l.meta.score <= top.meta.score) fail(`Desafio ${l.id}: score ${l.meta.score} não supera a fase ${top.id} (${top.meta.score})`);
  const trapsOf = (m) => m.traps + (m.starTraps ?? 0);
  const maxTraps = Math.max(...decade.map((x) => trapsOf(x.meta)));
  if (l.id > 10 && trapsOf(l.meta) < Math.min(maxTraps, GEN.challenge.minTraps)) fail(`Desafio ${l.id}: poucas armadilhas (${trapsOf(l.meta)})`);
}

// 5. curva sem picos (só fases normais depois do tutorial)
const normal = levels.filter((l) => l.id > 10 && !l.challenge);
const MAX_JUMP = 9; // pontos de score acima do maior entre as 5 anteriores
for (let i = 5; i < normal.length; i++) {
  const prevMax = Math.max(...normal.slice(i - 5, i).map((l) => l.meta.score));
  if (normal[i].meta.score > prevMax + MAX_JUMP) fail(`pico de dificuldade na fase ${normal[i].id}: ${normal[i].meta.score} > ${prevMax} + ${MAX_JUMP}`);
}
// a 1ª fase depois do tutorial não pode ser bem mais difícil que o tutorial
const tutMax = Math.max(...levels.slice(0, 10).filter((l) => !l.challenge).map((l) => l.meta.score));
if (normal[0].meta.score > tutMax + MAX_JUMP) fail(`pico logo após o tutorial: fase ${normal[0].id}`);
// média por blocos de 50 deve crescer
const avg = (a) => a.reduce((s, l) => s + l.meta.score, 0) / a.length;
let last = -Infinity;
for (let b = 0; b < 6; b++) {
  const blk = normal.filter((l) => l.id > b * 50 && l.id <= (b + 1) * 50);
  const m = avg(blk);
  if (m < last) fail(`média de dificuldade caiu no bloco ${b * 50 + 1}–${(b + 1) * 50}`);
  last = m;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (errors.length) {
  console.error(errors.slice(0, 50).join('\n'));
  console.error(`✗ ${errors.length} problema(s) em ${levels.length} fases (${secs} s)`);
  process.exit(1);
}
console.log(`✓ ${levels.length} fases válidas e resolvíveis sem boosters (${secs} s; maior busca: ${maxNodes} nós na fase ${maxNodesId})`);
