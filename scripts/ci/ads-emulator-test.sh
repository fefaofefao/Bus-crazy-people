#!/usr/bin/env bash
# Teste de anúncios no emulador (workflow android-ads-test.yml).
# Instala o APK de teste (IDs de TESTE do Google + autoplay), deixa o jogo vencer as
# fases sozinho e registra o logcat. Quando um anúncio aparece, tira um print e
# fecha com o botão "voltar" (como um jogador faria).
set -u
APK=android/app/build/outputs/apk/debug/app-debug.apk
PKG=com.fsamplabs.buscrazypeople
OUT=ads-test
mkdir -p "$OUT"
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb install -r "$APK"
# eventos do Firebase Analytics no logcat (Logging event: ... name=ad_inter_shown)
adb shell setprop log.tag.FA VERBOSE
adb shell setprop log.tag.FA-SVC VERBOSE
adb shell setprop debug.firebase.analytics.app "$PKG"
adb logcat -c
adb logcat -v time > "$OUT/logcat-full.txt" &
LOGPID=$!
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
echo "app iniciado"

# Fecha o anúncio na tela tocando no botão de fechar (o "voltar" não fecha o
# intersticial de teste): procura pelo uiautomator; sem achar, toca nos cantos.
close_ad() {
  local kind=$1
  for k in $(seq 1 25); do
    grep -q "\[Ads\] $kind onAdDismissed" "$OUT/logcat-full.txt" && return 0
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    local b
    b=$(adb shell cat /sdcard/ui.xml 2>/dev/null | tr '>' '\n' | grep -iE 'content-desc="[^"]*(close|fechar|skip)[^"]*"|resource-id="[^"]*close[^"]*"' | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -1)
    if [ -n "$b" ]; then
      read x1 y1 x2 y2 <<<"$(echo "$b" | grep -oE '[0-9]+' | tr '\n' ' ')"
      echo "   toque no fechar ($b)"
      adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
    else
      W=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | cut -dx -f1)
      adb shell input tap 30 60; sleep 1
      adb shell input tap $((W - 30)) 60
    fi
    sleep 3
    # se o toque abriu o navegador (clique no anúncio), volta para o app
    if ! adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | grep -q "$PKG"; then
      echo "   saiu do app: voltando"
      adb shell input keyevent KEYCODE_BACK; sleep 2
    fi
  done
  adb shell input keyevent KEYCODE_BACK
}

shot=0
seen_inter=0
seen_rew=0
for i in $(seq 1 300); do   # até ~10 min
  sleep 2
  L="$OUT/logcat-full.txt"
  n_inter=$(grep -c "\[Ads\] interstitial onAdShowed" "$L" || true)
  n_rew=$(grep -c "\[Ads\] rewarded onAdShowed" "$L" || true)
  if [ "$n_inter" -gt "$seen_inter" ]; then
    seen_inter=$n_inter
    sleep 4
    shot=$((shot+1)); adb exec-out screencap -p > "$OUT/$(printf %02d $shot)-interstitial.png"
    echo ">> intersticial na tela (#$seen_inter): print + fechar"
    sleep 4
    close_ad interstitial
  fi
  if [ "$n_rew" -gt "$seen_rew" ]; then
    seen_rew=$n_rew
    sleep 8
    shot=$((shot+1)); adb exec-out screencap -p > "$OUT/$(printf %02d $shot)-rewarded.png"
    echo ">> recompensado na tela: esperando a recompensa"
    for k in $(seq 1 30); do
      sleep 2
      grep -q "onUserEarnedReward" "$L" && break
    done
    sleep 2
    close_ad rewarded
  fi
  if grep -q "\[Auto\] done" "$L"; then echo "autoplay terminou"; sleep 3; break; fi
done
shot=$((shot+1)); adb exec-out screencap -p > "$OUT/$(printf %02d $shot)-final.png"
kill $LOGPID 2>/dev/null
# resumo: só as linhas dos anúncios, do autoplay e dos eventos do Firebase
grep -E "\[Ads\]|\[Auto\]|Logging event: origin=app.*name=(ad_|level_end)" "$OUT/logcat-full.txt" \
  | sed -E 's/.*Msg: //; s/^([0-9-]+ [0-9:.]+) [A-Z]\/[^:]*: /\1 /' > "$OUT/ads-log.txt" || true
echo "================ LOG DOS ANÚNCIOS ================"
cat "$OUT/ads-log.txt"
echo "=================================================="
echo "intersticiais exibidos: $(grep -c 'interstitial onAdShowed' "$OUT/ads-log.txt")"
echo "intersticiais fechados: $(grep -c 'interstitial onAdDismissed' "$OUT/ads-log.txt")"
echo "recompensas ganhas:     $(grep -c 'onUserEarnedReward' "$OUT/ads-log.txt")"
