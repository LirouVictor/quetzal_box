// Formatos de arquivo que embrulham o save do GBA: aqui só tiramos o embrulho e devolvemos os bytes do save.

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

/** Bytes do save, tirando o embrulho se houver. */
export function unwrap(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const sps = unwrapSharkPort(u8);
  return sps ? { bytes: sps.bytes, container: 'SharkPort (.sps)', gameCode: sps.gameCode } : { bytes: u8, container: null, gameCode: null };
}
