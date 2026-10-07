// Parâmetros da geração das 300 fases (curva de dificuldade).
// Mudou algo aqui? Rode `npm run levels:generate` e depois `npm run test:levels`.
// ATENÇÃO: depois de publicado, mudar as fases muda o jogo de quem já jogou.
// Aumente PACK_VERSION em scripts/generate-levels.js quando isso acontecer.

export const GEN = {
  total: 300,
  firstGenerated: 11, // 1–10 = tutorial feito à mão (levels/tutorial.json)
  challengeEvery: 10, // 10, 20, 30, ..., 300 são fases Desafio (opcionais) – as mais difíceis da dezena
  firstChallenge: 10, // a 10 é feita à mão (levels/tutorial.json); as outras são geradas
  candidatesPerLevel: 12, // fases válidas sorteadas por número; fica a mais próxima da meta
  maxAttemptsPerLevel: 400,
  baseSeed: 20261007,

  // Interpolação linear entre start (fase 11) e end (fase 300). t = progresso 0..1
  // (com curva `ease`: t^ease, < 1 sobe mais rápido no começo).
  ramp: {
    ease: 0.7,
    cols: [5, 7],
    rows: [6, 9],
    buses: [7, 22],
    colors: [4, 8], // com 3 filas, mais cores = menos ônibus servindo para alguma frente
    pStop: [0.5, 0.95],
    medium: [0.15, 0.75], // peso dos ônibus médios (pequeno = 1)
    large: [0.0, 0.3],
    fifoBias: [0.6, 0.2],
    // meta de pontuação de dificuldade (ver measure() em src/core/generator.js)
    targetScore: [22, 100],
  },
  slots: 4, // com 3 filas, 4 vagas já dão o aperto que 5 davam com 1 fila
  // Fases normais com só 4 vagas: a partir de `from`, com chance crescente (mais aperto = mais estratégia)
  fourSlots: { from: 60, chance: [0.15, 0.45] }, // (vagas - 1, apesar do nome)

  // Filas do ponto e humor (ver src/core/engine.js). Toda fase gerada tem `count` filas.
  // calm (paciência das filas) = maior espera seguindo a ordem pretendida + 1 + folga:
  // a folga cai com a rampa (mais aperto para as 3 estrelas) e é zero nos Desafios.
  // A paciência base é a MAIS APERTADA que ainda permite 3 estrelas (o solver procura).
  lines: { count: 3, calmSlack: [2, 0], calmSlackChallenge: 0, calmSlackTutorial: 2 },

  // Prioritários: a partir da fase priorityFrom, a cada priorityEvery fases (mais frequente depois)
  priority: {
    from: 25,
    chance: [0.3, 0.7], // chance de a fase ter prioritários (rampa)
    max: [1, 2],
    slack: [3, 1], // folga de jogadas além da ordem pretendida
  },

  // Fases Desafio (10, 20, 30…): SEMPRE a mais difícil da sua dezena.
  //  - parâmetros como se estivessem `ahead` fases à frente e 1 vaga a menos a partir de slotsMinusFrom;
  //  - pontuação acima da fase normal mais difícil da dezena (+ aboveDecade);
  //  - o dobro de armadilhas (minTrapsMult) e teto de vitória do jogador ingênuo (maxGreedyWin, rampa):
  //    quem joga no automático perde; quem planeja vence.
  challenge: {
    ahead: 120,
    slotsMinusFrom: 30,
    scoreBonus: 28,
    aboveDecade: 8,
    minTrapsMult: 2,
    minTraps: 3,
    maxGreedyWin: [0.45, 0.3],
    attempts: 900,
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

  // Desafio moderado – nem fácil demais, nem impossível:
  //  - armadilhas mínimas por faixa de fase: [a partir da fase, mínimo]. Armadilha =
  //    toque que leva a um beco sem saída OU que já impede terminar com as 3 filas
  //    felizes (provado pelo solver);
  //  - piso de vitória do jogador "ingênuo" (segue a cor da frente): abaixo disso é cruel.
  minTraps: [
    [14, 1],
    [60, 2],
    [150, 3],
  ],
  minGreedyWin: 0.15,
  minGreedyWinChallenge: 0.05,

  // Fora do início, descarta fases que se vencem quase sempre jogando ao acaso
  maxRandomWin: [0.9, 0.4],
};
