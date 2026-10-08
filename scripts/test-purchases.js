// Testes das compras (Vidas infinitas / Vidas infinitas + sem anúncios) com uma
// Google Play SIMULADA no formato do plugin @capgo/native-purchases (Android):
// compra aprovada, cancelada, pendente (boleto/Pix), "você já tem este item",
// reembolso, restauração, preços e falhas da loja.
// Uso: npm run test:purchases

import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { Storage } = await import('../src/services/Storage.js');
const { Lives } = await import('../src/services/Lives.js');
const { CONFIG } = await import('../src/config.js');
const { createPurchaseManager } = await import('../src/services/purchases/manager.js');
const { createPlayBillingProvider, classifyError } = await import('../src/services/purchases/PlayBillingProvider.js');

const TYPES = { INAPP: 'inapp', SUBS: 'subs' };
const err = (message, code) => Object.assign(new Error(message), code ? { code } : {});

/** Google Play falsa: conta com `owned` produtos; `next` decide o resultado da próxima compra. */
function fakePlay({ owned = [], pending = [], next = 'ok', failQuery = false, failProducts = false } = {}) {
  const calls = { purchase: [], restore: 0 };
  const api = {
    state: { owned: [...owned], pending: [...pending], next },
    calls,
    async purchaseProduct({ productIdentifier, productType }) {
      calls.purchase.push({ productIdentifier, productType });
      const n = api.state.next;
      if (!['infinite_lives', 'infinite_lives_no_ads'].includes(productIdentifier)) throw err('Product not found');
      if (n === 'cancel') throw err('Purchase is not purchased', 'USER_CANCELED');
      if (n === 'pending') {
        api.state.pending.push(productIdentifier);
        throw err('Purchase is pending');
      }
      if (api.state.owned.includes(productIdentifier)) throw err('Purchase is not purchased', 'ITEM_ALREADY_OWNED');
      if (n === 'unavailable') throw err('Billing is not available on this device.', 'BILLING_UNAVAILABLE');
      api.state.owned.push(productIdentifier);
      return { productIdentifier, purchaseState: '1', isAcknowledged: false, transactionId: 'tok-' + productIdentifier };
    },
    async restorePurchases() {
      calls.restore++;
    },
    async getPurchases({ productType }) {
      if (failQuery) throw err('Failed to query purchases', 'QUERY_PURCHASES_FAILED');
      assert.equal(productType, 'inapp');
      return {
        purchases: [
          ...api.state.owned.map((id) => ({ productIdentifier: id, purchaseState: '1' })),
          ...api.state.pending.map((id) => ({ productIdentifier: id, purchaseState: '2' })),
        ],
      };
    },
    async getProducts({ productIdentifiers }) {
      if (failProducts) throw err('Billing service unavailable');
      const price = { infinite_lives: 'R$ 9,99', infinite_lives_no_ads: 'R$ 14,99' };
      const value = { infinite_lives: 9.99, infinite_lives_no_ads: 14.99 };
      return { products: productIdentifiers.map((id) => ({ identifier: id, priceString: price[id].replace('R$', 'BRL'), price: value[id], currencyCode: 'BRL' })) };
    },
  };
  return api;
}

let n = 0;
const test = async (name, fn) => {
  Storage.reset(false);
  await fn();
  n++;
  console.log('  ✓ ' + name);
};
const manager = async (api, native = false) => {
  const m = createPurchaseManager(createPlayBillingProvider(api, TYPES), { native });
  await m.ready;
  return m;
};

await test('ids e benefícios dos produtos batem com o Play Console', async () => {
  const p = Object.fromEntries(CONFIG.purchases.products.map((x) => [x.id, x.grants.slice().sort().join('+')]));
  assert.deepEqual(p, { infinite_lives: 'lives', infinite_lives_no_ads: 'ads+lives' });
});

await test('compra "Vidas infinitas": libera vidas, mantém anúncios; produto único (inapp)', async () => {
  const api = fakePlay();
  const m = await manager(api);
  Storage.update((d) => (d.lives = 0));
  assert.equal(Lives.has(), false);
  assert.equal(await m.buy('infinite_lives'), true);
  assert.deepEqual(api.calls.purchase, [{ productIdentifier: 'infinite_lives', productType: 'inapp' }]);
  assert.equal(m.hasInfiniteLives(), true);
  assert.equal(m.isAdsRemoved(), false);
  assert.equal(Lives.has(), true);
  assert.equal(Lives.get().infinite, true);
  assert.equal(m.owns('infinite_lives'), true);
  assert.equal(m.owns('infinite_lives_no_ads'), false); // o combo continua à venda
});

await test('compra do combo: vidas infinitas + sem anúncios', async () => {
  const m = await manager(fakePlay());
  assert.equal(await m.buy('infinite_lives_no_ads'), true);
  assert.equal(m.hasInfiniteLives(), true);
  assert.equal(m.isAdsRemoved(), true);
  assert.equal(m.owns('infinite_lives'), true); // já coberto pelo combo
});

