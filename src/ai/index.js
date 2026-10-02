// Funções de IA (carregadas sob demanda, só quando o usuário toca num botão do assistente).

import { provider } from './providers.js';
import { refOf, systemPrompt, ANALYSIS_SCHEMA, BUILD_SCHEMA, analysisPrompt, buildPrompt, checkAnalysis, checkBuild } from './prompt.js';
import { analysisView, buildView } from './view.js';

/**
 * @param {'analyze'|'build'} kind
 * @param {{ all: object[], T: object, game?: object, note?: string }} ctx
 * @returns {Promise<{ html: string, byRef: Map<string, object>, team: object[]|null }>}
 */
export async function runAi(kind, { all, T, game = null, note = '' }) {
  const system = systemPrompt(game);
  const P = provider();
  const byRef = new Map(all.map(m => [refOf(m), m]));
  const label = model => `${P.service} (${model})`;
  if (kind === 'analyze') {
    const { data, model } = await P.generateJSON({ system, prompt: analysisPrompt(all, T, note, P.maxCandidates), schema: ANALYSIS_SCHEMA });
    return { html: analysisView(checkAnalysis(data, byRef), byRef, label(model)), byRef, team: null };
  }
  const { data, model } = await P.generateJSON({ system, prompt: buildPrompt(all, T, note, P.maxCandidates), schema: BUILD_SCHEMA });
  const r = checkBuild(data, byRef);
  return { html: buildView(r, byRef, label(model), T), byRef, team: r.membros.map(x => byRef.get(x.ref)) };
}
