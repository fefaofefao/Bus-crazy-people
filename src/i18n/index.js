// Idiomas do jogo. Para adicionar um idioma: crie um arquivo como pt-BR.js com as
// mesmas chaves, importe abaixo e inclua-o em LANGUAGES.
//
// Uso: t('menu.play', { n: 5 })  ->  "Jogar – Fase 5"
// Chaves com plural: { one: '...', other: '...' } e o parâmetro `n`.

import ptBR from './pt-BR.js';
import en from './en.js';
import es from './es.js';
import { Storage } from '../services/Storage.js';

export const LANGUAGES = [
  { code: 'pt-BR', name: 'Português (Brasil)', flag: 'br', strings: ptBR },
  { code: 'en', name: 'English', flag: 'us', strings: en },
  { code: 'es', name: 'Español', flag: 'es', strings: es },
];
export const DEFAULT_LANGUAGE = 'pt-BR';
const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));

export const isSupportedLanguage = (code) => byCode.has(code);

/** Idioma sugerido pelo aparelho (só para pré-selecionar na tela de escolha). */
export function deviceLanguage() {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const raw of list) {
    const l = String(raw).toLowerCase();
    if (l.startsWith('pt')) return 'pt-BR';
    if (l.startsWith('es')) return 'es';
    if (l.startsWith('en')) return 'en';
  }
  return DEFAULT_LANGUAGE;
}

/** Idioma atual (o salvo; antes da escolha, o do aparelho). */
export function getLanguage() {
  return Storage.data.language ?? deviceLanguage();
}

export function setLanguage(code) {
  if (!isSupportedLanguage(code)) return;
  Storage.update((d) => (d.language = code));
  document.documentElement.lang = code;
}

/** Já escolheu o idioma alguma vez? (senão mostra a tela de escolha no início) */
export const hasChosenLanguage = () => Storage.data.language != null;

function lookup(strings, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), strings);
}

export function t(key, params = {}) {
  let v = lookup(byCode.get(getLanguage())?.strings, key);
  if (v === undefined) v = lookup(ptBR, key); // reserva: português
  if (v === undefined) return key;
  if (typeof v === 'object' && !Array.isArray(v)) v = params.n === 1 ? v.one : v.other;
  if (typeof v !== 'string') return v;
  return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

document.documentElement.lang = getLanguage();
