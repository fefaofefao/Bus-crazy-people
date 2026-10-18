// Pedido de avaliação da Google Play (In-App Review): uma única vez, depois de
// uma vitória com 3 estrelas a partir da fase CONFIG.review.fromLevel, quando o
// jogador toca "Próxima fase" (nunca no meio da partida). A Google decide se a
// janela aparece (há limite de vezes por usuário); o jogo segue de qualquer jeito.

import { Capacitor } from '@capacitor/core';
import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';
import { track } from '../analytics.ts';

export const Review = {
  shouldAsk: ({ level, stars }) => Capacitor.isNativePlatform() && !Storage.data.reviewAsked && stars === 3 && level >= CONFIG.review.fromLevel,

  async ask() {
    Storage.update((d) => (d.reviewAsked = true));
    track('review_prompt');
    try {
      const { InAppReview } = await import('@capacitor-community/in-app-review');
      await InAppReview.requestReview();
    } catch {
      /* sem Play Store / erro: segue o jogo */
    }
  },
};
