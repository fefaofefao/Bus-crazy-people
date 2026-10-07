// Loja: "Vidas infinitas" e "Vidas infinitas + sem anúncios" (Google Play Billing).
// Aberta pelos Ajustes e pela tela "Sem vidas". O preço vem da loja (moeda local).

import { modal, toast } from './dom.js';
import { PurchaseManager } from '../services/PurchaseManager.js';
import { Sound } from '../services/Sound.js';
import { t } from '../i18n/index.js';

const KEY = { infinite_lives: 'lives', infinite_lives_no_ads: 'bundle' };
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

/**
 * Abre a loja. onClose(bought) é chamado ao fechar (bought = comprou algo agora).
 */
export async function openStore({ onClose } = {}) {
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

  const buy = (id) => async (close) => {
    pending = true;
    close();
    const r = await PurchaseManager.buy(id);
    if (r === true) {
      bought = true;
      Sound.reward();
      toast(t(`store.${KEY[id]}.thanks`), 3000);
    } else toast(r === 'error' ? t('settings.storeError') : t('settings.canceled'));
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
          toast(r === 'error' ? t('settings.storeError') : r ? t('settings.restored') : t('settings.notFound'));
          finish();
        },
      },
      { label: t('common.close'), kind: 'secondary', onClick: (close) => close() },
    ],
    onClose: () => !pending && finish(),
  });
}
