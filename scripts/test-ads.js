// Testes das regras de anúncio (sem SDK): usa um provider falso e relógio simulado.
// Garante: nenhum intersticial fora das regras, recompensa só no callback e
// nenhum erro de anúncio derruba o jogo.
// Uso: npm run test:ads

import assert from 'node:assert/strict';

// ---- ambiente de navegador mínimo para importar os serviços no Node ----
const store = new Map();
const noop = () => {};
const fakeEl = () => ({ className: '', textContent: '', style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, append: noop, prepend: noop, addEventListener: noop, remove: noop, dataset: {} });
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.document = { documentElement: {}, body: fakeEl(), createElement: fakeEl, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, hidden: false };
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['pt-BR'], language: 'pt-BR' }, configurable: true });

const { CONFIG } = await import('../src/config.js');
const { Storage } = await import('../src/services/Storage.js');
const { AdManager } = await import('../src/services/AdManager.js');

let now = 1_000_000;
Date.now = () => now;
const R = CONFIG.ads.interstitial;
let n = 0;
const test = async (name, fn) => {
  Storage.reset(false);
  await fn();
  n++;
  console.log('  ✓ ' + name);
};
const provider = (over = {}) => ({ shows: 0, rewardedCalls: 0, init: async () => {}, showInterstitial: async function () { this.shows++; return true; }, showRewarded: async () => ({ rewarded: true }), ...over });

await test('nenhum intersticial antes da fase mínima', async () => {
  const p = provider();
  AdManager._setProvider(p, { lastAt: 0 });
  for (let lv = 1; lv < R.minLevel; lv++) {
    AdManager.registerWin(lv);
    assert.equal(await AdManager.maybeShowInterstitial(lv), false);
  }
  assert.equal(p.shows, 0);
});

await test(`precisa de ${R.everyNWins} vitórias E ${R.minIntervalSeconds} s`, async () => {
  const p = provider();
  AdManager._setProvider(p, { lastAt: now });
  for (let k = 0; k < R.everyNWins; k++) AdManager.registerWin(20);
  assert.equal(await AdManager.maybeShowInterstitial(20), false, 'antes do intervalo');
  now += R.minIntervalSeconds * 1000;
  assert.equal(await AdManager.maybeShowInterstitial(20), true);
  assert.equal(p.shows, 1);
  // logo depois: contador zerado
  now += R.minIntervalSeconds * 1000;
  AdManager.registerWin(21);
  assert.equal(await AdManager.maybeShowInterstitial(21), false, 'só 1 vitória');
});

await test('simulação de 400 vitórias: todos os intersticiais respeitam as regras', async () => {
  const shows = [];
  const p = provider({ showInterstitial: async () => (shows.push({ at: now, lv }), true) });
  AdManager._setProvider(p, { lastAt: now });
  let lv = 1;
  let winsSince = 0;
  let lastAt = now;
  for (; lv <= 400; lv++) {
    now += (20 + ((lv * 37) % 90)) * 1000; // 20–110 s por fase
    AdManager.registerWin(lv);
    if (lv >= R.minLevel) winsSince++;
    const shown = await AdManager.maybeShowInterstitial(lv);
    if (shown) {
      assert.ok(lv >= R.minLevel, `fase ${lv} < mínimo`);
      assert.ok(winsSince >= R.everyNWins, `só ${winsSince} vitórias`);
      assert.ok(now - lastAt >= R.minIntervalSeconds * 1000, 'intervalo curto');
      winsSince = 0;
      lastAt = now;
    }
  }
  assert.ok(shows.length > 10, 'deveria ter exibido alguns');
});

await test('"Remover anúncios" desliga o intersticial', async () => {
  const p = provider();
  AdManager._setProvider(p, { lastAt: 0 });
  Storage.update((d) => (d.adsRemoved = true));
  for (let k = 0; k < 10; k++) AdManager.registerWin(50);
  assert.equal(await AdManager.maybeShowInterstitial(50), false);
  assert.equal(p.shows, 0);
});

await test('erro no SDK do intersticial não trava o jogo', async () => {
  AdManager._setProvider(provider({ showInterstitial: async () => { throw new Error('boom'); } }), { lastAt: 0 });
  for (let k = 0; k < 5; k++) AdManager.registerWin(50);
  assert.equal(await AdManager.maybeShowInterstitial(50), false);
  // init que falha também não quebra
  AdManager._setProvider(provider({ init: async () => { throw new Error('init'); } }), { lastAt: 0 });
  assert.equal(await AdManager.maybeShowInterstitial(50), true);
});

await test('recompensado: entrega só quando o SDK confirma', async () => {
  let got = 0;
  AdManager._setProvider(provider({ showRewarded: async () => ({ rewarded: true }) }));
  assert.equal(await AdManager.showRewarded(() => got++), true);
  assert.equal(got, 1);
  AdManager._setProvider(provider({ showRewarded: async () => ({ rewarded: false }) })); // fechou antes
  assert.equal(await AdManager.showRewarded(() => got++), false);
  AdManager._setProvider(provider({ showRewarded: async () => ({ rewarded: false, unavailable: true }) })); // sem anúncio
  assert.equal(await AdManager.showRewarded(() => got++), false);
  AdManager._setProvider(provider({ showRewarded: async () => { throw new Error('crash'); } })); // erro
  assert.equal(await AdManager.showRewarded(() => got++), false);
  assert.equal(got, 1);
});

await test('recompensado continua disponível com "Remover anúncios"', async () => {
  let calls = 0;
  AdManager._setProvider(provider({ showRewarded: async () => (calls++, { rewarded: true }) }));
  Storage.update((d) => (d.adsRemoved = true));
  let got = 0;
  assert.equal(await AdManager.showRewarded(() => got++), true);
  assert.equal(calls, 1, 'o anúncio foi exibido (opcional)');
  assert.equal(got, 1);
});

console.log(`✓ ${n} testes de anúncios passaram`);
process.exit(0);
