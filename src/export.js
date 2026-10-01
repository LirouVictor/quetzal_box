// Exportações: CSV (planilha), texto Showdown e JSON. Funções puras sobre o resultado de describe().

export const SHOWDOWN_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABEL = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

export const allMons = d => [...d.party, ...d.pc.boxes.flatMap(b => b.slots)];

/** CSV com BOM e separador ';' (padrão do Excel em português). */
export function toCSV(d) {
  const head = ['Local', 'Posição', 'Espécie', 'Forma', 'ID espécie', 'Espécie confirmada?', 'Apelido', 'Tipo 1', 'Tipo 2',
    'Nível', 'Natureza', 'Item', 'Habilidade',
    'Golpe 1', 'Golpe 2', 'Golpe 3', 'Golpe 4', 'PP 1', 'PP 2', 'PP 3', 'PP 4',
    ...SHOWDOWN_ORDER.map(k => STAT_LABEL[k]), ...SHOWDOWN_ORDER.map(k => 'IV ' + STAT_LABEL[k]), ...SHOWDOWN_ORDER.map(k => 'EV ' + STAT_LABEL[k]),
    'Amizade', 'Treinador original', 'TID original'];
  const q = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = allMons(d).map(m => {
    const per = (obj) => SHOWDOWN_ORDER.map(k => (obj ? obj[k] : ''));
    return [
      m.where, m.slot, m.species.name, m.species.form || '', m.speciesId, m.species.confidence, m.nickname,
      m.species.types[0] || '', m.species.types[1] || '',
      m.level ?? '', m.nature ? m.nature.name : '', m.item ? m.item.name + (m.item.confidence === 'provável' ? ' (provável)' : '') : '',
      m.ability ? m.ability.name : '',
      ...[0, 1, 2, 3].map(i => m.moves[i]?.name || ''), ...[0, 1, 2, 3].map(i => m.moves[i]?.pp ?? ''),
      ...per(m.stats), ...per(m.ivs), ...per(m.evs),
      m.friendship ?? '', m.ot ? m.ot.name : '', m.ot ? String(m.ot.tid).padStart(5, '0') : '',
    ].map(q).join(';');
  });
  return '﻿' + [head.map(q).join(';'), ...rows].join('\r\n') + '\r\n';
}

function showdownBlock(m) {
  const sp = m.species.showdown || m.species.name;
  let first = m.hasNickname ? `${m.nickname} (${sp})` : sp;
  if (m.item) first += ` @ ${m.item.name}`;
  const lines = [first];
  if (m.ability) lines.push('Ability: ' + m.ability.name);
  if (m.level) lines.push('Level: ' + m.level);
  if (m.evs) {
    const evs = SHOWDOWN_ORDER.filter(k => m.evs[k]).map(k => `${m.evs[k]} ${STAT_LABEL[k]}`);
    if (evs.length) lines.push('EVs: ' + evs.join(' / '));
  }
  if (m.nature) lines.push(m.nature.name + ' Nature');
  if (m.ivs) {
    const ivs = SHOWDOWN_ORDER.filter(k => m.ivs[k] !== 31).map(k => `${m.ivs[k]} ${STAT_LABEL[k]}`);
    if (ivs.length) lines.push('IVs: ' + ivs.join(' / '));
  }
  for (const mv of m.moves) lines.push('- ' + mv.name);
  return lines.join('\n');
}

/** Texto no formato de importação do Pokémon Showdown. */
export function toShowdown(d, { includePC = true } = {}) {
  let out = '=== Equipe ===\n\n' + d.party.map(showdownBlock).join('\n\n') + '\n';
  if (includePC) {
    for (const b of d.pc.boxes) {
      if (!b.slots.length) continue;
      out += `\n=== PC: ${b.name} ===\n\n` + b.slots.map(showdownBlock).join('\n\n') + '\n';
    }
  }
  return out;
}

export function toJSON(d, meta = {}) {
  return JSON.stringify({ format: 'quetzal-save-viewer', version: 1, ...meta, ...d }, null, 2) + '\n';
}

export function fileBase(d) {
  const slug = (d.trainer.name || 'save').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'quetzal-' + (slug || 'save');
}
