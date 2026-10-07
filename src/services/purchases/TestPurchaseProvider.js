// Implementação de TESTE das compras: mostra uma confirmação na tela e guarda
// o "recibo" numa chave separada do localStorage, que simula a conta da loja
// (Google Play). Assim, "Zerar progresso" no modo debug apaga o save, mas
// "Restaurar compras" ainda encontra a compra – igual aconteceria de verdade.
//
// Contrato de um "provider" de compras (o mesmo que o real deve seguir):
//   init(): Promise<void>
//   buy(productId): Promise<boolean>        -> true se a compra foi concluída
//   restore(): Promise<string[]>            -> ids dos produtos já comprados

import { el, openOverlay, button } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';

const STORE_KEY = 'busCrazyPeople.testStore';

function owned() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const TestPurchaseProvider = {
  async init() {},

  buy(productId) {
    return new Promise((resolve) => {
      const ov = openOverlay();
      ov.box.appendChild(el('h2', '', t('testPurchase.title')));
      ov.box.appendChild(el('p', '', t('testPurchase.info')));
      ov.box.appendChild(
        button(t('testPurchase.confirm'), 'ok', () => {
          try {
            const list = owned();
            if (!list.includes(productId)) list.push(productId);
            localStorage.setItem(STORE_KEY, JSON.stringify(list));
          } catch {
            /* ignora */
          }
          ov.close();
          resolve(true);
        }),
      );
      ov.box.appendChild(
        button(t('testPurchase.cancel'), 'secondary', () => {
          ov.close();
          resolve(false);
        }),
      );
    });
  },

  async restore() {
    return owned();
  },
};
