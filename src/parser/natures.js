// Naturezas: nome e stat aumentado/reduzido.

export const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];
const NATURE_STATS = ['atk', 'def', 'spe', 'spa', 'spd'];

/** Natureza a partir do PID (PID % 25), com o stat aumentado e o reduzido. */
export function natureFromPid(pid) {
  return natureFromId(pid % 25);
}

export function natureFromId(id) {
  if (id >= NATURES.length) return null;
  const plus = NATURE_STATS[Math.floor(id / 5)], minus = NATURE_STATS[id % 5];
  return { id, name: NATURES[id], plus: plus === minus ? null : plus, minus: plus === minus ? null : minus };
}
