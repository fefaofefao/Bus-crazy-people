# Guia de desenvolvimento de jogos (padrão Bus Crazy People)

Este guia reúne a tecnologia, a arquitetura e as boas práticas usadas no Bus Crazy People. Serve para começar outros jogos com a mesma qualidade, nesta ou em outras plataformas.

Ele é dividido em quatro partes:

- **O que usar:** seções 1 e 2.
- **Como organizar:** seções 3 a 6.
- **Como garantir qualidade:** seções 7 a 13.
- **Como publicar e ganhar dinheiro:** seções 14 a 17.

No fim há um checklist para começar um projeto novo (seção 18) e uma tabela de como portar para outras plataformas (seção 19).

---

## 1. Tecnologia

| Camada | Escolha | Por quê |
|---|---|---|
| Motor do jogo (2D) | **Phaser 3.90** | Maduro, leve, roda em qualquer WebView, tem cenas, tweens, partículas e input prontos. |
| Build web | **Vite 8** | Build rápido, ES modules, aceita TypeScript sem configuração, `import.meta.env` para modos de build. |
| App nativo | **Capacitor 8** (Android) | O mesmo código web vira app. Plugins nativos (anúncios, compras, vibração) são chamados em JS. |
| Anúncios | `@capacitor-community/admob` (Google Mobile Ads + **UMP** de consentimento) | Intersticial e recompensado com IDs de teste/reais separados. |
| Compras | `@capgo/native-purchases` (Google Play Billing 9) | Produto único (não consumível), restauração, compra pendente. |
| Analytics | `@capacitor-firebase/analytics` (SDK **nativo**; o SDK web não é usado) | Anônimo, ligado só após o consentimento. |
| Vibração / botão voltar | `@capacitor/haptics`, `@capacitor/app` | Sensação de toque e botão voltar do Android. |
| Fontes | `@fontsource/lilita-one` (títulos), `@fontsource/fredoka` (texto) | Embutidas no app, funcionam offline, licença OFL. |
| Áudio | **WebAudio sintetizado** (sem arquivos de som) | Sem peso de download, sem licenças, tudo ajustável em código. |
| Testes | **Node puro** (`node:assert`), sem framework | Zero dependência e roda em segundos no CI. |
| Screenshots / QA visual | **Playwright** (Chromium headless) | Capturas da loja e auditoria visual automáticas. |
| CI/CD | **GitHub Actions** | APK de debug a cada push; AAB assinado sob demanda; GitHub Pages para a política. |

**Versões Android:** `minSdk 24`, `targetSdk/compileSdk 36`, Java 21, Gradle 8.14, AGP 8.13.

---

## 2. Estrutura de pastas

```
src/
  core/        regras PURAS do jogo (sem Phaser, sem DOM): engine, solver, generator, rules, stars, prng
  scenes/      telas Phaser (Boot, Language, Menu, Levels, Game, Achievements, Settings)
  services/    ÚNICOS pontos de contato com o mundo externo:
               Storage, Progress, Lives, Achievements, AdManager, PurchaseManager, Sound, Music, Haptics
    ads/       providers de anúncio (AdMobProvider real / TestAdProvider no navegador)
    purchases/ providers de compra (PlayBillingProvider / TestPurchaseProvider) + manager.js (lógica pura)
  ui/          componentes visuais (Button + buttonSkin, ícones, arte, cenário, janelas HTML)
  i18n/        textos pt-BR / en / es (mesmas chaves)
  analytics.ts wrapper do Firebase (track + consentimento)
  config.js    TODAS as constantes ajustáveis (cores, regras de anúncio, vidas, produtos, animações)
levels/        fases em JSON (tutorial feito à mão + pacote gerado)
scripts/       geradores, testes, sincronização de IDs, capturas da loja
config/        IDs reais (AdMob) — único lugar para trocar
docs/          documentação viva (formato de fase, identidade, UX, analytics, publicação)
android/       projeto nativo gerado pelo Capacitor (versionado, com ajustes)
.github/       workflows de CI/CD
```

