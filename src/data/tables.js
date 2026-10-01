// Tabelas estáticas geradas por tools/build-tables.mjs (exceto quetzal-overrides.json, manual).
import types from './types.json';
import species from './species.json';
import moves from './moves.json';
import items from './items.json';
import forms from './forms.json';
import overrides from './quetzal-overrides.json';

export default {
  types,
  species: species.species,
  moves: moves.moves,
  items: items.items,
  speciesAbilities: species.abilities,
  abilityNames: species.abilityNames,
  forms,
  overrides,
};
