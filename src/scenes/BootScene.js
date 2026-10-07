// Splash: prepara texturas, mostra o logo por um instante e abre a tela inicial
// (ou a escolha de idioma no primeiro acesso).

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, FONT } from '../ui/layout.js';
import { drawLogo } from '../ui/logo.js';
import { hasChosenLanguage, t } from '../i18n/index.js';
import { Music } from '../services/Music.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Partícula: círculo branco (tingido na hora de usar)
    if (!this.textures.exists('dot')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture('dot', 32, 32);
      g.destroy();
    }
    this.cameras.main.setBackgroundColor(CONFIG.colors.sky);
    const L = getLayout(this);
    const u = L.u;
    const logo = drawLogo(this, L.cx, L.top + L.usableH * 0.42, u);
    logo.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 450, ease: 'Back.easeOut' });
    this.add
      .text(L.cx, L.top + L.usableH * 0.62, t('splash.tagline'), { fontFamily: FONT, fontSize: `${17 * u}px`, fontStyle: 'bold', color: '#25324a' })
      .setOrigin(0.5);
    this.add
      .text(L.cx, L.bottom - 24 * u, 'FSamp Labs', { fontFamily: FONT, fontSize: `${13 * u}px`, fontStyle: '500', color: '#25324a' })
      .setOrigin(0.5)
      .setAlpha(0.7);
    Music.init();
    this.time.delayedCall(1300, () => {
      this.cameras.main.fadeOut(220, 0x2d, 0x3a, 0x4f);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(hasChosenLanguage() ? 'Menu' : 'Language'));
    });
  }
}
