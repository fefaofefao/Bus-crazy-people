# Bus Crazy People

Puzzle casual de ônibus ("bus jam") para Android, ambientado numa cidade brasileira. O diferencial é ser **justo**:
- as 300 fases têm solução garantida;
- a dificuldade sobe aos poucos;
- os anúncios aparecem só em momentos naturais.

- **Tecnologia:** Phaser 3 + Vite (JavaScript), empacotado com Capacitor 8 (Android). É a mesma stack do Life Direction, de onde vieram a base de toque, anúncios, compras, salvamento, idiomas e os workflows.
- **Pacote:** `com.fsamplabs.buscrazypeople`. **É definitivo:** a Play Store não deixa trocar depois do 1º envio.
- **Android:** minSdk 24 (Android 7+, cobre o 8.0+ pedido), target/compileSdk 36.
- **Offline:** o jogo funciona 100% sem internet. Os anúncios só aparecem quando há conexão.

---

## 1. Como testar

### No computador

```bash
npm install
npm run dev          # http://localhost:5173 (use o modo celular do DevTools)
```

| Comando | O que faz |
|---|---|
| `npm test` | testa tudo: motor (regras), as 300 fases com o solver, regras de anúncio e os 3 idiomas |
| `npm run test:levels` | valida o pacote de fases: estrutura, solução gravada, solver independente, Desafios e curva sem picos |
| `npm run levels:generate` | regera `levels/levels.json` (cerca de 2–3 min) |
| `npm run build` | versão web em `dist/` |
| `npm run cap:sync` | build + copia para o projeto Android |

### No celular (APK de debug)

1. Cada push roda `.github/workflows/android-apk.yml`: testes, build e APK.
2. Vá em **Actions → "Android APK (debug)" → execução mais recente → Artifacts → `bus-crazy-people-debug-apk`**.
3. Extraia o `app-debug.apk` e instale (permita "instalar apps desconhecidos").

O APK de debug usa **anúncios de teste do Google**, então pode clicar à vontade.

### Modo debug

Abra com **`?debug=1`** (ex.: `http://localhost:5173/?debug=1`). Ele nunca funciona no build da loja. O botão rosa **DEBUG** permite:
- ir para qualquer fase;
- mostrar a ordem de solução sobre os ônibus;
- liberar todas as fases;
- simular "anúncios removidos";
- zerar o timer do intersticial;
- ver as métricas da fase (score, vitória aleatória, semente).

---

## 2. Como o jogo funciona

**Regras** (todas em `src/core/engine.js`, código puro sem Phaser, usado pelo jogo, pelo solver e pelos testes):
- Toque num ônibus. Se o caminho até a borda estiver livre, ele sai e ocupa uma **vaga de embarque**; se estiver bloqueado, avança, **bate e volta** (com vibração leve). As duas coisas contam como jogada.
- O passageiro da frente embarca sozinho no ônibus da mesma cor que está numa vaga. Os ônibus levam 4, 6 ou 8 passageiros, conforme o tamanho. Ônibus cheio parte e libera a vaga.
- **Vitória:** todos embarcaram. **Derrota:** todas as vagas ocupadas sem a cor do próximo passageiro.
- **Passageiros prioritários** (com relógio): precisam embarcar antes de a paciência, contada em jogadas, chegar a zero.

**Mecânicas que vão aparecendo** (todas determinísticas, então o solver continua provando que há solução; pesquisa e justificativas em `docs/PESQUISA_MECANICAS.md`):

| Mecânica | Estreia | Regra |
|---|---|---|
| Ônibus coberto | fase 31 | a cor só aparece quando a frente fica livre |
| Obra (cones) | fase 55 | casa bloqueada até a jogada N |
| Cadeado e chave | fase 81 | só sai depois que o ônibus-chave sair |
| Terminal | fase 111 | solta novos ônibus quando a saída fica livre |

