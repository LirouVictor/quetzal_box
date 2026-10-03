// Formatos de arquivo que embrulham o save (GBA ou DS): aqui só tiramos o embrulho e devolvemos os bytes do save.

const SHARKPORT = 'SharkPortSave';

/**
 * Export do GameShark/SharkPort (.sps): cabeçalho com textos (título, data, notas), 28 bytes do cabeçalho
 * do cartucho e depois o save. Devolve null se não for esse formato.
 */
export function unwrapSharkPort(u8) {
  if (u8.length < 64) return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let o = 0;
  const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; };
  const text = () => { const n = u32(); if (n > 1024 || o + n > u8.length) throw new Error('sps'); const s = new TextDecoder('latin1').decode(u8.subarray(o, o + n)); o += n; return s; };
  try {
    if (text() !== SHARKPORT) return null;
    u32(); // plataforma
    const title = text().trim();
    text(); // data
    text(); // notas
    const size = u32();
    const header = u8.subarray(o, o + 28);
    o += 28;
    if (size < 28 || o + size - 28 > u8.length) return null;
    const gameCode = new TextDecoder('latin1').decode(header.subarray(12, 16));
    return { bytes: u8.subarray(o, o + size - 28), title, gameCode };
  } catch {
    return null;
  }
}

/**
 * Save do Action Replay DS (.duc): cabeçalho de 500 bytes que começa com "ARDS000000000001" e depois o save.
 * Conferido com 3 arquivos (Platinum, HeartGold/SoulSilver e Black/White, 256 KB de save cada).
 * Num export de Black 2 (512 KB) o save começa no byte 0 do arquivo e o cabeçalho ocupa os 500 primeiros
 * bytes dele: `whole` guarda o arquivo inteiro para essa segunda tentativa (feita em load.js).
 */
export function unwrapActionReplay(u8) {
  if (u8.length <= 500) return null;
  const sig = new TextDecoder('latin1').decode(u8.subarray(0, 16));
  return sig === 'ARDS000000000001' ? { bytes: u8.subarray(500), whole: u8 } : null;
}

/** Bytes do save, tirando o embrulho se houver. */
export function unwrap(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const sps = unwrapSharkPort(u8);
  if (sps) return { bytes: sps.bytes, container: 'SharkPort (.sps)', gameCode: sps.gameCode };
  const ards = unwrapActionReplay(u8);
  if (ards) return { bytes: ards.bytes, container: 'Action Replay DS (.duc)', gameCode: null, whole: ards.whole };
  return { bytes: u8, container: null, gameCode: null };
}
