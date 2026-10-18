// Gera public/fonts/mplus-rounded-ja.woff2: a fonte japonesa "M PLUS Rounded 1c"
// (peso 800, licença OFL) SÓ com os caracteres usados pelo jogo e pela loja,
// para o app não carregar uma fonte japonesa inteira (vários MB).
// Rode de novo sempre que mudar src/i18n/ja.js ou store/ja-chars.txt:
//   node scripts/make-ja-font.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ja = (await import('../src/i18n/ja.js')).default;
const strings = [];
const walk = (v) => (typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' && Object.values(v).forEach(walk));
walk(ja);
if (existsSync('store/ja-chars.txt')) strings.push(readFileSync('store/ja-chars.txt', 'utf8'));
// só kana, kanji e pontuação japonesa (o latim vem de Lilita One / Fredoka; emojis, do sistema)
const cjk = (c) => {
  const n = c.codePointAt(0);
  return (n >= 0x3000 && n <= 0x9fff) || (n >= 0xff00 && n <= 0xffef);
};
const chars = [...new Set([...strings.join('')])].filter(cjk).sort().join('');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const css = await (await fetch(`https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&text=${encodeURIComponent(chars)}`, { headers: { 'User-Agent': UA } })).text();
const url = css.match(/url\((https:[^)]+)\)/)?.[1];
if (!url) throw new Error('fonte não encontrada:\n' + css);
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
mkdirSync('public/fonts', { recursive: true });
writeFileSync('public/fonts/mplus-rounded-ja.woff2', buf);
console.log(`✓ ${chars.length} caracteres, ${(buf.length / 1024).toFixed(1)} KB -> public/fonts/mplus-rounded-ja.woff2`);
