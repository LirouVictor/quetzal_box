import { describe as suite, it, expect, beforeEach } from 'vitest';
import { refOf, monLine, candidates, checkAnalysis, checkBuild, analysisPrompt, buildPrompt } from '../src/ai/prompt.js';
import { generateJSON, errorMessage, pickModel, setModel, getModel } from '../src/ai/gemini.js';
import { analysisView, buildView } from '../src/ai/view.js';
import T from '../src/data/tables.js';

const ivs = n => ({ hp: n, atk: n, def: n, spa: n, spd: n, spe: n });
const mon = (o) => ({
  location: o.box ? 'pc' : 'party', where: o.box ? `BOX${o.box}` : 'Equipe', boxIndex: o.box ? o.box - 1 : null, slot: o.slot,
  speciesId: o.id, nickname: o.sp, hasNickname: false,
  species: { name: o.sp, form: null, types: o.types, baseStats: o.base || null, hasIcon: false, spriteId: o.id },
  ability: { name: o.ab || 'Static', hidden: !!o.hidden }, item: o.item ? { name: o.item } : null,
  nature: { name: 'Adamant', plus: 'atk', minus: 'spa' }, ivs: ivs(o.iv ?? 31), evs: ivs(0),
  moves: (o.moves || []).map(([name, type, category, power]) => ({ name, type, category, power })),
  shiny: false, gender: null,
});
const all = [
  mon({ sp: 'Lucario', id: 448, slot: 1, types: ['fighting', 'steel'], base: [70, 110, 70, 115, 70, 90], item: 'Lucarionite Z', hidden: true, ab: 'Justified', moves: [['Close Combat', 'fighting', 0, 120]] }),
  mon({ sp: 'Pelipper', id: 279, slot: 2, types: ['water', 'flying'], base: [60, 50, 100, 95, 70, 65] }),
  mon({ sp: 'Garchomp', id: 445, box: 3, slot: 12, types: ['dragon', 'ground'], base: [108, 130, 95, 80, 85, 102] }),
  mon({ sp: 'Garchomp', id: 445, box: 4, slot: 1, types: ['dragon', 'ground'], base: [108, 130, 95, 80, 85, 102], iv: 10 }),
  mon({ sp: 'Garchomp', id: 445, box: 4, slot: 2, types: ['dragon', 'ground'], base: [108, 130, 95, 80, 85, 102], iv: 5 }),
  mon({ sp: 'Rattata', id: 19, box: 1, slot: 1, types: ['normal'], base: [30, 56, 35, 25, 35, 72] }),
];
const byRef = new Map(all.map(m => [refOf(m), m]));

suite('IA: dados enviados', () => {
  it('referências e linha compacta (sem nível)', () => {
    expect(all.map(refOf)).toEqual(['E1', 'E2', 'C3-12', 'C4-1', 'C4-2', 'C1-1']);
    const line = monLine(all[0]);
    expect(line).toContain('E1 | Lucario | Fighting/Steel');
    expect(line).toContain('Hab: Justified (oculta)');
    expect(line).toContain('Base 70/110/70/115/70/90 = 525');
    expect(line).toContain('Close Combat [Fighting, Físico, 120]');
    expect(line).not.toMatch(/Nv|nível/i);
  });
  it('candidatos: equipe sempre, PC por stats base, no máximo 2 da mesma espécie', () => {
    const c = candidates(all).map(refOf);
    expect(c.slice(0, 2)).toEqual(['E1', 'E2']);
    expect(c).toEqual(['E1', 'E2', 'C3-12', 'C4-1', 'C1-1']);
    expect(candidates(all, 3).map(refOf)).toEqual(['E1', 'E2', 'C3-12']);
  });
  it('prompts: análise separa equipe e PC; montagem inclui o pedido do jogador', () => {
    const a = analysisPrompt(all, T);
    expect(a).toMatch(/EQUIPE ATUAL:\nE1 \| Lucario/);
    expect(a).toMatch(/PC \(3 candidatos\):\nC3-12/);
    const b = buildPrompt(all, T, 'quero usar o Lucario');
    expect(b).toContain('Pedido do jogador: quero usar o Lucario');
    expect(b).toContain('DISPONÍVEIS (5):');
  });
});

