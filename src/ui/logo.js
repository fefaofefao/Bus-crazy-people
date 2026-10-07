// Logo desenhado por código: ônibus amarelo com o nome do jogo.

import { FONT } from './layout.js';
import { busTexture } from './art.js';

/** Devolve um Container com o logo centrado em (x, y). */
export function drawLogo(scene, x, y, u) {
  const c = scene.add.container(x, y);
  const w = Math.round(64 * u);
  const len = Math.round(150 * u);
  const key = busTexture(scene, { type: 'large', color: 2, w, len, symbol: false });
  const bus = scene.add.image(0, -18 * u, key).setRotation(Math.PI / 2);
  const t1 = scene.add
    .text(0, -78 * u, 'BUS CRAZY', { fontFamily: FONT, fontSize: `${44 * u}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#1f2a44', strokeThickness: 9 * u })
    .setOrigin(0.5);
  const t2 = scene.add
    .text(0, 44 * u, 'PEOPLE', { fontFamily: FONT, fontSize: `${40 * u}px`, fontStyle: 'bold', color: '#ffc93c', stroke: '#1f2a44', strokeThickness: 9 * u })
    .setOrigin(0.5);
  t1.setAngle(-4);
  t2.setAngle(-4);
  c.add([bus, t1, t2]);
  return c;
}
