// Splash: carrega a arte da marca, mostra o logo no pôr do sol e abre a tela
// inicial (ou a escolha de idioma no primeiro acesso).

import Phaser from 'phaser';
import { getLayout, DISPLAY } from '../ui/layout.js';
import { drawLogo } from '../ui/logo.js';
import { drawSunset } from '../ui/scenery.js';
import { hasChosenLanguage, t } from '../i18n/index.js';
import { Music } from '../services/Music.js';
import { CONFIG } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // SVGs da marca rasterizados no tamanho certo para telas densas
    const L = getLayout(this);
    const px = (n) => Math.round(n * L.u * 1.3);
    if (!this.textures.exists('bus-front')) this.load.svg('bus-front', 'brand/bus-front.svg', { width: px(300), height: px(340) });
    if (!this.textures.exists('tiao')) this.load.svg('tiao', 'brand/tiao.svg', { width: px(120), height: px(120) });
  }

  create() {
    if (!this.textures.exists('dot')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture('dot', 32, 32);
      g.destroy();
    }
    const L = getLayout(this);
    const u = L.u;
    this.cameras.main.setBackgroundColor(CONFIG.colors.sunsetMid);
    drawSunset(this, L, L.top + L.usableH * 0.78);
    const logo = drawLogo(this, L.cx, L.top + L.usableH * 0.4, u, 320);
    logo.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
    this.add
      .text(L.cx, L.top + L.usableH * 0.66, t('splash.tagline'), { fontFamily: DISPLAY, fontSize: `${20 * u}px`, color: '#ffffff', stroke: CONFIG.colors.inkCss, strokeThickness: 6 * u })
      .setOrigin(0.5);
    this.add
      .text(L.cx, L.bottom - 24 * u, 'FSamp Labs', { fontFamily: DISPLAY, fontSize: `${14 * u}px`, color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0.85);
    Music.init();
    // assinatura sonora: "fon-fon, ta-ra-rá!" junto com o logo
    this.time.delayedCall(150, () => Music.jingle());
    this.time.delayedCall(1900, () => Music.play('menu'));
    this.time.delayedCall(1400, () => {
      this.cameras.main.fadeOut(220, 0x1b, 0x23, 0x40);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(hasChosenLanguage() ? 'Menu' : 'Language'));
    });
  }
}
