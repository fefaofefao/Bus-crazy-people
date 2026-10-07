// Gera toda a arte vetorial da marca (estilo "adesivo de rua": cores chapadas,
// contorno azul-marinho grosso, sombra dura). Ver docs/IDENTIDADE.md.
//
//   node scripts/make-brand.js
//
// Saída:
//   public/brand/tiao.svg        mascote Seu Tião (motorista), usado nas dicas e janelas
//   public/brand/bus-front.svg   ônibus de frente com o Tião e passageiros (logo/menu)
//   public/icon.svg              ícone web
//   assets/icon-*.svg, splash*.svg  fontes do ícone e da splash do Android
// Depois: node scripts/svg-to-png.cjs assets/*.svg  e
//   npx @capacitor/assets generate --android --iconBackgroundColor '#ff8a4c' --splashBackgroundColor '#ff8a4c'

import { writeFileSync, mkdirSync } from 'node:fs';

const INK = '#1b2340';
const YEL = '#ffc72c';
const YEL_D = '#e0a400';

/** Seu Tião: cabeça do motorista (centro cx, cy; raio r). */
function tiao(cx, cy, r, { wave = false } = {}) {
  const o = r * 0.1;
  return `<g stroke="${INK}" stroke-width="${o}" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="${cx}" cy="${cy + r * 1.02}" rx="${r * 0.95}" ry="${r * 0.42}" fill="#2e9bff"/>
  <path d="M ${cx - r * 0.3} ${cy + r * 0.72} L ${cx} ${cy + r * 1.05} L ${cx + r * 0.3} ${cy + r * 0.72}" fill="#fff"/>
  <circle cx="${cx - r * 0.98}" cy="${cy + r * 0.05}" r="${r * 0.2}" fill="#d9a274"/>
  <circle cx="${cx + r * 0.98}" cy="${cy + r * 0.05}" r="${r * 0.2}" fill="#d9a274"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#d9a274"/>
  <path d="M ${cx - r * 1.02} ${cy - r * 0.32} Q ${cx} ${cy - r * 1.65} ${cx + r * 1.02} ${cy - r * 0.32} Z" fill="#2e9bff"/>
  <path d="M ${cx - r * 1.12} ${cy - r * 0.3} Q ${cx} ${cy - r * 0.5} ${cx + r * 1.32} ${cy - r * 0.22} L ${cx + r * 1.28} ${cy - r * 0.06} Q ${cx} ${cy - r * 0.3} ${cx - r * 1.1} ${cy - r * 0.12} Z" fill="${YEL}"/>
  <circle cx="${cx}" cy="${cy - r * 0.78}" r="${r * 0.2}" fill="${YEL}"/>
  <circle cx="${cx - r * 0.36}" cy="${cy + r * 0.08}" r="${r * 0.17}" fill="#fff"/>
  <circle cx="${cx + r * 0.36}" cy="${cy + r * 0.08}" r="${r * 0.17}" fill="#fff"/>
  <circle cx="${cx - r * 0.32}" cy="${cy + r * 0.1}" r="${r * 0.07}" fill="${INK}" stroke="none"/>
  <circle cx="${cx + r * 0.4}" cy="${cy + r * 0.1}" r="${r * 0.07}" fill="${INK}" stroke="none"/>
  <path d="M ${cx - r * 0.55} ${cy - r * 0.16} Q ${cx - r * 0.36} ${cy - r * 0.26} ${cx - r * 0.18} ${cy - r * 0.14}" fill="none"/>
  <path d="M ${cx + r * 0.18} ${cy - r * 0.14} Q ${cx + r * 0.36} ${cy - r * 0.28} ${cx + r * 0.56} ${cy - r * 0.18}" fill="none"/>
  <circle cx="${cx - r * 0.62}" cy="${cy + r * 0.45}" r="${r * 0.14}" fill="#ff8fa3" stroke="none" opacity=".8"/>
  <circle cx="${cx + r * 0.62}" cy="${cy + r * 0.45}" r="${r * 0.14}" fill="#ff8fa3" stroke="none" opacity=".8"/>
  <path d="M ${cx - r * 0.34} ${cy + r * 0.62} Q ${cx} ${cy + r * 0.92} ${cx + r * 0.34} ${cy + r * 0.62}" fill="#fff"/>
  <path d="M ${cx - r * 0.62} ${cy + r * 0.48} Q ${cx - r * 0.3} ${cy + r * 0.26} ${cx} ${cy + r * 0.42} Q ${cx + r * 0.3} ${cy + r * 0.26} ${cx + r * 0.62} ${cy + r * 0.48} Q ${cx + r * 0.3} ${cy + r * 0.62} ${cx} ${cy + r * 0.5} Q ${cx - r * 0.3} ${cy + r * 0.62} ${cx - r * 0.62} ${cy + r * 0.48} Z" fill="#4a2b1a"/>
  ${wave ? `<path d="M ${cx + r * 0.9} ${cy + r * 0.9} L ${cx + r * 1.45} ${cy + r * 0.1}" stroke="#d9a274" stroke-width="${r * 0.32}"/><circle cx="${cx + r * 1.5}" cy="${cy}" r="${r * 0.2}" fill="#d9a274"/>` : ''}
</g>`;
}