Cada mecânica estreia sozinha, com o cartão "Novidade!", e depois se mistura às outras. Há ainda o **Combo** (vários ônibus partindo com um toque) e a derrota "Trânsito travado" (nenhum ônibus consegue mais sair).

**Filas e humor (a base das estrelas):**
- O ponto tem **3 filas** (1 nas fases 1–3 e 2 nas fases 4–6, para aprender). O primeiro de **qualquer** fila embarca no ônibus da sua cor, em rodízio entre as filas.
- Cada fila tem um **humor**: 😊 feliz → 😟 impaciente → 😠 nervosa. Se uma fila passa `calm` jogadas seguidas sem ninguém embarcar (batidas contam), ela piora um nível. O humor **não melhora**.
- Na tela, a carinha à esquerda de cada fila mostra o humor, e os pontinhos embaixo mostram quantas jogadas ela ainda aguenta. Os passageiros mudam de cara junto, e a fila treme e resmunga quando piora.

**Estrelas (1 a 3 por fase) = filas felizes no fim:**
- **3 filas felizes = ★★★ (perfeito)**, 2 = ★★, 1 ou nenhuma = ★ (ruim). Com menos filas (tutorial), cada fila infeliz tira 1 estrela.
- As estrelas no topo caem na hora em que uma fila deixa de estar feliz. A tela de fases guarda o melhor resultado.
- O gerador usa a paciência **mais apertada** que ainda permite 3 estrelas (o solver procura a ordem) e soma uma folga que cai de 2 para 0 ao longo do jogo (0 nos Desafios). A solução gravada deixa as 3 filas felizes e não tem batidas, então 3 estrelas são sempre possíveis (conferido em `npm run test:levels`).
- Desfazer volta o humor junto com a jogada. Dica aponta, quando dá, uma jogada que mantém todas as filas felizes.
- Regras em `src/core/engine.js` (HUMOR DAS FILAS) e `src/core/stars.js`.

**Conquistas** (18, tela própria no menu, em `src/services/Achievements.js`):
- fases vencidas (1, 25, 100, 200, todas);
- estrelas (75, 300, 600, todas);
- Desafios (1, 10, todos, um com 3★);
- 10 vitórias seguidas com 3★;
- combo triplo;
- 25 passageiros com pressa;
- vencer com as 4 mecânicas.

São só medalhas, sem moeda nem vantagem paga.

**Dificuldade: desafio moderado, de propósito.** Nem fácil demais, nem impossível. Regras garantidas pelo gerador e conferidas em `npm run test:levels` (parâmetros em `scripts/generator-config.js`):
- **Armadilhas obrigatórias:** a partir da fase 15, toda fase tem pelo menos 1 toque que leva a um beco sem saída ou que já impede as 3 filas felizes (provado pelo solver); 2 a partir da fase 60 e 3 a partir da 150. As fases de estreia das mecânicas são exceção, porque servem para aprender.
- **Teto de crueldade:** um jogador "ingênuo", que só segue a cor da frente, vence pelo menos 15% das vezes nas fases normais e 5% nos Desafios.
- **Vagas:** o padrão é 4 (com 3 filas, 4 vagas apertam como 5 apertavam com 1 fila); algumas fases a partir da 60 usam 3. Os Desafios têm 3 vagas desde a fase 30.
- **Prioritários:** a folga dos passageiros com pressa cai de 3 para 1 jogada.
- **Desafios (10, 20, 30…, 300) = a fase mais difícil da dezena**, garantido pelo teste:
  - pontuação acima da fase normal mais difícil da dezena (+8);
  - o dobro de armadilhas (mínimo 3);
  - o jogador "ingênuo" vence no máximo 45% → 30% das vezes (e no mínimo 5%);
  - tamanho de fase ~120 níveis à frente e 1 vaga a menos.
  A fase 10 é o primeiro Desafio (feita à mão, 3 vagas, sem mãozinha de dica). Para refazer só os Desafios: `node scripts/generate-levels.js --only-challenges` (~3 min).

