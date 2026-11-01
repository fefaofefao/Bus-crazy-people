// =============================================================================
// AdManager – ÚNICO ponto de contato do jogo com anúncios.
// -----------------------------------------------------------------------------
//   AdManager.isRewardedReady()             -> mostrar botão de anúncio só se carregado
//   AdManager.offerRewarded(placement)      -> registra que a oferta apareceu (analytics)
//   AdManager.showRewarded(onReward, placement): Promise<boolean>
//       onReward() é chamado SOMENTE quando o SDK confirma a recompensa.
//       placement (analytics): lose_continue, no_lives, undo, hint, extra_slot, daily_double
//   AdManager.registerWin(level)            -> conta fases concluídas (para o intersticial)
//   AdManager.maybeShowInterstitial(level)  -> só ao sair da tela de vitória, se as regras deixarem
//
// Regras do intersticial (CONFIG.ads.interstitial):
//   - nunca com "sem anúncios" (o intersticial nem é carregado);
//   - só ao concluir uma fase a partir da fase `minLevel` (3);
//   - no máximo a cada `everyNWins` (2) fases concluídas E `minIntervalSeconds` (60 s)
//     entre exibições;
//   - nunca no meio da fase nem ao abrir o app: o jogo só chama ao SAIR da tela de vitória.
//
// Analytics (Firebase): ad_inter_shown, ad_inter_failed, ad_rewarded_offer,
// ad_rewarded_shown, ad_rewarded_completed – todos com o parâmetro "placement".
//
// Nenhum erro de anúncio pode travar o jogo: tudo é protegido por try/catch e as
// Promises sempre resolvem.
// =============================================================================

import { Capacitor } from '@capacitor/core';
import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';
import { PurchaseManager } from './PurchaseManager.js';
import { Music } from './Music.js';
import { TestAdProvider } from './ads/TestAdProvider.js';
import { AdMobProvider } from './ads/AdMobProvider.js';
import { toast } from '../ui/dom.js';
import { applyConsent, track } from '../analytics.ts';
import { t } from '../i18n/index.js';

let provider = Capacitor.isNativePlatform() ? AdMobProvider : TestAdProvider;

let lastInterstitialAt = 0; // 60 s contam entre exibições (o 1º só aparece ao concluir uma fase)
let showing = false;
const log = (...a) => console.log('[Ads]', ...a);
// Ao terminar o fluxo de consentimento (UMP) do provider, o analytics decide se liga.
let ready = Promise.resolve(provider.init({ shouldLoadInterstitial: () => CONFIG.ads.interstitial.enabled && !PurchaseManager.isAdsRemoved() }))
  .then((consent) => applyConsent(consent ?? {}))
  .catch(() => applyConsent({}));

export const AdManager = {
  /** Intersticial (uso interno: o jogo chama maybeShowInterstitial). Devolve { shown, reason }. */
  async showInterstitial() {
    if (PurchaseManager.isAdsRemoved()) return { shown: false, reason: 'ads_removed' };
    if (showing) return { shown: false, reason: 'busy' };
    showing = true;
    let r = { shown: false, reason: 'error' };
    try {
      await ready;
      Music.pause();
      r = await provider.showInterstitial();
      if (typeof r === 'boolean' || r == null) r = { shown: r !== false && r != null, reason: r == null ? 'no_result' : undefined };
    } catch (e) {
      r = { shown: false, reason: 'exception' };
      log('interstitial exception', e?.message);
    } finally {
      showing = false;
      Music.resume();
    }
    if (r.shown) {
      lastInterstitialAt = Date.now();
      Storage.update((d) => (d.winsSinceInterstitial = 0));
    }
    return r;
  },

  /** O recompensado está carregado? (o botão de anúncio só aparece se estiver) */
  isRewardedReady() {
    try {
      const ok = provider.isReady?.('rewarded') ?? true;
      if (!ok) provider.ensureLoaded?.('rewarded');
      return ok;
    } catch {
      return false;
    }
  },

  /** A oferta de anúncio recompensado apareceu para o jogador. */
  offerRewarded(placement) {
    track('ad_rewarded_offer', { placement });
  },

  /** Recompensado: a recompensa só é entregue no callback de recompensa do SDK. */
  async showRewarded(onReward, placement = 'other') {
    if (PurchaseManager.isAdsRemoved() && CONFIG.ads.skipRewardedWhenAdsRemoved) {
      onReward?.();
      return true;
    }
    if (showing) return false;
    showing = true;
    let result = null;
    try {
      await ready;
      Music.pause();
      result = await provider.showRewarded();
    } catch {
      result = { rewarded: false, unavailable: true };
    } finally {
      showing = false;
      Music.resume();
    }
    log('rewarded result', placement, JSON.stringify(result));
    if (result?.shown || result?.rewarded) track('ad_rewarded_shown', { placement });
    if (result?.rewarded) track('ad_rewarded_completed', { placement });
    else if (result?.unavailable) track('ad_rewarded_failed', { placement, reason: result.reason ?? 'unavailable' });
    if (result?.rewarded) {
      try {
        onReward?.();
      } catch (e) {
        console.error(e);
      }
      return true;
    }
    if (result?.unavailable) toast(t('ads.unavailable'), 3200);
    return false;
  },

  /** Chamar ao concluir (vencer) uma fase. */
  registerWin() {
    Storage.update((d) => d.winsSinceInterstitial++);
  },

  /** Motivo pelo qual o intersticial NÃO pode aparecer agora (null = pode). */
  interstitialBlock(level, now = Date.now()) {
    const r = CONFIG.ads.interstitial;
    if (!r.enabled) return 'disabled';
    if (PurchaseManager.isAdsRemoved()) return 'ads_removed';
    if (level < r.minLevel) return `level<${r.minLevel}`;
    if (Storage.data.winsSinceInterstitial < r.everyNWins) return `wins ${Storage.data.winsSinceInterstitial}/${r.everyNWins}`;
    const left = r.minIntervalSeconds * 1000 - (now - lastInterstitialAt);
    if (left > 0) return `interval ${Math.ceil(left / 1000)}s`;
    return null;
  },

  shouldShowInterstitial(level, now = Date.now()) {
    return this.interstitialBlock(level, now) == null;
  },

  async maybeShowInterstitial(level) {
    try {
      const block = this.interstitialBlock(level);
      log('interstitial check level', level, block ? `blocked: ${block}` : 'OK -> show');
      if (block) return false;
      const r = await this.showInterstitial();
      if (r.shown) track('ad_inter_shown', { placement: 'level_complete', level });
      else track('ad_inter_failed', { placement: 'level_complete', level, reason: r.reason ?? 'unknown' });
      log('interstitial result', JSON.stringify(r));
      return r.shown;
    } catch {
      return false;
    }
  },

  privacyOptionsRequired() {
    try {
      return provider.privacyOptionsRequired?.() ?? false;
    } catch {
      return false;
    }
  },
  async showPrivacyOptions() {
    try {
      const consent = await provider.showPrivacyOptions?.();
      if (consent) await applyConsent(consent); // o jogador mudou a escolha: analytics acompanha
    } catch {
      /* ignora */
    }
  },

  // ---- testes e modo debug ----
  resetTimer() {
    lastInterstitialAt = 0;
  },
  secondsSinceLastInterstitial() {
    return Math.floor((Date.now() - lastInterstitialAt) / 1000);
  },
  /** Só para testes automatizados (scripts/test-ads.js). */
  _setProvider(p, { lastAt = Date.now() } = {}) {
    provider = p;
    ready = Promise.resolve(p.init?.()).catch(() => {});
    lastInterstitialAt = lastAt;
  },
};
