// Sons curtos sintetizados por código (Web Audio) – nenhum arquivo de áudio necessário.

import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';

let ctx = null;
let master = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = CONFIG.feedback.masterVolume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Navegadores só liberam áudio após um gesto do usuário
for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, ensure, { passive: true, capture: true });

/** Um tom com envelope e varredura de frequência opcional. */
function tone({ freq = 440, to = null, dur = 0.1, type = 'sine', vol = 0.4, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Ruído filtrado (para o "whoosh" e a batida). */
function noise({ dur = 0.15, vol = 0.2, from = 800, to = 3000, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let s = 12345; // ruído determinístico simples (não precisa de Math.random)
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const play = (fn) => {
  if (!Storage.data.settings.sound) return;
  try {
    fn();
  } catch {
    /* áudio indisponível */
  }
};

export const Sound = {
  tap: () => play(() => tone({ freq: 660, to: 880, dur: 0.05, type: 'sine', vol: 0.25 })),
  button: () => play(() => tone({ freq: 520, dur: 0.05, type: 'triangle', vol: 0.2 })),
  exit: () =>
    play(() => {
      tone({ freq: 380, to: 1200, dur: 0.16, type: 'triangle', vol: 0.25 });
      noise({ dur: 0.18, vol: 0.12, from: 600, to: 4000 });
    }),
  collision: () =>
    play(() => {
      tone({ freq: 160, to: 55, dur: 0.18, type: 'square', vol: 0.22 });
      noise({ dur: 0.1, vol: 0.2, from: 400, to: 150 });
    }),
  win: () =>
    play(() => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.3, delay: i * 0.09 }));
      tone({ freq: 1567.98, dur: 0.4, type: 'sine', vol: 0.15, delay: 0.36 });
    }),
  lose: () =>
    play(() => {
      [392, 329.63, 261.63].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.25, delay: i * 0.13 }));
    }),
  reward: () => play(() => [880, 1318.5].forEach((f, i) => tone({ freq: f, dur: 0.15, vol: 0.25, delay: i * 0.08 }))),
  /** Passageiro embarcando (tom sobe com os lugares ocupados). */
  board: (seat = 1) => play(() => tone({ freq: 520 * Math.pow(1.06, Math.min(seat, 10)), dur: 0.05, type: 'triangle', vol: 0.16 })),
  /** Buzina "fon-fon" do ônibus partindo. */
  depart: () =>
    play(() => {
      tone({ freq: 392, dur: 0.11, type: 'square', vol: 0.09 });
      tone({ freq: 494, dur: 0.11, type: 'square', vol: 0.07 });
      tone({ freq: 392, dur: 0.14, type: 'square', vol: 0.09, delay: 0.15 });
      tone({ freq: 494, dur: 0.14, type: 'square', vol: 0.07, delay: 0.15 });
    }),
  /** Ônibus coberto revelado. */
  reveal: () => play(() => [660, 990].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'triangle', vol: 0.2, delay: i * 0.06 }))),
  /** Ônibus saindo do terminal. */
  spawn: () => play(() => tone({ freq: 300, to: 520, dur: 0.14, type: 'triangle', vol: 0.18 })),
  /** Combo: vários ônibus partindo de uma vez (tom sobe com o tamanho). */
  combo: (n = 2) =>
    play(() => [0, 4, 7, 12].slice(0, Math.min(4, n + 1)).forEach((st, i) => tone({ freq: 523.25 * Math.pow(2, st / 12), dur: 0.14, type: 'square', vol: 0.1, delay: i * 0.07 }))),
  star: (i = 0) => play(() => tone({ freq: 784 * Math.pow(1.26, i), dur: 0.12, type: 'triangle', vol: 0.22 })),
};
