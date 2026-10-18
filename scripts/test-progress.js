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

{
  globalThis.document ??= { documentElement: {} }; // i18n marca o idioma da página
  const { Offers, localDay } = await import('../src/services/Offers.js');
  const { fullAt } = await import('../src/services/Notify.js');
  test('oferta de vidas infinitas: 3ª derrota do dia, uma vez por dia, nunca para quem já tem', () => {
    const d1 = new Date(2026, 9, 13, 10, 0);
    const d1late = new Date(2026, 9, 13, 23, 59);
    const d2 = new Date(2026, 9, 14, 0, 1);
    assert.equal(localDay(d1), '2026-10-13');
    Offers.recordLoss(d1);
    Offers.recordLoss(d1);
    assert.equal(Offers.shouldOffer(d1), false);
    Offers.recordLoss(d1late);
    assert.equal(Offers.shouldOffer(d1late), true);
    Offers.markOffered(d1late);
    assert.equal(Offers.shouldOffer(d1late), false);
    Offers.recordLoss(d1late);
    assert.equal(Offers.shouldOffer(d1late), false); // só uma vez por dia
    assert.equal(Offers.shouldOffer(d2), false); // dia novo zera
    for (let k = 0; k < 3; k++) Offers.recordLoss(d2);
    assert.equal(Storage.data.daily.losses, 3);
    assert.equal(Offers.shouldOffer(d2), true);
    Storage.update((d) => (d.infiniteLives = true));
    assert.equal(Offers.shouldOffer(d2), false);
    Storage.update((d) => (d.daily = 'lixo'));
    assert.deepEqual(Storage.data.daily, { day: '', losses: 0, offered: false });
  });
  test('aviso de vidas: horário em que as 3 vidas enchem; desligado por padrão', () => {
    assert.equal(Storage.data.settings.notify, false);
    const realNow = Date.now;
    const T = 1_800_000_000_000;
    Date.now = () => T;
    const min = 60 * 1000;
    assert.equal(fullAt(T), 0); // cheias
    Lives.consume(); // 2 vidas: enche em 20 min
    assert.equal(fullAt(T), T + 20 * min);
    Lives.consume();
    Lives.consume(); // 0 vidas: enche em 60 min
    assert.equal(fullAt(T), T + 60 * min);
    Date.now = () => T + 25 * min; // 1 vida voltou, a próxima em 15 min
    assert.equal(fullAt(T + 25 * min), T + 60 * min);
    Storage.update((d) => (d.infiniteLives = true));
    assert.equal(fullAt(T + 25 * min), 0);
    Date.now = realNow;
  });
}

{
  const { DailyReward } = await import('../src/services/DailyReward.js');
  const { Inventory } = await import('../src/services/Inventory.js');
  const { Districts } = await import('../src/services/Districts.js');
  test('presente diário: sequência de 7 dias, um por dia, pular um dia recomeça, dobrar dá 2x', () => {
    const day = (d) => new Date(2026, 9, d, 12, 0);
    assert.equal(DailyReward.status(day(1)).available, true);
    assert.equal(DailyReward.status(day(1)).day, 1);
    const got = DailyReward.claim(1, day(1));
    assert.equal(got.hint, 1);
    assert.equal(Inventory.count('hint'), 1);
    assert.equal(DailyReward.claim(1, day(1)), null); // só 1 por dia
    assert.equal(DailyReward.status(day(2)).day, 2);
    DailyReward.claim(2, day(2)); // dia 2 dobrado: 2 desfazer
    assert.equal(Inventory.count('undo'), 2);
    for (let d = 3; d <= 7; d++) DailyReward.claim(1, day(d));
    assert.equal(Storage.data.reward.streak, 7);
    assert.equal(Lives.get().lives, 3); // baú do dia 7 enche as vidas
    assert.equal(DailyReward.status(day(8)).day, 1); // depois do 7, volta ao 1
    DailyReward.claim(1, day(8));
    assert.equal(DailyReward.status(day(10)).day, 1); // pulou o dia 9: recomeça
  });
  test('ajudas guardadas: usar gasta 1; sem ajuda, use() devolve false', () => {
    Inventory.add({ hint: 2 });
    assert.equal(Inventory.use('hint'), true);
    assert.equal(Inventory.use('hint'), true);
    assert.equal(Inventory.use('hint'), false);
    Storage.update((d) => (d.items = { hint: -5, undo: 'x', slot: 2 }));
    assert.deepEqual(Storage.data.items, { hint: 0, undo: 0, slot: 2 });
  });
  test('bairros: 20 fases por bairro; recompensa uma única vez ao completar todas', () => {
    assert.equal(Districts.of(1), 0);
    assert.equal(Districts.of(20), 0);
    assert.equal(Districts.of(21), 1);
    assert.equal(Districts.name(0), 'Centro');
    Storage.update((d) => (d.completed = Array.from({ length: 19 }, (_, i) => i + 1)));
    assert.equal(Districts.checkReward(19), null);
    Storage.update((d) => d.completed.push(20));
    const r = Districts.checkReward(20);
    assert.equal(r.name, 'Centro');
    assert.equal(Inventory.count('hint'), CONFIG.districts.reward.hint);
    assert.equal(Districts.checkReward(20), null); // não repete
  });
}

console.log(`✓ ${n} testes de estrelas e conquistas passaram (${LIST.length} conquistas)`);
