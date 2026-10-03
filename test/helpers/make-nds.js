// Monta saves sintéticos de Platinum, HeartGold/SoulSilver (Gen 4) e Black/White, Black 2/White 2 (Gen 5), com os Pokémon
// embaralhados e criptografados como no jogo.

const ORDERS = ['ABCD', 'ABDC', 'ACBD', 'ACDB', 'ADBC', 'ADCB', 'BACD', 'BADC', 'BCAD', 'BCDA', 'BDAC', 'BDCA',
  'CABD', 'CADB', 'CBAD', 'CBDA', 'CDAB', 'CDBA', 'DABC', 'DACB', 'DBAC', 'DBCA', 'DCAB', 'DCBA'];

function crypt(u8, seed) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let s = seed >>> 0;
  for (let i = 0; i + 1 < u8.length; i += 2) {
    s = (Math.imul(s, 0x41C64E6D) + 0x6073) >>> 0;
    dv.setUint16(i, dv.getUint16(i, true) ^ (s >>> 16), true);
  }
}

const gen4Text = s => [...s].map(c => (c >= '0' && c <= '9' ? 0x121 + (c.charCodeAt(0) - 48)
  : c >= 'A' && c <= 'Z' ? 0x12B + (c.charCodeAt(0) - 65) : c >= 'a' && c <= 'z' ? 0x145 + (c.charCodeAt(0) - 97) : 0x1DE));
function putText(dv, o, s, len, gen) {
  const codes = gen === 4 ? gen4Text(s) : [...s].map(c => c.charCodeAt(0));
  for (let i = 0; i < len / 2; i++) dv.setUint16(o + 2 * i, i < codes.length ? codes[i] : 0xFFFF, true);
}

/**
 * Pokémon de 136 bytes (PC) ou com os dados de batalha (equipe: 236 bytes na Gen 4, 220 na Gen 5).
 * @param {{pid:number, otId:number, species:number, item?:number, exp?:number, ability?:number, moves?:Array<[number,number]>,
 *   evs?:number[], ivs?:number[], female?:boolean, genderless?:boolean, form?:number, nature?:number, hidden?:boolean,
 *   nickname?:string, otName?:string, ball?:number, level?:number, stats?:number[]}} m
 */
export function encodeMon(m, gen, party = false) {
  const plain = new Uint8Array(136);
  const dv = new DataView(plain.buffer);
  dv.setUint32(0, m.pid >>> 0, true);
  dv.setUint16(8, m.species, true);
  dv.setUint16(0x0A, m.item ?? 0, true);
  dv.setUint32(0x0C, m.otId >>> 0, true);
  dv.setUint32(0x10, m.exp ?? 0, true);
  plain[0x14] = 70;
  plain[0x15] = m.ability ?? 0;
  (m.evs || [0, 0, 0, 0, 0, 0]).forEach((v, j) => { plain[0x18 + j] = v; });
  (m.moves || []).forEach(([id, pp], j) => { dv.setUint16(0x28 + 2 * j, id, true); plain[0x30 + j] = pp; });
  const ivs = m.ivs || [0, 0, 0, 0, 0, 0];
  dv.setUint32(0x38, (ivs.reduce((a, v, j) => a | (v << (5 * j)), 0) | ((m.nickname ? 1 : 0) << 31)) >>> 0, true);
  plain[0x40] = (m.female ? 2 : 0) | (m.genderless ? 4 : 0) | ((m.form ?? 0) << 3);
  if (gen === 5) { plain[0x41] = m.nature ?? 0; plain[0x42] = m.hidden ? 1 : 0; }
  putText(dv, 0x48, m.nickname ?? 'MON', 22, gen);
  putText(dv, 0x68, m.otName ?? 'ASH', 16, gen);
  plain[0x83] = m.ball ?? 4;
  let sum = 0;
  for (let i = 8; i < 136; i += 2) sum = (sum + dv.getUint16(i, true)) & 0xFFFF;
  dv.setUint16(6, sum, true);
  // Embaralha (posição i recebe o bloco ORDERS[..][i]) e criptografa
  const out = new Uint8Array(party ? (gen === 4 ? 236 : 220) : 136);
  out.set(plain.subarray(0, 8));
  const order = ORDERS[((m.pid >>> 13) & 31) % 24];
  [...order].forEach((c, i) => out.set(plain.subarray(8 + 'ABCD'.indexOf(c) * 32, 8 + 'ABCD'.indexOf(c) * 32 + 32), 8 + i * 32));
  crypt(out.subarray(8, 136), sum);
  if (party) {
    const b = out.subarray(136);
    const bv = new DataView(b.buffer, b.byteOffset, b.length);
    b[4] = m.level ?? 5;
    const stats = m.stats || [20, 10, 10, 10, 10, 10];
    bv.setUint16(6, stats[0], true);
    stats.forEach((v, j) => bv.setUint16(8 + 2 * j, v, true));
    crypt(b, m.pid);
  }
  return out;
}

