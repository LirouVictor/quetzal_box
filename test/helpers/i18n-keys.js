// Extrai as chaves de tradução do código: o 1º argumento de cada t(...) (inclusive os dois lados
// de um ternário, como t(ok ? 'a' : 'b')) e os textos marcados com data-i18n no index.html.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const files = dir => readdirSync(dir).flatMap(f => {
  const full = path.join(dir, f);
  return statSync(full).isDirectory() ? files(full) : full.endsWith('.js') ? [full] : [];
});

/** Lê um literal de texto ('…', "…" ou `…` sem ${}) a partir de src[i]; devolve [texto, fim] ou null. */
function literal(src, i) {
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let out = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { const n = src[++j]; out += n === 'n' ? '\n' : n; continue; }
    if (q === '`' && c === '$' && src[j + 1] === '{') return null;
    if (c === q) return [out, j + 1];
    out += c;
  }
  return null;
}

/** Chaves usadas em t(...) num trecho de código. */
export function keysInCode(src) {
  const keys = [];
  const re = /(?<![\w.$])t\(/g;
  for (const m of src.matchAll(re)) {
    // Percorre o 1º argumento (até a vírgula ou o parêntese do nível 0) e pega os literais desse nível
    let depth = 0;
    for (let i = m.index + 2; i < src.length; i++) {
      const c = src[i];
      const lit = depth === 0 ? literal(src, i) : null;
      if (lit) { keys.push(lit[0]); i = lit[1] - 1; continue; }
      if (c === "'" || c === '"' || c === '`') { const l = literal(src, i); if (l) { i = l[1] - 1; continue; } }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
    }
  }
  return keys;
}

export function codeKeys() {
  const keys = new Set();
  for (const f of files(path.join(ROOT, 'src'))) {
    if (f.includes(`${path.sep}i18n${path.sep}`) || f.endsWith(`${path.sep}i18n.js`)) continue;
    for (const k of keysInCode(readFileSync(f, 'utf8'))) keys.add(k);
  }
  return keys;
}

export function htmlKeys() {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const norm = s => s.trim().replace(/\s+/g, ' ');
  const keys = new Set();
  for (const m of html.matchAll(/<(\w+)\b[^>]*\sdata-i18n(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) keys.add(norm(m[2]));
  for (const m of html.matchAll(/<\w+\b([^>]*)\sdata-i18n-attr="([^"]+)"([^>]*)>/g)) {
    const attrs = m[1] + ' ' + m[3];
    for (const a of m[2].split(',')) {
      const v = attrs.match(new RegExp(`\\s${a}="([^"]*)"`));
      if (v) keys.add(norm(v[1]));
    }
  }
  return keys;
}
