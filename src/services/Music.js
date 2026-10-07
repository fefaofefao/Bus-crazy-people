// Música de fundo sintetizada por código (Web Audio): um loop leve com
// levada de samba/bossa – baixo, acordes e ganzá. Nenhum arquivo de áudio.
//
// - Liga/desliga em Ajustes (Storage.data.settings.music).
// - Pausa quando o app vai para segundo plano e quando um anúncio está aberto.
// - O navegador só libera áudio depois do primeiro toque do usuário.

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';

const BPM = 104;
const STEP = 60 / BPM / 4; // semicolcheia
// Progressão (I - vi - ii - V em Dó): notas MIDI dos acordes e do baixo
const CHORDS = [
  [60, 64, 67, 71],
  [57, 60, 64, 67],
  [62, 65, 69, 72],
  [55, 59, 62, 65],
];
const BASS = [36, 33, 38, 31];
// levada do baixo (16 passos): 1 = toca a fundamental, 2 = quinta
const BASS_PAT = [1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 0, 1, 0];
const CHORD_PAT = [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0];
const SHAKER = [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1];
const MELODY = [72, 0, 74, 0, 76, 0, 0, 74, 72, 0, 69, 0, 0, 0, 67, 0];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

let ctx = null;
let out = null;
let timer = null;
let step = 0;
let nextTime = 0;
let paused = false;
let noiseBuf = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = CONFIG.feedback.musicVolume;
    out.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.05);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let s = 777;
    for (let i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x7fffffff) * 2 - 1;
    }
  }
  return ctx;
}

function note(freq, t, dur, type, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function shaker(t, vol) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

function schedule() {
  while (nextTime < ctx.currentTime + 0.2) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % CHORDS.length;
    if (BASS_PAT[s]) note(midi(BASS[bar] + (BASS_PAT[s] === 2 ? 7 : 0)), nextTime, STEP * 1.8, 'triangle', 0.5);
    if (CHORD_PAT[s]) for (const n of CHORDS[bar]) note(midi(n), nextTime, STEP * 1.4, 'sine', 0.07);
    if (SHAKER[s]) shaker(nextTime, s % 4 === 0 ? 0.12 : 0.06);
    // melodia só a cada 2 voltas (menos repetitiva)
    const m = MELODY[s];
    if (m && Math.floor(step / 64) % 2 === 1) note(midi(m + (bar === 3 ? -2 : 0)), nextTime, STEP * 1.6, 'square', 0.035);
    nextTime += STEP;
    step++;
  }
}

function start() {
  if (timer || paused || !Storage.data.settings.music) return;
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 50);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

export const Music = {
  init() {
    if (this._init) return;
    this._init = true;
    // primeiro toque libera o áudio
    const kick = () => start();
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, kick, { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  },
  /** Chamado ao mudar o ajuste. */
  refresh() {
    if (Storage.data.settings.music) start();
    else stop();
  },
  /** Pausa durante anúncios (o AdManager chama). */
  pause() {
    paused = true;
    stop();
  },
  resume() {
    paused = false;
    start();
  },
};
