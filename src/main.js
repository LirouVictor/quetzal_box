// Entrada leve: tema, abertura de arquivo e service worker.
// O parser, as tabelas e a renderização vêm em app.js, carregado sob demanda.

import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles/main.css';
import { installImageFallback } from './ui/sprites.js';

const $ = s => document.querySelector(s);
const loadApp = () => import('./app.js');

installImageFallback();

// Tema: segue o sistema até o usuário escolher; a escolha fica salva neste aparelho.
const root = document.documentElement;
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
function syncThemeButton() {
  const dark = currentTheme() === 'dark';
  $('#theme use').setAttribute('href', dark ? '#sun' : '#moon');
  $('#theme').setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro');
}
$('#theme').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { /* armazenamento indisponível */ }
  syncThemeButton();
});
systemDark.addEventListener('change', syncThemeButton);
syncThemeButton();

// Abrir arquivo
function showError(msg) {
  const el = $('#err');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function load(file) {
  $('#err').classList.add('hidden');
  try {
    const [buf, app] = await Promise.all([file.arrayBuffer(), loadApp()]);
    app.openSave(buf, file.name);
    $('#intro').classList.add('hidden');
    $('#reopen').classList.remove('hidden');
    scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    showError(e && e.name === 'SaveError'
      ? e.message
      : 'Não consegui ler este arquivo. Confira se é o .sav do Quetzal e tente de novo.');
    $('#intro').classList.remove('hidden');
  }
}

$('#file').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) load(f);
  e.target.value = '';
});

const drop = $('#drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
// Soltar o arquivo em qualquer lugar da página (inclusive na área acima) abre o save
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) load(f); });

// Pré-carrega o resto do app quando o navegador estiver ocioso (fica pronto e entra no cache offline).
(window.requestIdleCallback || (cb => setTimeout(cb, 1500)))(() => loadApp());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
