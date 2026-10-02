// Monta o que é enviado à IA (só dados dos Pokémon, nunca o .sav) e confere a resposta:
// a IA só pode citar Pokémon que existem no save, pelas referências (E1 = equipe 1, C3-12 = caixa 3, posição 12).

import { STAT_LABEL, SHOWDOWN_ORDER } from '../export.js';
import { analyzeTeam } from '../analysis.js';

const CATEGORY = ['Físico', 'Especial', 'Status'];
/** Limite de candidatos enviados (os de maior total de stats base primeiro). */
export const MAX_CANDIDATES = 250;
/** Cópias da mesma espécie enviadas (as de melhores IVs). */
const PER_SPECIES = 2;

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
const bst = m => (m.species.baseStats ? m.species.baseStats.reduce((a, b) => a + b, 0) : 0);

export const refOf = m => (m.location === 'party' ? `E${m.slot}` : `C${m.boxIndex + 1}-${m.slot}`);
export const REF_RE = /\b(E[1-6]|C\d{1,2}-\d{1,2})\b/g;
export const speciesKey = m => `${m.species.name}|${m.species.form || ''}`;

/** Uma linha compacta por Pokémon. Sem nível nem stats: o jogador pode upar, então não contam. */
export function monLine(m) {
  const sp = m.species;
  const name = sp.name + (sp.form ? ` (${sp.form})` : '') + (m.hasNickname ? ` "${m.nickname}"` : '');
  const parts = [refOf(m), name, sp.types.map(cap).join('/') || 'tipo desconhecido'];
  if (m.ability) parts.push(`Hab: ${m.ability.name}${m.ability.hidden ? ' (oculta)' : ''}`);
  parts.push(`Item: ${m.item ? m.item.name : '—'}`);
  if (m.nature) parts.push(`Natureza: ${m.nature.name}${m.nature.plus ? ` (+${STAT_LABEL[m.nature.plus]} −${STAT_LABEL[m.nature.minus]})` : ''}`);
  if (sp.baseStats) parts.push(`Base ${sp.baseStats.join('/')} = ${bst(m)}`);
  if (m.ivs) parts.push(`IVs ${SHOWDOWN_ORDER.map(k => m.ivs[k]).join('/')}`);
  const moves = m.moves.map(mv => {
    const cat = mv.category !== null && mv.category !== undefined ? CATEGORY[mv.category] : '?';
    return `${mv.name} [${cap(mv.type) || '?'}, ${cat}${mv.power ? ', ' + mv.power : ''}]`;
  });
  parts.push(`Golpes: ${moves.join('; ') || '—'}`);
  return parts.join(' | ');
}

/** Candidatos para trocas e montagem: toda a equipe + os melhores do PC, sem repetir muito a mesma espécie. */
export function candidates(all, max = MAX_CANDIDATES) {
  const party = all.filter(m => m.location === 'party');
  const pc = all.filter(m => m.location !== 'party')
    .sort((a, b) => bst(b) - bst(a) || sum(b.ivs) - sum(a.ivs));
  const seen = new Map(party.map(m => [speciesKey(m), 1]));
  const out = [...party];
  for (const m of pc) {
    if (out.length >= max) break;
    const k = speciesKey(m);
    const n = seen.get(k) || 0;
    if (n >= PER_SPECIES) continue;
    seen.set(k, n + 1);
    out.push(m);
  }
  return out;
}

export const SYSTEM = [
  'Você é um especialista em Pokémon ajudando quem joga Pokémon Quetzal, uma ROM hack de Pokémon Emerald com engine expandida',
  '(tipo Fairy, divisão físico/especial por golpe, megaevoluções, habilidades e golpes até a geração 9, formas regionais).',
  'O jogador quer montar e avaliar equipes para jogar o jogo (batalhas em singles contra treinadores e líderes).',
  'Regras:',
  '- Use SOMENTE os dados enviados: espécies, tipos, habilidades, itens, naturezas, stats base, IVs e golpes. Não invente Pokémon, golpes ou habilidades que não estejam na lista.',
  '- O Quetzal pode ter mudado algumas espécies e golpes; confie nos tipos e dados enviados, não na sua memória.',
  '- Cite Pokémon SEMPRE pela referência do começo de cada linha (ex.: E1, C3-12), também dentro dos textos, e SEM escrever o nome junto (o app troca a referência pelo nome). Certo: "C3-12 resiste a Ice". Errado: "Garchomp (C3-12) resiste a Ice".',
  '- Ignore o nível: o jogador pode treinar qualquer Pokémon.',
  '- Só uma megaevolução pode ser usada por batalha.',
  '- Se sugerir um golpe que o Pokémon ainda não tem, diga que é sugestão e que ele precisa aprender o golpe.',
  '- Escreva em português do Brasil, de forma direta e específica. Nomes de Pokémon, golpes, itens, habilidades e tipos ficam em inglês.',
  '- Frases curtas: cada item de lista com no máximo 2 frases.',
].join('\n');

