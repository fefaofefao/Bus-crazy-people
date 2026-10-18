// Ajudas guardadas (dica, desfazer, vaga extra): ganhas no presente diário e ao
// concluir um bairro. No jogo, são usadas ANTES de oferecer um anúncio.

import { Storage } from './Storage.js';

export const ITEM_KINDS = ['hint', 'undo', 'slot'];

export const Inventory = {
  count: (kind) => Storage.data.items[kind] ?? 0,
  /** Soma ajudas: Inventory.add({ hint: 2, undo: 1 }) */
  add(items) {
    Storage.update((d) => {
      for (const k of ITEM_KINDS) if (items[k] > 0) d.items[k] = Math.min(999, d.items[k] + items[k]);
    });
  },
  /** Gasta 1 ajuda; devolve false se não tinha. */
  use(kind) {
    if (this.count(kind) <= 0) return false;
    Storage.update((d) => (d.items[kind] -= 1));
    return true;
  },
};
