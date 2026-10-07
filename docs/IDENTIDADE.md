# Identidade visual: Bus Crazy People

## Conceito

**"O busão mais doido da cidade"**: um ponto de ônibus na orla carioca ao pôr do sol, cheio de gente animada. A linguagem visual é a do **adesivo de rua** e dos cartazes de festa brasileiros:
- cores chapadas e saturadas;
- **contorno azul-marinho grosso** e **sombra dura** (sem desfoque);
- raios de sol ao fundo.

Ela deixa o jogo legível em telas pequenas e o diferencia do visual 3D genérico dos concorrentes.

## Mascote: Seu Tião

O motorista da linha: boné azul com faixa amarela, bigode e bochechas rosadas. Ele aparece:
- ao volante do ônibus do logo e do ícone;
- nas dicas do tutorial (balão de fala);
- nas janelas de novidade, de Desafio e de derrota.

Arte em `public/brand/tiao.svg`, gerada por `scripts/make-brand.js`.

## Paleta (`CONFIG.colors` em `src/config.js`)

| Nome | Hex | Uso |
|---|---|---|
| Asfalto à noite (ink) | `#1B2340` | contornos, sombras, fundos e texto escuro |
| Amarelo-busão | `#FFC72C` | cor da marca, estrelas, destaques |
| Laranja-pôr-do-sol | `#FF7A3D` | ações com anúncio, céu |
| Rosa-carnaval | `#FF4F8B` | Desafios, faixa do logo, novidades |
| Azul-mar | `#2E9BFF` | botões principais e mar |
| Verde-bandeira | `#23B26D` | jogar / continuar / vitória |
| Creme-calçadão | `#FFF3DC` | painéis e janelas |
| Céu | `#FFD166` → `#FF8A4C` → `#FF4F8B` | degradê do pôr do sol |

As 8 cores de ônibus e passageiros ficam em `src/core/rules.js` (cada uma com o seu símbolo do modo daltônico).

## Tipografia

- **Lilita One** (OFL): títulos, botões, números e o logo. É pesada e arredondada, com cara de letreiro de ônibus.
- **Fredoka** (OFL): textos corridos, descrições e dicas.

As duas vêm embutidas (`@fontsource`) e funcionam offline. Elas cobrem os acentos de pt-BR e es (ã, ç, ñ, ¡, ¿).

## Componentes

- **Botão:** sombra dura de 10% da altura, contorno com 6% do menor lado, faixa mais escura embaixo, brilho no topo e texto com contorno (`Button` em `src/ui/widgets.js`). As cores seguem a função: verde = jogar, azul = navegar, laranja = anúncio (sempre com o selo ▶), cinza-azulado = secundário.
- **Janelas** (`modal` em `src/ui/dom.js` + `src/style.css`): painel creme com contorno e sombra dura, título em Lilita e o mascote saindo pelo topo quando há fala dele.
- **Estrelas:** amarelas com contorno azul-marinho; a do meio é maior.
- **Cenário:**
  - pôr do sol com raios girando, Pão de Açúcar com bondinho e mar (`src/ui/scenery.js`);
  - casario colorido com contorno;
  - calçadão de Copacabana (ondas).

## Logo

- Ônibus de frente com o Seu Tião e passageiros (`public/brand/bus-front.svg`).
- "BUS CRAZY" em branco com contorno e sombra.
- "PEOPLE" em amarelo sobre faixa rosa, tudo inclinado em −4°.

O logo é montado em `src/ui/logo.js`.

## Ícone, splash e loja

- Ícone e splash: o mesmo ônibus sobre o pôr do sol com raios (`scripts/make-brand.js` → `assets/`).
- Para regerar:
  ```
  node scripts/make-brand.js
  node scripts/svg-to-png.cjs assets/*.svg
  npx @capacitor/assets generate --android --iconBackgroundColor '#ff8a4c' --splashBackgroundColor '#ff8a4c'
  ```
- Imagens da loja: `node scripts/store-assets.cjs` (com o jogo rodando em `vite preview`).
