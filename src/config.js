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
  // ---------------------------------------------------------------------------
  // Identidade visual (docs/IDENTIDADE.md): estilo "adesivo de rua" – cores
  // chapadas e saturadas, contorno azul-marinho grosso e sombra dura.
  // ---------------------------------------------------------------------------
  colors: {
    ink: 0x1b2340, // azul-marinho "asfalto à noite": contornos, sombras e fundos
    inkCss: '#1b2340',
    background: 0x1b2340,
    sky: 0x7fd3ff,
    sunsetTop: 0xffd166, // céu do pôr do sol (menu / splash)
    sunsetMid: 0xff8a4c,
    sunsetLow: 0xff4f8b,
    sea: 0x2e9bff,
    hill: 0x2a3566, // Pão de Açúcar ao fundo
    text: '#ffffff',
    textDark: '#1b2340',
    textDim: '#b9c3e0',
    asphalt: 0x434b6b,
    asphaltDark: 0x353c58,
    laneLine: 0xffc72c,
    road: 0x4e5677,
    sidewalk: 0xfff3dc, // creme do calçadão
    sidewalkWave: 0x1b2340,
    curb: 0xe7d3ad,
    shelter: 0x13b5a6,
    accent: 0xffc72c, // amarelo-busão (cor da marca)
    challenge: 0xff4f8b, // rosa-carnaval
    button: 0x2e9bff, // azul-mar
    buttonText: '#ffffff',
    buttonSecondary: 0x3a4670,
    buttonAd: 0xff7a3d, // laranja-pôr-do-sol (ações com anúncio)
    buttonSuccess: 0x23b26d, // verde-bandeira (jogar / continuar)
    danger: 0xe5484d,
    gold: 0xffc72c,
    panel: 0xfff3dc,
    particles: [0xffc72c, 0x2e9bff, 0xff4f8b, 0x23b26d, 0xffffff, 0xff7a3d],
    skin: [0xf2c9a0, 0xd9a274, 0xb57a4e, 0x8d5a3a, 0x6b4128],
  },


  layout: {
    designWidth: 390,
    designHeight: 780,
    maxDevicePixelRatio: 4,
    sidePadding: 14,
    topBarHeight: 68,
    bottomBarHeight: 92,
  },

  storage: {
    key: 'busCrazyPeople.save',
    backupKey: 'busCrazyPeople.save.backup',
  },
};

export default CONFIG;
