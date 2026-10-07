// Gera as imagens da ficha da Play Store a partir do próprio jogo (Chromium/Playwright):
//   store/icon-512.png
//   store/feature-graphic-<idioma>.png  (1024×500)
//   store/screenshots/<idioma>/NN.png   (1080×1920, 7 por idioma)
// Uso: npm run build && npx vite preview --port 4173 &  depois  node scripts/store-assets.cjs
// Requer o Playwright (veja scripts/svg-to-png.cjs).

const { mkdirSync, readFileSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const LANGS = [
  { code: 'pt-BR', store: 'pt-BR', tag: 'Organize o estacionamento e leve todo mundo!', sub: '300 fases · sempre com solução' },
  { code: 'en', store: 'en-US', tag: 'Clear the parking lot and get everyone on board!', sub: '300 levels · always solvable' },
  { code: 'es', store: 'es-419', tag: '¡Ordena el estacionamiento y lleva a todos!', sub: '300 niveles · siempre con solución' },
];
const URL = process.env.GAME_URL || 'http://localhost:4173/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  mkdirSync('store/screenshots', { recursive: true });

  // ícone 512
  {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    const svg = readFileSync('assets/icon-only.svg', 'utf8').replace('width="1024" height="1024"', 'width="512" height="512"');
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    await page.screenshot({ path: 'store/icon-512.png' });
    await page.close();
  }

  for (const L of LANGS) {
    // recurso gráfico 1024×500
    const icon = readFileSync('assets/icon-foreground.svg', 'utf8').replace('width="1024" height="1024"', 'width="440" height="440"');
    const fg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    await fg.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap" rel="stylesheet"></head>
      <body style="margin:0;width:1024px;height:500px;overflow:hidden;background:linear-gradient(#8fd3ff,#5fb4e6);font-family:Fredoka,system-ui,sans-serif;position:relative">
      <div style="position:absolute;left:0;right:0;bottom:0;height:90px;background:#565d70"></div>
      <div style="position:absolute;left:0;right:0;bottom:84px;height:10px;background:#c9bca3"></div>
      <div style="position:absolute;left:14px;top:20px">${icon}</div>
      <div style="position:absolute;left:470px;top:70px;width:520px">
        <div style="font-size:78px;font-weight:700;color:#fff;-webkit-text-stroke:3px #1f2a44;line-height:1">BUS CRAZY</div>
        <div style="font-size:78px;font-weight:700;color:#ffc93c;-webkit-text-stroke:3px #1f2a44;line-height:1.05">PEOPLE</div>
        <div style="font-size:30px;font-weight:600;color:#1f2a44;margin-top:18px">${L.tag}</div>
        <div style="font-size:24px;font-weight:600;color:#fff;margin-top:12px">${L.sub}</div>
      </div></body></html>`);
    await fg.waitForTimeout(800);
    await fg.screenshot({ path: `store/feature-graphic-${L.store}.png` });
    await fg.close();

    // capturas 1080×1920 (360×640 a 3x)
    const dir = `store/screenshots/${L.store}`;
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: L.code });
    await ctx.addInitScript((lang) => {
      localStorage.setItem('busCrazyPeople.save', JSON.stringify({ language: lang, completed: Array.from({ length: 41 }, (_, i) => i + 1), settings: { music: false, sound: false } }));
    }, L.code);
    const p = await ctx.newPage();
    await p.goto(URL);
    await p.waitForTimeout(5000);
    const go = async (key, data, wait = 4000) => {
      await p.evaluate(([k, d]) => {
        document.querySelectorAll('.fds-overlay').forEach((e) => e.remove());
        window.__game.scene.getScenes(true)[0].scene.start(k, d);
      }, [key, data]);
      await p.waitForTimeout(wait);
      await p.evaluate(() => document.querySelectorAll('.fds-overlay').forEach((e) => e.remove()));
      await p.evaluate(() => { const g = window.__game.scene.getScene('Game'); if (g?.sys.isActive()) g.modalOpen = false; });
    };
    const playN = async (n) => {
      for (let i = 0; i < n; i++) {
        await p.evaluate((i) => { const g = window.__game.scene.getScene('Game'); g.play(g.level.solution[i]); }, i);
        // espera a animação terminar (o relógio do jogo é lento no Chromium sem GPU)
        for (let k = 0; k < 150 && (await p.evaluate(() => window.__game.scene.getScene('Game').busy)); k++) await p.waitForTimeout(100);
        await p.waitForTimeout(1500);
      }
    };
    let k = 1;
    const shot = async () => p.screenshot({ path: `${dir}/${String(k++).padStart(2, '0')}.png` });
    await go('Menu', {}); await shot();
    await go('Game', { level: 1 }); await shot();
    await go('Game', { level: 42 }); await playN(4); await shot();
    await go('Game', { level: 9 }); await shot();
    await go('Game', { level: 146 }); await playN(3); await shot();
    await go('Game', { level: 125 }); await playN(2); await shot();
    await go('Levels', {}); await shot();
    await ctx.close();
    console.log('✓', L.store);
  }
  await browser.close();
})();
