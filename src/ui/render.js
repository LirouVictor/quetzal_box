// Templates HTML da interface. Strings simples, sem framework.

import { spriteSrc, iconSrc, spriteUrl } from './sprites.js';
import { SHOWDOWN_ORDER, STAT_LABEL } from '../export.js';
import { analyzeTeam, defenseMatchups } from '../analysis.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad5 = n => String(n).padStart(5, '0');
const PROBABLE = 'provável';

export function typeChips(types) {
  if (!types.length) return '';
  return `<div class="types">${types.map(t => `<span class="type t-${esc(t)}">${esc(t)}</span>`).join('')}</div>`;
}

/** Ícone de gênero em pixel art (símbolos #male/#female no index.html). */
function genderIcon(g) {
  if (!g || !g.symbol) return '';
  const f = g.symbol === '♀';
  return ` <svg class="gender ${f ? 'f' : 'm'}" viewBox="0 0 12 12" width="12" height="12" role="img" aria-label="${esc(g.name)}" shape-rendering="crispEdges"><title>${esc(g.name)}</title><use href="#${f ? 'female' : 'male'}"/></svg>`;
}

function badge(conf) {
  if (conf === PROBABLE) return ' <span class="badge" title="Identificação provável, ainda não confirmada">provável</span>';
  if (conf === 'desconhecido') return ' <span class="badge" title="ID ainda não mapeado">?</span>';
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

const CATEGORY = ['Físico', 'Especial', 'Status'];

function movesList(moves) {
  if (!moves.length) return '<p class="hint">Sem golpes.</p>';
  return `<ul class="moves">${moves.map(mv => {
    const power = mv.power ? mv.power : '—';
    const acc = mv.accuracy ? mv.accuracy + '%' : '—';
    const cat = mv.category !== null && mv.category !== undefined ? CATEGORY[mv.category] : '—';
    return `<li><details class="move t-${esc(mv.type || 'none')}">
      <summary><span>${esc(mv.name)}</span><span class="pp">${mv.pp} PP</span>
        <span class="mt">${esc(mv.type || '—')} · ${esc(cat)}</span></summary>
      <div class="move-info">
        <span><span class="k">Poder</span> ${power}</span><span><span class="k">Precisão</span> ${acc}</span>
        <p class="move-desc" data-move="${mv.id}"></p>
      </div>
    </details></li>`;
  }).join('')}</ul>`;
}

/** Tabela de stats com colunas fixas: rótulo, [valor], barra, IV, EV. */
function statRows(m, { withStats }) {
  const max = withStats ? Math.max(...SHOWDOWN_ORDER.map(k => m.stats[k]), 1) : 31;
  const nat = m.nature;
  const rows = SHOWDOWN_ORDER.map(k => {
    const cls = nat && nat.plus === k ? 'plus' : nat && nat.minus === k ? 'minus' : '';
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
  const caption = !withStats ? 'Barras = IV (0–31). Stats não calculados (espécie sem stats base conhecidos).'
    : m.statsCalculated ? 'Stats calculados (o PC não guarda stats): stats base oficiais + nível, IVs, EVs e natureza. Barras relativas ao maior stat.'
    : 'Barras relativas ao maior stat deste Pokémon.';
  return `<table class="stats"><caption>${caption}</caption>${head}<tbody>${rows}</tbody></table>`;
}

const ivEvTable = m => statRows(m, { withStats: false });
const statsTable = m => statRows(m, { withStats: true });

function ballChip(b) {
  if (!b) return '<span class="chip unread"><span class="k">Bola</span> não lida</span>';
  return `<span class="chip"><span class="k">Bola</span><b>${esc(b.name)}</b>${badge(b.confidence)}</span>`;
}

function natureChip(n, pidNature = null) {
  if (!n) return '<span class="chip unread"><span class="k">Natureza</span> não lida</span>';
  const eff = n.plus ? `+${STAT_LABEL[n.plus]} −${STAT_LABEL[n.minus]}` : 'neutra';
  const title = pidNature ? ` title="Natureza tirada dos stats salvos (o PID indica ${esc(pidNature.name)})."` : '';
  return `<span class="chip"${title}><span class="k">Natureza</span><b>${esc(n.name)}</b> <span class="k">${eff}</span></span>`;
}

function hiddenPowerChip(t) {
  if (!t) return '';
  return `<span class="chip"><span class="k">Hidden Power</span><span class="type t-${esc(t)}">${esc(t)}</span></span>`;
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
    `#${m.dexNo ?? m.speciesId}`,
  ].filter(Boolean).join(' · ');
  return `<div class="mon-head">
    ${portrait(m)}
    <div>
      <${headingTag} class="mon-name"${idAttr}>${title}${genderIcon(m.gender)}${m.shiny ? ' <span class="shiny" title="Shiny">★<span class="sr"> shiny</span></span>' : ''}${badge(sp.confidence)}</${headingTag}>
      <div class="mon-sub">${sub}${m.level ? ` · <span class="lv"${m.levelFromExp ? ' title="Calculado pela experiência (curva Medium Slow)"' : ''}>Nv. ${m.level}</span>` : ''}</div>
      ${typeChips(sp.types)}
    </div>
  </div>`;
}

export function trainerWin(d, fileName) {
  const t = d.trainer;
  const pcTotal = d.pc.boxes.reduce((a, b) => a + b.slots.length, 0);
  const kv = (k, v, cls = '') => `<div><dt>${k}</dt><dd${cls ? ` class="${cls}"` : ''}>${v}</dd></div>`;
  const game = d.game ? d.game.name : '';
  return `<section class="win trainer" aria-labelledby="trainer-h">
    <div class="win-title"><h2 id="trainer-h">Treinador</h2><small class="file" title="${esc(fileName)}">${esc(fileName)}</small></div>
    ${game ? `<p class="game-chip"><span class="k">Jogo</span> <b>${esc(game)}</b></p>` : ''}
    <div class="trainer-row">
      <p class="trainer-name pixel">${esc(t.name || '—')}</p>
      <dl class="kv">
        ${kv('ID', pad5(t.tid))}${kv('SID', pad5(t.sid))}${kv('Equipe', `${d.party.length}/6`)}${kv('PC', pcTotal)}${kv('Save nº', t.saveIndex)}
      </dl>
    </div>
  </section>`;
}

/** Exportar: no fim da página, compacto. */
export function exportWin() {
  return `<section class="win export" aria-labelledby="export-h">
    <div class="win-title"><h2 id="export-h">Exportar</h2><small>equipe + PC</small></div>
    <div class="export-btns">
      <button class="btn btn-small" type="button" data-exp="csv">Planilha (CSV)</button>
      <button class="btn btn-ghost btn-small" type="button" data-exp="txt">Showdown (TXT)</button>
      <button class="btn btn-ghost btn-small" type="button" data-exp="json">JSON</button>
      <button class="btn btn-ghost btn-small" type="button" data-copy="party">Copiar equipe (Showdown)</button>
    </div>
    <p class="status" id="status" role="status"></p>
  </section>`;
}

/** Bloco de Pokémon com sprite grande (equipe e equipes da IA). */
export function monTile(m, attrs = '') {
  const sp = m.species;
  const t = sp.types[0] ? ` t-${esc(sp.types[0])}` : '';
  const label = `${m.hasNickname ? m.nickname + ' (' + sp.name + ')' : sp.name}${m.shiny ? ', shiny' : ''}${m.level ? ', nível ' + m.level : ''}`;
  const next = m.shiny && sp.spriteId ? ` data-next="${esc(spriteSrc(sp))}"` : '';
  return `<button class="ptile${t}" type="button" ${attrs} aria-label="${esc(label)}">
    <img data-sprite="1"${next} src="${esc(spriteSrc(sp, m.shiny))}" width="96" height="96" alt="" decoding="async" loading="lazy" crossorigin="anonymous">
    <span class="ptile-marks">${m.shiny ? '<span class="shiny" aria-hidden="true">★</span>' : ''}${genderIcon(m.gender)}</span>
    <span class="ptile-name">${monShort(m)}</span>
    ${m.level ? `<span class="ptile-lv">Nv. ${m.level}</span>` : ''}
  </button>`;
}

export function warningsWin(warnings) {
  if (!warnings.length) return '';
  return `<section class="win warnings" aria-labelledby="warn-h">
    <div class="win-title"><h2 id="warn-h">Avisos</h2></div>
    <ul>${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
  </section>`;
}

export function partyWin(d) {
  const tiles = d.party.map((m, i) => `<li>${monTile(m, `data-party="${i}"`)}</li>`).join('');
  const empty = Array.from({ length: Math.max(0, 6 - d.party.length) }, () => '<li class="ptile-empty" aria-hidden="true"></li>').join('');
  return `<section class="win" aria-labelledby="party-h">
    <div class="win-title"><h2 id="party-h">Equipe</h2><small>${d.party.length} de 6 · toque para ver detalhes</small></div>
    ${d.party.length ? `<ul class="party-grid">${tiles}${empty}</ul>` : '<p class="hint">Nenhum Pokémon na equipe.</p>'}
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

/** Fraquezas e resistências deste Pokémon (só pelos tipos). */
function matchupTable(m, T) {
  const g = defenseMatchups(m.species.types, { types: T.types, chart: T.typechart });
  const rows = [['4×', 4, 'weak'], ['2×', 2, 'weak'], ['½', 0.5, 'resist'], ['¼', 0.25, 'resist'], ['0', 0, 'immune']]
    .filter(([, k]) => g[k].length)
    .map(([label, k, cls]) => `<div class="mu-row"><span class="mu-x ${cls}">${label}</span><span class="mu-types">${g[k].map(typeChip).join(' ')}</span></div>`)
    .join('');
  if (!rows) return '';
  return `<section class="dsec"><h3>Dano recebido</h3>${rows}<p class="hint">Só pelos tipos; não considera habilidade (Levitate etc.) nem item.</p></section>`;
}

export function monDetail(m, T) {
  const sp = m.species;
  const where = m.location === 'party' ? `Equipe, posição ${m.slot}` : `${m.where}, posição ${m.slot}`;
  const note = m.location !== 'pc' ? ''
    : m.complete
      ? `<p class="unread-list">No PC, o nível vem da experiência (${m.exp.toLocaleString('pt-BR')} exp) e os stats são calculados.</p>`
      : `<p class="unread-list">No PC, o nível vem da experiência (${m.exp.toLocaleString('pt-BR')} exp) e os stats são calculados. Amizade e treinador original não são guardados no registro do PC.</p>`;
  return `<button class="btn btn-ghost btn-icon close" type="button" data-close aria-label="Fechar">✕</button>
  <div class="mon">
    ${monHeader(m, 'h2', ' id="detail-title"')}
    <p class="mon-sub">${esc(where)}</p>
    ${sp.evidence ? `<p class="evidence">${esc(sp.evidence)}</p>` : ''}
    <div class="facts">${natureChip(m.nature, m.pidNature)}${itemChip(m.item, true)}${abilityChip(m.ability)}${ballChip(m.ball)}${hiddenPowerChip(m.hiddenPower)}</div>
    ${movesList(m.moves)}
    ${m.stats ? statsTable(m) : ivEvTable(m)}
    ${note}
    ${T ? matchupTable(m, T) : ''}
    <div class="dex-slot" data-dex></div>
    <div class="export-btns"><button class="btn btn-ghost" type="button" data-copy="mon">Copiar (Showdown)</button></div>
    <details><summary>Bytes do registro</summary><p class="raw">${esc(m.raw)}</p></details>
  </div>`;
}

export const typeChip = t => `<span class="type t-${esc(t)}">${esc(t)}</span>`;
export const monShort = m => esc(m.hasNickname ? m.nickname : m.species.name);

/** Fraquezas/resistências por tipo de ataque e cobertura dos golpes da equipe. */
export function analysisWin(d, T) {
  if (!d.party.length) return '';
  const a = analyzeTeam(d.party, { types: T.types, chart: T.typechart });
  const rows = a.defense.map(r => {
    const names = list => list.map(monShort).join(', ');
    const cell = (list, cls, label) => list.length
      ? `<button type="button" class="cnt ${cls}" data-info="${esc(label)} a ${esc(r.type)}: ${names(list)}" aria-label="${list.length} ${esc(label.toLowerCase())}">${list.length}</button>`
      : '<span class="cnt zero">·</span>';
    return `<tr class="${r.alert ? 'alert' : ''}">
      <th scope="row">${typeChip(r.type)}</th>
      <td>${cell(r.weak, 'weak', 'Fracos')}</td><td>${cell(r.resist, 'resist', 'Resistem')}</td><td>${cell(r.immune, 'immune', 'Imunes')}</td>
    </tr>`;
  }).join('');
  return `<section class="win" aria-labelledby="analysis-h">
    <div class="win-title"><h2 id="analysis-h">Análise da equipe</h2><small>tipos</small></div>
    <details class="analysis">
      <summary>Fraquezas e resistências</summary>
      <table class="typetab">
        <thead><tr><th scope="col">Ataque</th><th scope="col">Fracos</th><th scope="col">Resistem</th><th scope="col">Imunes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="type-info" id="type-info" role="status">Toque num número para ver quem.</p>
      <p class="hint">Linhas destacadas: tipos que acertam muitos membros em cheio. Não considera habilidades (Levitate etc.) nem itens.</p>
    </details>
    <details class="analysis">
      <summary>Cobertura dos golpes</summary>
      <p class="k-line">Golpes de dano da equipe: ${a.moveTypes.map(typeChip).join(' ') || '—'}</p>
      <p class="k-line">Super efetivo contra: ${a.coverage.map(typeChip).join(' ') || '—'}</p>
      <p class="k-line">Nenhum golpe super efetivo contra: ${a.gaps.map(typeChip).join(' ') || '—'}</p>
    </details>
  </section>`;
}

/**
 * Assistente com IA: a chave é do usuário e fica só neste aparelho.
 * Os textos que dependem do serviço (link da chave, aviso de privacidade…) são preenchidos em app.js.
 */
export function aiWin(d, providers) {
  const noParty = !d.party.length;
  const opts = providers.map(p => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
  return `<section class="win" aria-labelledby="ai-h">
    <div class="win-title"><h2 id="ai-h">Assistente</h2><small id="ai-svc">IA</small></div>
    <p class="ai-intro">A IA avalia sua equipe e monta uma equipe com os Pokémon que você tem.</p>
    <div class="ai-form ai-provider">
      <label class="ai-label" for="ai-provider">Serviço de IA</label>
      <select id="ai-provider" class="ai-input">${opts}</select>
    </div>
    <div id="ai-setup" class="hidden">
      <p class="ai-intro">Para usar, crie uma chave grátis:</p>
      <ol class="ai-steps">
        <li>Abra <a id="ai-key-link" href="#" target="_blank" rel="noopener"></a> e <span id="ai-key-steps"></span>.</li>
        <li>Copie a chave e cole abaixo.</li>
      </ol>
      <div class="ai-form">
        <label class="sr" for="ai-key">Chave</label>
        <input id="ai-key" type="password" autocomplete="off" spellcheck="false">
        <button class="btn" type="button" id="ai-save">Salvar chave</button>
      </div>
      <p class="hint">A chave fica guardada só neste aparelho.</p>
    </div>
    <div id="ai-main" class="hidden">
      <label class="ai-label" for="ai-note">Pedido (opcional)</label>
      <input id="ai-note" class="ai-input" type="text" maxlength="300" autocomplete="off" placeholder="Ex.: quero usar o Lucario; sem lendários">
      <div class="export-btns ai-actions">
        <button class="btn" type="button" data-ai="analyze"${noParty ? ' disabled' : ''}>Analisar minha equipe</button>
        <button class="btn" type="button" data-ai="build">Montar equipe</button>
      </div>
      <p class="hint" id="ai-privacy"></p>
      <details class="ai-settings">
        <summary>Configurações da IA</summary>
        <div class="ai-form">
          <label class="ai-label" for="ai-model">Modelo</label>
          <input id="ai-model" class="ai-input" type="text" autocomplete="off" spellcheck="false" list="ai-models" placeholder="automático">
          <button class="btn btn-ghost btn-small" type="button" id="ai-model-save">Salvar modelo</button>
          <datalist id="ai-models"></datalist>
        </div>
        <label class="ai-skip"><input type="checkbox" id="ai-ask" checked> Mostrar o que vai ser enviado antes de enviar</label>
        <button class="btn btn-ghost btn-small" type="button" id="ai-list">Ver modelos da chave</button>
        <p class="hint" id="ai-models-out" role="status"></p>
        <button class="btn btn-ghost btn-small" type="button" id="ai-forget">Apagar chave deste aparelho</button>
      </details>
    </div>
    <div id="ai-out" class="ai-out" aria-live="polite"></div>
  </section>`;
}

/** Busca na equipe e em todas as caixas do PC. */
export function searchWin(d, T) {
  const typeOpts = T.types.filter(t => t && t !== 'stellar').map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  return `<section class="win" aria-labelledby="search-h">
    <div class="win-title"><h2 id="search-h">Buscar</h2><small>equipe + PC</small></div>
    <div class="search-form">
      <label class="sr" for="q">Buscar</label>
      <input id="q" type="search" placeholder="Nome, espécie, golpe, habilidade ou item" autocomplete="off" enterkeyhint="search">
      <div class="search-row">
        <label class="sr" for="f-type">Tipo</label>
        <select id="f-type"><option value="">Todos os tipos</option>${typeOpts}</select>
        <label class="sr" for="f-sort">Ordem</label>
        <select id="f-sort">
          <option value="pos">Posição</option>
          <option value="level">Nível (maior)</option>
          <option value="name">Nome</option>
          <option value="dex">Nº da espécie</option>
        </select>
      </div>
      <div class="flags" role="group" aria-label="Filtros">
        <button class="btn btn-ghost btn-small flag" type="button" data-flag="shiny" aria-pressed="false">★ Shiny</button>
        <button class="btn btn-ghost btn-small flag" type="button" data-flag="hidden" aria-pressed="false">Hab. oculta</button>
        <button class="btn btn-ghost btn-small flag" type="button" data-flag="female" aria-pressed="false"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" shape-rendering="crispEdges"><use href="#female"/></svg> Fêmeas</button>
        <button class="btn btn-ghost btn-small flag" type="button" data-flag="male" aria-pressed="false"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" shape-rendering="crispEdges"><use href="#male"/></svg> Machos</button>
        <button class="btn btn-ghost btn-small flag" type="button" data-flag="iv31" aria-pressed="false">6 IVs 31</button>
      </div>
    </div>
    <p class="hint" id="search-count" role="status"></p>
    <ul class="results" id="results"></ul>
    <button class="btn btn-ghost hidden" type="button" id="more">Mostrar mais</button>
  </section>`;
}

export function resultRow(m, i) {
  const sp = m.species;
  const where = m.location === 'party' ? `Equipe ${m.slot}` : `${esc(m.where)} · ${m.slot}`;
  const g = genderIcon(m.gender);
  return `<li><button class="result" type="button" data-i="${i}">
    <img data-sprite="1" src="${esc(iconSrc(sp))}"${sp.hasIcon ? ' class="ico"' : ''} alt="" decoding="async" loading="lazy" crossorigin="anonymous">
    <span class="r-main"><b>${monShort(m)}</b>${g}${m.shiny ? ' <span class="shiny">★</span>' : ''}
      <span class="r-sub">${m.hasNickname ? esc(sp.name) + ' · ' : ''}${where}</span></span>
    <span class="r-lv">Nv. ${m.level ?? '?'}</span>
  </button></li>`;
}
