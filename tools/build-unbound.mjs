#!/usr/bin/env node
// Gera src/data/unbound.json: tabelas do Pokémon Unbound 2.1 (ROM hack de FireRed com o motor CFRU).
//
// Fontes:
//   - Skeli789/Dynamic-Pokemon-Expansion, branch Unbound (licença WTFPL): numeração das espécies, golpes,
//     itens e habilidades do Unbound; Dex Nacional de cada espécie; stats base, tipos, habilidades, taxa
//     de gênero e curva de nível do Unbound (podem ser diferentes dos jogos oficiais).
//   - Skeli789/Complete-Fire-Red-Upgrade (catching.h): ordem das Poké Balls.
//   - EXTRA_ITEMS: 97 itens que o Unbound define em posições que os cabeçalhos públicos deixam sem nome
//     (ex.: 0x37 = Life Orb). Conferidos com as tabelas do Unbound 2.1 usadas pelo Unbound Cloud
//     (Skeli789/Unbound-Cloud, server/src/data/unbound_2_1/Items.json), do mesmo autor do Unbound.
//   - PokeAPI (CSV): identificadores das formas (para sprites e nomes no Showdown). Nomes em inglês de
//     golpes, itens e habilidades vêm das tabelas do app (src/data/*.json); golpes ficam ligados aos IDs
//     do app para reaproveitar tipo, poder, precisão e descrição.
//
// Uso: npm run unbound   (precisa de rede; o resultado é versionado no git)

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/data');
const DPE = 'https://raw.githubusercontent.com/Skeli789/Dynamic-Pokemon-Expansion/Unbound';
const CFRU = 'https://raw.githubusercontent.com/Skeli789/Complete-Fire-Red-Upgrade/master';
const PAPI = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';

const EXTRA_ITEMS = {
  52: 'PARK_BALL', 53: 'CHERISH_BALL', 55: 'LIFE_ORB', 56: 'TOXIC_ORB', 57: 'FLAME_ORB', 58: 'BLACK_SLUDGE',
  59: 'MAX_POWDER', 60: 'DUSK_BALL', 61: 'HEAL_BALL', 62: 'QUICK_BALL', 72: 'HONEY', 88: 'WISHING_PIECE',
  89: 'DREAM_MIST', 90: 'LIGHT_CLAY', 91: 'LINK_STONE', 99: 'DUSK_STONE', 100: 'DAWN_STONE', 101: 'SHINY_STONE',
  102: 'OVAL_STONE', 105: 'ICE_STONE', 112: 'PROTECTOR', 113: 'MAGMARIZER', 114: 'RARE_BONE', 115: 'PRISM_SCALE',
  116: 'SACHET', 117: 'WHIPPED_DREAM', 118: 'ENIGMA_BERRY', 176: 'CHOICE_BAND', 177: 'CHOICE_SPECS', 178: 'CHOICE_SCARF',
  226: 'ROCKY_HELMET', 227: 'WEAKNESS_POLICY', 228: 'PEARL_STRING', 229: 'BIG_NUGGET', 230: 'RAZOR_CLAW', 231: 'RAZOR_FANG',
  232: 'REAPER_CLOTH', 233: 'DUBIOUS_DISC', 234: 'ELECTIRIZER', 235: 'EXPERT_BELT', 236: 'POWER_HERB', 237: 'WIDE_LENS',
  238: 'ZOOM_LENS', 239: 'DESTINY_KNOT', 240: 'SMOOTH_ROCK', 241: 'DAMP_ROCK', 242: 'HEAT_ROCK', 243: 'ICY_ROCK',
  244: 'POWER_BRACER', 245: 'POWER_BELT', 246: 'POWER_LENS', 247: 'POWER_BAND', 248: 'POWER_ANKLET', 249: 'POWER_WEIGHT',
  250: 'BIG_ROOT', 251: 'ODD_KEYSTONE', 252: 'LUCK_INCENSE', 253: 'FULL_INCENSE', 254: 'ODD_INCENSE', 255: 'PURE_INCENSE',
  256: 'ROCK_INCENSE', 257: 'ROSE_INCENSE', 258: 'WAVE_INCENSE', 670: 'NORMALIUM_Z', 671: 'FIGHTINIUM_Z', 672: 'FLYINIUM_Z',
  673: 'POISONIUM_Z', 674: 'GROUNDIUM_Z', 675: 'ROCKIUM_Z', 676: 'BUGINIUM_Z', 677: 'GHOSTIUM_Z', 678: 'STEELIUM_Z',
  679: 'FIRIUM_Z', 680: 'WATERIUM_Z', 681: 'GRASSIUM_Z', 682: 'ELECTRIUM_Z', 683: 'PSYCHIUM_Z', 684: 'ICIUM_Z',
  685: 'DRAGONIUM_Z', 686: 'DARKINIUM_Z', 687: 'FAIRIUM_Z', 688: 'ALORAICHIUM_Z', 689: 'DECIDIUM_Z', 690: 'EEVIUM_Z',
  691: 'INCINIUM_Z', 692: 'KOMMONIUM_Z', 693: 'LUNALIUM_Z', 694: 'LYCANIUM_Z', 695: 'MARSHADIUM_Z', 696: 'MEWNIUM_Z',
  697: 'MIMIKIUM_Z', 698: 'PIKANIUM_Z', 699: 'PIKASHUNIUM_Z', 700: 'PRIMARIUM_Z', 701: 'SNORLIUM_Z', 702: 'SOLGANIUM_Z',
  703: 'TAPUNIUM_Z',
};

