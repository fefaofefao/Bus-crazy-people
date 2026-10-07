// Tela de partida: cidade, ponto de ônibus (vagas), fila de passageiros e estacionamento.
//
// As regras ficam em src/core/engine.js. Esta cena só desenha o estado,
// recebe toques e anima a lista de eventos que o motor devolve a cada jogada.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DIRS, BUS_TYPES, busCells, COLORS } from '../core/rules.js';
import { SYMBOL_CHARS } from '../ui/art.js';
import { initialState, tap, addSlot, occupancy, scanPath, isLocked, coneActive, OCC_CONE, OCC_GARAGE, BLOCK_LOCK } from '../core/engine.js';
import { nextMove } from '../core/solver.js';
import { starsFor } from '../core/stars.js';
import { Achievements } from '../services/Achievements.js';
import { getLevel, LEVEL_COUNT } from '../levels/index.js';
import { getLayout, FONT, DISPLAY } from '../ui/layout.js';
import { drawCalcadao } from '../ui/scenery.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { Icons } from '../ui/icons.js';
import { busTexture, drawPassenger, shade, pruneBusTextures } from '../ui/art.js';
import { toast, modal, openHelp } from '../ui/dom.js';
import { Storage } from '../services/Storage.js';
import { Progress } from '../services/Progress.js';
import { Sound } from '../services/Sound.js';
import { Haptics } from '../services/Haptics.js';
import { Music } from '../services/Music.js';
import { AdManager } from '../services/AdManager.js';
import { Debug } from '../debug.js';
import { t } from '../i18n/index.js';

const C = CONFIG.colors;
const A = CONFIG.anim;
const ROT = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

