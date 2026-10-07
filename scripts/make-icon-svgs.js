// Gera os SVGs do ícone, da splash e do recurso gráfico da loja: ônibus urbano
// amarelo, de frente, cheio de passageiros animados.
// Uso: node scripts/make-icon-svgs.js
// Depois converta assets/*.svg em PNG (mesmo nome; o script tools/svg-to-png
// do README usa o Chromium) e rode:
//   npx @capacitor/assets generate --android --iconBackgroundColor '#7cc6ee' --splashBackgroundColor '#7cc6ee'

import { writeFileSync, mkdirSync } from 'node:fs';

const SKIN = ['#f2c9a0', '#b57a4e', '#d9a274', '#8d5a3a'];
const SHIRT = ['#e53935', '#1e6fd9', '#2e9e44', '#8e3fc1'];

/** Ônibus de frente com centro (cx, cy) e largura w. */
function bus(cx, cy, w) {
  const h = w * 1.08;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const p = (f) => (f * w).toFixed(1);
  const faces = [0.3, 0.5, 0.7]
    .map((fx, i) => {
      const fxp = x + w * fx;
      const fy = y + w * 0.5;
      const r = w * 0.085;
      return `<rect x="${fxp - r * 1.1}" y="${fy + r * 0.7}" width="${r * 2.2}" height="${r * 1.6}" rx="${r * 0.6}" fill="${SHIRT[i]}"/>
<circle cx="${fxp}" cy="${fy}" r="${r}" fill="${SKIN[i]}"/>
<circle cx="${fxp - r * 0.35}" cy="${fy - r * 0.1}" r="${r * 0.13}" fill="#1d2b3d"/><circle cx="${fxp + r * 0.35}" cy="${fy - r * 0.1}" r="${r * 0.13}" fill="#1d2b3d"/>
<path d="M ${fxp - r * 0.45} ${fy + r * 0.3} Q ${fxp} ${fy + r * 0.85} ${fxp + r * 0.45} ${fy + r * 0.3}" stroke="#1d2b3d" stroke-width="${r * 0.14}" fill="none" stroke-linecap="round"/>
<path d="M ${fxp - r} ${fy - r * 0.3} Q ${fxp} ${fy - r * 1.6} ${fxp + r} ${fy - r * 0.3}" fill="${['#2b1d14', '#111', '#c9a15a'][i]}"/>
<line x1="${fxp + r * 0.8}" y1="${fy + r * 0.9}" x2="${fxp + r * 1.4}" y2="${fy - r * 0.5}" stroke="${SKIN[i]}" stroke-width="${r * 0.35}" stroke-linecap="round"/>`;
    })
    .join('\n');
  return `<g>
<ellipse cx="${cx}" cy="${y + h + w * 0.03}" rx="${w * 0.5}" ry="${w * 0.05}" fill="#000" opacity=".2"/>
<rect x="${x + w * 0.1}" y="${y + h - w * 0.08}" width="${p(0.16)}" height="${p(0.14)}" rx="${p(0.04)}" fill="#1b1f27"/>
<rect x="${x + w * 0.74}" y="${y + h - w * 0.08}" width="${p(0.16)}" height="${p(0.14)}" rx="${p(0.04)}" fill="#1b1f27"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${p(0.14)}" fill="#e0a400"/>
<rect x="${x + w * 0.03}" y="${y}" width="${w * 0.94}" height="${h * 0.96}" rx="${p(0.13)}" fill="#ffc93c"/>
<rect x="${x + w * 0.16}" y="${y + w * 0.06}" width="${p(0.68)}" height="${p(0.11)}" rx="${p(0.03)}" fill="#1d2b3d"/>
<rect x="${x + w * 0.22}" y="${y + w * 0.095}" width="${p(0.56)}" height="${p(0.04)}" rx="${p(0.02)}" fill="#ff9f1c"/>
<rect x="${x + w * 0.1}" y="${y + w * 0.22}" width="${p(0.8)}" height="${p(0.48)}" rx="${p(0.06)}" fill="#22344d"/>
${faces}
<path d="M ${x + w * 0.14} ${y + w * 0.25} L ${x + w * 0.38} ${y + w * 0.25} L ${x + w * 0.14} ${y + w * 0.5} Z" fill="#9fd8ff" opacity=".25"/>
<rect x="${x + w * 0.03}" y="${y + w * 0.76}" width="${p(0.94)}" height="${p(0.06)}" fill="#ffffff"/>
<circle cx="${x + w * 0.2}" cy="${y + w * 0.9}" r="${p(0.065)}" fill="#fff4c2"/>
<circle cx="${x + w * 0.8}" cy="${y + w * 0.9}" r="${p(0.065)}" fill="#fff4c2"/>
<rect x="${x + w * 0.36}" y="${y + w * 0.86}" width="${p(0.28)}" height="${p(0.07)}" rx="${p(0.03)}" fill="#c98f00"/>
</g>`;
}

const svg = (w, h, body, bg, rx = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${
    bg ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#5fb4e6"/></linearGradient></defs><rect width="${w}" height="${h}" rx="${rx}" fill="url(#g)"/>` : ''
  }${body}</svg>`;

const out = {
  'assets/icon-only.svg': svg(1024, 1024, bus(512, 500, 640), true),
  // ícone adaptativo: o Capacitor Assets aplica margem, então o desenho ocupa ~60%
  'assets/icon-foreground.svg': svg(1024, 1024, bus(512, 500, 560)),
  'assets/icon-background.svg': svg(1024, 1024, '', true),
  'assets/splash.svg': svg(2732, 2732, bus(1366, 1340, 640), true),
  'assets/splash-dark.svg': svg(2732, 2732, bus(1366, 1340, 640), true),
  'public/icon.svg': svg(512, 512, bus(256, 250, 330), true, 112),
};
mkdirSync(new URL('../assets', import.meta.url), { recursive: true });
for (const [f, s] of Object.entries(out)) writeFileSync(new URL('../' + f, import.meta.url), s);
console.log('SVGs gerados:', Object.keys(out).join(', '));
