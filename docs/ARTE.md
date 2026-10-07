# Arte e áudio: como trocar

Hoje toda a arte é **desenhada por código**, com vetores e sem arquivos de imagem. Isso deixa o APK leve e nítido em qualquer tela. Para trocar por arte desenhada (PNG ou SVG):

| O quê | Onde está hoje | Como trocar |
|---|---|---|
| Ônibus (vista de cima, apontando para cima) | `busTexture()` em `src/ui/art.js` | Coloque os PNGs em `public/art/bus-<tipo>-<cor>.png`, carregue-os no `preload()` do `BootScene` e faça `busTexture()` devolver a chave carregada. A frente fica no topo da imagem, e o jogo gira a imagem conforme a direção. |
| Passageiros | `drawPassenger()` em `src/ui/art.js` | O mesmo processo: `public/art/passenger-<cor>.png`. |
| Símbolos do modo daltônico | `drawSymbol()` em `src/ui/art.js` | Um desenho por cor (`COLORS` em `src/core/rules.js`). |
| Cidade, rua e calçadão | `drawCity()`, `drawRoad()` e `drawSidewalk()` em `src/scenes/GameScene.js` | Substitua por `this.add.image(...)` de um fundo em `public/art/`. |
| Cores do tema | `CONFIG.colors` em `src/config.js` | Basta editar. |
| Ícones dos botões | `src/ui/icons.js` | Vetores; cada ícone é uma função. |
| Logo | `src/ui/logo.js` | Usa o ônibus amarelo e o texto. |
| Ícone, splash, mascote e ônibus do logo | `scripts/make-brand.js` → `assets/*.svg` e `public/brand/` | Rode `npm run brand`, converta para PNG (`scripts/svg-to-png.cjs`) e depois `npx @capacitor/assets generate --android ...` (veja `docs/IDENTIDADE.md`). |
| Imagens da loja | `scripts/store-assets.cjs` | Gera o ícone 512, o recurso gráfico e as capturas a partir do próprio jogo. |
| Sons | `src/services/Sound.js` (sintetizados) | Para usar arquivos, carregue `public/audio/*.mp3` no `BootScene` e troque cada função por `scene.sound.play(...)`. |
| Música e vinheta | `src/services/Music.js` (bossa do menu, samba da partida e vinheta de abertura, sintetizados) | O mesmo processo, com um MP3/OGG em loop. |

As cores dos ônibus e dos passageiros precisam continuar distintas entre si (no máximo 8). Cada cor deve manter o seu símbolo.
