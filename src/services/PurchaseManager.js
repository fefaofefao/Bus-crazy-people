// =============================================================================
// PurchaseManager – ÚNICO ponto de contato do jogo com compras.
// -----------------------------------------------------------------------------
//   PurchaseManager.products()                 lista de CONFIG.purchases.products
//   PurchaseManager.prices(): Promise<{ id: '¤ preço' }>  preço da loja (moeda local)
//   PurchaseManager.buy(id): Promise<true | false | 'error'>
//   PurchaseManager.restorePurchases(): Promise<true | false | 'error'>
//   PurchaseManager.owns(id) / isAdsRemoved() / hasInfiniteLives(): boolean
//
// Produtos (todos "produto único", não consumíveis, no Play Console):
//   infinite_lives         -> vidas infinitas
//   infinite_lives_no_ads  -> vidas infinitas + sem intersticiais
// "Sem anúncios" desliga só os intersticiais; os recompensados continuam como opção.
// O que foi liberado fica salvo no progresso (Storage.data.infiniteLives / adsRemoved)
// e é conferido na conta da Google Play a cada abertura do app.
//
// Provider escolhido automaticamente:
//   - app Android  -> PlayBillingProvider (Google Play Billing real)
//   - navegador    -> TestPurchaseProvider (confirmação simulada)
// =============================================================================

import { Capacitor } from '@capacitor/core';
import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';
import { TestPurchaseProvider } from './purchases/TestPurchaseProvider.js';
import { PlayBillingProvider } from './purchases/PlayBillingProvider.js';

const PRODUCTS = CONFIG.purchases.products;
const provider = Capacitor.isNativePlatform() ? PlayBillingProvider : TestPurchaseProvider;

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

const ready = provider
  .init()
  .then(async () => {
    // Ao abrir o app: confere as compras na conta da Google Play (outro aparelho,
    // reinstalação ou reembolso). Só altera se a consulta funcionou.
    if (!Capacitor.isNativePlatform() || !CONFIG.purchases.enabled) return;
    const ids = await provider.restore();
    if (ids !== 'error') apply(ids, true);
  })
  .catch(() => {});

export const PurchaseManager = {
  isEnabled() {
    return CONFIG.purchases.enabled === true;
  },

  products() {
    return PRODUCTS;
  },

  /** Preços da loja (moeda local); cai no preço de CONFIG se a loja não responder. */
  async prices() {
    const out = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.price]));
    try {
      await ready;
      Object.assign(out, await provider.prices(PRODUCTS.map((p) => p.id)));
    } catch {
      /* fica o preço padrão */
    }
    return out;
  },

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
