// Confere se pt-BR, en e es têm exatamente as mesmas chaves, sem textos vazios,
// e se os parâmetros {x} batem entre os idiomas.
// Uso: npm run test:i18n

import pt from '../src/i18n/pt-BR.js';
import en from '../src/i18n/en.js';
import es from '../src/i18n/es.js';

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const ref = new Map(flat(pt));
const errors = [];
for (const [name, lang] of [['en', en], ['es', es]]) {
  const m = new Map(flat(lang));
  for (const [k, v] of ref) {
    if (!m.has(k)) {
      errors.push(`${name}: falta "${k}"`);
      continue;
    }
    const w = m.get(k);
    if (Array.isArray(v) !== Array.isArray(w) || (Array.isArray(v) && v.length !== w.length)) errors.push(`${name}: "${k}" com formato diferente`);
    const params = (x) => [...String(x).matchAll(/\{(\w+)\}/g)].map((a) => a[1]).sort().join(',');
    if (params(v) !== params(w)) errors.push(`${name}: parâmetros diferentes em "${k}"`);
    if (!String(w).trim()) errors.push(`${name}: "${k}" vazio`);
  }
  for (const k of m.keys()) if (!ref.has(k)) errors.push(`${name}: chave extra "${k}"`);
}
for (const [k, v] of ref) if (!String(v).trim()) errors.push(`pt-BR: "${k}" vazio`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`✓ ${ref.size} textos presentes nos 3 idiomas`);
