// Carregado sob demanda quando o usuário abre um save (parser + tabelas + renderização).

import { parseSave, describe } from './parser/index.js';
import T from './data/tables.js';
import { toCSV, toShowdown, toJSON, fileBase } from './export.js';
import { download, copyText } from './ui/io.js';
import * as R from './ui/render.js';
import { searchMons } from './search.js';
import * as Gemini from './ai/gemini.js';

const PAGE = 60;
let moveText = null; // descrições dos golpes, carregadas na primeira vez que um golpe é aberto

let state = null;

export function openSave(buffer, fileName) {
  const data = describe(parseSave(buffer), T);
  const firstFilled = data.pc.boxes.findIndex(b => b.slots.length);
  const all = [...data.party, ...data.pc.boxes.flatMap(b => b.slots)];
  state = { data, fileName, box: firstFilled >= 0 ? firstFilled : 0, all, results: [], shown: 0 };
  render();
  return data;
}

function render() {
  const { data, fileName } = state;
  const out = document.getElementById('out');
  out.innerHTML = `
    <div class="top-grid">${R.trainerWin(data, fileName)}${R.exportWin()}</div>
    ${R.warningsWin(data.warnings)}
    ${R.partyWin(data)}
    ${R.analysisWin(data, T)}
    ${R.aiWin(data, { hasKey: !!Gemini.getKey(), model: Gemini.getModel() })}
    ${R.pcWin(data)}
    ${R.searchWin(data, T)}
    ${R.notesWin()}`;
  out.classList.remove('hidden');
  renderBox();

  out.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () => exportAs(b.dataset.exp)));
  out.querySelector('[data-copy="party"]').addEventListener('click', async () => {
    const ok = await copyText(toShowdown({ ...data, pc: { boxes: [] } }, { includePC: false }));
    status(ok ? 'Equipe copiada no formato Showdown.' : 'Não consegui copiar neste navegador. Use "Showdown (TXT)".');
  });
  const sel = out.querySelector('#box-select');
  sel.addEventListener('change', () => { state.box = +sel.value; renderBox(); });
  out.querySelectorAll('[data-box-step]').forEach(b => b.addEventListener('click', () => {
    const n = data.pc.boxes.length;
    state.box = (state.box + Number(b.dataset.boxStep) + n) % n;
    renderBox();
  }));
  out.querySelector('#box-grid').addEventListener('click', e => {
    const btn = e.target.closest('.slot[data-slot]');
    if (!btn) return;
    const m = state.data.pc.boxes[state.box].slots.find(s => s.slot === +btn.dataset.slot);
    if (m) openDetail(m, btn);
  });

  // Análise: tocar no número mostra quem é fraco/resiste/imune
  const typetab = out.querySelector('.typetab');
  if (typetab) typetab.addEventListener('click', e => {
    const b = e.target.closest('.cnt[data-info]');
    if (b) document.getElementById('type-info').textContent = b.dataset.info;
  });

  setupAi(out);

  // Busca
  let timer = 0;
  const run = () => { clearTimeout(timer); timer = setTimeout(runSearch, 150); };
  ['#q', '#f-type', '#f-sort'].forEach(sel => {
    const el = out.querySelector(sel);
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', run);
  });
  // Filtros: um ativo por vez; tocar de novo desliga
  out.querySelector('.flags').addEventListener('click', e => {
    const b = e.target.closest('.flag');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    out.querySelectorAll('.flag').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    state.flag = on ? b.dataset.flag : '';
    runSearch();
  });
  out.querySelector('#more').addEventListener('click', () => showResults());
  out.querySelector('#results').addEventListener('click', e => {
    const btn = e.target.closest('.result[data-i]');
    if (btn) openDetail(state.results[+btn.dataset.i], btn);
  });
  runSearch();
}

