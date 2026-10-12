// Gera as 8 imagens promocionais da Play Store (1080x1920) nos 3 idiomas:
// captura de store/screenshots/<idioma>/ dentro de um celular, com cenário
// ilustrado (cidade ao pôr do sol) e título grande.
// Uso: npm ci && node scripts/make-store-promo.mjs   (precisa do Playwright)
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright'));
}
const root = fileURLToPath(new URL('../', import.meta.url));
const b64 = (p) => readFileSync(root + p).toString('base64');
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c.join(',')})`;
};

const LANGS = ['pt-BR', 'en-US', 'es-419'];
const OUT = 'store/promo';
const SHOT = (lang, shot) => `store/screenshots/${lang}/${shot}.png`;
const font = (p) => b64(`node_modules/@fontsource/${p}`);
const FONTS_CSS = `
  @font-face{font-family:Body;font-weight:700;src:url(data:font/woff2;base64,${font('fredoka/files/fredoka-latin-700-normal.woff2')})}
  @font-face{font-family:Title;font-weight:400;src:url(data:font/woff2;base64,${font('lilita-one/files/lilita-one-latin-400-normal.woff2')})}`;
const TITLE = { ink: '#2a1a4a', outline: '#fff', weight: 400, size: 136 };

// [captura, cenário, textos por idioma: [linha pequena, linha grande]]
const SLIDES = [
  ['01', 0, { 'pt-BR': ['Puzzle de ônibus', 'Leve todo mundo!'], 'en-US': ['Bus puzzle', 'Get everyone aboard!'], 'es-419': ['Puzzle de autobuses', '¡Llévalos a todos!'] }],
  ['02', 1, { 'pt-BR': ['Fácil de aprender', 'Toque no ônibus!'], 'en-US': ['Easy to learn', 'Tap a bus!'], 'es-419': ['Fácil de aprender', '¡Toca un autobús!'] }],
  ['03', 2, { 'pt-BR': ['Combine as cores', 'Todos a bordo!'], 'en-US': ['Match the colors', 'All aboard!'], 'es-419': ['Combina los colores', '¡Todos a bordo!'] }],
  ['04', 3, { 'pt-BR': ['Passageiro com pressa', 'Corra contra o tempo!'], 'en-US': ['Passengers in a hurry', 'Beat the clock!'], 'es-419': ['Pasajeros con prisa', '¡Contra el reloj!'] }],
  ['05', 4, { 'pt-BR': ['Cones e obstáculos', 'Novos desafios!'], 'en-US': ['Cones and obstacles', 'New challenges!'], 'es-419': ['Conos y obstáculos', '¡Nuevos desafíos!'] }],
  ['06', 5, { 'pt-BR': ['Estacionamento lotado', 'Libere o caminho!'], 'en-US': ['Packed parking lot', 'Clear the way!'], 'es-419': ['Estacionamiento lleno', '¡Abre el camino!'] }],
  ['07', 6, { 'pt-BR': ['300 fases', 'Ganhe 3 estrelas!'], 'en-US': ['300 levels', 'Earn 3 stars!'], 'es-419': ['300 niveles', '¡Gana 3 estrellas!'] }],
  ['08', 7, { 'pt-BR': ['Desbloqueie', 'Conquistas!'], 'en-US': ['Unlock', 'Achievements!'], 'es-419': ['Desbloquea', '¡Logros!'] }],
];

const SCENES = [
  { sky: ['#ff7a3d', '#ffd36b'], title: ['#ffe14d', '#ff4d8d'] },
  { sky: ['#3fb6ff', '#c9f1ff'], title: ['#ffe14d', '#ff7a1a'] },
  { sky: ['#ff6aa8', '#ffd6a0'], title: ['#fff36b', '#2fc46a'] },
  { sky: ['#7a5cff', '#ffb3d1'], title: ['#ffe14d', '#ff3d5a'] },
  { sky: ['#ffb347', '#fff1c9'], title: ['#ffe14d', '#ff7a1a'] },
  { sky: ['#22c1c3', '#fdf6b8'], title: ['#ffe14d', '#a259ff'] },
  { sky: ['#2f6bff', '#a8e2ff'], title: ['#fff36b', '#ffb000'] },
  { sky: ['#ff8a5c', '#ffe6c9'], title: ['#ffe14d', '#2f9bff'] },
];

const BUS = ['#ff4d4d', '#3ec95a', '#ffd23f', '#a259ff', '#ff6fb5', '#2f9bff', '#ff9a1a', '#2ed1c9'];
const SKIN = ['#f6c9a0', '#d99a6c', '#a86b45', '#6e4329', '#ffd8b8'];

// Ônibus visto de cima (igual ao jogo)
function topBus(color, len, w = 70) {
  const h = len * 70;
  let dots = '';
  for (let i = 0; i < len * 2; i++) dots += `<circle cx="${w / 2 - 9}" cy="${30 + i * 32}" r="5" fill="#fff" opacity=".85"/><circle cx="${w / 2 + 9}" cy="${30 + i * 32}" r="5" fill="#fff" opacity=".85"/>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="14" fill="${shade(color, 0.65)}"/>
    <rect x="6" y="4" width="${w - 12}" height="${h - 12}" rx="11" fill="${color}"/>
    <rect x="12" y="10" width="${w - 24}" height="14" rx="6" fill="#2a2440" opacity=".55"/>${dots}</svg>`;
}
// Passageiro (cabeça + corpo)
function person(shirt, skin, s = 60) {
  return `<svg width="${s}" height="${s * 1.3}" viewBox="0 0 60 78">
    <rect x="8" y="38" width="44" height="40" rx="18" fill="${shirt}" stroke="${shade(shirt, 0.6)}" stroke-width="3"/>
    <circle cx="30" cy="24" r="18" fill="${skin}" stroke="${shade(skin, 0.7)}" stroke-width="3"/>
    <path d="M13 20 Q30 0 47 20 Q40 12 30 12 Q20 12 13 20Z" fill="#3a2a20"/>
    <circle cx="24" cy="26" r="2.6" fill="#1d1d2a"/><circle cx="36" cy="26" r="2.6" fill="#1d1d2a"/>
    <path d="M25 32 Q30 36 35 32" stroke="#1d1d2a" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
}
// Mascote: ônibus de frente com carinha
function busMascot(color, s) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 200 200">
    <ellipse cx="100" cy="192" rx="80" ry="8" fill="#000" opacity=".25"/>
    <rect x="44" y="160" width="28" height="30" rx="8" fill="#26222e"/><rect x="128" y="160" width="28" height="30" rx="8" fill="#26222e"/>
    <rect x="22" y="20" width="156" height="158" rx="34" fill="${color}" stroke="${shade(color, 0.6)}" stroke-width="6"/>
    <rect x="40" y="36" width="120" height="62" rx="16" fill="#bfe8ff" stroke="${shade(color, 0.6)}" stroke-width="5"/>
    <path d="M52 46 L70 46 L56 86 L46 86Z" fill="#fff" opacity=".6"/>
    <rect x="62" y="8" width="76" height="18" rx="8" fill="${shade(color, 0.8)}"/>
    <circle cx="66" cy="124" r="20" fill="#fff"/><circle cx="134" cy="124" r="20" fill="#fff"/>
    <circle cx="70" cy="127" r="11" fill="#1d1d2a"/><circle cx="138" cy="127" r="11" fill="#1d1d2a"/>
    <circle cx="74" cy="121" r="4.5" fill="#fff"/><circle cx="142" cy="121" r="4.5" fill="#fff"/>
    <ellipse cx="44" cy="150" rx="10" ry="6" fill="#ff6b8b" opacity=".6"/><ellipse cx="156" cy="150" rx="10" ry="6" fill="#ff6b8b" opacity=".6"/>
    <path d="M84 150 Q100 166 116 150" stroke="#1d1d2a" stroke-width="6" stroke-linecap="round" fill="none"/>
  </svg>`;
}
// Prédios coloridos
function skyline(seed) {
  const cols = ['#ff8fb1', '#ffd36b', '#8fd6ff', '#b69cff', '#7fe0a8', '#ffb07a'];
  let x = -20, out = '', i = seed;
  while (x < 1100) {
    const w = 90 + ((i * 37) % 70), h = 180 + ((i * 53) % 220), c = cols[i % cols.length];
    let win = '';
    for (let yy = 20; yy < h - 30; yy += 38) for (let xx = 16; xx < w - 24; xx += 30) win += `<rect x="${x + xx}" y="${1500 - h + yy}" width="16" height="20" rx="3" fill="#fff" opacity=".55"/>`;
    out += `<rect x="${x}" y="${1500 - h}" width="${w}" height="${h + 300}" rx="8" fill="${c}" stroke="${shade(c, 0.7)}" stroke-width="4"/>${win}`;
    x += w + 6; i++;
  }
  return `<svg class="abs" style="left:0;top:0" width="1080" height="1920">${out}</svg>`;
}

function DECOR(idx) {
  const cloud = (x, y, w, o = 0.9) => `<div class="abs" style="left:${x}px;top:${y}px;width:${w}px;height:${w * 0.25}px;background:#fff;border-radius:999px;opacity:${o}"><div style="position:absolute;left:18%;bottom:30%;width:50%;height:150%;background:#fff;border-radius:50%"></div></div>`;
  const spots = [[60, 560, 2, -14], [990, 520, 3, 12], [40, 1060, 2, 18], [1000, 1000, 2, -10], [120, 400, 1, 22], [930, 380, 1, -8]];
  const buses = spots.map(([x, y, len, r], i) => `<div class="fl" style="left:${x - 35}px;top:${y}px;transform:rotate(${r + 90 * (i % 2)}deg)">${topBus(BUS[(i + idx) % BUS.length], len)}</div>`).join('');
  const folks = [[30, 1300, 70], [990, 1280, 64], [150, 300, 50]].map(([x, y, s], i) =>
    `<div class="fl" style="left:${x - s / 2}px;top:${y}px;transform:rotate(${i ? 10 : -8}deg)">${person(BUS[(i * 3 + idx + 1) % BUS.length], SKIN[(i + idx) % SKIN.length], s)}</div>`).join('');
  const back = `${cloud(-60, 330, 300)}${cloud(820, 250, 340)}${cloud(720, 860, 240, 0.7)}${skyline(idx * 3 + 1)}${buses}${folks}`;
  let dashes = '';
  for (let x = 20; x < 1080; x += 120) dashes += `<rect x="${x}" y="1858" width="70" height="12" rx="6" fill="#ffd23f"/>`;
  const front = `<svg class="abs" style="left:0;top:0" width="1080" height="1920">
      <rect x="0" y="1770" width="1080" height="24" fill="#c9c2b8"/><rect x="0" y="1790" width="1080" height="130" fill="#3b3f4c"/>${dashes}</svg>
    <div class="fl" style="left:-10px;top:1640px">${busMascot(BUS[(idx + 2) % BUS.length], 260)}</div>
    <div class="fl" style="right:90px;top:1690px;transform:rotate(-6deg)">${person(BUS[(idx + 5) % BUS.length], SKIN[idx % SKIN.length], 120)}</div>
    <div class="fl" style="right:10px;top:1720px;transform:rotate(8deg)">${person(BUS[(idx + 3) % BUS.length], SKIN[(idx + 2) % SKIN.length], 100)}</div>`;
  return { back, front };
}

// ---------------------------------------------------------------------------
// Montagem (igual para todos os jogos): cenário, título e celular com a captura
// ---------------------------------------------------------------------------
function page(lang, [shot, sceneIdx, texts]) {
  const [small, big] = texts[lang];
  const img = b64(SHOT(lang, shot));
  const sc = SCENES[sceneIdx];
  const { back, front } = DECOR(sceneIdx, sc);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${FONTS_CSS}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1920px;overflow:hidden;position:relative;font-family:Body;background:linear-gradient(180deg,${sc.sky[0]} 0%,${sc.sky[1]} 62%)}
  .rays{position:absolute;left:50%;top:330px;width:2600px;height:2600px;margin:-1300px 0 0 -1300px;
    background:repeating-conic-gradient(${sc.rays ?? 'rgba(255,255,255,.16)'} 0 7deg,rgba(255,255,255,0) 7deg 18deg);
    -webkit-mask:radial-gradient(circle,#000 0,#000 25%,transparent 55%);mask:radial-gradient(circle,#000 0,#000 25%,transparent 55%)}
  .abs{position:absolute}
  .fl{position:absolute;filter:drop-shadow(0 10px 12px rgba(0,0,0,.3))}
  .title{position:absolute;top:70px;left:40px;right:40px;text-align:center;z-index:5}
  .t1,.t2{display:block;white-space:nowrap;line-height:1.08;letter-spacing:1px}
  .t1{font-family:Body;font-weight:700;font-size:96px;color:#fff;-webkit-text-stroke:14px ${TITLE.ink};paint-order:stroke fill;text-shadow:0 8px 0 ${TITLE.ink}}
  .t2{font-family:Title;font-weight:${TITLE.weight};font-size:${TITLE.size}px;margin-top:6px;position:relative}
  .t2 .s{position:absolute;inset:0;color:${TITLE.ink};-webkit-text-stroke:22px ${TITLE.ink};transform:translateY(10px)}
  .t2 .o{position:absolute;inset:0;color:${TITLE.outline};-webkit-text-stroke:22px ${TITLE.outline}}
  .t2 .f{position:relative;background:linear-gradient(180deg,${sc.title[0]} 15%,${sc.title[1]} 85%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .phone{position:absolute;left:50%;top:445px;width:732px;height:1340px;margin-left:-366px;border-radius:92px;z-index:4;
    background:linear-gradient(145deg,#4a4f60,#15171f 40%,#2b2f3b);padding:22px;
    box-shadow:0 40px 80px rgba(5,10,30,.5),inset 0 0 0 3px rgba(255,255,255,.18)}
  .screen{width:100%;height:100%;border-radius:72px;overflow:hidden;background:#111;position:relative}
  .screen img{display:block;width:100%;height:100%;object-fit:cover}
  .btn{position:absolute;right:-8px;width:8px;border-radius:0 6px 6px 0;background:#2a2e3a}
  .front{position:absolute;inset:0;z-index:6;pointer-events:none}
  </style></head><body>
  <div class="rays"></div>
  ${back}
  <div class="title"><span class="t1" id="t1">${small}</span><span class="t2" id="t2"><span class="s">${big}</span><span class="o">${big}</span><span class="f">${big}</span></span></div>
  <div class="phone"><div class="btn" style="top:260px;height:120px"></div><div class="btn" style="top:420px;height:200px"></div>
    <div class="screen"><img src="data:image/png;base64,${img}"></div></div>
  <div class="front">${front}</div>
  <script>
    // Reduz a fonte se o texto não couber na largura
    for (const id of ['t1','t2']) { const el = document.getElementById(id); let fs = parseFloat(getComputedStyle(el).fontSize);
      const inner = id === 't2' ? el.querySelector('.f') : el;
      while (inner.getBoundingClientRect().width > 960 && fs > 40) { fs -= 2; el.style.fontSize = fs + 'px'; } }
  </script>
  </body></html>`;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const lang of LANGS) {
  mkdirSync(`${root}${OUT}/${lang}`, { recursive: true });
  for (const s of SLIDES) {
    await pg.setContent(page(lang, s));
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `${root}${OUT}/${lang}/${s[0]}.png` });
    console.log(lang, s[0]);
  }
}
await browser.close();
