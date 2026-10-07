// Testes de estrelas e conquistas.  Uso: npm run test:progress

import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { starsFor } = await import('../src/core/stars.js');
const { Storage } = await import('../src/services/Storage.js');
const { Achievements, LIST } = await import('../src/services/Achievements.js');
const { LEVELS } = await import('../src/levels/index.js');

let n = 0;
const test = (name, fn) => {
  Storage.reset(false);
  fn();
  n++;
  console.log('  ✓ ' + name);
};

test('estrelas = filas felizes: 3 = ★★★, 2 = ★★, 1 ou 0 = ★', () => {
  assert.equal(starsFor(3, 3), 3);
  assert.equal(starsFor(2, 3), 2);
  assert.equal(starsFor(1, 3), 1);
  assert.equal(starsFor(0, 3), 1);
  assert.equal(starsFor(1, 1), 3); // tutorial com 1 fila
});

test('melhor resultado por fase é guardado (não piora)', () => {
  Achievements.recordWin({ level: 5, stars: 2 });
  let r = Achievements.recordWin({ level: 5, stars: 1 });
  assert.equal(Storage.data.stars[5], 2);
  assert.equal(r.best, 2);
  r = Achievements.recordWin({ level: 5, stars: 3 });
  assert.equal(Storage.data.stars[5], 3);
  assert.equal(r.newBest, true);
});

test('primeira vitória e 3 estrelas desbloqueiam conquistas', () => {
  Storage.update((d) => d.completed.push(1));
  const r = Achievements.recordWin({ level: 1, stars: 3 });
  const ids = r.unlocked.map((a) => a.id);
  assert.ok(ids.includes('first_ride'));
  assert.ok(ids.includes('perfect'));
  // não desbloqueia de novo
  assert.equal(Achievements.recordWin({ level: 1, stars: 3 }).unlocked.length, 0);
});

test('sequência perfeita, combo, pressa e explorador', () => {
  for (let i = 1; i <= 10; i++) Achievements.recordWin({ level: i, stars: 3, maxCombo: i === 4 ? 3 : 1, hurried: 3, mechanics: i === 2 ? ['hidden', 'cones'] : i === 3 ? ['lock', 'garage'] : [] });
  const got = new Set(Storage.data.achievements);
  for (const id of ['streak_10', 'combo_3', 'hurry_25', 'explorer']) assert.ok(got.has(id), id);
  // um erro quebra a sequência
  Achievements.recordWin({ level: 11, stars: 2 });
  assert.equal(Storage.data.stats.perfectStreak, 0);
  assert.equal(Storage.data.stats.bestStreak, 10);
});

test('todas as conquistas têm meta alcançável', () => {
  const maxStars = LEVELS.length * 3;
  for (const a of LIST) assert.ok(a.target >= 1 && a.target <= Math.max(maxStars, LEVELS.length), a.id);
});

test('save corrompido de estrelas é limpo', () => {
  Storage.update((d) => (d.stars = { 7: 9, x: 2, 8: 3 }));
  assert.deepEqual(Storage.data.stars, { 8: 3 });
});

const { Lives } = await import('../src/services/Lives.js');
const { CONFIG } = await import('../src/config.js');
{
  Storage.reset(false);
  let now = 1_000_000_000;
  const realNow = Date.now;
  Date.now = () => now;
  const MIN = 60 * 1000;
  assert.equal(Lives.get().lives, 3);
  Lives.consume();
  Lives.consume();
  Lives.consume();
  assert.equal(Lives.has(), false, 'sem vidas após 3 derrotas');
  now += CONFIG.lives.regenMinutes * MIN - 1000;
  assert.equal(Lives.get().lives, 0, 'ainda não voltou');
  now += 1000;
  assert.equal(Lives.get().lives, 1, '1 vida a cada 20 min');
  now += CONFIG.lives.regenMinutes * MIN * 5;
  assert.equal(Lives.get().lives, 3, 'nunca passa do máximo');
  Lives.consume();
  Lives.refund();
  assert.equal(Lives.get().lives, 3, 'vida devolvida ao continuar');
  Lives.consume();
  Lives.consume();
  Lives.refill();
  assert.equal(Lives.get().lives, 3, 'anúncio enche as vidas');
  assert.ok(Lives.exempt(10) && !Lives.exempt(11), 'tutorial não gasta vida');
  Date.now = realNow;
  n++;
  console.log('  ✓ vidas: 3, perde 1 por derrota, volta 1 a cada 20 min, anúncio enche, tutorial grátis');
}

const langs = await Promise.all(['pt-BR', 'en', 'es'].map((l) => import(`../src/i18n/${l}.js`)));
for (const a of LIST) for (const L of langs) assert.ok(L.default.achievements[a.id]?.title && L.default.achievements[a.id]?.desc, a.id);
test('compras: vidas infinitas não acabam; combo também tira anúncios; zerar progresso mantém', () => {
  const ids = CONFIG.purchases.products.map((p) => p.id).sort();
  assert.deepEqual(ids, ['infinite_lives', 'infinite_lives_no_ads']);
  const bundle = CONFIG.purchases.products.find((p) => p.id === 'infinite_lives_no_ads');
  assert.deepEqual([...bundle.grants].sort(), ['ads', 'lives']);
  Storage.update((d) => ((d.lives = 0), (d.infiniteLives = true)));
  assert.equal(Lives.has(), true);
  assert.equal(Lives.get().infinite, true);
  Lives.consume();
  assert.equal(Storage.data.lives, 0); // não mexe no contador escondido
  assert.equal(Lives.has(), true);
  Storage.update((d) => (d.adsRemoved = true));
  Storage.reset(true);
  assert.equal(Storage.data.infiniteLives, true);
  assert.equal(Storage.data.adsRemoved, true);
});

console.log(`✓ ${n} testes de estrelas e conquistas passaram (${LIST.length} conquistas)`);
