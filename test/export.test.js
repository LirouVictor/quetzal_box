import { describe as suite, it, expect } from 'vitest';
import { parseSave, describe } from '../src/parser/index.js';
import T from '../src/data/tables.js';
import { toCSV, toShowdown, toJSON, fileBase } from '../src/export.js';
import { makeSave } from './helpers/make-save.js';

const d = describe(parseSave(makeSave({
  trainer: { name: 'Zoë; "x"', tid: 1, sid: 2 },
  party: [
    { pid: 13, nickname: 'Fishy', species: 1210, item: 479, level: 100, abilityNum: 1, moves: [[762, 16], [97, 48]],
      evs: [0, 252, 4, 252, 0, 0], ivs: [31, 31, 31, 31, 31, 31], stats: [381, 323, 167, 280, 176, 186] },
    { pid: 15, nickname: 'Lucario', species: 448, item: 865, level: 100, moves: [[396, 32]],
      evs: [4, 0, 0, 252, 252, 0], ivs: [31, 0, 31, 31, 31, 31] },
  ],
  pc: {
    2: { species: 66, nickname: 'SQSR', moves: [[43, 48]], exp: 150, nature: 19, ivs: [31, 31, 31, 31, 31, 31], abilityNum: 1 },
    3: { species: 951, nickname: 'Raichu', moves: [[94, 16]], item: 389, exp: 199100, nature: 15, ivs: [31, 31, 31, 31, 31, 31], evs: [4, 0, 0, 252, 252, 0], ball: 2, shiny: true },
    4: { species: 26, moves: [[85, 24]], item: 866, exp: 1059860 },
  },
})), T);

suite('Showdown', () => {
  const txt = toShowdown(d);
  it('equipe com apelido, item, EVs, natureza e IVs na ordem do Showdown', () => {
    expect(txt).toContain([
      'Fishy (Basculegion) @ Life Orb', 'Ability: Adaptability', 'Level: 100', 'EVs: 252 Atk / 4 Def / 252 Spe', 'Jolly Nature', '- Wave Crash', '- Agility',
    ].join('\n'));
    expect(txt).toContain('Lucario @ Lucarionite Z\nAbility: Steadfast\nLevel: 100\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\nIVs: 0 Atk\n- Aura Sphere');
  });
  it('PC com nível, natureza, item e habilidade; formas usam o nome do Showdown', () => {
    expect(txt).toContain('=== PC: BOX1 ===\n\nSQSR (Machop)\nAbility: No Guard\nLevel: 5\nRash Nature\n- Leer\n\n');
    expect(txt).toContain('Raichu-Alola @ Aloraichium Z\nAbility: Surge Surfer\nLevel: 58\nShiny: Yes\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\n- Psychic\n');
  });
  it('item não mapeado não vai para o Showdown', () => {
    expect(txt).toContain('Raichu\nAbility: Static\nLevel: 100\nHardy Nature\nIVs: 0 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 0 Spe\n- Thunderbolt');
    expect(toShowdown(d, { includePC: false })).not.toContain('PC:');
  });
});

suite('CSV', () => {
  const csv = toCSV(d);
  const lines = csv.slice(1).trim().split('\r\n');
  it('tem BOM, cabeçalho e uma linha por Pokémon', () => {
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(lines).toHaveLength(1 + 5);
    expect(lines[0].split(';').slice(0, 4)).toEqual(['Local', 'Posição', 'Espécie', 'Forma']);
  });
  it('marca dados prováveis e deixa vazio o que não é guardado', () => {
    expect(lines[2]).toContain(';Lucarionite Z;');
    const raichu = lines[4].split(';');
    expect(raichu.slice(0, 14)).toEqual(['BOX1', '4', 'Raichu', 'Alola', '951', 'confirmado', 'Raichu', 'electric', 'psychic',
      '58', '199100', 'Modest', 'Aloraichium Z', 'Surge Surfer']);
    expect(raichu.slice(14, 16)).toEqual(['Great Ball', 'sim']); // bola e shiny
    expect(raichu[24]).toBe(''); // HP (stats não são guardados no PC)
    expect(lines[5].split(';')[12]).toBe('Item 866');
  });
});

suite('JSON e nome de arquivo', () => {
  it('JSON é válido e traz o treinador', () => {
    const j = JSON.parse(toJSON(d));
    expect(j.format).toBe('quetzal-save-viewer');
    expect(j.party).toHaveLength(2);
  });
  it('nome de arquivo seguro', () => {
    expect(fileBase(d)).toBe('quetzal-zoe-x');
  });
});
