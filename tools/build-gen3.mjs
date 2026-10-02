#!/usr/bin/env node
// Gera src/data/gen3.json: tabelas dos jogos oficiais da Gen 3 (Ruby/Sapphire/Emerald/FireRed/LeafGreen).
//
// Fontes:
//   - pret/pokeemerald (decomp): espécies na numeração interna da Gen 3 (com a Dex Nacional de cada uma),
//     tipos, stats base, habilidades, taxa de gênero e curva de nível como eram na Gen 3; golpes 1–354
//     com poder/precisão/PP/tipo da Gen 3; numeração dos itens e das habilidades.
//   - PokeAPI (CSV): nomes em inglês de itens e habilidades; tabela de tipos (com as diferenças antigas:
//     Ghost e Dark não eram super efetivos contra Steel; não existia Fairy).
//
// Uso: npm run gen3   (precisa de rede; o resultado é versionado no git)

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/gen3.json');
const EM = 'https://raw.githubusercontent.com/pret/pokeemerald/master';
const PAPI = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const ENGLISH = 9;
const GEN = 3;

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.text();
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise(res => setTimeout(res, 1000 * 2 ** attempt));
    }
  }
}

function csv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return rows.map(line => {
    const cells = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? '']));
  });
}

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** `#define NOME valor` (valores numéricos ou NOME + n). */
function defines(src, prefix) {
  const map = new Map();
  for (const m of stripComments(src).matchAll(new RegExp(`#define\\s+(${prefix}\\w+)\\s+\\(?([^\\n]+?)\\)?\\s*$`, 'gm'))) {
    const expr = m[2].trim();
    let v = Number(expr);
    if (Number.isNaN(v)) {
      const mm = expr.match(/^(\w+)\s*\+\s*(\d+)$/);
      if (mm && map.has(mm[1])) v = map.get(mm[1]) + Number(mm[2]);
      else if (map.has(expr)) v = map.get(expr);
      else continue;
    }
    map.set(m[1], v);
  }
  return map;
}

/** Primeiro `enum { … }` que contém nomes com o prefixo, avaliado em sequência. */
function enumValues(src, prefix) {
  const body = stripComments(src).match(new RegExp(`enum\\s*\\{([^}]*${prefix}[^}]*)\\}`))[1];
  const map = new Map();
  let next = 0;
  for (const part of body.split(',')) {
    const t = part.trim();
    if (!t) continue;
    const [name, expr] = t.split('=').map(x => x.trim());
    if (expr !== undefined) next = /^\d+$/.test(expr) || /^0x/i.test(expr) ? Number(expr) : map.get(expr);
    map.set(name, next++);
  }
  return map;
}

/** Blocos `[CHAVE] = { … }` de um array de structs em C. */
function blocks(src) {
  const out = new Map();
  const re = /(?<![\w\]])\[(\w+)\]\s*=\s*\{/g; // não pega a declaração do array (gBattleMoves[MOVES_COUNT] = {)
  let m;
  const text = stripComments(src);
  while ((m = re.exec(text))) {
    let depth = 1, i = re.lastIndex;
    while (depth && i < text.length) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
    out.set(m[1], text.slice(re.lastIndex, i - 1));
    re.lastIndex = i;
  }
  return out;
}
const field = (body, name) => { const m = body.match(new RegExp(`\\.${name}\\s*=\\s*([^,\\n]+(?:\\([^)]*\\))?)`)); return m ? m[1].trim() : null; };
const pair = (body, name) => { const m = body.match(new RegExp(`\\.${name}\\s*=\\s*\\{\\s*(\\w+)\\s*,\\s*(\\w+)\\s*,?\\s*\\}`)); return m ? [m[1], m[2]] : null; };
const ident = (c, prefix) => c.slice(prefix.length).toLowerCase().replace(/_/g, '-');
const titleCase = s => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

