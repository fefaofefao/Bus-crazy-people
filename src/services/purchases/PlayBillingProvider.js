// Compras REAIS pela Google Play (Play Billing) com @capgo/native-purchases.
// Usado automaticamente no app Android; no navegador o PurchaseManager usa o
// TestPurchaseProvider.
//
// Contrato (o mesmo do TestPurchaseProvider):
//   init(): Promise<void>
//   buy(productId): Promise<true | false | 'owned' | 'pending' | 'error'>
//       true = comprou · false = cancelado pelo usuário · 'owned' = já era dono
//       (Google: ITEM_ALREADY_OWNED – restaurar) · 'pending' = pagamento pendente
//       (boleto/Pix: libera quando aprovar, na próxima abertura do app)
//   restore(): Promise<string[] | 'error'>           ids dos produtos comprados
//   prices(ids): Promise<{ id: { text, value, currency } }>  preço na moeda local
//
// O plugin reconhece (acknowledge) a compra automaticamente – obrigatório em até
// 3 dias, senão a Google reembolsa. restorePurchases() também reconhece compras
// que ficaram pendentes e foram aprovadas depois. Produtos no Play Console: os ids
// de CONFIG.purchases.products, "produto único" (não consumível), ATIVOS.
//
// Erros do plugin (Android): reject(mensagem, código). O código vem do Play Billing:
// USER_CANCELED, ITEM_ALREADY_OWNED, ITEM_UNAVAILABLE, BILLING_UNAVAILABLE...

import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

// Android: purchaseState "1" = comprado; "2" = pendente (não libera ainda)
const owned = (p) => p && (p.purchaseState === undefined || String(p.purchaseState) === '1');

/** Classifica o erro do plugin: 'cancel' | 'owned' | 'pending' | 'error'. */
export function classifyError(e) {
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? e ?? '');
  if (code === 'USER_CANCELED' || /cancel/i.test(code) || /user.?cancel/i.test(msg)) return 'cancel';
  if (code === 'ITEM_ALREADY_OWNED' || /already.?owned/i.test(msg)) return 'owned';
  if (/pending/i.test(msg) || /PURCHASE_STATE_2/.test(code)) return 'pending';
  return 'error';
}

/** Provider sobre uma API no formato do NativePurchases (injetável para testes). */
export function createPlayBillingProvider(api = NativePurchases, types = PURCHASE_TYPE) {
  return {
    async init() {},

    async buy(productId) {
      try {
        const tx = await api.purchaseProduct({ productIdentifier: productId, productType: types.INAPP, quantity: 1 });
        return owned(tx) ? true : 'pending';
      } catch (e) {
        const k = classifyError(e);
        return k === 'cancel' ? false : k;
      }
    },

    async prices(ids) {
      const { products } = await api.getProducts({ productIdentifiers: ids, productType: types.INAPP });
      const out = {};
      for (const p of products || [])
        if (p?.identifier && p.priceString && !out[p.identifier]) out[p.identifier] = { text: p.priceString, value: Number(p.price) || 0, currency: p.currencyCode || '' };
      return out;
    },

    async restore() {
      try {
        await api.restorePurchases().catch(() => {});
        const { purchases } = await api.getPurchases({ productType: types.INAPP });
        return (purchases || []).filter(owned).map((p) => p.productIdentifier);
      } catch {
        return 'error';
      }
    },
  };
}

export const PlayBillingProvider = createPlayBillingProvider();
