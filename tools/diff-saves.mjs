#!/usr/bin/env node
// Compara dois saves do Quetzal para engenharia reversa.
//
//   node tools/diff-saves.mjs antes.sav depois.sav            resumo por seção + registros de Pokémon alterados
//   node tools/diff-saves.mjs antes.sav depois.sav --party 1  diff bit a bit do Pokémon 1 da equipe
//   node tools/diff-saves.mjs antes.sav depois.sav --pc 1 5   diff bit a bit da caixa 1, posição 5
//   node tools/diff-saves.mjs um.sav --pc 1 5                 só mostra o registro (bits e hex)
//
// Compara sempre o slot ativo (maior save index) de cada arquivo.

import { readFileSync } from 'node:fs';
import { SECTOR_DATA, SECTORS_PER_SLOT, SECTOR_SIZE, SIGNATURE, FOOTER, PARTY, PC } from '../src/parser/save.js';

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--') && /\.(sav|srm)$/i.test(a));
const opt = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args.slice(i + 1).filter(x => /^\d+$/.test(x)).map(Number); };

if (!files.length) {
  console.error('Uso: node tools/diff-saves.mjs a.sav [b.sav] [--party N] [--pc CAIXA POSIÇÃO]');
  process.exit(1);
}

function load(file) {
  const u8 = new Uint8Array(readFileSync(file));
  const dv = new DataView(u8.buffer);
  const slots = [0, 1].map(slot => {
    const sections = {}; let idx = -1;
    for (let i = 0; i < SECTORS_PER_SLOT; i++) {
      const o = (slot * SECTORS_PER_SLOT + i) * SECTOR_SIZE;
      if (dv.getUint32(o + FOOTER.signature, true) !== SIGNATURE) continue;
      sections[dv.getUint16(o + FOOTER.id, true)] = u8.subarray(o, o + SECTOR_DATA);
      idx = Math.max(idx, dv.getUint32(o + FOOTER.saveIndex, true));
    }
    return { sections, idx };
  }).sort((a, b) => b.idx - a.idx);
  const S = slots[0].sections;
  const pcParts = [];
  for (let id = PC.firstSection; id <= PC.lastSection; id++) pcParts.push(S[id]);
  const pc = new Uint8Array(pcParts.reduce((a, p) => a + p.length, 0));
  { let o = 0; for (const p of pcParts) { pc.set(p, o); o += p.length; } }
  return { file, saveIndex: slots[0].idx, S, pc };
}

const hex = (b, n = 2) => b.toString(16).padStart(n, '0');
const hexBytes = bytes => Array.from(bytes, b => hex(b)).join(' ');

function partyRecord(save, n) {
  const o = PARTY.start + (n - 1) * PARTY.size;
  return save.S[1].subarray(o, o + PARTY.size);
}
function pcRecord(save, box, slot) {
  const o = PC.monStart + ((box - 1) * PC.perBox + (slot - 1)) * PC.monSize;
  return save.pc.subarray(o, o + PC.monSize);
}

const bit = (bytes, i) => (bytes[i >> 3] >> (i & 7)) & 1;
const field = (bytes, start, len) => { let v = 0n; for (let k = len - 1; k >= 0; k--) v = (v << 1n) | BigInt(bit(bytes, start + k)); return v; };

function dumpRecord(title, rec) {
  console.log(`\n${title} (${rec.length} bytes)`);
  for (let i = 0; i < rec.length; i += 16) console.log(`  ${hex(i, 3)}  ${hexBytes(rec.subarray(i, i + 16))}`);
  console.log('  bits (LSB primeiro, 8 por grupo):');
  for (let i = 0; i < rec.length; i += 8) {
    const groups = [];
    for (let b = i; b < Math.min(i + 8, rec.length); b++) {
      let s = ''; for (let k = 0; k < 8; k++) s += bit(rec, b * 8 + k);
      groups.push(s);
    }
    console.log(`  ${String(i * 8).padStart(4)}: ${groups.join(' ')}`);
  }
}

