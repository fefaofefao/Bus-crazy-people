// Testes do analytics (src/analytics.ts): nomes de eventos válidos para o Firebase,
// decisão de consentimento a partir do TCF (UMP) e fila antes do consentimento.
// Uso: npm run test:analytics

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const A = await import('../src/analytics.ts');
let n = 0;
const test = async (name, fn) => {
  await fn();
  n++;
  console.log('  ✓ ' + name);
};

// todos os track('nome', ...) do código
function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(js|ts)$/.test(f) ? [p] : [];
  });
}
const used = new Map();
for (const f of files(new URL('../src', import.meta.url).pathname)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\btrack\(\s*'([^']+)'/g)) used.set(m[1], f.split('/src/')[1]);
}

await test('todos os eventos do código são válidos no Firebase (snake_case, ≤ 40, não reservados)', () => {
  assert.ok(used.size >= 15, `poucos eventos encontrados: ${[...used.keys()]}`);
  for (const [name, file] of used) assert.ok(A.validName(name), `evento inválido "${name}" em ${file}`);
});

await test('eventos pedidos estão instrumentados', () => {
  const required = [
    'tutorial_complete', 'level_start', 'level_end', 'life_lost', 'out_of_lives_shown',
    'rewarded_ad_shown', 'rewarded_ad_watched', 'rewarded_ad_declined', 'interstitial_shown',
    'iap_offer_viewed', 'purchase', 'purchase_failed', 'ads_removed',
  ];
  for (const e of required) assert.ok(used.has(e), `falta o evento ${e}`);
});

await test('nomes reservados e inválidos são recusados', () => {
  for (const bad of ['ad_click', 'first_open', 'session_start', 'firebase_x', 'google_y', 'ga_z', 'Level', 'level-end', 'a'.repeat(41), '1abc'])
    assert.equal(A.validName(bad), false, bad);
  assert.equal(A.validName('a'.repeat(40)), true);
});

await test('parâmetros limpos: chaves inválidas fora, texto até 100, booleanos viram 0/1, items preservados', () => {
  const p = A.cleanParams({ level: 3, result: 'win', 'bad-key': 1, firebase_x: 2, long: 'x'.repeat(150), ok: true, none: null, nan: NaN, items: [{ item_id: 'infinite_lives', price: 9.99 }] });
  assert.deepEqual(Object.keys(p).sort(), ['items', 'level', 'long', 'ok', 'result']);
  assert.equal(p.long.length, 100);
  assert.equal(p.ok, 1);
  assert.deepEqual(p.items, [{ item_id: 'infinite_lives', price: 9.99 }]);
});

await test('consentimento: fora do GDPR tudo concedido; no GDPR segue as finalidades do TCF', () => {
  assert.deepEqual(A.decideConsent(null), { analytics: true, adStorage: true, adUserData: true, adPersonalization: true });
  assert.deepEqual(A.decideConsent({ gdprApplies: 0, purposeConsents: '' }), { analytics: true, adStorage: true, adUserData: true, adPersonalization: true });
  // aceitou tudo
  assert.deepEqual(A.decideConsent({ gdprApplies: 1, purposeConsents: '1111111111' }), { analytics: true, adStorage: true, adUserData: true, adPersonalization: true });
  // recusou tudo
  assert.equal(A.decideConsent({ gdprApplies: 1, purposeConsents: '0000000000' }).analytics, false);
  // GDPR mas sem string ainda (não respondeu): nada concedido
  assert.equal(A.decideConsent({ gdprApplies: 1, purposeConsents: '' }).analytics, false);
  // UMP ainda exige consentimento e não há TCF (formulário falhou): nada concedido
  assert.equal(A.decideConsent(null, { status: 'REQUIRED' }).analytics, false);
  assert.equal(A.decideConsent(null, { status: 'NOT_REQUIRED' }).analytics, true);
  // só finalidade 1: analytics sim, personalização não
  assert.deepEqual(A.decideConsent({ gdprApplies: 1, purposeConsents: '1000000' }), { analytics: true, adStorage: true, adUserData: false, adPersonalization: false });
});

await test('antes do UMP terminar os eventos ficam na fila; sem consentimento nada é enviado e a fila some', async () => {
  assert.equal(A._analyticsState().state, 'pending');
  A.track('level_start', { level: 1 });
  A.track('ad_click', {}); // reservado: ignorado
  assert.equal(A._analyticsState().queued, 1);
  await A.applyConsent({ status: 'NOT_REQUIRED' }); // em Node não é app nativo: nada é enviado
  assert.deepEqual(A._analyticsState(), { state: 'denied', queued: 0 });
  A.track('level_start', { level: 2 });
  assert.equal(A._analyticsState().queued, 0);
});

await test('track nunca lança erro, mesmo com entrada estranha', () => {
  A.track(undefined);
  A.track('level_end', { circular: { a: 1 } });
  A.track('level_end', 42);
});

console.log(`✓ ${n} testes de analytics passaram (${used.size} eventos: ${[...used.keys()].sort().join(', ')})`);
