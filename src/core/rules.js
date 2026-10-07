// Constantes das regras: tipos de ônibus, cores e direções.
// Lógica pura (sem Phaser): usada pelo jogo, pelo solver, pelo gerador e pelos testes.
//
// Para adicionar um tipo de ônibus no futuro (ex.: articulado, dois andares),
// acrescente-o em BUS_TYPES; o formato da fase já aceita "type" livre.

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
export const DIR_KEYS = ['up', 'right', 'down', 'left'];

/** len = casas ocupadas no estacionamento; cap = passageiros. */
export const BUS_TYPES = {
  small: { len: 2, cap: 4 },
  medium: { len: 3, cap: 6 },
  large: { len: 4, cap: 8 },
};

/**
 * Até 8 cores, bem distintas entre si. Cada cor tem um símbolo único
 * (modo daltônico). A ordem dos índices é a usada nos arquivos de fase.
 */
export const COLORS = [
  { key: 'red', hex: 0xe53935, symbol: 'circle' },
  { key: 'blue', hex: 0x1e6fd9, symbol: 'triangle' },
  { key: 'yellow', hex: 0xfdd835, symbol: 'star' },
  { key: 'green', hex: 0x2e9e44, symbol: 'square' },
  { key: 'purple', hex: 0x8e3fc1, symbol: 'diamond' },
  { key: 'orange', hex: 0xfb8c00, symbol: 'cross' },
  { key: 'pink', hex: 0xf472b6, symbol: 'heart' },
  { key: 'cyan', hex: 0x22c3d6, symbol: 'hexagon' },
];

export const busLen = (bus) => BUS_TYPES[bus.type].len;
export const busCap = (bus) => BUS_TYPES[bus.type].cap;

/** Casas ocupadas pelo ônibus, da frente (índice 0) até a traseira. (x, y) = frente. */
export function busCells(bus) {
  const { dx, dy } = DIRS[bus.dir];
  const len = busLen(bus);
  const cells = [];
  for (let i = 0; i < len; i++) cells.push({ x: bus.x - dx * i, y: bus.y - dy * i });
  return cells;
}
