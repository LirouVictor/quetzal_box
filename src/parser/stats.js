// Cálculos derivados: stats a partir dos stats base e tipo do Hidden Power.
// A fórmula foi conferida contra os stats salvos da equipe (CLAUDE.md).

import { natureFromId } from './natures.js';

/** Ordem dos stats base nas tabelas (PokeAPI): HP, Atk, Def, SpA, SpD, Spe. */
export const BASE_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/**
 * Stats pela fórmula das gerações 3+.
 * @param {number[]} base stats base na ordem BASE_ORDER
 * @param {Record<string, number>} ivs
 * @param {Record<string, number>} evs
 * @param {number} level
 * @param {{plus: string|null, minus: string|null}} nature
 */
export function calcStats(base, ivs, evs, level, nature) {
  const out = {};
  BASE_ORDER.forEach((k, i) => {
    const core = Math.floor(((2 * base[i] + ivs[k] + Math.floor(evs[k] / 4)) * level) / 100);
    if (k === 'hp') { out.hp = base[i] === 1 ? 1 : core + level + 10; return; } // Shedinja
    let v = core + 5;
    if (nature && nature.plus === k) v = Math.floor(v * 1.1);
    if (nature && nature.minus === k) v = Math.floor(v * 0.9);
    out[k] = v;
  });
  return out;
}

const sameStats = (a, b) => BASE_ORDER.every(k => a[k] === b[k]);

/**
 * Naturezas (0–24) cujo efeito reproduz exatamente os stats salvos.
 * Serve de conferência: se os stats salvos só fecharem com outra natureza, vale a que os reproduz.
 */
export function naturesMatchingStats(base, ivs, evs, level, stats) {
  const out = [];
  for (let id = 0; id < 25; id++) {
    if (sameStats(calcStats(base, ivs, evs, level, natureFromId(id)), stats)) out.push(id);
  }
  return out;
}

const HP_TYPES = ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'];

/** Tipo do Hidden Power pelos IVs (bit menos significativo de cada IV). */
export function hiddenPowerType(ivs) {
  const order = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];
  const sum = order.reduce((acc, k, i) => acc + ((ivs[k] & 1) << i), 0);
  return HP_TYPES[Math.floor((sum * 15) / 63)];
}