// Assistente (IA): a chave fica no aparelho; o código das análises só carrega ao tocar num botão.
function setupAi(out) {
  const $ = s => out.querySelector(s);
  const aiOut = $('#ai-out');
  const showMain = on => { $('#ai-setup').classList.toggle('hidden', on); $('#ai-main').classList.toggle('hidden', !on); };
  $('#ai-save').addEventListener('click', () => {
    const v = $('#ai-key').value.trim();
    if (!v) { aiOut.innerHTML = '<p class="error">Cole a chave antes de salvar.</p>'; return; }
    Gemini.setKey(v);
    $('#ai-key').value = '';
    aiOut.innerHTML = '';
    showMain(true);
  });
  $('#ai-forget').addEventListener('click', () => {
    Gemini.setKey('');
    aiOut.innerHTML = '';
    showMain(false);
  });
  $('#ai-model-save').addEventListener('click', () => {
    Gemini.setModel($('#ai-model').value);
    $('#ai-model').value = Gemini.getModel();
  });
  const buttons = out.querySelectorAll('[data-ai]');
  buttons.forEach(b => b.addEventListener('click', async () => {
    const disabled = [...buttons].map(x => x.disabled);
    buttons.forEach(x => { x.disabled = true; });
    aiOut.innerHTML = `<p class="ai-wait"><span class="pixel">${b.dataset.ai === 'analyze' ? 'Analisando a equipe' : 'Montando a equipe'}</span><span class="dots" aria-hidden="true"></span><br><small>Pode levar até um minuto.</small></p>`;
    try {
      const ai = await import('./ai/index.js');
      const res = await ai.runAi(b.dataset.ai, { all: state.all, T, note: $('#ai-note').value });
      state.ai = res;
      aiOut.innerHTML = res.html;
      aiOut.scrollIntoView({ block: 'start' });
      $('#ai-model').value = Gemini.getModel();
    } catch (e) {
      console.error(e);
      const msg = e && e.name === 'AiError' ? e.message : 'Algo deu errado ao falar com o Gemini. Tente de novo.';
      aiOut.innerHTML = `<p class="error">${R.esc(msg)}</p>`;
      if (e && e.code === 'key') showMain(false);
    } finally {
      buttons.forEach((x, i) => { x.disabled = disabled[i]; });
    }
  }));
  aiOut.addEventListener('click', async e => {
    const card = e.target.closest('[data-ref]');
    if (card && state.ai) { const m = state.ai.byRef.get(card.dataset.ref); if (m) openDetail(m, card); return; }
    const copy = e.target.closest('[data-ai-copy]');
    if (copy && state.ai && state.ai.team) {
      const ok = await copyText(toShowdown({ party: state.ai.team, pc: { boxes: [] } }, { includePC: false }).replace(/^=== Equipe ===\n\n/, ''));
      copy.textContent = ok ? 'Copiado!' : 'Não foi possível copiar';
    }
  });
}

function runSearch() {
  const v = id => document.getElementById(id).value;
  const f = { q: v('q'), type: v('f-type'), flag: state.flag || '', sort: v('f-sort') };
  state.results = searchMons(state.all, f);
  state.filtered = !!(f.q.trim() || f.type || f.flag);
  state.shown = 0;
  document.getElementById('results').innerHTML = '';
  showResults();
}

function showResults() {
  const list = document.getElementById('results');
  const next = state.results.slice(state.shown, state.shown + PAGE);
  list.insertAdjacentHTML('beforeend', next.map((m, j) => R.resultRow(m, state.shown + j)).join(''));
  state.shown += next.length;
  const total = state.results.length;
  document.getElementById('search-count').textContent = state.filtered
    ? `${total} resultado${total === 1 ? '' : 's'}.`
    : `${total} Pokémon na equipe e no PC.`;
  document.getElementById('more').classList.toggle('hidden', state.shown >= total);
}

// Descrição do golpe: carrega o arquivo de textos na primeira vez que um golpe é aberto
document.addEventListener('toggle', async e => {
  const det = e.target;
  if (!(det instanceof HTMLDetailsElement) || !det.open || !det.classList.contains('move')) return;
  const p = det.querySelector('.move-desc');
  if (!p || p.dataset.loaded) return;
  if (!moveText) moveText = (await import('./data/move-text.json')).default;
  p.textContent = moveText[+p.dataset.move] || '';
  p.dataset.loaded = '1';
}, true);

function renderBox() {
  const { data } = state;
  const box = data.pc.boxes[state.box];
  const grid = document.getElementById('box-grid');
  if (!box) { grid.innerHTML = '<p class="hint">O PC não pôde ser lido.</p>'; return; }
  grid.innerHTML = R.boxGrid(box);
  document.getElementById('box-select').value = String(state.box);
  const total = data.pc.boxes.reduce((a, b) => a + b.slots.length, 0);
  document.getElementById('pc-count').textContent = `${total} Pokémon no total`;
}

function openDetail(m, opener) {
  const dlg = document.getElementById('detail');
  dlg.innerHTML = R.monDetail(m);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-copy="mon"]').addEventListener('click', async e => {
    const ok = await copyText(toShowdown({ party: [m], pc: { boxes: [] } }, { includePC: false }).replace(/^=== Equipe ===\n\n/, ''));
    e.target.textContent = ok ? 'Copiado!' : 'Não foi possível copiar';
  });
  // Ao fechar, volta exatamente para onde a página estava.
  const scroll = window.scrollY;
  dlg.addEventListener('close', () => {
    opener.focus({ preventScroll: true });
    if (window.scrollY !== scroll) window.scrollTo(0, scroll);
  }, { once: true });
  dlg.showModal();
}

function exportAs(kind) {
  const { data } = state;
  const base = fileBase(data);
  if (kind === 'csv') download(base + '.csv', toCSV(data), 'text/csv');
  else if (kind === 'txt') download(base + '-showdown.txt', toShowdown(data), 'text/plain');
  else download(base + '.json', toJSON(data, { exportedAt: new Date().toISOString(), sourceFile: state.fileName }), 'application/json');
  status('Arquivo gerado. Confira a pasta de downloads.');
}

function status(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}