const str = { type: 'STRING' };
const strList = { type: 'ARRAY', items: str };

export const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nota: { type: 'INTEGER', description: 'Nota da equipe de 0 a 10' },
    resumo: { type: 'STRING', description: 'Resumo em até 3 frases' },
    pontos_fortes: strList,
    pontos_fracos: strList,
    sinergias: { ...strList, description: 'Combinações boas (ou que faltam) entre membros' },
    trocas: {
      type: 'ARRAY',
      description: 'Até 3 trocas sugeridas: sai um membro da equipe, entra um Pokémon do PC',
      items: {
        type: 'OBJECT',
        properties: { sai: { type: 'STRING', description: 'referência E1..E6' }, entra: { type: 'STRING', description: 'referência C<caixa>-<posição>' }, motivo: str },
        required: ['sai', 'entra', 'motivo'],
      },
    },
    dicas: {
      type: 'ARRAY',
      description: 'Dicas por membro (golpes, item, natureza)',
      items: { type: 'OBJECT', properties: { ref: str, texto: str }, required: ['ref', 'texto'] },
    },
  },
  required: ['nota', 'resumo', 'pontos_fortes', 'pontos_fracos', 'sinergias', 'trocas', 'dicas'],
};

export const BUILD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nome: { type: 'STRING', description: 'Nome curto e criativo para a equipe' },
    resumo: { type: 'STRING', description: 'Estratégia em até 3 frases' },
    membros: {
      type: 'ARRAY',
      description: 'Exatamente 6 Pokémon diferentes',
      items: {
        type: 'OBJECT',
        properties: { ref: str, papel: { type: 'STRING', description: 'Papel em 1 a 3 palavras (ex.: atacante físico)' }, motivo: str },
        required: ['ref', 'papel', 'motivo'],
      },
    },
    pontos_fortes: strList,
    pontos_fracos: strList,
    dicas: { ...strList, description: 'Ajustes: golpes, itens, naturezas, quem treinar primeiro' },
  },
  required: ['nome', 'resumo', 'membros', 'pontos_fortes', 'pontos_fracos', 'dicas'],
};

/**
 * Formato da resposta em texto, para serviços sem "schema" nativo (ex.: Groq em modo JSON):
 * um exemplo do objeto e as observações de cada campo.
 */
export function schemaHint(schema) {
  const notes = [];
  const example = (s, path) => {
    if (s.description) notes.push(`- ${path}: ${s.description}`);
    if (s.type === 'OBJECT') return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, example(v, path ? `${path}.${k}` : k)]));
    if (s.type === 'ARRAY') return [example(s.items, `${path}[]`)];
    return s.type === 'INTEGER' ? 0 : '...';
  };
  const ex = example(schema, '');
  return [
    'Responda APENAS com um objeto JSON válido, sem texto antes ou depois, neste formato:',
    JSON.stringify(ex),
    ...(notes.length ? ['Observações sobre os campos:', ...notes] : []),
  ].join('\n');
}

function typeSummary(party, T) {
  const a = analyzeTeam(party, { types: T.types, chart: T.typechart });
  const weak = a.defense.filter(r => r.alert).map(r => `${cap(r.type)} (${r.weak.length} fracos, ${r.resist.length + r.immune.length} resistem/imunes)`);
  return [
    `Tipos que acertam muitos membros em cheio: ${weak.join(', ') || 'nenhum'}.`,
    `Tipos sem nenhum golpe super efetivo da equipe: ${a.gaps.map(cap).join(', ') || 'nenhum'}.`,
  ].join('\n');
}

