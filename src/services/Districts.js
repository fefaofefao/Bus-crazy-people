// Bairros: cada página de 20 fases do mapa é um bairro do Rio (CONFIG.districts).
// Concluir TODAS as fases de um bairro dá ajudas uma única vez.

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';
import { Inventory } from './Inventory.js';
import { LEVEL_COUNT } from '../levels/index.js';

const D = CONFIG.districts;

export const Districts = {
  /** Índice (0…) do bairro da fase n. */
  of: (n) => Math.floor((n - 1) / D.perPage),
  name: (i) => D.names[i % D.names.length],
  color: (i) => D.colors[i % D.colors.length],
  range(i) {
    const a = i * D.perPage + 1;
    return { a, b: Math.min(a + D.perPage - 1, LEVEL_COUNT) };
  },
  isComplete(i, completed = Storage.data.completed) {
    const { a, b } = this.range(i);
    const set = new Set(completed);
    for (let n = a; n <= b; n++) if (!set.has(n)) return false;
    return true;
  },
  /** Depois de vencer a fase n: se o bairro ficou completo agora, dá a recompensa. */
  checkReward(n) {
    const i = this.of(n);
    if (Storage.data.districts.includes(i + 1) || !this.isComplete(i)) return null;
    Storage.update((d) => d.districts.push(i + 1));
    Inventory.add(D.reward);
    return { index: i, name: this.name(i), reward: D.reward };
  },
};
