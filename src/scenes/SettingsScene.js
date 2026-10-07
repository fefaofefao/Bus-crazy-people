// Ajustes: sons, música, vibração, modo daltônico, idioma, compras,
// como jogar, privacidade e zerar progresso.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getLayout, FONT, DISPLAY } from '../ui/layout.js';
import { Button, fadeIn, goTo } from '../ui/widgets.js';
import { toast, openPage, openHelp, modal } from '../ui/dom.js';
import { openStore } from '../ui/store.js';
import { Storage } from '../services/Storage.js';
import { PurchaseManager } from '../services/PurchaseManager.js';
import { AdManager } from '../services/AdManager.js';
import { Haptics } from '../services/Haptics.js';
import { Music } from '../services/Music.js';
import { t, getLanguage, LANGUAGES } from '../i18n/index.js';

const C = CONFIG.colors;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  onBack() {
    goTo(this, 'Menu');
    return true;
  }

  create() {
    Music.play('menu');
    this.cameras.main.setBackgroundColor(C.background);
    fadeIn(this);
    const L = getLayout(this);
    const u = L.u;
    const bw = Math.min(L.usableW - 40 * u, 340 * u);
    const bh = 46 * u;
    const gap = 54 * u;
    const opts = (color, icon, extra) => ({ width: bw, height: bh, fontSize: 17 * u, radius: 16 * u, color, icon, iconSize: 21 * u, ...extra });
    const section = (y, text) =>
      this.add.text(L.cx - bw / 2 + 6 * u, y, text, { fontFamily: FONT, fontSize: `${13 * u}px`, fontStyle: 'bold', color: C.textDim }).setOrigin(0, 0.5);

    const topY = L.top + 8 * u + 25 * u;
    new Button(this, L.left + 16 * u + 25 * u, topY, '', { width: 50 * u, height: 50 * u, color: C.buttonSecondary, radius: 15 * u, icon: 'home', iconSize: 24 * u }, () =>
      goTo(this, 'Menu'),
    );
    this.add.text(L.cx, topY, t('settings.title'), { fontFamily: DISPLAY, fontSize: `${26 * u}px`, color: C.text }).setOrigin(0.5);

    const showPurchases = PurchaseManager.isEnabled();
    const showAdPrivacy = AdManager.privacyOptionsRequired();
    const rows = 5 + (showPurchases ? 2 : 0) + 2 + (showAdPrivacy ? 1 : 0);
    const contentH = rows * gap + 3 * 34 * u;
    let y = Math.max(topY + 44 * u, L.top + (L.usableH - contentH) / 2 + 10 * u);

    const toggle = (key, icon) =>
      new Button(this, L.cx, y, '', opts(C.button, icon), () => {
        Storage.update((d) => (d.settings[key] = !d.settings[key]));
        if (key === 'vibration' && Storage.data.settings.vibration) Haptics.tap();
        if (key === 'music') Music.refresh();
        refresh();
      });

    section(y, t('settings.preferences'));
    y += 26 * u + bh / 2;
    const sound = toggle('sound', 'sound');
    y += gap;
    const music = toggle('music', 'music');
    y += gap;
    const vib = toggle('vibration', 'vibrate');
    y += gap;
    const cb = toggle('colorblind', 'eye');
    y += gap;
    const langName = LANGUAGES.find((l) => l.code === getLanguage())?.name ?? '';
    new Button(this, L.cx, y, t('settings.language', { name: langName }), opts(C.button, 'globe'), () => goTo(this, 'Language', { from: 'Settings' }));

    let store = null;
    if (showPurchases) {
      y += bh / 2 + 22 * u;
      section(y, t('settings.purchases'));
      y += 26 * u + bh / 2;
      // Loja: Vidas infinitas / Vidas infinitas + sem anúncios
      store = new Button(this, L.cx, y, '', opts(C.buttonAd, 'heart'), () => openStore({ onClose: () => this.scene.isActive() && refresh() }));
      y += gap;
      new Button(this, L.cx, y, t('settings.restore'), opts(C.buttonSecondary, 'restart'), async () => {
        const r = await PurchaseManager.restorePurchases();
        if (!this.scene.isActive()) return;
        toast(r === 'error' ? t('settings.storeError') : r ? t('settings.restored') : t('settings.notFound'));
        refresh();
      });
    }

    y += bh / 2 + 22 * u;
    section(y, t('settings.about'));
    y += 26 * u + bh / 2;
    const half = (bw - 10 * u) / 2;
    new Button(this, L.cx - half / 2 - 5 * u, y, t('settings.howToPlay'), { ...opts(C.buttonSecondary, 'question'), width: half, fontSize: 15 * u }, () => openHelp());
    new Button(this, L.cx + half / 2 + 5 * u, y, t('settings.privacy'), { ...opts(C.buttonSecondary, 'shield'), width: half, fontSize: 13 * u }, () =>
      openPage(t('settings.privacyUrl'), t('settings.privacy'), t('common.close')),
    );
    if (showAdPrivacy) {
      y += gap;
      new Button(this, L.cx, y, t('settings.privacyOptions'), opts(C.buttonSecondary, 'ad'), () => AdManager.showPrivacyOptions());
    }
    y += gap;
    new Button(this, L.cx, y, t('settings.reset'), opts(0x5a2b35, 'trash'), () =>
      modal({
        tone: 'lose',
        title: t('settings.reset'),
        text: t('settings.resetConfirm'),
        buttons: [
          {
            label: t('settings.resetYes'),
            kind: 'danger',
            onClick: (close) => {
              close();
              Storage.reset(true);
              toast(t('settings.resetDone'));
            },
          },
          { label: t('common.cancel'), kind: 'secondary', onClick: (close) => close() },
        ],
      }),
    );

    this.add
      .text(L.cx, L.bottom - 10 * u, `Bus Crazy People · v${__APP_VERSION__} · FSamp Labs`, { fontFamily: FONT, fontSize: `${11 * u}px`, color: '#6f7d99' })
      .setOrigin(0.5, 1);

    function refresh() {
      const st = Storage.data.settings;
      const set = (btn, on, onKey, offKey) => {
        btn.label.setText(t(on ? onKey : offKey));
        btn.setOpts({ color: on ? C.button : C.buttonSecondary, iconArg: on });
      };
      set(sound, st.sound, 'settings.soundOn', 'settings.soundOff');
      set(music, st.music, 'settings.musicOn', 'settings.musicOff');
      set(vib, st.vibration, 'settings.vibrationOn', 'settings.vibrationOff');
      set(cb, st.colorblind, 'settings.colorblindOn', 'settings.colorblindOff');
      if (store) {
        const all = PurchaseManager.products().every((p) => PurchaseManager.owns(p.id));
        store.label.setText(all ? t('store.allOwnedShort') : t('store.button'));
        store.setOpts({ color: all ? C.buttonSuccess : C.buttonAd, icon: all ? 'check' : 'heart' });
      }
    }
    refresh();

    const onResize = () => this.time.delayedCall(30, () => this.scene.restart());
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }
}