**Regra de ouro:** cada responsabilidade tem **um** dono.

- Quer mudar regra de anúncio? Só `AdManager` + `config.js`.
- Quer mudar regra do jogo? Só `core/engine.js`.

---

## 3. Arquitetura: as 6 decisões que mais pesaram

1. **Lógica pura separada da tela.**
   - `src/core/engine.js` não conhece Phaser nem DOM: recebe um estado, devolve um estado novo e uma lista de **eventos** (`exit`, `board`, `depart`, `bump`, `mood`…).
   - A cena só **anima os eventos**.
   - Ganhos: o mesmo motor roda no jogo, no solver, no gerador e nos testes. Desfazer fica trivial (guardar estados). Portar para outro motor gráfico reaproveita 100% das regras.

2. **Estado imutável por jogada.**
   - `tap(level, state, busId)` nunca altera `state`.
   - Isso permite desfazer, dica (o solver testa jogadas sem medo) e replay de soluções.

3. **Determinismo.**
   - Nada de `Math.random()` no núcleo: um PRNG com semente (`core/prng.js`).
   - Mesma semente = mesma fase, então o pacote de fases é reprodutível e versionado (`PACK_VERSION`).

4. **Serviços como única porta para o mundo externo.**
   - `AdManager`, `PurchaseManager`, `Storage` e `analytics.ts`: o resto do jogo nunca importa um plugin nativo diretamente.
   - Trocar AdMob por outro provedor, ou Play Billing pela App Store, mexe em **um** arquivo.

5. **Padrão "provider" com implementação de teste.**
   - Cada serviço externo tem a versão real (nativa) e a de teste (navegador), com o **mesmo contrato**. Exemplos: `TestAdProvider` mostra um "anúncio" com contagem; `TestPurchaseProvider` simula a confirmação da Google Play.
   - Dá para testar tudo no navegador e no CI sem celular.

6. **Configuração centralizada.**
   - `config.js` concentra cores, tempos de animação, vidas, regras de intersticial e produtos.
   - IDs reais ficam em `config/ads.json`.
   - Ajustar o jogo é editar um número, sem caçar pelo código.

---

## 4. Conteúdo gerado por algoritmo e validado por computador

Para jogos de puzzle, **nunca publique uma fase que não foi provada solucionável**.

- **Solver** (`core/solver.js`):
  - busca em profundidade com memória de estados sem saída;
  - prova se há solução, e é a mesma rotina da **dica** do jogo;
  - modo `keepHappy` para provar que 3 estrelas são possíveis.
- **Gerador** (`core/generator.js`):
  - constrói a fase de trás para frente (garante uma ordem válida);
  - depois mede a dificuldade com métricas objetivas:
    - `randomWin`: quanto um jogador aleatório vence;
    - `greedyWin`: quanto um jogador "ingênuo" vence;
    - `traps`: jogadas que levam a beco sem saída, provadas pelo solver;
    - `starTraps`: jogadas que perdem as 3 estrelas.
- **Curva de dificuldade** (`scripts/generator-config.js`):
  - meta de dificuldade crescente;
  - suavização em janelas;
  - "despike" (remove picos isolados);
  - estreia de cada mecânica numa fase própria;
  - Desafios a cada 10 fases, garantidamente mais difíceis que a dezena.
- **Teste do pacote inteiro** (`npm run test:levels`): estrutura, solução gravada vence, solver independente acha solução, sem picos, regras de estreia.

Isso vale para qualquer gênero com fases: plataforma (simulação de alcance de pulo), match-3 (simulação de cascatas), labirinto (busca de caminho).

---

## 5. Save do jogador (nunca perder progresso)

`services/Storage.js`:

