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
  const id = pid % 25;
  const plus = NATURE_STATS[Math.floor(id / 5)], minus = NATURE_STATS[id % 5];
  return { id, name: NATURES[id], plus: plus === minus ? null : plus, minus: plus === minus ? null : minus };
}

export const CONFIRMED = 'confirmado';
export const PROBABLE = 'provável';
export const UNKNOWN = 'desconhecido';

const MAX_DEX = 905;
const LAST_GEN8_ICON = 898;

/**
 * @param {object} T tabelas: { species, moves, items, types, forms, overrides }
 */
export function makeResolver(T) {
  const typeName = i => T.types[i] || null;

  function species(id, nickname) {
    const ov = T.overrides.species[id];
    if (ov) {
      const form = ov.pokeapi ? T.forms[ov.pokeapi] : null;
      return {
        name: ov.name,
        form: ov.form || null,
        showdown: ov.showdown || ov.name,
        confidence: ov.confidence,
        evidence: ov.evidence || null,
        spriteId: form ? form.id : null,
        hasIcon: form ? form.icon : false,
        types: form ? form.types.map(typeName).filter(Boolean) : [],
      };
    }
    if (id >= 1 && id <= MAX_DEX && T.species[id]) {
      const [name, ...types] = T.species[id];
      return {
        name, form: null, showdown: showdownSpecies(name), confidence: CONFIRMED, evidence: null,
        spriteId: id, hasIcon: id <= LAST_GEN8_ICON, types: types.map(typeName).filter(Boolean),
      };
    }
    return {
      name: nickname || `Espécie ${id}`,
      form: null,
      showdown: nickname || null,
      confidence: UNKNOWN,
      evidence: nickname ? 'ID próprio do Quetzal ainda não mapeado; nome tirado do apelido.' : 'ID próprio do Quetzal ainda não mapeado.',
      spriteId: null, hasIcon: false, types: [],
    };
  }

  function move(m) {
    const row = T.moves[m.id];
    return { id: m.id, name: row ? row[0] : `Golpe ${m.id}`, type: row ? typeName(row[1]) : null, pp: m.pp };
  }

  function item(id) {
    if (!id) return null;
    const ov = T.overrides.items[id];
    if (ov) return { id, name: ov.name, confidence: ov.confidence, evidence: ov.evidence || null };
    const name = T.items[id];
    return name ? { id, name, confidence: CONFIRMED, evidence: null } : { id, name: `Item ${id}`, confidence: UNKNOWN, evidence: null };
  }

  return { species, move, item };
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
      exp: p.exp,
      nature: natureFromPid(p.pid),
      item: R.item(p.itemId),
      ability: null,
      friendship: p.friendship,
      ot: { name: p.otName, tid: p.otId & 0xFFFF, sid: p.otId >>> 16 },
      pid: p.pid,
      moves: p.moves.map(R.move),
      stats: p.stats, ivs: p.ivs, evs: p.evs,
      unknown: { unk54: '0x' + p.unk54.toString(16).padStart(8, '0') },
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
        level: null, exp: null, nature: null, item: null, ability: null, friendship: null,
        ot: null, pid: null,
        moves: s.moves.map(R.move),
        stats: null, ivs: null, evs: null,
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
    pc: { currentBox: raw.pc.currentBox, declaredBoxes: raw.pc.declaredBoxes, capacity: raw.pc.capacity, boxes },
  };
}

export { STAT_ORDER };
