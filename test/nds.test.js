import { describe as suite, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { loadSave, isNds } from '../src/parser/load.js';
import { calcStats } from '../src/parser/stats.js';
import { makeHgssSave, makeBwSave, wrapDuc } from './helpers/make-nds.js';
import T from '../src/data/tables.js';
import G from '../src/data/gen3.json';
import N from '../src/data/nds.json';

const trainer = { name: 'Lyra', tid: 12345, sid: 54321 };
const otId = ((trainer.sid << 16) | trainer.tid) >>> 0;
const shinyPid = (((trainer.tid ^ trainer.sid) << 16) | 3) >>> 0;
const load = bytes => loadSave(bytes, T, G, null, N).data;
const sameStats = m => calcStats(m.species.baseStats, m.ivs, m.evs, m.level, m.nature);

suite('Jogos de DS: HeartGold/SoulSilver e Black/White', () => {
  it('HG/SS (.duc): treinador, equipe com stats salvos, PC, forma, gênero, natureza pelo PID e golpes da Gen 4', () => {
    const save = wrapDuc(makeHgssSave({
      trainer, boxNames: ['FAVES'],
      party: [{ pid: shinyPid, otId, species: 35, ability: 56, item: 234, exp: 1000000, level: 100, moves: [[204, 32]], ivs: [31, 31, 31, 31, 31, 31], stats: [345, 189, 196, 166, 222, 228], female: true }],
      pc: { 0: { pid: 25, otId, species: 479, form: 2, ability: 26, exp: 1000, genderless: true, nickname: 'SPARKY' } },
    }));
    expect(isNds(save)).toBe(true);
    const d = load(save);
    expect(d.game).toMatchObject({ id: 'hgss', gen: 4 });
    expect(d.trainer).toMatchObject({ name: 'Lyra', tid: 12345, sid: 54321, saveIndex: 5 });
    const c = d.party[0];
    expect(c.species).toMatchObject({ name: 'Clefairy', types: ['normal'] }); // Normal até a Gen 5
    expect(c).toMatchObject({ level: 100, shiny: true });
    expect(c.gender.name).toBe('fêmea');
    expect(c.item.name).toBe('Leftovers');
    expect(c.ability.name).toBe('Cute Charm');
    expect(c.nature.id).toBe(shinyPid % 25);
    expect(c.moves.map(m => [m.name, m.type, m.pp])).toEqual([['Charm', 'normal', 32]]); // Charm era Normal
    expect(Object.values(c.stats)).toEqual([345, 189, 196, 166, 222, 228]);
    const rotom = d.pc.boxes[0].slots[0];
    expect(d.pc.boxes[0].name).toBe('FAVES');
    expect(rotom.species).toMatchObject({ name: 'Rotom', form: 'Wash', types: ['electric', 'ghost'] }); // Electric/Water só na Gen 5
    expect(rotom).toMatchObject({ nickname: 'SPARKY', hasNickname: true });
    expect(rotom.gender.name).toBe('sem gênero');
    expect(rotom.stats).toEqual(sameStats(rotom));
  });

  it('Black/White: natureza e habilidade oculta guardadas no Pokémon; Black 2/White 2 com aviso', () => {
    const save = makeBwSave({
      trainer,
      party: [{ pid: 7, otId, species: 643, ability: 163, item: 267, exp: 1250000, level: 100, nature: 15, moves: [[406, 16]], stats: [341, 220, 236, 279, 438, 277], genderless: true }],
      pc: { 31: { pid: 9, otId, species: 9, ability: 44, hidden: true, nature: 5, exp: 125000 } },
    });
    const d = load(save);
    expect(d.game.id).toBe('bw');
    expect(d.warnings).toEqual([]);
    const r = d.party[0];
    expect(r.species.name).toBe('Reshiram');
    expect(r.nature.name).toBe('Modest');
    expect([r.item.name, r.ability.name, r.moves[0].name]).toEqual(['Wise Glasses', 'Turboblaze', 'Dragon Pulse']);
    const b = d.pc.boxes[1].slots[0];
    expect(b).toMatchObject({ slot: 2 });
    expect(b.ability).toMatchObject({ name: 'Rain Dish', hidden: true });
    expect(b.nature.name).toBe('Bold');
    const b2 = load(makeBwSave({ trainer, version: 23, party: [{ pid: 1, otId, species: 1, level: 5 }] }));
    expect(b2.game.id).toBe('b2w2');
    expect(b2.warnings.join(' ')).toMatch(/ainda não foi conferido/);
  });
});

// Saves reais (exports do Action Replay DS): HeartGold/SoulSilver e Black
suite.skipIf(!existsSync('fixtures/hgss.duc') || !existsSync('fixtures/bw.duc'))('Jogos de DS com saves reais', () => {
  it('HG/SS: checksums, stats da equipe = fórmula, formas e 354 Pokémon no PC', () => {
    const d = load(readFileSync('fixtures/hgss.duc'));
    expect(d.game.id).toBe('hgss');
    expect(d.trainer).toMatchObject({ name: 'Memory', tid: 58613, sid: 35994 });
    expect(d.warnings).toEqual([]);
    for (const m of d.party) expect(sameStats(m)).toEqual(m.stats);
    const pc = d.pc.boxes.flatMap(b => b.slots);
    expect(pc).toHaveLength(354);
    expect(pc.filter(m => m.species.confidence !== 'confirmado' || m.ability.confidence !== 'confirmado')).toEqual([]);
    const forms = new Set(pc.filter(m => m.species.form).map(m => `${m.species.name}-${m.species.form}`));
    for (const f of ['Rotom-Wash', 'Giratina-Origin', 'Deoxys-Speed', 'Unown-B']) expect(forms.has(f)).toBe(true);
  });

  it('Black: checksums, stats da equipe = fórmula (Reshiram) e 457 Pokémon no PC', () => {
    const d = load(readFileSync('fixtures/bw.duc'));
    expect(d.game.id).toBe('bw');
    expect(d.party[0].species.name).toBe('Reshiram');
    for (const m of d.party) expect(sameStats(m)).toEqual(m.stats);
    expect(d.pc.boxes.flatMap(b => b.slots)).toHaveLength(457);
    expect(d.pc.boxes[0].name).toBe('HAVE FUN');
  });
});