await test('cancelar na tela da Google Play: "não concluída", nada liberado (não é erro de loja)', async () => {
  const m = await manager(fakePlay({ next: 'cancel' }));
  assert.equal(await m.buy('infinite_lives'), false);
  assert.equal(m.hasInfiniteLives(), false);
});

await test('pagamento pendente (boleto/Pix): avisa e libera quando aprovar, na próxima abertura', async () => {
  const api = fakePlay({ next: 'pending' });
  const m = await manager(api, true);
  assert.equal(await m.buy('infinite_lives_no_ads'), 'pending');
  assert.equal(m.hasInfiniteLives(), false);
  // pagamento aprovado: na próxima abertura do app, a conta já tem o produto
  api.state.pending = [];
  api.state.owned.push('infinite_lives_no_ads');
  const m2 = await manager(api, true);
  assert.equal(api.calls.restore >= 2, true); // restorePurchases (reconhece a compra) a cada abertura
  assert.equal(m2.hasInfiniteLives(), true);
  assert.equal(m2.isAdsRemoved(), true);
});

await test('"você já tem este item" (reinstalou sem restaurar): libera em vez de dar erro', async () => {
  const m = await manager(fakePlay({ owned: ['infinite_lives'] }));
  assert.equal(m.hasInfiniteLives(), false); // save novo, ainda não restaurado
  assert.equal(await m.buy('infinite_lives'), 'restored'); // liberado, sem contar como venda nova
  assert.equal(m.hasInfiniteLives(), true);
});

await test('abrir o app num aparelho novo restaura as compras sozinho', async () => {
  const m = await manager(fakePlay({ owned: ['infinite_lives_no_ads'] }), true);
  assert.equal(m.hasInfiniteLives(), true);
  assert.equal(m.isAdsRemoved(), true);
});

await test('botão "Restaurar compras"', async () => {
  const m = await manager(fakePlay({ owned: ['infinite_lives'] }));
  assert.equal(await m.restorePurchases(), true);
  assert.equal(m.hasInfiniteLives(), true);
  const m2 = await manager(fakePlay());
  Storage.reset(false);
  assert.equal(await m2.restorePurchases(), false);
});

await test('reembolso: ao abrir o app, a compra que sumiu da conta é retirada', async () => {
  Storage.update((d) => ((d.infiniteLives = true), (d.adsRemoved = true)));
  const m = await manager(fakePlay({ owned: [] }), true);
  assert.equal(m.hasInfiniteLives(), false);
  assert.equal(m.isAdsRemoved(), false);
});

await test('loja fora do ar ao abrir: NÃO tira o que o jogador já comprou', async () => {
  Storage.update((d) => (d.infiniteLives = true));
  const m = await manager(fakePlay({ failQuery: true }), true);
  assert.equal(m.hasInfiniteLives(), true);
  assert.equal(await m.restorePurchases(), 'error');
});

await test('Google Play indisponível na compra: erro amigável, nada liberado', async () => {
  const m = await manager(fakePlay({ next: 'unavailable' }));
  assert.equal(await m.buy('infinite_lives'), 'error');
  assert.equal(m.hasInfiniteLives(), false);
});

await test('preços vêm da Google Play (moeda local); se falhar, usa o preço padrão', async () => {
  const m = await manager(fakePlay());
  assert.deepEqual(await m.prices(), { infinite_lives: 'BRL 9,99', infinite_lives_no_ads: 'BRL 14,99' });
  assert.deepEqual(m.priceInfo('infinite_lives_no_ads'), { text: 'BRL 14,99', value: 14.99, currency: 'BRL' });
  const m2 = await manager(fakePlay({ failProducts: true }));
  assert.deepEqual(await m2.prices(), { infinite_lives: 'R$ 9,99', infinite_lives_no_ads: 'R$ 14,99' });
  assert.deepEqual(m2.priceInfo('infinite_lives'), { text: 'R$ 9,99', value: 9.99, currency: 'BRL' });
});

await test('produto desconhecido é recusado sem chamar a loja', async () => {
  const api = fakePlay();
  const m = await manager(api);
  assert.equal(await m.buy('remove_ads'), false);
  assert.equal(api.calls.purchase.length, 0);
});

await test('classificação dos erros reais do plugin', async () => {
  assert.equal(classifyError({ message: 'Purchase is not purchased', code: 'USER_CANCELED' }), 'cancel');
  assert.equal(classifyError({ message: 'Purchase is not purchased', code: 'ITEM_ALREADY_OWNED' }), 'owned');
  assert.equal(classifyError({ message: 'Purchase is pending' }), 'pending');
  assert.equal(classifyError({ message: 'Product not found' }), 'error');
  assert.equal(classifyError({ message: 'Purchase is not purchased', code: 'DEVELOPER_ERROR' }), 'error');
});

console.log(`✓ ${n} testes de compras passaram (Google Play simulada)`);
