// Templates HTML da interface. Strings simples, sem framework.

import { spriteSrc, iconSrc, spriteUrl } from './sprites.js';
import { SHOWDOWN_ORDER, STAT_LABEL } from '../export.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad5 = n => String(n).padStart(5, '0');
const PROBABLE = 'provável';

function typeChips(types) {
  if (!types.length) return '';
  return `<div class="types">${types.map(t => `<span class="type t-${esc(t)}">${esc(t)}</span>`).join('')}</div>`;
}

function badge(conf) {
  if (conf === PROBABLE) return ' <span class="badge" title="Identificação provável, ainda não confirmada">provável</span>';
  if (conf === 'desconhecido') return ' <span class="badge" title="ID do Quetzal ainda não mapeado">?</span>';
  return '';
}

function speciesLabel(sp) {
  return esc(sp.name) + (sp.form ? ` <span class="form">(${esc(sp.form === '?' ? 'forma ?' : sp.form)})</span>` : '');
}

function portrait(m, size = 96) {
  const sp = m.species;
  const t = sp.types[0] ? ` t-${esc(sp.types[0])}` : '';
  // Sprite shiny com o normal como alternativa, se a versão shiny não existir
  const next = m.shiny && sp.spriteId ? ` data-next="${esc(spriteSrc(sp))}"` : '';
  return `<div class="portrait${t}"><img data-sprite="1"${next} src="${esc(spriteSrc(sp, m.shiny))}" width="${size}" height="${size}" alt="" decoding="async" loading="lazy" crossorigin="anonymous"></div>`;
}

function movesList(moves) {
  if (!moves.length) return '<p class="hint">Sem golpes.</p>';
  return `<ul class="moves">${moves.map(mv => `
    <li class="move t-${esc(mv.type || 'none')}">
      <span>${esc(mv.name)}</span><span class="pp">${mv.pp} PP</span>
      <span class="mt">${esc(mv.type || '—')}</span>
    </li>`).join('')}</ul>`;
}

/** Tabela de stats com colunas fixas: rótulo, [valor], barra, IV, EV. */
function statRows(m, { withStats }) {
  const max = withStats ? Math.max(...SHOWDOWN_ORDER.map(k => m.stats[k]), 1) : 31;
  const rows = SHOWDOWN_ORDER.map(k => {
    const cls = m.nature && m.nature.plus === k ? 'plus' : m.nature && m.nature.minus === k ? 'minus' : '';
    const mark = cls === 'plus' ? '+' : cls === 'minus' ? '−' : '';
    const iv = m.ivs[k];
    const value = withStats ? m.stats[k] : iv;
    return `<tr>
      <th class="${cls}" scope="row">${STAT_LABEL[k]}${mark}</th>
      ${withStats ? `<td class="num">${m.stats[k]}</td>` : ''}
      <td><div class="bar"><i style="width:${Math.round(value / max * 100)}%"></i></div></td>
      <td class="iv${iv === 31 ? ' max' : ''}">${iv}</td>
      <td class="ev">${m.evs[k]}</td>
    </tr>`;
  }).join('');
  const head = `<thead><tr><td></td>${withStats ? '<td></td>' : ''}<td></td><th scope="col" class="iv">IV</th><th scope="col" class="ev">EV</th></tr></thead>`;
  const caption = withStats ? 'Barras relativas ao maior stat deste Pokémon.' : 'Barras = IV (0–31). Stats não são guardados no PC.';
  return `<table class="stats"><caption>${caption}</caption>${head}<tbody>${rows}</tbody></table>`;
}

const ivEvTable = m => statRows(m, { withStats: false });
const statsTable = m => statRows(m, { withStats: true });

function ballChip(b) {
  if (!b) return '<span class="chip unread"><span class="k">Bola</span> não lida</span>';
  return `<span class="chip"><span class="k">Bola</span><b>${esc(b.name)}</b>${badge(b.confidence)}</span>`;
}

function natureChip(n) {
  if (!n) return '<span class="chip unread"><span class="k">Natureza</span> não lida</span>';
  const eff = n.plus ? ` <span class="k">+${STAT_LABEL[n.plus]} −${STAT_LABEL[n.minus]}</span>` : ' <span class="k">neutra</span>';
  return `<span class="chip"><span class="k">Natureza</span><b>${esc(n.name)}</b>${eff}</span>`;
}

