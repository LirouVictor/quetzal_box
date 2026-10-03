// Exportações: CSV (planilha), texto Showdown e JSON. Funções puras sobre o resultado de describe().
// Cabeçalhos e valores do CSV saem no idioma da interface; nomes do jogo (espécies, golpes…) ficam em inglês.

import { t } from './i18n.js';

export const SHOWDOWN_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABEL = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

export const allMons = d => [...d.party, ...d.pc.boxes.flatMap(b => b.slots)];

/** CSV com BOM e separador ';' (padrão do Excel em português). */
export function toCSV(d) {
  const head = [...['Local', 'Posição', 'Espécie', 'Forma', 'ID espécie', 'Espécie confirmada?', 'Apelido', 'Tipo 1', 'Tipo 2',
    'Nível', 'Experiência', 'Natureza', 'Item', 'Habilidade', 'Bola', 'Shiny', 'Gênero'].map(h => t(h)),
    ...[1, 2, 3, 4].map(n => t('Golpe {n}', { n })), 'PP 1', 'PP 2', 'PP 3', 'PP 4',
    ...SHOWDOWN_ORDER.map(k => STAT_LABEL[k]), ...SHOWDOWN_ORDER.map(k => 'IV ' + STAT_LABEL[k]), ...SHOWDOWN_ORDER.map(k => 'EV ' + STAT_LABEL[k]),
    'Stats', 'Hidden Power', t('Amizade'), t('Treinador original'), t('TID original')];
  const probable = conf => (conf === 'provável' ? ` (${t('provável')})` : '');
  const q = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = allMons(d).map(m => {
    const per = (obj) => SHOWDOWN_ORDER.map(k => (obj ? obj[k] : ''));
    return [
      m.location === 'party' ? t('Equipe') : m.where, m.slot, m.species.name, m.species.form ? t(m.species.form) : '', m.speciesId, t(m.species.confidence), m.nickname,
      m.species.types[0] || '', m.species.types[1] || '',
      m.level ?? '', m.exp ?? '', m.nature ? m.nature.name : '', m.item ? m.item.name + probable(m.item.confidence) : '',
      m.ability ? m.ability.name + (m.ability.hidden ? ` (${t('oculta')})` : '') : '',
      m.ball ? m.ball.name + probable(m.ball.confidence) : '',
      m.shiny === null || m.shiny === undefined ? '' : t(m.shiny ? 'sim' : 'não'),
      m.gender ? t(m.gender.name) : '',
      ...[0, 1, 2, 3].map(i => m.moves[i]?.name || ''), ...[0, 1, 2, 3].map(i => m.moves[i]?.pp ?? ''),
      ...per(m.stats), ...per(m.ivs), ...per(m.evs),
      m.stats ? t(m.statsCalculated ? 'calculados' : 'salvos') : '', m.hiddenPower || '',
      m.friendship ?? '', m.ot ? m.ot.name : '', m.ot ? String(m.ot.tid).padStart(5, '0') : '',
    ].map(q).join(';');
  });
  return '﻿' + [head.map(q).join(';'), ...rows].join('\r\n') + '\r\n';
}

function showdownBlock(m) {
  const sp = m.species.showdown || m.species.name;
  let first = m.hasNickname ? `${m.nickname} (${sp})` : sp;
  if (m.gender && m.gender.symbol && m.species.genderRate > 0 && m.species.genderRate < 8) first += m.gender.symbol === '♀' ? ' (F)' : ' (M)';
  if (m.item && m.item.confidence !== 'desconhecido') first += ` @ ${m.item.name}`;
  const lines = [first];
  if (m.ability && m.ability.confidence !== 'desconhecido') lines.push('Ability: ' + m.ability.name);
  if (m.level) lines.push('Level: ' + m.level);
  if (m.shiny) lines.push('Shiny: Yes');
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

/** Pokémon no formato de importação do Showdown, sem cabeçalho (para copiar e colar). */
export const showdownTeam = mons => mons.map(showdownBlock).join('\n\n') + '\n';

/** Texto no formato de importação do Pokémon Showdown. */
export function toShowdown(d, { includePC = true } = {}) {
  let out = `=== ${t('Equipe')} ===\n\n` + showdownTeam(d.party);
  if (includePC) {
    for (const b of d.pc.boxes) {
      if (!b.slots.length) continue;
      out += `\n=== PC: ${b.name} ===\n\n` + b.slots.map(showdownBlock).join('\n\n') + '\n';
    }
  }
  return out;
}

export function toJSON(d, meta = {}) {
  // 'format' é um identificador estável do arquivo (nome antigo do app), não o nome exibido.
  return JSON.stringify({ format: 'quetzal-save-viewer', version: 1, ...meta, ...d }, null, 2) + '\n';
}

export function fileBase(d) {
  const slug = (d.trainer.name || 'save').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'quetzal-' + (slug || 'save');
}
