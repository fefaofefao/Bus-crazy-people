// Tela inicial: pôr do sol carioca, logo, ônibus passando na orla,
// "Jogar – Fase N", Fases, Ajustes, Conquistas e total de estrelas.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, DISPLAY } from '../ui/layout.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { drawLogo } from '../ui/logo.js';
import { drawSunset, drawCalcadao } from '../ui/scenery.js';
import { busTexture, drawPassenger } from '../ui/art.js';
import { Sound } from '../services/Sound.js';
import { Haptics } from '../services/Haptics.js';
import { Progress } from '../services/Progress.js';
import { Achievements, LIST } from '../services/Achievements.js';
import { livesPill } from '../ui/livesPill.js';
import { LEVELS_VERSION, LEVEL_COUNT } from '../levels/index.js';
import { Music } from '../services/Music.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    Music.play('menu');
    this.cameras.main.setBackgroundColor(C.ink);
    fadeIn(this);
    const L = getLayout(this);
    const u = L.u;
    const H = L.usableH;

    // cenário: pôr do sol, mar, avenida da orla e calçadão
    const horizon = L.top + H * 0.47;
    drawSunset(this, L, horizon);
    const roadY = horizon + H * 0.075;
    const g = this.add.graphics().setDepth(-5);
    g.fillStyle(C.curb, 1);
    g.fillRect(0, roadY - 34 * u, L.W, 6 * u);
    g.fillStyle(C.road, 1);
    g.fillRect(0, roadY - 28 * u, L.W, 64 * u);
    g.fillStyle(0xffffff, 0.45);
    for (let x = 0; x < L.W; x += 34 * u) g.fillRect(x, roadY + 2 * u, 18 * u, 3 * u);
    g.fillStyle(C.curb, 1);
    g.fillRect(0, roadY + 36 * u, L.W, 6 * u);
    drawCalcadao(g, 0, roadY + 42 * u, L.W, L.H, u);
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.spawnBus(L, u, roadY) });
    this.spawnBus(L, u, roadY);
    this.animateScenery(L, u, horizon, roadY);

    const logo = drawLogo(this, L.cx, L.top + H * 0.22, u, 300);
    this.animateLogo(logo, u);

    // topo: estrelas (esq.) e conquistas (dir.)
    const topY = L.top + 30 * u;
    const pill = (x, w, icon, text, onClick) => {
      const b = new Button(this, x, topY, text, { width: w, height: 44 * u, fontSize: 18 * u, radius: 22 * u, color: C.ink, icon, iconSize: 22 * u, iconColor: C.gold }, onClick);
      return b;
    };
    pill(L.left + 16 * u + 56 * u, 112 * u, 'star', `${Achievements.totalStars()}`, () => goTo(this, 'Levels'));
    pill(L.right - 16 * u - 56 * u, 112 * u, 'trophy', `${Achievements.count()}/${LIST.length}`, () => goTo(this, 'Achievements'));

    // botões
    const bw = Math.min(L.usableW - 48 * u, 330 * u);
    const next = Progress.nextToPlay();
    const playY = L.top + H * 0.75;
    const play = new Button(
      this,
      L.cx,
      playY,
      next ? t('menu.play', { n: next }) : t('menu.allDone'),
      { width: bw, height: 80 * u, fontSize: 28 * u, radius: 26 * u, icon: next ? 'play' : 'check', iconSize: 24 * u, color: C.buttonSuccess },
      () => (next ? goTo(this, 'Game', { level: next }) : goTo(this, 'Levels')),
    );
    this.tweens.add({ targets: play, scale: 1.04, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const third = (bw - 20 * u) / 3;
    const rowY = playY + 92 * u;
    const small = { height: 60 * u, fontSize: 16 * u, radius: 20 * u, iconSize: 22 * u };
    new Button(this, L.cx - third - 10 * u, rowY, t('menu.levels'), { ...small, width: third, icon: 'grid', color: C.button }, () => goTo(this, 'Levels'));
    new Button(this, L.cx, rowY, t('menu.achievements'), { ...small, width: third, icon: 'trophy', color: C.buttonAd, fontSize: 14 * u }, () => goTo(this, 'Achievements'));
    new Button(this, L.cx + third + 10 * u, rowY, t('menu.settings'), { ...small, width: third, icon: 'gear', color: C.buttonSecondary }, () => goTo(this, 'Settings'));

    // vidas (toque: mostra quando a próxima volta)
    livesPill(this, L.cx, playY - 40 * u - 34 * u, u); // acima do Jogar, sem encostar (o Jogar pulsa)

    this.add
      .text(L.cx, L.bottom - 10 * u, `v${__APP_VERSION__} · fases v${LEVELS_VERSION} · FSamp Labs`, { fontFamily: DISPLAY, fontSize: `${11 * u}px`, color: C.inkCss })
      .setOrigin(0.5, 1)
      .setAlpha(0.55);
    void Icons;

    const onResize = () => this.time.delayedCall(30, () => this.scene.restart());
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  /** Logo vivo: ônibus entra quicando, fica com o motor ligado e solta fumaça; tocar nele buzina. */
  animateLogo(logo, u) {
    const bus = logo.bus;
    const by = bus.y;
    const baseScale = bus.scaleX;
    // entrada: o ônibus chega de baixo e o letreiro aparece
    bus.y = by + 220 * u;
    this.tweens.add({ targets: bus, y: by, duration: 650, ease: 'Back.easeOut', delay: 150 });
    logo.list.slice(1).forEach((o, i) => {
      o.setScale(0.2).setAlpha(0);
      this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 420, delay: 500 + i * 140, ease: 'Back.easeOut' });
    });
    // motor ligado: tremidinha + respiração da suspensão
    this.time.delayedCall(820, () => {
      // (mais calmo: antes tremia a cada 90 ms)
      this.tweens.add({ targets: bus, y: by - 1 * u, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: bus, scaleY: baseScale * 0.988, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // letreiro flutua devagar
      this.tweens.add({ targets: logo.list.slice(1), y: '-=5', duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // fumacinha do escapamento
    this.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => {
        const x = logo.x + bus.displayWidth * 0.36;
        const y = logo.y + by + bus.displayHeight * 0.44;
        const puff = this.add.circle(x, y, 6 * u, 0xffffff, 0.55).setDepth(-1); // atrás do letreiro
        this.tweens.add({ targets: puff, x: x + 26 * u, y: y - 10 * u, scale: 2.4, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
      },
    });
    // tocar no ônibus: fon-fon e pulinho
    bus.setInteractive({ useHandCursor: true });
    bus.on('pointerdown', () => {
      Sound.depart();
      Haptics.tap();
      this.tweens.add({ targets: bus, scaleX: baseScale * 1.08, scaleY: baseScale * 0.92, duration: 90, yoyo: true });
      this.tweens.add({ targets: logo, angle: { from: -3, to: 3 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => logo.setAngle(0) });
      const conf = this.add.particles(logo.x, logo.y + by - 40 * u, 'dot', {
        speed: { min: 120 * u, max: 280 * u },
        angle: { min: 200, max: 340 },
        gravityY: 500 * u,
        lifespan: 800,
        scale: { start: 0.22 * u, end: 0.05 * u },
        tint: CONFIG.colors.particles,
        emitting: false,
      });
      conf.setDepth(20);
      conf.explode(24);
      this.time.delayedCall(1000, () => conf.destroy());
    });
  }

  /** Céu e orla em movimento: nuvens, gaivotas, brilho do mar e gente no calçadão. */
  animateScenery(L, u, horizon, roadY) {
    // nuvens
    for (let i = 0; i < 4; i++) {
      const c = this.add.container(0, 0).setDepth(-8);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.85);
      const s = (0.7 + (i % 3) * 0.25) * u;
      g.fillEllipse(0, 0, 70 * s, 26 * s);
      g.fillEllipse(-22 * s, 4 * s, 40 * s, 20 * s);
      g.fillEllipse(20 * s, -8 * s, 44 * s, 26 * s);
      c.add(g);
      const y = L.top + (40 + i * 52) * u * (horizon / (L.top + 400 * u));
      const startX = ((i * 0.31) % 1) * L.W;
      c.setPosition(startX, Math.min(y, horizon - 60 * u));
      const dur = (38000 + i * 9000) * (1 - startX / (L.W + 120 * u));
      const loop = () => {
        c.x = -80 * u;
        this.tweens.add({ targets: c, x: L.W + 80 * u, duration: 38000 + i * 9000, onComplete: loop });
      };
      this.tweens.add({ targets: c, x: L.W + 80 * u, duration: dur, onComplete: loop });
    }
    // gaivotas
    this.time.addEvent({
      delay: 3600,
      loop: true,
      callback: () => {
        const g = this.add.graphics().setDepth(-6);
        g.lineStyle(2.5 * u, CONFIG.colors.ink, 0.8);
        const w = 9 * u;
        g.beginPath();
        g.moveTo(-w, 0);
        g.lineTo(0, 4 * u);
        g.lineTo(w, 0);
        g.strokePath();
        const right = Math.random() < 0.5;
        g.setPosition(right ? -20 * u : L.W + 20 * u, horizon * (0.35 + Math.random() * 0.4));
        this.tweens.add({ targets: g, scaleY: 0.4, duration: 260, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: g, x: right ? L.W + 20 * u : -20 * u, y: g.y - 30 * u, duration: 9000, onComplete: () => g.destroy() });
      },
    });
    // brilho do mar
    const shine = this.add.graphics().setDepth(-6);
    shine.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 9; i++) shine.fillRoundedRect(((i * 53) % 100) * L.W * 0.01, horizon + 5 * u + (i % 3) * 8 * u, (18 + (i % 4) * 8) * u, 2.5 * u, u);
    this.tweens.add({ targets: shine, x: 24 * u, alpha: 0.5, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // gente caminhando no calçadão
    const walkY = roadY + 70 * u;
    this.time.addEvent({ delay: 2300, loop: true, callback: () => this.spawnWalker(L, u, walkY) });
    this.spawnWalker(L, u, walkY);
  }

  spawnWalker(L, u, y) {
    const right = Math.random() < 0.5;
    const c = this.add.container(right ? -20 * u : L.W + 20 * u, y + Math.random() * 30 * u).setDepth(-3);
    const g = this.add.graphics();
    drawPassenger(g, { color: Math.floor(Math.random() * 8), s: 34 * u, skin: Math.floor(Math.random() * 5), hair: Math.floor(Math.random() * 4) });
    c.add(g);
    this.tweens.add({ targets: g, y: -3 * u, angle: { from: -4, to: 4 }, duration: 230, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: c, x: right ? L.W + 20 * u : -20 * u, duration: 11000 + Math.random() * 5000, onComplete: () => c.destroy() });
  }

  spawnBus(L, u, roadY) {
    const right = Math.random() < 0.5;
    const color = Math.floor(Math.random() * 8);
    const type = ['small', 'medium', 'large'][Math.floor(Math.random() * 3)];
    const w = Math.round(28 * u);
    const len = Math.round((type === 'small' ? 54 : type === 'medium' ? 74 : 94) * u);
    const key = busTexture(this, { type, color, w, len, symbol: false });
    const y = roadY + (right ? 18 : -14) * u;
    const img = this.add.image(right ? -len : L.W + len, y, key).setRotation(right ? Math.PI / 2 : -Math.PI / 2);
    img.setDepth(-4);
    // trânsito calmo de orla: ~9–12 s para cruzar a tela (antes 4–6 s)
    this.tweens.add({ targets: img, x: right ? L.W + len : -len, duration: 9000 + Math.random() * 3000, ease: 'Linear', onComplete: () => img.destroy() });
  }
}
