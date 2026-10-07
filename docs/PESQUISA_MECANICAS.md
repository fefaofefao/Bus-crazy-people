# Pesquisa: mecânicas que deixam o "bus jam" mais atraente

## O que os líderes do gênero estão usando (out/2026)

Os jogos mais baixados do gênero (Bus Jam, Bus Out, Bus Fever, Bus Loop, Crazy Bus) renovam o interesse com **obstáculos novos aparecendo aos poucos**. Os mais citados são:

- **Ônibus coberto**: a cor fica escondida até ser revelada.
- **Correntes e cadeados** que abrem com chaves.
- **Garagens e túneis** que soltam mais ônibus.
- **Portões** que abrem e fecham no tempo.
- **Passageiros escondidos** na fila.

Fontes: [Bus Loop (App Store)](https://apps.apple.com/us/app/bus-loop/id6749436562), [Bus Out](https://apps.apple.com/us/app/-/id6737303138), [Bus Fever](https://apps.apple.com/us/app/-/id6736379602), [Bus Jam 3D](https://apps.apple.com/us/app/id6744809390).

O padrão é claro: cada obstáculo **estreia sozinho**, numa fase leve, com um cartão explicando, e depois se mistura aos outros. Isso dá a sensação de "sempre tem algo novo" sem pico de dificuldade.

## O que entrou no Bus Crazy People

Todas as mecânicas são **determinísticas por jogada**. Por isso o solver continua provando que cada fase tem solução, o que preserva o diferencial de ser um jogo **justo**.

| Mecânica | Estreia | Como funciona | Por que é justa |
|---|---|---|---|
| **Ônibus coberto** (lona cinza com "?") | fase 31 | A cor aparece quando a frente fica livre, com um giro e um som. | A cor aparece **antes** de você poder tocar nele: você nunca escolhe às cegas. A fila também dá pistas. |
| **Obra na pista** (cones) | fase 55 | Casa bloqueada até a jogada N; o número mostra quanto falta. | O tempo é medido em jogadas, não em segundos: dá para planejar com calma. |
| **Cadeado e chave** | fase 81 | O ônibus com cadeado só sai depois que o ônibus com a chave deixar o estacionamento. | Os dois ícones ficam sempre visíveis, e tocar no trancado mostra quem é a chave. |
| **Terminal** | fase 111 | Solta um novo ônibus sempre que a saída fica livre, com um contador de quantos faltam. | A ordem é fixa, e o terminal é uma peça fixa no mapa. |

Também entraram:
- **Combo:** quando um toque faz 2 ou mais ônibus partirem de uma vez, aparecem "Combo x2!", confete e uma fanfarra. Isso recompensa o planejamento.
- **Cartão "Novidade!"** na primeira vez de cada mecânica, com destaque piscando sobre ela na tela.
- **Derrota "Trânsito travado"** quando nenhum ônibus pode mais sair. O jogo avisa na hora, em vez de deixar o jogador preso.

A distribuição é gradual: cada mecânica estreia sozinha e depois aparece com chance crescente (30% → 55%), até se misturar com as outras nas fases finais. Os Desafios usam a mistura mais cedo, mas **nunca antes da estreia**. Os parâmetros estão em `scripts/generator-config.js` (`mechanics`) e são conferidos por `npm run test:levels`.

## Próximas ideias (por impacto estimado)

1. **Desafio diário + resultado em emoji para o WhatsApp** (v1.1): é a maior alavanca de retenção e divulgação no Brasil. O gerador determinístico já permite fazer isso sem servidor.
2. **Ônibus de dois andares** (duas cores, um andar de cada): é a mecânica mais "nova" no gênero.
3. **Semáforo / ponte levadiça**: casas que alternam entre aberto e fechado a cada N jogadas. Continua determinístico.
4. **Coleção de bairros e cidades brasileiras** (meta-progressão): a cada 30 fases, um novo cenário (Copacabana, Pelourinho, Avenida Paulista…), com ônibus e paleta próprios.
5. **Eventos sazonais** (Carnaval, festa junina): fases temáticas por tempo limitado, reaproveitando o gerador com outra paleta.
6. **Sequência de vitórias** (streak) com pequenas recompensas visuais, sem moeda paga, para manter a proposta de jogo justo.
