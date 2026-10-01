import { describe as suite, it, expect } from 'vitest';
import { calcStats, naturesMatchingStats, hiddenPowerType } from '../src/parser/stats.js';
import { natureFromId } from '../src/parser/natures.js';
import { analyzeTeam } from '../src/analysis.js';
import T from '../src/data/tables.js';

const all = v => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v });

suite('calcStats', () => {
  it('reproduz o Lucario da equipe (Modest, 31 IVs, 4/252/252)', () => {
    const base = T.baseStats[448];
    const evs = { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 };
    expect(calcStats(base, all(31), evs, 100, natureFromId(15))).toEqual({ hp: 282, atk: 230, def: 176, spa: 361, spd: 176, spe: 279 });
  });
  it('detecta a natureza que vale para os stats', () => {
    const base = T.baseStats[448];
    const evs = { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 };
    const stats = calcStats(base, all(31), evs, 100, natureFromId(15));
    expect(naturesMatchingStats(base, all(31), evs, 100, stats)).toEqual([15]);
  });
});

suite('hiddenPowerType', () => {
  it('IVs 31 em tudo = Dark; IVs 30 em tudo = Fighting', () => {
    expect(hiddenPowerType(all(31))).toBe('dark');
    expect(hiddenPowerType(all(30))).toBe('fighting');
  });
  it('Fire clássico (30 Atk / 30 SpA / 30 Spe)', () => {
    expect(hiddenPowerType({ hp: 31, atk: 30, def: 31, spa: 30, spd: 31, spe: 30 })).toBe('fire');
  });
});

suite('analyzeTeam', () => {
  const mon = (types, moves = []) => ({ species: { types }, moves });
  const party = [
    mon(['dragon', 'flying'], [{ type: 'dragon', category: 0 }, { type: 'normal', category: 2 }]),
    mon(['grass'], [{ type: 'grass', category: 1 }]),
    mon(['water', 'ghost'], [{ type: 'water', category: 0 }]),
  ];
  const a = analyzeTeam(party, { types: T.types, chart: T.typechart });
  const row = t => a.defense.find(r => r.type === t);
  it('conta fraquezas, resistências e imunidades', () => {
    expect(row('ice').weak.length).toBe(2); // Dragonite (x4) e grama
    expect(row('ground').immune.length).toBe(1); // voador
    expect(row('normal').immune.length).toBe(1); // fantasma
    expect(row('fire').resist.length).toBe(2); // dragão e água
  });
  it('cobertura só com golpes de dano', () => {
    expect(a.moveTypes.sort()).toEqual(['dragon', 'grass', 'water']);
    expect(a.coverage).toContain('fire');
    expect(a.coverage).not.toContain('normal');
  });
});
