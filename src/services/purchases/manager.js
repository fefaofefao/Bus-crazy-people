// Lógica das compras (sem Phaser, sem DOM): o PurchaseManager do jogo é
// createPurchaseManager(provider) com o provider certo para a plataforma.
// Separado para os testes (scripts/test-purchases.js) simularem a Google Play.

import { CONFIG } from '../../config.js';
import { Storage } from '../Storage.js';

const PRODUCTS = CONFIG.purchases.products;

/** Benefícios liberados por uma lista de produtos comprados. */
export function grantsOf(ids) {
  const g = new Set();
  for (const p of PRODUCTS) if (ids.includes(p.id)) p.grants.forEach((x) => g.add(x));
  return { lives: g.has('lives'), ads: g.has('ads') };
}

/** Grava os benefícios. exact = true também retira (conta da loja consultada: reembolso). */
function apply(ids, exact) {
  const g = grantsOf(ids);
  Storage.update((d) => {
    d.infiniteLives = exact ? g.lives : d.infiniteLives || g.lives;
    d.adsRemoved = exact ? g.ads : d.adsRemoved || g.ads;
  });
}

/**
 * native = true: ao criar, confere as compras na conta da loja (reinstalação,
 * outro aparelho, reembolso, pagamento pendente aprovado depois).
 */
export function createPurchaseManager(provider, { native = false } = {}) {
  const ready = provider
    .init()
    .then(async () => {
      if (!native || !CONFIG.purchases.enabled) return;
      const ids = await provider.restore();
      if (ids !== 'error') apply(ids, true);
    })
    .catch(() => {});

  // último preço conhecido de cada produto (para o evento de analytics "purchase")
  const priceCache = Object.fromEntries(PRODUCTS.map((p) => [p.id, { text: p.price, value: p.value, currency: p.currency }]));

  return {
    ready,

    isEnabled() {
      return CONFIG.purchases.enabled === true;
    },

    products() {
      return PRODUCTS;
    },

    /** Preços da loja (moeda local); cai no preço de CONFIG se a loja não responder. */
    async prices() {
      try {
        await ready;
        const found = await provider.prices(PRODUCTS.map((p) => p.id));
        for (const [id, info] of Object.entries(found || {})) if (info?.text) priceCache[id] = info;
      } catch {
        /* fica o preço padrão */
      }
      return Object.fromEntries(PRODUCTS.map((p) => [p.id, priceCache[p.id]?.text ?? p.price]));
    },

    /** Valor e moeda do produto (da loja, se já consultada; senão o padrão de CONFIG). */
    priceInfo(id) {
      return priceCache[id] ?? { text: '', value: 0, currency: '' };
    },

    /** true | 'restored' (já era dono) | false (cancelou) | 'pending' (pagamento pendente) | 'error' */
    async buy(id) {
      if (!this.isEnabled() || !PRODUCTS.some((p) => p.id === id)) return false;
      if (this.owns(id)) return true;
      await ready;
      let r;
      try {
        r = await provider.buy(id);
      } catch {
        r = 'error';
      }
      if (r === 'owned') {
        // A Google diz que a conta já tem o produto (reinstalou / outro aparelho): restaura.
        const ids = await provider.restore().catch(() => 'error');
        if (ids !== 'error' && ids.includes(id)) {
          apply(ids, false);
          return 'restored'; // liberado, mas sem pagamento novo (não conta como venda)
        }
        return 'error';
      }
      if (r === true) apply([id], false);
      return r;
    },

    async restorePurchases() {
      if (!this.isEnabled()) return false;
      await ready;
      let ids;
      try {
        ids = await provider.restore();
      } catch {
        ids = 'error';
      }
      if (ids === 'error') return 'error';
      const g = grantsOf(ids);
      if (g.lives || g.ads) apply(ids, false);
      return g.lives || g.ads;
    },

    /** Já tem tudo o que o produto libera? */
    owns(id) {
      const p = PRODUCTS.find((x) => x.id === id);
      if (!p || !this.isEnabled()) return false;
      return p.grants.every((g) => (g === 'lives' ? this.hasInfiniteLives() : this.isAdsRemoved()));
    },

    isAdsRemoved() {
      return this.isEnabled() && Storage.data.adsRemoved === true;
    },

    hasInfiniteLives() {
      return this.isEnabled() && Storage.data.infiniteLives === true;
    },
  };
}
