// Tela inicial: logo, ônibus passando ao fundo, "Jogar – Fase N", Fases e Ajustes.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, FONT } from '../ui/layout.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { drawLogo } from '../ui/logo.js';
import { busTexture } from '../ui/art.js';
import { Progress } from '../services/Progress.js';
import { LEVELS_VERSION } from '../levels/index.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.cameras.main.setBackgroundColor(C.sky);
    fadeIn(this);
    const L = getLayout(this);
    const u = L.u;
    const H = L.usableH;

    // rua ao fundo com ônibus passando (só enfeite: Math.random não afeta fases)
    const roadY = L.top + H * 0.54;
    const g = this.add.graphics();
    g.fillStyle(C.road, 1);
    g.fillRect(0, roadY - 40 * u, L.W, 80 * u);
    g.fillStyle(0xffffff, 0.35);
    for (let x = 0; x < L.W; x += 34 * u) g.fillRect(x, roadY - 1.5 * u, 18 * u, 3 * u);
    g.fillStyle(C.sidewalk, 1);
    g.fillRect(0, roadY + 40 * u, L.W, L.H);
    g.fillStyle(C.curb, 1);
    g.fillRect(0, roadY + 40 * u, L.W, 5 * u);
    this.time.addEvent({ delay: 1600, loop: true, callback: () => this.spawnBus(L, u, roadY) });
    this.spawnBus(L, u, roadY);

    const logo = drawLogo(this, L.cx, L.top + H * 0.24, u);
    this.tweens.add({ targets: logo, y: logo.y - 6 * u, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(L.cx, L.top + H * 0.39, t('menu.subtitle'), {
        fontFamily: FONT,
        fontSize: `${16 * u}px`,
        fontStyle: 'bold',
        color: C.textDark,
        align: 'center',
        wordWrap: { width: L.usableW - 40 * u },
      })
      .setOrigin(0.5);

    const bw = Math.min(L.usableW - 48 * u, 330 * u);
    const next = Progress.nextToPlay();
    const playY = L.top + H * 0.72;
    const play = new Button(
      this,
      L.cx,
      playY,
      next ? t('menu.play', { n: next }) : t('menu.allDone'),
      { width: bw, height: 76 * u, fontSize: 25 * u, radius: 24 * u, icon: next ? 'play' : 'check', iconSize: 22 * u, color: C.buttonSuccess },
      () => (next ? goTo(this, 'Game', { level: next }) : goTo(this, 'Levels')),
    );
    this.tweens.add({ targets: play, scale: 1.03, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const half = (bw - 12 * u) / 2;
    const rowY = playY + 88 * u;
    const small = { height: 58 * u, fontSize: 18 * u, color: C.buttonSecondary, radius: 18 * u, iconSize: 22 * u };
    new Button(this, L.cx - half / 2 - 6 * u, rowY, t('menu.levels'), { ...small, width: half, icon: 'grid' }, () => goTo(this, 'Levels'));
    new Button(this, L.cx + half / 2 + 6 * u, rowY, t('menu.settings'), { ...small, width: half, icon: 'gear' }, () => goTo(this, 'Settings'));

    this.add
      .text(L.cx, L.bottom - 14 * u, `v${__APP_VERSION__} · fases v${LEVELS_VERSION}`, { fontFamily: FONT, fontSize: `${11 * u}px`, color: '#6b6250' })
      .setOrigin(0.5, 1);

    const onResize = () => this.time.delayedCall(30, () => this.scene.restart());
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  spawnBus(L, u, roadY) {
    const right = Math.random() < 0.5;
    const color = Math.floor(Math.random() * 8);
    const type = ['small', 'medium', 'large'][Math.floor(Math.random() * 3)];
    const w = Math.round(30 * u);
    const len = Math.round((type === 'small' ? 56 : type === 'medium' ? 76 : 96) * u);
    const key = busTexture(this, { type, color, w, len, symbol: false });
    const y = roadY + (right ? 18 : -18) * u;
    const img = this.add.image(right ? -len : L.W + len, y, key).setRotation(right ? Math.PI / 2 : -Math.PI / 2);
    img.setDepth(-1);
    this.tweens.add({ targets: img, x: right ? L.W + len : -len, duration: 4200 + Math.random() * 1800, onComplete: () => img.destroy() });
  }
}
