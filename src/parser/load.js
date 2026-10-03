// Abre um save de qualquer jogo suportado: tira o embrulho (.sps), identifica o formato e só então lê.
// Save que não bate com nenhum formato conhecido gera erro claro, em vez de dados parecidos com os certos.

import { t } from '../i18n.js';
import { parseSave, SaveError, SAVE_SIZE, isQuetzalLayout } from './save.js';
import { describe } from './describe.js';
import { calcStats } from './stats.js';
import { unwrap } from './container.js';
import { detectGen3, parseGen3, describeGen3, gen3Tables } from './gen3.js';
import { unboundSignature, parseUnbound, describeUnbound } from './unbound.js';

export const QUETZAL = { id: 'quetzal', name: 'Pokémon Quetzal', short: 'Quetzal', note: 'testado na Alpha 9 (PT-BR)' };

/** Jogos suportados, para mostrar na tela inicial e nas mensagens de erro. */
export const SUPPORTED = [
  'Pokémon Quetzal (testado na Alpha 9 PT-BR)',
  'Pokémon Emerald',
  'Pokémon FireRed / LeafGreen',
  'Pokémon Ruby / Sapphire (mesmo formato; ainda sem save real para testar)',
  'Pokémon Unbound (2.1)',
];

/** O save é do Unbound? (as tabelas dele são carregadas à parte, só quando precisa) */
export function isUnbound(input) {
  return unboundSignature(unwrap(input).bytes) !== null;
}

const unsupported = () => t('Este save não é de um jogo suportado pelo savDex. Jogos suportados: {list}.', { list: SUPPORTED.map(s => s.replace(/ \(.*\)$/, '')).join(', ') });

/**
 * Confere se o save com o layout do Quetzal tem dados coerentes: os stats salvos da equipe precisam
 * bater com a fórmula. Outro jogo com o mesmo layout de setores cai aqui e é recusado.
 */
function checkQuetzal(data) {
  const known = data.party.filter(m => m.species.baseStats && m.nature);
  const ok = known.filter(m => {
    const calc = calcStats(m.species.baseStats, m.ivs, m.evs, m.level, m.nature);
    return Object.keys(calc).every(k => calc[k] === m.stats[k]);
  });
  const levelsOk = data.party.every(m => m.level >= 1 && m.level <= 100);
  if (!levelsOk || (known.length && ok.length * 2 < known.length)) {
    throw new SaveError(t('Este save tem o mesmo layout do Quetzal, mas os dados não batem com o formato dele (talvez seja outro hack ou outra versão). Ele não é suportado.'));
  }
}

/**
 * @param {ArrayBuffer|Uint8Array} input
 * @param {object} T tabelas do app (src/data/tables.js)
 * @param {object} G tabelas da Gen 3 (src/data/gen3.json)
 * @param {object} [U] tabelas do Unbound (src/data/unbound.json), só para saves do Unbound
 * @returns {{ data: object, T: object }} dados descritos e as tabelas que valem para esse jogo
 */
export function loadSave(input, T, G, U = null) {
  const { bytes } = unwrap(input);
  if (bytes.length < SAVE_SIZE) {
    throw new SaveError(t('O arquivo tem {n} bytes; um save de Pokémon de GBA tem {size} (128 KB).', { n: bytes.length, size: SAVE_SIZE }));
  }
  if (isQuetzalLayout(bytes)) {
    const data = describe(parseSave(bytes), T);
    checkQuetzal(data);
    data.game = QUETZAL;
    return { data, T };
  }
  if (unboundSignature(bytes) !== null) {
    if (!U) throw new Error('Tabelas do Unbound não carregadas');
    return { data: describeUnbound(parseUnbound(bytes), T, U), T };
  }
  const g3 = detectGen3(bytes);
  if (g3) {
    const T3 = gen3Tables(T, G);
    return { data: describeGen3(parseGen3(bytes, g3), T3, g3.game), T: T3 };
  }
  throw new SaveError(unsupported());
}