- **Validação campo a campo** (`sanitize`): valor inválido volta ao padrão em vez de quebrar o jogo.
- **Cópia de segurança**: duas chaves no `localStorage`. Se a principal corromper, usa a cópia.
- **`schema`** no save, com ponto de migração em `load()` para versões futuras.
- Erros de armazenamento (modo privado, cota cheia) são ignorados: o jogo segue em memória.
- "Zerar progresso" preserva idioma, preferências e **compras**.

---

## 6. Monetização com respeito ao jogador

### Anúncios (`services/AdManager.js`)
- **Sem banners.**
- **Intersticial:**
  - só ao **sair** da tela de vitória, nunca no meio da partida;
  - nenhum antes de vencer a fase 11;
  - no mínimo 3 vitórias **e** 120 s desde o anterior.
- **Recompensado:**
  - sempre opcional, com pergunta clara antes e selo ▶ nos botões que abrem anúncio;
  - a recompensa só vem no **callback de recompensa** do SDK; sem anúncio disponível, mensagem amigável e nada é perdido.
- **Robustez:** tudo em `try/catch`; promessas sempre resolvem; nenhum erro de anúncio trava o jogo.
- **Consentimento (UMP):** o formulário aparece antes de pedir qualquer anúncio, e há o botão "Opções de privacidade" em Ajustes.
- **IDs:**
  - builds de teste usam os IDs de teste do Google;
  - o build da loja **falha** se os IDs reais ainda forem provisórios (`scripts/sync-admob-id.js`).
- **`app-ads.txt`** publicado na raiz do site do desenvolvedor.

### Compras (`services/purchases/`)
- **Produtos únicos.** A lista com o que cada um libera fica em `config.js`.
- **Preço da loja na moeda local**, com o preço do `config.js` como reserva.
- **Casos tratados e testados com uma loja simulada:**
  - compra aprovada;
  - cancelada (não é erro);
  - **pendente** (boleto/Pix);
  - **"você já tem este item"** (restaura);
  - **reembolso** (retira ao abrir o app);
  - loja fora do ar (**não** tira o que já foi comprado).
- **Confirmação automática da compra** (a Google reembolsa compras não confirmadas em 3 dias).
- **Restaurar compras** em Ajustes, e a conta é conferida a cada abertura.

### Vidas
- **Regras:** 3 vidas, recarga por relógio (funciona com o app fechado), tutorial grátis.
- **Recuperar a vida:** a vida volta se o jogador se recupera na tela de derrota.
- **Sem vidas:** a tela mostra a contagem ao vivo, um anúncio que enche as vidas e a oferta de vidas infinitas.

---

## 7. Analytics anônimo e consentimento

`src/analytics.ts` (detalhes em `docs/ANALYTICS.md`):

- **Um** wrapper `track(name, params)` com `try/catch` silencioso: analytics nunca trava o jogo.
- **Validação dos nomes:** snake_case, até 40 caracteres, sem nomes ou prefixos reservados do Firebase, coberto por teste automático.
- **Coleta começa desligada** no AndroidManifest. Os eventos ficam numa fila até o UMP terminar.
- **Decisão pela string TCF:**
  - lida por um plugin nativo pequeno (`ConsentInfoPlugin.java`);
  - mapeamento oficial do Google Consent Mode;
  - se a finalidade 1 for negada, `setEnabled(false)` e a fila é descartada.
- **Eventos que respondem perguntas de negócio:**
  - funil de fases (`level_start`/`level_end` com resultado e tentativas);
  - vidas;
  - anúncios por posição (`placement`);
  - ofertas e compras (evento padrão `purchase`);
  - tutorial concluído.
- **Arquivo do Firebase:** `google-services.json` **nunca no git**. No CI vem de um secret em base64, e o build funciona sem ele.

---

## 8. Testes (o que dá segurança para mudar)

`npm test` roda tudo em segundos, sem celular:

