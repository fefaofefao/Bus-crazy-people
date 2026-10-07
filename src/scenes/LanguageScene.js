// Escolha de idioma: aparece no primeiro acesso e também pelas Configurações.
// Tocar num idioma já mostra a tela nele; "Continuar" confirma e salva.

import Phaser from 'phaser';
import { Music } from '../services/Music.js';
import { CONFIG } from '../config.js';
import { getLayout, FONT, DISPLAY } from '../ui/layout.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { Storage } from '../services/Storage.js';
import { LANGUAGES, getLanguage, setLanguage, isSupportedLanguage } from '../i18n/index.js';

const C = CONFIG.colors;

export class LanguageScene extends Phaser.Scene {
  constructor() {
    super('Language');
  }

  init(data) {
    this.from = data?.from ?? null; // 'Settings' quando aberta pelas configurações
    this.selected = isSupportedLanguage(data?.selected) ? data.selected : getLanguage();
  }

  /** Aberta pelas Configurações: volta para lá. No primeiro acesso: sai do app. */
  onBack() {
    if (!this.from) return false;
    goTo(this, this.from);
    return true;
  }

  create() {
    Music.play('menu');
    this.cameras.main.setBackgroundColor(C.background);
    fadeIn(this);
    const L = getLayout(this);
    const u = L.u;
    const S = LANGUAGES.find((l) => l.code === this.selected).strings; // pré-visualiza no idioma tocado
    const bw = Math.min(L.usableW - 48 * u, 330 * u);

    if (this.from) {
      const topY = L.top + 8 * u + 25 * u;
      new Button(this, L.left + 16 * u + 25 * u, topY, '', { width: 50 * u, height: 50 * u, fontSize: 20 * u, color: C.buttonSecondary, radius: 15 * u, icon: 'home', iconSize: 24 * u }, () =>
        goTo(this, this.from),
      );
    }

    // medalhão com globo
    const my = L.top + L.usableH * 0.2;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.05);
    g.fillCircle(L.cx, my, 66 * u);
    g.fillStyle(C.accent, 1);
    g.fillCircle(L.cx, my, 46 * u);
    Icons.globe(g, L.cx, my, 56 * u, 0x0b1d2a);

    this.add
      .text(L.cx, my + 92 * u, S.language.title, { fontFamily: DISPLAY, fontSize: `${28 * u}px`, color: C.text, align: 'center' })
      .setOrigin(0.5);

    // opções
    let y = my + 170 * u;
    for (const lang of LANGUAGES) {
      const on = lang.code === this.selected;
      const b = new Button(
        this,
        L.cx,
        y,
        lang.name,
        {
          width: bw,
          height: 66 * u,
          fontSize: 22 * u,
          radius: 20 * u,
          color: on ? C.button : C.buttonSecondary,
          icon: `flag_${lang.flag}`,
          iconSize: 36 * u,
        },
        () => {
          if (lang.code !== this.selected) this.scene.restart({ from: this.from, selected: lang.code });
        },
      );
      if (on) {
        const ring = this.add.graphics();
        ring.lineStyle(3 * u, 0xffffff, 0.9);
        ring.strokeRoundedRect(L.cx - bw / 2 - 5 * u, y - 33 * u - 5 * u, bw + 10 * u, 66 * u + 10 * u, 24 * u);
        const ck = this.add.graphics();
        ck.fillStyle(C.buttonSuccess, 1);
        ck.fillCircle(L.cx + bw / 2 - 26 * u, y, 15 * u);
        Icons.check(ck, L.cx + bw / 2 - 26 * u, y + 1 * u, 18 * u, 0xffffff, 0.2);
        b.setDepth(1);
        ck.setDepth(2);
      }
      y += 84 * u;
    }

    const cont = new Button(
      this,
      L.cx,
      Math.max(y + 40 * u, L.bottom - 70 * u),
      S.language.continue,
      { width: bw, height: 72 * u, fontSize: 25 * u, radius: 22 * u, color: C.buttonSuccess, icon: 'play', iconSize: 22 * u },
      () => {
        setLanguage(this.selected);
        if (this.from) goTo(this, this.from);
        // primeiro acesso: direto para a fase 1 (tutorial), sem passar pelo menu
        else if (!Storage.data.completed.length) goTo(this, 'Game', { level: 1 });
        else goTo(this, 'Menu');
      },
    );
    cont.setY(Math.min(cont.y, L.bottom - 50 * u));

    const onResize = () => this.time.delayedCall(30, () => this.scene.restart({ from: this.from, selected: this.selected }));
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }
}
