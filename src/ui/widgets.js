// Componentes visuais reutilizáveis desenhados com Phaser (botões, corações, transições).

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { FONT, DISPLAY } from './layout.js';
import { Icons } from './icons.js';
import { Sound } from '../services/Sound.js';
import { Haptics } from '../services/Haptics.js';

/**
 * Botão grande com cantos arredondados.
 * opts: { width, height, color, textColor, fontSize, radius, icon, iconArg, iconColor, iconSize, badge }
 *   icon  = nome de um ícone em Icons (desenhado à esquerda do texto, ou sozinho se não houver texto)
 *   badge = número/texto exibido numa bolinha à direita
 */
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, opts, onClick) {
    super(scene, x, y);
    this.opts = { radius: 18, ...opts };
    this.opts.color ??= CONFIG.colors.button;
    this.opts.textColor ??= CONFIG.colors.buttonText;
    this.onClick = onClick;
    this.enabled = true;
    this.bg = scene.add.graphics();
    this.iconG = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, label, {
        fontFamily: DISPLAY,
        fontSize: `${this.opts.fontSize}px`,
        color: this.opts.textColor,
        align: 'center',
        stroke: CONFIG.colors.inkCss,
        strokeThickness: Math.max(2, this.opts.fontSize * 0.14),
      })
      .setOrigin(0.5);
    this.badgeG = scene.add.graphics();
    this.badgeT = scene.add
      .text(0, 0, '', { fontFamily: DISPLAY, fontSize: `${this.opts.fontSize * 0.8}px`, color: this.opts.textColor })
      .setOrigin(0.5);
    this.add([this.bg, this.iconG, this.label, this.badgeG, this.badgeT]);
    this.draw();
    const { width: w, height: h } = this.opts;
    this.setSize(w, h);
    // Em Containers, a área de toque é medida a partir do canto superior esquerdo
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      scene.tweens.add({ targets: this, scale: 0.95, duration: CONFIG.anim.buttonPress });
    });
    const release = (fire) => {
      if (!this.pressed) return;
      this.pressed = false;
      scene.tweens.add({ targets: this, scale: 1, duration: CONFIG.anim.buttonPress });
      if (fire && this.enabled) {
        Sound.button();
        Haptics.tap();
        this.onClick?.();
      }
    };
    this.on('pointerup', () => release(true));
    this.on('pointerout', () => release(false));
    scene.add.existing(this);
  }

  draw() {
    const { width: w, height: h, color, radius, icon, iconArg, badge } = this.opts;
    const alpha = this.enabled ? 1 : 0.45;
    this.bg.clear();
    // estilo "adesivo": sombra dura azul-marinho, contorno grosso e brilho no topo
    const ink = CONFIG.colors.ink;
    const ow = Math.max(2, Math.min(w, h) * 0.06);
    const r = Math.min(radius, h / 2);
    this.bg.fillStyle(ink, alpha);
    this.bg.fillRoundedRect(-w / 2, -h / 2 + h * 0.1, w, h, r);
    this.bg.fillStyle(ink, alpha);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bg.fillStyle(color, alpha);
    this.bg.fillRoundedRect(-w / 2 + ow, -h / 2 + ow, w - ow * 2, h - ow * 2, Math.max(2, r - ow));
    this.bg.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(18).color, alpha);
    this.bg.fillRoundedRect(-w / 2 + ow, h / 2 - ow - h * 0.16, w - ow * 2, h * 0.16, { tl: 0, tr: 0, bl: Math.max(2, r - ow), br: Math.max(2, r - ow) });
    this.bg.fillStyle(0xffffff, 0.22 * alpha);
    this.bg.fillRoundedRect(-w / 2 + ow * 2.2, -h / 2 + ow * 1.6, w - ow * 4.4, h * 0.2, Math.max(2, (r - ow) * 0.6));

    // ícone + texto centralizados juntos
    const fs = this.opts.fontSize;
    const iconSize = this.opts.iconSize ?? fs * 1.15;
    const textW = this.label.text ? this.label.width : 0;
    const gap = icon && textW ? fs * 0.45 : 0;
    const total = (icon ? iconSize : 0) + gap + textW;
    const startX = -total / 2;
    this.iconG.clear();
    if (icon) {
      const iconColor = this.opts.iconColor ?? Phaser.Display.Color.HexStringToColor(this.opts.textColor).color;
      Icons[icon](this.iconG, startX + iconSize / 2, 0, iconSize, iconColor, iconArg);
    }
    this.label.setX(startX + (icon ? iconSize + gap : 0) + textW / 2);
    this.label.setY(-h * 0.02);
    this.iconG.setAlpha(this.enabled ? 1 : 0.6);

    // selo à direita
    this.badgeG.clear();
    this.badgeT.setText(badge != null ? String(badge) : '');
    if (badge != null) {
      // selo no canto superior direito
      const r = Math.max(h * 0.2, fs * 0.62);
      const bx = w / 2 - r * 0.55;
      const by = -h / 2 + r * 0.45;
      this.badgeG.fillStyle(CONFIG.colors.ink, alpha);
      this.badgeG.fillCircle(bx, by + r * 0.12, r * 1.12);
      this.badgeG.fillStyle(CONFIG.colors.accent, alpha);
      this.badgeG.fillCircle(bx, by, r * 0.92);
      this.badgeT.setColor(CONFIG.colors.inkCss);
      this.badgeT.setPosition(bx, by - r * 0.04);
    }
  }

  setLabel(text) {
    this.label.setText(text);
    this.draw();
    return this;
  }

  setColor(color) {
    this.opts.color = color;
    this.draw();
    return this;
  }

  /** Atualiza várias opções de uma vez (icon, badge, color, textColor...). */
  setOpts(o) {
    Object.assign(this.opts, o);
    this.label.setColor(this.opts.textColor);
    this.draw();
    return this;
  }

  setEnabled(v) {
    this.enabled = v;
    this.label.setAlpha(v ? 1 : 0.6);
    this.draw();
    return this;
  }
}

/** Desenha um coração centrado em (x, y) com tamanho s. */
export function drawHeart(g, x, y, s, color, alpha = 1) {
  Icons.heart(g, x, y, s, color, alpha);
}

/** Entrada suave da cena. */
export function fadeIn(scene) {
  scene.cameras.main.fadeIn(CONFIG.anim.sceneFade, 0x1b, 0x23, 0x40);
}

/** Troca de cena com fade (ignora toques repetidos durante a transição). */
export function goTo(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(CONFIG.anim.sceneFade, 0x1b, 0x23, 0x40);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.input.enabled = true;
    scene._leaving = false;
    if (key === scene.scene.key) scene.scene.restart(data);
    else scene.scene.start(key, data);
  });
}
