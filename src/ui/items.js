// Texto das ajudas ganhas: { hint: 2, undo: 1 } -> "+2 dicas · +1 desfazer"

import { t } from '../i18n/index.js';

export const ITEM_ICON = { hint: '💡', undo: '↩️', slot: '🅿️' };

export function itemsText(items, mult = 1) {
  const out = [];
  for (const k of ['hint', 'undo', 'slot']) if (items[k] > 0) out.push(`+${items[k] * mult} ${t(`items.${k}`, { n: items[k] * mult })}`);
  if (items.lives) out.push(t('items.lives'));
  return out.join(' · ');
}
