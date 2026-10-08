# Publicação na Google Play: passo a passo

Dados fixos do app (copie daqui):

| Campo | Valor |
|---|---|
| Nome do app | **Bus Crazy People** |
| Nome do pacote (applicationId) | **`com.fsamplabs.buscrazypeople`** (não muda nunca depois do 1º envio) |
| Idioma padrão | Português (Brasil) – pt-BR |
| Outros idiomas da ficha | Inglês (en-US), Espanhol (es-419) |
| Tipo | **Jogo**, **Gratuito** |
| Categoria | Jogos → **Quebra-cabeça** |
| E-mail de contato | fe.m.sampaio@hotmail.com |
| Política de privacidade | `https://fefaofefao.github.io/Bus-crazy-people/privacy/` (depois do passo 1) |
| Produtos no app | `infinite_lives` (R$ 9,99) e `infinite_lives_no_ads` (R$ 14,99) |
| AdMob | app `ca-app-pub-7483085200976329~2413835877` |

---

## 1. Política de privacidade no ar (GitHub Pages)

A Play exige uma URL pública. A página já existe em `public/privacy/index.html`.

1. Deixe o repositório público (o GitHub Pages grátis só funciona assim):
   https://github.com/fefaofefao/Bus-crazy-people/settings → fim da página, **Danger Zone** → **Change visibility** → **Make public**.
   > Não há senhas nem chaves no repositório (a chave de assinatura está só nos secrets).
2. Ative o Pages pelo GitHub Actions:
   https://github.com/fefaofefao/Bus-crazy-people/settings/pages → **Source: GitHub Actions**.
3. Publique: https://github.com/fefaofefao/Bus-crazy-people/actions/workflows/deploy-pages.yml → **Run workflow** → branch `main` → **Run workflow**.
4. Em ~2 min, abra numa **aba anônima**: https://fefaofefao.github.io/Bus-crazy-people/privacy/
   Tem que abrir sem login, em português, inglês e espanhol.

## 2. app-ads.txt (para o AdMob pagar normalmente)

O AdMob confere um arquivo no **site do desenvolvedor** que você informar na ficha da Play.

1. Crie um repositório **público** chamado exatamente **`fefaofefao.github.io`**: https://github.com/new
2. Dentro dele, crie o arquivo **`app-ads.txt`** (Add file → Create new file) com esta linha:
   ```
   google.com, pub-7483085200976329, DIRECT, f08c47fec0942fa0
   ```
3. Commit. Em alguns minutos ele fica em https://fefaofefao.github.io/app-ads.txt
   (Se o Life Direction já publicou esse arquivo nesse mesmo endereço, ele já serve: é a mesma conta.)
4. No passo 5 (ficha da loja), use **https://fefaofefao.github.io** como **Site**.

## 3. Criar o app no Play Console

https://play.google.com/console → **Todos os apps** → **Criar app**

| Campo | Resposta |
|---|---|
| Nome do app | Bus Crazy People |
| Idioma padrão | Português (Brasil) – pt-BR |
| App ou jogo | **Jogo** |
| Gratuito ou pago | **Gratuito** |
| Declarações | marque as duas (políticas do programa e leis de exportação dos EUA) |

→ **Criar app**.

> O nome do pacote é definido pelo AAB no 1º envio (passo 7): `com.fsamplabs.buscrazypeople`.

## 4. Painel → "Configurar o app" (Conteúdo do app)

Menu lateral: **Política → Conteúdo do app** (ou siga as tarefas do Painel). Respostas:

### 4.1 Política de privacidade
URL: `https://fefaofefao.github.io/Bus-crazy-people/privacy/`

### 4.2 Acesso ao app
**Todas as funcionalidades estão disponíveis sem acesso especial** (não há login).

### 4.3 Anúncios
**Sim, meu app contém anúncios.**

### 4.4 Classificação do conteúdo (questionário IARC)
- E-mail: fe.m.sampaio@hotmail.com · Categoria: **Jogo**.
- Violência, medo, sexualidade, linguagem imprópria, drogas, álcool, tabaco: **Não**.
- Jogos de azar / apostas simuladas: **Não**.
- Os usuários interagem ou trocam conteúdo: **Não**.
- Compartilha a localização do usuário com outros usuários: **Não**.
- Compras de produtos digitais: **Sim**.
- Resultado esperado: **Livre (Brasil) / PEGI 3 / Everyone**, com aviso "Compras no app".