**Vidas (3):**
- Cada **derrota gasta 1 vida**. Vencer nunca gasta, e as fases 1–10 (tutorial e 1º Desafio) não gastam.
- Se o jogador se recupera na própria tela de derrota (desfazer ou vaga extra), a vida é **devolvida**.
- **Sem vidas:** esperar a recarga (**1 vida a cada 20 min**, contada pelo relógio, mesmo com o app fechado) ou **assistir a um anúncio** que enche as 3. Quando uma vida volta, a tela "Sem vidas" libera o jogo sozinha.
- As vidas aparecem no menu e na lista de fases, com a contagem até a próxima.
- Ajustes em `CONFIG.lives` (`src/config.js`); lógica em `src/services/Lives.js`, testada em `npm run test:progress`.

**Anti-frustração:**
- 1 desfazer grátis por fase;
- desfazer extra, **vaga extra** (temporária) e **dica** (a próxima jogada certa, calculada pelo solver), todos via anúncio recompensado;
- reiniciar é grátis e instantâneo.

A dica nunca cobra anúncio quando não há saída: nesse caso, ela avisa para desfazer ou reiniciar.

**Som:** vinheta de abertura "fon-fon, ta-ra-rá!" (assinatura da marca, toca ao abrir o app), trilha calma "Bossa da Orla" no menu e "Samba do Ponto" na partida. Tudo é sintetizado por código em `src/services/Music.js`, sem arquivos de áudio.

**UX:** revisão completa em `docs/UX_REVIEW.md`:
- ônibus sai ao soltar o dedo;
- toque guardado durante a animação;
- pausa no lugar de "sair";
- aviso de última vaga;
- lugares visíveis no teto dos ônibus;
- fila completa ao tocar no +N;
- "Tentar 3 estrelas";
- dicas do Tião depois de derrotas repetidas.

**Acessibilidade:** modo daltônico com um símbolo único por cor (●▲★■◆✚♥⬢) em ônibus e passageiros, e paleta de 8 cores bem distintas.

### Fases: solver + gerador

- `levels/tutorial.json`: fases 1–10 **feitas à mão**, com uma regra nova por fase, texto de dica e mãozinha mostrando a jogada.
- `src/core/solver.js`: busca em profundidade com memória de estados sem saída. É **completa**: prova que há solução, ou que não há, sem boosters.
- `src/core/generator.js`: monta o estacionamento por construção reversa, constrói a fila simulando a ordem pretendida com as regras reais e **só aceita fases aprovadas pelo solver**. Mede a dificuldade com:
  - vitória de um jogador aleatório;
  - vitória de um jogador "guloso" (que segue a cor da frente);
  - **jogadas erradas possíveis** (toques que levam a um beco sem saída, provados pelo solver);
  - prioritários e vagas.
- `scripts/generate-levels.js` + `scripts/generator-config.js`: geram as fases 11–300 com semente fixa. Cada fase é a candidata mais próxima de uma meta de dificuldade crescente, com suavização em janelas para evitar picos. **A cada 10 fases (10, 20, …, 300) há um Desafio**: a fase mais difícil da dezena, marcado em laranja e **opcional**, porque a fase seguinte já fica liberada e dá para pular.
- O pacote é **igual para todos** os jogadores. Se as fases mudarem depois de publicadas, aumente `PACK_VERSION` em `scripts/generate-levels.js`.
- O formato JSON está documentado em `docs/LEVEL_FORMAT.md` e já tem `mechanics: []` para as mecânicas futuras (`docs/ROADMAP.md`).

---

## 3. Anúncios e compras

### AdMob

Os IDs reais ficam num único arquivo: **`config/ads.json`**.
- Enquanto ele tiver `XXXX`, todos os builds usam os IDs de **teste** do Google.
- O build da loja **falha de propósito**, para nunca publicar sem IDs reais. Para o teste fechado, há a opção `test_ads` no workflow.