function itemChip(item, complete) {
  if (!complete) return '<span class="chip unread"><span class="k">Item</span> não lido</span>';
  if (!item) return '<span class="chip"><span class="k">Item</span> nenhum</span>';
  return `<span class="chip"><span class="k">Item</span><b>${esc(item.name)}</b>${badge(item.confidence)}</span>`;
}

function abilityChip(ab) {
  if (!ab) return '<span class="chip unread"><span class="k">Habilidade</span> não lida</span>';
  return `<span class="chip"><span class="k">Habilidade</span><b>${esc(ab.name)}</b>${ab.hidden ? ' <span class="k">oculta</span>' : ''}${badge(ab.confidence)}</span>`;
}

function monHeader(m, headingTag = 'h3', idAttr = '') {
  const sp = m.species;
  const title = m.hasNickname ? esc(m.nickname) : speciesLabel(sp);
  const sub = [
    m.hasNickname ? speciesLabel(sp) : null,
    `#${m.speciesId}`,
  ].filter(Boolean).join(' · ');
  return `<div class="mon-head">
    ${portrait(m)}
    <div>
      <${headingTag} class="mon-name"${idAttr}>${title}${m.shiny ? ' <span class="shiny" title="Shiny">★<span class="sr"> shiny</span></span>' : ''}${badge(sp.confidence)}</${headingTag}>
      <div class="mon-sub">${sub}${m.level ? ` · <span class="lv"${m.levelFromExp ? ' title="Calculado pela experiência (curva Medium Slow)"' : ''}>Nv. ${m.level}</span>` : ''}</div>
      ${typeChips(sp.types)}
    </div>
  </div>`;
}

export function partyCard(m) {
  return `<article class="win mon" aria-label="${esc(m.nickname)}">
    ${monHeader(m)}
    <div class="hp" title="HP atual ainda não localizado no save">
      <span>HP</span><span class="meter"><i style="width:100%"></i></span><span>${m.stats.hp}</span>
      <span class="hp-note">HP máximo (o HP atual ainda não é lido)</span>
    </div>
    <div class="facts">${natureChip(m.nature)}${itemChip(m.item, true)}${abilityChip(m.ability)}${ballChip(m.ball)}</div>
    ${movesList(m.moves)}
    ${statsTable(m)}
  </article>`;
}

export function trainerWin(d, fileName) {
  const t = d.trainer;
  const pcTotal = d.pc.boxes.reduce((a, b) => a + b.slots.length, 0);
  return `<section class="win" aria-labelledby="trainer-h">
    <div class="win-title"><h2 id="trainer-h">Treinador</h2></div>
    <p class="trainer-name pixel">${esc(t.name || '—')}</p>
    <dl class="kv">
      <dt>ID</dt><dd>${pad5(t.tid)}</dd>
      <dt>SID</dt><dd>${pad5(t.sid)}</dd>
      <dt>Equipe</dt><dd>${d.party.length}/6</dd>
      <dt>PC</dt><dd>${pcTotal}</dd>
      <dt>Save nº</dt><dd>${t.saveIndex}</dd>
      <dt>Arquivo</dt><dd class="text">${esc(fileName)}</dd>
    </dl>
  </section>`;
}

export function exportWin() {
  return `<section class="win" aria-labelledby="export-h">
    <div class="win-title"><h2 id="export-h">Exportar</h2><small>equipe + PC</small></div>
    <div class="export-btns">
      <button class="btn" type="button" data-exp="csv">Planilha (CSV)</button>
      <button class="btn btn-ghost" type="button" data-exp="txt">Showdown (TXT)</button>
      <button class="btn btn-ghost" type="button" data-exp="json">JSON</button>
      <button class="btn btn-ghost" type="button" data-copy="party">Copiar equipe (Showdown)</button>
    </div>
    <p class="status" id="status" role="status"></p>
  </section>`;
}

export function warningsWin(warnings) {
  if (!warnings.length) return '';
  return `<section class="win warnings" aria-labelledby="warn-h">
    <div class="win-title"><h2 id="warn-h">Avisos</h2></div>
    <ul>${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
  </section>`;
}

export function partyWin(d) {
  return `<section aria-labelledby="party-h">
    <div class="win-title"><h2 id="party-h" class="pixel">Equipe</h2><small>${d.party.length} de 6</small></div>
    <div class="party">${d.party.map(partyCard).join('') || '<p class="hint">Nenhum Pokémon na equipe.</p>'}</div>
  </section>`;
}

