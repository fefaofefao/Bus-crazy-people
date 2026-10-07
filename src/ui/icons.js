import Phaser from 'phaser';
// Ícones vetoriais desenhados com Phaser Graphics (sem depender de fontes/emoji).
// Todos recebem (g, x, y, s, color): centro (x, y) e tamanho s (largura ≈ altura).

export const Icons = {
  home(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillTriangle(x - s * 0.5, y - s * 0.02, x + s * 0.5, y - s * 0.02, x, y - s * 0.48);
    g.fillRoundedRect(x - s * 0.34, y - s * 0.08, s * 0.68, s * 0.52, s * 0.06);
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - s * 0.1, y + s * 0.14, s * 0.2, s * 0.3, s * 0.04);
  },

  bulb(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillCircle(x, y - s * 0.12, s * 0.32);
    g.fillRoundedRect(x - s * 0.17, y + s * 0.1, s * 0.34, s * 0.2, s * 0.04);
    g.fillRoundedRect(x - s * 0.13, y + s * 0.34, s * 0.26, s * 0.1, s * 0.05);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(x - s * 0.1, y - s * 0.22, s * 0.08);
  },

  /** Tela com "play" (anúncio). */
  ad(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.5, y - s * 0.36, s, s * 0.72, s * 0.14);
    g.fillStyle(0x000000, 0.45);
    g.fillTriangle(x - s * 0.12, y - s * 0.18, x - s * 0.12, y + s * 0.18, x + s * 0.2, y);
  },

  play(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillTriangle(x - s * 0.3, y - s * 0.4, x - s * 0.3, y + s * 0.4, x + s * 0.42, y);
  },

  gear(g, x, y, s, color) {
    g.fillStyle(color, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = x + Math.cos(a) * s * 0.36;
      const cy = y + Math.sin(a) * s * 0.36;
      g.fillCircle(cx, cy, s * 0.11);
    }
    g.fillCircle(x, y, s * 0.36);
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(x, y, s * 0.14);
  },

  check(g, x, y, s, color, width = 0.16) {
    g.lineStyle(s * width, color, 1);
    g.beginPath();
    g.moveTo(x - s * 0.34, y + s * 0.02);
    g.lineTo(x - s * 0.08, y + s * 0.28);
    g.lineTo(x + s * 0.38, y - s * 0.26);
    g.strokePath();
  },

  restart(g, x, y, s, color) {
    const r = s * 0.34;
    g.lineStyle(s * 0.13, color, 1);
    g.beginPath();
    g.arc(x, y, r, Math.PI * 0.15, Math.PI * 1.75, false);
    g.strokePath();
    const a = Math.PI * 1.75;
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r;
    g.fillStyle(color, 1);
    g.fillTriangle(ex - s * 0.2, ey - s * 0.08, ex + s * 0.14, ey - s * 0.2, ex + s * 0.06, ey + s * 0.16);
  },

  sound(g, x, y, s, color, on = true) {
    g.fillStyle(color, 1);
    g.fillRect(x - s * 0.45, y - s * 0.14, s * 0.2, s * 0.28);
    g.fillTriangle(x - s * 0.3, y - s * 0.14, x - s * 0.3, y + s * 0.14, x + s * 0.02, y - s * 0.4);
    g.fillTriangle(x - s * 0.3, y + s * 0.14, x + s * 0.02, y + s * 0.4, x + s * 0.02, y - s * 0.4);
    g.lineStyle(s * 0.09, color, 1);
    if (on) {
      g.beginPath();
      g.arc(x + s * 0.06, y, s * 0.2, -0.9, 0.9);
      g.strokePath();
      g.beginPath();
      g.arc(x + s * 0.06, y, s * 0.38, -0.9, 0.9);
      g.strokePath();
    } else {
      g.lineBetween(x + s * 0.16, y - s * 0.16, x + s * 0.46, y + s * 0.16);
      g.lineBetween(x + s * 0.46, y - s * 0.16, x + s * 0.16, y + s * 0.16);
    }
  },

  vibrate(g, x, y, s, color, on = true) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.18, y - s * 0.42, s * 0.36, s * 0.84, s * 0.08);
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x - s * 0.12, y - s * 0.33, s * 0.24, s * 0.58, s * 0.03);
    g.lineStyle(s * 0.08, color, on ? 1 : 0.35);
    for (const d of [-1, 1]) {
      g.lineBetween(x + d * s * 0.3, y - s * 0.2, x + d * s * 0.3, y + s * 0.2);
      g.lineBetween(x + d * s * 0.44, y - s * 0.12, x + d * s * 0.44, y + s * 0.12);
    }
  },

  noAds(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.36, y - s * 0.24, s * 0.72, s * 0.48, s * 0.1);
    g.fillStyle(0x000000, 0.4);
    g.fillTriangle(x - s * 0.08, y - s * 0.12, x - s * 0.08, y + s * 0.12, x + s * 0.14, y);
    g.lineStyle(s * 0.1, color, 1);
    g.strokeCircle(x, y, s * 0.48);
    g.lineBetween(x - s * 0.34, y + s * 0.34, x + s * 0.34, y - s * 0.34);
  },

  shield(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(x, y - s * 0.46);
    g.lineTo(x + s * 0.38, y - s * 0.3);
    g.lineTo(x + s * 0.34, y + s * 0.08);
    g.lineTo(x, y + s * 0.46);
    g.lineTo(x - s * 0.34, y + s * 0.08);
    g.lineTo(x - s * 0.38, y - s * 0.3);
    g.closePath();
    g.fillPath();
    Icons.check(g, x, y - s * 0.02, s * 0.5, 0x1f2333, 0.22);
  },

  heart(g, x, y, s, color, alpha = 1) {
    // dois círculos + triângulo com tangentes alinhadas
    g.fillStyle(color, alpha);
    const r = s * 0.26;
    const cy = y - s * 0.14;
    g.fillCircle(x - r, cy, r);
    g.fillCircle(x + r, cy, r);
    const k = r * 0.7071;
    g.fillTriangle(x - r - k, cy + k, x + r + k, cy + k, x, y + s * 0.42);
    g.fillRect(x - r - k, cy, (r + k) * 2, k);
  },

  brokenHeart(g, x, y, s, color) {
    Icons.heart(g, x, y, s, color);
    g.lineStyle(s * 0.07, 0x1f2333, 1);
    g.beginPath();
    g.moveTo(x + s * 0.02, y - s * 0.3);
    g.lineTo(x - s * 0.08, y - s * 0.08);
    g.lineTo(x + s * 0.08, y + s * 0.06);
    g.lineTo(x - s * 0.02, y + s * 0.36);
    g.strokePath();
  },

  globe(g, x, y, s, color) {
    const r = s * 0.44;
    g.lineStyle(s * 0.09, color, 1);
    g.strokeCircle(x, y, r);
    g.strokeEllipse(x, y, r * 0.95, r * 2);
    g.lineBetween(x - r, y, x + r, y);
    g.lineBetween(x - r * 0.85, y - r * 0.5, x + r * 0.85, y - r * 0.5);
    g.lineBetween(x - r * 0.85, y + r * 0.5, x + r * 0.85, y + r * 0.5);
  },

  // ---- bandeiras (retângulo 3:2 centrado em x, y; largura s) ----
  flag_br(g, x, y, s) {
    const w = s, h = s * 0.68, r = s * 0.1;
    g.fillStyle(0x009c3b, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    g.fillStyle(0xffdf00, 1);
    g.fillTriangle(x - w * 0.4, y, x, y - h * 0.38, x + w * 0.4, y);
    g.fillTriangle(x - w * 0.4, y, x, y + h * 0.38, x + w * 0.4, y);
    g.fillStyle(0x002776, 1);
    g.fillCircle(x, y, h * 0.24);
  },

  flag_us(g, x, y, s) {
    const w = s, h = s * 0.68, r = s * 0.1;
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    g.fillStyle(0xb22234, 1);
    const sh = h / 7;
    for (let i = 0; i < 7; i += 2) {
      const yy = y - h / 2 + i * sh;
      const radius = i === 0 ? { tl: r, tr: r, bl: 0, br: 0 } : i === 6 ? { tl: 0, tr: 0, bl: r, br: r } : 0;
      if (radius) g.fillRoundedRect(x - w / 2, yy, w, sh, radius);
      else g.fillRect(x - w / 2, yy, w, sh);
    }
    g.fillStyle(0x3c3b6e, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w * 0.44, sh * 4, { tl: r, tr: 0, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillCircle(x - w / 2 + w * (0.08 + i * 0.14), y - h / 2 + sh * (0.9 + j * 2), s * 0.025);
  },

  flag_es(g, x, y, s) {
    const w = s, h = s * 0.68, r = s * 0.1;
    g.fillStyle(0xc60b1e, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    g.fillStyle(0xffc400, 1);
    g.fillRect(x - w / 2, y - h / 4, w, h / 2);
  },

  star(g, x, y, s, color) {
    g.fillStyle(color, 1);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? s * 0.22 : s * 0.5;
      pts.push(new Phaser.Geom.Point(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
  },

  question(g, x, y, s, color) {
    g.lineStyle(s * 0.09, color, 1);
    g.strokeCircle(x, y, s * 0.44);
    g.fillStyle(color, 1);
    g.fillCircle(x, y + s * 0.24, s * 0.06);
    g.beginPath();
    g.arc(x, y - s * 0.1, s * 0.15, Math.PI * 1.05, Math.PI * 2.35, false);
    g.strokePath();
    g.lineBetween(x + s * 0.02, y + s * 0.03, x, y + s * 0.12);
  },

  grid(g, x, y, s, color) {
    g.fillStyle(color, 1);
    const k = s * 0.4;
    const gap = s * 0.12;
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      g.fillRoundedRect(x - k - gap / 2 + i * (k + gap), y - k - gap / 2 + j * (k + gap), k, k, k * 0.25);
    }
  },

  lock(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.32, y - s * 0.05, s * 0.64, s * 0.48, s * 0.08);
    g.lineStyle(s * 0.1, color, 1);
    g.beginPath();
    g.arc(x, y - s * 0.08, s * 0.2, Math.PI, 0, false);
    g.strokePath();
  },

  trophy(g, x, y, s, color) {
    g.fillStyle(color, 1);
    // taça
    g.fillRoundedRect(x - s * 0.3, y - s * 0.44, s * 0.6, s * 0.12, s * 0.03);
    g.beginPath();
    g.arc(x, y - s * 0.34, s * 0.3, 0, Math.PI, false);
    g.closePath();
    g.fillPath();
    // alças
    g.lineStyle(s * 0.08, color, 1);
    g.beginPath();
    g.arc(x - s * 0.3, y - s * 0.24, s * 0.12, Math.PI * 0.5, Math.PI * 1.5, false);
    g.strokePath();
    g.beginPath();
    g.arc(x + s * 0.3, y - s * 0.24, s * 0.12, Math.PI * 1.5, Math.PI * 0.5, false);
    g.strokePath();
    // haste e base
    g.fillRect(x - s * 0.06, y - s * 0.06, s * 0.12, s * 0.3);
    g.fillRoundedRect(x - s * 0.26, y + s * 0.24, s * 0.52, s * 0.18, s * 0.05);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(x - s * 0.12, y - s * 0.26, s * 0.06);
  },

  /** Seta curva para trás (desfazer). */
  undo(g, x, y, s, color) {
    const r = s * 0.3;
    g.lineStyle(s * 0.13, color, 1);
    g.beginPath();
    g.arc(x + s * 0.04, y + s * 0.06, r, Math.PI * 1.05, Math.PI * 0.35, false);
    g.strokePath();
    g.fillStyle(color, 1);
    const ex = x + s * 0.04 + Math.cos(Math.PI * 1.05) * r;
    const ey = y + s * 0.06 + Math.sin(Math.PI * 1.05) * r;
    g.fillTriangle(ex - s * 0.2, ey - s * 0.02, ex + s * 0.16, ey - s * 0.06, ex - s * 0.02, ey - s * 0.32);
  },

  /** Vaga extra: ônibus pequeno com "+". */
  slotPlus(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.42, y - s * 0.22, s * 0.62, s * 0.44, s * 0.1);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(x - s * 0.36, y - s * 0.14, s * 0.14, s * 0.12);
    g.fillRect(x - s * 0.18, y - s * 0.14, s * 0.14, s * 0.12);
    g.fillRect(x - s * 0.0, y - s * 0.14, s * 0.14, s * 0.12);
    g.fillStyle(color, 1);
    g.fillCircle(x - s * 0.26, y + s * 0.24, s * 0.08);
    g.fillCircle(x + s * 0.06, y + s * 0.24, s * 0.08);
    g.fillRect(x + s * 0.3, y - s * 0.26, s * 0.1, s * 0.34);
    g.fillRect(x + s * 0.18, y - s * 0.14, s * 0.34, s * 0.1);
  },

  /** Seta dupla (pular). */
  skip(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillTriangle(x - s * 0.42, y - s * 0.3, x - s * 0.42, y + s * 0.3, x, y);
    g.fillTriangle(x - s * 0.04, y - s * 0.3, x - s * 0.04, y + s * 0.3, x + s * 0.38, y);
    g.fillRect(x + s * 0.36, y - s * 0.3, s * 0.08, s * 0.6);
  },

  music(g, x, y, s, color, on = true) {
    g.fillStyle(color, 1);
    g.fillEllipse(x - s * 0.22, y + s * 0.26, s * 0.26, s * 0.2);
    g.fillEllipse(x + s * 0.22, y + s * 0.16, s * 0.26, s * 0.2);
    g.fillRect(x - s * 0.12, y - s * 0.34, s * 0.08, s * 0.6);
    g.fillRect(x + s * 0.32, y - s * 0.44, s * 0.08, s * 0.6);
    g.fillPoints([{ x: x - s * 0.12, y: y - s * 0.34 }, { x: x + s * 0.4, y: y - s * 0.44 }, { x: x + s * 0.4, y: y - s * 0.3 }, { x: x - s * 0.12, y: y - s * 0.2 }], true);
    if (!on) {
      g.lineStyle(s * 0.1, color, 1);
      g.lineBetween(x - s * 0.44, y - s * 0.44, x + s * 0.44, y + s * 0.44);
    }
  },

  /** Olho com símbolos (modo daltônico). */
  eye(g, x, y, s, color, on = true) {
    g.fillStyle(color, 1);
    g.fillEllipse(x, y, s * 0.92, s * 0.52);
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(x, y, s * 0.18);
    g.fillStyle(color, 1);
    g.fillCircle(x, y, s * 0.08);
    if (!on) {
      g.lineStyle(s * 0.1, color, 1);
      g.lineBetween(x - s * 0.4, y - s * 0.4, x + s * 0.4, y + s * 0.4);
    }
  },

  trash(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.36, y - s * 0.34, s * 0.72, s * 0.1, s * 0.03);
    g.fillRect(x - s * 0.1, y - s * 0.44, s * 0.2, s * 0.1);
    g.fillRoundedRect(x - s * 0.28, y - s * 0.2, s * 0.56, s * 0.64, s * 0.06);
    g.fillStyle(0x000000, 0.35);
    for (const dx of [-0.12, 0, 0.12]) g.fillRect(x + dx * s - s * 0.025, y - s * 0.1, s * 0.05, s * 0.44);
  },

  clock(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillCircle(x, y, s * 0.46);
    g.lineStyle(s * 0.1, 0x1f2333, 1);
    g.lineBetween(x, y, x, y - s * 0.28);
    g.lineBetween(x, y, x + s * 0.2, y + s * 0.08);
  },

  bus(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.44, y - s * 0.3, s * 0.88, s * 0.5, s * 0.1);
    g.fillStyle(0x000000, 0.35);
    for (let i = 0; i < 4; i++) g.fillRect(x - s * 0.38 + i * s * 0.2, y - s * 0.22, s * 0.15, s * 0.16);
    g.fillStyle(color, 1);
    g.fillCircle(x - s * 0.24, y + s * 0.26, s * 0.1);
    g.fillCircle(x + s * 0.24, y + s * 0.26, s * 0.1);
  },

  /** Chave (destranca o ônibus com cadeado). */
  key(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillCircle(x - s * 0.22, y, s * 0.22);
    g.fillRect(x - s * 0.05, y - s * 0.06, s * 0.5, s * 0.12);
    g.fillRect(x + s * 0.3, y, s * 0.08, s * 0.18);
    g.fillRect(x + s * 0.14, y, s * 0.08, s * 0.13);
    g.fillStyle(0x1f2333, 1);
    g.fillCircle(x - s * 0.22, y, s * 0.08);
  },

  cone(g, x, y, s) {
    g.fillStyle(0xff7a1a, 1);
    g.fillTriangle(x, y - s * 0.46, x - s * 0.3, y + s * 0.34, x + s * 0.3, y + s * 0.34);
    g.fillStyle(0xffffff, 1);
    g.fillRect(x - s * 0.14, y - s * 0.04, s * 0.28, s * 0.1);
    g.fillStyle(0xff7a1a, 1);
    g.fillRoundedRect(x - s * 0.42, y + s * 0.3, s * 0.84, s * 0.12, s * 0.04);
  },

  flag(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRect(x - s * 0.3, y - s * 0.42, s * 0.08, s * 0.86);
    g.fillTriangle(x - s * 0.22, y - s * 0.42, x + s * 0.38, y - s * 0.22, x - s * 0.22, y);
  },

  crown(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillPoints(
      [
        { x: x - s * 0.42, y: y + s * 0.26 },
        { x: x - s * 0.44, y: y - s * 0.24 },
        { x: x - s * 0.2, y: y },
        { x, y: y - s * 0.36 },
        { x: x + s * 0.2, y },
        { x: x + s * 0.44, y: y - s * 0.24 },
        { x: x + s * 0.42, y: y + s * 0.26 },
      ],
      true,
    );
    g.fillRect(x - s * 0.42, y + s * 0.3, s * 0.84, s * 0.1);
  },

  flame(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillCircle(x, y + s * 0.14, s * 0.28);
    g.fillTriangle(x - s * 0.27, y + s * 0.08, x + s * 0.27, y + s * 0.08, x + s * 0.06, y - s * 0.46);
    g.fillTriangle(x - s * 0.26, y + s * 0.1, x - s * 0.04, y - s * 0.12, x - s * 0.22, y - s * 0.3);
  },

  bolt(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillPoints(
      [
        { x: x + s * 0.12, y: y - s * 0.46 },
        { x: x - s * 0.28, y: y + s * 0.06 },
        { x: x - s * 0.02, y: y + s * 0.06 },
        { x: x - s * 0.12, y: y + s * 0.46 },
        { x: x + s * 0.28, y: y - s * 0.08 },
        { x: x + s * 0.02, y: y - s * 0.08 },
      ],
      true,
    );
  },

  map(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillCircle(x, y - s * 0.12, s * 0.26);
    g.fillTriangle(x - s * 0.23, y - s * 0.02, x + s * 0.23, y - s * 0.02, x, y + s * 0.44);
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(x, y - s * 0.12, s * 0.1);
  },

  pause(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - s * 0.3, y - s * 0.36, s * 0.2, s * 0.72, s * 0.05);
    g.fillRoundedRect(x + s * 0.1, y - s * 0.36, s * 0.2, s * 0.72, s * 0.05);
  },
};
