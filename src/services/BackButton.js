// Botão/gesto "voltar" do Android (e tecla Esc no navegador).
// Ordem: fecha uma janela aberta (política, como jogar) -> a cena atual decide
// (onBack) -> no menu principal, sai do app.
// Anúncios e a confirmação de compra de teste não fecham pelo "voltar".

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export function handleBack(game) {
  const closable = [...document.querySelectorAll('.fds-overlay')].pop();
  if (closable) {
    if (closable.dataset.back === 'close') closable.__close?.();
    return; // anúncio/compra aberta: ignora
  }
  const scene = game.scene.getScenes(true)[0];
  if (scene?.onBack?.()) return;
  if (Capacitor.isNativePlatform()) App.exitApp();
}

export function initBackButton(game) {
  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', () => handleBack(game));
  } else {
    window.addEventListener('keydown', (e) => e.key === 'Escape' && handleBack(game));
  }
}