/** Passageiro "doido" (cabeça + ombros) para a janela. */
function rider(cx, cy, r, shirt, skin, hair, mood = 0) {
  const o = r * 0.12;
  const mouth = mood === 1 ? `<ellipse cx="${cx}" cy="${cy + r * 0.38}" rx="${r * 0.2}" ry="${r * 0.24}" fill="${INK}"/>` : `<path d="M ${cx - r * 0.38} ${cy + r * 0.3} Q ${cx} ${cy + r * 0.7} ${cx + r * 0.38} ${cy + r * 0.3}" fill="#fff"/>`;
  return `<g stroke="${INK}" stroke-width="${o}" stroke-linejoin="round" stroke-linecap="round">
  <rect x="${cx - r * 1.05}" y="${cy + r * 0.8}" width="${r * 2.1}" height="${r * 1.4}" rx="${r * 0.6}" fill="${shirt}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${skin}"/>
  <path d="M ${cx - r * 1.02} ${cy - r * 0.1} Q ${cx - r * 0.2} ${cy - r * 1.7} ${cx + r * 1.02} ${cy - r * 0.2} Q ${cx + r * 0.2} ${cy - r * 0.75} ${cx - r * 1.02} ${cy - r * 0.1} Z" fill="${hair}"/>
  <circle cx="${cx - r * 0.35}" cy="${cy + r * 0.02}" r="${r * 0.12}" fill="${INK}" stroke="none"/>
  <circle cx="${cx + r * 0.35}" cy="${cy + r * 0.02}" r="${r * 0.12}" fill="${INK}" stroke="none"/>
  ${mouth}
</g>`;
}

