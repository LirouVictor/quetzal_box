// Testes contra o save real do autor. O arquivo não é versionado (ver .gitignore);
// coloque-o em fixtures/ (ou aponte QUETZAL_SAVE) para rodar estes testes.
import { describe as suite, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseSave, describe } from '../src/parser/index.js';
import T from '../src/data/tables.js';

const FILE = process.env.QUETZAL_SAVE || new URL('../fixtures/PokemonQuetzalPtBrAlpha9v0.sav', import.meta.url).pathname;
const has = existsSync(FILE);

suite.skipIf(!has)('save real (fixtures/PokemonQuetzalPtBrAlpha9v0.sav)', () => {
  const raw = has ? parseSave(readFileSync(FILE)) : null;
  const d = has ? describe(raw, T) : null;

  it('treinador e slot ativo', () => {
    expect(raw.trainer).toEqual({ name: 'Victor', tid: 9653, sid: 25806 });
    expect(raw.slot.saveIndex).toBe(80);
    expect(raw.warnings.filter(w => w.includes('Checksum'))).toEqual([]);
  });

  it('equipe', () => {
    const summary = d.party.map(m => [m.species.name, m.speciesId, m.level, m.nature.name, m.item?.name ?? null]);
    expect(summary).toEqual([
      ['Dragonite', 149, 100, 'Quiet', null],
      ['Staraptor', 398, 100, 'Mild', null],
      ['Serperior', 497, 100, 'Gentle', null],
      ['Reuniclus', 579, 100, 'Naughty', null],
      ['Basculegion', 1210, 100, 'Jolly', 'Life Orb'],
      ['Lucario', 448, 100, 'Modest', 'Lucarionite'],
    ]);
    const drag = d.party[0];
    expect(drag.moves.map(m => `${m.name}/${m.pp}`)).toEqual(['Hyper Beam/8', 'Brutal Swing/32', 'Dragon Rush/16', 'Safeguard/40']);
    expect(drag.stats).toEqual({ hp: 295, atk: 289, def: 195, spe: 170, spa: 257, spd: 211 });
    expect(drag.ivs).toEqual({ hp: 3, atk: 16, def: 0, spe: 24, spa: 29, spd: 6 });
    expect(drag.exp).toBe(1059860);
    expect(drag.friendship).toBe(142);
    expect(drag.ot.name).toBe('Victor');

    const basc = d.party[4];
    expect(basc.moves.map(m => m.name)).toEqual(['Wave Crash', 'Agility', 'Aqua Jet', 'Last Respects']);
    expect(basc.ivs).toEqual({ hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 });
    expect(basc.evs).toEqual({ hp: 0, atk: 252, def: 4, spe: 252, spa: 0, spd: 0 });
    expect(basc.stats).toEqual({ hp: 381, atk: 323, def: 167, spe: 280, spa: 176, spd: 186 });

    const luc = d.party[5];
    expect(luc.evs).toEqual({ hp: 4, atk: 0, def: 0, spe: 252, spa: 252, spd: 0 });
    expect(luc.stats).toEqual({ hp: 282, atk: 230, def: 176, spe: 279, spa: 361, spd: 176 });
    expect(luc.item.id).toBe(865);
    expect(raw.party.map(p => p.misc)).toEqual([0x40000000, 0x40000000, 0x40000000, 0x50000000, 0x50000000, 0x50000000]);
    // Habilidades conferidas pelo autor na tela de resumo do jogo
    expect(d.party.map(m => m.ability.name)).toEqual(['Inner Focus', 'Intimidate', 'Overgrow', 'Magic Guard', 'Adaptability', 'Inner Focus']);
  });

  it('PC', () => {
    const box = d.pc.boxes[0];
    expect(box.name).toBe('BOX1');
    expect(box.slots).toHaveLength(27);
    expect(d.pc.boxes.slice(1).every(b => b.slots.length === 0)).toBe(true);
    expect(box.slots.map(s => s.slot).filter(n => [21, 23, 26].includes(n))).toEqual([]);
    const bySlot = Object.fromEntries(box.slots.map(s => [s.slot, s]));
    expect(bySlot[1]).toMatchObject({ speciesId: 66, nickname: 'SQSR', hasNickname: true });
    expect(bySlot[1].species.name).toBe('Machop');
    expect(bySlot[1].moves.map(m => `${m.name}/${m.pp}`)).toEqual(['Leer/48', 'Rock Smash/24', 'Focus Energy/48']);
    expect(bySlot[2].moves.map(m => m.name)).toEqual(['Swords Dance', 'Bullet Punch', 'Dual Wingbeat', 'Bug Bite']);
    expect(bySlot[6].moves.map(m => `${m.name}/${m.pp}`)).toEqual(['Tackle/56', 'Growl/64', 'Ember/40']);
    expect(bySlot[29].moves.map(m => m.name)).toEqual(['Dragon Dance', 'Glaive Rush', 'Ice Shard', 'Icicle Crash']);
    expect(bySlot[30].moves.map(m => m.name)).toEqual(['Flare Blitz', 'Double-Edge', 'Head Smash', 'Extreme Speed']);
    const custom = box.slots.filter(s => s.speciesId > 905).map(s => [s.slot, s.speciesId, s.species.name]);
    expect(custom).toEqual([
      [5, 1308, 'Annihilape'], [8, 951, 'Raichu'], [22, 973, 'Weezing'],
      [25, 1469, 'Pikachu'], [29, 1327, 'Baxcalibur'], [30, 1224, 'Arcanine'],
    ]);
    expect(box.slots.filter(s => s.species.confidence === 'desconhecido')).toEqual([]);
  });

  it('PC: item, nível, natureza e habilidade', () => {
    const bySlot = Object.fromEntries(d.pc.boxes[0].slots.map(s => [s.slot, s]));
    const row = n => { const m = bySlot[n]; return [m.level, m.nature.name, m.item?.name ?? null, m.ability.name]; };
    expect(row(1)).toEqual([5, 'Rash', null, 'No Guard']);
    expect(row(2)).toEqual([59, 'Jolly', 'Scizorite', 'Technician']);
    expect(row(4)).toEqual([92, 'Adamant', 'Blazikenite', 'Speed Boost']);
    expect(row(8)).toEqual([58, 'Modest', 'Aloraichium Z', 'Surge Surfer']);
    expect(row(10)).toEqual([93, 'Modest', 'Charizardite Y', 'Solar Power']);
    expect(row(30)).toEqual([100, 'Jolly', 'Choice Band', 'Rock Head']);
    expect(bySlot[16].item).toMatchObject({ name: 'Golisopite', confidence: 'provável' });
    expect(bySlot[29].item).toMatchObject({ name: 'Baxcalibrite', confidence: 'provável' });
    expect(bySlot[1].evs).toEqual({ hp: 0, atk: 8, def: 0, spe: 0, spa: 0, spd: 0 });
  });
});

