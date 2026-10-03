#!/usr/bin/env node
// Gera src/data/nds.json: tabelas dos jogos oficiais de DS da Gen 4 (Diamond/Pearl/Platinum, HeartGold/SoulSilver)
// e da Gen 5 (Black/White, Black 2/White 2), com os valores daquela época.
//
// Fonte: PokeAPI (CSV).
//   - Itens: numeração de cada geração (item_game_indices) + nome em inglês.
//   - Habilidades: o save guarda o número nacional; nome em inglês.
//   - Espécies (Dex Nacional, como no save): tipos e stats base da Gen 4/5 (pokemon_types_past e
//     pokemon_stats_past desfazem as mudanças da Gen 6 em diante, ex.: Clefairy era Normal) e curva de nível.
//   - Formas (byte de forma do save → Pokémon da PokeAPI pela ordem das formas), com tipos e stats próprios.
//   - Golpes 1–559: tipo, poder, precisão, PP e categoria da época (move_changelog desfaz as mudanças posteriores).
//
// Uso: npm run nds   (precisa de rede; o resultado é versionado no git)

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/nds.json');
const PAPI = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const ENGLISH = 9;
const GENS = { 4: { vg: 10, maxSpecies: 493, maxMove: 467 }, 5: { vg: 14, maxSpecies: 649, maxMove: 559 } }; // HG/SS e B2/W2
const GROWTH = { 1: 5, 2: 0, 3: 4, 4: 3, 5: 1, 6: 2 }; // PokeAPI → curvas do app (0 Medium Fast … 5 Slow)
const STAT = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }; // hp atk def spa spd spe
const CATEGORY = { 2: 0, 3: 1, 1: 2 }; // PokeAPI physical/special/status → app

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

async function main() {
  console.log('Baixando fontes…');
  const names = ['item_game_indices', 'item_names', 'ability_names', 'pokemon', 'pokemon_species', 'pokemon_types', 'pokemon_types_past',
    'pokemon_stats', 'pokemon_stats_past', 'pokemon_forms', 'pokemon_form_types', 'moves', 'move_changelog'];
  const t = Object.fromEntries(await Promise.all(names.map(async n => [n, csv(await get(`${PAPI}/${n}.csv`))])));
  const english = rows => rows.filter(r => +r.local_language_id === ENGLISH);
  const itemName = new Map(english(t.item_names).map(r => [+r.item_id, r.name]));

  const items = {};
  for (const g of [4, 5]) {
    items[g] = [];
    for (const r of t.item_game_indices) if (+r.generation_id === g && itemName.has(+r.item_id)) items[g][+r.game_index] = itemName.get(+r.item_id);
  }
  const abilities = [];
  for (const r of english(t.ability_names)) if (+r.ability_id < 1000) abilities[+r.ability_id] = r.name;

  const growthOf = new Map(t.pokemon_species.map(r => [+r.id, GROWTH[+r.growth_rate_id] ?? 0]));
  const speciesOf = new Map(t.pokemon.map(r => [+r.id, +r.species_id]));
  const byPokemon = (rows, key) => { const m = new Map(); for (const r of rows) { const k = +r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const types = byPokemon(t.pokemon_types, 'pokemon_id'), typesPast = byPokemon(t.pokemon_types_past, 'pokemon_id');
  const stats = byPokemon(t.pokemon_stats, 'pokemon_id'), statsPast = byPokemon(t.pokemon_stats_past, 'pokemon_id');
  const formTypes = byPokemon(t.pokemon_form_types, 'pokemon_form_id');

  /** Tipos e stats de um Pokémon da PokeAPI como eram na geração g. */
  function info(pid, g) {
    const past = (typesPast.get(pid) || []).filter(r => +r.generation_id >= g);
    const oldest = past.length ? Math.min(...past.map(r => +r.generation_id)) : null;
    const tp = (oldest ? past.filter(r => +r.generation_id === oldest) : types.get(pid) || []).sort((a, b) => a.slot - b.slot).map(r => +r.type_id);
    const st = [0, 0, 0, 0, 0, 0];
    for (const r of stats.get(pid) || []) st[STAT[+r.stat_id]] = +r.base_stat;
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const rows = (statsPast.get(pid) || []).filter(r => +r.stat_id === id && +r.generation_id >= g);
      if (rows.length) st[STAT[id]] = +rows.reduce((a, b) => (+b.generation_id < +a.generation_id ? b : a)).base_stat;
    }
    return [tp[0] || 0, tp[1] && tp[1] !== tp[0] ? tp[1] : 0, ...st];
  }

  const species = {}, forms = {};
  for (const g of [4, 5]) {
    const { maxSpecies } = GENS[g];
    species[g] = [];
    for (let n = 1; n <= maxSpecies; n++) species[g][n] = [...info(n, g).slice(0, 2), growthOf.get(n) ?? 0, ...info(n, g).slice(2)];
    // Formas: form_order − 1 = número da forma no save; só as que mudam tipos, stats ou sprite
    forms[g] = {};
    for (const f of t.pokemon_forms) {
      const pid = +f.pokemon_id, n = speciesOf.get(pid);
      if (!n || n > maxSpecies || +f.introduced_in_version_group_id > GENS[g].vg || +f.form_order <= 1 || f.is_battle_only === '1') continue;
      const ft = (formTypes.get(+f.id) || []).sort((a, b) => a.slot - b.slot).map(r => +r.type_id);
      const row = info(pid, g);
      if (ft.length) { row[0] = ft[0]; row[1] = ft[1] && ft[1] !== ft[0] ? ft[1] : 0; }
      const label = f.form_identifier.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const base = species[g][n];
      const same = pid === n && row[0] === base[0] && row[1] === base[1];
      forms[g][`${n}:${+f.form_order - 1}`] = [pid !== n ? pid : 0, label, ...(same ? [] : row)];
    }
  }

  // Golpes da época: valores atuais e, por cima, os valores antigos do changelog
  const moves = {};
  const changes = byPokemon(t.move_changelog, 'move_id');
  for (const g of [4, 5]) {
    const { vg, maxMove } = GENS[g];
    moves[g] = [];
    for (const r of t.moves) {
      const id = +r.id;
      if (id > maxMove) continue;
      const v = { type: +r.type_id, power: +r.power || 0, pp: +r.pp || 0, accuracy: +r.accuracy || 0 };
      for (const field of ['type', 'power', 'pp', 'accuracy']) {
        const col = field === 'type' ? 'type_id' : field;
        const later = (changes.get(id) || []).filter(c => +c.changed_in_version_group_id > vg && c[col] !== '');
        if (later.length) v[field] = +later.reduce((a, b) => (+b.changed_in_version_group_id < +a.changed_in_version_group_id ? b : a))[col];
      }
      moves[g][id] = [v.type, v.power, v.accuracy, v.pp, CATEGORY[+r.damage_class_id] ?? 2];
    }
  }

  const data = { meta: { generatedAt: new Date().toISOString().slice(0, 10), source: PAPI }, items, abilities, species, forms, moves };
  await writeFile(OUT, JSON.stringify(data) + '\n');
  console.log(`itens G4 ${items[4].filter(Boolean).length}, G5 ${items[5].filter(Boolean).length}; espécies ${species[5].length - 1}; formas G4 ${Object.keys(forms[4]).length}, G5 ${Object.keys(forms[5]).length}; golpes G5 ${moves[5].filter(Boolean).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