/** Ônibus urbano de frente (centro cx, cy; largura w). */
function busFront(cx, cy, w) {
  const h = w * 1.06;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const o = w * 0.03;
  const P = (f) => +(f * w).toFixed(1);
  return `<g stroke="${INK}" stroke-width="${o}" stroke-linejoin="round">
  <rect x="${x + P(0.1)}" y="${y + h - P(0.08)}" width="${P(0.18)}" height="${P(0.16)}" rx="${P(0.05)}" fill="${INK}"/>
  <rect x="${x + P(0.72)}" y="${y + h - P(0.08)}" width="${P(0.18)}" height="${P(0.16)}" rx="${P(0.05)}" fill="${INK}"/>
  <rect x="${x}" y="${y + P(0.04)}" width="${w}" height="${h}" rx="${P(0.15)}" fill="${INK}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${P(0.15)}" fill="${YEL}"/>
  <rect x="${x + P(0.02)}" y="${y + h * 0.82}" width="${w - P(0.04)}" height="${h * 0.16}" rx="${P(0.1)}" fill="${YEL_D}" stroke="none"/>
  <rect x="${x + P(0.16)}" y="${y + P(0.06)}" width="${P(0.68)}" height="${P(0.12)}" rx="${P(0.04)}" fill="${INK}"/>
  <text x="${cx}" y="${y + P(0.155)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${P(0.075)}" fill="#ff9f1c" stroke="none" letter-spacing="${P(0.01)}">BUS CRAZY</text>
  <rect x="${x + P(0.08)}" y="${y + P(0.24)}" width="${P(0.84)}" height="${P(0.46)}" rx="${P(0.07)}" fill="#3b5b8f"/>
  <g stroke="none">${rider(x + P(0.47), y + P(0.47), P(0.075), '#e53935', '#f2c9a0', '#2b1d14', 0)}</g>
  ${rider(x + P(0.66), y + P(0.45), P(0.075), '#23b26d', '#8d5a3a', '#111', 1)}
  ${rider(x + P(0.82), y + P(0.5), P(0.07), '#8e3fc1', '#d9a274', '#c9a15a', 0)}
  ${tiao(x + P(0.25), y + P(0.47), P(0.1))}
  <path d="M ${x + P(0.1)} ${y + P(0.26)} L ${x + P(0.34)} ${y + P(0.26)} L ${x + P(0.1)} ${y + P(0.5)} Z" fill="#fff" opacity=".28" stroke="none"/>
  <rect x="${x}" y="${y + P(0.76)}" width="${w}" height="${P(0.06)}" fill="#fff"/>
  <circle cx="${x + P(0.19)}" cy="${y + P(0.91)}" r="${P(0.07)}" fill="#fff6c9"/>
  <circle cx="${x + P(0.81)}" cy="${y + P(0.91)}" r="${P(0.07)}" fill="#fff6c9"/>
  <rect x="${x + P(0.34)}" y="${y + P(0.87)}" width="${P(0.32)}" height="${P(0.08)}" rx="${P(0.04)}" fill="${INK}"/>
</g>`;
}

/** Fundo de pôr do sol com raios (cartaz de rua). */
function sunset(W, H, rx = 0) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a0 = (i / 16) * Math.PI * 2;
    const a1 = a0 + Math.PI / 16;
    const R = Math.max(W, H);
    const cx = W / 2;
    const cy = H * 0.55;
    return `<path d="M ${cx} ${cy} L ${cx + Math.cos(a0) * R} ${cy + Math.sin(a0) * R} L ${cx + Math.cos(a1) * R} ${cy + Math.sin(a1) * R} Z" fill="#fff" opacity=".09"/>`;
  }).join('');
  return `<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset=".55" stop-color="#ff8a4c"/><stop offset="1" stop-color="#ff4f8b"/></linearGradient>
  <clipPath id="clip"><rect width="${W}" height="${H}" rx="${rx}"/></clipPath></defs>
  <g clip-path="url(#clip)"><rect width="${W}" height="${H}" fill="url(#sun)"/>${rays}
  <path d="M 0 ${H * 0.8} Q ${W * 0.12} ${H * 0.62} ${W * 0.24} ${H * 0.8} Q ${W * 0.36} ${H * 0.52} ${W * 0.5} ${H * 0.8} L ${W} ${H * 0.8} L ${W} ${H} L 0 ${H} Z" fill="#c2396f" opacity=".55"/>
  <rect y="${H * 0.8}" width="${W}" height="${H * 0.2}" fill="${INK}" opacity=".35"/></g>`;
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const out = {
  'public/brand/tiao.svg': svg(240, 240, tiao(120, 112, 70, { wave: true })),
  'public/brand/bus-front.svg': svg(600, 680, busFront(300, 330, 540)),
  'public/icon.svg': svg(512, 512, sunset(512, 512, 112) + busFront(256, 262, 330)),
  'assets/icon-only.svg': svg(1024, 1024, sunset(1024, 1024) + busFront(512, 520, 650)),
  'assets/icon-foreground.svg': svg(1024, 1024, busFront(512, 512, 560)),
  'assets/icon-background.svg': svg(1024, 1024, sunset(1024, 1024)),
  'assets/splash.svg': svg(2732, 2732, sunset(2732, 2732) + busFront(1366, 1320, 700)),
  'assets/splash-dark.svg': svg(2732, 2732, sunset(2732, 2732) + busFront(1366, 1320, 700)),
};
for (const [f, s] of Object.entries(out)) {
  mkdirSync(new URL('../' + f.split('/').slice(0, -1).join('/') + '/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../' + f, import.meta.url), s);
}
console.log('SVGs gerados:', Object.keys(out).join(', '));
