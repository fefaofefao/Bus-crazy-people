// Salvamento automático em localStorage, seguro contra dados corrompidos.
//
// - Cada campo lido é validado; valores inválidos voltam ao padrão.
// - Mantém uma cópia de segurança (backupKey). Se a principal estiver
//   corrompida, tenta a cópia; se as duas falharem, começa do zero.
// - Qualquer erro do localStorage (modo privado, cota cheia) é ignorado:
//   o jogo continua funcionando só em memória.

import { CONFIG } from '../config.js';

const SCHEMA = 1; // versão do formato do arquivo de save (ponto de migração em load())
// Idiomas aceitos (mantenha igual a src/i18n/index.js)
const LANGUAGE_CODES = ['pt-BR', 'en', 'es'];

const defaults = () => ({
  schema: SCHEMA,
  completed: [], // fases vencidas (ids)
  skipped: [], // fases Desafio puladas (só informativo)
  adsRemoved: false,
  winsSinceInterstitial: 0, // vitórias desde o último intersticial
  settings: { sound: true, music: true, vibration: true, colorblind: false },
  language: null, // null = ainda não escolheu (mostra a tela de idioma no primeiro acesso)
  // reservado para a v1.1 (desafio diário, Play Games): não usado no MVP
  daily: {},
});

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isBool = (v) => typeof v === 'boolean';
const intList = (v, max) => (Array.isArray(v) ? [...new Set(v.filter((x) => isInt(x, 1, max)))].sort((a, b) => a - b) : []);

/** Monta um save válido a partir de qualquer coisa (campos ruins => padrão). */
function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  d.completed = intList(raw.completed, 100000);
  d.skipped = intList(raw.skipped, 100000);
  if (isBool(raw.adsRemoved)) d.adsRemoved = raw.adsRemoved;
  if (isInt(raw.winsSinceInterstitial, 0, 1e6)) d.winsSinceInterstitial = raw.winsSinceInterstitial;
  if (raw.settings && typeof raw.settings === 'object') {
    for (const k of Object.keys(d.settings)) if (isBool(raw.settings[k])) d.settings[k] = raw.settings[k];
  }
  if (LANGUAGE_CODES.includes(raw.language)) d.language = raw.language;
  if (raw.daily && typeof raw.daily === 'object' && !Array.isArray(raw.daily)) d.daily = raw.daily;
  return d;
}

function readKey(key) {
  try {
    const txt = localStorage.getItem(key);
    if (!txt) return null;
    const obj = JSON.parse(txt);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

function load() {
  const raw = readKey(CONFIG.storage.key) ?? readKey(CONFIG.storage.backupKey);
  // Migrações futuras: if (raw?.schema === 1) { ...converte para 2... }
  return sanitize(raw);
}

export const Storage = {
  data: load(),

  save() {
    try {
      const txt = JSON.stringify(this.data);
      localStorage.setItem(CONFIG.storage.key, txt);
      localStorage.setItem(CONFIG.storage.backupKey, txt);
    } catch {
      /* sem localStorage: segue só em memória */
    }
  },

  /** Altera o save e grava na hora: Storage.update(d => { d.completed.push(3) }) */
  update(fn) {
    fn(this.data);
    this.data = sanitize(this.data);
    this.save();
    return this.data;
  },

  /**
   * Zera o progresso (Configurações → Zerar progresso).
   * keepPrefs = true mantém idioma, preferências e a compra "Remover anúncios".
   */
  reset(keepPrefs = true) {
    const old = this.data;
    this.data = defaults();
    if (keepPrefs) {
      this.data.language = old.language;
      this.data.settings = { ...old.settings };
      this.data.adsRemoved = old.adsRemoved;
    }
    this.save();
  },
};
