# Analytics (Google Analytics for Firebase)

Anônimo: sem login, sem user id, sem dados pessoais. Código em `src/analytics.ts` (`track(name, params)`), testado em `npm run test:analytics`.

## Consentimento (UMP)
- O app abre com a coleta **desligada** (`firebase_analytics_collection_enabled = false` no AndroidManifest) e com o Consent Mode negado.
- Os eventos ficam numa fila até o fluxo do UMP terminar (`AdMobProvider.init` → `AdManager` → `applyConsent`). Nada é enviado antes.
- Onde o GDPR se aplica, a decisão vem da string TCF que o UMP grava no aparelho (lida pelo plugin nativo `ConsentInfoPlugin.java`):

| Consent Mode | Finalidades TCF |
|---|---|
| `analytics_storage` | 1 |
| `ad_storage` | 1 |
| `ad_user_data` | 1 e 7 |
| `ad_personalization` | 3 e 4 |

- Sem a finalidade 1: `FirebaseAnalytics.setEnabled({ enabled: false })` e a fila é descartada.
- Fora do GDPR (UMP "não exigido"): tudo concedido. Se o UMP ainda "exige" e não há resposta: nada concedido.
- O jogador pode mudar a escolha em Ajustes → Opções de privacidade: o analytics reavalia na hora.
- No navegador nada é enviado (o SDK web não é usado).

## Eventos

| Evento | Parâmetros | Quando |
|---|---|---|
| `level_start` | `level`, `attempt` | a fase começa (com vida disponível) |
| `level_end` | `level`, `result` (`win`/`lose`/`quit`), `moves_used`, `attempts`, `stars`*, `happy_lines`* | vitória; derrota confirmada (saiu da tela de derrota sem desfazer/vaga extra); saiu da fase no meio. Uma vez por tentativa. *só na vitória |
| `tutorial_complete` | – | 1ª vitória (ou pulo) da fase 10 |
| `challenge_skipped` | `level` | pulou um Desafio |
| `life_lost` | `level` | derrota gastou 1 vida |
| `out_of_lives_shown` | `level` | tela "Sem vidas" |
| `rewarded_ad_shown` | `placement` | o AdMob exibiu o recompensado |
| `rewarded_ad_watched` | `placement` | callback de recompensa do AdMob |
| `rewarded_ad_declined` | `placement` | fechou o anúncio antes da recompensa |
| `rewarded_ad_unavailable` | `placement` | não havia anúncio (sem rede/sem estoque) |
| `rewarded_offer_declined` | `placement` | tocou "Agora não" na oferta |
| `interstitial_shown` | `level` | intersticial exibido (saída da vitória) |
| `iap_offer_viewed` | `product_id`, `source` (`settings`/`out_of_lives`) | loja aberta, um por produto à venda |
| `purchase` | `product_id`, `value`, `currency`, `items[]` | compra aprovada (evento padrão do Firebase) |
| `ads_removed` | `product_id` | comprou o combo sem anúncios |
| `purchase_failed` | `product_id`, `reason` (`canceled`/`pending`/`error`) | compra não concluída |
| `purchase_restored` | `found` (0/1) | botão Restaurar compras |
| `unlock_achievement` | `achievement_id` | conquista desbloqueada (evento padrão) |

`placement`: `undo`, `hint`, `extra_slot`, `lose_undo`, `lose_extra_slot`, `refill_lives`.

Observação: o Firebase também registra sozinho `in_app_purchase` (Google Play). Para receita, use **um** dos dois nos relatórios (o nosso `purchase` traz `product_id`).

## google-services.json
- Nunca vai para o git (`.gitignore`). Sem ele o build funciona igual, só sem analytics.
- CI: secret **`GOOGLE_SERVICES_JSON_BASE64`** (o arquivo em base64). Os workflows `android-apk.yml` e `android-release.yml` gravam `android/app/google-services.json`, conferem o pacote `com.fsamplabs.buscrazypeople` e apagam o arquivo no fim (release).
- Local: copie o arquivo para `android/app/google-services.json`.
