// =============================================================================
// BUS CRAZY PEOPLE – CONFIGURAÇÃO CENTRAL
// -----------------------------------------------------------------------------
// Parâmetros ajustáveis do jogo: anúncios, boosters, animações, cores e layout.
// As FASES não dependem deste arquivo: ficam prontas em levels/levels.json
// (geradas por scripts/generate-levels.js, com os parâmetros em
// scripts/generator-config.js).
// Os IDs REAIS do AdMob ficam em config/ads.json.
// =============================================================================

import realAds from '../config/ads.json' with { type: 'json' };

// Versão da loja? true no build de release (npm run build:release / workflow android-release).
// No navegador o Vite troca import.meta.env; nos scripts Node usa a variável RELEASE=1.
const env = (k) => import.meta.env?.[`VITE_${k}`] ?? (typeof process !== 'undefined' ? process.env?.[k] : undefined);
const IS_RELEASE = env('RELEASE') === '1';
// Release com anúncios de TESTE (para teste fechado antes de ter os IDs reais)
const FORCE_TEST_ADS = env('TEST_ADS') === '1';

const hasRealIds = (a) => !/X{4}/.test(`${a.appId}${a.interstitialId}${a.rewardedId}`);

export const CONFIG = {
  release: IS_RELEASE,

  game: {
    title: 'Bus Crazy People',
    totalLevels: 300,
    tutorialLevels: 10, // fases 1–10: dica visual (mãozinha) automática
    freeUndosPerLevel: 1,
    maxExtraSlotsPerLevel: 1, // booster "vaga extra" (anúncio), temporária
    queueVisible: 11, // passageiros desenhados na calçada (o resto vira "+N")
  },

  // ---------------------------------------------------------------------------
  // Anúncios (regras Better Ads / Play)
  // ---------------------------------------------------------------------------
  ads: {
    admob: {
      // Blocos de TESTE do Google fora do release, ou enquanto config/ads.json tiver XXXX.
      useTestAds: !IS_RELEASE || FORCE_TEST_ADS || !hasRealIds(realAds),
      hasRealIds: hasRealIds(realAds),
      appId: realAds.appId,
      interstitialId: realAds.interstitialId,
      rewardedId: realAds.rewardedId,
      // IDs de teste oficiais do Google (seguros para clicar)
      testAppId: 'ca-app-pub-3940256099942544~3347511713',
      testInterstitialId: 'ca-app-pub-3940256099942544/1033173712',
      testRewardedId: 'ca-app-pub-3940256099942544/5224354917',
      testDevices: [],
      loadTimeoutMs: 8000, // tempo máximo esperando um anúncio carregar
    },
    testAdSeconds: 5, // duração do anúncio de teste (navegador)
    interstitial: {
      enabled: true,
      minLevel: 11, // nenhum intersticial antes de vencer a fase 11
      everyNWins: 3, // no mínimo 3 fases vencidas entre um e outro
      minIntervalSeconds: 120, // E no mínimo 120 s (conta também desde a abertura do app)
    },
    // Com "Remover anúncios", os recompensados CONTINUAM disponíveis como opção
    skipRewardedWhenAdsRemoved: false,
  },

  purchases: {
    enabled: true,
    removeAdsId: 'remove_ads', // produto não consumível no Play Console
  },

  // ---------------------------------------------------------------------------
  // Animações (ms)
  // ---------------------------------------------------------------------------
  anim: {
    exitPerCell: 45, // tempo por casa ao sair do estacionamento
    exitMin: 170,
    exitMax: 380,
    toSlot: 230, // ônibus chegando à vaga
    board: 95, // um passageiro andando até o ônibus
    boardStagger: 62, // intervalo entre passageiros em sequência
    depart: 420,
    bumpForwardPerCell: 50,
    bumpForwardMin: 70,
    bumpBack: 140,
    shake: 220,
    appearStagger: 22,
    appear: 260,
    buttonPress: 70,
    overlayFade: 200,
    endDelay: 350, // espera antes da tela de vitória/derrota
    sceneFade: 220,
  },

  feedback: {
    vibrateTap: 10,
    vibrateCollision: [30, 25, 40],
    vibrateWin: [20, 40, 20, 40, 60],
    masterVolume: 0.5,
    musicVolume: 0.16,
  },

  // ---------------------------------------------------------------------------
  // Cores (tema: cidade brasileira de dia)
  // ---------------------------------------------------------------------------
  colors: {
    background: 0x2d3a4f,
    sky: 0x7cc6ee,
    text: '#ffffff',
    textDark: '#25324a',
    textDim: '#c3cde0',
    asphalt: 0x4a5163,
    asphaltDark: 0x3c4253,
    laneLine: 0xf5d547,
    road: 0x565d70,
    sidewalk: 0xece2cf,
    sidewalkWave: 0x2f3542, // ondas do calçadão
    curb: 0xc9bca3,
    shelter: 0x2f9e8f, // abrigo do ponto
    accent: 0xffc93c,
    challenge: 0xff5d3d,
    button: 0x2f6bff,
    buttonText: '#ffffff',
    buttonSecondary: 0x37415a,
    buttonAd: 0xff9f1c,
    buttonSuccess: 0x22b35e,
    danger: 0xe5484d,
    gold: 0xffc93c,
    panel: 0x24304a,
    particles: [0xffc93c, 0x4cd3ff, 0xff5c8a, 0x7ce05c, 0xffffff],
    skin: [0xf2c9a0, 0xd9a274, 0xb57a4e, 0x8d5a3a, 0x6b4128],
  },

  layout: {
    designWidth: 390,
    designHeight: 780,
    maxDevicePixelRatio: 4,
    sidePadding: 14,
    topBarHeight: 58,
    bottomBarHeight: 92,
  },

  storage: {
    key: 'busCrazyPeople.save',
    backupKey: 'busCrazyPeople.save.backup',
  },
};

export default CONFIG;