Regras do **intersticial** (`CONFIG.ads.interstitial` em `src/config.js`, testadas em `npm run test:ads`):
- aparece só ao **sair da tela de vitória** (botões "Próxima fase" ou "Fases"), nunca no início de fase nem durante a partida;
- nunca antes de vencer a fase 11;
- exige no mínimo **3 vitórias E 120 segundos** desde o último (o tempo também conta desde a abertura do app);
- se não houver anúncio pronto (sem internet, por exemplo), o jogo segue sem esperar.

**Recompensado:**
- é sempre escolha do jogador, com uma pergunta antes;
- a recompensa só é entregue no **callback de recompensa** do SDK;
- se falhar, não carregar ou for fechado antes, aparece uma mensagem amigável e nada é perdido;
- todos os erros são tratados, e nenhuma Promise fica pendurada.

Não há banners. O consentimento **UMP** (UE/Reino Unido) aparece antes de pedir anúncios, e o botão "Opções de privacidade (anúncios)" aparece em Ajustes quando o Google exige.

### Remover anúncios (Play Billing)

- Produto **não consumível `remove_ads`**, com Google Play Billing real via `@capgo/native-purchases`. O plugin reconhece a compra automaticamente.
- Desliga os **intersticiais**. Os recompensados continuam disponíveis, como opção.
- **Restaurar compras** em Ajustes. Ao abrir o app, ele também confere a compra na conta Google (útil ao reinstalar ou em caso de reembolso).
- No navegador e no modo debug aparece uma compra **de teste** simulada.

---

## 4. O que VOCÊ precisa fazer (passo a passo manual)

### 4.1 Chave de assinatura e secrets do GitHub

1. Gere a chave de upload. Faça isso **uma vez** e guarde o arquivo e a senha em dois lugares seguros. **Nunca** coloque no repositório.
   ```bash
   keytool -genkeypair -v -keystore bus-crazy-people-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 bus-crazy-people-upload.jks > ANDROID_KEYSTORE_BASE64.txt     # no macOS: base64 -i ... -o ...
   ```
2. No GitHub, em **Settings → Secrets and variables → Actions → New repository secret**, cadastre:

| Secret | Obrigatório | Conteúdo |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | sim | conteúdo de `ANDROID_KEYSTORE_BASE64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | sim | senha do keystore |
| `ANDROID_KEY_ALIAS` | não | alias da chave (padrão `upload`) |
| `ANDROID_KEY_PASSWORD` | não | senha da chave (padrão: a mesma do keystore) |

### 4.2 Gerar o AAB assinado

**Actions → "Android Release (Play Store)" → Run workflow**:
- sem marcar nada: usa os IDs reais do AdMob (e falha se `config/ads.json` ainda tiver `XXXX`);
- marcando **test_ads**: gera o AAB com anúncios de teste (os arquivos saem com `-TESTADS` no nome), bom para o teste fechado antes de ter o AdMob pronto.

O artefato `bus-crazy-people-release` traz o `.aab`, que vai para o Play Console, e um `.apk` assinado para conferir no celular.
- O versionCode é o número da execução e sobe sozinho.
- O versionName vem do `package.json`.
- Para cada atualização, aumente `version` no `package.json`.

### 4.3 AdMob

1. Em https://admob.google.com, crie o app **Bus Crazy People** (Android) e dois blocos: **Intersticial** e **Premiado** (recompensado).
2. Cole o ID do app e os dois IDs de bloco em **`config/ads.json`** e faça commit.
3. Em **Privacidade e mensagens → Europa (GDPR)**, crie e publique a mensagem de consentimento. Opcionalmente, faça o mesmo em "Estados dos EUA".
4. Depois de publicar na loja, vincule o app à Play Store no AdMob.
5. Publique o `docs/app-ads.txt` na raiz do site da ficha (ex.: um repositório público `fefaofefao.github.io`). Confira o ID de editor dentro do arquivo.
6. **Nunca clique nos seus próprios anúncios reais.**

### 4.4 Play Console

1. Crie o app: nome **Bus Crazy People**, idioma padrão pt-BR, **Jogo**, **Gratuito**.
2. Preencha **Conteúdo do app** com as respostas de `STORE_LISTING.md`: segurança dos dados, anúncios, ID de publicidade, público-alvo 13+ e IARC.
3. Preencha a **Ficha da loja** com os textos de `STORE_LISTING.md` e as imagens de `store/` (ícone, recurso gráfico e 8 capturas por idioma em pt-BR, en-US e es-419).
4. Envie o 1º AAB para **Teste interno** e aceite o **Play App Signing**.
5. Depois do 1º AAB enviado, crie em **Monetizar → Produtos → Produtos no app** o produto **`remove_ads`**, do tipo único (não consumível), com preço, e **ative**.
6. **Teste fechado (obrigatório para conta pessoal nova):** 12 ou mais testadores inscritos por **14 dias seguidos**. Depois disso, peça acesso à produção.
7. Produção: envie o AAB final e lance.

### 4.5 Política de privacidade

- A página está pronta em **`public/privacy/index.html`**: HTML estático em pt-BR, inglês e espanhol, cobrindo AdMob, consentimento, compras e contato.
- O app abre essa mesma página, embutida, em **Ajustes → Política de privacidade**, e funciona offline.
- A Play Store exige uma **URL pública**. Opções:
  - **GitHub Pages:** no plano Free, só funciona com repositório público. Torne o repositório público, ou copie `public/privacy/index.html` para um repositório público (ex.: `fefaofefao.github.io/bus-crazy-people-privacy/`). Também dá para usar o workflow `deploy-pages.yml` (manual): ele publica o jogo e a política em `https://fefaofefao.github.io/Bus-crazy-people/privacy/`.
  - **Google Sites**, colando o texto (como foi feito no Life Direction).

