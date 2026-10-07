# Revisão de UX: Bus Crazy People

Avaliação heurística do jogo inteiro (onboarding, partida, feedback, progressão, acessibilidade, monetização e áudio). Cada problema tem gravidade (🔴 alta, 🟠 média, 🟡 baixa) e o que foi feito. Os itens "próximos passos" estão em aberto.

## 1. Primeira abertura e marca

| Visão | Problema | Feito |
|---|---|---|
| Presença da marca | Abrir o jogo era silencioso e genérico. | **Vinheta sonora** "fon-fon, ta-ra-rá!" (buzina + marimba) junto com o logo, toda vez que o app abre. **Trilha calma "Bossa da Orla"** no menu e em todas as telas fora da partida, com troca suave para o samba da partida. |
| Identidade | Visual sem personalidade própria. | Estilo "adesivo de rua", mascote Seu Tião, pôr do sol carioca (ver `docs/IDENTIDADE.md`). |
| 🟡 Onboarding | Tutorial em texto puro. | Balão com o Tião + mãozinha na jogada certa nas fases 1–10. Cartão "Novidade!" com destaque piscando na primeira vez de cada mecânica. |

## 2. Partida (toque e controle)

| Visão | Problema | Feito |
|---|---|---|
| 🔴 Toque errado | O ônibus saía no **pressionar**: um toque que passava de raspão já gastava uma jogada (e uma estrela). | O ônibus **"afunda" ao encostar** (com vibração leve) e só sai ao **soltar o dedo em cima dele**. Arrastar para fora cancela. |
| 🟠 Toque perdido | Toques durante a animação eram ignorados, e o jogo parecia "travar". | O último toque feito durante a animação fica **guardado** e é executado logo depois. |
| 🔴 Sair sem querer | O botão de casa saía da fase na hora. | Virou **Pausa**: continuar, reiniciar, sons, música, como jogar e sair. |
| 🟠 Capacidade escondida | Era preciso adivinhar quantos lugares cada ônibus tinha (só pelo tamanho). | **Pontinhos no teto** mostram os lugares (4/6/8) ainda no estacionamento. |

## 3. Informação para planejar (jogo justo)

| Visão | Problema | Feito |
|---|---|---|
| 🔴 Fila escondida | Só 11 passageiros visíveis, e o resto era um "+N" mudo. Num jogo de planejamento, isso é injusto. | Tocar no **+N abre a fila inteira** (cores, símbolos do modo daltônico e relógios dos prioritários). |
| 🟠 Perigo invisível | Perder por vagas cheias pegava o jogador de surpresa. | Quando sobra **uma vaga**, ela pisca em rosa e aparece "Última vaga!" (com vibração). |
| 🟠 Derrota sem explicação | "Ponto lotado" não dizia o que faltou. | A tela de derrota diz **qual cor o próximo passageiro precisava**. |

## 4. Frustração e progressão

| Visão | Problema | Feito |
|---|---|---|
| 🟠 Repetir derrotas | O jogador que perde várias vezes desiste. | A partir da 2ª derrota na mesma fase, o **Tião dá uma dica** de estratégia (rotativa). Desfazer, dica e vaga extra continuam a um toque. |
| 🟡 Melhorar o resultado | Depois de vencer com 1–2 estrelas, voltar para tentar 3 era trabalhoso. | Botão **"Tentar 3 estrelas"** na vitória. |
| 🟡 Feedback de erro | Errar não tinha consequência visível. | As **estrelas da tentativa** ficam no topo e caem (com tremor) a cada batida ou ajuda. |
| Dificuldade | Fácil demais até a metade. | Desafio moderado com **armadilhas obrigatórias** e teto de crueldade (ver README). |

## 5. Acessibilidade

- Modo daltônico com símbolo por cor (também na lista da fila).
- Áreas de toque de pelo menos 46 px em todos os botões; o estacionamento inteiro é a área de toque.
- Vibração opcional; sons e música separados (também na Pausa).
- Textos com contorno sobre fundos coloridos; contraste dos painéis creme com texto azul-marinho.
- Retrato no celular; tablets giram (layout adaptável).

## 6. Monetização (sem quebrar a experiência)

- O intersticial só aparece ao **sair** da tela de vitória, com as regras de frequência (ver README).
- Antes de cada recompensado há uma **pergunta clara** ("Assistir anúncio para…?"), e o selo ▶ marca tudo que abre anúncio.
- A dica nunca cobra anúncio quando não há saída.

## Próximos passos sugeridos

1. **Prévia do caminho ao segurar o dedo** sobre um ônibus (seta mostrando até onde ele vai e se vai bater).
2. **Teste com 5 jogadores reais** (gravação de tela) medindo:
   - onde desistem;
   - quantas vezes usam Desfazer por fase;
   - quanto tempo levam entre as fases 15 e 30.
3. **Analytics leve** (com consentimento): taxa de vitória e de 3 estrelas por fase, para recalibrar a curva com dados reais em vez do jogador simulado.
4. **Lembrete gentil de pausa** depois de 30 minutos seguidos (bem-estar digital).
