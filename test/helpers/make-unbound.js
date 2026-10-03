// Monta um save sintético do Pokémon Unbound (CFRU): equipe sem criptografia e PC com Pokémon de 58 bytes.
import { encodeText } from '../../src/parser/charset.js';

const SIZES = { 0: 0xF24, 4: 0xD98, 13: 0x450 };
const DATA = 0xFF0;

/** Pokémon da equipe (100 bytes, blocos G/A/E/M nesta ordem, sem criptografia). */
export function partyMon(m) {
  const out = new Uint8Array(100);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, m.pid >>> 0, true);
  dv.setUint32(4, m.otId >>> 0, true);
  out.set(encodeText(m.nickname ?? '', 10), 8);
  out.set(encodeText(m.otName ?? 'RED', 7), 20);
  dv.setUint16(32, m.species, true);
  dv.setUint16(34, m.item ?? 0, true);
  dv.setUint32(36, m.exp ?? 0, true);
  out[41] = m.friendship ?? 70;
  out[42] = m.ball ?? 3;
  (m.moves || []).forEach(([id, pp], j) => { dv.setUint16(44 + 2 * j, id, true); out[52 + j] = pp; });
  (m.evs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => { out[56 + j] = v; });
  const ivs = m.ivs || [0, 0, 0, 0, 0, 0];
  dv.setUint32(72, (ivs.reduce((a, v, j) => a | (v << (5 * j)), 0) | ((m.egg ? 1 : 0) << 30) | ((m.hidden ? 1 : 0) << 31)) >>> 0, true);
  out[84] = m.level ?? 5;
  dv.setUint16(86, m.stats ? m.stats[0] : 20, true);
  (m.stats || [20, 10, 10, 10, 10, 10]).forEach((v, j) => dv.setUint16(88 + 2 * j, v, true));
  return out;
}

/** Pokémon do PC (58 bytes "comprimidos"). */
export function boxMon(m) {
  const out = new Uint8Array(58);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, m.pid >>> 0, true);
  dv.setUint32(4, m.otId >>> 0, true);
  out.set(encodeText(m.nickname ?? '', 10), 8);
  out[19] = 0x02 | (m.egg ? 4 : 0);
  out.set(encodeText(m.otName ?? 'RED', 7), 20);
  dv.setUint16(28, m.species, true);
  dv.setUint16(30, m.item ?? 0, true);
  dv.setUint32(32, m.exp ?? 0, true);
  out[36] = m.ppUps ?? 0;
  out[37] = m.friendship ?? 70;
  out[38] = m.ball ?? 3;
  let moves = 0n;
  (m.moves || []).forEach((id, j) => { moves |= BigInt(id) << BigInt(10 * j); });
  for (let k = 0; k < 5; k++) out[39 + k] = Number((moves >> BigInt(8 * k)) & 0xFFn);
  (m.evs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => { out[44 + j] = v; });
  const ivs = m.ivs || [0, 0, 0, 0, 0, 0];
  dv.setUint32(54, (ivs.reduce((a, v, j) => a | (v << (5 * j)), 0) | ((m.egg ? 1 : 0) << 30) | ((m.hidden ? 1 : 0) << 31)) >>> 0, true);
  return out;
}

/**
 * @param {object} o
 * @param {{name:string,tid:number,sid:number}} o.trainer
 * @param {object[]} [o.party]
 * @param {Record<number, object>} [o.pc] índice global (caixa × 30 + posição − 1) → Pokémon
 * @param {number} [o.signature]
 * @param {string[]} [o.boxNames]
 */
export function makeUnboundSave(o) {
  const u8 = new Uint8Array(0x20000);
  const dv = new DataView(u8.buffer);
  const sec = Array.from({ length: 14 }, () => new Uint8Array(0x1000));
  sec[0].set(encodeText(o.trainer.name, 7), 0);
  new DataView(sec[0].buffer).setUint16(0xA, o.trainer.tid, true);
  new DataView(sec[0].buffer).setUint16(0xC, o.trainer.sid, true);
  const party = o.party || [];
  new DataView(sec[1].buffer).setUint32(0x34, party.length, true);
  party.forEach((m, i) => sec[1].set(partyMon(m), 0x38 + i * 100));
  (o.boxNames || []).forEach((n, b) => sec[13].set(encodeText(n, 9), 0x361 + b * 9));
  // Área das caixas na mesma ordem do leitor
  const pieces = [[5, 4, DATA]];
  for (let id = 6; id <= 13; id++) pieces.push([id, 0, DATA]);
  const mons = new Uint8Array(25 * 30 * 58);
  for (const [i, m] of Object.entries(o.pc || {})) mons.set(boxMon(m), Number(i) * 58);
  let off = 0;
  const put = (target, a, b) => { const n = Math.min(b - a, mons.length - off); target.set(mons.subarray(off, off + n), a); off += n; };
  for (const [id, a, b] of pieces) { if (off >= 19 * 30 * 58) break; put(sec[id], a, Math.min(b, a + 19 * 30 * 58 - off)); }
  off = 19 * 30 * 58;
  const phys30 = new Uint8Array(0x1000), phys31 = new Uint8Array(0x1000);
  put(phys30, 0xB0C, DATA); put(phys31, 0, 0xF80);
  put(sec[2], 0xF18, DATA); put(sec[3], 0, 0xCC0); put(sec[0], 0xB0, 0xB0 + 30 * 58);
  u8.set(phys30, 30 * 0x1000); u8.set(phys31, 31 * 0x1000);
  const sig = o.signature ?? 0x01121999;
  sec.forEach((s, id) => {
    const o2 = id * 0x1000;
    u8.set(s, o2);
    let sum = 0;
    for (let k = 0; k < (SIZES[id] ?? DATA); k += 4) sum = (sum + dv.getUint32(o2 + k, true)) >>> 0;
    dv.setUint16(o2 + 0xFF4, id, true);
    dv.setUint16(o2 + 0xFF6, ((sum >>> 16) + (sum & 0xFFFF)) & 0xFFFF, true);
    dv.setUint32(o2 + 0xFF8, sig, true);
    dv.setUint32(o2 + 0xFFC, 3, true);
  });
  return u8;
}
