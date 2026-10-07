// PRNG determinístico (mulberry32) e hash de inteiros para derivar sementes.
// Usa apenas Math.imul e operações de 32 bits, que dão o mesmo resultado em
// qualquer motor JavaScript (navegador, WebView do Android, Node).
// NUNCA use Math.random na geração de fases.

/** Cria um gerador mulberry32 a partir de uma semente inteira de 32 bits. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
  };
  return {
    next,
    /** Inteiro em [min, max] (inclusivo). */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** Elemento aleatório de uma lista. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}

/** Mistura uma lista de inteiros numa semente de 32 bits (estilo murmur3 fmix). */
export function hashInts(...values) {
  let h = 0x9e3779b9;
  for (const v of values) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
