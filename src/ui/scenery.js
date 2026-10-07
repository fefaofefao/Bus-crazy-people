// Cenários da marca (pôr do sol carioca): usados no splash, menu, idioma e conquistas.

import { CONFIG } from '../config.js';

const C = CONFIG.colors;

/**
 * Céu de pôr do sol com raios girando, Pão de Açúcar e mar.
 * horizon = y (px) da linha do mar. Devolve { rays } para animar.
 */
export function drawSunset(scene, L, horizon, { rays = true } = {}) {
  const g = scene.add.graphics().setDepth(-10);
  g.fillGradientStyle(C.sunsetTop, C.sunsetTop, C.sunsetMid, C.sunsetMid, 1);
  g.fillRect(0, 0, L.W, horizon * 0.62);
  g.fillGradientStyle(C.sunsetMid, C.sunsetMid, C.sunsetLow, C.sunsetLow, 1);
  g.fillRect(0, horizon * 0.62 - 1, L.W, horizon * 0.38 + 2);
  let rayG = null;
  if (rays) {
    // raios pré-desenhados numa textura (girar uma imagem é barato; redesenhar formas grandes não)
    const R = Math.ceil(Math.hypot(L.W, L.H));
    const size = Math.min(1024, R); // textura pequena e ampliada (raios são suaves): pouca memória
    const key = `rays_${size}`;
    if (!scene.textures.exists(key)) {
      const tg = scene.make.graphics({ x: 0, y: 0 }, false);
      tg.fillStyle(0xffffff, 0.08);
      const c = size / 2;
      for (let i = 0; i < 18; i++) {
        const a0 = (i / 18) * Math.PI * 2;
        const a1 = a0 + Math.PI / 18;
        tg.fillTriangle(c, c, c + Math.cos(a0) * c, c + Math.sin(a0) * c, c + Math.cos(a1) * c, c + Math.sin(a1) * c);
      }
      tg.generateTexture(key, size, size);
      tg.destroy();
    }
    rayG = scene.add.image(L.cx, horizon * 0.72, key).setDepth(-9).setDisplaySize(R * 2, R * 2);
    scene.tweens.add({ targets: rayG, angle: 360, duration: 90000, repeat: -1 });
  }
  // sol
  const s = scene.add.graphics().setDepth(-8);
  s.fillStyle(0xfff1b8, 0.9);
  s.fillCircle(L.cx + L.W * 0.18, horizon * 0.78, L.W * 0.13);
  // Pão de Açúcar e morros
  const m = scene.add.graphics().setDepth(-7);
  m.fillStyle(C.hill, 0.85);
  const hill = (x, w, h) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push({ x: x - w / 2 + w * t, y: horizon - Math.pow(Math.sin(Math.PI * t), 0.6) * h });
    }
    pts.push({ x: x + w / 2, y: horizon + 2 }, { x: x - w / 2, y: horizon + 2 });
    m.fillPoints(pts, true);
  };
  hill(L.W * 0.08, L.W * 0.5, L.W * 0.18);
  hill(L.W * 0.8, L.W * 0.32, L.W * 0.36); // Pão de Açúcar
  hill(L.W * 0.62, L.W * 0.22, L.W * 0.17); // Morro da Urca
  // bondinho
  m.lineStyle(Math.max(1, L.W * 0.003), C.ink, 0.6);
  m.lineBetween(L.W * 0.62, horizon - L.W * 0.17, L.W * 0.8, horizon - L.W * 0.36);
  m.fillStyle(C.accent, 1);
  m.fillRect(L.W * 0.7, horizon - L.W * 0.27, L.W * 0.018, L.W * 0.014);
  // mar
  m.fillStyle(C.sea, 1);
  m.fillRect(0, horizon, L.W, L.H);
  m.fillStyle(0xffffff, 0.25);
  for (let i = 0; i < 6; i++) m.fillRect(((i * 97) % 100) * L.W * 0.01, horizon + 6 + (i % 3) * 7, L.W * 0.12, 2);
  return { rays: rayG };
}

/** Calçadão de Copacabana (ondas) num retângulo. */
export function drawCalcadao(g, x, y, w, h, u, alpha = 0.16) {
  g.fillStyle(C.sidewalk, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(5 * u, C.sidewalkWave, alpha);
  for (let row = 0; row * 18 * u < h + 18 * u; row++) {
    const pts = [];
    for (let px = x - 10 * u; px <= x + w + 10 * u; px += 6 * u) pts.push({ x: px, y: y + 8 * u + row * 18 * u + Math.sin(px / (16 * u) + row) * 5 * u });
    g.strokePoints(pts);
  }
}
