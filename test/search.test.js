import { describe as suite, it, expect } from 'vitest';
import { searchMons } from '../src/search.js';

const mon = (o) => ({
  nickname: o.nick || o.sp, hasNickname: !!o.nick, speciesId: o.id, level: o.lv,
  species: { name: o.sp, form: o.form || null, showdown: o.sp, types: o.types },
  moves: (o.moves || []).map(name => ({ name })), ability: { name: o.ab || 'Static', hidden: !!o.hidden },
  item: o.item ? { name: o.item } : null, shiny: !!o.shiny, gender: o.g ? { symbol: o.g } : null,
  ivs: o.ivs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
});
const all31 = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const mons = [
  mon({ sp: 'Charizard', id: 6, lv: 93, types: ['fire', 'flying'], moves: ['Flamethrower', 'Solar Beam'], shiny: true, g: '♂', hidden: true, ivs: all31 }),
  mon({ sp: 'Machop', nick: 'SQSR', id: 66, lv: 5, types: ['fighting'], moves: ['Leer'], g: '♂' }),
  mon({ sp: 'Raichu', form: 'Alola', id: 951, lv: 58, types: ['electric', 'psychic'], moves: ['Psychic'], item: 'Aloraichium Z', g: '♀' }),
];

suite('searchMons', () => {
  const names = r => r.map(m => m.species.name);
  it('busca por apelido, espécie, forma, golpe e item (sem acento/maiúscula)', () => {
    expect(names(searchMons(mons, { q: 'sqsr' }))).toEqual(['Machop']);
    expect(names(searchMons(mons, { q: 'solar beam' }))).toEqual(['Charizard']);
    expect(names(searchMons(mons, { q: 'alola' }))).toEqual(['Raichu']);
    expect(names(searchMons(mons, { q: 'ALORAICHIUM' }))).toEqual(['Raichu']);
  });
  it('filtros e tipo', () => {
    expect(names(searchMons(mons, { flag: 'shiny' }))).toEqual(['Charizard']);
    expect(names(searchMons(mons, { flag: 'female' }))).toEqual(['Raichu']);
    expect(names(searchMons(mons, { flag: 'iv31' }))).toEqual(['Charizard']);
    expect(names(searchMons(mons, { flag: 'hidden' }))).toEqual(['Charizard']);
    expect(names(searchMons(mons, { type: 'psychic' }))).toEqual(['Raichu']);
  });
  it('ordenação', () => {
    expect(names(searchMons(mons, { sort: 'level' }))).toEqual(['Charizard', 'Raichu', 'Machop']);
    expect(names(searchMons(mons, { sort: 'dex' }))).toEqual(['Charizard', 'Machop', 'Raichu']);
    expect(names(searchMons(mons, { sort: 'name' }))).toEqual(['Charizard', 'Raichu', 'Machop']); // SQSR por último
  });
});
