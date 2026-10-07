# Formato das fases (JSON)

O pacote embarcado é `levels/levels.json`:

```json
{ "format": 1, "version": 1, "count": 300, "levels": [ ... ] }
```

Cada fase segue este formato:

```json
{
  "format": 1,
  "id": 37,
  "cols": 6, "rows": 7,
  "slots": 5,
  "challenge": false,
  "tutorial": null,
  "buses": [
    { "id": 0, "x": 2, "y": 3, "dir": "up", "type": "medium", "color": 1 }
  ],
  "lines": [[1, 1, 0], [2, 1, 1], [0, 2]],
  "calm": 4,
  "priority": [{ "line": 1, "index": 2, "patience": 9 }],
  "mechanics": [],
  "solution": [4, 0, 2, 1, 3],
  "meta": { "seed": 123, "randomWin": 0.4, "greedyWin": 0.9, "traps": 3, "trapRatio": 0.1, "score": 21.5, "target": 20.9 }
}
```

| Campo | Significado |
|---|---|
| `cols`, `rows` | tamanho do estacionamento (grade) |
| `slots` | vagas de embarque no ponto (padrão 5) |
| `challenge` | fase Desafio (opcional; dá para pular) |
| `tutorial` | `{ "text": "t3" }` mostra `tutorial.t3` de `src/i18n/*` e a mãozinha de dica automática |
| `buses[].x, y` | casa da **frente** do ônibus; o corpo se estende para trás |
| `buses[].dir` | `up`, `down`, `left` ou `right` (para onde ele sai) |
| `buses[].type` | `small` (2 casas, 4 lugares), `medium` (3, 6) ou `large` (4, 8); veja `src/core/rules.js` |
| `buses[].color` | índice 0–7 em `COLORS` (cada cor tem um símbolo do modo daltônico) |
| `lines` | filas do ponto (até 4; o jogo usa 3). Cada fila é uma lista de cores; o índice 0 é o primeiro. O primeiro de **qualquer** fila embarca no ônibus da sua cor, em rodízio (fila 0, 1, 2, 0…) |
| `queue` | formato antigo, 1 fila só (equivale a `lines: [queue]`) |
| `calm` | paciência das filas: jogadas seguidas sem ninguém daquela fila embarcar (batidas contam) até ela piorar um nível – feliz → impaciente → nervosa. O humor não melhora |
| `priority` | passageiro `index` da fila `line` precisa embarcar até a jogada `patience` (contada desde o início, batidas incluídas) |
| `buses[].hidden` | **ônibus coberto**: a cor só aparece na tela quando o caminho dele fica livre (não muda as regras) |
| `buses[].lock` | **cadeado**: id do ônibus-chave; este só sai depois que a chave sair do estacionamento (antes disso, tocar "bate") |
| `buses[].garage` | **terminal**: id do terminal que solta este ônibus (na ordem do array); `x, y, dir` = posição onde ele nasce (`garageSpawnPos`) |
| `cones` | **obra**: `[{ x, y, until }]` – a casa fica bloqueada enquanto o número de jogadas < `until` |
| `garages` | **terminais**: `[{ id, x, y, dir }]` – casa fixa que bloqueia passagem e solta ônibus para `dir` quando há espaço |
| `mechanics` | lista das mecânicas presentes (`hidden`, `lock`, `garage`, `cones`) – usada para o cartão "Novidade!" |
| `solution` | ordem de toques que vence **com todas as filas felizes** (3 estrelas) e sem batidas; gravada pelo gerador e conferida no teste |
| `meta` | métricas de dificuldade (só informativas; o jogo não usa) |

Estado do ônibus no motor: `inLot` = 1 (no estacionamento), 0 (já saiu) ou 2 (esperando no terminal).
Derrota extra: `stuck` – nenhum ônibus pode sair e nenhuma obra vai terminar.

**Regras de validade** (`validateLevel` em `src/core/engine.js`):
- os ônibus ficam dentro da grade e não se sobrepõem;
- para cada cor, a quantidade de passageiros é igual à soma dos lugares dos ônibus dessa cor;
- os prioritários apontam para posições válidas das filas.

**Estrelas** (`src/core/stars.js`): filas felizes no fim da fase vencida. Com 3 filas: 3 felizes = ★★★, 2 = ★★, 1 ou 0 = ★. Com menos filas (tutorial), cada fila infeliz tira 1 estrela (mínimo 1).

**Como o gerador define `calm`:** a fila única construída para a ordem pretendida é repartida em pedaços entre as filas; depois o solver procura a paciência **mais apertada** que ainda permite terminar com todas as filas felizes, e soma uma folga (2 no começo, 0 no fim e nos Desafios). No tutorial (`levels/tutorial.json`), `"lines": 3` reparte a fila automaticamente; também dá para escrever as filas prontas (`"lines": [[...], [...]]`) e `"calm"`.

**Fases feitas à mão:** edite `levels/tutorial.json` (sem `id` nos ônibus) e rode `npm run levels:generate`. O script junta o tutorial com as fases geradas e reprova qualquer fase sem solução.
