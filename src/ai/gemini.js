// Cliente mínimo da API do Gemini (Google AI Studio), chamado direto do navegador.
// A chave é do próprio usuário e fica só neste aparelho (localStorage).

export const API = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_MODEL = 'gemini-flash-latest';
const TIMEOUT = 120000;

const KEY = 'gemini-key';
const MODEL = 'gemini-model';

const get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const set = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* armazenamento indisponível */ } };

export const getKey = () => get(KEY);
export const setKey = v => set(KEY, (v || '').trim());
export const getModel = () => get(MODEL) || DEFAULT_MODEL;
export const setModel = v => set(MODEL, (v || '').trim().replace(/^models\//, ''));

export class AiError extends Error {
  constructor(msg, code) { super(msg); this.name = 'AiError'; this.code = code; }
}

/** Traduz a resposta de erro da API numa mensagem para o usuário. */
export function errorMessage(status, body) {
  const e = body && body.error ? body.error : {};
  const reason = (e.details || []).map(d => d.reason).find(Boolean) || '';
  const msg = String(e.message || '');
  if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(msg)) return new AiError('A chave do Gemini não é válida. Confira se copiou a chave inteira.', 'key');
  if (status === 403) return new AiError('A chave não tem permissão para usar o Gemini. Crie uma chave nova no Google AI Studio.', 'key');
  if (status === 429) return new AiError('Limite do plano grátis do Gemini atingido. Espere um minuto e tente de novo.', 'quota');
  if (status === 404) return new AiError(`O modelo não foi encontrado (${msg || 'erro 404'}).`, 'model');
  if (status >= 500) return new AiError('O Gemini está sobrecarregado ou fora do ar. Tente de novo daqui a pouco.', 'server');
  return new AiError(`O Gemini recusou o pedido (${status}${msg ? ': ' + msg : ''}).`, 'other');
}

async function call(url, init, fetchImpl) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    return await fetchImpl(url, { ...init, signal: ctl.signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new AiError('O Gemini demorou demais para responder. Tente de novo.', 'timeout');
    throw new AiError('Sem conexão com o Gemini. Confira a internet.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Escolhe um modelo "flash" disponível para a chave (quando o padrão não existe mais). */
export async function pickModel(key, fetchImpl = fetch) {
  const res = await call(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } }, fetchImpl);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw errorMessage(res.status, body);
  const names = (body.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => /flash/.test(n) && !/lite|image|tts|audio|live|exp|preview/.test(n));
  if (!names.length) throw new AiError('Não encontrei um modelo Gemini Flash disponível para esta chave.', 'model');
  // Nome com a maior versão primeiro (ex.: gemini-3-flash antes de gemini-2.5-flash)
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  return names.sort((a, b) => ver(b) - ver(a) || a.length - b.length)[0];
}

/**
 * Gera uma resposta em JSON seguindo `schema`.
 * @returns {Promise<{ data: object, model: string }>}
 */
export async function generateJSON({ system, prompt, schema, key = getKey(), model = getModel(), fetchImpl = fetch, retryModel = true }) {
  if (!key) throw new AiError('Cole sua chave do Gemini primeiro.', 'key');
  const res = await call(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
    }),
  }, fetchImpl);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 404 && retryModel) {
      const other = await pickModel(key, fetchImpl);
      if (other !== model) {
        setModel(other);
        return generateJSON({ system, prompt, schema, key, model: other, fetchImpl, retryModel: false });
      }
    }
    throw errorMessage(res.status, body);
  }
  const cand = body && body.candidates && body.candidates[0];
  const text = cand && cand.content && (cand.content.parts || []).map(p => p.text || '').join('');
  if (!text) {
    const why = (body && body.promptFeedback && body.promptFeedback.blockReason) || (cand && cand.finishReason) || 'resposta vazia';
    throw new AiError(`O Gemini não devolveu uma resposta (${why}). Tente de novo.`, 'empty');
  }
  try {
    return { data: JSON.parse(text), model };
  } catch {
    throw new AiError('A resposta do Gemini veio incompleta. Tente de novo.', 'parse');
  }
}
