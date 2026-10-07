// Música e assinatura sonora, sintetizadas por código (Web Audio): nenhum arquivo.
//
// - VINHETA ("fon-fon, ta-ra-rá!"): toca ao abrir o app. É a assinatura sonora da
//   marca: buzina de ônibus em duas notas + arpejo de marimba subindo + brilho.
//   No app Android toca sozinha (o Capacitor libera áudio sem toque); no navegador,
//   só se o primeiro toque acontecer durante o splash.
// - TRILHA DO MENU "Bossa da Orla": calma e quente (78 BPM) – piano elétrico com
//   tremolo, violão em levada de bossa, baixo macio, vassourinha e uma flauta que
//   aparece de vez em quando. Tudo passa por um filtro suave e um reverb.
// - TRILHA DO JOGO "Samba do Ponto": mais animada, mas baixinha (não atrapalha pensar).
//
// Liga/desliga em Ajustes (Storage.data.settings.music). Pausa em segundo plano e
// durante anúncios. Troca de trilha com crossfade (Music.play('menu' | 'game')).

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

let ctx = null;
let master = null; // volume geral da música
let bus = null; // entrada da cadeia (filtro + reverb)
let fxBus = null; // efeitos (vinheta), independe do ajuste de música
let noiseBuf = null;
let timer = null;
let current = null; // { name, gain, step, nextTime }
let wanted = null;
let paused = false;

function makeReverb(c, seconds = 2.2) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  let s = 4242;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = ((s / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
  }
  const conv = c.createConvolver();
  conv.buffer = buf;
  return conv;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = CONFIG.feedback.musicVolume;
  master.connect(ctx.destination);
  // cadeia: bus -> passa-baixa suave -> (seco + reverb) -> master
  bus = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  lp.Q.value = 0.4;
  const rev = makeReverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  bus.connect(lp);
  lp.connect(master);
  lp.connect(rev).connect(wet).connect(master);
  // efeitos (vinheta) vão direto, com o mesmo reverb, e respeitam o ajuste de SONS
  fxBus = ctx.createGain();
  fxBus.gain.value = CONFIG.feedback.masterVolume;
  fxBus.connect(ctx.destination);
  const fxWet = ctx.createGain();
  fxWet.gain.value = 0.25;
  fxBus.connect(rev);
  rev.connect(fxWet).connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 0.12);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let s = 777;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Instrumentos
// ---------------------------------------------------------------------------
function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Piano elétrico: seno + harmônico leve, com tremolo. */
function rhodes(out, freq, t, dur, vol) {
  const g = ctx.createGain();
  env(g, t, 0.012, vol, dur);
  const trem = ctx.createGain();
  trem.gain.value = 1;
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 4.2;
  lfoG.gain.value = 0.18;
  lfo.connect(lfoG).connect(trem.gain);
  for (const [mult, v] of [
    [1, 1],
    [2, 0.22],
    [3.01, 0.06],
  ]) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * mult, t);
    og.gain.value = v;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  g.connect(trem).connect(out);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
}

/** Violão de nylon: triângulo com ataque rápido e filtro que fecha. */
function guitar(out, freq, t, vol) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.35);
  env(g, t, 0.004, vol, 0.55);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.6);
}

