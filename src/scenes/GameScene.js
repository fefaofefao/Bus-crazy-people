// Tela de partida: cidade, ponto de ônibus (vagas), fila de passageiros e estacionamento.
//
// As regras ficam em src/core/engine.js. Esta cena só desenha o estado,
// recebe toques e anima a lista de eventos que o motor devolve a cada jogada.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DIRS, BUS_TYPES, busCells } from '../core/rules.js';
import { initialState, tap, addSlot, occupancy } from '../core/engine.js';
import { nextMove } from '../core/solver.js';
import { getLevel, LEVEL_COUNT } from '../levels/index.js';
import { getLayout, FONT } from '../ui/layout.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { busTexture, drawPassenger, shade, pruneBusTextures } from '../ui/art.js';
import { toast, modal } from '../ui/dom.js';
import { Storage } from '../services/Storage.js';
import { Progress } from '../services/Progress.js';
import { Sound } from '../services/Sound.js';
import { Haptics } from '../services/Haptics.js';
import { AdManager } from '../services/AdManager.js';
import { Debug } from '../debug.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;
const A = CONFIG.anim;
const ROT = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelId = Phaser.Math.Clamp(data?.level ?? Progress.nextToPlay() ?? 1, 1, LEVEL_COUNT);
  }

  create() {
    this.level = getLevel(this.levelId);
    this.state = initialState(this.level);
    this.history = [];
    this.undos = CONFIG.game.freeUndosPerLevel;
    this.extraSlots = 0;
    this.busy = false;
    this.modalOpen = false;
    this.ended = false;
    this.hintBus = null;
    this.tutorial = !!this.level.tutorial;
    this.cameras.main.setBackgroundColor(C.background);
    this.build(true);
    fadeIn(this);

    if (this.level.challenge && !Progress.isCompleted(this.levelId)) this.time.delayedCall(300, () => this.showChallengeIntro());

    this.input.on('pointerdown', (p) => this.onPointer(p));
    const onResize = () => this.time.delayedCall(30, () => this.build(false));
    this.scale.on('resize', onResize);
    const onDebug = () => this.build(false);
    window.addEventListener('fds-debug-change', onDebug);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      window.removeEventListener('fds-debug-change', onDebug);
    });
  }

  /** Botão voltar do Android: volta ao menu (o progresso já está salvo). */
  onBack() {
    goTo(this, 'Menu');
    return true;
  }

  // ===========================================================================
  // Montagem (refeita do zero ao abrir, redimensionar e desfazer)
  // ===========================================================================
  build(first) {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    this.busy = false;

    const L = getLayout(this);
    const u = L.u;
    this.L = L;
    this.u = u;
    const pad = CONFIG.layout.sidePadding * u;
    const lv = this.level;
    const symbols = Storage.data.settings.colorblind;
    this.symbols = symbols;

    // ---- faixas verticais ----
    const topH = CONFIG.layout.topBarHeight * u;
    const roadH = 120 * u;
    const walkH = 70 * u;
    const bottomH = CONFIG.layout.bottomBarHeight * u;
    const tipH = this.tutorial ? 54 * u : 0;
    const yTop = L.top;
    const yRoad = yTop + topH;
    const yWalk = yRoad + roadH;
    const yLot = yWalk + walkH;
    const yBottom = L.bottom - bottomH;
    this.zones = { yTop, yRoad, yWalk, yLot, yBottom, topH, roadH, walkH, bottomH };

    this.drawCity(L, u, yTop, yRoad);
    this.drawRoad(L, u, yRoad, roadH);
    this.drawSidewalk(L, u, yWalk, walkH);

    // ---- estacionamento ----
    const areaTop = yLot + 10 * u + tipH;
    const areaBottom = yBottom - 8 * u;
    const areaW = L.usableW - pad * 2;
    let cell = Math.floor(Math.min(areaW / lv.cols, (areaBottom - areaTop) / lv.rows, 70 * u));
    cell -= cell % 2;
    this.cell = cell;
    const gw = cell * lv.cols;
    const gh = cell * lv.rows;
    this.gx = Math.round(L.cx - gw / 2);
    this.gy = Math.round(areaTop + (areaBottom - areaTop - gh) / 2);
    this.drawLot(u);
    if (this.tutorial) this.drawTip(L, u, yLot + 8 * u, tipH);

    // ---- vagas ----
    this.layoutSlots();
    this.slotViews = [];
    for (let i = 0; i < this.state.slots.length; i++) this.slotViews.push(this.makeSlotBay(i));
    this.state.slots.forEach((o, i) => o && this.placeSlotBus(i, o.bus, o.filled, false));

    // ---- fila ----
    this.queueViews = [];
    this.layoutQueue();
    this.renderQueue(first);

    // ---- ônibus do estacionamento ----
    pruneBusTextures(this, (k) => k.includes(`_${this.busW}_`) || k.includes(`_${Math.round(this.slotBusW)}_`));
    this.busViews = new Map();
    let i = 0;
    for (const b of lv.buses) {
      if (!this.state.inLot[b.id]) continue;
      const v = this.makeLotBus(b);
      if (first) {
        v.setScale(0.4).setAlpha(0);
        this.tweens.add({ targets: v, scale: 1, alpha: 1, duration: A.appear, delay: i++ * A.appearStagger, ease: 'Back.easeOut' });
      }
    }
    this.drawDebug();

    // ---- HUD ----
    this.buildTopBar(L, u, pad);
    this.buildBottomBar(L, u, pad);
    this.refreshHud();

    // ---- partículas ----
    this.confetti = this.add.particles(0, 0, 'dot', {
      speed: { min: 80 * u, max: 260 * u },
      angle: { min: 200, max: 340 },
      gravityY: 500 * u,
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.2 * u, end: 0.05 * u },
      tint: C.particles,
      emitting: false,
    });
    this.confetti.setDepth(60);

    this.hintBus = null;
    this.hintG = this.add.graphics().setDepth(40);
    this.hand = null;
    if (this.state.status === 'playing') this.time.delayedCall(first ? 500 : 50, () => this.autoHint());
    else if (!this.modalOpen) this.time.delayedCall(50, () => this.showEnd());
  }

  // ---------------------------------------------------------------------------
  // Cenário
  // ---------------------------------------------------------------------------
  drawCity(L, u, y0, y1) {
    const g = this.add.graphics();
    g.fillStyle(C.sky, 1);
    g.fillRect(0, 0, L.W, y1);
    // casas coloridas (morro) e prédios ao fundo
    const houses = [0xffb347, 0x7ec8a9, 0xf47c7c, 0xffe066, 0x9fa8ff, 0x6fd3e8, 0xf6a6c9, 0xb4e06c];
    let x = 0;
    let k = 0;
    while (x < L.W) {
      const w = (34 + ((k * 37) % 26)) * u;
      const h = (22 + ((k * 53) % 24)) * u;
      g.fillStyle(houses[k % houses.length], 1);
      g.fillRect(x, y1 - h, w - 2 * u, h);
      g.fillStyle(0xffffff, 0.55);
      for (let wy = y1 - h + 6 * u; wy < y1 - 8 * u; wy += 11 * u) for (let wx = x + 5 * u; wx < x + w - 10 * u; wx += 11 * u) g.fillRect(wx, wy, 5 * u, 5 * u);
      g.fillStyle(shade(houses[k % houses.length], 0.75), 1);
      g.fillRect(x, y1 - h, w - 2 * u, 3 * u);
      x += w;
      k++;
    }
  }

  drawRoad(L, u, y, h) {
    const g = this.add.graphics();
    g.fillStyle(C.road, 1);
    g.fillRect(0, y, L.W, h);
    // meio-fio
    g.fillStyle(C.curb, 1);
    g.fillRect(0, y + h - 6 * u, L.W, 6 * u);
    // faixa tracejada
    g.fillStyle(0xffffff, 0.35);
    for (let x = 0; x < L.W; x += 34 * u) g.fillRect(x, y + 10 * u, 18 * u, 3 * u);
  }

  drawSidewalk(L, u, y, h) {
    const g = this.add.graphics();
    g.fillStyle(C.sidewalk, 1);
    g.fillRect(0, y, L.W, h);
    // ondas do calçadão
    g.lineStyle(4 * u, C.sidewalkWave, 0.13);
    for (let row = 0; row < 4; row++) {
      const pts = [];
      for (let x = -10 * u; x <= L.W + 10 * u; x += 6 * u) pts.push({ x, y: y + 10 * u + row * 17 * u + Math.sin(x / (16 * u) + row) * 5 * u });
      g.strokePoints(pts);
    }
    g.fillStyle(C.curb, 1);
    g.fillRect(0, y + h - 4 * u, L.W, 4 * u);
    // placa do ponto (à esquerda)
    const px = L.left + 14 * u;
    g.fillStyle(0x3b4252, 1);
    g.fillRect(px - 1.5 * u, y + 8 * u, 3 * u, h - 14 * u);
    g.fillStyle(C.shelter, 1);
    g.fillRoundedRect(px - 10 * u, y + 4 * u, 20 * u, 20 * u, 4 * u);
    Icons.bus(g, px, y + 14 * u, 15 * u, 0xffffff);
  }

  drawLot(u) {
    const g = this.add.graphics();
    const lv = this.level;
    const m = 8 * u;
    const w = this.cell * lv.cols;
    const h = this.cell * lv.rows;
    g.fillStyle(C.curb, 1);
    g.fillRoundedRect(this.gx - m - 4 * u, this.gy - m - 4 * u, w + (m + 4 * u) * 2, h + (m + 4 * u) * 2, 16 * u);
    g.fillStyle(C.asphalt, 1);
    g.fillRoundedRect(this.gx - m, this.gy - m, w + m * 2, h + m * 2, 12 * u);
    // marcações das vagas do estacionamento
    g.fillStyle(C.laneLine, 0.22);
    for (let y = 0; y < lv.rows; y++)
      for (let x = 0; x < lv.cols; x++) {
        const cx = this.cellX(x);
        const cy = this.cellY(y);
        g.fillRect(cx - this.cell * 0.04, cy - this.cell * 0.04, this.cell * 0.08, this.cell * 0.08);
      }
  }

  drawTip(L, u, y, h) {
    const g = this.add.graphics();
    const w = L.usableW - 24 * u;
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(L.cx - w / 2, y, w, h - 6 * u, 12 * u);
    this.add
      .text(L.cx, y + (h - 6 * u) / 2, t(`tutorial.${this.level.tutorial.text}`), {
        fontFamily: FONT,
        fontSize: `${14.5 * u}px`,
        fontStyle: '500',
        color: C.textDark,
        align: 'center',
        wordWrap: { width: w - 20 * u },
        lineSpacing: 1 * u,
      })
      .setOrigin(0.5);
  }

  cellX(x) {
    return this.gx + x * this.cell + this.cell / 2;
  }
  cellY(y) {
    return this.gy + y * this.cell + this.cell / 2;
  }

  // ---------------------------------------------------------------------------
  // Ônibus do estacionamento
  // ---------------------------------------------------------------------------
  busCenter(b) {
    const cells = busCells(b);
    const f = cells[0];
    const r = cells[cells.length - 1];
    return { x: (this.cellX(f.x) + this.cellX(r.x)) / 2, y: (this.cellY(f.y) + this.cellY(r.y)) / 2 };
  }

  makeLotBus(b) {
    const len = BUS_TYPES[b.type].len;
    const w = Math.round(this.cell * 0.76);
    this.busW = w;
    const L = Math.round(len * this.cell - this.cell * 0.2);
    const key = busTexture(this, { type: b.type, color: b.color, w, len: L, symbol: this.symbols });
    const c = this.busCenter(b);
    const img = this.add.image(c.x, c.y, key);
    // origem no centro da carroceria (a textura tem margem e sombra)
    const pad = Math.ceil(w * 0.08);
    img.setOrigin((pad + w / 2) / img.width, (pad + L / 2) / img.height);
    img.setRotation(ROT[b.dir]);
    img.setDepth(10);
    this.busViews.set(b.id, img);
    return img;
  }

  /** Toque: converte a posição numa casa do estacionamento. */
  onPointer(p) {
    if (this.busy || this.modalOpen || this.ended || this._leaving) return;
    const x = Math.floor((p.x - this.gx) / this.cell);
    const y = Math.floor((p.y - this.gy) / this.cell);
    if (x < 0 || y < 0 || x >= this.level.cols || y >= this.level.rows) return;
    const occ = occupancy(this.level, this.state);
    const id = occ[y * this.level.cols + x];
    if (id >= 0) this.play(id);
  }

  play(busId) {
    const r = tap(this.level, this.state, busId);
    if (!r.moved) return;
    this.history.push(this.state);
    this.state = r.state;
    this.clearHint();
    Sound.tap();
    this.animate(r.events);
  }

  // ===========================================================================
  // Animações
  // ===========================================================================
  animate(events) {
    this.busy = true;
    let tEnd = 0;
    const boardEvents = [];
    for (const e of events) {
      if (e.type === 'bump') tEnd = Math.max(tEnd, this.animBump(e));
      else if (e.type === 'exit') tEnd = Math.max(tEnd, this.animExit(e));
      else if (e.type === 'board' || e.type === 'depart') boardEvents.push(e);
    }
    // embarques começam quando o ônibus chega à vaga
    let t0 = tEnd;
    const stagger = boardEvents.length > 16 ? A.boardStagger * 0.6 : A.boardStagger;
    for (const e of boardEvents) {
      if (e.type === 'board') {
        this.time.delayedCall(t0, () => this.animBoard(e));
        t0 += stagger;
      } else {
        this.time.delayedCall(t0 + A.board, () => this.animDepart(e));
        t0 += A.board * 0.6;
      }
    }
    tEnd = Math.max(tEnd, t0 + (boardEvents.length ? A.board + 60 : 0));
    this.time.delayedCall(tEnd + 20, () => {
      this.busy = false;
      this.refreshHud();
      if (this.state.status !== 'playing') {
        this.ended = true;
        this.time.delayedCall(A.endDelay, () => this.showEnd());
      } else this.autoHint();
    });
  }

  animBump(e) {
    const b = this.level.buses[e.bus];
    const img = this.busViews.get(e.bus);
    const { dx, dy } = DIRS[b.dir];
    const dist = (e.dist + 0.22) * this.cell;
    const fwd = Math.max(A.bumpForwardMin, A.bumpForwardPerCell * (e.dist + 1));
    const ox = img.x;
    const oy = img.y;
    this.tweens.add({
      targets: img,
      x: ox + dx * dist,
      y: oy + dy * dist,
      duration: fwd,
      ease: 'Quad.easeIn',
      onComplete: () => {
        Sound.collision();
        Haptics.collision();
        const blk = this.busViews.get(e.blocker);
        if (blk) {
          const bx = blk.x;
          const by = blk.y;
          this.tweens.add({ targets: blk, x: bx + dx * this.cell * 0.08, y: by + dy * this.cell * 0.08, duration: 60, yoyo: true });
          blk.setTint(0xffb0b0);
          this.time.delayedCall(260, () => blk.active && blk.clearTint());
        }
        this.floatText(img.x, img.y - this.cell * 0.4, t('game.blocked'), '#ffdddd');
        this.tweens.add({ targets: img, x: ox, y: oy, duration: A.bumpBack, ease: 'Quad.easeOut' });
      },
    });
    return fwd + A.bumpBack;
  }

  animExit(e) {
    const b = this.level.buses[e.bus];
    const img = this.busViews.get(e.bus);
    this.busViews.delete(e.bus);
    const { dx, dy } = DIRS[b.dir];
    const lv = this.level;
    // distância até sair do estacionamento (da frente até a borda + comprimento)
    const toEdge = dx > 0 ? lv.cols - 1 - b.x : dx < 0 ? b.x : dy > 0 ? lv.rows - 1 - b.y : b.y;
    const cells = toEdge + BUS_TYPES[b.type].len + 0.6;
    const dur = Phaser.Math.Clamp(A.exitPerCell * cells, A.exitMin, A.exitMax);
    img.setDepth(30);
    Sound.exit();
    this.tweens.add({
      targets: img,
      x: img.x + dx * cells * this.cell,
      y: img.y + dy * cells * this.cell,
      alpha: 0.2,
      duration: dur,
      ease: 'Quad.easeIn',
      onComplete: () => img.destroy(),
    });
    // chega à vaga
    this.time.delayedCall(dur * 0.55, () => this.placeSlotBus(e.slot, e.bus, 0, true));
    this.drawDebug();
    return dur * 0.55 + A.toSlot;
  }

  animBoard(e) {
    const v = this.queueViews.shift();
    const sv = this.slotViews[e.slot];
    if (v && sv?.bus) {
      this.tweens.add({
        targets: v,
        x: sv.bus.x,
        y: sv.bus.y + this.slotBusL * 0.15,
        scale: 0.35,
        alpha: 0.2,
        duration: A.board,
        ease: 'Quad.easeIn',
        onComplete: () => v.destroy(),
      });
    } else v?.destroy();
    this.time.delayedCall(A.board, () => {
      if (!sv?.bus) return;
      sv.filled = e.seat;
      this.drawSlotFill(sv);
      sv.bus.setScale(1.06);
      this.tweens.add({ targets: sv.bus, scale: 1, duration: 90 });
      Sound.board(e.seat);
    });
    // a fila anda
    this.shiftQueue(e.passenger + 1);
  }

  animDepart(e) {
    const sv = this.slotViews[e.slot];
    if (!sv?.bus) return;
    const bus = sv.bus;
    const info = sv.info;
    sv.bus = null;
    sv.info = null;
    sv.fillG?.clear();
    Sound.depart();
    Haptics.tap();
    this.confetti.explode(14, bus.x, bus.y);
    this.tweens.add({ targets: info, alpha: 0, duration: 120, onComplete: () => info.destroy() });
    this.tweens.add({
      targets: bus,
      y: bus.y - this.zones.roadH * 1.4,
      duration: A.depart,
      ease: 'Back.easeIn',
      onComplete: () => bus.destroy(),
    });
  }

  floatText(x, y, text, color) {
    const tx = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${15 * this.u}px`, fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 4 * this.u })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: tx, y: y - 26 * this.u, alpha: 0, duration: 650, onComplete: () => tx.destroy() });
  }

  // ===========================================================================
  // Vagas do ponto
  // ===========================================================================
  layoutSlots() {
    const L = this.L;
    const u = this.u;
    const n = this.state.slots.length;
    const avail = L.usableW - 24 * u;
    this.slotW = Math.min(72 * u, avail / n);
    this.slotX0 = L.cx - (this.slotW * n) / 2 + this.slotW / 2;
    this.slotY = this.zones.yRoad + this.zones.roadH * 0.52;
    this.slotBusW = Math.round(Math.min(this.slotW * 0.6, 40 * u));
    this.slotBusL = Math.round(Math.min(this.zones.roadH * 0.66, this.slotBusW * 2.1));
  }

  makeSlotBay(i) {
    const u = this.u;
    const x = this.slotX0 + i * this.slotW;
    const g = this.add.graphics();
    const w = this.slotW - 8 * u;
    const h = this.slotBusL + 16 * u;
    const extra = i >= this.level.slots;
    g.lineStyle(2.5 * u, extra ? C.accent : 0xffffff, extra ? 0.9 : 0.45);
    g.strokeRoundedRect(x - w / 2, this.slotY - h / 2, w, h, 8 * u);
    if (extra) {
      g.fillStyle(C.accent, 0.15);
      g.fillRoundedRect(x - w / 2, this.slotY - h / 2, w, h, 8 * u);
    }
    return { i, x, y: this.slotY, g, bus: null, info: null, fillG: null, filled: 0, cap: 0, color: 0 };
  }

  placeSlotBus(i, busId, filled, animate) {
    const sv = this.slotViews[i];
    if (!sv) return;
    const b = this.level.buses[busId];
    const u = this.u;
    const key = busTexture(this, { type: b.type, color: b.color, w: this.slotBusW, len: this.slotBusL, symbol: this.symbols });
    const img = this.add.image(sv.x, sv.y, key).setDepth(20);
    const pad = Math.ceil(this.slotBusW * 0.08);
    img.setOrigin((pad + this.slotBusW / 2) / img.width, (pad + this.slotBusL / 2) / img.height);
    sv.bus = img;
    sv.cap = BUS_TYPES[b.type].cap;
    sv.color = b.color;
    sv.filled = filled;
    sv.fillG = this.add.graphics().setDepth(21);
    sv.info = this.add
      .text(sv.x, sv.y + this.slotBusL / 2 + 9 * u, '', { fontFamily: FONT, fontSize: `${12 * u}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#2b3040', strokeThickness: 3 * u })
      .setOrigin(0.5)
      .setDepth(22);
    this.drawSlotFill(sv);
    if (animate) {
      img.y = sv.y + this.zones.roadH * 0.7;
      img.alpha = 0;
      this.tweens.add({ targets: img, y: sv.y, alpha: 1, duration: A.toSlot, ease: 'Back.easeOut' });
    }
  }

  /** Lugares ocupados: pontinhos sobre o teto + texto "3/6". */
  drawSlotFill(sv) {
    const g = sv.fillG;
    if (!g || !sv.bus) return;
    g.clear();
    const u = this.u;
    const per = 2;
    const rows = Math.ceil(sv.cap / per);
    const top = sv.y - this.slotBusL * 0.18;
    const step = Math.min((this.slotBusL * 0.55) / rows, 7 * u);
    for (let k = 0; k < sv.cap; k++) {
      const cx = sv.x + (k % per === 0 ? -1 : 1) * this.slotBusW * 0.17;
      const cy = top + Math.floor(k / per) * step;
      g.fillStyle(k < sv.filled ? 0xffffff : 0x000000, k < sv.filled ? 1 : 0.28);
      g.fillCircle(cx, cy, Math.max(1.6 * u, step * 0.32));
    }
    sv.info.setText(`${sv.filled}/${sv.cap}`);
  }

  // ===========================================================================
  // Fila
  // ===========================================================================
  layoutQueue() {
    const u = this.u;
    const L = this.L;
    this.qSize = 44 * u;
    this.qGap = 30 * u;
    this.qX0 = L.left + 48 * u;
    this.qY = this.zones.yWalk + this.zones.walkH * 0.52;
    this.qVisible = Math.max(4, Math.min(CONFIG.game.queueVisible, Math.floor((L.right - 46 * u - this.qX0) / this.qGap) + 1));
  }

  makePassenger(idx, slotPos) {
    const lv = this.level;
    const color = lv.queue[idx];
    const c = this.add.container(this.qX0 + slotPos * this.qGap, this.qY).setDepth(15);
    const g = this.add.graphics();
    const skin = (idx * 7 + lv.id) % 5;
    drawPassenger(g, { color, s: this.qSize, skin, hair: (idx * 3) % 4, symbol: this.symbols });
    c.add(g);
    const pri = (lv.priority || []).find((p) => p.index === idx);
    if (pri) {
      const u = this.u;
      const badge = this.add.graphics();
      badge.fillStyle(C.accent, 1);
      badge.fillRoundedRect(-13 * u, -this.qSize * 0.72 - 9 * u, 26 * u, 18 * u, 9 * u);
      Icons.clock(badge, -6 * u, -this.qSize * 0.72, 11 * u, 0x1f2333);
      const txt = this.add
        .text(5 * u, -this.qSize * 0.72, '', { fontFamily: FONT, fontSize: `${12 * u}px`, fontStyle: 'bold', color: '#1f2333' })
        .setOrigin(0.5);
      c.add([badge, txt]);
      c.priority = { patience: pri.patience, txt, badge };
    }
    c.idx = idx;
    return c;
  }

  renderQueue(first) {
    const lv = this.level;
    for (const v of this.queueViews) v.destroy();
    this.queueViews = [];
    const end = Math.min(lv.queue.length, this.state.q + this.qVisible);
    for (let i = this.state.q; i < end; i++) {
      const v = this.makePassenger(i, i - this.state.q);
      this.queueViews.push(v);
      if (first) {
        v.setAlpha(0);
        this.tweens.add({ targets: v, alpha: 1, duration: 200, delay: (i - this.state.q) * 30 });
      }
    }
    this.moreText = this.add
      .text(this.L.right - 8 * this.u, this.qY - this.qSize * 0.05, '', {
        fontFamily: FONT,
        fontSize: `${14 * this.u}px`,
        fontStyle: 'bold',
        color: C.textDark,
      })
      .setOrigin(1, 0.5)
      .setDepth(16);
    this.refreshQueueExtras();
  }

  /** Depois de um embarque: a fila anda uma posição e entra um novo no fim. */
  shiftQueue(nextQ) {
    this.queueViews.forEach((v, k) => this.tweens.add({ targets: v, x: this.qX0 + k * this.qGap, duration: 120, ease: 'Sine.easeOut' }));
    const lastIdx = nextQ + this.queueViews.length;
    if (this.queueViews.length < this.qVisible && lastIdx < this.level.queue.length) {
      const v = this.makePassenger(lastIdx, this.queueViews.length + 1);
      v.setAlpha(0);
      this.tweens.add({ targets: v, x: this.qX0 + this.queueViews.length * this.qGap, alpha: 1, duration: 160 });
      this.queueViews.push(v);
    }
    this.refreshQueueExtras(nextQ);
  }

  refreshQueueExtras(q = this.state.q) {
    const rest = this.level.queue.length - q - this.queueViews.length;
    this.moreText?.setText(rest > 0 ? t('game.queueMore', { n: rest }) : '');
    // paciência dos prioritários
    for (const v of this.queueViews) {
      if (!v.priority) continue;
      const left = v.priority.patience - this.state.moves;
      v.priority.txt.setText(String(Math.max(0, left)));
      v.priority.txt.setColor(left <= 2 ? '#c0141f' : '#1f2333');
    }
  }

  // ===========================================================================
  // HUD
  // ===========================================================================
  buildTopBar(L, u, pad) {
    const y = this.zones.yTop + this.zones.topH / 2;
    const sz = 46 * u;
    new Button(this, L.left + pad + sz / 2, y, '', { width: sz, height: sz, color: C.buttonSecondary, radius: 14 * u, icon: 'home', iconSize: 22 * u }, () => goTo(this, 'Menu')).setDepth(50);
    new Button(this, L.right - pad - sz / 2, y, '', { width: sz, height: sz, color: C.buttonSecondary, radius: 14 * u, icon: 'restart', iconSize: 22 * u }, () => this.restart()).setDepth(50);
    const title = this.add
      .text(L.cx, y - 9 * u, t('game.level', { n: this.levelId }), { fontFamily: FONT, fontSize: `${22 * u}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#2b3a55', strokeThickness: 5 * u })
      .setOrigin(0.5)
      .setDepth(50);
    if (this.level.challenge) {
      const bg = this.add.graphics().setDepth(50);
      const bt = this.add.text(title.x + title.width / 2 + 8 * u, y - 9 * u, t('game.challenge'), { fontFamily: FONT, fontSize: `${10 * u}px`, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(51);
      bg.fillStyle(C.challenge, 1);
      bg.fillRoundedRect(bt.x - 5 * u, bt.y - 8 * u, bt.width + 10 * u, 16 * u, 8 * u);
    }
    this.movesText = this.add
      .text(L.cx, y + 14 * u, '', { fontFamily: FONT, fontSize: `${13 * u}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#2b3a55', strokeThickness: 4 * u })
      .setOrigin(0.5)
      .setDepth(50);
  }

  buildBottomBar(L, u, pad) {
    const y = this.zones.yBottom + this.zones.bottomH / 2;
    const w = (L.usableW - pad * 2 - 16 * u) / 3;
    const h = 58 * u;
    const opts = (icon, color) => ({ width: w, height: h, fontSize: 16 * u, radius: 18 * u, icon, iconSize: 22 * u, color });
    this.undoBtn = new Button(this, L.cx - w - 8 * u, y, t('game.undo'), opts('undo', C.button), () => this.onUndo()).setDepth(50);
    this.hintBtn = new Button(this, L.cx, y, t('game.hint'), { ...opts('bulb', C.buttonAd), badge: '▶' }, () => this.onHint()).setDepth(50);
    this.slotBtn = new Button(this, L.cx + w + 8 * u, y, t('game.slot'), { ...opts('slotPlus', C.buttonAd), badge: '▶' }, () => this.onSlot()).setDepth(50);
  }

  refreshHud() {
    this.movesText?.setText(t('game.moves', { n: this.state.moves }));
    if (this.undoBtn) {
      const free = this.undos > 0;
      this.undoBtn.setOpts({ badge: free ? this.undos : '▶', color: free ? C.button : C.buttonAd });
      this.undoBtn.setEnabled(this.history.length > 0);
    }
    this.slotBtn?.setEnabled(this.extraSlots < CONFIG.game.maxExtraSlotsPerLevel);
    this.refreshQueueExtras();
  }

  // ===========================================================================
  // Dicas (tutorial automático e booster)
  // ===========================================================================
  autoHint() {
    if (!this.tutorial || this.state.status !== 'playing' || this.modalOpen) return;
    const id = nextMove(this.level, this.state);
    if (id != null) this.showHint(id);
  }

  showHint(id) {
    this.clearHint();
    const img = this.busViews.get(id);
    if (!img) return;
    this.hintBus = id;
    const u = this.u;
    const b = this.level.buses[id];
    const c = this.busCenter(b);
    const g = this.hintG;
    const vertical = b.dir === 'up' || b.dir === 'down';
    const w = (vertical ? 1 : BUS_TYPES[b.type].len) * this.cell;
    const h = (vertical ? BUS_TYPES[b.type].len : 1) * this.cell;
    g.lineStyle(4 * u, 0xffffff, 1);
    g.strokeRoundedRect(c.x - w / 2 + 2 * u, c.y - h / 2 + 2 * u, w - 4 * u, h - 4 * u, 12 * u);
    g.setAlpha(1);
    this.hintTween = this.tweens.add({ targets: g, alpha: 0.25, duration: 520, yoyo: true, repeat: -1 });
    // mãozinha
    const hand = this.add.container(c.x + this.cell * 0.25, c.y + this.cell * 0.3).setDepth(45);
    const hg = this.add.graphics();
    hg.fillStyle(0xffffff, 1);
    hg.lineStyle(2.5 * u, 0x2b3040, 1);
    hg.fillRoundedRect(-7 * u, -22 * u, 14 * u, 30 * u, 7 * u);
    hg.strokeRoundedRect(-7 * u, -22 * u, 14 * u, 30 * u, 7 * u);
    hg.fillRoundedRect(-12 * u, 0, 26 * u, 22 * u, 9 * u);
    hg.strokeRoundedRect(-12 * u, 0, 26 * u, 22 * u, 9 * u);
    hand.add(hg);
    this.tweens.add({ targets: hand, y: hand.y + 8 * u, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hand = hand;
  }

  clearHint() {
    this.hintTween?.stop();
    this.hintTween = null;
    this.hintG?.clear();
    this.hand?.destroy();
    this.hand = null;
    this.hintBus = null;
  }

  // ===========================================================================
  // Boosters
  // ===========================================================================
  /** Pergunta antes de abrir um anúncio recompensado; a recompensa só vem no callback. */
  offerRewarded(question, grant) {
    this.modalOpen = true;
    modal({
      title: question,
      buttons: [
        {
          label: t('boosters.watch'),
          kind: 'ad',
          onClick: async (close) => {
            close();
            await AdManager.showRewarded(() => grant());
            this.modalOpen = false;
          },
        },
        { label: t('boosters.cancel'), kind: 'secondary', onClick: (close) => close() },
      ],
      onClose: () => this.time.delayedCall(10, () => (this.modalOpen = false)),
    });
  }

  onUndo() {
    if (this.busy) return;
    if (!this.history.length) return toast(t('game.nothingToUndo'));
    if (this.undos > 0) {
      this.undos--;
      this.doUndo();
    } else
      this.offerRewarded(t('boosters.undoAd'), () => {
        toast(t('game.undoGot'));
        this.doUndo();
      });
  }

  doUndo() {
    if (!this.history.length) return;
    let prev = this.history.pop();
    // mantém a vaga extra já ganha
    while (prev.slots.length < this.state.slots.length) prev = addSlot(this.level, prev);
    this.state = prev;
    this.ended = false;
    Sound.button();
    this.build(false);
  }

  onHint() {
    if (this.busy || this.state.status !== 'playing') return;
    const id = nextMove(this.level, this.state);
    // sem saída: avisa ANTES de oferecer anúncio (não cobra por uma dica inútil)
    if (id == null) return toast(t('game.noMove'), 3000);
    this.offerRewarded(t('boosters.hintAd'), () => this.showHint(id));
  }

  onSlot() {
    if (this.busy) return;
    if (this.extraSlots >= CONFIG.game.maxExtraSlotsPerLevel) return toast(t('game.slotMax'));
    this.offerRewarded(t('boosters.slotAd'), () => this.grantSlot());
  }

  grantSlot() {
    if (this.extraSlots >= CONFIG.game.maxExtraSlotsPerLevel) return;
    this.extraSlots++;
    this.state = addSlot(this.level, this.state);
    this.history = this.history.map((s) => addSlot(this.level, s));
    this.ended = false;
    toast(t('game.slotAdded'));
    Sound.reward();
    this.build(false);
  }

  restart() {
    if (this._leaving) return;
    goTo(this, 'Game', { level: this.levelId });
  }

  // ===========================================================================
  // Fim de fase
  // ===========================================================================
  showEnd() {
    if (this.modalOpen || !this.scene.isActive()) return;
    if (this.state.status === 'won') this.showWin();
    else if (this.state.status === 'lost') this.showLose();
  }

  showWin() {
    this.modalOpen = true;
    Sound.win();
    Haptics.success();
    this.confetti.explode(60, this.L.cx, this.zones.yRoad);
    Progress.complete(this.levelId);
    AdManager.registerWin(this.levelId);
    const last = this.levelId >= LEVEL_COUNT;
    const go = async (close, target) => {
      close();
      // intersticial: só aqui, ao sair da tela de vitória, e se as regras permitirem
      await AdManager.maybeShowInterstitial(this.levelId);
      this.modalOpen = false;
      if (target === 'next') goTo(this, 'Game', { level: this.levelId + 1 });
      else goTo(this, target);
    };
    const buttons = [];
    if (!last) buttons.push({ label: t('win.next'), kind: 'ok', onClick: (c) => go(c, 'next') });
    buttons.push({ label: t('win.levels'), kind: 'secondary', onClick: (c) => go(c, 'Levels') });
    modal({
      tone: 'win',
      badge: this.level.challenge ? t('game.challenge') : null,
      title: last ? t('win.lastLevel') : this.level.challenge ? t('win.titleChallenge') : t('win.title'),
      text: `${t('game.level', { n: this.levelId })} · ${t('win.moves', { n: this.state.moves })}`,
      buttons,
      closable: false,
    });
  }

  showLose() {
    this.modalOpen = true;
    Sound.lose();
    Haptics.collision();
    const slots = this.state.reason === 'slots';
    const buttons = [];
    if (this.history.length) {
      const free = this.undos > 0;
      buttons.push({
        label: free ? t('lose.undo') : t('lose.undoAd'),
        kind: free ? '' : 'ad',
        onClick: async (close) => {
          close();
          if (free) {
            this.undos--;
            this.modalOpen = false;
            this.doUndo();
          } else {
            const ok = await AdManager.showRewarded(() => {
              this.modalOpen = false;
              this.doUndo();
            });
            if (!ok) {
              this.modalOpen = false;
              this.showLose();
            }
          }
        },
      });
    }
    if (slots && this.extraSlots < CONFIG.game.maxExtraSlotsPerLevel) {
      buttons.push({
        label: t('lose.slotAd'),
        kind: 'ad',
        onClick: async (close) => {
          close();
          const ok = await AdManager.showRewarded(() => {
            this.modalOpen = false;
            this.grantSlot();
          });
          if (!ok) {
            this.modalOpen = false;
            this.showLose();
          }
        },
      });
    }
    buttons.push({ label: t('lose.restart'), kind: 'ok', onClick: (c) => (c(), (this.modalOpen = false), this.restart()) });
    buttons.push({ label: t('lose.home'), kind: 'secondary', onClick: (c) => (c(), (this.modalOpen = false), goTo(this, 'Menu')) });
    modal({
      tone: 'lose',
      title: slots ? t('lose.titleSlots') : t('lose.titlePatience'),
      text: slots ? t('lose.infoSlots') : t('lose.infoPatience'),
      buttons,
      closable: false,
    });
  }

  showChallengeIntro() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    const next = this.levelId + 1;
    modal({
      tone: 'challenge',
      badge: t('game.challenge'),
      title: t('game.challengeIntro'),
      text: t('game.challengeInfo'),
      buttons: [
        { label: t('game.play'), kind: 'ok', onClick: (c) => c() },
        {
          label: t('game.skip'),
          kind: 'secondary',
          onClick: (c) => {
            c();
            Progress.skip(this.levelId);
            toast(t('game.skipped'));
            goTo(this, 'Game', { level: Math.min(next, LEVEL_COUNT) });
          },
        },
      ],
      onClose: () => (this.modalOpen = false),
    });
  }

  // ---------------------------------------------------------------------------
  // Debug: ordem de solução nos ônibus
  // ---------------------------------------------------------------------------
  drawDebug() {
    this.debugTexts?.forEach((x) => x.destroy());
    this.debugTexts = [];
    if (!Debug.showSolution) return;
    const order = this.level.solution;
    order.forEach((id, k) => {
      if (!this.state.inLot[id]) return;
      const c = this.busCenter(this.level.buses[id]);
      this.debugTexts.push(
        this.add
          .text(c.x, c.y, String(k + 1), { fontFamily: FONT, fontSize: `${16 * this.u}px`, fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 * this.u })
          .setOrigin(0.5)
          .setDepth(35),
      );
    });
  }
}

