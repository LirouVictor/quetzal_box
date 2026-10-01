// Serviços de IA disponíveis. Cada um guarda a própria chave e o próprio modelo neste aparelho.

import * as gemini from './gemini.js';
import * as groq from './groq.js';
import { store } from './http.js';

export const PROVIDERS = { gemini, groq };
const KEY = 'ai-provider';

export const providerId = () => (PROVIDERS[store.get(KEY)] ? store.get(KEY) : 'gemini');
export const setProviderId = id => store.set(KEY, PROVIDERS[id] ? id : '');
export const provider = (id = providerId()) => PROVIDERS[id];
