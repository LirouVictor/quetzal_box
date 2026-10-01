// Busca e filtros sobre equipe + PC (funções puras).

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto pesquisável de um Pokémon: apelido, espécie, forma, golpes, habilidade e item. */
function haystack(m) {
  return norm([
    m.nickname, m.species.name, m.species.form, m.species.showdown,
    ...m.moves.map(mv => mv.name), m.ability && m.ability.name, m.item && m.item.name,
  ].filter(Boolean).join(' | '));
}

const FLAGS = {
  shiny: m => m.shiny === true,
  hidden: m => !!(m.ability && m.ability.hidden),
  female: m => !!(m.gender && m.gender.symbol === '♀'),
  male: m => !!(m.gender && m.gender.symbol === '♂'),
  iv31: m => !!m.ivs && Object.values(m.ivs).every(v => v === 31),
};

const SORTS = {
  pos: () => 0, // mantém a ordem natural (equipe, depois caixas)
  level: (a, b) => (b.level ?? 0) - (a.level ?? 0),
  name: (a, b) => norm(a.hasNickname ? a.nickname : a.species.name).localeCompare(norm(b.hasNickname ? b.nickname : b.species.name)),
  dex: (a, b) => a.speciesId - b.speciesId,
};

/**
 * @param {Array} mons equipe + PC na ordem natural
 * @param {{ q?: string, type?: string, flag?: string, sort?: string }} f
 */
export function searchMons(mons, f = {}) {
  const terms = norm(f.q).split(/\s+/).filter(Boolean);
  const flag = FLAGS[f.flag];
  const out = mons.filter(m => {
    if (f.type && !m.species.types.includes(f.type)) return false;
    if (flag && !flag(m)) return false;
    if (terms.length) {
      const h = haystack(m);
      if (!terms.every(t => h.includes(t))) return false;
    }
    return true;
  });
  const sort = SORTS[f.sort];
  return sort && f.sort !== 'pos' ? out.slice().sort(sort) : out;
}
