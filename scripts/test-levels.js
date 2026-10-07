// Teste automatizado do pacote de fases (levels/levels.json).
//
// Para CADA fase confere:
//   1. estrutura válida (grade, ônibus dentro e sem sobreposição, cores,
//      passageiros por cor = lugares por cor, prioritários);
//   2. a solução gravada vence a fase SEM boosters (replay no motor real);
//   3. o solver encontra solução sozinho, sem boosters e sem estourar o limite;
//   4. regras do pacote: 300 fases, 1–10 tutorial, Desafio a cada 10 (20..300),
//      máximo de 8 cores, ids em ordem;
//   5. curva gradual: nenhuma fase normal pula muito acima das anteriores (sem pico).
//
// Uso: npm run test:levels

import { readFileSync } from 'node:fs';
import { validateLevel, replay } from '../src/core/engine.js';
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
  const challenge = id >= 20 && id % 10 === 0;
  if (challenge !== !!lv.challenge) fail(`fase ${id}: marcação de Desafio errada`);
});

// 5. curva sem picos (só fases normais depois do tutorial)
const normal = levels.filter((l) => l.id > 10 && !l.challenge);
const MAX_JUMP = 9; // pontos de score acima do maior entre as 5 anteriores
for (let i = 5; i < normal.length; i++) {
  const prevMax = Math.max(...normal.slice(i - 5, i).map((l) => l.meta.score));
  if (normal[i].meta.score > prevMax + MAX_JUMP) fail(`pico de dificuldade na fase ${normal[i].id}: ${normal[i].meta.score} > ${prevMax} + ${MAX_JUMP}`);
}
// a 1ª fase depois do tutorial não pode ser bem mais difícil que o tutorial
const tutMax = Math.max(...levels.slice(0, 10).map((l) => l.meta.score));
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
