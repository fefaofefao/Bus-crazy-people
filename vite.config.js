import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Caminhos relativos: funciona no GitHub Pages (subpasta /repo/) e no Capacitor
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
