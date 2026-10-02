// Telas dos resultados da IA. Os Pokémon citados são desenhados com os dados do save (não com o texto da IA).

import { esc, typeChips, typeChip, monShort } from '../ui/render.js';
import { spriteSrc } from '../ui/sprites.js';
import { analyzeTeam } from '../analysis.js';
import { REF_RE } from './prompt.js';

const where = m => (m.hasNickname ? m.species.name + ' · ' : '')
  + (m.location === 'party' ? `Equipe ${m.slot}` : `${m.where} · ${m.slot}`);

const VERDICT = n => (n >= 10 ? 'Excelente' : n >= 8 ? 'Muito boa' : n >= 6 ? 'Boa' : n >= 4 ? 'Mediana' : 'Fraca');

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Escapa o texto e troca as referências (E1, C3-12) pelo nome do Pokémon, em negrito.
 * A IA às vezes escreve o nome junto da referência ("Corviknight (C1-2)", "C1-2 (Corviknight)",
 * "C1-2 Corviknight"): o nome repetido é absorvido para não aparecer duas vezes.
 */
export function rich(text, byRef) {
  const src = String(text ?? '');
  let out = '', last = 0;
  for (const match of src.matchAll(REF_RE)) {
    const m = byRef.get(match[0]);
    if (!m) continue;
    const names = [...new Set([m.nickname, m.species.name].filter(Boolean))].map(reEsc).join('|');
    let before = src.slice(last, match.index);
    let end = match.index + match[0].length;
    // Nome antes: "Nome (REF" / "Nome REF" / "Nome [REF"
    const left = before.match(new RegExp(`(?:^|[^\\p{L}\\p{N}])((?:${names})\\s*([(\\[]?)\\s*)$`, 'iu'));
    let opened = '';
    if (left) { before = before.slice(0, before.length - left[1].length); opened = left[2]; }
    else {
      const br = before.match(/([(\[])\s*$/);
      if (br) { before = before.slice(0, before.length - br[0].length); opened = br[1]; }
    }
    const rest = src.slice(end);
    let after;
    if (opened) after = rest.match(new RegExp(`^(?:\\s*[,/-]?\\s*(?:${names}))?\\s*[)\\]]`, 'iu'));
    else if (!left) after = rest.match(new RegExp(`^\\s*[(\\[]\\s*(?:${names})\\s*[)\\]]|^\\s+(?:${names})(?![\\p{L}\\p{N}])`, 'iu'));
    if (opened && !after) before += opened; // parêntese sem par: devolve
    if (after) end += after[0].length;
    out += esc(before) + `<b>${monShort(m)}</b>`;
    last = end;
  }
  return out + esc(src.slice(last));
}

function sprite(m, size) {
  const sp = m.species;
  const next = m.shiny && sp.spriteId ? ` data-next="${esc(spriteSrc(sp))}"` : '';
  return `<img data-sprite="1"${next} src="${esc(spriteSrc(sp, m.shiny))}" width="${size}" height="${size}" alt="" decoding="async" loading="lazy" crossorigin="anonymous">`;
}

const typeClass = m => (m.species.types[0] ? ` t-${esc(m.species.types[0])}` : '');

/** Pokémon pequeno e clicável (trocas e dicas). */
function mini(m, ref, tag = '') {
  return `<button class="ai-mon${typeClass(m)}" type="button" data-ref="${esc(ref)}" aria-label="Ver ${esc(monShort(m))}">
    <span class="ai-mon-art">${sprite(m, 56)}</span>
    <span class="ai-mon-text">${tag ? `<span class="ai-tag ${tag === 'Sai' ? 'out' : 'in'}">${tag}</span>` : ''}<b>${monShort(m)}</b><small>${esc(where(m))}</small></span>
  </button>`;
}

function panel(title, kind, inner) {
  if (!inner) return '';
  return `<section class="ai-panel ${kind}"><h3><span class="ai-ico" aria-hidden="true"></span>${title}</h3>${inner}</section>`;
}

const bullets = (items, byRef) => (items.length ? `<ul class="ai-list">${items.map(t => `<li>${rich(t, byRef)}</li>`).join('')}</ul>` : '');

function footer(model, dropped) {
  const lost = dropped.length
    ? `<p class="hint">A IA citou Pokémon que não existem no save (${esc(dropped.join(', '))}); essas partes foram ignoradas.</p>`
    : '';
  return `${lost}<p class="hint ai-foot">Gerado pelo ${esc(model)}. A IA pode errar: confira golpes e habilidades antes de seguir a sugestão.</p>`;
}

export function analysisView(r, byRef, model) {
  const pips = Array.from({ length: 10 }, (_, i) => `<i class="${i < r.nota ? 'on' : ''}"></i>`).join('');
  const trocas = r.trocas.map(t => `<li class="ai-swap">
      <div class="ai-pair">${mini(byRef.get(t.sai), t.sai, 'Sai')}<span class="ai-arrow" aria-label="troca por"></span>${mini(byRef.get(t.entra), t.entra, 'Entra')}</div>
      <p>${rich(t.motivo, byRef)}</p>
    </li>`).join('');
  const dicas = r.dicas.map(d => `<li class="ai-tip">${mini(byRef.get(d.ref), d.ref)}<p>${rich(d.texto, byRef)}</p></li>`).join('');
  return `<div class="ai-result">
    <div class="ai-hero">
      <div class="ai-medal" role="img" aria-label="Nota ${r.nota} de 10"><b>${r.nota}</b><small>/10</small></div>
      <div class="ai-hero-text">
        <p class="ai-kicker">Avaliação da equipe</p>
        <p class="ai-verdict">${VERDICT(r.nota)}</p>
        <div class="ai-pips" aria-hidden="true">${pips}</div>
      </div>
    </div>
    ${r.resumo ? `<p class="ai-summary">${rich(r.resumo, byRef)}</p>` : ''}
    <div class="ai-cols">
      ${panel('Pontos fortes', 'good', bullets(r.pontos_fortes, byRef))}
      ${panel('Pontos fracos', 'bad', bullets(r.pontos_fracos, byRef))}
    </div>
    ${panel('Sinergia', 'info', bullets(r.sinergias, byRef))}
    ${panel('Trocas sugeridas', 'swap', trocas && `<ul class="ai-swaps">${trocas}</ul>`)}
    ${panel('Dicas por membro', 'info', dicas && `<ul class="ai-tips">${dicas}</ul>`)}
    ${footer(model, r.dropped)}
  </div>`;
}

export function buildView(r, byRef, model, T) {
  const mons = r.membros.map(x => byRef.get(x.ref));
  const cards = r.membros.map((x, i) => {
    const m = mons[i];
    return `<li><button class="ai-member${typeClass(m)}" type="button" data-ref="${esc(x.ref)}" aria-label="Ver ${esc(monShort(m))}">
      <span class="ai-member-art">${sprite(m, 80)}<span class="ai-num">${i + 1}</span></span>
      <span class="ai-member-body">
        ${x.papel ? `<span class="ai-role">${esc(x.papel)}</span>` : ''}
        <b class="ai-member-name">${monShort(m)}</b>
        <small>${esc(where(m))}</small>
        ${typeChips(m.species.types)}
        <span class="ai-why">${rich(x.motivo, byRef)}</span>
      </span>
    </button></li>`;
  }).join('');
  // Conferência do próprio app (só tipos), para não depender só do texto da IA
  const a = analyzeTeam(mons, { types: T.types, chart: T.typechart });
  const alerts = a.defense.filter(d => d.alert).map(d => d.type);
  const check = `<p class="k-line">Tipos que acertam vários em cheio: ${alerts.map(typeChip).join(' ') || 'nenhum'}</p>
    <p class="k-line">Sem golpe super efetivo contra: ${a.gaps.map(typeChip).join(' ') || 'nenhum'}</p>`;
  const short = r.membros.length < 6 ? `<p class="hint">A IA sugeriu só ${r.membros.length} Pokémon válidos.</p>` : '';
  const dicas = r.dicas.length ? `<ol class="ai-steps-list">${r.dicas.map(t => `<li>${rich(t, byRef)}</li>`).join('')}</ol>` : '';
  return `<div class="ai-result">
    <div class="ai-hero build">
      <div class="ai-hero-text">
        <p class="ai-kicker">Equipe sugerida</p>
        <p class="ai-team-name">${esc(r.nome)}</p>
      </div>
      <button class="btn btn-ghost btn-small" type="button" data-ai-copy>Copiar (Showdown)</button>
    </div>
    ${r.resumo ? `<p class="ai-summary">${rich(r.resumo, byRef)}</p>` : ''}
    <ul class="ai-members">${cards}</ul>
    ${short}
    <div class="ai-cols">
      ${panel('Pontos fortes', 'good', bullets(r.pontos_fortes, byRef))}
      ${panel('Pontos fracos', 'bad', bullets(r.pontos_fracos, byRef))}
    </div>
    ${panel('Conferência do app (tipos)', 'info', check)}
    ${panel('Próximos passos', 'swap', dicas)}
    ${footer(model, r.dropped)}
  </div>`;
}