function bass(out, freq, t, dur, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  env(g, t, 0.01, vol, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function brush(out, t, vol, hp = 5000) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  env(g, t, 0.006, vol, 0.11);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

/** Flauta: seno com vibrato e ataque suave. */
function flute(out, freq, t, dur, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const vib = ctx.createOscillator();
  const vg = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  vib.frequency.value = 5;
  vg.gain.value = freq * 0.006;
  vib.connect(vg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  vib.start(t);
  o.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
}

/** Marimba (vinheta): seno + harmônico agudo com decaimento rápido. */
function marimba(out, freq, t, vol) {
  for (const [mult, v, d] of [
    [1, 1, 0.5],
    [4, 0.25, 0.12],
  ]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * mult, t);
    env(g, t, 0.003, vol * v, d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

/** Buzina de ônibus: duas ondas quadradas desafinadas, filtradas. */
function horn(out, notes, t, dur, vol) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  for (const n of notes) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(midi(n), t);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

// ---------------------------------------------------------------------------
// Trilhas (sequenciador em semicolcheias)
// ---------------------------------------------------------------------------
const TRACKS = {
  // "Bossa da Orla" – calma (78 BPM). Acordes: Fmaj9 | Em7 A7(b9) | Dm9 | G13
  menu: {
    bpm: 78,
    bars: [
      { chord: [53, 57, 60, 64, 67], bass: 41 }, // Fmaj9
      { chord: [52, 55, 59, 62], bass: 40, chord2: [55, 58, 61, 64], bass2: 45 }, // Em7 -> A7
      { chord: [50, 53, 57, 60, 64], bass: 38 }, // Dm9
      { chord: [53, 57, 59, 64], bass: 43 }, // G13
      { chord: [52, 55, 59, 62], bass: 40 }, // Em7
      { chord: [50, 53, 57, 60], bass: 45, chord2: [49, 53, 55, 58], bass2: 45 }, // Am7 -> A7
      { chord: [50, 53, 57, 60, 64], bass: 38 }, // Dm9
      { chord: [48, 52, 55, 58, 62], bass: 36 }, // C9
    ],
    // levada do violão (bossa): passos com batida de acorde
    guitar: [0, 3, 6, 10, 12],
    bassSteps: [0, 6, 8, 14],
    // flauta: [passo global de 16*8, nota midi, duração em passos]
    melody: [
      [4, 76, 6],
      [12, 74, 4],
      [16, 72, 10],
      [36, 74, 3],
      [40, 72, 3],
      [44, 69, 8],
      [68, 72, 6],
      [76, 71, 4],
      [80, 69, 10],
      [100, 67, 4],
      [104, 69, 4],
      [108, 72, 12],
    ],
    vol: { rhodes: 0.05, guitar: 0.06, bass: 0.22, brush: 0.035, flute: 0.05 },
  },
  // "Samba do Ponto" – partida (100 BPM), mais leve que antes
  game: {
    bpm: 100,
    bars: [
      { chord: [60, 64, 67, 71], bass: 36 },
      { chord: [57, 60, 64, 67], bass: 33 },
      { chord: [62, 65, 69, 72], bass: 38 },
      { chord: [55, 59, 62, 65], bass: 31 },
    ],
    guitar: [2, 5, 9, 12, 14],
    bassSteps: [0, 3, 6, 8, 11, 14],
    melody: [
      [0, 72, 2],
      [2, 74, 2],
      [4, 76, 4],
      [10, 74, 2],
      [12, 72, 3],
      [32, 69, 2],
      [34, 72, 2],
      [36, 74, 6],
      [48, 71, 2],
      [50, 67, 6],
    ],
    vol: { rhodes: 0.025, guitar: 0.05, bass: 0.2, brush: 0.05, flute: 0.03 },
  },
};

function scheduleTrack(tr) {
  const T = TRACKS[tr.name];
  const STEP = 60 / T.bpm / 4;
  const loopSteps = T.bars.length * 16;
  while (tr.nextTime < ctx.currentTime + 0.25) {
    const t = tr.nextTime;
    const gs = tr.step % loopSteps;
    const s = gs % 16;
    const bar = T.bars[Math.floor(gs / 16)];
    const half = s >= 8 && bar.chord2;
    const chord = half ? bar.chord2 : bar.chord;
    const bassNote = half ? bar.bass2 : bar.bass;
    const out = tr.gain;
    // piano elétrico: acorde longo no começo do compasso (e na troca)
    if (s === 0 || (s === 8 && bar.chord2)) chord.forEach((n, i) => rhodes(out, midi(n), t + i * 0.012, STEP * (bar.chord2 ? 8 : 15), T.vol.rhodes));
    // violão em levada de bossa
    if (T.guitar.includes(s)) chord.slice(-3).forEach((n, i) => guitar(out, midi(n), t + i * 0.008, T.vol.guitar));
    // baixo (fundamental e quinta)
    if (T.bassSteps.includes(s)) bass(out, midi(bassNote + (s % 8 === 6 ? 7 : 0)), t, STEP * 2.6, T.vol.bass);
    // vassourinha
    if (s % 2 === 0) brush(out, t, s % 4 === 0 ? T.vol.brush : T.vol.brush * 0.55);
    // flauta: no menu, só a cada duas voltas (respira)
    const loop = Math.floor(tr.step / loopSteps);
    if (tr.name !== 'menu' || loop % 2 === 1) for (const [at, n, d] of T.melody) if (at === gs) flute(out, midi(n), t, STEP * d, T.vol.flute);
    tr.nextTime += STEP;
    tr.step++;
  }
}

function tick() {
  if (current) scheduleTrack(current);
  for (const old of fading) scheduleTrack(old);
}
let fading = [];

function startTrack(name) {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (current?.name === name) return;
  // crossfade
  if (current) {
    const old = current;
    old.gain.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
    old.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    fading.push(old);
    setTimeout(() => {
      fading = fading.filter((x) => x !== old);
      old.gain.disconnect();
    }, 1000);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
  gain.connect(bus);
  current = { name, gain, step: 0, nextTime: ctx.currentTime + 0.12 };
  if (!timer) timer = setInterval(tick, 60);
}

function stopAll() {
  clearInterval(timer);
  timer = null;
  if (current) {
    current.gain.disconnect();
    current = null;
  }
  fading.forEach((f) => f.gain.disconnect());
  fading = [];
}

function apply() {
  if (paused || document.hidden || !Storage.data.settings.music || !wanted) stopAll();
  else startTrack(wanted);
}

let jinglePlayed = false;

export const Music = {
  init() {
    if (this._init) return;
    this._init = true;
    const kick = () => {
      ensure();
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
      apply();
    };
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, kick, { passive: true, capture: true });
    document.addEventListener('visibilitychange', apply);
  },

  /** Troca a trilha ('menu' ou 'game'). */
  play(name) {
    wanted = name;
    apply();
  },

  /**
   * Vinheta de abertura (assinatura sonora). Toca uma vez por abertura do app,
   * se o áudio estiver liberado. Respeita o ajuste de SONS.
   */
  jingle() {
    if (jinglePlayed || !Storage.data.settings.sound) return false;
    if (!ensure()) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      // navegador sem toque ainda: tenta no primeiro toque, se for logo
      const until = Date.now() + 2500;
      const once = () => {
        window.removeEventListener('pointerdown', once, true);
        if (Date.now() < until) setTimeout(() => this.jingle(), 30);
      };
      window.addEventListener('pointerdown', once, true);
      return false;
    }
    jinglePlayed = true;
    const t = ctx.currentTime + 0.05;
    const out = fxBus;
    // "fon-fon": buzina em duas notas (terça menor -> maior), curtinha
    horn(out, [55, 59], t, 0.16, 0.07);
    horn(out, [57, 61], t + 0.22, 0.24, 0.07);
    // "ta-ra-rá!": arpejo de marimba subindo (Dó maior com nona) + nota longa
    [72, 76, 79, 84].forEach((n, i) => marimba(out, midi(n), t + 0.58 + i * 0.09, 0.32));
    marimba(out, midi(86), t + 0.98, 0.3);
    rhodes(out, midi(72), t + 0.98, 1.6, 0.06);
    rhodes(out, midi(76), t + 0.99, 1.6, 0.05);
    rhodes(out, midi(79), t + 1.0, 1.6, 0.05);
    // brilho
    for (let i = 0; i < 6; i++) marimba(out, midi(96 + (i % 3) * 3), t + 1.05 + i * 0.05, 0.05);
    return true;
  },

  /** Ajuste de música mudou. */
  refresh() {
    apply();
  },

  pause() {
    paused = true;
    apply();
  },
  resume() {
    paused = false;
    apply();
  },
};