export class GameScene extends Phaser.Scene {
  /** derrotas por fase nesta sessão (para a dica do Tião) */
  static losses = {};
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelId = Phaser.Math.Clamp(data?.level ?? Progress.nextToPlay() ?? 1, 1, LEVEL_COUNT);
  }

  create() {
    Music.play('game');
    this.level = getLevel(this.levelId);
    this.state = initialState(this.level);
    this.history = [];
    this.undos = CONFIG.game.freeUndosPerLevel;
    this.errors = 0; // batidas + ajudas (desfazer, dica, vaga extra) – define as estrelas
    this.maxCombo = 0;
    this.extraSlots = 0;
    this.busy = false;
    this.modalOpen = false;
    this.ended = false;
    this.hintBus = null;
    this.tutorial = !!this.level.tutorial;
    this.cameras.main.setBackgroundColor(C.background);
    this.build(true);
    fadeIn(this);

    if (this.level.challenge && !Progress.isCompleted(this.levelId)) this.showChallengeIntro();
    else this.showMechanicIntro();

    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointerup', (p) => this.onPointerUp(p));
    this.input.on('pointerupoutside', () => this.cancelPress());
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
    this.revealed = this.revealed ?? new Set();
    for (const b of lv.buses) if (b.hidden && this.isPathClear(b)) this.revealed.add(b.id);
    for (const b of lv.buses) {
      if (this.state.inLot[b.id] !== 1) continue;
      const v = this.makeLotBus(b);
      if (first) {
        v.setScale(0.4).setAlpha(0);
        this.tweens.add({ targets: v, scale: 1, alpha: 1, duration: A.appear, delay: i++ * A.appearStagger, ease: 'Back.easeOut' });
      }
    }
    this.mechG = this.add.graphics().setDepth(13);
    this.mechTexts = [];
    this.drawMechanics();
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
    this.dust = this.add.particles(0, 0, 'dot', {
      speed: { min: 20 * u, max: 70 * u },
      lifespan: { min: 250, max: 450 },
      scale: { start: 0.25 * u, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xd8d2c4,
      emitting: false,
    });
    this.dust.setDepth(29);

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
    // céu de fim de tarde
    g.fillGradientStyle(C.sunsetTop, C.sunsetTop, C.sunsetMid, C.sunsetMid, 1);
    g.fillRect(0, 0, L.W, y1);
    // Pão de Açúcar ao fundo
    g.fillStyle(C.hill, 0.55);
    const hill = (cx, w, h) => {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const tt = i / 20;
        pts.push({ x: cx - w / 2 + w * tt, y: y1 - Math.pow(Math.sin(Math.PI * tt), 0.6) * h });
      }
      g.fillPoints(pts, true);
    };
    hill(L.W * 0.82, 120 * u, 50 * u);
    hill(L.W * 0.66, 70 * u, 28 * u);
    // casario colorido com contorno (estilo adesivo)
    const houses = [0xffb347, 0x13b5a6, 0xff4f8b, 0xffd166, 0x7d8cff, 0x5fd3ff, 0xff8a4c, 0x8fdc6a];
    let x = -6 * u;
    let k = 0;
    while (x < L.W) {
      const w = (34 + ((k * 37) % 26)) * u;
      const h = (18 + ((k * 53) % 20)) * u;
      g.fillStyle(C.ink, 1);
      g.fillRect(x, y1 - h - 2 * u, w, h + 2 * u);
      g.fillStyle(houses[k % houses.length], 1);
      g.fillRect(x + 2 * u, y1 - h, w - 4 * u, h);
      g.fillStyle(C.ink, 0.6);
      for (let wy = y1 - h + 6 * u; wy < y1 - 8 * u; wy += 11 * u) for (let wx = x + 7 * u; wx < x + w - 10 * u; wx += 11 * u) g.fillRect(wx, wy, 5 * u, 6 * u);
      x += w - 2 * u;
      k++;
    }
  }

  drawRoad(L, u, y, h) {
    const g = this.add.graphics();
    g.fillStyle(C.road, 1);
    g.fillRect(0, y, L.W, h);
    g.fillStyle(C.ink, 1);
    g.fillRect(0, y, L.W, 3 * u);
    // meio-fio
    g.fillStyle(C.curb, 1);
    g.fillRect(0, y + h - 7 * u, L.W, 7 * u);
    g.fillStyle(C.ink, 1);
    g.fillRect(0, y + h - 8 * u, L.W, 2 * u);
    // faixa tracejada
    g.fillStyle(0xffffff, 0.5);
    for (let x = 0; x < L.W; x += 34 * u) g.fillRect(x, y + 10 * u, 18 * u, 3 * u);
  }

  drawSidewalk(L, u, y, h) {
    const g = this.add.graphics();
    drawCalcadao(g, 0, y, L.W, h, u);
    g.fillStyle(C.ink, 1);
    g.fillRect(0, y + h - 4 * u, L.W, 4 * u);
    // placa do ponto (à esquerda)
    const px = L.left + 16 * u;
    g.fillStyle(C.ink, 1);
    g.fillRect(px - 2.5 * u, y + 8 * u, 5 * u, h - 14 * u);
    g.fillRoundedRect(px - 13 * u, y + 2 * u, 26 * u, 25 * u, 6 * u);
    g.fillStyle(C.shelter, 1);
    g.fillRoundedRect(px - 10.5 * u, y + 4.5 * u, 21 * u, 20 * u, 4 * u);
    Icons.bus(g, px, y + 15 * u, 15 * u, 0xffffff);
  }

  drawLot(u) {
    const g = this.add.graphics();
    const lv = this.level;
    const m = 8 * u;
    const w = this.cell * lv.cols;
    const h = this.cell * lv.rows;
    // meio-fio com contorno e sombra dura
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(this.gx - m - 6 * u, this.gy - m - 6 * u + 7 * u, w + (m + 6 * u) * 2, h + (m + 6 * u) * 2, 18 * u);
    g.fillStyle(C.ink, 1);
    g.fillRoundedRect(this.gx - m - 6 * u, this.gy - m - 6 * u, w + (m + 6 * u) * 2, h + (m + 6 * u) * 2, 18 * u);
    g.fillStyle(C.curb, 1);
    g.fillRoundedRect(this.gx - m - 4 * u, this.gy - m - 4 * u, w + (m + 4 * u) * 2, h + (m + 4 * u) * 2, 16 * u);
    g.fillStyle(C.asphalt, 1);
    g.fillRoundedRect(this.gx - m, this.gy - m, w + m * 2, h + m * 2, 12 * u);
    // marcações das vagas do estacionamento
    g.lineStyle(Math.max(1, 1.5 * u), C.laneLine, 0.18);
    for (let y = 0; y < lv.rows; y++)
      for (let x = 0; x < lv.cols; x++) {
        const cx = this.cellX(x);
        const cy = this.cellY(y);
        const q = this.cell * 0.12;
        g.lineBetween(cx - q, cy, cx + q, cy);
        g.lineBetween(cx, cy - q, cx, cy + q);
      }
  }

  /** Dica do tutorial: balão com o Seu Tião. */
  drawTip(L, u, y, h) {
    const g = this.add.graphics();
    const w = L.usableW - 24 * u;
    const x0 = L.cx - w / 2;
    const bh = h - 6 * u;
    g.fillStyle(C.ink, 1);
    g.fillRoundedRect(x0 + 40 * u, y + 4 * u, w - 40 * u, bh, 14 * u);
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(x0 + 40 * u, y, w - 40 * u, bh, 14 * u);
    g.lineStyle(3 * u, C.ink, 1);
    g.strokeRoundedRect(x0 + 40 * u, y, w - 40 * u, bh, 14 * u);
    g.fillStyle(C.panel, 1);
    g.fillTriangle(x0 + 42 * u, y + bh * 0.35, x0 + 30 * u, y + bh * 0.55, x0 + 42 * u, y + bh * 0.7);
    if (this.textures.exists('tiao')) this.add.image(x0 + 20 * u, y + bh / 2, 'tiao').setDisplaySize(52 * u, 52 * u);
    this.add
      .text(x0 + 40 * u + (w - 40 * u) / 2, y + bh / 2, t(`tutorial.${this.level.tutorial.text}`), {
        fontFamily: FONT,
        fontSize: `${14 * u}px`,
        fontStyle: '600',
        color: C.textDark,
        align: 'center',
        wordWrap: { width: w - 64 * u },
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
    const hidden = b.hidden && !this.revealed.has(b.id);
    const key = busTexture(this, { type: b.type, color: b.color, w, len: L, symbol: this.symbols, hidden, pips: BUS_TYPES[b.type].cap });
    const c = this.busCenter(b);
    const img = this.add.image(c.x, c.y, key);
    // origem no centro da carroceria (a textura tem margem e sombra)
    const pad = Math.ceil(w * 0.08);
    img.setOrigin((pad + w / 2) / img.width, (pad + L / 2) / img.height);
    img.setRotation(ROT[b.dir]);
    img.setDepth(10);
    img.hiddenShown = hidden;
    this.busViews.set(b.id, img);
    return img;
  }

  isPathClear(b) {
    if (this.state.inLot[b.id] !== 1) return false;
    return scanPath(this.level, occupancy(this.level, this.state), b).blockerId === -1;
  }

  // ---------------------------------------------------------------------------
  // Mecânicas: terminais, obras (cones), cadeado/chave e ônibus cobertos
  // ---------------------------------------------------------------------------
  drawMechanics() {
    const g = this.mechG;
    if (!g) return;
    g.clear();
    this.mechTexts.forEach((x) => x.destroy());
    this.mechTexts = [];
    const lv = this.level;
    const u = this.u;
    const cs = this.cell;
    const label = (x, y, text, color = '#ffffff', size = 13) => {
      const tx = this.add
        .text(x, y, text, { fontFamily: FONT, fontSize: `${size * u}px`, fontStyle: 'bold', color, stroke: '#1f2333', strokeThickness: 3.5 * u })
        .setOrigin(0.5)
        .setDepth(14);
      this.mechTexts.push(tx);
    };
    // terminais
    for (const gar of lv.garages || []) {
      const x = this.cellX(gar.x);
      const y = this.cellY(gar.y);
      const r = cs * 0.44;
      g.fillStyle(0x000000, 0.25);
      g.fillRoundedRect(x - r + 2 * u, y - r + 3 * u, r * 2, r * 2, r * 0.3);
      g.fillStyle(0x2c3444, 1);
      g.fillRoundedRect(x - r, y - r, r * 2, r * 2, r * 0.3);
      g.fillStyle(C.shelter, 1);
      g.fillRoundedRect(x - r, y - r, r * 2, r * 0.5, { tl: r * 0.3, tr: r * 0.3, bl: 0, br: 0 });
      const { dx, dy } = DIRS[gar.dir];
      g.fillStyle(0xffffff, 0.9);
      const ax = x + dx * r * 0.35;
      const ay = y + dy * r * 0.35 + r * 0.1;
      g.fillTriangle(ax + dx * r * 0.35, ay + dy * r * 0.35, ax - dy * r * 0.3 - dx * r * 0.1, ay + dx * r * 0.3 - dy * r * 0.1, ax + dy * r * 0.3 - dx * r * 0.1, ay - dx * r * 0.3 - dy * r * 0.1);
      const waiting = lv.buses.filter((b) => b.garage === gar.id && this.state.inLot[b.id] === 2).length;
      label(x, y - r * 0.72, String(waiting), waiting ? '#ffe28a' : '#9aa3b5', 12);
    }
    // cones da obra
    for (const c of lv.cones || []) {
      if (!coneActive(c, this.state)) continue;
      const x = this.cellX(c.x);
      const y = this.cellY(c.y);
      const h = cs * 0.62;
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(x, y + h * 0.42, h * 0.8, h * 0.18);
      g.fillStyle(0xff7a1a, 1);
      g.fillTriangle(x, y - h * 0.5, x - h * 0.32, y + h * 0.36, x + h * 0.32, y + h * 0.36);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - h * 0.16, y - h * 0.05, h * 0.32, h * 0.12);
      g.fillStyle(0xff7a1a, 1);
      g.fillRoundedRect(x - h * 0.42, y + h * 0.32, h * 0.84, h * 0.12, h * 0.04);
      label(x + cs * 0.3, y - cs * 0.3, String(c.until - this.state.moves), '#ffd2a8', 12);
    }
    // cadeado (ônibus trancado) e chave (ônibus que destranca)
    for (const b of lv.buses) {
      if (this.state.inLot[b.id] !== 1 || !isLocked(lv, this.state, b)) continue;
      const c = this.busCenter(b);
      g.fillStyle(0x1f2333, 0.75);
      g.fillCircle(c.x, c.y, cs * 0.26);
      Icons.lock(g, c.x, c.y + cs * 0.02, cs * 0.36, C.gold);
      const key = lv.buses[b.lock];
      if (this.state.inLot[key.id] === 1) {
        const k = this.busCenter(key);
        g.fillStyle(0x1f2333, 0.75);
        g.fillCircle(k.x, k.y, cs * 0.24);
        Icons.key(g, k.x, k.y, cs * 0.34, C.gold);
      }
    }
  }

  /** Revela ônibus cobertos cujo caminho ficou livre (troca a textura com um giro). */
  revealHidden() {
    for (const b of this.level.buses) {
      if (!b.hidden || this.revealed.has(b.id) || !this.isPathClear(b)) continue;
      this.revealed.add(b.id);
      const img = this.busViews.get(b.id);
      if (!img) continue;
      this.tweens.add({
        targets: img,
        scaleX: 0,
        duration: 140,
        onComplete: () => {
          img.destroy();
          if (this.state.inLot[b.id] !== 1) return;
          const fresh = this.makeLotBus(b);
          fresh.setScale(0, 1);
          this.tweens.add({ targets: fresh, scaleX: 1, duration: 140 });
        },
      });
      Sound.reveal();
      this.floatText(img.x, img.y, '!', '#ffffff');
    }
  }

  /** Toque: converte a posição numa casa do estacionamento. */
  busAt(p) {
    const x = Math.floor((p.x - this.gx) / this.cell);
    const y = Math.floor((p.y - this.gy) / this.cell);
    if (x < 0 || y < 0 || x >= this.level.cols || y >= this.level.rows) return -1;
    return occupancy(this.level, this.state)[y * this.level.cols + x];
  }

  /** UX: o ônibus "afunda" ao encostar e só sai ao soltar o dedo em cima dele (evita toque errado). */
  onPointerDown(p) {
    if (this.modalOpen || this.ended || this._leaving) return;
    const id = this.busAt(p);
    if (id < 0) return;
    this.cancelPress();
    const img = this.busViews.get(id);
    if (!img) return;
    this.pressed = { id, img };
    img.setScale(0.94);
    img.setTint(0xfff0c8);
    Haptics.tap();
  }

  cancelPress() {
    if (!this.pressed) return;
    const { img } = this.pressed;
    if (img.active) {
      img.setScale(1);
      img.clearTint();
    }
    this.pressed = null;
  }

  onPointerUp(p) {
    const pr = this.pressed;
    this.cancelPress();
    if (!pr || this.modalOpen || this.ended || this._leaving) return;
    if (this.busAt(p) !== pr.id) return; // arrastou para fora: cancela
    // durante uma animação, guarda o toque e executa logo depois (resposta imediata)
    if (this.busy) this.queuedTap = pr.id;
    else this.play(pr.id);
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
      if (e.type === 'bump') {
        this.addError();
        tEnd = Math.max(tEnd, this.animBump(e));
      }
      else if (e.type === 'exit') tEnd = Math.max(tEnd, this.animExit(e));
      else if (e.type === 'board' || e.type === 'depart') boardEvents.push(e);
    }
    this.drawMechanics();
    for (const e of events) {
      if (e.type === 'spawn') this.time.delayedCall(tEnd * 0.6, () => this.animSpawn(e));
      if (e.type === 'unlock') {
        const v = this.busViews.get(e.bus);
        if (v) this.time.delayedCall(tEnd * 0.5, () => (this.floatText(v.x, v.y - this.cell * 0.3, t('game.unlocked'), '#ffe28a'), Sound.reward()));
      }
    }
    this.time.delayedCall(tEnd * 0.6 + 40, () => this.revealHidden());
    const departs = boardEvents.filter((e) => e.type === 'depart').length;
    this.maxCombo = Math.max(this.maxCombo, departs);
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
    // combo: vários ônibus partindo com um toque só
    if (departs >= 2)
      this.time.delayedCall(t0, () => {
        this.floatText(this.L.cx, this.zones.yRoad + this.zones.roadH * 0.5, t('game.combo', { n: departs }), '#ffe28a', 26);
        Sound.combo(departs);
        this.confetti.explode(20 + departs * 8, this.L.cx, this.zones.yRoad + this.zones.roadH * 0.5);
      });
    this.time.delayedCall(tEnd + 20, () => {
      this.busy = false;
      this.refreshHud();
      if (this.state.status !== 'playing') {
        this.queuedTap = null;
        this.ended = true;
        this.time.delayedCall(A.endDelay, () => this.showEnd());
        return;
      }
      this.warnLastSlot();
      const q = this.queuedTap;
      this.queuedTap = null;
      if (q != null && this.state.inLot[q] === 1) this.play(q);
      else this.autoHint();
    });
  }

  animBump(e) {
    const b = this.level.buses[e.bus];
    const img = this.busViews.get(e.bus);
    const { dx, dy } = DIRS[b.dir];
    const dist = (e.blocker === BLOCK_LOCK ? 0.08 : e.dist + 0.22) * this.cell;
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
        const blk = this.busViews.get(e.blocker === BLOCK_LOCK ? e.key : e.blocker);
        if (blk) {
          const bx = blk.x;
          const by = blk.y;
          this.tweens.add({ targets: blk, x: bx + dx * this.cell * 0.08, y: by + dy * this.cell * 0.08, duration: 60, yoyo: true });
          blk.setTint(0xffb0b0);
          this.time.delayedCall(260, () => blk.active && blk.clearTint());
        }
        const msg = e.blocker === BLOCK_LOCK ? t('game.locked') : e.blocker === OCC_CONE ? t('game.cone') : t('game.blocked');
        this.floatText(img.x, img.y - this.cell * 0.4, msg, '#ffdddd');
        void OCC_GARAGE;
        this.tweens.add({ targets: img, x: ox, y: oy, duration: A.bumpBack, ease: 'Quad.easeOut' });
      },
    });
    return fwd + A.bumpBack;
  }

  animSpawn(e) {
    const b = this.level.buses[e.bus];
    const gar = this.level.garages[b.garage];
    const v = this.makeLotBus(b);
    const tx = v.x;
    const ty = v.y;
    v.setPosition(this.cellX(gar.x), this.cellY(gar.y)).setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: v, x: tx, y: ty, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    Sound.spawn();
    this.drawMechanics();
    this.revealHidden();
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
    this.dust?.explode(8, img.x - dx * this.cell * 0.6, img.y - dy * this.cell * 0.6);
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
      this.tweens.add({ targets: v, angle: v.x < sv.bus.x ? 12 : -12, duration: A.board / 2, yoyo: true });
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

  floatText(x, y, text, color, size = 15) {
    const tx = this.add
      .text(x, y, text, { fontFamily: DISPLAY, fontSize: `${size * this.u}px`, color, stroke: C.inkCss, strokeThickness: 5 * this.u })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: tx, y: y - 26 * this.u, alpha: 0, duration: 650, onComplete: () => tx.destroy() });
  }

  /** UX: quando só resta uma vaga, ela pisca em rosa e o Tião avisa (uma vez por situação). */
  warnLastSlot() {
    const free = this.state.slots.filter((x) => !x).length;
    if (free !== 1) {
      this.lastSlotWarned = false;
      return;
    }
    if (this.lastSlotWarned) return;
    this.lastSlotWarned = true;
    const i = this.state.slots.indexOf(null);
    const sv = this.slotViews[i];
    if (!sv) return;
    const g = this.add.graphics().setDepth(19);
    const w = this.slotW - 8 * this.u;
    const h = this.slotBusL + 16 * this.u;
    g.fillStyle(C.challenge, 0.35);
    g.fillRoundedRect(sv.x - w / 2, sv.y - h / 2, w, h, 8 * this.u);
    this.tweens.add({ targets: g, alpha: 0, duration: 380, yoyo: true, repeat: 3, onComplete: () => g.destroy() });
    this.floatText(sv.x, sv.y, t('game.lastSlot'), '#ffd2e0', 16);
    Haptics.collision();
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
    // baia do ponto: asfalto mais escuro, borda amarela tracejada e "ÔNIBUS" pintado no chão
    g.fillStyle(C.ink, 0.28);
    g.fillRoundedRect(x - w / 2, this.slotY - h / 2, w, h, 8 * u);
    g.fillStyle(extra ? C.challenge : C.laneLine, extra ? 1 : 0.9);
    const dash = 7 * u;
    for (let yy = this.slotY - h / 2; yy < this.slotY + h / 2 - dash / 2; yy += dash * 2) {
      g.fillRect(x - w / 2, yy, 3 * u, dash);
      g.fillRect(x + w / 2 - 3 * u, yy, 3 * u, dash);
    }
    g.fillRect(x - w / 2, this.slotY + h / 2 - 3 * u, w, 3 * u);
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
      .text(sv.x, sv.y + this.slotBusL / 2 + 9 * u, '', { fontFamily: DISPLAY, fontSize: `${13 * u}px`, color: '#ffffff', stroke: C.inkCss, strokeThickness: 4 * u })
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
      Icons.clock(badge, -6 * u, -this.qSize * 0.72, 11 * u, 0xffffff);
      const txt = this.add
        .text(5 * u, -this.qSize * 0.72, '', { fontFamily: FONT, fontSize: `${12 * u}px`, fontStyle: 'bold', color: '#1f2333' })
        .setOrigin(0.5);
      c.add([badge, txt]);
      c.priority = { patience: pri.patience, txt, badge };
    }
    c.idx = idx;
    // balanço leve de quem espera na fila
    const bob = this.tweens.add({ targets: g, y: -2.5 * this.u, duration: 520 + (idx % 5) * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (idx % 7) * 90 });
    c.once('destroy', () => bob.remove());
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
    const moreZone = this.add.zone(this.L.right - 30 * this.u, this.qY, 60 * this.u, this.qSize * 1.4).setInteractive().setDepth(17);
    moreZone.on('pointerup', () => this.showQueue());
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
    new Button(this, L.left + pad + sz / 2, y, '', { width: sz, height: sz, color: C.buttonSecondary, radius: 14 * u, icon: 'pause', iconSize: 22 * u }, () => this.showPause()).setDepth(50);
    new Button(this, L.right - pad - sz / 2, y, '', { width: sz, height: sz, color: C.buttonSecondary, radius: 14 * u, icon: 'restart', iconSize: 22 * u }, () => this.restart()).setDepth(50);
    const title = this.add
      .text(L.cx, y - 12 * u, t('game.level', { n: this.levelId }), { fontFamily: DISPLAY, fontSize: `${24 * u}px`, color: '#ffffff', stroke: C.inkCss, strokeThickness: 6 * u })
      .setOrigin(0.5)
      .setDepth(50);
    if (this.level.challenge) {
      const bg = this.add.graphics().setDepth(50);
      const bt = this.add.text(title.x + title.width / 2 + 8 * u, y - 12 * u, t('game.challenge'), { fontFamily: DISPLAY, fontSize: `${11 * u}px`, color: '#ffffff' }).setOrigin(0, 0.5).setDepth(51);
      bg.fillStyle(C.challenge, 1);
      bg.fillRoundedRect(bt.x - 5 * u, bt.y - 8 * u, bt.width + 10 * u, 16 * u, 8 * u);
    }
    this.movesText = this.add
      .text(L.cx + 10 * u, y + 17 * u, '', { fontFamily: DISPLAY, fontSize: `${13 * u}px`, color: '#ffffff', stroke: C.inkCss, strokeThickness: 4 * u })
      .setOrigin(0, 0.5)
      .setDepth(50);
    // estrelas da tentativa atual (caem a cada erro)
    this.starsG = this.add.graphics().setDepth(50);
    this.starsPos = { x: L.cx - 4 * u, y: y + 16 * u, s: 14 * u };
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
    if (this.starsG) {
      const { x, y, s: sz } = this.starsPos;
      const n = starsFor(this.errors);
      this.starsG.clear();
      for (let k = 0; k < 3; k++) {
        const sx = x - (2 - k) * sz * 1.05 - sz * 0.5;
        Icons.star(this.starsG, sx + 1 * this.u, y + 1.5 * this.u, sz, 0x1f2a44);
        Icons.star(this.starsG, sx, y, sz, k < n ? C.gold : 0x55627d);
      }
    }
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

  /** Erro: batida ou ajuda usada. As estrelas da tentativa caem com um tremor. */
  addError() {
    const before = starsFor(this.errors);
    this.errors++;
    if (starsFor(this.errors) < before && this.starsG) {
      this.tweens.add({ targets: this.starsG, x: 3 * this.u, duration: 50, yoyo: true, repeat: 2, onComplete: () => this.starsG.setX(0) });
    }
    this.refreshHud();
  }

  doUndo() {
    if (!this.history.length) return;
    this.addError();
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
    this.offerRewarded(t('boosters.hintAd'), () => {
      this.addError();
      this.showHint(id);
    });
  }

  onSlot() {
    if (this.busy) return;
    if (this.extraSlots >= CONFIG.game.maxExtraSlotsPerLevel) return toast(t('game.slotMax'));
    this.offerRewarded(t('boosters.slotAd'), () => this.grantSlot());
  }

  grantSlot() {
    if (this.extraSlots >= CONFIG.game.maxExtraSlotsPerLevel) return;
    this.extraSlots++;
    this.addError();
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
    const stars = starsFor(this.errors);
    const res = Achievements.recordWin({
      level: this.levelId,
      stars,
      maxCombo: this.maxCombo,
      hurried: (this.level.priority || []).length,
      mechanics: this.level.mechanics || [],
    });
    if (stars === 3) Sound.combo(3);
    const last = this.levelId >= LEVEL_COUNT;
    const go = async (close, target) => {
      close();
      // intersticial: só aqui, ao sair da tela de vitória, e se as regras permitirem
      await AdManager.maybeShowInterstitial(this.levelId);
      this.modalOpen = false;
      if (target === 'next') goTo(this, 'Game', { level: this.levelId + 1 });
      else if (target === 'retry') goTo(this, 'Game', { level: this.levelId });
      else goTo(this, target);
    };
    const buttons = [];
    if (!last) buttons.push({ label: t('win.next'), kind: 'ok', onClick: (c) => go(c, 'next') });
    if (stars < 3) buttons.push({ label: t('win.retry3'), kind: '', onClick: (c) => go(c, 'retry') });
    buttons.push({ label: t('win.levels'), kind: 'secondary', onClick: (c) => go(c, 'Levels') });
    const lines = [
      `${t('game.level', { n: this.levelId })} · ${t('win.moves', { n: this.state.moves })}`,
      this.errors ? t('win.errors', { n: this.errors }) : t('win.perfect'),
    ];
    if (res.newBest) lines.push(t('win.newBest'));
    for (const a of res.unlocked) lines.push(`🏆 ${t('achievements.unlocked')}: ${t(`achievements.${a.id}.title`)}`);
    modal({
      tone: 'win',
      badge: this.level.challenge ? t('game.challenge') : null,
      stars,
      title: last ? t('win.lastLevel') : this.level.challenge ? t('win.titleChallenge') : t('win.title'),
      text: lines.join('\n'),
      buttons,
      closable: false,
    });
  }

  showLose() {
    this.modalOpen = true;
    Sound.lose();
    Haptics.collision();
    const slots = this.state.reason === 'slots';
    const stuck = this.state.reason === 'stuck';
    GameScene.losses[this.levelId] = (GameScene.losses[this.levelId] ?? 0) + 1;
    const tips = t('tips.list');
    const tip = GameScene.losses[this.levelId] >= 2 ? `\n\n${t('tips.prefix')} ${tips[(GameScene.losses[this.levelId] + this.levelId) % tips.length]}` : '';
    const need = slots ? `\n${t('lose.needColor', { color: t('colors')[this.level.queue[this.state.q]] })}` : '';
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
      mascot: true,
      title: slots ? t('lose.titleSlots') : stuck ? t('lose.titleStuck') : t('lose.titlePatience'),
      text: (slots ? t('lose.infoSlots') : stuck ? t('lose.infoStuck') : t('lose.infoPatience')) + need + tip,
      buttons,
      closable: false,
    });
  }

  /** UX: pausa em vez de sair direto (evita perder a partida sem querer). */
  showPause() {
    if (this.modalOpen || this._leaving) return;
    this.modalOpen = true;
    const st = () => Storage.data.settings;
    const onOff = (on) => (on ? '✓' : '✕');
    const m = modal({
      title: t('pause.title'),
      text: `${t('game.level', { n: this.levelId })} · ${t('game.moves', { n: this.state.moves })}`,
      buttons: [
        { label: t('pause.resume'), kind: 'ok', onClick: (c) => c() },
        { label: t('pause.restart'), kind: '', onClick: (c) => (c(), this.restart()) },
        { label: `${t('pause.sound')} ${onOff(st().sound)}`, kind: 'secondary', onClick: (c, b) => {
          Storage.update((d) => (d.settings.sound = !d.settings.sound));
          b.lastChild.textContent = `${t('pause.sound')} ${onOff(st().sound)}`;
        } },
        { label: `${t('pause.music')} ${onOff(st().music)}`, kind: 'secondary', onClick: (c, b) => {
          Storage.update((d) => (d.settings.music = !d.settings.music));
          Music.refresh();
          b.lastChild.textContent = `${t('pause.music')} ${onOff(st().music)}`;
        } },
        { label: t('settings.howToPlay'), kind: 'secondary', onClick: () => openHelp() },
        { label: t('pause.quit'), kind: 'danger', onClick: (c) => (c(), goTo(this, 'Menu')) },
      ],
      onClose: () => (this.modalOpen = false),
    });
    void m;
  }

  /** UX: ver a fila inteira (planejar as próximas cores). */
  showQueue() {
    if (this.modalOpen || this.busy) return;
    this.modalOpen = true;
    const lv = this.level;
    const rest = lv.queue.slice(this.state.q);
    modal({
      title: t('queue.title', { n: rest.length }),
      html: rest
        .map((c, i) => {
          const pri = (lv.priority || []).some((p) => p.index === this.state.q + i);
          return `<span class="fds-qdot" style="background:${'#' + COLORS[c].hex.toString(16).padStart(6, '0')}">${this.symbols ? SYMBOL_CHARS[COLORS[c].symbol] : ''}${pri ? '<b>⏱</b>' : ''}</span>`;
        })
        .join(''),
      buttons: [{ label: t('common.close'), kind: 'ok', onClick: (c) => c() }],
      onClose: () => (this.modalOpen = false),
    });
  }

  /** Primeira vez com uma mecânica: cartão explicando (uma por fase). */
  showMechanicIntro() {
    const next = (this.level.mechanics || []).find((m) => !Storage.data.seen.includes(m));
    if (!next || this.modalOpen) return;
    this.modalOpen = true;
    Storage.update((d) => d.seen.push(next));
    modal({
      tone: 'challenge',
      mascot: true,
      badge: t('mechanics.new'),
      title: t(`mechanics.${next}.title`),
      text: t(`mechanics.${next}.text`),
      buttons: [{ label: t('mechanics.ok'), kind: 'ok', onClick: (c) => c() }],
      onClose: () => {
        this.modalOpen = false;
        this.highlightMechanic(next);
      },
    });
  }

  /** Destaca na tela onde está a mecânica recém-apresentada. */
  highlightMechanic(kind) {
    const lv = this.level;
    let pos = null;
    if (kind === 'cones' && lv.cones?.length) pos = { x: this.cellX(lv.cones[0].x), y: this.cellY(lv.cones[0].y) };
    if (kind === 'garage' && lv.garages?.length) pos = { x: this.cellX(lv.garages[0].x), y: this.cellY(lv.garages[0].y) };
    const bus = kind === 'lock' ? lv.buses.find((b) => b.lock != null) : kind === 'hidden' ? lv.buses.find((b) => b.hidden && this.state.inLot[b.id] === 1) : null;
    if (bus) pos = this.busCenter(bus);
    if (!pos) return;
    const ring = this.add.graphics().setDepth(46);
    ring.lineStyle(4 * this.u, 0xffe28a, 1);
    ring.strokeCircle(pos.x, pos.y, this.cell * 0.7);
    this.tweens.add({ targets: ring, alpha: 0, duration: 450, yoyo: true, repeat: 3, onComplete: () => ring.destroy() });
  }

  showChallengeIntro() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    const next = this.levelId + 1;
    modal({
      tone: 'challenge',
      mascot: true,
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