export function pcWin(d) {
  const options = d.pc.boxes.map(b => `<option value="${b.index}">${esc(b.name)} · ${b.slots.length ? b.slots.length + '/30' : 'vazia'}${b.partial ? ' (parcial)' : ''}</option>`).join('');
  return `<section class="win" aria-labelledby="pc-h">
    <div class="win-title"><h2 id="pc-h">PC</h2><small id="pc-count"></small></div>
    <div class="box-nav">
      <button class="btn btn-ghost btn-icon" type="button" data-box-step="-1" aria-label="Caixa anterior">◀</button>
      <label class="sr" for="box-select">Caixa</label>
      <select id="box-select">${options}</select>
      <button class="btn btn-ghost btn-icon" type="button" data-box-step="1" aria-label="Próxima caixa">▶</button>
    </div>
    <div class="box-grid" id="box-grid" role="grid" aria-label="Pokémon na caixa"></div>
    <p class="box-meta">Toque num Pokémon para ver os detalhes. <span class="legend-q" aria-hidden="true"></span> = espécie com identificação provável.</p>
  </section>`;
}

export function boxGrid(box) {
  const bySlot = new Map(box.slots.map(s => [s.slot, s]));
  let cells = '';
  for (let i = 1; i <= 30; i++) {
    const s = bySlot.get(i);
    if (!s) { cells += `<div class="slot empty" role="gridcell" aria-label="Posição ${i}, vazia"></div>`; continue; }
    const sp = s.species;
    const label = `${s.hasNickname ? s.nickname + ' (' + sp.name + ')' : sp.name}${s.shiny ? ', shiny' : ''}, posição ${i}`;
    const next = sp.spriteId && sp.hasIcon ? spriteUrl(sp.spriteId) : '';
    cells += `<button class="slot" type="button" role="gridcell" data-slot="${i}" aria-label="${esc(label)}">
      <img${next ? ' class="ico"' : ''} data-sprite="1" data-next="${esc(next)}" src="${esc(iconSrc(sp))}" alt="" decoding="async" crossorigin="anonymous">
      ${sp.spriteId ? '' : `<span class="lbl">${esc(s.nickname)}</span>`}
      ${sp.confidence !== 'confirmado' ? '<span class="q" aria-hidden="true"></span>' : ''}
      ${s.shiny ? '<span class="star" aria-hidden="true">★</span>' : ''}
    </button>`;
  }
  return cells;
}

export function pcDetail(m) {
  const sp = m.species;
  return `<button class="btn btn-ghost btn-icon close" type="button" data-close aria-label="Fechar">✕</button>
  <div class="mon">
    ${monHeader(m, 'h2', ' id="detail-title"')}
    <p class="mon-sub">${esc(m.where)}, posição ${m.slot}</p>
    ${sp.evidence ? `<p class="evidence">${esc(sp.evidence)}</p>` : ''}
    <div class="facts">${natureChip(m.nature)}${itemChip(m.item, true)}${abilityChip(m.ability)}${ballChip(m.ball)}</div>
    ${movesList(m.moves)}
    ${ivEvTable(m)}
    <p class="unread-list">No PC, o nível é calculado pela experiência (${m.exp.toLocaleString('pt-BR')} exp). Amizade e treinador original não são guardados no registro do PC.</p>
    <div class="export-btns"><button class="btn btn-ghost" type="button" data-copy="mon">Copiar (Showdown)</button></div>
    <details><summary>Bytes do registro</summary><p class="raw">${esc(m.raw)}</p></details>
  </div>`;
}

export function notesWin() {
  return `<section class="win notes" aria-labelledby="notes-h">
    <details>
      <summary id="notes-h">O que ainda não dá para ler</summary>
      <ul>
        <li>HP atual da equipe (a barra mostra o HP máximo).</li>
        <li>Shiny e gênero na equipe; gênero no PC.</li>
        <li>No PC: stats (o jogo recalcula ao tirar da caixa), amizade e treinador original não são guardados.</li>
        <li>O nível no PC é calculado pela experiência (guardada dividida por 10) com a curva Medium Slow, que o Quetzal usa para todas as espécies.</li>
        <li>Itens com ID acima de 479 ainda não foram todos conferidos e aparecem como "provável"; a partir de 829 (megapedras novas) a numeração é própria do Quetzal e só os itens já conferidos têm nome.</li>
        <li>Espécies com ID acima de 905 (numeração própria do Quetzal) vêm de uma tabela manual; as ainda não conferidas no jogo aparecem como "provável".</li>
      </ul>
    </details>
  </section>`;
}
