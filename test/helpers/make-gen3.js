// Monta um save sintético dos jogos oficiais da Gen 3 (Emerald, Ruby/Sapphire ou FireRed/LeafGreen),
// com os Pokémon criptografados como no jogo, para testes que não dependem de um save real.
import { encodeText } from '../../src/parser/charset.js';
import { GEN3 } from '../../src/parser/gen3.js';

const SIZES = [0xF2C, 0xF80, 0xF80, 0xF80, 0xF08, 0xF80, 0xF80, 0xF80, 0xF80, 0xF80, 0xF80, 0xF80, 0xF80, 0x7D0];
const ORDERS = ['GAEM', 'GAME', 'GEAM', 'GEMA', 'GMAE', 'GMEA', 'AGEM', 'AGME', 'AEGM', 'AEMG', 'AMGE', 'AMEG',
  'EGAM', 'EGMA', 'EAGM', 'EAMG', 'EMGA', 'EMAG', 'MGAE', 'MGEA', 'MAGE', 'MAEG', 'MEGA', 'MEAG'];

/**
 * Pokémon de 80 bytes (PC) ou 100 bytes (equipe).
 * @param {{pid:number, otId:number, species:number, item?:number, exp?:number, friendship?:number,
 *   moves?:Array<[number,number]>, evs?:number[], ivs?:number[], abilityNum?:number, ball?:number, metLevel?:number,
 *   egg?:boolean, nickname?:string, otName?:string, level?:number, hp?:number, stats?:number[]}} m
 */
export function encodeMon(m, party = false) {
  const out = new Uint8Array(party ? 100 : 80);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, m.pid >>> 0, true);
  dv.setUint32(4, m.otId >>> 0, true);
  out.set(encodeText(m.nickname ?? '', 10), 8);
  out[18] = 2; // idioma
  out[19] = 0x02; // tem espécie
  out.set(encodeText(m.otName ?? 'ASH', 7), 20);
  const blocks = {
    G: new DataView(new ArrayBuffer(12)), A: new DataView(new ArrayBuffer(12)),
    E: new DataView(new ArrayBuffer(12)), M: new DataView(new ArrayBuffer(12)),
  };
  blocks.G.setUint16(0, m.species, true);
  blocks.G.setUint16(2, m.item ?? 0, true);
  blocks.G.setUint32(4, m.exp ?? 0, true);
  blocks.G.setUint8(9, m.friendship ?? 70);
  (m.moves || []).forEach(([id, pp], j) => { blocks.A.setUint16(2 * j, id, true); blocks.A.setUint8(8 + j, pp); });
  (m.evs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => blocks.E.setUint8(j, v));
  const ivs = m.ivs || [0, 0, 0, 0, 0, 0];
  const ivWord = (ivs.reduce((a, v, j) => a | (v << (5 * j)), 0) | ((m.egg ? 1 : 0) << 30) | ((m.abilityNum ?? 0) << 31)) >>> 0;
  blocks.M.setUint16(2, ((m.metLevel ?? 5) & 0x7F) | (3 << 7) | ((m.ball ?? 4) << 11), true);
  blocks.M.setUint32(4, ivWord, true);
  const plain = new DataView(new ArrayBuffer(48));
  [...ORDERS[m.pid % 24]].forEach((c, i) => { for (let k = 0; k < 12; k++) plain.setUint8(i * 12 + k, blocks[c].getUint8(k)); });
  let sum = 0;
  for (let k = 0; k < 48; k += 2) sum = (sum + plain.getUint16(k, true)) & 0xFFFF;
  dv.setUint16(28, sum, true);
  const key = (m.pid ^ m.otId) >>> 0;
  for (let k = 0; k < 48; k += 4) dv.setUint32(32 + k, (plain.getUint32(k, true) ^ key) >>> 0, true);
  if (party) {
    out[84] = m.level ?? 5;
    dv.setUint16(86, m.hp ?? (m.stats ? m.stats[0] : 20), true);
    (m.stats || [20, 10, 10, 10, 10, 10]).forEach((v, j) => dv.setUint16(88 + 2 * j, v, true));
  }
  return out;
}

/**
 * @param {object} o
 * @param {'emerald'|'rs'|'frlg'} o.game
 * @param {{name:string, tid:number, sid:number}} o.trainer
 * @param {object[]} [o.party]
 * @param {Record<number, object>} [o.pc] índice global do slot (0–419) -> Pokémon
 */
export function makeGen3Save(o) {
  const u8 = new Uint8Array(0x20000);
  const dv = new DataView(u8.buffer);
  const sections = Array.from({ length: 14 }, () => new Uint8Array(0x1000));
  const s0 = new DataView(sections[0].buffer);
  sections[0].set(encodeText(o.trainer.name, 7), GEN3.trainer.name);
  s0.setUint16(GEN3.trainer.tid, o.trainer.tid, true);
  s0.setUint16(GEN3.trainer.sid, o.trainer.sid, true);
  s0.setUint32(GEN3.trainer.gameCode, o.game === 'frlg' ? 1 : o.game === 'rs' ? 0 : 0x12345678, true);
  const layout = GEN3.party[o.game === 'frlg' ? 'frlg' : 'rse'];
  const s1 = new DataView(sections[1].buffer);
  const party = o.party || [];
  s1.setUint32(layout.count, party.length, true);
  party.forEach((m, i) => sections[1].set(encodeMon(m, true), layout.start + i * 100));
  // PC: área contínua das seções 5–13
  const pc = new Uint8Array(0xF80 * 8 + 0x7D0);
  for (const [i, m] of Object.entries(o.pc || {})) pc.set(encodeMon(m), GEN3.pc.monStart + Number(i) * 80);
  for (let b = 0; b < 14; b++) pc.set(encodeText(`BOX${b + 1}`, 9), GEN3.pc.boxNames + b * 9);
  let off = 0;
  for (let id = 5; id <= 13; id++) { const n = SIZES[id]; sections[id].set(pc.subarray(off, off + n)); off += n; }
  sections.forEach((sec, id) => {
    const o2 = id * 0x1000;
    u8.set(sec, o2);
    let sum = 0;
    for (let k = 0; k < SIZES[id]; k += 4) sum = (sum + dv.getUint32(o2 + k, true)) >>> 0;
    dv.setUint16(o2 + 0xFF4, id, true);
    dv.setUint16(o2 + 0xFF6, ((sum >>> 16) + (sum & 0xFFFF)) & 0xFFFF, true);
    dv.setUint32(o2 + 0xFF8, 0x08012025, true);
    dv.setUint32(o2 + 0xFFC, 7, true);
  });
  return u8;
}

/** Embrulha bytes num export do GameShark/SharkPort (.sps). */
export function wrapSharkPort(bytes, title = 'POKEMON EMER', code = 'BPEE') {
  const enc = s => new TextEncoder().encode(s);
  const parts = [];
  const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); parts.push(b); };
  const str = s => { const b = enc(s); u32(b.length); parts.push(b); };
  str('SharkPortSave'); u32(0x000F0000); str(title); str('1/1/2026 10:00:00 AM'); str('');
  u32(bytes.length + 28);
  const header = new Uint8Array(28); header.set(enc(title.padEnd(12, '\0')), 0); header.set(enc(code), 12);
  parts.push(header, bytes, new Uint8Array(4));
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