---

## 5. Estrutura

```
config/ads.json             IDs REAIS do AdMob (único lugar para trocar)
levels/tutorial.json        fases 1–10 feitas à mão
levels/levels.json          pacote final com as 300 fases (gerado)
src/
  config.js                 parâmetros (anúncios, animações, cores, layout)
  core/                     lógica pura: rules, engine, solver, generator, prng
  levels/index.js           carrega o pacote de fases
  scenes/                   Boot (splash), Language, Menu, Levels, Achievements, Game, Settings
  services/                 AdManager (+ ads/), PurchaseManager (+ purchases/), Storage,
                            Progress, Sound, Music, Haptics, BackButton
  ui/                       art (ônibus/passageiros/símbolos), scenery (pôr do sol), icons, logo, widgets, dom
  i18n/                     pt-BR (padrão), en, es
public/privacy/index.html   política de privacidade (3 idiomas)
scripts/                    gerador, testes, ícones, imagens da loja, sync do AdMob
store/                      ícone 512, recursos gráficos e capturas (3 idiomas)
docs/                       formato das fases, arte, roadmap, app-ads.txt
STORE_LISTING.md            textos da loja + rascunho de Segurança dos dados
```

Identidade visual (paleta, tipografia, mascote Seu Tião, logo, componentes): `docs/IDENTIDADE.md`. Para trocar a arte, veja `docs/ARTE.md`. Para as próximas versões (desafio diário, Play Games, novas mecânicas), veja `docs/ROADMAP.md`.

## 6. Critérios de aceite do MVP

| Critério | Como é garantido |
|---|---|
| AAB gerado pelo GitHub Actions | `android-release.yml` (exige os secrets da 4.1) |
| 300 fases resolvíveis sem boosters | `npm run test:levels` (solução gravada + solver independente), roda em todo build |
| Nenhum intersticial fora das regras | `AdManager` + `npm run test:ads` (simulação de 400 vitórias) |
| Nenhum crash quando o anúncio falha | `try/catch` em todo o fluxo + testes com SDK falhando |
| Jogo completo offline | nenhum recurso de rede além dos anúncios; tudo está embarcado |
