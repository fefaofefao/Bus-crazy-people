// Implementação REAL dos anúncios com @capacitor-community/admob (Google Mobile Ads SDK).
// Usada automaticamente no app Android; no navegador o AdManager usa o TestAdProvider.
//
// Contrato (o mesmo do TestAdProvider):
//   init(opts): Promise<{ status, canRequestAds }>   resultado do fluxo de consentimento (UMP)
//   isReady(kind): boolean                           anúncio carregado e pronto para exibir
//   showInterstitial(): Promise<{ shown, reason? }>
//   showRewarded(): Promise<{ rewarded, shown, unavailable?, reason? }>
//   privacyOptionsRequired(): boolean / showPrivacyOptions(): Promise<consent|null>
//
// CARREGAMENTO (um de cada tipo, guiado pelos EVENTOS do SDK):
//   - Carrega 1 intersticial e 1 recompensado no início (depois do consentimento).
//   - Só pede um novo DEPOIS que o atual for fechado (onAdDismissed) ou falhar ao exibir.
//   - Trocar de cena não pede anúncio nenhum.
//   - Falha ao carregar: tenta de novo com espera crescente (30 s, 60 s, 120 s… até 5 vezes).
//   - O estado "pronto" vem do evento onAdLoaded (antes vinha de uma promessa com
//     tempo limite de 8 s: se a rede demorava, o anúncio carregava mas o jogo nunca
//     ficava sabendo e pedia outro – pedidos sem exibição).
//
// LOGS: todo evento do SDK vai para o console com o prefixo [Ads] (no APK de debug o
// Capacitor repassa ao logcat: adb logcat | grep "\[Ads\]").
//
// Os IDs ficam em src/config.js (ads.admob). O ID do APP também precisa estar
// no AndroidManifest; o script scripts/sync-admob-id.js copia do config para
// android/app/src/main/res/values/strings.xml (roda no `npm run cap:sync` e no CI).

import { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';
import { CONFIG } from '../../config.js';

const A = CONFIG.ads.admob;
const testing = A.useTestAds;
const ids = {
  interstitial: testing ? A.testInterstitialId : A.interstitialId,
  rewarded: testing ? A.testRewardedId : A.rewardedId,
};

const log = (...args) => console.log('[Ads]', ...args);

let canRequestAds = false;
let privacyRequired = false;
let wantInterstitial = () => true; // o AdManager diz se vale carregar (ex.: comprou "sem anúncios")
// idle | loading | ready | showing
const state = { interstitial: 'idle', rewarded: 'idle' };
const retries = { interstitial: 0, rewarded: 0 };
const timers = { interstitial: null, rewarded: null };
const EVENTS = {
  interstitial: InterstitialAdPluginEvents,
  rewarded: RewardAdPluginEvents,
};

function load(kind, why = '') {
  clearTimeout(timers[kind]);
  if (!canRequestAds) return log(kind, 'load skipped: consentimento não permite pedir anúncios');
  if (kind === 'interstitial' && !wantInterstitial()) return log(kind, 'load skipped: sem anúncios (compra)');
  if (state[kind] !== 'idle') return; // já carregando, pronto ou na tela: nada de pedir outro
  state[kind] = 'loading';
  log(kind, 'load request', why);
  const opts = { adId: ids[kind], isTesting: testing, immersiveMode: true };
  const call = kind === 'interstitial' ? AdMob.prepareInterstitial(opts) : AdMob.prepareRewardVideoAd(opts);
  // O resultado vem pelos eventos Loaded / FailedToLoad (ouvintes em listen()).
  call.catch(() => {});
  // segurança: se o SDK não responder em 60 s, libera para tentar de novo depois
  timers[kind] = setTimeout(() => {
    if (state[kind] === 'loading') {
      log(kind, 'load sem resposta em 60 s; nova tentativa');
      state[kind] = 'idle';
      retry(kind);
    }
  }, 60000);
}

function retry(kind) {
  if (retries[kind] >= 5) return log(kind, 'desistindo de carregar até o próximo uso');
  const wait = 30000 * 2 ** retries[kind]++;
  clearTimeout(timers[kind]);
  timers[kind] = setTimeout(() => load(kind, `retry ${retries[kind]}`), wait);
}

function listen() {
  for (const kind of ['interstitial', 'rewarded']) {
    const E = EVENTS[kind];
    AdMob.addListener(E.Loaded, () => {
      clearTimeout(timers[kind]);
      retries[kind] = 0;
      state[kind] = 'ready';
      log(kind, 'onAdLoaded');
    });
    AdMob.addListener(E.FailedToLoad, (err) => {
      clearTimeout(timers[kind]);
      // "não foi preparado" ao tentar exibir também chega aqui: não muda um anúncio na tela
      if (state[kind] === 'showing') return;
      state[kind] = 'idle';
      log(kind, 'onAdFailedToLoad', err?.code, err?.message);
      retry(kind);
    });
    AdMob.addListener(E.Showed, () => log(kind, 'onAdShowed'));
    AdMob.addListener(E.FailedToShow, (err) => {
      log(kind, 'onAdFailedToShow', err?.code, err?.message);
      state[kind] = 'idle';
      load(kind, 'after failed show');
    });
    AdMob.addListener(E.Dismissed, () => {
      log(kind, 'onAdDismissed');
      state[kind] = 'idle';
      load(kind, 'after dismiss'); // só recarrega depois de fechado
    });
  }
  AdMob.addListener(RewardAdPluginEvents.Rewarded, (r) => log('rewarded', 'onUserEarnedReward', r?.type, r?.amount));
}

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

const withTimeout = (p, ms, value) => Promise.race([p, new Promise((r) => setTimeout(() => r(value), ms))]);

export const AdMobProvider = {
  async init({ shouldLoadInterstitial } = {}) {
    if (shouldLoadInterstitial) wantInterstitial = shouldLoadInterstitial;
    log('init', testing ? 'TEST ads' : 'REAL ads', ids);
    await AdMob.initialize({ initializeForTesting: testing, testingDevices: A.testDevices });
    listen();
    // Consentimento (UMP) ANTES de qualquer pedido de anúncio; o formulário só
    // aparece onde a lei exige (EEE/Reino Unido).
    let consent = { status: 'UNKNOWN', canRequestAds: true };
    try {
      let info = await AdMob.requestConsentInfo();
      if (!info.canRequestAds && info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        info = await AdMob.showConsentForm();
      }
      canRequestAds = info.canRequestAds;
      privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED'; // enum não é exportado pelo plugin
      consent = { status: info.status, canRequestAds: info.canRequestAds };
    } catch (e) {
      log('consent error', e?.message);
      canRequestAds = true; // sem UMP disponível: segue (o SDK aplica as regras padrão)
    }
    log('consent', JSON.stringify(consent));
    load('interstitial', 'startup');
    load('rewarded', 'startup');
    return consent; // o AdManager repassa ao analytics (src/analytics.ts)
  },

  isReady(kind) {
    return state[kind] === 'ready';
  },

  /** Pede um anúncio se não houver nenhum carregando/pronto (ex.: depois de desistir). */
  ensureLoaded(kind) {
    if (state[kind] === 'idle') {
      retries[kind] = 0;
      load(kind, 'ensure');
    }
  },

  async showInterstitial() {
    if (state.interstitial !== 'ready') {
      log('interstitial show skipped: state =', state.interstitial);
      this.ensureLoaded('interstitial');
      return { shown: false, reason: `not_${state.interstitial}` };
    }
    state.interstitial = 'showing';
    const showed = once([
      [InterstitialAdPluginEvents.Showed, 'showed'],
      [InterstitialAdPluginEvents.FailedToShow, 'fail'],
    ]);
    const end = once([
      [InterstitialAdPluginEvents.Dismissed, 'dismissed'],
      [InterstitialAdPluginEvents.FailedToShow, 'fail'],
    ]);
    try {
      log('interstitial show()');
      await AdMob.showInterstitial();
    } catch (e) {
      log('interstitial show() rejected', e?.message);
      state.interstitial = 'idle';
      load('interstitial', 'after show error');
      return { shown: false, reason: 'show_error' };
    }
    const first = await withTimeout(showed, 15000, { value: 'timeout' });
    if (first.value !== 'showed') return { shown: false, reason: first.value === 'fail' ? 'failed_to_show' : 'no_show_event' };
    await withTimeout(end, 10 * 60 * 1000, { value: 'timeout' }); // o jogo espera o jogador fechar
    return { shown: true };
  },

  async showRewarded() {
    if (state.rewarded !== 'ready') {
      log('rewarded show skipped: state =', state.rewarded);
      this.ensureLoaded('rewarded');
      return { rewarded: false, shown: false, unavailable: true, reason: `not_${state.rewarded}` };
    }
    state.rewarded = 'showing';
    let rewarded = false;
    let shown = false;
    const rewardL = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (rewarded = true));
    const showedL = AdMob.addListener(RewardAdPluginEvents.Showed, () => (shown = true));
    const end = once([
      [RewardAdPluginEvents.Dismissed, 'ok'],
      [RewardAdPluginEvents.FailedToShow, 'fail'],
    ]);
    let failed = false;
    try {
      log('rewarded show()');
      await AdMob.showRewardVideoAd();
      failed = (await withTimeout(end, 10 * 60 * 1000, { value: 'timeout' })).value !== 'ok';
    } catch (e) {
      log('rewarded show() rejected', e?.message);
      failed = true;
      state.rewarded = 'idle';
      load('rewarded', 'after show error');
    }
    rewardL.then((h) => h.remove()).catch(() => {});
    showedL.then((h) => h.remove()).catch(() => {});
    return { rewarded, shown: shown || rewarded, unavailable: failed && !rewarded, reason: failed ? 'failed_to_show' : undefined };
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
      if (canRequestAds) {
        this.ensureLoaded('interstitial');
        this.ensureLoaded('rewarded');
      }
      return { status: info.status, canRequestAds: info.canRequestAds };
    } catch {
      return null;
    }
  },
};
