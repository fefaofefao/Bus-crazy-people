// Vibração (feedback tátil).
//
// - Na web usa navigator.vibrate (Android Chrome; iOS Safari ignora).
// - No app nativo (Capacitor) usa o plugin @capacitor/haptics, que já está
//   instalado no projeto. Para remover/trocar o plugin, basta mexer em
//   `nativeImpl` abaixo – o resto do jogo só chama Haptics.tap/collision/success.

import { Capacitor } from '@capacitor/core';
import { Haptics as CapHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { CONFIG } from '../config.js';
import { Storage } from './Storage.js';

const webImpl = {
  tap: () => navigator.vibrate?.(CONFIG.feedback.vibrateTap),
  collision: () => navigator.vibrate?.(CONFIG.feedback.vibrateCollision),
  success: () => navigator.vibrate?.(CONFIG.feedback.vibrateWin),
};

const nativeImpl = {
  tap: () => CapHaptics.impact({ style: ImpactStyle.Light }),
  collision: () => CapHaptics.impact({ style: ImpactStyle.Heavy }),
  success: () => CapHaptics.notification({ type: NotificationType.Success }),
};

const impl = Capacitor.isNativePlatform() ? nativeImpl : webImpl;

function run(kind) {
  if (!Storage.data.settings.vibration) return;
  try {
    const r = impl[kind]();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    /* vibração indisponível */
  }
}

export const Haptics = {
  tap: () => run('tap'), // toque curto
  collision: () => run('collision'), // colisão (mais forte)
  success: () => run('success'), // vitória
};
