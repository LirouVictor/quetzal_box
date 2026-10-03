// Peças comuns aos serviços de IA: erro amigável, chamada com tempo-limite e armazenamento local.

import { t } from '../i18n.js';

const TIMEOUT = 120000;

export class AiError extends Error {
  constructor(msg, code) { super(msg); this.name = 'AiError'; this.code = code; }
}

/** Lê/grava no localStorage deste aparelho (falhas são ignoradas: o app funciona sem). */
export const store = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* armazenamento indisponível */ } },
};

export async function call(url, init, fetchImpl, service) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    return await fetchImpl(url, { ...init, signal: ctl.signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new AiError(t('O {service} demorou demais para responder. Tente de novo.', { service }), 'timeout');
    throw new AiError(t('Sem conexão com o {service}. Confira a internet.', { service }), 'network');
  } finally {
    clearTimeout(timer);
  }
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
/** Erros passageiros do lado do serviço (sobrecarga, falha interna): vale tentar de novo ou outro modelo. */
export const transient = status => status === 500 || status === 502 || status === 503 || status === 504;