const GROWTH = ['GROWTH_MEDIUM_FAST', 'GROWTH_ERRATIC', 'GROWTH_FLUCTUATING', 'GROWTH_MEDIUM_SLOW', 'GROWTH_FAST', 'GROWTH_SLOW'];
// Bolas da Gen 3 (campo de 4 bits do Pokémon = índice do item)
const BALLS = [null, 'Master Ball', 'Ultra Ball', 'Great Ball', 'Poké Ball', 'Safari Ball', 'Net Ball', 'Dive Ball', 'Nest Ball', 'Repeat Ball', 'Timer Ball', 'Luxury Ball', 'Premier Ball'];

async function main() {
  console.log('Baixando fontes…');
  const [speciesH, pokedexH, speciesInfo, itemsH, itemsC, movesH, battleMoves, abilitiesH,
    pTypes, pEfficacy, pEfficacyPast, pItems, pItemNames, pAbilities, pAbilityNames] = await Promise.all([
    get(`${EM}/include/constants/species.h`), get(`${EM}/include/constants/pokedex.h`), get(`${EM}/src/data/pokemon/species_info.h`),
    get(`${EM}/include/constants/items.h`), get(`${EM}/src/data/items.h`),
    get(`${EM}/include/constants/moves.h`), get(`${EM}/src/data/battle_moves.h`), get(`${EM}/include/constants/abilities.h`),
    get(`${PAPI}/types.csv`), get(`${PAPI}/type_efficacy.csv`), get(`${PAPI}/type_efficacy_past.csv`),
    get(`${PAPI}/items.csv`), get(`${PAPI}/item_names.csv`), get(`${PAPI}/abilities.csv`), get(`${PAPI}/ability_names.csv`),
  ]);

  // Tipos: mesma numeração do app (type_id da PokeAPI); o nome do decomp vira o identificador
  const typeRows = csv(pTypes).filter(r => +r.id < 10000);
  const typeId = new Map(typeRows.map(r => [r.identifier, +r.id]));
  const typeOf = c => typeId.get(c.replace('TYPE_', '').toLowerCase()) ?? 0;

  // Espécies
  const species = defines(speciesH, 'SPECIES_');
  const dex = enumValues(pokedexH, 'NATIONAL_DEX_');
  const info = blocks(speciesInfo);
  const maxSpecies = species.get('SPECIES_CHIMECHO');
  const speciesOut = [null];
  for (let id = 1; id <= maxSpecies; id++) {
    const c = [...species].find(([, v]) => v === id)?.[0];
    const body = c && info.get(c);
    const national = c ? dex.get(c.replace('SPECIES_', 'NATIONAL_DEX_')) : undefined;
    if (!body || national === undefined) { speciesOut.push(null); continue; } // 252–276: vagas sem espécie
    const n = k => Number(field(body, k));
    const types = pair(body, 'types').map(typeOf);
    const abilities = pair(body, 'abilities');
    const g = field(body, 'genderRatio');
    const gender = g === 'MON_GENDERLESS' ? 255 : g === 'MON_FEMALE' ? 254 : g === 'MON_MALE' ? 0
      : Math.min(254, Math.floor((parseFloat(g.match(/PERCENT_FEMALE\(([\d.]+)\)/)[1]) * 255) / 100));
    speciesOut.push([
      national,
      types[0], types[1] === types[0] ? 0 : types[1],
      abilities[0], abilities[1],
      gender,
      GROWTH.indexOf(field(body, 'growthRate')),
      // stats base na ordem do app: HP, Atk, Def, SpA, SpD, Spe
      n('baseHP'), n('baseAttack'), n('baseDefense'), n('baseSpAttack'), n('baseSpDefense'), n('baseSpeed'),
    ]);
  }

  // Habilidades: nome em inglês da PokeAPI pelo identificador (ABILITY_SAND_VEIL → sand-veil)
  const abilityConst = defines(abilitiesH, 'ABILITY_');
  const papiAbility = new Map(csv(pAbilities).map(r => [r.identifier, +r.id]));
  const abilityName = new Map(csv(pAbilityNames).filter(r => +r.local_language_id === ENGLISH).map(r => [+r.ability_id, r.name]));
  const abilities = [];
  for (const [c, v] of abilityConst) {
    if (!v) continue;
    const pid = papiAbility.get(ident(c, 'ABILITY_'));
    abilities[v] = abilityName.get(pid) || titleCase(c.slice(8).replace(/_/g, ' '));
  }
  for (const s of speciesOut) if (s) { s[3] = abilityConst.get(s[3]) || 0; s[4] = abilityConst.get(s[4]) || 0; }

  // Itens
  const itemConst = enumValues(itemsH, 'ITEM_');
  const itemBlocks = blocks(itemsC);
  const papiItem = new Map(csv(pItems).map(r => [r.identifier, +r.id]));
  const itemName = new Map(csv(pItemNames).filter(r => +r.local_language_id === ENGLISH).map(r => [+r.item_id, r.name]));
  const items = [];
  let unmatchedItems = [];
  for (const [c, v] of itemConst) {
    if (!v || !c.startsWith('ITEM_') || /^ITEM_0[0-9A-F]{2}$/.test(c)) continue; // ITEM_034 etc.: vagas sem item
    const pid = papiItem.get(ident(c, 'ITEM_'));
    let name = pid && itemName.get(pid);
    if (!name) {
      const raw = itemBlocks.get(c) && field(itemBlocks.get(c), 'name');
      const decompName = raw && (raw.match(/_\("(.*)"\)/) || [])[1];
      if (!decompName || /^\?+$/.test(decompName)) continue;
      name = titleCase(decompName);
      unmatchedItems.push(c);
    }
    items[v] = name;
  }

  // Golpes 1–354 (Gen 3): [poder, precisão, PP, tipo]
  const moveConst = defines(movesH, 'MOVE_');
  const moveBlocks = blocks(battleMoves);
  const moves = [];
  for (const [c, v] of moveConst) {
    if (!v || !moveBlocks.has(c)) continue;
    const b = moveBlocks.get(c);
    moves[v] = [Number(field(b, 'power')), Number(field(b, 'accuracy')), Number(field(b, 'pp')), typeOf(field(b, 'type'))];
  }

  // Tabela de tipos como na Gen 3: atual, sem Fairy, com as linhas antigas que valiam até a Gen 3 ou depois
  const nTypes = Math.max(...typeId.values()) + 1;
  const chart = Array.from({ length: nTypes }, () => Array(nTypes).fill(1));
  for (const r of csv(pEfficacy)) if (+r.damage_type_id < nTypes && +r.target_type_id < nTypes) chart[+r.damage_type_id][+r.target_type_id] = +r.damage_factor / 100;
  for (const r of csv(pEfficacyPast)) if (+r.generation_id >= GEN) chart[+r.damage_type_id][+r.target_type_id] = +r.damage_factor / 100;
  const fairy = typeId.get('fairy');
  for (let i = 0; i < nTypes; i++) { chart[fairy][i] = 1; chart[i][fairy] = 1; }

  const data = {
    meta: { generatedAt: new Date().toISOString().slice(0, 10), sources: { pokeemerald: EM, pokeapi: PAPI } },
    species: speciesOut, abilities, items, moves, balls: BALLS, typechart: chart,
  };
  await writeFile(OUT, JSON.stringify(data) + '\n');
  console.log(`espécies ${speciesOut.filter(Boolean).length}, habilidades ${abilities.filter(Boolean).length}, itens ${items.filter(Boolean).length} (${unmatchedItems.length} sem par na PokeAPI), golpes ${moves.filter(Boolean).length}`);
  if (unmatchedItems.length) console.log('Itens com nome do decomp:', unmatchedItems.slice(0, 30).join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