| Suíte | Garante |
|---|---|
| `test-engine.js` | Regras do motor (embarque, batida, cadeado, obra, terminal, filas, humor, estrelas), solver e dica. |
| `test-levels.js` | 300 fases válidas, solucionáveis, com 3 estrelas possíveis, curva sem picos, Desafios mais difíceis. |
| `test-ads.js` | Regras do intersticial em 400 vitórias simuladas, recompensa só no callback, falhas do SDK. |
| `test-purchases.js` | 14 cenários com a Google Play simulada (ver seção 6). |
| `test-analytics.js` | Nomes de eventos válidos, consentimento TCF, fila antes do UMP. |
| `test-i18n.js` | Todas as chaves existem nos 3 idiomas. |
| `test-progress.js` | Estrelas, conquistas, vidas e save corrompido. |

**Boas práticas:**
- **Teste a lógica, não a tela.** Por isso a lógica é pura.
- **Simule o mundo externo** (loja, SDK de anúncio) no formato exato do plugin real. Leia o código-fonte do plugin para saber como ele reporta erros. Exemplo real: o cancelamento vem no `code` (`USER_CANCELED`), não na mensagem.
- **O CI roda os testes antes de qualquer build:** um build quebrado não chega à loja.

---

## 9. QA visual automatizado

Com Playwright (scripts em `scripts/store-assets.cjs` e auditorias pontuais):

- **Capturar todas as telas em vários tamanhos:** celular pequeno (360×640), celular alto (390×844), tablet (800×1280) e paisagem (1280×800).
- **Recortar e ampliar** regiões (bordas, sobreposições) para revisão.
- **Jogar fases inteiras** pela solução gravada e conferir vitória, estrelas e erros do console.
- **Gerar as capturas da loja** nos 3 idiomas a partir do jogo real, para que elas nunca fiquem desatualizadas.
- **Dica:** Phaser no Chromium headless é lento (sem GPU). Use `--use-angle=swiftshader` e espere as animações terminarem antes do print.

---

## 10. Identidade visual e acabamento

Detalhes em `docs/IDENTIDADE.md`. Princípios reaproveitáveis:

- **Tokens de cor** em um só lugar (`config.js` e variáveis CSS), com nomes semânticos: `button`, `buttonAd`, `buttonSuccess`, `challenge`, `ink`.
- **Estilo coerente.** O estilo "adesivo" usa contorno azul-marinho (`ink`), sombra e fonte de letreiro.
- **Pele de botão compartilhada** (`ui/buttonSkin.js`):
  - degradê contínuo, brilho que some aos poucos, base 3D na própria cor, sombra suave e estado apertado;
  - desenhada uma vez em canvas e **cacheada como textura** por tamanho, cor e estado;
  - o CSS das janelas HTML imita a mesma pele com `color-mix`.
- **Formas opacas** em cenários sobrepostos: translucidez em formas que se cruzam gera "bordas fantasmas".
- **Movimento calmo** em telas de descanso (menu): animações lentas e respirando. Rapidez fica para feedback de ação.
- **Juice com propósito:**
  - cada ação tem som, vibração leve e animação curta;
  - combos, confete na vitória, fila que treme quando fica nervosa;
  - nada disso atrasa o input: o toque feito durante uma animação é guardado e executado depois.
- **Áudio:**
  - vinheta curta e marcante ao abrir;
  - trilha calma no menu e outra na partida, com crossfade;
  - sons e música com chaves separadas.

---

## 11. UX (o que o jogador sente)

Detalhes em `docs/UX_REVIEW.md`. Regras gerais:

- **Toque confiável:**
  - a ação acontece ao **soltar** o dedo;
  - arrastar para fora cancela;
  - área de toque ≥ 46 px.
- **Sair sem querer** é evitado: pausa em vez de sair direto, e confirmação se houver progresso na fase.
- **Informação para planejar:**
  - a fila inteira visível sob demanda;
  - capacidade visível;
  - aviso de "última vaga";
  - a derrota explica o que faltou.
- **Anti-frustração:**
  - desfazer grátis e reinício instantâneo;
  - dica que nunca cobra quando não há saída;
  - dicas do mascote depois de derrotas repetidas.