### 4.5 Público-alvo e conteúdo
- Faixas etárias: marque **13–15, 16–17 e 18 ou mais**.
  **Não marque nada abaixo de 13** (isso coloca o app no programa Famílias, com regras de anúncio bem mais rígidas).
- "O app pode atrair crianças sem querer?": **Não**.

### 4.6 ID de publicidade
**Sim**, o app usa o ID de publicidade → finalidades: **Publicidade ou marketing** e **Análise**.

### 4.7 Apps governamentais / Recursos financeiros / Saúde / Notícias
Não / nenhum recurso / não é app de saúde / não é app de notícias.

### 4.8 Segurança dos dados (Data safety)

Página 1:
- O app coleta ou compartilha algum dos tipos de dados exigidos? **Sim**
- Todos os dados são criptografados em trânsito? **Sim**
- Você oferece um jeito de pedir a exclusão dos dados? **Não** (não há conta; tudo fica no aparelho).

Página 2 – marque estes tipos:

| Categoria → Tipo | Coletado | Compartilhado | Opcional? | Finalidades |
|---|---|---|---|---|
| Local → **Local aproximado** | Sim | Sim | Obrigatório | Publicidade ou marketing · Análise · Prevenção de fraudes, segurança e compliance |
| Atividade no app → **Interações com o app** | Sim | Sim | Obrigatório | Publicidade ou marketing · Análise · Prevenção de fraudes, segurança e compliance |
| Informações e desempenho do app → **Registros de falhas** | Sim | Sim | Obrigatório | Análise · Prevenção de fraudes, segurança e compliance |
| Informações e desempenho do app → **Diagnóstico** | Sim | Sim | Obrigatório | Análise · Prevenção de fraudes, segurança e compliance |
| IDs do dispositivo ou outros → **IDs do dispositivo ou outros** | Sim | Sim | Obrigatório | Publicidade ou marketing · Análise · Prevenção de fraudes, segurança e compliance |
| Informações financeiras → **Histórico de compras** | Sim | **Não** | Obrigatório | Funcionalidade do app · Análise |

Em todos: **Processado de forma efêmera = Não**. Não marque nome, e-mail, contatos, fotos, localização precisa nem dados de pagamento.

## 5. Ficha principal da loja

Menu: **Crescer usuários → Presença na loja → Ficha principal da loja** (pode aparecer como "Crescimento → Presença na loja").

Textos: copie de [`STORE_LISTING.md`](../STORE_LISTING.md) (pt-BR é o padrão; depois **Gerenciar traduções → Adicionar idiomas** → Inglês (Estados Unidos) e Espanhol (América Latina), com os textos de cada um).

| Campo | Valor |
|---|---|
| Nome do app | Bus Crazy People |
| Descrição curta (pt-BR) | Puzzle de ônibus justo: organize o estacionamento e leve todo mundo! |
| Descrição completa | a do `STORE_LISTING.md` |
| Ícone do app (512×512) | `store/icon-512.png` |
| Recurso gráfico (1024×500) | `store/feature-graphic-pt-BR.png` (en-US e es-419 nas traduções) |
| Capturas de tela do telefone | as 8 de `store/screenshots/pt-BR/` (idem por idioma) |

Baixe as imagens em: https://github.com/fefaofefao/Bus-crazy-people/tree/main/store
(abra o arquivo → botão **Download raw file**).

**Configurações da loja** (Presença na loja → Configurações da loja):
- Categoria: **Jogo → Quebra-cabeça**. Tags: Quebra-cabeça, Lógica, Casual.
- E-mail: fe.m.sampaio@hotmail.com · Site: https://fefaofefao.github.io · Telefone: opcional.

## 6. Perfil de pagamentos (para vender as vidas infinitas)

https://play.google.com/console → **Configuração → Perfil de pagamentos** → criar/vincular perfil (dados pessoais, endereço, conta bancária).
Opcional e recomendado: **Programa de taxa de serviço de 15%** – inscreva-se em Configuração → Taxa de serviço / grupos de contas (paga 15% em vez de 30% até US$ 1 milhão/ano).

## 7. Enviar o AAB no Teste fechado

O AAB pronto (v0.6.1, anúncios reais): https://github.com/fefaofefao/Bus-crazy-people/actions/runs/37703975370 → **Artifacts** → `bus-crazy-people-release` → descompacte → use o **`.aab`**.

