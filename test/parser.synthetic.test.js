import { describe as suite, it, expect } from 'vitest';
import { parseSave, SaveError, describe, natureFromPid } from '../src/parser/index.js';
import { sectorChecksum, SECTOR_SIZE, FOOTER } from '../src/parser/save.js';
import T from '../src/data/tables.js';
import { makeSave } from './helpers/make-save.js';

const base = {
  trainer: { name: 'Ash', tid: 12345, sid: 54321 },
  party: [
    {
      pid: 15, nickname: 'Sparky', species: 25, item: 479, exp: 1000, friendship: 70, level: 22,
      moves: [[85, 24], [98, 48]], evs: [1, 2, 3, 4, 5, 6], ivs: [31, 0, 15, 30, 1, 2], stats: [50, 40, 30, 60, 45, 35],
    },
    { pid: 3, nickname: 'Annihilape', species: 1308, item: 865, level: 50, moves: [[889, 16]] },
  ],
  pc: {
    0: { species: 66, nickname: 'SQSR', moves: [[43, 48], [249, 24], [116, 48]] },
    31: { species: 951, nickname: 'Raichu', moves: [[521, 32], [94, 16]] },
    45: { species: 1469, nickname: 'Pikachu', moves: [[394, 32]] },
    1150: { species: 4, nickname: '' },
  },
  olderSlot: { trainer: { name: 'Old', tid: 1, sid: 2 } },
};

suite('parseSave (save sintético)', () => {
  const raw = parseSave(makeSave(base));

  it('escolhe o slot com maior save index', () => {
    expect(raw.slot.saveIndex).toBe(10);
    expect(raw.trainer).toEqual({ name: 'Ash', tid: 12345, sid: 54321 });
  });

  it('lê a equipe sem criptografia', () => {
    expect(raw.party).toHaveLength(2);
    const p = raw.party[0];
    expect(p).toMatchObject({ slot: 1, pid: 15, nickname: 'Sparky', otName: 'Ash', speciesId: 25, itemId: 479, exp: 1000, friendship: 70, level: 22 });
    expect(p.moves).toEqual([{ id: 85, pp: 24 }, { id: 98, pp: 48 }]);
    expect(p.evs).toEqual({ hp: 1, atk: 2, def: 3, spe: 4, spa: 5, spd: 6 });
    expect(p.ivs).toEqual({ hp: 31, atk: 0, def: 15, spe: 30, spa: 1, spd: 2 });
    expect(p.stats).toEqual({ hp: 50, atk: 40, def: 30, spe: 60, spa: 45, spd: 35 });
    expect(p.otId).toBe((12345 | (54321 << 16)) >>> 0);
  });

  it('lê o PC compactado em bits, inclusive a última caixa parcial', () => {
    const box1 = raw.pc.boxes[0];
    expect(box1.name).toBe('BOX1');
    expect(box1.slots[0]).toMatchObject({ slot: 1, speciesId: 66, nickname: 'SQSR' });
    expect(box1.slots[0].moves).toEqual([{ id: 43, pp: 48 }, { id: 249, pp: 24 }, { id: 116, pp: 48 }]);
    expect(raw.pc.boxes[1].slots.map(s => [s.slot, s.speciesId])).toEqual([[2, 951], [16, 1469]]);
    expect(raw.pc.capacity).toBe(1152);
    expect(raw.pc.boxes).toHaveLength(39);
    expect(raw.pc.boxes[38].partial).toBe(true);
    expect(raw.pc.boxes[38].slots).toEqual([expect.objectContaining({ slot: 11, speciesId: 4, nickname: '' })]);
    expect(raw.warnings.some(w => w.includes('67 nomes de caixa'))).toBe(true);
  });

  it('cai para o slot anterior se o mais recente tiver checksum inválido', () => {
    const u8 = makeSave({ ...base, rotate: 0 });
    u8[SECTOR_SIZE * 0 + 0x20] ^= 0xFF; // corrompe a seção 0 do slot novo
    const r = parseSave(u8);
    expect(r.trainer.name).toBe('Old');
    expect(r.slot.saveIndex).toBe(9);
  });

  it('rejeita arquivos pequenos ou sem assinatura', () => {
    expect(() => parseSave(new Uint8Array(1000))).toThrow(SaveError);
    expect(() => parseSave(new Uint8Array(0x20000))).toThrow(/assinatura/);
  });

  it('checksum confere com o que foi gravado', () => {
    const u8 = makeSave(base);
    const dv = new DataView(u8.buffer);
    for (let i = 0; i < 32; i++) {
      const o = i * SECTOR_SIZE;
      expect(sectorChecksum(dv, o)).toBe(dv.getUint16(o + FOOTER.checksum, true));
    }
  });
});

suite('describe', () => {
  const d = describe(parseSave(makeSave(base)), T);

  it('resolve nomes, tipos, natureza e item', () => {
    const p = d.party[0];
    expect(p.species).toMatchObject({ name: 'Pikachu', confidence: 'confirmado', spriteId: 25, hasIcon: true, types: ['electric'] });
    expect(p.hasNickname).toBe(true);
    expect(p.nature).toEqual({ id: 15, name: 'Modest', plus: 'spa', minus: 'atk' });
    expect(p.item).toMatchObject({ id: 479, name: 'Life Orb', confidence: 'confirmado' });
    expect(p.moves.map(m => [m.name, m.type])).toEqual([['Thunderbolt', 'electric'], ['Quick Attack', 'normal']]);
    expect(p.ot).toEqual({ name: 'Ash', tid: 12345, sid: 54321 });
  });

  it('usa a tabela manual para IDs do Quetzal e item 865', () => {
    const a = d.party[1];
    expect(a.species).toMatchObject({ name: 'Annihilape', confidence: 'provável', spriteId: 979 });
    expect(a.hasNickname).toBe(false);
    expect(a.item).toMatchObject({ name: 'Lucarionite', confidence: 'provável' });
    const raichu = d.pc.boxes[1].slots[0];
    expect(raichu.species).toMatchObject({ name: 'Raichu', form: 'Alola', showdown: 'Raichu-Alola', spriteId: 10100 });
    expect(raichu.species.types).toEqual(['electric', 'psychic']);
    const pika = d.pc.boxes[1].slots[1];
    expect(pika.species.spriteId).toBeNull();
  });

  it('PC sem apelido usa o nome da espécie e marca campos não lidos', () => {
    const c = d.pc.boxes[38].slots[0];
    expect(c.nickname).toBe('Charmander');
    expect(c).toMatchObject({ complete: false, level: null, nature: null, item: null, ivs: null });
  });

  it('IDs desconhecidos usam o apelido', () => {
    const raw = parseSave(makeSave({ trainer: base.trainer, party: [{ pid: 0, nickname: 'Mystery', species: 1999 }] }));
    const m = describe(raw, T).party[0];
    expect(m.species).toMatchObject({ name: 'Mystery', confidence: 'desconhecido', spriteId: null });
  });
});

suite('natureFromPid', () => {
  it('segue PID % 25', () => {
    expect(natureFromPid(0).name).toBe('Hardy');
    expect(natureFromPid(0)).toMatchObject({ plus: null, minus: null });
    expect(natureFromPid(25 + 13)).toMatchObject({ name: 'Jolly', plus: 'spe', minus: 'spa' });
    expect(natureFromPid(0xFFFFFFFF).name).toBe(['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'][0xFFFFFFFF % 25]);
  });
});