- **Ensinar jogando:**
  - tutorial curto com uma regra nova por fase e mãozinha de dica;
  - cartão "Novidade!" e destaque na primeira vez de cada mecânica.
- **Pontuação que se vê:** as estrelas caem na hora, e cada fila tem uma carinha de humor.
- **Acessibilidade:**
  - modo daltônico, com símbolo por cor;
  - contraste alto;
  - vibração opcional;
  - textos com contorno.
- **Botão voltar do Android** sempre faz algo sensato.

---

## 12. Internacionalização

- Um arquivo por idioma (`src/i18n/pt-BR.js`, `en.js`, `es.js`) com as **mesmas chaves**, conferidas por teste.
- Placeholders (`{n}`, `{color}`) e plurais (`one`/`other`).
- **Tudo é traduzido:** a política de privacidade, as capturas da loja e as notas da versão também saem nos 3 idiomas.
- **Textos curtos de UI:** depois de traduzir, confira se cabem (exemplo real: o balão do tutorial cortava 3 linhas).

---

## 13. Android: armadilhas que já resolvemos

- **Ponta a ponta (Android 15+):** `EdgeToEdge.enable` na Activity, com as áreas seguras lidas por CSS `env(safe-area-inset-*)` e aplicadas ao layout.
- **Barra de título fantasma:**
  - chame `setTheme(AppTheme.NoActionBar)` **antes** de `EdgeToEdge.enable`;
  - defina `postSplashScreenTheme`;
  - sem isso, aparece a barra "Nome do app" com a imagem da abertura esticada.
- **Orientação:**
  - retrato só em celulares;
  - tablets podem girar, porque o Android 16 ignora a trava em telas grandes, e o layout precisa se adaptar.
- **Autoplay de áudio:** a WebView precisa liberar mídia sem gesto, para a vinheta de abertura tocar.
- **`google-services.json`:** aplique o plugin só **se o arquivo existir**, para o build nunca quebrar sem ele.
- **Permissões mínimas:** `INTERNET`, `VIBRATE` e `AD_ID` (a de anúncios precisa ser declarada).

---

## 14. CI/CD e versionamento

- **APK de debug** a cada push: testes → build → APK como artefato.
- **AAB de release sob demanda** (workflow manual):
  - testes → confere os IDs do AdMob → build de release → assina com a chave de upload dos **secrets** → gera AAB e APK.
- **Secrets necessários:**
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `GOOGLE_SERVICES_JSON_BASE64` (opcional)
- **Arquivos temporários** são apagados no fim do job.
- **versionCode:**
  - é o maior entre o número da execução do CI e um mínimo no `build.gradle` (`VERSION_CODE_MIN`), e sobe sozinho;
  - suba o mínimo a cada versão enviada à Play.
- **versionName** vem do `package.json`.
- **Nunca no git:** keystore, senhas, `google-services.json` e `.env` (protegidos pelo `.gitignore`).
- **Chave de upload + Play App Signing:** se perder a chave de upload, dá para pedir a redefinição.
- **Commits por marco**, com mensagem que explica o *porquê*.

---

## 15. Publicação na Google Play

Passo a passo completo em `docs/PUBLICACAO.md`. Resumo:

- **Ficha da loja nos 3 idiomas** (textos em `STORE_LISTING.md`, imagens geradas pelo próprio jogo).
- **Política de privacidade pública** (GitHub Pages), que cita cada SDK de terceiros, e link para ela dentro do app.
- **Formulários do Console preenchidos a partir dos SDKs detectados:**
  - Segurança dos dados;
  - Anúncios;
  - ID de publicidade;
  - IARC;
  - público-alvo 13+ (evita o programa Famílias).
- **Conta pessoal nova:** teste fechado com **12 ou mais testadores por 14 dias** antes da produção.
- **Auditoria antes de cada envio:** use a skill `/conformidade` (pacote, targetSdk, permissões, IDs reais, segredos, ficha).

---

## 16. Documentação viva

