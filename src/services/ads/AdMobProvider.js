// Implementação REAL dos anúncios com @capacitor-community/admob (Google Mobile Ads SDK).
// Usada automaticamente no app Android; no navegador o AdManager usa o TestAdProvider.
//
// Contrato (o mesmo do TestAdProvider):
//   init(): Promise<void>
//   showInterstitial(): Promise<void>
//   showRewarded(): Promise<{ rewarded: boolean, unavailable?: boolean }>
//   privacyOptionsRequired(): boolean / showPrivacyOptions(): Promise<void>
//
// Os IDs ficam em src/config.js (ads.admob). O ID do APP também precisa estar
// no AndroidManifest; o script scripts/sync-admob-id.js copia do config para
// android/app/src/main/res/values/strings.xml (roda no `npm run cap:sync` e no CI).

import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { CONFIG } from '../../config.js';
import { el, openOverlay } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';

const A = CONFIG.ads.admob;
const testing = A.useTestAds;
const ids = {
  interstitial: testing ? A.testInterstitialId : A.interstitialId,
  rewarded: testing ? A.testRewardedId : A.rewardedId,
};

let canRequestAds = false;
let privacyRequired = false;
const loaded = { interstitial: false, rewarded: false };
const loading = { interstitial: null, rewarded: null };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Espera o primeiro de vários eventos do plugin e remove os ouvintes. */
function once(events) {
  return new Promise((resolve) => {
    const handles = [];
    let done = false;
    for (const [name, value] of events) {
      handles.push(
        AdMob.addListener(name, (data) => {
          if (done) return;
          done = true;
          handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}));
          resolve({ value, data });
        }),
      );
    }
  });
}

function prepare(kind) {
  if (!canRequestAds) return Promise.resolve(false);
  if (loaded[kind]) return Promise.resolve(true);
  if (loading[kind]) return loading[kind];
  const opts = { adId: ids[kind], isTesting: testing, immersiveMode: true };
  const call = kind === 'interstitial' ? AdMob.prepareInterstitial(opts) : AdMob.prepareRewardVideoAd(opts);
  loading[kind] = withTimeout(call, A.loadTimeoutMs)
    .then(() => (loaded[kind] = true))
    .catch(() => (loaded[kind] = false))
    .finally(() => (loading[kind] = null));
  return loading[kind];
}

/** Sobreposição "Carregando anúncio…" enquanto o recompensado carrega sob demanda. */
function loadingOverlay() {
  const ov = openOverlay();
  ov.box.appendChild(el('div', 'fds-spinner'));
  ov.box.appendChild(el('p', '', t('ads.loading')));
  return ov;
}

export const AdMobProvider = {
  async init() {
    // Consentimento (UMP) ANTES de qualquer pedido de anúncio
    await AdMob.initialize({ initializeForTesting: testing, testingDevices: A.testDevices });
    // Consentimento (UMP): obrigatório para usuários do EEE/Reino Unido; o formulário
    // só aparece onde a lei exige.
    try {
      let info = await AdMob.requestConsentInfo();
      if (!info.canRequestAds && info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        info = await AdMob.showConsentForm();
      }
      canRequestAds = info.canRequestAds;
      privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED'; // enum não é exportado pelo plugin
    } catch {
      canRequestAds = true; // sem UMP disponível: segue (o SDK aplica as regras padrão)
    }
    // pré-carrega para exibir sem espera
    prepare('interstitial');
    prepare('rewarded');
  },

  /** Devolve true se o anúncio foi exibido. Sem anúncio pronto: false (o jogo segue). */
  async showInterstitial() {
    // intersticial nunca espera carregar: se não estiver pré-carregado, pula
    if (!loaded.interstitial) {
      prepare('interstitial');
      return false;
    }
    loaded.interstitial = false;
    const end = once([
      [InterstitialAdPluginEvents.Dismissed, 'ok'],
      [InterstitialAdPluginEvents.FailedToShow, 'fail'],
    ]);
    let shown = false;
    try {
      await AdMob.showInterstitial();
      shown = (await withTimeout(end, 10 * 60 * 1000)).value === 'ok';
    } catch {
      shown = false;
    }
    prepare('interstitial');
    return shown;
  },

  async showRewarded() {
    let ov = null;
    if (!loaded.rewarded) ov = loadingOverlay();
    const ok = await prepare('rewarded').catch(() => false);
    ov?.close();
    if (!ok) {
      prepare('rewarded');
      return { rewarded: false, unavailable: true };
    }
    loaded.rewarded = false;
    let rewarded = false;
    const rewardListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (rewarded = true));
    const end = once([
      [RewardAdPluginEvents.Dismissed, 'ok'],
      [RewardAdPluginEvents.FailedToShow, 'fail'],
    ]);
    let failed = false;
    try {
      await AdMob.showRewardVideoAd();
      failed = (await withTimeout(end, 10 * 60 * 1000)).value === 'fail';
    } catch {
      failed = true;
    }
    rewardListener.then((h) => h.remove()).catch(() => {});
    prepare('rewarded');
    return { rewarded, unavailable: failed && !rewarded };
  },

  /** O usuário precisa ter como rever o consentimento (botão em Configurações). */
  privacyOptionsRequired() {
    return privacyRequired;
  },

  async showPrivacyOptions() {
    try {
      await AdMob.showPrivacyOptionsForm();
      const info = await AdMob.requestConsentInfo();
      canRequestAds = info.canRequestAds;
    } catch {
      /* ignora */
    }
  },
};
