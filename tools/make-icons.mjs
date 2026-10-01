#!/usr/bin/env node
// Gera os ícones do app (pixel art original: esfera nas cores do quetzal + pena) em PNG e SVG.
// Uso: node tools/make-icons.mjs   → public/icons/*
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

// Pena original 16×16. A = verde, C = verde claro (raque), B = vermelho (cálamo)
const FEATHER = [
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

// Ícone 32×32: esfera de captura estilizada (cores do quetzal, não as da Poké Ball) com a pena saindo por trás.
const N = 32;
const COLORS = {
  A: [0x4f, 0xc3, 0xa1], C: [0xa8, 0xf0, 0xd0], B: [0xff, 0x7a, 0x6b], // pena
  O: [0x0d, 0x10, 0x20], // contorno
  G: [0x2f, 0x9e, 0x80], H: [0x8f, 0xe3, 0xc6], // metade de cima (verde) e brilho
  W: [0xfb, 0xf8, 0xee], S: [0xd9, 0xd1, 0xb8], // metade de baixo (creme) e sombra
};
const BG = [0x22, 0x2a, 0x44];

function buildGrid() {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  // Pena atrás, no canto superior direito, com contorno escuro
  const fx = 15, fy = 1;
  FEATHER.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y + fy][x + fx] = ch; }));
  const isFeather = (x, y) => 'ABC'.includes((g[y] || [])[x]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] === '.' && (isFeather(x - 1, y) || isFeather(x + 1, y) || isFeather(x, y - 1) || isFeather(x, y + 1))) g[y][x] = 'o';
  }
  // Esfera: contorno de 1 pixel onde algum vizinho fica fora do círculo
  const cx = 13.5, cy = 19.5, r = 11.5;
  const inside = (x, y) => Math.hypot(x - cx, y - cy) <= r;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      let ch;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) ch = 'O';
      else if (Math.abs(dy) <= 1) ch = 'O'; // faixa do meio
      else if (dy < 0) ch = (dx < -2 && dy < -4 && d > r - 2.5 && d < r - 1.4) ? 'H' : 'G';
      else ch = (dx + dy > 8 && d > r - 3) ? 'S' : 'W';
      if (d <= 3.6) ch = d > 2.3 ? 'O' : 'B'; // botão central vermelho
      g[y][x] = ch;
    }
  }
  return g.map(row => row.join('').replace(/o/g, 'O'));
}
const GRID = buildGrid();

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
  const cell = Math.floor((size * contentRatio) / N);
  const off = Math.floor((size - cell * N) / 2);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / cell), gy = Math.floor((y - off) / cell);
      const ch = gx >= 0 && gy >= 0 && gx < N && gy < N ? GRID[gy][gx] : '.';
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
function pathFor(k, off = 0) {
  let d = '';
  GRID.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === k) d += `M${x + off} ${y + off}h1v1h-1z`; }));
  return d;
}
function svg() {
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  let rects = '';
  for (const k of Object.keys(COLORS)) rects += `<path fill="${hex(COLORS[k])}" d="${pathFor(k, 2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N + 4} ${N + 4}" shape-rendering="crispEdges"><rect width="${N + 4}" height="${N + 4}" fill="${hex(BG)}"/>${rects}</svg>\n`;
}

writeFileSync(path.join(OUT, 'icon-192.png'), png(192, 0.84));
writeFileSync(path.join(OUT, 'icon-512.png'), png(512, 0.84));
writeFileSync(path.join(OUT, 'maskable-512.png'), png(512, 0.6));
writeFileSync(path.join(OUT, 'icon.svg'), svg());
// Símbolo do cabeçalho (mesmo desenho, sem fundo): impresso para colar no <symbol id="logo"> do index.html
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
console.log(Object.keys(COLORS).map(k => `<path fill="${hex(COLORS[k])}" d="${pathFor(k)}"/>`).join('\n      '));
console.log(GRID.join('\n'));
