// Gera as imagens da ficha da Play Store a partir do próprio jogo (Chromium/Playwright):
//   store/icon-512.png
//   store/feature-graphic-<idioma>.png  (1024×500)
//   store/screenshots/<idioma>/NN.png   (1080×1920, 7 por idioma)
// Uso: npm run build && npx vite preview --port 4173 &  depois  node scripts/store-assets.cjs
// Requer o Playwright (veja scripts/svg-to-png.cjs).

const { mkdirSync, readFileSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const LANGS = [
  { code: 'pt-BR', store: 'pt-BR', tag: 'Organize o estacionamento e leve todo mundo!', sub: '300 fases · 3 estrelas · 18 conquistas' },
  { code: 'en', store: 'en-US', tag: 'Clear the parking lot and get everyone on board!', sub: '300 levels · 3 stars · 18 achievements' },
  { code: 'es', store: 'es-419', tag: '¡Ordena el estacionamiento y lleva a todos!', sub: '300 niveles · 3 estrellas · 18 logros' },
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
    // recurso gráfico 1024×500 (identidade: pôr do sol, raios, ônibus do Tião, Lilita One)
    const bus = readFileSync('public/brand/bus-front.svg', 'utf8').replace('width="600" height="680"', 'width="330" height="374"');
    const fg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    const rays = Array.from({ length: 18 }, (_, i) => `<div style="position:absolute;left:300px;top:320px;width:1400px;height:90px;margin-top:-45px;transform-origin:0 50%;transform:rotate(${i * 20}deg);background:linear-gradient(90deg,rgba(255,255,255,.12),rgba(255,255,255,0));clip-path:polygon(0 50%,100% 0,100% 100%)"></div>`).join('');
    const stroke = '-webkit-text-stroke:8px #1b2340;paint-order:stroke fill;';
    await fg.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Fredoka:wght@600&display=swap" rel="stylesheet"></head>
      <body style="margin:0;width:1024px;height:500px;overflow:hidden;background:linear-gradient(#ffd166,#ff8a4c 60%,#ff4f8b);position:relative;font-family:'Lilita One',sans-serif">
      ${rays}
      <div style="position:absolute;left:0;right:0;bottom:0;height:70px;background:#1b2340"></div>
      <div style="position:absolute;left:0;right:0;bottom:70px;height:10px;background:#e7d3ad;border-top:4px solid #1b2340"></div>
      <div style="position:absolute;left:60px;top:40px;filter:drop-shadow(0 8px 0 rgba(27,35,64,.45))">${bus}</div>
      <div style="position:absolute;left:430px;top:58px;width:560px;transform:rotate(-4deg)">
        <div style="font-size:96px;line-height:.95;color:#fff;${stroke}text-shadow:0 8px 0 #1b2340">BUS CRAZY</div>
        <div style="display:inline-block;margin-top:10px;padding:2px 26px 8px;background:#ff4f8b;border:5px solid #1b2340;border-radius:18px;box-shadow:0 7px 0 #1b2340;font-size:74px;line-height:1;color:#ffc72c;${stroke}">PEOPLE</div>
        <div style="font-family:Fredoka,sans-serif;font-weight:600;font-size:28px;color:#1b2340;margin-top:22px">${L.tag}</div>
        <div style="display:inline-block;margin-top:12px;padding:6px 16px;background:#1b2340;border-radius:12px;font-size:24px;color:#ffc72c">${L.sub}</div>
      </div></body></html>`);
    await fg.waitForTimeout(1200);
    await fg.screenshot({ path: `store/feature-graphic-${L.store}.png` });
    await fg.close();

    // capturas 1080×1920 (360×640 a 3x)
    const dir = `store/screenshots/${L.store}`;
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: L.code });
    await ctx.addInitScript((lang) => {
      localStorage.setItem('busCrazyPeople.save', JSON.stringify({ language: lang, completed: Array.from({ length: 41 }, (_, i) => i + 1), stars: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [i + 1, 1 + ((i * 7) % 3 === 0 ? 1 : 2) % 3 + ((i % 4) ? 1 : 0)].map((v, j) => (j ? Math.min(3, v) : v)))), achievements: ['first_ride', 'perfect', 'levels_25', 'challenge_1', 'combo_3'], settings: { music: false, sound: false } }));
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
    await go('Game', { level: 138 }); await playN(3); await shot();
    await go('Game', { level: 127 }); await playN(2); await shot();
    await go('Levels', {}); await shot();
    await go('Achievements', {}); await shot();
    await ctx.close();
    console.log('✓', L.store);
  }
  await browser.close();
})();
