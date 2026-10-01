// Monta um save sintético no formato do Quetzal, para testes que não dependem de um save real.
import { encodeText } from '../../src/parser/charset.js';
import {
  SAVE_SIZE, SECTOR_SIZE, SECTOR_DATA, SECTORS_PER_SLOT, SIGNATURE, FOOTER, TRAINER, PARTY, PC, sectorChecksum,
} from '../../src/parser/save.js';

/**
 * @param {object} o
 * @param {{name:string,tid:number,sid:number}} o.trainer
 * @param {Array<object>} [o.party]
 * @param {Record<number, {species:number, nickname?:string, moves?:Array<[number,number]>, item?:number, exp?:number, evs?:number[], ivs?:number[], nature?:number, abilityNum?:number}>} [o.pc] índice global do slot -> Pokémon (EVs/IVs na ordem do save)
 * @param {number} [o.saveIndex]
 * @param {object} [o.olderSlot] dados para o outro slot (save anterior)
 * @param {number} [o.rotate] rotação física dos setores dentro do slot
 */
export function makeSave(o) {
  const u8 = new Uint8Array(SAVE_SIZE);
  writeSlot(u8, 0, o, o.saveIndex ?? 10, o.rotate ?? 3);
  if (o.olderSlot) writeSlot(u8, 1, o.olderSlot, (o.saveIndex ?? 10) - 1, 0);
  return u8;
}

function writeSlot(u8, slot, o, saveIndex, rotate) {
  const dv = new DataView(u8.buffer);
  const sections = Array.from({ length: SECTORS_PER_SLOT }, () => new Uint8Array(SECTOR_SIZE));

  // Seção 0: treinador
  sections[0].set(encodeText(o.trainer.name, TRAINER.nameLen), TRAINER.name);
  const s0 = new DataView(sections[0].buffer);
  s0.setUint16(TRAINER.tid, o.trainer.tid, true);
  s0.setUint16(TRAINER.sid, o.trainer.sid, true);

  // Seção 1: equipe
  const s1 = sections[1], d1 = new DataView(s1.buffer);
  const party = o.party || [];
  s1[PARTY.count] = party.length;
  party.forEach((p, i) => {
    const r = PARTY.start + i * PARTY.size;
    d1.setUint32(r + PARTY.pid, p.pid, true);
    d1.setUint32(r + PARTY.otId, p.otId ?? (o.trainer.tid | (o.trainer.sid << 16)) >>> 0, true);
    s1.set(encodeText(p.nickname ?? '', PARTY.nicknameLen), r + PARTY.nickname);
    s1.set(encodeText(p.otName ?? o.trainer.name, PARTY.otNameLen), r + PARTY.otName);
    d1.setUint16(r + PARTY.species, p.species, true);
    d1.setUint16(r + PARTY.item, p.item ?? 0, true);
    d1.setUint32(r + PARTY.exp, p.exp ?? 0, true);
    s1[r + PARTY.friendship] = p.friendship ?? 0;
    s1[r + PARTY.ball] = p.ball ?? 1;
    (p.moves || []).forEach(([id, pp], j) => { d1.setUint16(r + PARTY.moves + 2 * j, id, true); s1[r + PARTY.pp + j] = pp; });
    (p.evs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => { s1[r + PARTY.evs + j] = v; });
    const ivs = p.ivs || [0, 0, 0, 0, 0, 0];
    d1.setUint32(r + PARTY.ivs, ivs.reduce((acc, v, j) => acc | (v << (5 * j)), 0) >>> 0, true);
    d1.setUint32(r + PARTY.misc, (0x40000000 | ((p.abilityNum ?? 0) << PARTY.abilityShift)) >>> 0, true);
    s1[r + PARTY.level] = p.level ?? 1;
    (p.stats || [0, 0, 0, 0, 0, 0]).forEach((v, j) => d1.setUint16(r + PARTY.stats + 2 * j, v, true));
  });

  // Seções 5..15: PC (área contínua de 0xFF4 bytes por seção)
  const nSec = PC.lastSection - PC.firstSection + 1;
  const pc = new Uint8Array(nSec * SECTOR_DATA);
  for (let b = 0; b < PC.boxNameSlots; b++) pc.set(encodeText(`BOX${b + 1}`, PC.boxNameLen), PC.boxNames + b * PC.boxNameLen);
  for (const [idx, m] of Object.entries(o.pc || {})) {
    const off = PC.monStart + Number(idx) * PC.monSize;
    const B = PC.bits;
    const put = (value, offset) => { bits |= BigInt(value) << BigInt(offset); };
    let bits = 0n;
    put(m.species, B.species[0]);
    put(m.item ?? 0, B.item[0]);
    put(Math.floor((m.exp ?? 0) / 10), B.exp10[0]);
    put(m.ball ?? 1, B.ball[0]);
    put(m.shiny ? 1 : 0, B.shiny[0]);
    (m.moves || []).forEach(([id], j) => put(id, B.moves[j]));
    (m.evs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => put(v >> 2, B.evs + j * B.evWidth));
    (m.ivs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => put(v, B.ivs + j * B.ivWidth));
    put(m.nature ?? 0, B.nature[0]);
    put(m.abilityNum ?? 0, B.ability[0]);
    for (let k = 0; k < 24; k++) pc[off + k] = Number((bits >> BigInt(8 * k)) & 0xFFn);
    (m.moves || []).forEach(([, pp], j) => { pc[off + PC.pp + j] = pp; });
    pc.set(encodeText(m.nickname ?? '', PC.nicknameLen), off + PC.nickname);
  }
  for (let s = 0; s < nSec; s++) sections[PC.firstSection + s].set(pc.subarray(s * SECTOR_DATA, (s + 1) * SECTOR_DATA));

  // Rodapés e gravação com rotação física
  sections.forEach((sec, id) => {
    const phys = (id + rotate) % SECTORS_PER_SLOT;
    const base = (slot * SECTORS_PER_SLOT + phys) * SECTOR_SIZE;
    u8.set(sec, base);
    dv.setUint16(base + FOOTER.id, id, true);
    dv.setUint32(base + FOOTER.signature, SIGNATURE, true);
    dv.setUint32(base + FOOTER.saveIndex, saveIndex, true);
    dv.setUint16(base + FOOTER.checksum, sectorChecksum(dv, base), true);
  });
}