1. Play Console → **Testar e lançar → Testes → Teste fechado** → na faixa "Alpha" (ou **Criar faixa**) → **Gerenciar faixa**.
2. **Países/regiões**: adicione pelo menos **Brasil** (e os que quiser).
3. **Testadores**: crie uma lista de e-mails (os Gmail das pessoas) ou use um Grupo do Google. Mínimo **12**, recomendado **15**.
4. **Criar nova versão**:
   - **Assinatura de apps do Google Play**: aceite (**Usar a chave gerada pelo Google**). Nosso `upload.jks` é só a chave de envio.
   - Envie o `.aab` (arrastar). O Console mostra o pacote **com.fsamplabs.buscrazypeople**, versão **0.6.1 (1)**.
   - Nome da versão: `0.6.1`.
   - Notas da versão:
     ```
     <pt-BR>
     Primeira versão: 300 fases, 3 filas com humor, modo daltônico e 3 idiomas.
     </pt-BR>
     <en-US>
     First release: 300 levels, 3 lines with moods, colorblind mode and 3 languages.
     </en-US>
     <es-419>
     Primera versión: 300 niveles, 3 filas con humor, modo daltónico y 3 idiomas.
     </es-419>
     ```
5. **Avançar → Salvar → Enviar para revisão** (em **Visão geral da publicação**). A 1ª revisão pode levar de algumas horas a ~7 dias.
6. Depois de aprovado, copie o **link de participação** (Teste fechado → Testadores → "Participar no Android") e mande para os testadores. Cada um precisa **aceitar pelo link** e **instalar pela Play**.

### Regra das contas pessoais novas
- **12 ou mais testadores** inscritos por **14 dias seguidos**. Não pause a faixa, não troque a lista.
- Atualizações nesse período: gere outro AAB (o código de versão sobe sozinho) e envie **na mesma faixa**.
- Depois dos 14 dias: **Painel → Solicitar acesso à produção** (questionário sobre o teste: quantas pessoas, feedback recebido, mudanças feitas).

## 8. Produtos no app (depois do 1º AAB enviado)

**Monetizar com o Google Play → Produtos → Produtos no app → Criar produto** (produto único):

| ID do produto (exatamente assim) | Nome | Descrição | Preço |
|---|---|---|---|
| `infinite_lives` | Vidas infinitas | Jogue quanto quiser: as vidas nunca acabam. Compra única. | R$ 9,99 |
| `infinite_lives_no_ads` | Vidas infinitas + sem anúncios | Vidas que nunca acabam e nenhum anúncio entre as fases. | R$ 14,99 |

Em cada um: definir preço → **Salvar** → **Ativar**. (Traduza nome/descrição em en-US e es-419 se quiser.)

**Testar sem pagar**: **Configuração → Testes de licença** → adicione o seu Gmail e o dos testadores → **Resposta de licença: RESPOND_NORMALLY**. Na compra aparece "Cartão de teste: sempre aprova".

## 9. AdMob

1. **Vincular à Play** (depois que o app aparecer na Play, mesmo em teste): https://apps.admob.com → **Apps** → *Crazy Bus Stop* → **Configurações do app** → **Adicionar** (loja de apps) → procure por `com.fsamplabs.buscrazypeople`.
2. **Mensagem de consentimento (Europa)**: **Privacidade e mensagens → GDPR → Criar mensagem** → selecione o app → idiomas pt/en/es → **Publicar**.
3. **Seu celular como dispositivo de teste** (para não clicar em anúncio real): **Configurações → Dispositivos de teste → Adicionar dispositivo** (ID de publicidade do Android: Configurações do celular → Google → Anúncios).
4. Confira em alguns dias se o **app-ads.txt** aparece como "Encontrado" (Apps → Ver todos os apps → coluna app-ads.txt).

## 10. Gerar uma nova versão no futuro

1. https://github.com/fefaofefao/Bus-crazy-people/actions/workflows/android-release.yml → **Run workflow** (`test_ads` desmarcado).
2. Baixe o `.aab` em Artifacts → envie na faixa atual (teste fechado ou produção).
3. Secrets usados (já criados): `ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD` em https://github.com/fefaofefao/Bus-crazy-people/settings/secrets/actions

**Chave perdida?** Play Console → **Configuração → Integridade do app → Assinatura do app → Solicitar redefinição da chave de upload**.
