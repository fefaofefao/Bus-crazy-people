// Parâmetros da geração das 300 fases (curva de dificuldade).
// Mudou algo aqui? Rode `npm run levels:generate` e depois `npm run test:levels`.
// ATENÇÃO: depois de publicado, mudar as fases muda o jogo de quem já jogou.
// Aumente PACK_VERSION em scripts/generate-levels.js quando isso acontecer.

export const GEN = {
  total: 300,
  firstGenerated: 11, // 1–10 = tutorial feito à mão (levels/tutorial.json)
  challengeEvery: 10, // 20, 30, ..., 300 são fases Desafio (opcionais)
  firstChallenge: 20,
  candidatesPerLevel: 12, // fases válidas sorteadas por número; fica a mais próxima da meta
  maxAttemptsPerLevel: 400,
  baseSeed: 20261007,

  // Interpolação linear entre start (fase 11) e end (fase 300). t = progresso 0..1
  // (com curva `ease`: t^ease, < 1 sobe mais rápido no começo).
  ramp: {
    ease: 1,
    cols: [5, 7],
    rows: [6, 9],
    buses: [6, 21],
    colors: [3, 7],
    pStop: [0.35, 0.85],
    medium: [0.15, 0.75], // peso dos ônibus médios (pequeno = 1)
    large: [0.0, 0.3],
    fifoBias: [0.6, 0.2],
    // meta de pontuação de dificuldade (ver measure() em src/core/generator.js)
    targetScore: [7, 72],
  },
  slots: 5,

  // Prioritários: a partir da fase priorityFrom, a cada priorityEvery fases (mais frequente depois)
  priority: {
    from: 25,
    chance: [0.25, 0.6], // chance de a fase ter prioritários (rampa)
    max: [1, 2],
    slack: [4, 2], // folga de jogadas além da ordem pretendida
  },

  // Fases Desafio: parâmetros como se estivessem `ahead` fases à frente, e vagas - 1 depois da 100
  challenge: {
    ahead: 70,
    slotsMinusFrom: 100,
    scoreBonus: 10,
  },

  // Mecânicas (ver src/core/engine.js). Cada uma estreia numa fase fixa (`intro`,
  // só ela, em versão leve) e depois aparece com chance crescente (rampa até a 300).
  // count = [mín, máx] por fase (cresce com a rampa).
  mechanics: {
    hidden: { intro: 31, from: 32, chance: [0.3, 0.55], count: [1, 4] },
    cones: { intro: 55, from: 56, chance: [0.3, 0.5], count: [1, 3] },
    locks: { intro: 81, from: 82, chance: [0.3, 0.5], count: [1, 2] },
    garages: { intro: 111, from: 112, chance: [0.3, 0.5], count: [1, 1] },
  },

  // Ajuste fino da curva: depois de escolhidas, as fases normais são reordenadas
  // em janelas deste tamanho (mantém a progressão de tamanho e remove serrilhado)
  smoothWindow: 9,

  // Fora do início, descarta fases que se vencem quase sempre jogando ao acaso
  maxRandomWin: [1, 0.9],
};
