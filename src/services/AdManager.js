// =============================================================================
// AdManager – ÚNICO ponto de contato do jogo com anúncios.
// -----------------------------------------------------------------------------
//   AdManager.showRewarded(onReward): Promise<boolean>
//       onReward() é chamado SOMENTE quando o SDK confirma a recompensa.
//       Falhou/sem internet/fechou antes: mensagem amigável, nada é perdido.
//   AdManager.registerWin(level)            -> conta vitórias (para o intersticial)
//   AdManager.maybeShowInterstitial(level)  -> só depois da tela de vitória, se as regras deixarem
//
// Regras do intersticial (CONFIG.ads.interstitial):
//   - nunca com "Remover anúncios";
//   - nenhum antes de vencer a fase `minLevel` (11);
//   - pelo menos `everyNWins` (3) vitórias E `minIntervalSeconds` (120 s) desde o último
//     (o intervalo também conta desde a abertura do app);
//   - nunca no início de fase: o jogo só chama ao SAIR da tela de vitória.
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
import { t } from '../i18n/index.js';

let provider = Capacitor.isNativePlatform() ? AdMobProvider : TestAdProvider;

let lastInterstitialAt = Date.now();
let showing = false;
let ready = Promise.resolve(provider.init()).catch(() => {});

export const AdManager = {
  /** Intersticial (uso interno: o jogo chama maybeShowInterstitial). Devolve true se exibiu. */
  async showInterstitial() {
    if (PurchaseManager.isAdsRemoved() || showing) return false;
    showing = true;
    let shown = false;
    try {
      await ready;
      Music.pause();
      shown = (await provider.showInterstitial()) !== false;
    } catch {
      shown = false;
    } finally {
      showing = false;
      Music.resume();
    }
    if (shown) {
      lastInterstitialAt = Date.now();
      Storage.update((d) => (d.winsSinceInterstitial = 0));
    }
    return shown;
  },

  /** Recompensado: a recompensa só é entregue no callback de recompensa do SDK. */
  async showRewarded(onReward) {
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

  /** Chamar ao vencer uma fase (nunca após derrota). */
  registerWin(level) {
    if (level >= CONFIG.ads.interstitial.minLevel) Storage.update((d) => d.winsSinceInterstitial++);
  },

  shouldShowInterstitial(level, now = Date.now()) {
    const r = CONFIG.ads.interstitial;
    if (!r.enabled || PurchaseManager.isAdsRemoved()) return false;
    if (level < r.minLevel) return false;
    if (Storage.data.winsSinceInterstitial < r.everyNWins) return false;
    return now - lastInterstitialAt >= r.minIntervalSeconds * 1000;
  },

  async maybeShowInterstitial(level) {
    try {
      if (!this.shouldShowInterstitial(level)) return false;
      return await this.showInterstitial();
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
      await provider.showPrivacyOptions?.();
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
