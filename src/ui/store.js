// Loja: "Vidas infinitas" e "Vidas infinitas + sem anúncios" (Google Play Billing).
// Aberta pelos Ajustes e pela tela "Sem vidas". O preço vem da loja (moeda local).

import { modal, toast } from './dom.js';
import { PurchaseManager } from '../services/PurchaseManager.js';
import { Sound } from '../services/Sound.js';
import { t } from '../i18n/index.js';
import { track } from '../analytics.ts';

const KEY = { infinite_lives: 'lives', infinite_lives_no_ads: 'bundle' };
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

/** Evento padrão "purchase" do Firebase (com items) + product_id. */
function trackPurchase(id) {
  const info = PurchaseManager.priceInfo(id);
  const name = t(`store.${KEY[id]}.title`);
  track('purchase', {
    product_id: id,
    value: info.value,
    currency: info.currency,
    items: [{ item_id: id, item_name: name, price: info.value, quantity: 1 }],
  });
  if (PurchaseManager.products().find((p) => p.id === id)?.grants.includes('ads')) track('ads_removed', { product_id: id });
}

/**
 * Abre a loja. onClose(bought) é chamado ao fechar (bought = comprou algo agora).
 * source = de onde veio (analytics): 'settings' | 'out_of_lives'.
 */
export async function openStore({ onClose, source = 'settings' } = {}) {
  let bought = false;
  let pending = false; // compra/restauração em andamento (a janela já fechou)
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onClose?.(bought);
  };
  const prices = (await withTimeout(PurchaseManager.prices(), 2500)) ?? Object.fromEntries(PurchaseManager.products().map((p) => [p.id, p.price]));
  const items = PurchaseManager.products().filter((p) => !PurchaseManager.owns(p.id));
  const lines = items.map((p) => `• ${t(`store.${KEY[p.id]}.title`)} – ${prices[p.id]}\n   ${t(`store.${KEY[p.id]}.desc`)}`);
  const owned = [];
  if (PurchaseManager.hasInfiniteLives()) owned.push(t('store.ownedLives'));
  if (PurchaseManager.isAdsRemoved()) owned.push(t('store.ownedAds'));
  const text = [items.length ? lines.join('\n\n') : t('store.allOwned'), owned.length ? `\n✓ ${owned.join(' · ')}` : ''].join('\n');
  for (const p of items) track('iap_offer_viewed', { product_id: p.id, source });

  const buy = (id) => async (close) => {
    pending = true;
    close();
    const r = await PurchaseManager.buy(id);
    if (r === true || r === 'restored') {
      bought = true;
      if (r === true) trackPurchase(id); // 'restored' = já era dono: não é venda nova
      Sound.reward();
      toast(t(`store.${KEY[id]}.thanks`), 3000);
    } else {
      track('purchase_failed', { product_id: id, reason: r === 'pending' ? 'pending' : r === 'error' ? 'error' : 'canceled' });
      toast(r === 'pending' ? t('store.pending') : r === 'error' ? t('settings.storeError') : t('settings.canceled'), r === 'pending' ? 5000 : 2500);
    }
    finish();
  };

  modal({
    tone: 'challenge',
    badge: '∞',
    title: t('store.title'),
    text,
    buttons: [
      ...items.map((p) => ({ label: `${t(`store.${KEY[p.id]}.title`)} · ${prices[p.id]}`, kind: p.grants.includes('ads') ? 'ok' : '', onClick: buy(p.id) })),
      {
        label: t('settings.restore'),
        kind: 'secondary',
        onClick: async (close) => {
          pending = true;
          close();
          const r = await PurchaseManager.restorePurchases();
          if (r === true) bought = true;
          track('purchase_restored', { found: r === true ? 1 : 0 });
          toast(r === 'error' ? t('settings.storeError') : r ? t('settings.restored') : t('settings.notFound'));
          finish();
        },
      },
      { label: t('common.close'), kind: 'secondary', onClick: (close) => close() },
    ],
    onClose: () => !pending && finish(),
  });
}
