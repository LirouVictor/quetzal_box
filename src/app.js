// Carregado sob demanda quando o usuário abre um save (parser + tabelas + renderização).

import { parseSave, describe } from './parser/index.js';
import T from './data/tables.js';
import { toCSV, toShowdown, toJSON, fileBase } from './export.js';
import { download, copyText } from './ui/io.js';
import * as R from './ui/render.js';

let state = null;

export function openSave(buffer, fileName) {
  const data = describe(parseSave(buffer), T);
  const firstFilled = data.pc.boxes.findIndex(b => b.slots.length);
  state = { data, fileName, box: firstFilled >= 0 ? firstFilled : 0 };
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
    ${R.pcWin(data)}
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
    if (btn) openDetail(+btn.dataset.slot, btn);
  });
}

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

function openDetail(slot, opener) {
  const m = state.data.pc.boxes[state.box].slots.find(s => s.slot === slot);
  if (!m) return;
  const dlg = document.getElementById('detail');
  dlg.innerHTML = R.pcDetail(m);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-copy="mon"]').addEventListener('click', async e => {
    const ok = await copyText(toShowdown({ party: [m], pc: { boxes: [] } }, { includePC: false }).replace(/^=== Equipe ===\n\n/, ''));
    e.target.textContent = ok ? 'Copiado!' : 'Não foi possível copiar';
  });
  dlg.addEventListener('close', () => opener.focus(), { once: true });
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
