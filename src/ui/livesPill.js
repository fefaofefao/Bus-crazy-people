// Indicador de vidas: ♥ 3 · "+1 em 12:34" / "Cheias" (estilo adesivo).

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DISPLAY } from './layout.js';
import { Icons } from './icons.js';
import { Lives } from '../services/Lives.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;

export function livesPill(scene, x, y, u, { onClick } = {}) {
  const c = scene.add.container(x, y).setDepth(40);
  const bg = scene.add.graphics();
  const icon = scene.add.graphics();
  const count = scene.add.text(0, 0, '', { fontFamily: DISPLAY, fontSize: `${20 * u}px`, color: '#ffffff' }).setOrigin(0, 0.5);
  const sub = scene.add.text(0, 0, '', { fontFamily: DISPLAY, fontSize: `${13 * u}px`, color: '#ffd2dc' }).setOrigin(0, 0.5);
  c.add([bg, icon, count, sub]);
  let last = -1;
  let w = 0;
  const h = 40 * u;

  function draw() {
    const st = Lives.get();
    const full = st.lives >= st.max;
    count.setText(String(st.lives));
    sub.setText(full ? t('lives.full') : t('lives.next', { t: Lives.format(st.nextInMs) }));
    const iconW = 24 * u;
    w = 12 * u + iconW + 6 * u + count.width + 8 * u + sub.width + 14 * u;
    let cx = -w / 2 + 12 * u;
    icon.clear();
    Icons.heart(icon, 0, 1.5 * u, 24 * u, C.ink);
    Icons.heart(icon, 0, 0, 22 * u, st.lives > 0 ? C.heart : C.heartEmpty);
    bg.clear();
    bg.fillStyle(C.ink, 1);
    bg.fillRoundedRect(-w / 2, -h / 2 + 4 * u, w, h, h / 2);
    bg.fillStyle(0x2a3360, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(3 * u, C.ink, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    icon.setPosition(cx + iconW / 2, 0);
    cx += iconW + 6 * u;
    count.setPosition(cx, -1 * u);
    cx += count.width + 8 * u;
    sub.setPosition(cx, 0);
    c.setSize(w, h);
  }
  draw();
  if (onClick) {
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerup', onClick);
  }
  // atualiza o relógio a cada segundo
  const ev = scene.time.addEvent({ delay: 1000, loop: true, callback: draw });
  c.once('destroy', () => ev.remove());
  return { container: c, refresh: draw, tick() {} };
}