// Save do autor com Lucario e Basculegion movidos da equipe para a BOX1 (posições 21 e 23)
const FILE_PC = process.env.QUETZAL_SAVE_PC || new URL('../fixtures/PokemonQuetzalPtBrAlpha9v0-pc.sav', import.meta.url).pathname;
const hasPc = has && existsSync(FILE_PC);

suite.skipIf(!hasPc)('equipe → PC (fixtures/PokemonQuetzalPtBrAlpha9v0-pc.sav)', () => {
  const before = hasPc ? describe(parseSave(readFileSync(FILE)), T) : null;
  const after = hasPc ? describe(parseSave(readFileSync(FILE_PC)), T) : null;

  it('o mesmo Pokémon tem os mesmos dados na equipe e no PC', () => {
    expect(after.party).toHaveLength(4);
    for (const [partyIdx, slot] of [[5, 21], [4, 23]]) {
      const p = before.party[partyIdx];
      const c = after.pc.boxes[0].slots.find(s => s.slot === slot);
      expect(c.speciesId).toBe(p.speciesId);
      expect(c.exp).toBe(p.exp);
      expect(c.level).toBe(p.level);
      expect(c.nature).toEqual(p.nature);
      expect(c.item).toEqual(p.item);
      expect(c.ability).toEqual(p.ability);
      expect(c.ivs).toEqual(p.ivs);
      expect(c.evs).toEqual(p.evs);
      expect(c.moves).toEqual(p.moves);
    }
  });
});
