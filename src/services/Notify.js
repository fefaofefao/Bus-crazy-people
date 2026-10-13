// Notificação local "Suas vidas voltaram!" (opcional, só no app Android).
// - O jogador liga em Ajustes ou na tela "Sem vidas"; no Android 13+ o sistema
//   pede a permissão nessa hora (nunca na abertura do app).
// - Agenda UM aviso quando o app vai para o fundo (pause) com as vidas
//   incompletas, para o instante em que elas enchem; cancela ao voltar (resume).
// - Tudo local no aparelho: nada é enviado a servidores. Sem alarme exato
//   (o Android pode atrasar o aviso alguns minutos para poupar bateria).

import { Capacitor } from '@capacitor/core';
import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';
import { Lives } from './Lives.js';
import { t } from '../i18n/index.js';
import { track } from '../analytics.ts';

const ID = 1;
const CHANNEL = 'lives';
const native = Capacitor.isNativePlatform();
let api = null; // carregado só no app nativo

async function plugin() {
  if (!native) return null;
  if (!api) api = (await import('@capacitor/local-notifications')).LocalNotifications;
  return api;
}

/** Instante (ms) em que as vidas ficam cheias, ou 0 se já estão / são infinitas. */
export function fullAt(now = Date.now()) {
  const l = Lives.get();
  if (l.infinite || l.lives >= l.max) return 0;
  return now + l.nextInMs + (l.max - l.lives - 1) * CONFIG.lives.regenMinutes * 60 * 1000;
}

async function ensureChannel(p) {
  try {
    await p.createChannel({ id: CHANNEL, name: t('notify.channel'), importance: 3, visibility: 1 });
  } catch {
    /* Android < 8 ou já existe */
  }
}

async function cancel() {
  try {
    const p = await plugin();
    if (p) await p.cancel({ notifications: [{ id: ID }] });
  } catch {
    /* silencioso */
  }
}

async function schedule() {
  try {
    if (!Storage.data.settings.notify) return;
    const at = fullAt();
    if (!at) return;
    const p = await plugin();
    if (!p) return;
    if ((await p.checkPermissions()).display !== 'granted') return;
    await ensureChannel(p);
    await p.schedule({
      notifications: [{ id: ID, channelId: CHANNEL, title: t('notify.title'), body: t('notify.body'), schedule: { at: new Date(at), allowWhileIdle: true }, isExactNotification: false }],
    });
  } catch {
    /* notificação nunca trava o jogo */
  }
}

export const Notify = {
  /** Só no app nativo (no navegador o botão nem aparece). */
  available: () => native,
  enabled: () => native && Storage.data.settings.notify === true,

  /** Liga o aviso (pede a permissão do Android 13+). Devolve true se ficou ligado. */
  async enable(source = 'settings') {
    let granted = false;
    try {
      const p = await plugin();
      if (p) {
        let perm = await p.checkPermissions();
        if (perm.display !== 'granted') perm = await p.requestPermissions();
        granted = perm.display === 'granted';
        if (granted) await ensureChannel(p);
      }
    } catch {
      granted = false;
    }
    Storage.update((d) => (d.settings.notify = granted));
    track('notify_opt_in', { source, granted });
    return granted;
  },

  disable() {
    Storage.update((d) => (d.settings.notify = false));
    cancel();
  },

  /** Liga os eventos do app (chamado uma vez em main.js). */
  async init() {
    if (!native) return;
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('pause', () => schedule());
      App.addListener('resume', () => cancel());
      cancel(); // o jogador está no app: nenhum aviso pendente
    } catch {
      /* silencioso */
    }
  },
};
