import { describe as suite, it, expect } from 'vitest';
import { parseSave, describe } from '../src/parser/index.js';
import T from '../src/data/tables.js';
import { toCSV, toShowdown, toJSON, fileBase } from '../src/export.js';
import { makeSave } from './helpers/make-save.js';

const d = describe(parseSave(makeSave({
  trainer: { name: 'Zoë; "x"', tid: 1, sid: 2 },
  party: [
    { pid: 13, nickname: 'Fishy', species: 1210, item: 479, level: 100, moves: [[762, 16], [97, 48]],
      evs: [0, 252, 4, 252, 0, 0], ivs: [31, 31, 31, 31, 31, 31], stats: [381, 323, 167, 280, 176, 186] },
    { pid: 15, nickname: 'Lucario', species: 448, item: 865, level: 100, moves: [[396, 32]],
      evs: [4, 0, 0, 252, 252, 0], ivs: [31, 0, 31, 31, 31, 31] },
  ],
  pc: { 2: { species: 66, nickname: 'SQSR', moves: [[43, 48]] }, 3: { species: 951, nickname: 'Raichu', moves: [[94, 16]] } },
})), T);

suite('Showdown', () => {
  const txt = toShowdown(d);
  it('equipe com apelido, item, EVs, natureza e IVs na ordem do Showdown', () => {
    expect(txt).toContain([
      'Fishy (Basculegion) @ Life Orb', 'Level: 100', 'EVs: 252 Atk / 4 Def / 252 Spe', 'Jolly Nature', '- Wave Crash', '- Agility',
    ].join('\n'));
    expect(txt).toContain('Lucario @ Lucarionite\nLevel: 100\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\nIVs: 0 Atk\n- Aura Sphere');
  });
  it('PC só com espécie e golpes; formas usam o nome do Showdown', () => {
    expect(txt).toContain('=== PC: BOX1 ===\n\nSQSR (Machop)\n- Leer\n\nRaichu-Alola\n- Psychic\n');
    expect(toShowdown(d, { includePC: false })).not.toContain('PC:');
  });
});

suite('CSV', () => {
  const csv = toCSV(d);
  const lines = csv.slice(1).trim().split('\r\n');
  it('tem BOM, cabeçalho e uma linha por Pokémon', () => {
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(lines).toHaveLength(1 + 4);
    expect(lines[0].split(';').slice(0, 4)).toEqual(['Local', 'Posição', 'Espécie', 'Forma']);
  });
  it('marca dados prováveis e deixa vazio o que não foi lido', () => {
    expect(lines[2]).toContain('Lucarionite (provável)');
    const raichu = lines[4].split(';');
    expect(raichu.slice(0, 7)).toEqual(['BOX1', '4', 'Raichu', 'Alola', '951', 'provável', 'Raichu']);
    expect(raichu[9]).toBe(''); // nível
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