Cada decisão importante tem um documento curto em `docs/`, atualizado **no mesmo commit** da mudança:

- `LEVEL_FORMAT.md` (formato de dados);
- `IDENTIDADE.md` (marca);
- `UX_REVIEW.md` (problemas e soluções);
- `ANALYTICS.md` (eventos);
- `PUBLICACAO.md` (loja);
- `ROADMAP.md` (próximas versões).

O README explica como rodar, testar, gerar e publicar.

---

## 17. Fluxo de trabalho que funcionou

1. **Especificar regras e restrições antes de codar:** monetização, curva de dificuldade, plataformas.
2. **Motor puro com testes** e depois a tela.
3. **Conteúdo gerado e validado por solver;** métricas de dificuldade, nunca "no olho".
4. **QA visual com prints** a cada rodada de mudanças visuais.
5. **Simular o mundo externo** (loja, anúncios, consentimento) e ler o código dos plugins.
6. **Auditoria de publicação** antes de cada AAB.
7. **Medir com analytics** e ajustar a dificuldade com dados reais.

---

## 18. Checklist para um jogo novo

- [ ] Copiar a estrutura de pastas e os serviços (`Storage`, `AdManager`, `PurchaseManager`, `analytics.ts`, `Sound`, `Music`, `Haptics`, `BackButton`).
- [ ] Definir `applicationId` **definitivo** (ex.: `com.fsamplabs.<jogo>`) antes do 1º envio.
- [ ] `config.js` com cores (tokens), regras de anúncio, vidas e produtos.
- [ ] Motor puro em `src/core` + `test-engine.js`.
- [ ] Se tiver fases: gerador com semente + solver + `test-levels.js`.
- [ ] i18n desde o 1º texto + `test-i18n.js`.
- [ ] Pele de botão e identidade (contorno, sombras, fontes embutidas).
- [ ] Áudio sintetizado ou com licença clara; vinheta de abertura.
- [ ] Ponta a ponta + áreas seguras + tablets e paisagem testados.
- [ ] AdMob (IDs de teste, UMP, `app-ads.txt`), compras (produtos únicos + restaurar), analytics anônimo após consentimento.
- [ ] Workflows (APK debug no push, AAB release manual), secrets, `.gitignore` com chaves.
- [ ] Política de privacidade pública + Segurança dos dados coerente.
- [ ] Capturas da loja geradas pelo jogo nos idiomas da ficha.
- [ ] `/conformidade` verde → teste fechado (12+ testadores, 14 dias) → produção.

---

## 19. Levando para outras plataformas

| Plataforma | O que muda | O que fica igual |
|---|---|---|
| **iOS (App Store)** | `npx cap add ios`; StoreKit no lugar do Play Billing (o mesmo plugin `@capgo/native-purchases` suporta); ATT (App Tracking Transparency) antes de anúncios personalizados; Privacy Manifest; TestFlight no lugar do teste fechado. | `core`, cenas, serviços (só os providers), i18n, testes. |
| **Web / PWA** | Sem plugins nativos: anúncios via AdSense for Games/H5 ou nenhum; compras via Stripe; analytics via SDK web (com banner de cookies). | Quase tudo; o `TestAdProvider`/`TestPurchaseProvider` vira a base dos providers web. |
| **Steam / desktop** | Empacotar com Electron ou Tauri; sem anúncios; venda única ou DLC; conquistas via Steamworks; suporte a mouse, teclado e controle. | `core`, conteúdo gerado, testes, identidade. |
| **Unity / Godot** | Reescrever a camada visual; portar `src/core` (lógica pura) para C# ou GDScript **com os mesmos testes** (os JSON de fases são reaproveitáveis). | A arquitetura (núcleo puro, serviços, providers), regras de monetização, UX, pipeline de publicação. |

**Princípio que torna isso possível:** regras puras + serviços com contrato + providers trocáveis. Quanto menos o jogo souber da plataforma, mais barato é portar.
