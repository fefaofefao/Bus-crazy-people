# Depois do MVP: onde cada coisa entra

A arquitetura já foi pensada para estas versões. **Nada disso está implementado no MVP.**

## v1.1

| Recurso | Onde encaixar |
|---|---|
| **Desafio diário** igual para todos | Use `generateLevel(id, params, seed)` de `src/core/generator.js` com `seed = hash(data)`, já validado pelo solver. Gere a fase no próprio app, porque o gerador é determinístico e roda no navegador, ou embarque 365 fases prontas. Guarde o resultado em `Storage.data.daily`, que já existe no save. |
| **Resultado compartilhável** (WhatsApp) | Monte um texto com emojis (ex.: `🚌 Bus Crazy People – Diário 12/10 – 18 jogadas 🟥🟦🟨`) e use `@capacitor/share`. |
| **Play Games Services** (conquistas, ranking, save na nuvem) | Crie um `src/services/PlayGames.js` no mesmo padrão do `AdManager`, com uma única interface e um provider de teste no navegador. O save inteiro é um JSON (`Storage.data`), fácil de enviar para o save na nuvem. |
| **In-App Review** | Plugin `@capacitor-community/in-app-review`, chamado em `GameScene.showWin()` depois de uma vitória marcante (ex.: o 1º Desafio ou a fase 30). Nunca deve aparecer junto com um intersticial. |

## Já implementado (v1.0)

Ônibus **coberto**, **cadeado e chave**, **obra com cones** (por jogadas) e **terminal** que solta ônibus – ver `docs/PESQUISA_MECANICAS.md`.

## v1.2+

| Mecânica | Como entra no formato e no motor |
|---|---|
| **Ônibus de dois andares** (duas cores) | Novo tipo em `BUS_TYPES` com `colors: [a, b]` e lugares por cor. Em `resolveBoarding()` (`src/core/engine.js`), o passageiro procura um lugar livre da sua cor. |
| **Ônibus articulado** | Tipo com `len` 5 que gira no meio. Em `scanPath()`, o caminho considera a curva. |
| **Semáforos** | `mechanics: [{ type: "light", x, y, period }]`. A casa fica bloqueada nos turnos (jogadas) em que estiver vermelho. Isso é determinístico, então o solver continua funcionando (o turno já faz parte do estado). |
| **Pontes levadiças** | Como as obras (`cones`), mas abrindo e fechando em ciclo: casa bloqueada quando `floor(moves / período)` é ímpar. |
| **Bairros e cidades** (meta-progressão) | Agrupe as fases em `levels/<cidade>.json`. `src/levels/index.js` passa a carregar o pacote da cidade, e o tema visual vem de `CONFIG.colors` por cidade. |
| **Modo Hora do Rush** (com tempo) | Cena derivada da `GameScene` com um cronômetro. O motor não muda. |
| **Modo Zen** | Sem prioritários e com vagas extras: basta alterar a fase ao carregar (`level.priority = []`, `slots + 2`). |

Regra de ouro: toda mecânica nova deve ser **determinística por jogada**. Assim o solver continua provando que as fases têm solução e o gerador continua rejeitando as que não têm.