// Nomes que mudaram entre gerações ou que o CFRU escreve diferente (constante → nome atual)
const MOVE_ALIASES = {
  VICEGRIP: 'Vise Grip', HIJUMPKICK: 'High Jump Kick', FAINTATTACK: 'Feint Attack', SMELLINGSALT: 'Smelling Salts',
  SELFDESTRUCT: 'Self-Destruct', SOFTBOILED: 'Soft-Boiled', DOUBLEEDGE: 'Double-Edge', LOCKON: 'Lock-On', XSCISSOR: 'X-Scissor',
  UTURN: 'U-turn', VCREATE: 'V-create', WILLOWISP: 'Will-O-Wisp', MUDSLAP: 'Mud-Slap', FREEZEDRY: 'Freeze-Dry',
  BUBBLEBEAM: 'Bubble Beam', DOUBLESLAP: 'Double Slap', THUNDERPUNCH: 'Thunder Punch', SOLARBEAM: 'Solar Beam',
  DRAGONBREATH: 'Dragon Breath', SONICBOOM: 'Sonic Boom', ANCIENTPOWER: 'Ancient Power', DYNAMICPUNCH: 'Dynamic Punch',
  GRASSWHISTLE: 'Grass Whistle', POISONPOWDER: 'Poison Powder', SANDATTACK: 'Sand Attack', EXTREMESPEED: 'Extreme Speed',
};
const ABILITY_ALIASES = { COMPOUNDEYES: 'Compound Eyes', LIGHTNINGROD: 'Lightning Rod' };
const GROWTH = { MEDIUM_FAST: 0, ERRATIC: 1, FLUCTUATING: 2, MEDIUM_SLOW: 3, FAST: 4, SLOW: 5 };
const FORM_LABEL = { A: 'Alola', G: 'Galar', H: 'Hisui', MEGA: 'Mega', MEGA_X: 'Mega X', MEGA_Y: 'Mega Y', GIGA: 'Gigantamax', PRIMAL: 'Primal' };
const FORM_PAPI = { A: 'alola', G: 'galar', H: 'hisui', GIGA: 'gmax' };

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

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const title = s => s.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

/** `#define PREFIXO_NOME número` → Map(número → NOME), o primeiro nome de cada número. */
function defines(src, prefix) {
  const map = new Map();
  for (const m of stripComments(src).matchAll(new RegExp(`#define\\s+${prefix}(\\w+)\\s+(0x[0-9A-Fa-f]+|\\d+)\\b`, 'g'))) {
    const v = Number(m[2]);
    if (!map.has(v)) map.set(v, m[1]);
  }
  return map;
}

function csv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return rows.map(line => Object.fromEntries(line.split(',').map((c, i) => [keys[i], c])));
}

