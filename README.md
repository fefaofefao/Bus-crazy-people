# Bus Crazy People

Puzzle casual de ônibus ("bus jam") para Android, com cidade brasileira, 300 fases sempre resolvíveis e anúncios só em momentos naturais.

- **Tecnologia:** Phaser 3 + Vite (JavaScript), empacotado com Capacitor 8 (Android). É a mesma stack do Life Direction.
- **Fases:** 10 de tutorial feitas à mão e 290 geradas com semente. Todas são aprovadas por um solver, que prova que há solução sem boosters. São iguais para todos os jogadores e ficam em `levels/levels.json`.

> Documentação completa: veja as seções abaixo, que vão sendo completadas a cada marco.

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | instala as dependências |
| `npm run dev` | abre o jogo em http://localhost:5173 (use `?debug=1` para o painel de teste) |
| `npm test` | testa o motor, as 300 fases (solver), os anúncios e os 3 idiomas |
| `npm run levels:generate` | regera `levels/levels.json` (parâmetros em `scripts/generator-config.js`) |
| `npm run test:levels` | valida o pacote de fases: estrutura, solução gravada, solver e curva |
| `npm run build` | gera a versão web em `dist/` |
