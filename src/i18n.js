// Idioma da interface: português (padrão) ou inglês.
// As chaves são os próprios textos em português; o dicionário inglês (src/i18n/en.js) fica num
// pacote separado, carregado só quando o idioma é inglês (loadLang, chamado em main.js antes de mostrar a página).
// Parâmetros vão entre chaves: t('{n} Pokémon', { n: 3 }).

const KEY = 'lang';
export const LANGS = ['pt', 'en'];

function detect() {
  if (typeof document === 'undefined') return 'pt'; // Node (testes e ferramentas)
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* armazenamento indisponível */ }
  return /^pt\b/i.test(navigator.language || 'pt') ? 'pt' : 'en';
}

let lang = detect();
let dict = null;

export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-US' : 'pt-BR');

/** Carrega o dicionário do idioma atual (nada a fazer em português). */
export async function loadLang() {
  if (lang === 'en' && !dict) dict = (await import('./i18n/en.js')).default;
}

/** Troca o idioma em memória (testes) e, se `d` vier, usa esse dicionário. */
export function setLang(l, d = null) {
  lang = LANGS.includes(l) ? l : 'pt';
  if (d) dict = d;
}

/** Guarda a escolha neste aparelho (vale a partir da próxima carga da página). */
export function saveLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* armazenamento indisponível */ }
}

/** Textos pedidos sem tradução no dicionário (para os testes acharem o que falta traduzir). */
export const missing = new Set();

/** Texto no idioma atual; sem tradução, fica o português. */
export function t(pt, params) {
  let s = pt;
  if (lang !== 'pt' && dict) {
    if (dict[pt]) s = dict[pt];
    else missing.add(pt);
  }
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}

/** Número formatado no idioma atual (1.059.860 / 1,059,860). */
export const num = n => Number(n).toLocaleString(locale());
