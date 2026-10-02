// Naturezas: nome e stat aumentado/reduzido.

export const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];
const NATURE_STATS = ['atk', 'def', 'spe', 'spa', 'spd'];

/**
 * Natureza a partir do PID, com o stat aumentado e o reduzido.
 * No Quetzal vale o byte baixo do PID: (PID & 0xFF) % 25 (o jogo monta o PID como 225 + natureza
 * para machos e 256 + natureza para fêmeas; conferido em 12 Pokémon da equipe).
 */
export function natureFromPid(pid) {
  return natureFromId((pid & 0xFF) % 25);
}

export function natureFromId(id) {
  if (id >= NATURES.length) return null;
  const plus = NATURE_STATS[Math.floor(id / 5)], minus = NATURE_STATS[id % 5];
  return { id, name: NATURES[id], plus: plus === minus ? null : plus, minus: plus === minus ? null : minus };
}
