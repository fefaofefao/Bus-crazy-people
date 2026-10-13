// Mapa de fases: a linha de ônibus atravessa a cidade em zigue-zague e cada
// fase é uma parada (20 por página, abre na página da próxima fase). O ônibus
// fica parado na próxima fase; Desafios são terminais com anel dourado;
// a faixa amarela da rua mostra o trecho já percorrido.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, FONT, DISPLAY } from '../ui/layout.js';
import { Storage } from '../services/Storage.js';
import { Achievements } from '../services/Achievements.js';
import { livesPill } from '../ui/livesPill.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { busTexture } from '../ui/art.js';
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

  /** Comprimento do trajeto até o ponto da parada (para pintar o trecho percorrido). */
  lengthUntil(path, p, pts) {
    let acc = 0;
    let best = 0;
    let bestD = Infinity;
    for (let k = 1; k < pts.length; k++) {
      acc += Phaser.Math.Distance.BetweenPoints(pts[k - 1], pts[k]);
      const dd = Phaser.Math.Distance.BetweenPoints(pts[k], p);
      if (dd < bestD) (bestD = dd), (best = acc);
    }
    return best;
  }

  /** Ônibus estacionado ao lado da próxima parada, balançando de leve. */
  parkBus({ x, y }, i, colW, u) {
    const dir = Math.floor(i / COLS) % 2 ? -1 : 1; // sentido da rua
    const w = 19 * u;
    const key = busTexture(this, { type: 'small', color: 2, w, len: w * 1.85 });
    const bus = this.add.image(x - dir * colW * 0.5, y - 1 * u, key).setAngle(dir > 0 ? 90 : -90);
    this.tweens.add({ targets: bus, y: bus.y - 2 * u, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Quarteirões, árvores e prédios ao fundo (mesmos em cada página). */
  drawCity(L, u, y0, rowGap, gx0, gw) {
    const g = this.add.graphics().setDepth(-1);
    let seed = this.page * 977 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < ROWS - 1; r++) {
      const top = y0 + r * rowGap + 22 * u;
      const h = rowGap - 44 * u;
      if (h < 12 * u) continue;
      g.fillStyle(0x222b4f, 1);
      g.fillRoundedRect(gx0 + 6 * u, top, gw - 12 * u, h, 12 * u);
      // casinhas e árvores
      const n = 7;
      for (let k = 0; k < n; k++) {
        const cx = gx0 + 24 * u + ((gw - 48 * u) * (k + 0.5)) / n + (rnd() - 0.5) * 10 * u;
        const cy = top + h / 2;
        if (rnd() < 0.45) {
          g.fillStyle(0x2f9e5b, 0.55);
          g.fillCircle(cx, cy, Math.min(h * 0.32, 11 * u));
        } else {
          const bw = 16 * u;
          const bh = Math.min(h * 0.62, 22 * u);
          g.fillStyle([0x3b4877, 0x46355f, 0x2d4f66][Math.floor(rnd() * 3)], 1);
          g.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 3 * u);
          g.fillStyle(0xffd166, 0.35);
          for (let wy = cy - bh / 2 + 4 * u; wy < cy + bh / 2 - 5 * u; wy += 6 * u) g.fillRect(cx - bw / 2 + 4 * u, wy, 3 * u, 3 * u), g.fillRect(cx + bw / 2 - 7 * u, wy, 3 * u, 3 * u);
        }
      }
    }
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
    const navH = 64 * u;
    livesPill(this, L.cx, topY + 50 * u, u);
    const areaTop = topY + 86 * u;
    const areaBottom = L.bottom - navH - 30 * u;
    const first = this.page * PER_PAGE + 1;

    // ---- trajeto da linha de ônibus: 5 ruas em zigue-zague, 4 paradas por rua ----
    const colW = gw / COLS;
    const rowGap = Math.min((areaBottom - areaTop) / ROWS, 128 * u);
    const y0 = (areaTop + areaBottom) / 2 - (rowGap * (ROWS - 1)) / 2;
    const gx0 = L.cx - gw / 2;
    const stop = Math.round(Math.min(colW * 0.72, rowGap * 0.52));
    const pos = (i) => {
      const r = Math.floor(i / COLS);
      const c = r % 2 ? COLS - 1 - (i % COLS) : i % COLS;
      return { x: gx0 + colW * (c + 0.5), y: y0 + r * rowGap };
    };
    const count = Math.min(PER_PAGE, LEVEL_COUNT - first + 1);
    const path = new Phaser.Curves.Path(pos(0).x - colW * 0.75, pos(0).y);
    const bend = colW * 0.62;
    for (let i = 0; i < count; i++) {
      const p = pos(i);
      if (i > 0 && i % COLS === 0) {
        const q = pos(i - 1);
        const dir = Math.floor((i - 1) / COLS) % 2 ? -1 : 1; // lado da curva
        path.cubicBezierTo(p.x, p.y, q.x + dir * bend, q.y, p.x + dir * bend, p.y);
      } else path.lineTo(p.x, p.y);
    }
    const lastP = pos(count - 1);
    const lastDir = Math.floor((count - 1) / COLS) % 2 ? -1 : 1;
    if (first + count - 1 < LEVEL_COUNT) path.lineTo(lastP.x + lastDir * colW * 0.75, lastP.y);
    else path.lineTo(lastP.x + lastDir * colW * 0.3, lastP.y);
    this.drawCity(L, u, y0, rowGap, gx0, gw);
    const pts = path.getSpacedPoints(Math.ceil(path.getLength() / (4 * u)));
    const road = this.add.graphics();
    road.lineStyle(30 * u, C.ink, 1);
    road.strokePoints(pts, false, false);
    road.lineStyle(24 * u, C.asphalt, 1);
    road.strokePoints(pts, false, false);
    // faixa central tracejada: amarela no trecho já percorrido, apagada no resto
    const doneIdx = Math.min(count - 1, Math.max(-1, frontier - first));
    const doneLen = doneIdx < 0 ? 0 : this.lengthUntil(path, pos(doneIdx), pts);
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      acc += Phaser.Math.Distance.BetweenPoints(pts[k - 1], pts[k]);
      if (Math.floor(acc / (9 * u)) % 2) continue;
      road.lineStyle(3 * u, acc <= doneLen ? C.laneLine : 0x5d6688, 1);
      road.lineBetween(pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y);
    }

    // ônibus chegando na próxima parada (desenhado antes: as paradas ficam por cima)
    if (next && next >= first && next < first + count) this.parkBus(pos(next - first), next - first, colW, u);

    for (let i = 0; i < count; i++) {
      const n = first + i;
      const { x, y } = pos(i);
      const ch = isChallenge(n);
      const d = ch ? stop * 1.12 : stop;
      if (n > frontier) {
        const g = this.add.graphics();
        g.fillStyle(C.ink, 1);
        g.fillCircle(x, y + 3 * u, d / 2 + 3 * u);
        g.fillStyle(0x2b345c, 1);
        g.fillCircle(x, y, d / 2);
        g.lineStyle(3 * u, ch ? C.challenge : 0x3d4772, ch ? 0.6 : 1);
        g.strokeCircle(x, y, d / 2 - 1.5 * u);
        this.add.text(x, y - 5 * u, String(n), { fontFamily: DISPLAY, fontSize: `${(ch ? 21 : 19) * u}px`, color: '#56648a' }).setOrigin(0.5);
        Icons.lock(g, x, y + d * 0.24, 12 * u, 0x56648a);
        const zone = this.add.zone(x, y, d, d).setInteractive();
        zone.on('pointerup', () => toast(t('levels.locked')));
        continue;
      }
      const completed = Progress.isCompleted(n);
      const isNext = n === next;
      const color = isNext ? C.buttonSuccess : ch ? 0xc23a6e : completed ? C.button : C.buttonSecondary;
      const btn = new Button(this, x, y, String(n), { width: d, height: d * 0.94, fontSize: (ch ? 24 : 22) * u, radius: d * 0.47, color }, () => goTo(this, 'Game', { level: n }));
      btn.label.setY(-3 * u);
      if (ch) {
        // anel dourado do Desafio (terminal da linha)
        const hb = this.add.graphics();
        hb.lineStyle(3.5 * u, C.accent, 1);
        hb.strokeCircle(0, d * 0.03, d / 2 + 5 * u);
        btn.addAt(hb, 0);
      }
      const stars = Storage.data.stars[n] ?? 0;
      if (completed) {
        // estrelas embaixo da parada
        const sg = this.add.graphics();
        const ss = 13 * u;
        for (let k = 0; k < 3; k++) {
          const sx = x + (k - 1) * ss * 1.08;
          const sy = y + d / 2 + (ch ? 15 : 10) * u - (k === 1 ? 2 * u : 0);
          Icons.star(sg, sx, sy + 1.5 * u, ss + 4 * u, C.ink);
          Icons.star(sg, sx, sy, ss, k < stars ? C.gold : 0x55627d);
        }
      } else if (ch) {
        this.add.text(x, y + d / 2 + 9 * u, '★', { fontFamily: FONT, fontSize: `${14 * u}px`, color: '#ffe28a', stroke: C.inkCss, strokeThickness: 4 * u }).setOrigin(0.5);
      }
      if (isNext) {
        this.tweens.add({ targets: btn, scale: 1.07, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
