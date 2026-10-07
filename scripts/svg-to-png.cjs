// Converte SVGs em PNG com o Chromium (Playwright). Ferramenta de arte, não roda no CI.
// Uso: node scripts/svg-to-png.cjs arquivo1.svg [arquivo2.svg ...]   (gera .png ao lado)
// Requer o Playwright instalado (npm i -g playwright && npx playwright install chromium).

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch();
  for (const file of process.argv.slice(2)) {
    const svg = readFileSync(file, 'utf8');
    const w = Number(/width="(\d+)"/.exec(svg)[1]);
    const h = Number(/height="(\d+)"/.exec(svg)[1]);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const out = file.replace(/\.svg$/, '.png');
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    console.log('✓', path.relative(process.cwd(), out));
  }
  await browser.close();
})();
