// =============================================================================
// Analytics anônimo (Google Analytics for Firebase) – ÚNICO ponto de contato do
// jogo com o Firebase. Sem login, sem user id, sem dados pessoais.
// -----------------------------------------------------------------------------
//   track(name, params)        registra um evento (nunca lança erro, nunca trava)
//   applyConsent(consent)      chamado pelo AdManager quando o fluxo do UMP termina
//                              (e de novo se o jogador mudar a escolha em Ajustes)
//
// CONSENTIMENTO (UMP / TCF)
//   - O app abre com a coleta DESLIGADA (AndroidManifest:
//     firebase_analytics_collection_enabled = false) e com o Consent Mode negado.
//   - Enquanto o UMP não termina, os eventos ficam numa fila (máx. 100) – nada é
//     enviado antes da decisão.
//   - Onde o GDPR se aplica, a decisão vem da string TCF que o UMP grava no
//     aparelho (IABTCF_PurposeConsents), com o mapeamento do Google:
//       analytics_storage  = finalidade 1 (armazenar/acessar informações)
//       ad_storage         = finalidade 1
//       ad_user_data       = finalidades 1 e 7
//       ad_personalization = finalidades 3 e 4
//     Sem a finalidade 1: setEnabled(false) e a fila é descartada.
//   - Fora do GDPR (UMP "não exigido"): tudo concedido.
//   - UMP ainda "exigido" sem resposta (formulário falhou): nada concedido.
//   - Navegador (vite dev / build web): nada é enviado (não usamos o SDK web).
//
// NOMES: snake_case, até 40 caracteres, sem prefixos/nomes reservados do Firebase.
// =============================================================================

import { Capacitor, registerPlugin } from '@capacitor/core';
import { FirebaseAnalytics, ConsentType, ConsentStatus } from '@capacitor-firebase/analytics';

type Value = string | number | boolean;
type Params = Record<string, Value | Array<Record<string, Value>> | undefined | null>;

/** Plugin nativo do próprio app (MainActivity): lê a string TCF gravada pelo UMP. */
interface ConsentInfoPlugin {
  getTcf(): Promise<{ gdprApplies: number; purposeConsents: string }>;
}
const ConsentInfo = registerPlugin<ConsentInfoPlugin>('ConsentInfo');

const native = Capacitor.isNativePlatform();
const MAX_QUEUE = 100;

// Nomes de evento reservados pelo Firebase (coleta automática) e prefixos proibidos.
const RESERVED = new Set([
  'ad_activeview', 'ad_click', 'ad_exposure', 'ad_impression', 'ad_query', 'ad_reward', 'adunit_exposure',
  'app_background', 'app_clear_data', 'app_exception', 'app_remove', 'app_store_refund',
  'app_store_subscription_cancel', 'app_store_subscription_convert', 'app_store_subscription_renew',
  'app_update', 'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_app_update', 'dynamic_link_first_open',
  'error', 'first_open', 'first_visit', 'in_app_purchase', 'notification_dismiss', 'notification_foreground',
  'notification_open', 'notification_receive', 'os_update', 'screen_view', 'session_start', 'user_engagement',
]);
const RESERVED_PREFIX = /^(firebase_|google_|ga_)/;
const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;

export function validName(name: string): boolean {
  return NAME_RE.test(name) && !RESERVED.has(name) && !RESERVED_PREFIX.test(name);
}

/** Limpa os parâmetros: nomes válidos, textos até 100 caracteres, sem nulos. */
export function cleanParams(params: Params = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v == null || !NAME_RE.test(k) || RESERVED_PREFIX.test(k)) continue;
    if (Array.isArray(v)) out[k] = v.map((item) => cleanParams(item as Params));
    else if (typeof v === 'string') out[k] = v.slice(0, 100);
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    else if (Number.isFinite(v)) out[k] = v;
  }
  return out;
}

type State = 'pending' | 'granted' | 'denied';
let state: State = 'pending';
let queue: Array<{ name: string; params: Record<string, unknown> }> = [];

function send(name: string, params: Record<string, unknown>) {
  if (!native) return;
  try {
    FirebaseAnalytics.logEvent({ name, params }).catch(() => {});
  } catch {
    /* analytics nunca trava o jogo */
  }
}

/** Registra um evento. Seguro em qualquer situação (sem rede, sem Firebase, sem consentimento). */
export function track(name: string, params: Params = {}): void {
  try {
    if (!validName(name)) return;
    const p = cleanParams(params);
    if (state === 'granted') send(name, p);
    else if (state === 'pending' && queue.length < MAX_QUEUE) queue.push({ name, params: p });
  } catch {
    /* silencioso */
  }
}

export interface UmpConsent {
  status?: string; // AdmobConsentStatus: REQUIRED | NOT_REQUIRED | OBTAINED | UNKNOWN
  canRequestAds?: boolean;
}

/** Decide o consentimento a partir da string TCF (pura: testada em scripts/test-analytics.js). */
export function decideConsent(tcf: { gdprApplies?: number; purposeConsents?: string } | null, ump: UmpConsent = {}) {
  const applies = tcf?.gdprApplies === 1;
  // o UMP ainda exige consentimento (formulário não respondido/indisponível): nada concedido
  if (!applies && ump.status === 'REQUIRED') return { analytics: false, adStorage: false, adUserData: false, adPersonalization: false };
  if (!applies) return { analytics: true, adStorage: true, adUserData: true, adPersonalization: true };
  const pc = tcf?.purposeConsents ?? '';
  const has = (n: number) => pc.charAt(n - 1) === '1';
  return { analytics: has(1), adStorage: has(1), adUserData: has(1) && has(7), adPersonalization: has(3) && has(4) };
}

/** Chamado quando o fluxo do UMP termina (ou o jogador muda a escolha). */
export async function applyConsent(ump: UmpConsent = {}): Promise<void> {
  if (!native) {
    state = 'denied';
    queue = [];
    return;
  }
  try {
    let tcf: { gdprApplies?: number; purposeConsents?: string } | null = null;
    try {
      tcf = await ConsentInfo.getTcf();
    } catch {
      tcf = null; // sem a leitura TCF: segue a regra "GDPR não se aplica" (o UMP não exigiu)
    }
    const c = decideConsent(tcf, ump);
    const st = (ok: boolean) => (ok ? ConsentStatus.Granted : ConsentStatus.Denied);
    await Promise.all([
      FirebaseAnalytics.setConsent({ type: ConsentType.AnalyticsStorage, status: st(c.analytics) }),
      FirebaseAnalytics.setConsent({ type: ConsentType.AdStorage, status: st(c.adStorage) }),
      FirebaseAnalytics.setConsent({ type: ConsentType.AdUserData, status: st(c.adUserData) }),
      FirebaseAnalytics.setConsent({ type: ConsentType.AdPersonalization, status: st(c.adPersonalization) }),
    ]).catch(() => {});
    await FirebaseAnalytics.setEnabled({ enabled: c.analytics }).catch(() => {});
    state = c.analytics ? 'granted' : 'denied';
  } catch {
    state = 'denied';
  }
  const pending = queue;
  queue = [];
  if (state === 'granted') for (const e of pending) send(e.name, e.params);
}

/** Só para testes. */
export function _analyticsState() {
  return { state, queued: queue.length };
}
