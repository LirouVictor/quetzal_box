// Converte os dados crus de parseSave() em objetos prontos para a UI e exportações,
// resolvendo nomes e tipos com as tabelas de src/data.

import { STAT_ORDER } from './save.js';

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

export const CONFIRMED = 'confirmado';
export const PROBABLE = 'provável';
export const UNKNOWN = 'desconhecido';

const MAX_DEX = 905;
const LAST_GEN8_ICON = 898;

/** Curva Medium Slow: no Quetzal vale para todas as espécies (níveis do PC conferidos no jogo). */
export const mediumSlow = n => (n <= 1 ? 0 : Math.floor((6 * n ** 3) / 5) - 15 * n * n + 100 * n - 140);

export function levelFromExp(exp) {
  let level = 1;
  while (level < 100 && mediumSlow(level + 1) <= exp) level++;
  return level;
}

/**
 * @param {object} T tabelas: { species, moves, items, types, forms, overrides }
 */
export function makeResolver(T) {
  const typeName = i => T.types[i] || null;
  const abilityName = i => (i ? T.abilityNames[i] : null);

  function species(id, nickname) {
    const ov = T.overrides.species[id];
    if (ov) {
      const form = ov.pokeapi ? T.forms[ov.pokeapi] : null;
      // Forma sem correspondência: tipos e habilidades da espécie base, como "provável".
      const base = !form && ov.baseDex && T.species[ov.baseDex] ? ov.baseDex : null;
      return {
        name: ov.name,
        form: ov.form || null,
        showdown: ov.showdown || ov.name,
        confidence: ov.confidence,
        evidence: ov.evidence || null,
        spriteId: form ? form.id : null,
        hasIcon: form ? form.icon : false,
        types: form ? form.types.map(typeName).filter(Boolean)
          : base ? T.species[base].slice(1).map(typeName).filter(Boolean) : [],
        abilities: form ? form.abilities
          : base ? (T.speciesAbilities[base] || [0, 0, 0]).map(abilityName) : [null, null, null],
        traitsFromBase: !!base,
      };
    }
    if (id >= 1 && id <= MAX_DEX && T.species[id]) {
      const [name, ...types] = T.species[id];
      return {
        name, form: null, showdown: showdownSpecies(name), confidence: CONFIRMED, evidence: null,
        spriteId: id, hasIcon: id <= LAST_GEN8_ICON, types: types.map(typeName).filter(Boolean),
        abilities: (T.speciesAbilities[id] || [0, 0, 0]).map(abilityName),
      };
    }
    return {
      name: nickname || `Espécie ${id}`,
      form: null,
      showdown: nickname || null,
      confidence: UNKNOWN,
      evidence: nickname ? 'ID próprio do Quetzal ainda não mapeado; nome tirado do apelido.' : 'ID próprio do Quetzal ainda não mapeado.',
      spriteId: null, hasIcon: false, types: [], abilities: [null, null, null],
    };
  }

  /** Habilidade pelo número guardado no save (0 = 1ª, 1 = 2ª, 2 = oculta). */
  function ability(sp, num) {
    if (num > 2) return { num, name: `Habilidade nº ${num}`, hidden: false, confidence: UNKNOWN };
    // Como no expansion: se o slot estiver vazio, vale a primeira habilidade existente.
    const name = sp.abilities[num] || sp.abilities.find(Boolean) || null;
    if (!name) return { num, name: num === 2 ? 'Habilidade oculta' : `Habilidade ${num + 1}`, hidden: num === 2, confidence: UNKNOWN };
    return { num, name, hidden: num === 2, confidence: sp.confidence === CONFIRMED && !sp.traitsFromBase ? CONFIRMED : PROBABLE };
  }

  function move(m) {
    const row = T.moves[m.id];
    return { id: m.id, name: row ? row[0] : `Golpe ${m.id}`, type: row ? typeName(row[1]) : null, pp: m.pp };
  }

  function item(id) {
    if (!id) return null;
    const ov = T.overrides.items[id];
    if (ov) return { id, name: ov.name, confidence: ov.confidence, evidence: ov.evidence || null };
    if (id >= T.overrides.itemsDivergeFrom) {
      return { id, name: `Item ${id}`, confidence: UNKNOWN, evidence: 'Nesta faixa de IDs a tabela de itens do Quetzal diverge do pokeemerald-expansion.' };
    }
    const name = T.items[id];
    if (!name) return { id, name: `Item ${id}`, confidence: UNKNOWN, evidence: null };
    if (id > T.overrides.itemsVerifiedUpTo) {
      return { id, name, confidence: PROBABLE, evidence: 'Nome da tabela do pokeemerald-expansion; nesta faixa de IDs a numeração do Quetzal ainda não foi conferida.' };
    }
    return { id, name, confidence: CONFIRMED, evidence: null };
  }

  return { species, move, item, ability };
}

const SHOWDOWN_NAMES = { 'Nidoran♀': 'Nidoran-F', 'Nidoran♂': 'Nidoran-M' };
const showdownSpecies = name => SHOWDOWN_NAMES[name] || name;

const sameName = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

/**
 * @param {ReturnType<import('./save.js').parseSave>} raw
 * @param {object} T tabelas
 */
export function describe(raw, T) {
  const R = makeResolver(T);

  const party = raw.party.map(p => {
    const sp = R.species(p.speciesId, p.nickname);
    return {
      location: 'party',
      where: 'Equipe',
      boxIndex: null,
      slot: p.slot,
      speciesId: p.speciesId,
      species: sp,
      nickname: p.nickname || sp.name,
      hasNickname: !!p.nickname && !sameName(p.nickname, sp.name),
      complete: true,
      level: p.level,
      levelFromExp: false,
      exp: p.exp,
      nature: natureFromPid(p.pid),
      item: R.item(p.itemId),
      ability: R.ability(sp, p.abilityNum),
      friendship: p.friendship,
      ot: { name: p.otName, tid: p.otId & 0xFFFF, sid: p.otId >>> 16 },
      pid: p.pid,
      moves: p.moves.map(R.move),
      stats: p.stats, ivs: p.ivs, evs: p.evs,
      unknown: { misc54: '0x' + p.misc.toString(16).padStart(8, '0') },
      raw: p.raw,
    };
  });

  const boxes = raw.pc.boxes.map(b => ({
    index: b.index,
    name: b.name,
    partial: b.partial,
    slots: b.slots.map(s => {
      const sp = R.species(s.speciesId, s.nickname);
      return {
        location: 'pc',
        where: b.name,
        boxIndex: b.index,
        slot: s.slot,
        speciesId: s.speciesId,
        species: sp,
        nickname: s.nickname || sp.name,
        hasNickname: !!s.nickname && !sameName(s.nickname, sp.name),
        complete: false,
        level: levelFromExp(s.exp),
        levelFromExp: true,
        exp: s.exp,
        nature: natureFromId(s.natureId),
        item: R.item(s.itemId),
        ability: R.ability(sp, s.abilityNum),
        friendship: null, ot: null, pid: null,
        moves: s.moves.map(R.move),
        stats: null, ivs: s.ivs, evs: s.evs,
        raw: s.raw,
      };
    }),
  }));

  return {
    trainer: {
      name: raw.trainer.name,
      tid: raw.trainer.tid,
      sid: raw.trainer.sid,
      saveIndex: raw.slot.saveIndex,
    },
    warnings: raw.warnings,
    party,
    pc: { currentBox: raw.pc.currentBox, boxCount: raw.pc.boxCount, capacity: raw.pc.capacity, boxes },
  };
}

export { STAT_ORDER };