suite('IA: conferência da resposta', () => {
  it('análise: descarta trocas e dicas com referências inexistentes ou trocadas', () => {
    const r = checkAnalysis({
      nota: 12.4, resumo: 'ok', pontos_fortes: ['a', '', 'b'], pontos_fracos: [], sinergias: ['E1 e E2'],
      trocas: [{ sai: 'E2', entra: 'C3-12', motivo: 'm' }, { sai: 'E9', entra: 'C3-12', motivo: 'x' }, { sai: 'C3-12', entra: 'E1', motivo: 'y' }],
      dicas: [{ ref: 'E1', texto: 'use Swords Dance' }, { ref: 'C99-1', texto: 'z' }],
    }, byRef);
    expect(r.nota).toBe(10);
    expect(r.pontos_fortes).toEqual(['a', 'b']);
    expect(r.trocas).toEqual([{ sai: 'E2', entra: 'C3-12', motivo: 'm' }]);
    expect(r.dicas.map(d => d.ref)).toEqual(['E1']);
    expect(r.dropped).toEqual(['E9 → C3-12', 'C3-12 → E1', 'C99-1']);
  });
  it('montagem: sem repetir referência nem espécie, até 6', () => {
    const r = checkBuild({
      nome: '', resumo: 'r', pontos_fortes: [], pontos_fracos: [], dicas: [],
      membros: [{ ref: 'E1', papel: 'p', motivo: 'm' }, { ref: 'E1' }, { ref: 'C3-12' }, { ref: 'C4-1' }, { ref: 'X1' }, { ref: 'C1-1' }],
    }, byRef);
    expect(r.nome).toBe('Equipe sugerida');
    expect(r.membros.map(x => x.ref)).toEqual(['E1', 'C3-12', 'C1-1']);
    expect(r.dropped).toEqual(['X1']);
  });
  it('telas: nomes no lugar das referências e texto escapado', () => {
    const a = checkAnalysis({ nota: 7, resumo: 'E1 <b>forte</b>', pontos_fortes: [], pontos_fracos: [], sinergias: [], trocas: [{ sai: 'E2', entra: 'C3-12', motivo: 'C3-12 cobre E2' }], dicas: [] }, byRef);
    const html = analysisView(a, byRef, 'gemini-x');
    expect(html).toContain('<b>Lucario</b> &lt;b&gt;forte&lt;/b&gt;');
    expect(html).toContain('<b>Garchomp</b> cobre <b>Pelipper</b>');
    expect(html).toContain('data-ref="C3-12"');
    const b = checkBuild({ nome: 'Time', resumo: '', pontos_fortes: [], pontos_fracos: [], dicas: [], membros: [{ ref: 'E1', papel: 'atacante', motivo: 'm' }] }, byRef);
    expect(buildView(b, byRef, 'gemini-x', T)).toContain('A IA sugeriu só 1 Pokémon válidos.');
  });
});

suite('IA: cliente do Gemini', () => {
  const store = new Map();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  });
  const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  const ok = obj => json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] });

  it('envia chave no cabeçalho, schema JSON e lê a resposta', async () => {
    let req;
    const fetchImpl = (url, init) => { req = { url, init }; return ok({ nota: 8 }); };
    const r = await generateJSON({ system: 's', prompt: 'p', schema: { type: 'OBJECT' }, key: 'K', model: 'm1', fetchImpl });
    expect(r).toEqual({ data: { nota: 8 }, model: 'm1' });
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent');
    expect(req.init.headers['x-goog-api-key']).toBe('K');
    const body = JSON.parse(req.init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toBe('s');
  });
  it('mensagens de erro', () => {
    expect(errorMessage(400, { error: { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } }).code).toBe('key');
    expect(errorMessage(429, {}).code).toBe('quota');
    expect(errorMessage(503, {}).code).toBe('server');
  });
  it('modelo inexistente: escolhe outro Flash disponível e guarda', async () => {
    const calls = [];
    const fetchImpl = (url) => {
      calls.push(url);
      if (url.includes('/models?')) return json(200, { models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
      ] });
      if (url.includes('/old:')) return json(404, { error: { message: 'not found' } });
      return ok({ ok: true });
    };
    const r = await generateJSON({ system: 's', prompt: 'p', schema: {}, key: 'K', model: 'old', fetchImpl });
    expect(r.model).toBe('gemini-3-flash');
    expect(getModel()).toBe('gemini-3-flash');
    expect(calls.length).toBe(3);
    expect(await pickModel('K', fetchImpl)).toBe('gemini-3-flash');
  });
  it('sobrecarga (503): tenta de novo e depois outro modelo, sem guardar a troca', async () => {
    const calls = [];
    const fetchImpl = (url) => {
      calls.push(url.replace('https://generativelanguage.googleapis.com/v1beta/', ''));
      if (url.includes('/models?')) return json(200, { models: [
        { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      ] });
      if (url.includes('/gemini-flash-latest:')) return json(503, { error: { code: 503, message: 'The model is overloaded.' } });
      return ok({ ok: true });
    };
    const r = await generateJSON({ system: 's', prompt: 'p', schema: {}, key: 'K', model: 'gemini-flash-latest', fetchImpl, sleep: () => Promise.resolve() });
    expect(r.model).toBe('gemini-2.5-flash');
    expect(calls).toEqual(['models/gemini-flash-latest:generateContent', 'models/gemini-flash-latest:generateContent', 'models?pageSize=200', 'models/gemini-2.5-flash:generateContent']);
    expect(getModel()).toBe('gemini-flash-latest');
  });
  it('sobrecarga em todos: mensagem com o detalhe do Google', async () => {
    const fetchImpl = (url) => url.includes('/models?')
      ? json(200, { models: [] })
      : json(503, { error: { code: 503, message: 'The model is overloaded.' } });
    await expect(generateJSON({ system: '', prompt: '', schema: {}, key: 'K', model: 'm', fetchImpl, sleep: () => Promise.resolve() }))
      .rejects.toMatchObject({ code: 'server', message: expect.stringContaining('503: The model is overloaded.') });
  });
  it('sem chave ou sem conexão', async () => {
    await expect(generateJSON({ system: '', prompt: '', schema: {}, key: '' })).rejects.toMatchObject({ code: 'key' });
    const fetchImpl = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(generateJSON({ system: '', prompt: '', schema: {}, key: 'K', model: 'm', fetchImpl })).rejects.toMatchObject({ code: 'network' });
    setModel('models/x'); expect(getModel()).toBe('x');
  });
});
