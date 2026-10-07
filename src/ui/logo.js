// Logo: ônibus de frente (com o Seu Tião ao volante) + nome em letreiro.
// O desenho do ônibus vem de public/brand/bus-front.svg (scripts/make-brand.js).

import { DISPLAY } from './layout.js';
import { CONFIG } from '../config.js';

/** Devolve um Container com o logo centrado em (x, y). size = largura aproximada. */
export function drawLogo(scene, x, y, u, size = 300) {
  const c = scene.add.container(x, y);
  const k = size / 300;
  const ink = CONFIG.colors.inkCss;
  const bus = scene.add.image(0, -40 * u * k, 'bus-front').setDisplaySize(150 * u * k, 170 * u * k);
  // faixa rosa atrás de "PEOPLE"
  const ribbon = scene.add.graphics();
  const rw = 220 * u * k;
  const rh = 52 * u * k;
  const ry = 92 * u * k;
  ribbon.fillStyle(CONFIG.colors.ink, 1);
  ribbon.fillRoundedRect(-rw / 2, ry - rh / 2 + 6 * u * k, rw, rh, 14 * u * k);
  ribbon.fillStyle(CONFIG.colors.challenge, 1);
  ribbon.fillRoundedRect(-rw / 2, ry - rh / 2, rw, rh, 14 * u * k);
  ribbon.lineStyle(4 * u * k, CONFIG.colors.ink, 1);
  ribbon.strokeRoundedRect(-rw / 2, ry - rh / 2, rw, rh, 14 * u * k);
  const style = (sz, color) => ({ fontFamily: DISPLAY, fontSize: `${sz * u * k}px`, color, stroke: ink, strokeThickness: 9 * u * k });
  const t1 = scene.add.text(0, 48 * u * k, 'BUS CRAZY', style(52, '#ffffff')).setOrigin(0.5);
  t1.setShadow(0, 6 * u * k, ink, 0, true, true);
  const t2 = scene.add.text(0, ry - 2 * u * k, 'PEOPLE', style(40, '#ffc72c')).setOrigin(0.5);
  const g = scene.add.container(0, 0, [ribbon, t2]).setAngle(-4);
  t1.setAngle(-4);
  c.add([bus, t1, g]);
  c.bus = bus;
  return c;
}
