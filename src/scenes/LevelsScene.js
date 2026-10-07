// Mapa/lista de fases: 20 por página, abre na página da próxima fase.
// Concluídas com ✓, Desafios com borda laranja, futuras com cadeado.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, FONT, DISPLAY } from '../ui/layout.js';
import { Storage } from '../services/Storage.js';
import { Achievements } from '../services/Achievements.js';
import { livesPill } from '../ui/livesPill.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { Music } from '../services/Music.js';
import { toast } from '../ui/dom.js';
import { Progress } from '../services/Progress.js';
import { LEVEL_COUNT, isChallenge } from '../levels/index.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;
const COLS = 4;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;

export class LevelsScene extends Phaser.Scene {
  constructor() {
    super('Levels');
  }

  init(data) {
    const target = Progress.nextToPlay() ?? Progress.frontier();
    this.page = Number.isInteger(data?.page) ? data.page : Math.floor((target - 1) / PER_PAGE);
  }

  onBack() {
    goTo(this, 'Menu');
    return true;
  }

  create() {
    Music.play('menu');
    this.cameras.main.setBackgroundColor(C.background);
    fadeIn(this);
    const L = getLayout(this);
    const u = L.u;
    const lastPage = Math.floor((LEVEL_COUNT - 1) / PER_PAGE);
    this.page = Phaser.Math.Clamp(this.page, 0, lastPage);
    const frontier = Progress.frontier();
    const next = Progress.nextToPlay();

    const topY = L.top + 8 * u + 25 * u;
    new Button(this, L.left + 16 * u + 25 * u, topY, '', { width: 50 * u, height: 50 * u, color: C.buttonSecondary, radius: 15 * u, icon: 'home', iconSize: 24 * u }, () =>
      goTo(this, 'Menu'),
    );
    this.add.text(L.cx, topY, t('levels.title'), { fontFamily: DISPLAY, fontSize: `${28 * u}px`, color: C.text }).setOrigin(0.5);
    const starTxt = this.add
      .text(L.right - 18 * u, topY, `${Achievements.totalStars()}/${LEVEL_COUNT * 3}`, { fontFamily: DISPLAY, fontSize: `${16 * u}px`, color: '#ffc72c' })
      .setOrigin(1, 0.5);
    Icons.star(this.add.graphics(), starTxt.x - starTxt.width - 12 * u, topY - 1 * u, 20 * u, C.gold);

    const gw = Math.min(L.usableW - 40 * u, 340 * u);
    const gap = 12 * u;
    const tile = Math.floor((gw - gap * (COLS - 1)) / COLS);
    const gridH = ROWS * tile + (ROWS - 1) * gap;
    const navH = 64 * u;
    livesPill(this, L.cx, topY + 50 * u, u);
    const areaTop = topY + 80 * u;
    const areaBottom = L.bottom - navH - 24 * u;
    const gy0 = Math.max(areaTop, areaTop + (areaBottom - areaTop - gridH) / 2);
    const gx0 = L.cx - (COLS * tile + (COLS - 1) * gap) / 2;
    const first = this.page * PER_PAGE + 1;

    for (let i = 0; i < PER_PAGE; i++) {
      const n = first + i;
      if (n > LEVEL_COUNT) break;
      const x = gx0 + (i % COLS) * (tile + gap) + tile / 2;
      const y = gy0 + Math.floor(i / COLS) * (tile + gap) + tile / 2;
      const ch = isChallenge(n);
      if (n > frontier) {
        const g = this.add.graphics();
        g.fillStyle(0x262f55, 1);
        g.fillRoundedRect(x - tile / 2, y - tile / 2, tile, tile, 18 * u);
        if (ch) {
          g.lineStyle(3 * u, C.challenge, 0.45);
          g.strokeRoundedRect(x - tile / 2 + 1.5 * u, y - tile / 2 + 1.5 * u, tile - 3 * u, tile - 3 * u, 17 * u);
        }
        this.add.text(x, y - 8 * u, String(n), { fontFamily: DISPLAY, fontSize: `${22 * u}px`, color: '#4a5878' }).setOrigin(0.5);
        Icons.lock(g, x, y + 18 * u, 16 * u, 0x4a5878);
        const zone = this.add.zone(x, y, tile, tile).setInteractive();
        zone.on('pointerup', () => toast(t('levels.locked')));
        continue;
      }
      const completed = Progress.isCompleted(n);
      const isNext = n === next;
      const color = isNext ? C.buttonSuccess : ch ? 0xc23a6e : completed ? C.button : C.buttonSecondary;
      const btn = new Button(this, x, y, String(n), { width: tile, height: tile, fontSize: 26 * u, radius: 20 * u, color }, () => goTo(this, 'Game', { level: n }));
      btn.label.setY(-5 * u);
      if (isNext) this.tweens.add({ targets: btn, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const badge = this.add.graphics();
      const stars = Storage.data.stars[n] ?? 0;
      if (completed) {
        const ss = 15 * u;
        for (let k = 0; k < 3; k++) {
          const sx = (k - 1) * ss * 1.05;
          const sy = tile * 0.27 - (k === 1 ? 3 * u : 0);
          Icons.star(badge, sx, sy + 1.5 * u, ss + 3 * u, C.ink);
          Icons.star(badge, sx, sy, ss, k < stars ? C.gold : 0x55627d);
        }
      } else if (isNext) Icons.play(badge, 0, tile * 0.26, 14 * u, 0xffffff);
      btn.add(badge);
      if (ch) {
        const hb = this.add.graphics();
        hb.lineStyle(3 * u, C.accent, 1);
        hb.strokeRoundedRect(-tile / 2 + 1.5 * u, -tile / 2 + 1.5 * u, tile - 3 * u, tile - 3 * u, 17 * u);
        btn.add(hb);
        if (!completed) {
          const st = this.add.text(0, tile * 0.27, '★', { fontFamily: FONT, fontSize: `${15 * u}px`, color: '#ffe28a' }).setOrigin(0.5);
          btn.add(st);
        }
      }
    }

    const navY = L.bottom - navH / 2 - 16 * u;
    this.add
      .text(L.cx, navY, t('levels.range', { a: first, b: Math.min(first + PER_PAGE - 1, LEVEL_COUNT) }), { fontFamily: DISPLAY, fontSize: `${17 * u}px`, color: C.textDim })
      .setOrigin(0.5);
    const nav = (dx, label, enabled, page) => {
      const b = new Button(this, L.cx + dx, navY, label, { width: 64 * u, height: 56 * u, fontSize: 30 * u, radius: 18 * u, color: C.buttonSecondary }, () =>
        enabled && this.scene.restart({ page }),
      );
      b.label.setY(-4 * u);
      b.setEnabled(enabled);
    };
    nav(-gw / 2 + 32 * u, '‹', this.page > 0, this.page - 1);
    nav(gw / 2 - 32 * u, '›', this.page < lastPage, this.page + 1);

    this.input.on('pointerup', (p) => {
      const dx = p.upX - p.downX;
      if (Math.abs(dx) < 60 * u || Math.abs(p.upY - p.downY) > Math.abs(dx)) return;
      if (dx < 0 && this.page < lastPage) this.scene.restart({ page: this.page + 1 });
      if (dx > 0 && this.page > 0) this.scene.restart({ page: this.page - 1 });
    });

    const onResize = () => this.time.delayedCall(30, () => this.scene.restart({ page: this.page }));
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }
}
