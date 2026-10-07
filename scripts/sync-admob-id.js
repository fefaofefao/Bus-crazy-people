// Copia o ID do APP AdMob para o projeto Android
// (android/app/src/main/res/values/strings.xml -> admob_app_id, lido pelo AndroidManifest)
// e confere os IDs antes de gerar o app.
//
//   node scripts/sync-admob-id.js              -> build de teste: ID de TESTE do Google
//   RELEASE=1 node scripts/sync-admob-id.js    -> Play Store: exige IDs reais em config/ads.json
//   RELEASE=1 TEST_ADS=1 ...                   -> Play Store com anúncios de TESTE (teste fechado)

import { readFileSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';

const A = CONFIG.ads.admob;
const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;
const release = process.env.RELEASE === '1';
const forceTest = process.env.TEST_ADS === '1';

const fail = (msg) => {
  console.error('✗ AdMob: ' + msg);
  process.exit(1);
};

let appId = A.testAppId;
if (release && !forceTest) {
  if (!A.hasRealIds) fail('config/ads.json ainda tem XXXX. Coloque os IDs reais do AdMob ou rode o workflow com "test_ads" marcado.');
  if (!APP_ID.test(A.appId)) fail(`appId inválido: "${A.appId}" (esperado ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX)`);
  if (!UNIT_ID.test(A.interstitialId)) fail(`interstitialId inválido: "${A.interstitialId}"`);
  if (!UNIT_ID.test(A.rewardedId)) fail(`rewardedId inválido: "${A.rewardedId}"`);
  if (A.appId.startsWith('ca-app-pub-3940256099942544')) fail('appId é o de TESTE do Google');
  appId = A.appId;
}

const file = new URL('../android/app/src/main/res/values/strings.xml', import.meta.url);
let xml = readFileSync(file, 'utf8');
const line = `<string name="admob_app_id">${appId}</string>`;
xml = /<string name="admob_app_id">.*?<\/string>/.test(xml)
  ? xml.replace(/<string name="admob_app_id">.*?<\/string>/, line)
  : xml.replace('</resources>', `    ${line}\n</resources>`);
writeFileSync(file, xml);
console.log(`✓ AdMob: appId ${appId} ${appId === A.testAppId ? '(anúncios de TESTE)' : '(anúncios REAIS)'}`);
