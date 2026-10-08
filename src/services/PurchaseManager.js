// =============================================================================
// PurchaseManager – ÚNICO ponto de contato do jogo com compras.
// -----------------------------------------------------------------------------
//   PurchaseManager.products()                 lista de CONFIG.purchases.products
//   PurchaseManager.prices(): Promise<{ id: '¤ preço' }>  preço da loja (moeda local)
//   PurchaseManager.buy(id): Promise<true | false | 'pending' | 'error'>
// Lógica em ./purchases/manager.js (testada em scripts/test-purchases.js).
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
import { TestPurchaseProvider } from './purchases/TestPurchaseProvider.js';
import { PlayBillingProvider } from './purchases/PlayBillingProvider.js';
import { createPurchaseManager, grantsOf } from './purchases/manager.js';

export { grantsOf };

const native = Capacitor.isNativePlatform();
export const PurchaseManager = createPurchaseManager(native ? PlayBillingProvider : TestPurchaseProvider, { native });


