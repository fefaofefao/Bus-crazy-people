// Pele dos botões (canvas 2D): "bala de goma" com degradê suave.
// Usada pelo Button (Phaser) via textura e espelhada no CSS dos botões das janelas.
//
// Camadas (de baixo para cima):
//   1. sombra suave no chão (azul-marinho translúcido, desfocada)
//   2. contorno azul-marinho (identidade "adesivo")
//   3. "lábio" 3D: a própria cor escurecida (em vez de um bloco azul-marinho chapado)
//   4. corpo: degradê vertical contínuo (topo mais claro -> cor -> base um pouco mais escura)
//   5. brilho: faixa branca no topo que some aos poucos (sem borda dura)
//   6. luz de aro: fio branco sutil na borda de cima

export function shadeHex(hex, f) {
  // f > 0 clareia (mistura com branco); f < 0 escurece (mistura com preto)
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const t = f > 0 ? 255 : 0;
  const k = Math.abs(f);
  const m = (c) => Math.round(c + (t - c) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, h / 2, w / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Desenha o botão em (0,0) ocupando w x (h + lip). Devolve a altura total usada.
 * color: 0xRRGGBB. pressed: lábio menor (o corpo "afunda").
 */
export function drawButtonSkin(ctx, w, h, color, { radius = 18, pressed = false, ink = '#1b2340', scale = 1 } = {}) {
  const ow = Math.max(2, Math.round(Math.min(w, h) * 0.055));
  const lip = Math.round(h * (pressed ? 0.04 : 0.11));
  const top = pressed ? Math.round(h * 0.07) : 0;
  const r = Math.min(radius, h / 2);

  // 1. sombra suave no chão
  ctx.save();
  ctx.shadowColor = 'rgba(27,35,64,0.35)';
  ctx.shadowBlur = 10 * scale;
  ctx.shadowOffsetY = 4 * scale;
  ctx.fillStyle = ink;
  rr(ctx, 0, top, w, h + lip, r);
  ctx.fill();
  ctx.restore();

  // 2. contorno (bloco azul-marinho do tamanho total)
  ctx.fillStyle = ink;
  rr(ctx, 0, top, w, h + lip, r);
  ctx.fill();

  // 3. lábio 3D na cor escurecida, com leve degradê
  const lg = ctx.createLinearGradient(0, top + h * 0.5, 0, top + h + lip);
  lg.addColorStop(0, shadeHex(color, -0.28));
  lg.addColorStop(1, shadeHex(color, -0.42));
  ctx.fillStyle = lg;
  rr(ctx, ow, top + ow, w - ow * 2, h + lip - ow * 2, r - ow);
  ctx.fill();

  // 4. corpo: degradê vertical contínuo
  const bx = ow, by = top + ow, bw = w - ow * 2, bh = h - ow * 2;
  const bg = ctx.createLinearGradient(0, by, 0, by + bh);
  bg.addColorStop(0, shadeHex(color, 0.22));
  bg.addColorStop(0.45, shadeHex(color, 0.04));
  bg.addColorStop(1, shadeHex(color, -0.1));
  ctx.fillStyle = bg;
  rr(ctx, bx, by, bw, bh, r - ow);
  ctx.fill();

  // 5. brilho que some suavemente (metade de cima)
  ctx.save();
  rr(ctx, bx, by, bw, bh, r - ow);
  ctx.clip();
  const gh = bh * 0.55;
  const gl = ctx.createLinearGradient(0, by, 0, by + gh);
  gl.addColorStop(0, 'rgba(255,255,255,0.42)');
  gl.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  rr(ctx, bx + bw * 0.035, by + bh * 0.06, bw * 0.93, gh, (r - ow) * 0.8);
  ctx.fill();
  // 6. luz de aro: só na borda de cima, sumindo para baixo
  const lw = Math.max(1, ow * 0.5);
  const rg = ctx.createLinearGradient(0, by, 0, by + bh * 0.45);
  rg.addColorStop(0, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = rg;
  ctx.lineWidth = lw;
  rr(ctx, bx + lw / 2, by + lw / 2, bw - lw, bh - lw, r - ow);
  ctx.stroke();
  ctx.restore();
  return h + lip;
}
