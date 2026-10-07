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
  "queue": [1, 1, 0, 2, 1],
  "priority": [{ "index": 12, "patience": 9 }],
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
| `queue` | fila de passageiros (cor de cada um); o índice 0 é o primeiro |
| `priority` | passageiro `index` precisa embarcar até a jogada `patience` (contada desde o início, batidas incluídas) |
| `mechanics` | reservado para mecânicas futuras (ver `docs/ROADMAP.md`) |
| `solution` | ordem de toques que vence; gravada pelo gerador e conferida no teste |
| `meta` | métricas de dificuldade (só informativas; o jogo não usa) |

**Regras de validade** (`validateLevel` em `src/core/engine.js`):
- os ônibus ficam dentro da grade e não se sobrepõem;
- para cada cor, a quantidade de passageiros é igual à soma dos lugares dos ônibus dessa cor;
- os prioritários apontam para posições válidas da fila.

**Fases feitas à mão:** edite `levels/tutorial.json` (sem `id` nos ônibus) e rode `npm run levels:generate`. O script junta o tutorial com as fases geradas e reprova qualquer fase sem solução.
