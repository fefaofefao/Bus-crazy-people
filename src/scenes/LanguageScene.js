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

    // opções: grade de 2 colunas (6 idiomas)
    const cw = (bw - 12 * u) / 2;
    const ch = 60 * u;
    let y = my + 150 * u;
    LANGUAGES.forEach((lang, i) => {
      const on = lang.code === this.selected;
      const x = L.cx + (i % 2 ? 1 : -1) * (cw / 2 + 6 * u);
      const yy = y + Math.floor(i / 2) * (ch + 14 * u);
      const b = new Button(
        this,
        x,
        yy,
        lang.name,
        { width: cw, height: ch, fontSize: 18 * u, radius: 18 * u, color: on ? C.button : C.buttonSecondary, icon: `flag_${lang.flag}`, iconSize: 30 * u },
        () => {
          if (lang.code !== this.selected) this.scene.restart({ from: this.from, selected: lang.code });
        },
      );
      if (on) {
        const ring = this.add.graphics();
        ring.lineStyle(3 * u, 0xffffff, 0.9);
        ring.strokeRoundedRect(x - cw / 2 - 5 * u, yy - ch / 2 - 5 * u, cw + 10 * u, ch + 10 * u, 22 * u);
        const ck = this.add.graphics();
        ck.fillStyle(C.buttonSuccess, 1);
        ck.fillCircle(x + cw / 2 - 4 * u, yy - ch / 2 + 4 * u, 12 * u);
        Icons.check(ck, x + cw / 2 - 4 * u, yy - ch / 2 + 5 * u, 14 * u, 0xffffff, 0.2);
        b.setDepth(1);
        ck.setDepth(2);
      }
    });
    y += Math.ceil(LANGUAGES.length / 2) * (ch + 14 * u);

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
