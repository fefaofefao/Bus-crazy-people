// Gera levels/levels.json: tutorial (feito à mão) + fases procedurais aprovadas pelo solver.
//
// Uso:
//   npm run levels:generate            -> 300 fases
//   node scripts/generate-levels.js --count 10   -> só o tutorial (útil para testes)
//
// Determinístico: mesma configuração => mesmo arquivo (sem datas nem Math.random).

import { readFileSync, writeFileSync } from 'node:fs';
import { GEN } from './generator-config.js';
import { generateLevel, measure } from '../src/core/generator.js';
import { solve } from '../src/core/solver.js';
import { LEVEL_FORMAT, validateLevel } from '../src/core/engine.js';
import { hashInts } from '../src/core/prng.js';

export const PACK_VERSION = 1;

const args = process.argv.slice(2);
const countArg = args.indexOf('--count');
const total = countArg >= 0 ? Number(args[countArg + 1]) : GEN.total;

const lerp = (a, b, t) => a + (b - a) * t;
const R = GEN.ramp;
const tOf = (n) => Math.min(1, Math.max(0, (n - GEN.firstGenerated) / (GEN.total - GEN.firstGenerated))) ** R.ease;
export const isChallengeId = (n) => n >= GEN.firstChallenge && n % GEN.challengeEvery === 0;

function paramsFor(n) {
  const challenge = isChallengeId(n);
  const eff = challenge ? Math.min(GEN.total, n + GEN.challenge.ahead) : n;
  const t = tOf(eff);
  const rng = hashInts(GEN.baseSeed, n, 7);
  const pri = GEN.priority;
  const tp = Math.min(1, Math.max(0, (eff - pri.from) / (GEN.total - pri.from)));
  const hasPri = eff >= pri.from && (rng % 1000) / 1000 < lerp(pri.chance[0], pri.chance[1], tp);
  const priCount = hasPri ? 1 + ((rng >>> 10) % Math.round(lerp(pri.max[0], pri.max[1], tp))) : 0;
  return {
    challenge,
    cols: Math.round(lerp(R.cols[0], R.cols[1], t)),
    rows: Math.round(lerp(R.rows[0], R.rows[1], t)),
    buses: Math.round(lerp(R.buses[0], R.buses[1], t)),
    colors: Math.round(lerp(R.colors[0], R.colors[1], t)),
    slots: challenge && n >= GEN.challenge.slotsMinusFrom ? GEN.slots - 1 : GEN.slots,
    pStop: lerp(R.pStop[0], R.pStop[1], t),
    fifoBias: lerp(R.fifoBias[0], R.fifoBias[1], t),
    typeWeights: { small: 1, medium: lerp(R.medium[0], R.medium[1], t), large: lerp(R.large[0], R.large[1], t) },
    scoreBlock: 1,
    scoreDepth: 0.5,
    priority: priCount,
    prioritySlack: Math.round(lerp(pri.slack[0], pri.slack[1], tp)),
    maxRandomWin: lerp(GEN.maxRandomWin[0], GEN.maxRandomWin[1], t),
    target: lerp(R.targetScore[0], R.targetScore[1], t) + (challenge ? GEN.challenge.scoreBonus : 0),
  };
}

function loadTutorial() {
  const src = JSON.parse(readFileSync(new URL('../levels/tutorial.json', import.meta.url), 'utf8'));
  return src.levels.map((l, i) => {
    const level = {
      format: LEVEL_FORMAT,
      id: i + 1,
      cols: l.cols,
      rows: l.rows,
      slots: l.slots,
      challenge: false,
      tutorial: l.tutorial ?? null,
      buses: l.buses.map((b, id) => ({ id, x: b.x, y: b.y, dir: b.dir, type: b.type, color: b.color })),
      queue: l.queue,
      priority: l.priority ?? [],
      mechanics: [],
    };
    const errs = validateLevel(level);
    if (errs.length) throw new Error(errs.join('\n'));
    const sol = solve(level);
    if (!sol.solvable) throw new Error(`tutorial ${level.id} sem solução`);
    level.solution = sol.path;
    level.meta = { seed: 0, handmade: true, ...measure(level) };
    return level;
  });
}

function generate(n) {
  const p = paramsFor(n);
  const cands = [];
  for (let a = 0; a < GEN.maxAttemptsPerLevel && cands.length < GEN.candidatesPerLevel; a++) {
    const lv = generateLevel(n, p, hashInts(GEN.baseSeed, n, a));
    if (lv) cands.push(lv);
  }
  if (!cands.length) throw new Error(`fase ${n}: nenhuma tentativa válida`);
  cands.sort((x, y) => Math.abs(x.meta.score - p.target) - Math.abs(y.meta.score - p.target) || x.meta.seed - y.meta.seed);
  const best = cands[0];
  best.meta.target = Math.round(p.target * 100) / 100;
  return best;
}

const t0 = Date.now();
const levels = loadTutorial().slice(0, Math.min(10, total));
for (let n = GEN.firstGenerated; n <= total; n++) {
  levels.push(generate(n));
  if (n % 25 === 0) process.stdout.write(`  ${n}/${total} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
}

// Suavização: reordena as fases normais (não tutorial, não Desafio) por pontuação
// dentro de janelas, preservando as posições dos Desafios.
const normalIdx = levels.map((l, i) => i).filter((i) => i >= 10 && !levels[i].challenge);
for (let w = 0; w < normalIdx.length; w += GEN.smoothWindow) {
  const idx = normalIdx.slice(w, w + GEN.smoothWindow);
  const sorted = idx.map((i) => levels[i]).sort((a, b) => a.meta.score - b.meta.score);
  idx.forEach((i, k) => (levels[i] = sorted[k]));
}
// Ids finais = posição. A solução continua válida (não depende do id).
levels.forEach((l, i) => (l.id = i + 1));

const pack = { format: LEVEL_FORMAT, version: PACK_VERSION, count: levels.length, levels };
writeFileSync(new URL('../levels/levels.json', import.meta.url), JSON.stringify(pack) + '\n');

// Resumo
const rows = [];
for (let i = 0; i < levels.length; i += 10) {
  const g = levels.slice(i, i + 10);
  const norm = g.filter((l) => !l.challenge);
  const avg = (f) => (norm.reduce((s, l) => s + f(l), 0) / Math.max(1, norm.length)).toFixed(1);
  const ch = g.find((l) => l.challenge);
  rows.push(
    `${String(i + 1).padStart(3)}–${String(i + g.length).padStart(3)}  ônibus ${avg((l) => l.buses.length).padStart(4)}  cores ${avg((l) => new Set(l.buses.map((b) => b.color)).size)}  ` +
      `score ${avg((l) => l.meta.score).padStart(5)}  guloso ${avg((l) => l.meta.greedyWin)}  prior ${norm.filter((l) => l.priority.length).length}` +
      (ch ? `  | desafio ${ch.id}: score ${ch.meta.score}, vagas ${ch.slots}` : ''),
  );
}
console.log(rows.join('\n'));
console.log(`✓ ${levels.length} fases em levels/levels.json (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
