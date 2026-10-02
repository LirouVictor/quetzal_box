#!/usr/bin/env node
// Gera os ícones do app (pixel art original: "sD" de savDex com uma esfera dentro do D) em PNG e SVG.
// Uso: node tools/make-icons.mjs   → public/icons/*
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

// Ícone 32×32: as letras "sD" (savDex) em pixel art; dentro do D, uma esfera de captura nas cores do app
// (verde em cima, azul-claro embaixo; não são as cores da Poké Ball).
const N = 32;
const COLORS = {
  K: [0x0d, 0x10, 0x20], // sombra das letras, faixa e aro do botão
  C: [0xfb, 0xf8, 0xee], c: [0xd9, 0xd1, 0xb8], // letras (creme) e base das letras
  G: [0x2f, 0x9e, 0x80], H: [0x8f, 0xe3, 0xc6], // metade de cima da esfera e brilho
  L: [0xc8, 0xd3, 0xe6], // metade de baixo
  W: [0xff, 0xff, 0xff], // botão
};
const BG = [0x22, 0x2a, 0x44];

// "s" minúsculo, traço de 2–3 pixels (10 × 12)
const S = [
  '.########.',
  '##########',
  '###....###',
  '###.......',
  '###.......',
  '#########.',
  '.#########',
  '.......###',
  '.......###',
  '###....###',
  '##########',
  '.########.',
];

function buildGrid() {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const letter = new Set();
  const put = (x, y) => { if (x >= 0 && y >= 0 && x < N && y < N) letter.add(`${x},${y}`); };
  // s: colunas 2–11, linhas 16–27
  S.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') put(2 + x, 16 + y); }));
  // D: haste reta à esquerda + meia elipse à direita; contorno de 3 pixels
  const D = { x0: 13, x1: 29, y0: 4, y1: 27 };
  const cx = 19, cy = (D.y0 + D.y1) / 2, rx = D.x1 - cx + 0.5, ry = (D.y1 - D.y0) / 2 + 0.5;
  const inD = (x, y, inset) => {
    if (y < D.y0 + inset || y > D.y1 - inset || x < D.x0 + inset) return false;
    if (x <= cx) return true;
    const ex = (x - cx) / (rx - inset), ey = (y - cy) / (ry - inset);
    return ex * ex + ey * ey <= 1;
  };
  const counter = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!inD(x, y, 0)) continue;
    if (inD(x, y, 3)) counter.push([x, y]); else put(x, y);
  }
  // Sombra (1 pixel para baixo e para a direita), depois as letras com a base mais escura
  for (const k of letter) { const [x, y] = k.split(',').map(Number); if (x + 1 < N && y + 1 < N) g[y + 1][x + 1] = 'K'; }
  const inCounter = new Set(counter.map(([x, y]) => `${x},${y}`));
  for (const k of letter) {
    const [x, y] = k.split(',').map(Number);
    const below = `${x},${y + 1}`;
    g[y][x] = letter.has(below) || inCounter.has(below) ? 'C' : 'c';
  }
  // Esfera dentro do D
  const bx = 21, by = cy;
  for (const [x, y] of counter) {
    const ax = Math.abs(x - bx), ay = Math.abs(y - by);
    let ch;
    if (ax <= 1 && ay <= 1) ch = 'W'; // botão 3 × 2
    else if (ax <= 2 && ay <= 2 && !(ax === 2 && ay > 1)) ch = 'K'; // aro com cantos cortados
    else if (ay <= 0.5) ch = 'K'; // faixa do meio
    else if (y < by) ch = (x <= 18 && y <= by - 6) ? 'H' : 'G';
    else ch = 'L';
    g[y][x] = ch;
  }
  return g.map(row => row.join(''));
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
writeFileSync(path.join(OUT, 'maskable-512.png'), png(512, 0.66));
writeFileSync(path.join(OUT, 'icon.svg'), svg());
// Símbolo do cabeçalho (mesmo desenho, sem fundo): impresso para colar no <symbol id="logo"> do index.html
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
console.log(Object.keys(COLORS).map(k => `<path fill="${hex(COLORS[k])}" d="${pathFor(k)}"/>`).join('\n      '));
console.log(GRID.join('\n'));
