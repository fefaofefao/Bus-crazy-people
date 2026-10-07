// Conquistas: lista rolável com ícone, nome, descrição e barra de progresso.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, FONT, DISPLAY } from '../ui/layout.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { Achievements, LIST } from '../services/Achievements.js';
import { Music } from '../services/Music.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements');
  }

  onBack() {
    goTo(this, 'Menu');
    return true;
  }

  create() {
    Music.play('menu');
    this.cameras.main.setBackgroundColor(C.ink);
    fadeIn(this);
    const L = getLayout(this);
    const u = L.u;
    const topY = L.top + 8 * u + 25 * u;
    const items = Achievements.list();

    // lista (atrás do topo)
    const listTop = topY + 46 * u;
    const cardW = Math.min(L.usableW - 28 * u, 360 * u);
    const cardH = 74 * u;
    const gap = 10 * u;
    const list = this.add.container(0, 0);
    items.forEach((a, i) => {
      const y = listTop + i * (cardH + gap) + cardH / 2;
      const x = L.cx;
      const g = this.add.graphics();
      const on = a.unlocked;
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(x - cardW / 2, y - cardH / 2 + 5 * u, cardW, cardH, 18 * u);
      g.fillStyle(on ? C.panel : 0x2a335a, 1);
      g.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 18 * u);
      g.lineStyle(3 * u, on ? C.accent : 0x3a4670, 1);
      g.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 18 * u);
      // medalha
      const mx = x - cardW / 2 + 40 * u;
      g.fillStyle(on ? C.accent : 0x3a4670, 1);
      g.fillCircle(mx, y, 25 * u);
      g.lineStyle(3 * u, C.ink, 1);
      g.strokeCircle(mx, y, 25 * u);
      const icon = Icons[a.icon] ? a.icon : 'trophy';
      Icons[icon](g, mx, y, 26 * u, on ? C.ink : 0x6b78a6);
      const tx = mx + 36 * u;
      const title = this.add.text(tx, y - 16 * u, t(`achievements.${a.id}.title`), { fontFamily: DISPLAY, fontSize: `${17 * u}px`, color: on ? C.inkCss : '#ffffff' }).setOrigin(0, 0.5);
      const desc = this.add
        .text(tx, y + 6 * u, t(`achievements.${a.id}.desc`), {
          fontFamily: FONT,
          fontSize: `${12 * u}px`,
          fontStyle: '500',
          color: on ? '#4a5578' : C.textDim,
          wordWrap: { width: cardW - 90 * u },
        })
        .setOrigin(0, 0.5);
      // progresso
      const pw = cardW - 90 * u;
      const py = y + 24 * u;
      list.add([g, title, desc]);
      if (!on) {
        g.fillStyle(0x1b2340, 1);
        g.fillRoundedRect(tx, py - 3 * u, pw * 0.7, 6 * u, 3 * u);
        g.fillStyle(C.buttonAd, 1);
        g.fillRoundedRect(tx, py - 3 * u, Math.max(6 * u, pw * 0.7 * (a.current / a.target)), 6 * u, 3 * u);
        list.add(this.add.text(tx + pw * 0.72 + 4 * u, py, t('achievements.progress', { a: a.current, b: a.target }), { fontFamily: DISPLAY, fontSize: `${11 * u}px`, color: C.textDim }).setOrigin(0, 0.5));
      } else {
        Icons.check(g, x + cardW / 2 - 22 * u, y - 18 * u, 16 * u, C.buttonSuccess, 0.22);
      }
    });
    const contentH = items.length * (cardH + gap) + 20 * u;
    const viewH = L.bottom - listTop;
    const minY = Math.min(0, viewH - contentH);
    // rolagem por arrasto
    let dragging = null;
    this.input.on('pointerdown', (p) => (dragging = { y: p.y, start: list.y }));
    this.input.on('pointermove', (p) => {
      if (!dragging || !p.isDown) return;
      list.y = Phaser.Math.Clamp(dragging.start + (p.y - dragging.y), minY, 0);
    });
    this.input.on('pointerup', () => (dragging = null));
    this.input.on('wheel', (_p, _o, _dx, dy) => (list.y = Phaser.Math.Clamp(list.y - dy, minY, 0)));

    // topo fixo por cima da lista
    const top = this.add.graphics().setDepth(5);
    top.fillStyle(C.ink, 1);
    top.fillRect(0, 0, L.W, listTop - 6 * u);
    new Button(this, L.left + 16 * u + 25 * u, topY, '', { width: 50 * u, height: 50 * u, color: C.buttonSecondary, radius: 15 * u, icon: 'home', iconSize: 24 * u }, () =>
      goTo(this, 'Menu'),
    ).setDepth(6);
    this.add.text(L.cx, topY, t('achievements.title'), { fontFamily: DISPLAY, fontSize: `${28 * u}px`, color: '#ffffff' }).setOrigin(0.5).setDepth(6);
    this.add
      .text(L.right - 18 * u, topY, `${Achievements.count()}/${LIST.length}`, { fontFamily: DISPLAY, fontSize: `${18 * u}px`, color: '#ffc72c' })
      .setOrigin(1, 0.5)
      .setDepth(6);

    const onResize = () => this.time.delayedCall(30, () => this.scene.restart());
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }
}
