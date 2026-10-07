// Compras REAIS pela Google Play (Play Billing) com @capgo/native-purchases.
// Usado automaticamente no app Android; no navegador o PurchaseManager usa o
// TestPurchaseProvider.
//
// Contrato (o mesmo do TestPurchaseProvider):
//   init(): Promise<void>
//   buy(productId): Promise<true | false | 'error'>   false = cancelado pelo usuário
//   restore(): Promise<string[] | 'error'>           ids dos produtos comprados
//   prices(ids): Promise<{ id: preço formatado }>     preço na moeda local
//
// O plugin reconhece (acknowledge) a compra automaticamente – obrigatório em até
// 3 dias, senão a Google reembolsa. Produtos no Play Console: os ids de
// CONFIG.purchases.products, "produto único" (não consumível), ATIVOS.

import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

// Android: purchaseState "1" = comprado; "2" = pendente (não libera ainda)
const owned = (p) => p && (p.purchaseState === undefined || String(p.purchaseState) === '1');
const isCancel = (e) => /cancel/i.test(String(e?.message ?? e?.code ?? e));

export const PlayBillingProvider = {
  async init() {},

  async buy(productId) {
    try {
      const tx = await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: PURCHASE_TYPE.INAPP, quantity: 1 });
      return owned(tx);
    } catch (e) {
      return isCancel(e) ? false : 'error';
    }
  },

  async prices(ids) {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: ids, productType: PURCHASE_TYPE.INAPP });
    const out = {};
    for (const p of products || []) if (p?.identifier && p.priceString) out[p.identifier] = p.priceString;
    return out;
  },

  async restore() {
    try {
      await NativePurchases.restorePurchases().catch(() => {});
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      return (purchases || []).filter(owned).map((p) => p.productIdentifier);
    } catch {
      return 'error';
    }
  },
};
