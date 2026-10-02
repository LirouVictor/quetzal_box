// Entrada leve: tema, abertura de arquivo e service worker.
// O parser, as tabelas e a renderização vêm em app.js, carregado sob demanda.

import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './styles/main.css';
import { installImageFallback } from './ui/sprites.js';
import { rememberSave, loadRememberedSave, forgetSave } from './ui/store.js';

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

function showSavedNote(name, savedAt) {
  const when = new Date(savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  $('#saved-text').textContent = `Mostrando a cópia guardada de "${name}" (aberta em ${when}). Se você jogou depois disso, abra o .sav de novo para atualizar.`;
  $('#saved-note').classList.remove('hidden');
}

/**
 * Abre um save a partir dos bytes.
 * @param {ArrayBuffer} buf
 * @param {string} name
 * @param {{ fromCopy?: number }} [opts] fromCopy = data em que a cópia guardada foi feita
 */
async function openBytes(buf, name, opts = {}) {
  const app = await loadApp();
  app.openSave(buf, name);
  $('#intro').classList.add('hidden');
  $('#reopen').classList.remove('hidden');
  if (opts.fromCopy) showSavedNote(name, opts.fromCopy);
  else $('#saved-note').classList.add('hidden');
  scrollTo(0, 0);
}

async function load(file) {
  $('#err').classList.add('hidden');
  try {
    const buf = await file.arrayBuffer();
    await openBytes(buf, file.name);
    // Guarda uma cópia para abrir automaticamente na próxima visita (só neste aparelho).
    rememberSave({ name: file.name, bytes: buf });
  } catch (e) {
    console.error(e);
    showError(e && e.name === 'SaveError'
      ? e.message
      : 'Não consegui ler este arquivo. Confira se é o .sav do Quetzal e tente de novo.');
    $('#intro').classList.remove('hidden');
  }
}

$('#forget').addEventListener('click', async () => {
  await forgetSave();
  $('#saved-note').classList.add('hidden');
  $('#out').classList.add('hidden');
  $('#out').innerHTML = '';
  $('#reopen').classList.add('hidden');
  $('#intro').classList.remove('hidden');
  scrollTo(0, 0);
});

// Save recebido pelo menu "Compartilhar" do Android (o service worker guarda; ver sw-template.js).
const SHARE_CACHE = 'qsv-share';
const SHARE_KEY = './shared-save';
async function takeSharedSave() {
  if (!new URLSearchParams(location.search).has('shared')) return null;
  history.replaceState(null, '', location.pathname);
  try {
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(SHARE_KEY);
    if (!res) return null;
    await cache.delete(SHARE_KEY);
    const name = decodeURIComponent(res.headers.get('x-file-name') || 'save.sav');
    return new File([await res.blob()], name);
  } catch {
    return null;
  }
}

// Abre o save compartilhado; se não houver, a cópia do último save, se houver.
takeSharedSave().then(async shared => {
  if (shared) return load(shared);
  const saved = await loadRememberedSave();
  if (!saved || !$('#out').classList.contains('hidden')) return;
  openBytes(saved.bytes, saved.name, { fromCopy: saved.savedAt }).catch(() => forgetSave());
});

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