async function main() {
  console.log('Baixando fontes…');
  const [speciesH, pokedexH, toDex, baseStatsC, itemsH, movesH, catching, pokemonCsv, movesCsv] = await Promise.all([
    get(`${DPE}/include/species.h`), get(`${DPE}/include/pokedex.h`), get(`${DPE}/src/Species_To_Pokdex_Table.c`),
    get(`${DPE}/src/Base_Stats.c`), get(`${DPE}/include/items.h`), get(`${DPE}/include/moves.h`),
    get(`${CFRU}/include/new/catching.h`), get(`${PAPI}/pokemon.csv`), get(`${PAPI}/moves.csv`),
  ].map(p => p.then(text => text.replace(/\r\n/g, '\n'))));
  const read = f => readFile(path.join(DATA, f), 'utf8').then(JSON.parse);
  const [appSpecies, appMoves, appItems, appTypes] = await Promise.all([read('species.json'), read('moves.json'), read('items.json'), read('types.json')]);

  // Nomes do app (inglês) por forma normalizada
  const index = list => { const m = new Map(); list.forEach((n, i) => { if (n && !m.has(norm(n))) m.set(norm(n), i); }); return m; };
  const moveByName = index(appMoves.moves.map(r => r && r[0]));
  const itemNames = new Map(appItems.items.filter(Boolean).map(n => [norm(n), n]));
  const abilityNames = new Map(appSpecies.abilityNames.filter(Boolean).map(n => [norm(n), n]));
  const typeIndex = new Map(appTypes.map((t, i) => [t && t.toUpperCase(), i]));

  // Espécies: número → constante; Dex Nacional de cada uma
  const dexNum = new Map([...stripComments(pokedexH).matchAll(/#define\s+NATIONAL_DEX_(\w+)\s+(\d+)\b/g)].map(m => [m[1], Number(m[2])]));
  const nationalOf = new Map([...toDex.matchAll(/\[SPECIES_(\w+)\s*-\s*1\]\s*=\s*NATIONAL_DEX_(\w+)/g)].map(m => [m[1], dexNum.get(m[2]) ?? null]));
  const base = new Map();
  for (const m of baseStatsC.matchAll(/\[SPECIES_(\w+)\]\s*=\s*\{((?:(?!\[SPECIES_)[\s\S])*?)\n\t\}/g)) {
    base.set(m[1], Object.fromEntries([...m[2].matchAll(/\.(\w+)\s*=\s*([^,\n]+)/g)].map(x => [x[1], x[2].trim()])));
  }
  const speciesId = defines(speciesH, 'SPECIES_');
  // Alguns números têm dois nomes (FARFETCHD / FARFETCHED): vale o que tem stats base
  for (const m of stripComments(speciesH).matchAll(/#define\s+SPECIES_(\w+)\s+(0x[0-9A-Fa-f]+|\d+)\b/g)) {
    if (!base.has(speciesId.get(Number(m[2]))) && base.has(m[1])) speciesId.set(Number(m[2]), m[1]);
  }
  const papi = csv(pokemonCsv);
  const papiById = new Map(papi.map(r => [Number(r.id), r.identifier]));
  const papiByIdent = new Map(papi.map(r => [r.identifier, Number(r.id)]));

  const abilities = [null];
  const abilityIndex = new Map();
  const missing = { moves: [], items: [], abilities: [], species: [] };
  const ability = c => {
    if (!c || c === 'ABILITY_NONE') return 0;
    const k = c.replace(/^ABILITY_/, '');
    if (!abilityIndex.has(k)) {
      const name = ABILITY_ALIASES[k] || abilityNames.get(norm(k)) || (missing.abilities.push(k), title(k));
      abilityIndex.set(k, abilities.length);
      abilities.push(name);
    }
    return abilityIndex.get(k);
  };
  const gender = g => {
    if (/GENDERLESS/.test(g)) return 255;
    if (/MON_FEMALE/.test(g)) return 254;
    if (/MON_MALE/.test(g)) return 0;
    const p = g.match(/PERCENT_FEMALE\(\s*([\d.]+)\s*\)/);
    return p ? Math.min(254, Math.floor((Number(p[1]) * 255) / 100)) : 255;
  };

  // Nome da espécie e forma pela constante (EXEGGUTOR_A = Exeggutor de Alola). A tabela pública da Dex
  // aponta algumas formas para a pré-evolução; quando o nome da constante não bate, vale o nome.
  const nationalByName = new Map();
  appSpecies.species.forEach((r, n) => { if (r && n <= 1025) { const k = norm(r[0]); nationalByName.set(k, nationalByName.has(k) ? -1 : n); } });
  const restAfter = (c, nameNorm) => {
    let j = 0, i = 0;
    for (; i < c.length && j < nameNorm.length; i++) {
      const ch = c[i].toLowerCase();
      if (!/[a-z0-9]/.test(ch)) continue;
      if (ch !== nameNorm[j]) return null;
      j++;
    }
    return j === nameNorm.length ? c.slice(i).replace(/^_+/, '') : null;
  };
  function identify(c, tableNational) {
    const tableName = tableNational && appSpecies.species[tableNational] ? norm(appSpecies.species[tableNational][0]) : null;
    let rest = tableName ? restAfter(c, tableName) : null;
    if (rest !== null) return { national: tableNational, rest };
    const tokens = c.split('_');
    for (let k = tokens.length; k > 0; k--) {
      const n = nationalByName.get(norm(tokens.slice(0, k).join('')));
      if (n > 0) return { national: n, rest: tokens.slice(k).join('_') };
    }
    if (tableName && norm(c).includes(tableName)) return { national: tableNational, rest: c.replace(new RegExp(tableName, 'i'), '').replace(/^_+|_+$/g, '') };
    return tableNational ? { national: tableNational, rest: c } : null;
  }

  const maxSpecies = Math.max(...speciesId.keys());
  const species = [];
  for (let id = 1; id <= maxSpecies; id++) {
    const c = speciesId.get(id);
    const b = c ? base.get(c) : null;
    const who = c ? identify(c, nationalOf.get(c)) : null;
    if (!who || !b || !appSpecies.species[who.national] || !Number(b.baseHP)) continue;
    const { national } = who;
    const rest = (national === 29 || national === 32) && /^[FM]$/.test(who.rest) ? '' : who.rest; // Nidoran♀/♂ são espécies
    let form = null, spriteId = national, icon = national <= 898;
    if (rest) {
      const unown = national === 201;
      form = unown ? ({ EXCLAMATION: '!', QUESTION: '?' }[rest] || rest) : FORM_LABEL[rest] || (rest === 'F' ? 'Female' : title(rest));
      const papiSuffix = unown ? null : FORM_PAPI[rest] || (rest === 'F' ? 'female' : rest.toLowerCase().replace(/_/g, '-'));
      const ident = `${papiById.get(national)}-${papiSuffix}`;
      if (papiByIdent.has(ident)) { spriteId = papiByIdent.get(ident); icon = false; }
    }
    const type = t => typeIndex.get(String(t).replace(/^TYPE_/, '')) ?? 0;
    const t1 = type(b.type1), t2 = type(b.type2);
    species[id] = [
      appSpecies.species[national][0], form, national, spriteId, icon ? 1 : 0, t1, t2 === t1 ? 0 : t2,
      ability(b.ability1), ability(b.ability2), ability(b.hiddenAbility), gender(b.genderRatio || ''),
      GROWTH[String(b.growthRate).replace(/^GROWTH_/, '')] ?? 0,
      ...['baseHP', 'baseAttack', 'baseDefense', 'baseSpAttack', 'baseSpDefense', 'baseSpeed'].map(k => Number(b[k])),
    ];
  }

  const skipped = [...speciesId].filter(([id, c]) => !species[id] && base.get(c) && Number(base.get(c).baseHP)).map(([id, c]) => `${id}:${c}`);
  if (skipped.length) console.log(`espécies sem par: ${skipped.length}: ${skipped.join(', ')}`);

  // Golpes: ID do app (número) ou, sem par, o nome (texto). PP oficial (PokeAPI) à parte: o PC não guarda
  // o PP, e a tabela do app (expansion) difere em alguns golpes (Night Slash: 15 no Unbound, 20 no expansion).
  const officialPP = new Map(csv(movesCsv).map(r => [norm(r.identifier), Number(r.pp) || 0]));
  const moves = [], movePP = [];
  for (const [id, c] of defines(movesH, 'MOVE_')) {
    if (!id || c === 'NONE' || /^\d|NAME_LENGTH|^COUNT$/.test(c)) continue;
    const name = MOVE_ALIASES[c];
    const appId = moveByName.get(norm(name || c));
    if (appId !== undefined) moves[id] = appId;
    else { moves[id] = name || title(c); missing.moves.push(c); }
    const pp = officialPP.get(norm(name || (appId !== undefined ? appMoves.moves[appId][0] : c)));
    if (pp) movePP[id] = pp;
  }
  if (!moves[12]) { moves[12] = moveByName.get('guillotine'); movePP[12] = 5; } // o cabeçalho usa 12 também para NAME_LENGTH

  // Itens: nomes do cabeçalho + os que o cabeçalho público deixa sem nome
  const items = [];
  const itemConsts = defines(itemsH, 'ITEM_');
  for (const [id, n] of Object.entries(EXTRA_ITEMS)) itemConsts.set(Number(id), n);
  for (const [id, c] of itemConsts) {
    if (!id || c === 'NONE' || /^[0-9A-F]{3}$/.test(c)) continue;
    items[id] = itemNames.get(norm(c)) || (missing.items.push(c), title(c));
  }

  // Poké Balls (0 = Master Ball)
  const balls = [...stripComments(catching).matchAll(/^\s*BALL_TYPE_(\w+)_BALL\s*,/gm)].map(m => itemNames.get(norm(m[1] + 'BALL')) || title(m[1]) + ' Ball');

  const data = {
    meta: { generatedAt: new Date().toISOString().slice(0, 10), version: 'Unbound 2.1', sources: [DPE, CFRU, PAPI] },
    species, abilities, moves, movePP, items, balls,
  };
  await writeFile(path.join(DATA, 'unbound.json'), JSON.stringify(data) + '\n');
  console.log(`espécies ${species.filter(Boolean).length}, golpes ${moves.filter(x => x !== undefined).length}, itens ${items.filter(Boolean).length}, habilidades ${abilities.length - 1}, bolas ${balls.length}`);
  for (const [k, v] of Object.entries(missing)) if (v.length) console.log(`sem par no app (${k}): ${v.length}: ${v.slice(0, 40).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
