#!/usr/bin/env node
// Gera os ícones do app (pena em pixel art, desenho original) em PNG e SVG.
// Uso: node tools/make-icons.mjs   → public/icons/*
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

// 16×16. A = verde, C = verde claro (raque), B = vermelho (cálamo)
const GRID = [
  '................',
  '...........AA...',
  '.........AAAAA..',
  '........AAACAA..',
  '.......AAACAAA..',
  '......AAACAAA...',
  '.....AAACAAA....',
  '....AAACAAA.....',
  '....AACAAA......',
  '...AACAAA.......',
  '...ACAA.........',
  '..BCA...........',
  '..BB............',
  '.BB.............',
  '.B..............',
  '................',
];
const COLORS = { A: [0x4f, 0xc3, 0xa1], C: [0xa8, 0xf0, 0xd0], B: [0xff, 0x7a, 0x6b] };
const BG = [0x22, 0x2a, 0x44];

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (const b of buf) {
    c = (crc ^ b) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, contentRatio) {
  const cell = Math.floor((size * contentRatio) / 16);
  const off = Math.floor((size - cell * 16) / 2);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / cell), gy = Math.floor((y - off) / cell);
      const ch = gx >= 0 && gy >= 0 && gx < 16 && gy < 16 ? GRID[gy][gx] : '.';
      const [r, g, b] = COLORS[ch] || BG;
      row.set([r, g, b, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function svg() {
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  let rects = '';
  GRID.forEach((row, y) => [...row].forEach((ch, x) => { if (COLORS[ch]) rects += `<rect x="${x + 2}" y="${y + 2}" width="1" height="1" fill="${hex(COLORS[ch])}"/>`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" shape-rendering="crispEdges"><rect width="20" height="20" fill="${hex(BG)}"/>${rects}</svg>\n`;
}

writeFileSync(path.join(OUT, 'icon-192.png'), png(192, 0.84));
writeFileSync(path.join(OUT, 'icon-512.png'), png(512, 0.84));
writeFileSync(path.join(OUT, 'maskable-512.png'), png(512, 0.6));
writeFileSync(path.join(OUT, 'icon.svg'), svg());
// Símbolo usado no cabeçalho (mesmo desenho, sem fundo)
const symbolPaths = Object.entries(COLORS).map(([k]) => {
  let d = '';
  GRID.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === k) d += `M${x} ${y}h1v1h-1z`; }));
  return `<path fill="var(--plume-${k === 'A' ? 'a' : k === 'B' ? 'b' : 'c'})" d="${d}"/>`;
}).join('\n      ');
console.log(symbolPaths);
