#!/usr/bin/env node
// Gera os ícones do app (pixel art original: esfera nas cores do quetzal + lupa) em PNG e SVG.
// Uso: node tools/make-icons.mjs   → public/icons/*
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

// Ícone 32×32: esfera de captura estilizada (cores do quetzal, não as da Poké Ball) com uma lupa na frente.
const N = 32;
const COLORS = {
  O: [0x0d, 0x10, 0x20], // contorno
  G: [0x2f, 0x9e, 0x80], H: [0x8f, 0xe3, 0xc6], // metade de cima (verde) e brilho
  W: [0xfb, 0xf8, 0xee], S: [0xd9, 0xd1, 0xb8], // metade de baixo (creme) e sombra
  R: [0xc8, 0xd3, 0xe6], // aro da lupa
  L: [0x7f, 0xa6, 0xe0], l: [0xe0, 0xec, 0xff], // vidro e reflexo
  D: [0x23, 0x73, 0x5f], // cabo (verde escuro)
};
const BG = [0x22, 0x2a, 0x44];

/** Círculo com contorno de 1 pixel onde algum vizinho fica fora. `paint(dx, dy, d)` dá a cor do interior. */
function disc(g, cx, cy, r, paint) {
  const inside = (x, y) => Math.hypot(x - cx, y - cy) <= r;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    g[y][x] = edge ? 'O' : paint(x - cx, y - cy, Math.hypot(x - cx, y - cy));
  }
}

function buildGrid() {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  // Esfera (canto superior esquerdo)
  disc(g, 12.5, 11.5, 11.5, (dx, dy, d) => {
    if (d <= 3.6) return d > 2.3 ? 'O' : 'W'; // botão central
    if (Math.abs(dy) <= 1) return 'O'; // faixa do meio
    if (dy < 0) return (dx < -2 && dy < -4 && d > 11.5 - 2.5 && d < 11.5 - 1.4) ? 'H' : 'G';
    return (dx + dy > 8 && d > 11.5 - 3) ? 'S' : 'W';
  });
  // Cabo da lupa: segmento diagonal com contorno
  const lx = 21, ly = 20.5;
  const seg = (x, y) => {
    const t = Math.max(6, Math.min(12, ((x - lx) + (y - ly)) / Math.SQRT2));
    const px = lx + t / Math.SQRT2, py = ly + t / Math.SQRT2;
    return Math.hypot(x - px, y - py);
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = seg(x, y);
    if (d <= 1.5) g[y][x] = 'D';
    else if (d <= 2.5) g[y][x] = 'O';
  }
  // Lente (por cima de tudo)
  disc(g, lx, ly, 7, (dx, dy, d) => {
    if (d > 5) return 'R';
    if (d > 4.1) return 'O';
    return (dx < -0.5 && dy < -0.5 && d > 1.8 && d < 3.4) ? 'l' : 'L';
  });
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
writeFileSync(path.join(OUT, 'maskable-512.png'), png(512, 0.6));
writeFileSync(path.join(OUT, 'icon.svg'), svg());
// Símbolo do cabeçalho (mesmo desenho, sem fundo): impresso para colar no <symbol id="logo"> do index.html
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
console.log(Object.keys(COLORS).map(k => `<path fill="${hex(COLORS[k])}" d="${pathFor(k)}"/>`).join('\n      '));
console.log(GRID.join('\n'));
