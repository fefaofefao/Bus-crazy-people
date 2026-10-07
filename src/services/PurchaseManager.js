// =============================================================================
// PurchaseManager – ÚNICO ponto de contato do jogo com compras.
// -----------------------------------------------------------------------------
//   PurchaseManager.buyRemoveAds(): Promise<true | false | 'error'>
//   PurchaseManager.restorePurchases(): Promise<true | false | 'error'>
//   PurchaseManager.isAdsRemoved(): boolean
//
// "Remover anúncios" (produto não consumível `remove_ads`) desliga só os
// intersticiais; os recompensados continuam disponíveis como opção.
// O resultado fica salvo no progresso (Storage.data.adsRemoved).
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

export const REMOVE_ADS_ID = CONFIG.purchases.removeAdsId;
const provider = Capacitor.isNativePlatform() ? PlayBillingProvider : TestPurchaseProvider;

const ready = provider
  .init()
  .then(async () => {
    // Ao abrir o app: confere a compra na conta da Google Play (outro aparelho,
    // reinstalação ou reembolso). Só altera se a consulta funcionou.
    if (!Capacitor.isNativePlatform() || !CONFIG.purchases.enabled) return;
    const ids = await provider.restore();
    if (ids === 'error') return;
    const has = ids.includes(REMOVE_ADS_ID);
    if (has !== Storage.data.adsRemoved) Storage.update((d) => (d.adsRemoved = has));
  })
  .catch(() => {});

export const PurchaseManager = {
  isEnabled() {
    return CONFIG.purchases.enabled === true;
  },

  async buyRemoveAds() {
    if (!this.isEnabled()) return false;
    if (this.isAdsRemoved()) return true;
    await ready;
    let r;
    try {
      r = await provider.buy(REMOVE_ADS_ID);
    } catch {
      r = 'error';
    }
    if (r === true) Storage.update((d) => (d.adsRemoved = true));
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
    const found = ids.includes(REMOVE_ADS_ID);
    if (found) Storage.update((d) => (d.adsRemoved = true));
    return found;
  },

  isAdsRemoved() {
    return this.isEnabled() && Storage.data.adsRemoved === true;
  },
};
