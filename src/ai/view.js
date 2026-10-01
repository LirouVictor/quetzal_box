// Telas dos resultados da IA. Os Pokémon citados são desenhados com os dados do save (não com o texto da IA).

import { esc, typeChips, typeChip, monShort } from '../ui/render.js';
import { iconSrc } from '../ui/sprites.js';
import { analyzeTeam } from '../analysis.js';
import { REF_RE } from './prompt.js';

const where = m => (m.hasNickname ? m.species.name + ' · ' : '')
  + (m.location === 'party' ? `Equipe ${m.slot}` : `${m.where} · ${m.slot}`);

/** Escapa o texto e troca as referências (E1, C3-12) pelo nome do Pokémon. */
function rich(text, byRef) {
  return esc(text).replace(REF_RE, r => (byRef.has(r) ? `<b>${monShort(byRef.get(r))}</b>` : r));
}

function icon(m) {
  const sp = m.species;
  return `<img data-sprite="1" src="${esc(iconSrc(sp))}"${sp.hasIcon ? ' class="ico"' : ''} alt="" width="48" height="40" decoding="async" loading="lazy" crossorigin="anonymous">`;
}

function mini(m, ref) {
  return `<button class="ai-mon" type="button" data-ref="${esc(ref)}" aria-label="Ver ${esc(monShort(m))}">
    ${icon(m)}<span><b>${monShort(m)}</b><small>${esc(where(m))}</small></span>
  </button>`;
}

function list(title, items, byRef, cls = '') {
  if (!items.length) return '';
  return `<div class="ai-block ${cls}"><h3>${title}</h3><ul>${items.map(t => `<li>${rich(t, byRef)}</li>`).join('')}</ul></div>`;
}

function footer(model, dropped) {
  const lost = dropped.length
    ? `<p class="hint">A IA citou Pokémon que não existem no save (${esc(dropped.join(', '))}); essas partes foram ignoradas.</p>`
    : '';
  return `${lost}<p class="hint ai-foot">Gerado pelo ${esc(model)}. A IA pode errar: confira golpes e habilidades antes de seguir a sugestão.</p>`;
}

export function analysisView(r, byRef, model) {
  const trocas = r.trocas.map(t => `<li class="ai-swap">
      <div class="ai-pair">${mini(byRef.get(t.sai), t.sai)}<span class="ai-arrow" aria-label="troca por">▶</span>${mini(byRef.get(t.entra), t.entra)}</div>
      <p>${rich(t.motivo, byRef)}</p>
    </li>`).join('');
  const dicas = r.dicas.map(d => `<li class="ai-tip">${mini(byRef.get(d.ref), d.ref)}<p>${rich(d.texto, byRef)}</p></li>`).join('');
  return `<div class="ai-result">
    <div class="ai-score">
      <span class="ai-grade pixel" aria-label="Nota ${r.nota} de 10">${r.nota}<small>/10</small></span>
      <div class="meter" aria-hidden="true"><i style="width:${r.nota * 10}%"></i></div>
    </div>
    ${r.resumo ? `<p class="ai-summary">${rich(r.resumo, byRef)}</p>` : ''}
    <div class="ai-cols">
      ${list('Pontos fortes', r.pontos_fortes, byRef, 'good')}
      ${list('Pontos fracos', r.pontos_fracos, byRef, 'bad')}
    </div>
    ${list('Sinergia', r.sinergias, byRef)}
    ${trocas ? `<div class="ai-block"><h3>Trocas sugeridas</h3><ul class="ai-swaps">${trocas}</ul></div>` : ''}
    ${dicas ? `<div class="ai-block"><h3>Dicas por membro</h3><ul class="ai-tips">${dicas}</ul></div>` : ''}
    ${footer(model, r.dropped)}
  </div>`;
}

export function buildView(r, byRef, model, T) {
  const mons = r.membros.map(x => byRef.get(x.ref));
  const cards = r.membros.map((x, i) => {
    const m = mons[i];
    return `<li><button class="ai-card" type="button" data-ref="${esc(x.ref)}">
      <span class="ai-card-top">${icon(m)}<span><b>${monShort(m)}</b><small>${esc(where(m))}</small></span></span>
      ${typeChips(m.species.types)}
      ${x.papel ? `<span class="chip ai-role">${esc(x.papel)}</span>` : ''}
      <span class="ai-why">${rich(x.motivo, byRef)}</span>
    </button></li>`;
  }).join('');
  // Conferência do próprio app (só tipos), para não depender só do texto da IA
  const a = analyzeTeam(mons, { types: T.types, chart: T.typechart });
  const alerts = a.defense.filter(d => d.alert).map(d => d.type);
  const check = `<div class="ai-block"><h3>Conferência do app</h3>
    <p class="k-line">Tipos que acertam vários em cheio: ${alerts.map(typeChip).join(' ') || 'nenhum'}</p>
    <p class="k-line">Sem golpe super efetivo contra: ${a.gaps.map(typeChip).join(' ') || 'nenhum'}</p>
  </div>`;
  const short = r.membros.length < 6 ? `<p class="hint">A IA sugeriu só ${r.membros.length} Pokémon válidos.</p>` : '';
  return `<div class="ai-result">
    <h3 class="ai-team-name pixel">${esc(r.nome)}</h3>
    ${r.resumo ? `<p class="ai-summary">${rich(r.resumo, byRef)}</p>` : ''}
    <ul class="ai-team">${cards}</ul>
    ${short}
    <div class="export-btns"><button class="btn btn-ghost" type="button" data-ai-copy>Copiar equipe (Showdown)</button></div>
    <div class="ai-cols">
      ${list('Pontos fortes', r.pontos_fortes, byRef, 'good')}
      ${list('Pontos fracos', r.pontos_fracos, byRef, 'bad')}
    </div>
    ${check}
    ${list('Dicas', r.dicas, byRef)}
    ${footer(model, r.dropped)}
  </div>`;
}