const wish = text => (text && text.trim() ? `\nPedido do jogador: ${text.trim().slice(0, 300)}\n` : '');

export function analysisPrompt(all, T, note = '', max = MAX_CANDIDATES) {
  const party = all.filter(m => m.location === 'party');
  const pool = candidates(all, max).filter(m => m.location !== 'party');
  return [
    'Avalie a EQUIPE ATUAL: sinergia, fraquezas em comum, cobertura de golpes, papéis e itens. Dê uma nota de 0 a 10.',
    'Sugira até 3 trocas com Pokémon do PC que melhorem a equipe (só se valer a pena) e dicas por membro.',
    wish(note),
    'EQUIPE ATUAL:',
    ...party.map(monLine),
    '',
    'Cálculo do app (só tipos, sem habilidades):',
    typeSummary(party, T),
    '',
    `PC (${pool.length} candidatos):`,
    ...pool.map(monLine),
  ].join('\n');
}

export function buildPrompt(all, T, note = '', max = MAX_CANDIDATES) {
  const pool = candidates(all, max);
  return [
    'Monte a MELHOR EQUIPE de 6 Pokémon com os disponíveis abaixo (equipe atual + PC), sem repetir espécie.',
    'Busque boa sinergia de tipos, cobertura de golpes, papéis variados e no máximo um Pokémon com megapedra.',
    wish(note),
    `DISPONÍVEIS (${pool.length}):`,
    ...pool.map(monLine),
  ].join('\n');
}

const texts = (v, max = 6) => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, max);

/** Confere a análise: notas válidas, trocas e dicas só com referências que existem. */
export function checkAnalysis(data, byRef) {
  const dropped = [];
  const isParty = r => byRef.has(r) && byRef.get(r).location === 'party';
  const isPc = r => byRef.has(r) && byRef.get(r).location !== 'party';
  const trocas = (Array.isArray(data.trocas) ? data.trocas : []).filter(t => {
    const ok = t && isParty(String(t.sai).trim()) && isPc(String(t.entra).trim());
    if (!ok && t) dropped.push(`${t.sai} → ${t.entra}`);
    return ok;
  }).slice(0, 3).map(t => ({ sai: String(t.sai).trim(), entra: String(t.entra).trim(), motivo: String(t.motivo || '').trim() }));
  const dicas = (Array.isArray(data.dicas) ? data.dicas : []).filter(d => {
    const ok = d && byRef.has(String(d.ref).trim()) && String(d.texto || '').trim();
    if (!ok && d && d.ref) dropped.push(String(d.ref));
    return ok;
  }).slice(0, 6).map(d => ({ ref: String(d.ref).trim(), texto: String(d.texto).trim() }));
  const nota = Math.max(0, Math.min(10, Math.round(Number(data.nota) || 0)));
  return {
    nota,
    resumo: String(data.resumo || '').trim(),
    pontos_fortes: texts(data.pontos_fortes),
    pontos_fracos: texts(data.pontos_fracos),
    sinergias: texts(data.sinergias),
    trocas, dicas, dropped,
  };
}

/** Confere a equipe montada: só Pokémon que existem, sem repetir referência nem espécie, até 6. */
export function checkBuild(data, byRef) {
  const dropped = [];
  const refs = new Set(), species = new Set();
  const membros = [];
  for (const x of Array.isArray(data.membros) ? data.membros : []) {
    const ref = String((x && x.ref) || '').trim();
    const m = byRef.get(ref);
    if (!m) { dropped.push(ref || '?'); continue; }
    if (refs.has(ref) || species.has(speciesKey(m)) || membros.length >= 6) continue;
    refs.add(ref); species.add(speciesKey(m));
    membros.push({ ref, papel: String(x.papel || '').trim(), motivo: String(x.motivo || '').trim() });
  }
  return {
    nome: String(data.nome || '').trim() || 'Equipe sugerida',
    resumo: String(data.resumo || '').trim(),
    membros,
    pontos_fortes: texts(data.pontos_fortes),
    pontos_fracos: texts(data.pontos_fracos),
    dicas: texts(data.dicas),
    dropped,
  };
}
