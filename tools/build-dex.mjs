#!/usr/bin/env node
// Gera src/data/dex.json: linhas evolutivas (com o método em português) e golpes por nível.
// Fonte: CSVs da PokeAPI (jogos oficiais). O Quetzal pode ter mudado evoluções e golpes,
// por isso a UI mostra esses dados como "provável".
//
// Os golpes são ligados aos IDs do expansion (src/data/moves.json) pelo nome; os que não
// tiverem par ficam como texto.
//
// Uso: npm run dex   (precisa de rede; o resultado é versionado no git)

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data');
const PAPI = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const ENGLISH = 9;
const MAX_SPECIES = 1025;

// Jogos usados para os golpes por nível, do mais preferido ao menos (fica o primeiro que tiver dados).
const VERSION_ORDER = [
  'scarlet-violet', 'the-indigo-disk', 'the-teal-mask', 'sword-shield', 'the-crown-tundra', 'the-isle-of-armor',
  'brilliant-diamond-shining-pearl', 'ultra-sun-ultra-moon', 'sun-moon', 'omega-ruby-alpha-sapphire', 'x-y',
  'black-2-white-2', 'black-white', 'heartgold-soulsilver', 'platinum', 'diamond-pearl', 'emerald',
  'firered-leafgreen', 'ruby-sapphire', 'crystal', 'gold-silver', 'yellow', 'red-blue',
];
const VERSION_LABEL = {
  'scarlet-violet': 'Scarlet/Violet', 'the-indigo-disk': 'Scarlet/Violet', 'the-teal-mask': 'Scarlet/Violet',
  'sword-shield': 'Sword/Shield', 'the-crown-tundra': 'Sword/Shield', 'the-isle-of-armor': 'Sword/Shield',
  'brilliant-diamond-shining-pearl': 'BDSP', 'ultra-sun-ultra-moon': 'Ultra Sun/Moon', 'sun-moon': 'Sun/Moon',
  'omega-ruby-alpha-sapphire': 'ORAS', 'x-y': 'X/Y', 'black-2-white-2': 'Black 2/White 2', 'black-white': 'Black/White',
  'heartgold-soulsilver': 'HG/SS', platinum: 'Platinum', 'diamond-pearl': 'Diamond/Pearl', emerald: 'Emerald',
  'firered-leafgreen': 'FR/LG', 'ruby-sapphire': 'Ruby/Sapphire', crystal: 'Crystal', 'gold-silver': 'Gold/Silver',
  yellow: 'Yellow', 'red-blue': 'Red/Blue',
};

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

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  console.log('Baixando fontes…');
  const [pSpecies, pSpeciesNames, pEvo, pItemNames, pMoveNames, pTypes, pVersionGroups, pPokemon, pPokemonMoves] = await Promise.all([
    get(`${PAPI}/pokemon_species.csv`), get(`${PAPI}/pokemon_species_names.csv`), get(`${PAPI}/pokemon_evolution.csv`),
    get(`${PAPI}/item_names.csv`), get(`${PAPI}/move_names.csv`), get(`${PAPI}/types.csv`),
    get(`${PAPI}/version_groups.csv`), get(`${PAPI}/pokemon.csv`), get(`${PAPI}/pokemon_moves.csv`),
  ]);
  const ourMoves = JSON.parse(await readFile(path.join(OUT, 'moves.json'), 'utf8')).moves;
  const forms = JSON.parse(await readFile(path.join(OUT, 'forms.json'), 'utf8'));

  const english = rows => rows.filter(r => +r.local_language_id === ENGLISH);
  const speciesName = new Map(english(csv(pSpeciesNames)).map(r => [+r.pokemon_species_id, r.name]));
  const itemName = new Map(english(csv(pItemNames)).map(r => [+r.item_id, r.name]));
  const moveName = new Map(english(csv(pMoveNames)).map(r => [+r.move_id, r.name]));
  const typeName = new Map(csv(pTypes).map(r => [+r.id, r.identifier]));
  const ourMoveByName = new Map();
  ourMoves.forEach((row, id) => { if (row && !ourMoveByName.has(norm(row[0]))) ourMoveByName.set(norm(row[0]), id); });
  /** Golpe no formato do app: ID do expansion (número) ou, sem par, o nome (texto). */
  const move = papiId => {
    const name = moveName.get(papiId);
    if (!name) return null;
    return ourMoveByName.get(norm(name)) ?? name;
  };
  const moveLabel = papiId => moveName.get(papiId) || `golpe ${papiId}`;

  // Espécies: de quem evoluem e a qual linha pertencem
  const species = csv(pSpecies).filter(r => +r.id <= MAX_SPECIES);
  const chainOf = new Map(species.map(r => [+r.id, +r.evolution_chain_id]));
  const fromOf = new Map(species.map(r => [+r.id, r.evolves_from_species_id ? +r.evolves_from_species_id : 0]));

  // Método de evolução em português
  const TIME = { day: 'de dia', night: 'de noite', dusk: 'ao entardecer', 'full-moon': 'na lua cheia' };
  function method(r) {
    const t = +r.evolution_trigger_id;
    const extra = [];
    if (+r.gender_id === 1) extra.push('fêmea');
    if (+r.gender_id === 2) extra.push('macho');
    if (r.held_item_id) extra.push(`segurando ${itemName.get(+r.held_item_id)}`);
    if (r.known_move_id) extra.push(`sabendo ${moveLabel(+r.known_move_id)}`);
    if (r.known_move_type_id) extra.push(`sabendo um golpe ${typeName.get(+r.known_move_type_id)}`);
    if (r.minimum_happiness) extra.push('com amizade alta');
    if (r.minimum_affection) extra.push('com afeto alto');
    if (r.minimum_beauty) extra.push('com beleza alta');
    if (r.time_of_day && TIME[r.time_of_day]) extra.push(TIME[r.time_of_day]);
    if (r.location_id) extra.push('num local específico');
    if (r.party_species_id) extra.push(`com ${speciesName.get(+r.party_species_id)} na equipe`);
    if (r.party_type_id) extra.push(`com um Pokémon ${typeName.get(+r.party_type_id)} na equipe`);
    if (r.relative_physical_stats !== '') extra.push({ 1: 'com Atk > Def', '-1': 'com Atk < Def', 0: 'com Atk = Def' }[r.relative_physical_stats]);
    if (+r.needs_overworld_rain) extra.push('com chuva');
    if (+r.turn_upside_down) extra.push('com o aparelho de cabeça para baixo');
    const tail = extra.length ? ' ' + extra.join(', ') : '';
    switch (t) {
      case 1: return (r.minimum_level ? `Nv. ${r.minimum_level}` : 'Subir de nível') + tail;
      case 2: return 'Troca' + (r.trade_species_id ? ` por ${speciesName.get(+r.trade_species_id)}` : '') + tail;
      case 3: return `Usar ${itemName.get(+r.trigger_item_id)}` + tail;
      case 4: return 'Nv. 20 com espaço na equipe';
      case 5: return 'Girar segurando um doce';
      case 8: return '3 golpes críticos na mesma batalha';
      case 9: return 'Receber dano sem desmaiar';
      case 11: case 12: return `Usar ${moveLabel(+r.known_move_id)} em estilo ${t === 11 ? 'ágil' : 'forte'}`;
      case 13: return 'Receber dano de recuo';
      case 14: return `Usar ${moveLabel(+r.used_move_id || +r.known_move_id)}${r.minimum_move_count ? ` ${r.minimum_move_count} vezes` : ''}` + tail;
      case 15: return 'Derrotar 3 Bisharp que seguram Leader\'s Crest';
      case 16: return 'Juntar 999 moedas de Gimmighoul';
      case 10: return (r.minimum_level ? `Nv. ${r.minimum_level} em batalha` : 'Subir de nível em batalha') + tail;
      default: return 'Condição especial';
    }
  }
  const evoMethods = new Map(); // espécie evoluída -> textos (sem repetir)
  for (const r of csv(pEvo)) {
    const id = +r.evolved_species_id;
    if (id > MAX_SPECIES) continue;
    if (!evoMethods.has(id)) evoMethods.set(id, []);
    const text = method(r);
    if (text && !evoMethods.get(id).includes(text)) evoMethods.get(id).push(text);
  }

  // Linhas: [espécie, de quem evolui (0 = início), método]
  const chains = {};
  for (const r of species) {
    const id = +r.id, c = chainOf.get(id);
    (chains[c] ||= []).push([id, fromOf.get(id), (evoMethods.get(id) || []).join(' ou ')]);
  }
  const chainList = [];
  const speciesChain = {};
  for (const c of Object.keys(chains).map(Number).sort((a, b) => a - b)) {
    const nodes = chains[c];
    if (nodes.length < 2) continue; // não evolui
    const idx = chainList.length;
    chainList.push(nodes);
    for (const [id] of nodes) speciesChain[id] = idx;
  }

  // Golpes por nível: para cada Pokémon, o jogo mais recente da lista com dados
  const vgIdent = new Map(csv(pVersionGroups).map(r => [+r.id, r.identifier]));
  const rank = new Map(VERSION_ORDER.map((v, i) => [v, i]));
  const wanted = new Set([...Array.from({ length: MAX_SPECIES }, (_, i) => i + 1), ...Object.values(forms).map(f => f.id)]);
  const byPokemon = new Map(); // pokemon id -> Map(rank -> [[nível, golpe]])
  for (const line of pPokemonMoves.split('\n').slice(1)) {
    if (!line) continue;
    const [pid, vg, mid, method, level] = line.split(',');
    if (method !== '1' || !wanted.has(+pid)) continue;
    const rk = rank.get(vgIdent.get(+vg));
    if (rk === undefined) continue;
    if (!byPokemon.has(+pid)) byPokemon.set(+pid, new Map());
    const m = byPokemon.get(+pid);
    if (!m.has(rk)) m.set(rk, []);
    m.get(rk).push([+level, +mid]);
  }
  const versions = [...new Set(VERSION_ORDER.map(v => VERSION_LABEL[v]))];
  const learn = {};
  let unmatched = new Set();
  for (const [pid, m] of byPokemon) {
    const best = Math.min(...m.keys());
    const seen = new Set();
    const list = m.get(best)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .filter(([lv, mid]) => { const k = `${lv}:${mid}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(([lv, mid]) => { const mv = move(mid); if (typeof mv === 'string') unmatched.add(mv); return [lv, mv]; })
      .filter(([, mv]) => mv !== null);
    // [índice do jogo, nível, golpe, nível, golpe, …]
    learn[pid] = [versions.indexOf(VERSION_LABEL[VERSION_ORDER[best]]), ...list.flat()];
  }

  // Nomes das espécies que aparecem nas linhas (o app só tem nomes até 905)
  const names = {};
  for (const nodes of chainList) for (const [id] of nodes) if (id > 905) names[id] = speciesName.get(id);
  // Formas usadas pelo app (ID de Pokémon da PokeAPI -> espécie), para achar a linha evolutiva
  const pokemonSpecies = new Map(csv(pPokemon).map(r => [+r.id, +r.species_id]));
  const formSpecies = {};
  for (const f of Object.values(forms)) formSpecies[f.id] = pokemonSpecies.get(f.id);

  const data = {
    meta: { generatedAt: new Date().toISOString().slice(0, 10), source: PAPI },
    versions, chains: chainList, speciesChain, names, formSpecies, learn,
  };
  await writeFile(path.join(OUT, 'dex.json'), JSON.stringify(data) + '\n');
  console.log(`linhas ${chainList.length}, Pokémon com golpes ${Object.keys(learn).length}, golpes sem par no expansion ${unmatched.size}${unmatched.size ? ': ' + [...unmatched].slice(0, 15).join(', ') : ''}`);
}

main().catch(e => { console.error(e); process.exit(1); });
