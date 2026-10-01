// Templates HTML da interface. Strings simples, sem framework.

import { spriteSrc, iconSrc, spriteUrl } from './sprites.js';
import { SHOWDOWN_ORDER, STAT_LABEL } from '../export.js';
import { analyzeTeam } from '../analysis.js';

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
  const title = pidNature ? ` title="Natureza trocada no jogo (o PID indica ${esc(pidNature.name)})."` : '';
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
    `#${m.speciesId}`,
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

export function partyCard(m) {
  return `<article class="win mon" aria-label="${esc(m.nickname)}">
    ${monHeader(m)}
    <div class="hp" title="HP atual ainda não localizado no save">
      <span>HP</span><span class="meter"><i style="width:100%"></i></span><span>${m.stats.hp}</span>
      <span class="hp-note">HP máximo (o HP atual ainda não é lido)</span>
    </div>
    <div class="facts">${natureChip(m.nature, m.pidNature)}${itemChip(m.item, true)}${abilityChip(m.ability)}${ballChip(m.ball)}${hiddenPowerChip(m.hiddenPower)}</div>
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

export function monDetail(m) {
  const sp = m.species;
  const where = m.location === 'party' ? `Equipe, posição ${m.slot}` : `${m.where}, posição ${m.slot}`;
  const note = m.location === 'pc'
    ? `<p class="unread-list">No PC, o nível vem da experiência (${m.exp.toLocaleString('pt-BR')} exp) e os stats são calculados. Amizade e treinador original não são guardados no registro do PC.</p>`
    : '';
  return `<button class="btn btn-ghost btn-icon close" type="button" data-close aria-label="Fechar">✕</button>
  <div class="mon">
    ${monHeader(m, 'h2', ' id="detail-title"')}
    <p class="mon-sub">${esc(where)}</p>
    ${sp.evidence ? `<p class="evidence">${esc(sp.evidence)}</p>` : ''}
    <div class="facts">${natureChip(m.nature, m.pidNature)}${itemChip(m.item, true)}${abilityChip(m.ability)}${ballChip(m.ball)}${hiddenPowerChip(m.hiddenPower)}</div>
    ${movesList(m.moves)}
    ${m.stats ? statsTable(m) : ivEvTable(m)}
    ${note}
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

/** Assistente com IA (Gemini): a chave é do usuário e fica só neste aparelho. */
export function aiWin(d, { hasKey, model }) {
  const noParty = !d.party.length;
  return `<section class="win" aria-labelledby="ai-h">
    <div class="win-title"><h2 id="ai-h">Assistente</h2><small>IA · Gemini</small></div>
    <div id="ai-setup"${hasKey ? ' class="hidden"' : ''}>
      <p class="ai-intro">A IA avalia sua equipe e monta uma equipe com os Pokémon que você tem. Para usar, crie uma chave grátis do Gemini (precisa de uma conta Google):</p>
      <ol class="ai-steps">
        <li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> e toque em <b>Create API key</b>.</li>
        <li>Copie a chave e cole abaixo.</li>
      </ol>
      <div class="ai-form">
        <label class="sr" for="ai-key">Chave do Gemini</label>
        <input id="ai-key" type="password" autocomplete="off" spellcheck="false" placeholder="Chave do Gemini (AIza…)">
        <button class="btn" type="button" id="ai-save">Salvar chave</button>
      </div>
      <p class="hint">A chave fica guardada só neste aparelho.</p>
    </div>
    <div id="ai-main"${hasKey ? '' : ' class="hidden"'}>
      <label class="ai-label" for="ai-note">Pedido (opcional)</label>
      <input id="ai-note" class="ai-input" type="text" maxlength="300" autocomplete="off" placeholder="Ex.: quero usar o Lucario; sem lendários">
      <div class="export-btns ai-actions">
        <button class="btn" type="button" data-ai="analyze"${noParty ? ' disabled' : ''}>Analisar minha equipe</button>
        <button class="btn" type="button" data-ai="build">Montar equipe</button>
      </div>
      <p class="hint">Ao tocar, a lista dos seus Pokémon (espécie, tipos, golpes, habilidade, item, natureza e IVs) é enviada ao Gemini, do Google. O arquivo .sav não é enviado. No plano grátis, o Google pode usar o que recebe para melhorar os produtos dele.</p>
      <details class="ai-settings">
        <summary>Configurações da IA</summary>
        <div class="ai-form">
          <label class="ai-label" for="ai-model">Modelo</label>
          <input id="ai-model" class="ai-input" type="text" autocomplete="off" spellcheck="false" list="ai-models" value="${esc(model)}">
          <button class="btn btn-ghost btn-small" type="button" id="ai-model-save">Salvar modelo</button>
          <datalist id="ai-models"></datalist>
        </div>
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

export function notesWin() {
  return `<section class="win notes" aria-labelledby="notes-h">
    <details>
      <summary id="notes-h">O que ainda não dá para ler</summary>
      <ul>
        <li>HP atual da equipe (a barra mostra o HP máximo).</li>
        <li>Shiny e gênero na equipe.</li>
        <li>No PC: amizade e treinador original não são guardados. Os stats são calculados (stats base oficiais + nível, IVs, EVs e natureza); a fórmula foi conferida contra a equipe.</li>
        <li>Poder, precisão e descrição dos golpes vêm do pokeemerald-expansion (geração mais nova); o Quetzal pode ter mudado algum golpe.</li>
        <li>O nível no PC é calculado pela experiência (guardada dividida por 10) com a curva Medium Slow, que o Quetzal usa para todas as espécies.</li>
        <li>Itens com ID acima de 479 ainda não foram todos conferidos e aparecem como "provável"; a partir de 829 (megapedras novas) a numeração é própria do Quetzal e só os itens já conferidos têm nome.</li>
        <li>Espécies com ID acima de 905 (numeração própria do Quetzal) vêm de uma tabela manual; as ainda não conferidas no jogo aparecem como "provável".</li>
      </ul>
    </details>
  </section>`;
}
