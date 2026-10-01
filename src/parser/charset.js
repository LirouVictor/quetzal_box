// Tabela de caracteres da Gen 3 (versões ocidentais, charmap do pokeemerald).
// Cobre o que aparece em nomes de treinador, apelidos e nomes de caixa.
// Códigos não mapeados viram '?'. 0xFF termina a string.

const MAP = new Map([
  [0x00, ' '],
  [0x01, 'À'], [0x02, 'Á'], [0x03, 'Â'], [0x04, 'Ç'], [0x05, 'È'], [0x06, 'É'], [0x07, 'Ê'], [0x08, 'Ë'],
  [0x09, 'Ì'], [0x0B, 'Î'], [0x0C, 'Ï'], [0x0D, 'Ò'], [0x0E, 'Ó'], [0x0F, 'Ô'], [0x10, 'Œ'], [0x11, 'Ù'],
  [0x12, 'Ú'], [0x13, 'Û'], [0x14, 'Ñ'], [0x15, 'ß'], [0x16, 'à'], [0x17, 'á'], [0x19, 'ç'], [0x1A, 'è'],
  [0x1B, 'é'], [0x1C, 'ê'], [0x1D, 'ë'], [0x1E, 'ì'], [0x20, 'î'], [0x21, 'ï'], [0x22, 'ò'], [0x23, 'ó'],
  [0x24, 'ô'], [0x25, 'œ'], [0x26, 'ù'], [0x27, 'ú'], [0x28, 'û'], [0x29, 'ñ'], [0x2A, 'º'], [0x2B, 'ª'],
  [0x2D, '&'], [0x2E, '+'], [0x35, '='], [0x36, ';'], [0x51, '¿'], [0x52, '¡'], [0x5A, 'Í'], [0x5B, '%'],
  [0x5C, '('], [0x5D, ')'], [0x68, 'â'], [0x6F, 'í'], [0x85, '<'], [0x86, '>'],
  [0xAB, '!'], [0xAC, '?'], [0xAD, '.'], [0xAE, '-'], [0xAF, '·'], [0xB0, '…'], [0xB1, '“'], [0xB2, '”'],
  [0xB3, '‘'], [0xB4, '’'], [0xB5, '♂'], [0xB6, '♀'], [0xB8, ','], [0xB9, '×'], [0xBA, '/'], [0xF0, ':'],
]);
for (let i = 0; i < 10; i++) MAP.set(0xA1 + i, String.fromCharCode(48 + i));
for (let i = 0; i < 26; i++) {
  MAP.set(0xBB + i, String.fromCharCode(65 + i));
  MAP.set(0xD5 + i, String.fromCharCode(97 + i));
}

export const EOS = 0xFF;

/**
 * Decodifica até `len` bytes de texto Gen 3.
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} len
 */
export function decodeText(bytes, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const b = bytes[offset + i];
    if (b === EOS) break;
    s += MAP.get(b) ?? '?';
  }
  return s.trim();
}

/** Codifica texto para Gen 3 (usado nos testes para montar saves sintéticos). */
export function encodeText(str, len) {
  const rev = new Map([...MAP].map(([k, v]) => [v, k]));
  const out = new Uint8Array(len).fill(EOS);
  [...str].slice(0, len).forEach((ch, i) => { out[i] = rev.get(ch) ?? 0xAC; });
  return out;
}