function crc16(u8) {
  let c = 0xFFFF;
  for (const x of u8) {
    c ^= x << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
  }
  return c;
}

// Gen 4: posições do bloco geral (treinador, equipe) e do bloco das caixas
const GEN4 = {
  hgss: { general: 0xF628, storage: [0xF700, 0x12310], footer: 0x10, trainer: 0x64, party: 0x94, box: b => b * 0x1000, names: 0x12008 },
  pt: { general: 0xCF2C, storage: [0xCF2C, 0x121E4], footer: 0x14, trainer: 0x68, party: 0x9C, box: b => 4 + b * 30 * 136, names: 0x11EE4 },
};

/** Gen 4 (game 'hgss' ou 'pt'): só a primeira metade (256 KB), como nos exports do Action Replay. */
export function makeGen4Save({ game = 'hgss', trainer, party = [], pc = {}, boxNames = [], saveCount = 5 }) {
  const L = GEN4[game];
  const u8 = new Uint8Array(0x40000);
  const dv = new DataView(u8.buffer);
  putText(dv, L.trainer, trainer.name, 16, 4);
  dv.setUint16(L.trainer + 0x10, trainer.tid, true);
  dv.setUint16(L.trainer + 0x12, trainer.sid, true);
  dv.setUint32(L.party, party.length, true);
  party.forEach((m, i) => u8.set(encodeMon(m, 4, true), L.party + 4 + i * 236));
  const S = L.storage[0];
  for (const [i, m] of Object.entries(pc)) u8.set(encodeMon(m, 4), S + L.box(Math.floor(i / 30)) + (i % 30) * 136);
  boxNames.forEach((n, b) => putText(dv, S + L.names + b * 0x28, n, 0x28, 4));
  // Rodapé: contador no começo; tamanho, assinatura, id e CRC no fim
  for (const [o, size] of [[0, L.general], L.storage]) {
    const end = o + size;
    dv.setUint32(end - L.footer, saveCount, true);
    dv.setUint32(end - 12, size, true);
    dv.setUint32(end - 8, 0x20060623, true);
    dv.setUint16(end - 2, crc16(u8.subarray(o, end - L.footer)), true);
  }
  return u8;
}

export const makeHgssSave = opts => makeGen4Save({ ...opts, game: 'hgss' });

/** Black/White (version 20/21) ou Black 2/White 2 (22/23). */
export function makeBwSave({ trainer, party = [], pc = {}, boxNames = [], version = 21 }) {
  const u8 = new Uint8Array(0x80000);
  const dv = new DataView(u8.buffer);
  putText(dv, 0x19404, trainer.name, 16, 5);
  dv.setUint16(0x19414, trainer.tid, true);
  dv.setUint16(0x19416, trainer.sid, true);
  u8[0x1941F] = version;
  dv.setUint32(0x18E04, party.length, true);
  party.forEach((m, i) => u8.set(encodeMon(m, 5, true), 0x18E08 + i * 220));
  for (const [i, m] of Object.entries(pc)) u8.set(encodeMon(m, 5), 0x400 + Math.floor(i / 30) * 0x1000 + (i % 30) * 136);
  boxNames.forEach((n, b) => putText(dv, 0x04 + b * 0x28, n, 0x28, 5));
  // Cópia de segurança das caixas e dos nomes
  const backup = version >= 22 ? 0x26000 : 0x24000;
  u8.copyWithin(backup, 0, 0x400 + 24 * 0x1000);
  return u8;
}

/**
 * Embrulha num export do Action Replay DS (.duc). overlay = como no export real do Black 2: o save começa
 * no byte 0 e o cabeçalho apaga os 500 primeiros bytes dele (o arquivo termina com 500 bytes 0xFF).
 */
export function wrapDuc(bytes, { overlay = false } = {}) {
  const out = new Uint8Array(500 + bytes.length);
  if (overlay) { out.set(bytes); out.fill(0xFF, bytes.length); out.fill(0, 0, 500); } else out.set(bytes, 500);
  out.set(new TextEncoder().encode('ARDS000000000001'));
  return out;
}