function diffRecord(title, a, b) {
  console.log(`\n${title}`);
  console.log('  A: ' + hexBytes(a));
  console.log('  B: ' + hexBytes(b));
  // Agrupa bits alterados em sequências contínuas e mostra os valores antes/depois
  const changed = [];
  for (let i = 0; i < a.length * 8; i++) if (bit(a, i) !== bit(b, i)) changed.push(i);
  if (!changed.length) { console.log('  (sem diferença)'); return; }
  const runs = [];
  for (const i of changed) {
    const last = runs[runs.length - 1];
    if (last && i - last.end <= 1) last.end = i; else runs.push({ start: i, end: i });
  }
  console.log(`  ${changed.length} bits alterados em ${runs.length} trecho(s):`);
  for (const r of runs) {
    const len = r.end - r.start + 1;
    console.log(`   bits ${r.start}–${r.end} (byte ${r.start >> 3}.${r.start & 7} a ${r.end >> 3}.${r.end & 7}): ${field(a, r.start, len)} → ${field(b, r.start, len)}`);
  }
  // Bytes alterados com valores u8/u16
  const bytes = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) bytes.push(i);
  console.log('  bytes alterados: ' + bytes.map(i => `0x${hex(i)}: ${hex(a[i])}→${hex(b[i])}`).join(', '));
}

function byteRuns(a, b) {
  const runs = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const last = runs[runs.length - 1];
    if (last && i - last.end <= 4) last.end = i; else runs.push({ start: i, end: i });
  }
  return runs;
}

const [A, B] = files.map(load);
const partyN = opt('party');
const pcArgs = opt('pc');

if (!B) {
  console.log(`${A.file}: save index ${A.saveIndex}`);
  if (partyN) dumpRecord(`Equipe #${partyN[0]}`, partyRecord(A, partyN[0]));
  if (pcArgs) dumpRecord(`PC caixa ${pcArgs[0]} posição ${pcArgs[1]}`, pcRecord(A, pcArgs[0], pcArgs[1]));
  process.exit(0);
}

console.log(`A: ${A.file} (save index ${A.saveIndex})\nB: ${B.file} (save index ${B.saveIndex})`);

if (partyN) { diffRecord(`Equipe #${partyN[0]}`, partyRecord(A, partyN[0]), partyRecord(B, partyN[0])); process.exit(0); }
if (pcArgs) { diffRecord(`PC caixa ${pcArgs[0]} posição ${pcArgs[1]}`, pcRecord(A, ...pcArgs), pcRecord(B, ...pcArgs)); process.exit(0); }

// Resumo: seções 0–4
for (let id = 0; id < PC.firstSection; id++) {
  const runs = byteRuns(A.S[id], B.S[id]);
  if (!runs.length) continue;
  console.log(`\nSeção ${id}: ${runs.length} trecho(s) alterado(s)`);
  for (const r of runs.slice(0, 40)) {
    let note = '';
    if (id === 1 && r.start >= PARTY.start && r.start < PARTY.start + 6 * PARTY.size) {
      const n = Math.floor((r.start - PARTY.start) / PARTY.size);
      note = ` [equipe #${n + 1}, offset 0x${hex(r.start - PARTY.start - n * PARTY.size)}]`;
    }
    console.log(`  0x${hex(r.start, 3)}–0x${hex(r.end, 3)}: ${hexBytes(A.S[id].subarray(r.start, r.end + 1))} → ${hexBytes(B.S[id].subarray(r.start, r.end + 1))}${note}`);
  }
  if (runs.length > 40) console.log(`  … e mais ${runs.length - 40}`);
}

// Resumo: PC
const pcRuns = byteRuns(A.pc, B.pc);
const recs = new Set();
const other = [];
for (const r of pcRuns) {
  if (r.start >= PC.monStart) {
    for (let i = r.start; i <= r.end; i++) recs.add(Math.floor((i - PC.monStart) / PC.monSize));
  } else other.push(r);
}
if (other.length) {
  console.log('\nPC (cabeçalho: caixa atual, nomes, wallpapers):');
  for (const r of other) console.log(`  0x${hex(r.start, 3)}–0x${hex(r.end, 3)}: ${hexBytes(A.pc.subarray(r.start, r.end + 1))} → ${hexBytes(B.pc.subarray(r.start, r.end + 1))}`);
}
if (recs.size) {
  console.log(`\nPC: ${recs.size} registro(s) de Pokémon alterado(s)`);
  for (const n of [...recs].sort((x, y) => x - y)) {
    const box = Math.floor(n / PC.perBox) + 1, slot = (n % PC.perBox) + 1;
    diffRecord(`Caixa ${box} posição ${slot}`, pcRecord(A, box, slot), pcRecord(B, box, slot));
  }
}
if (!pcRuns.length && [0, 1, 2, 3, 4].every(id => !byteRuns(A.S[id], B.S[id]).length)) console.log('\nNenhuma diferença nos dados.');
