// Análise de tipos da equipe: fraquezas defensivas e cobertura ofensiva dos golpes.
// Não considera habilidades (Levitate, Thick Fat…) nem itens.

/**
 * @param {Array} party Pokémon descritos (describe())
 * @param {{ types: string[], chart: number[][] }} T tabela de tipos (types[i] = nome, chart[atk][def])
 */
export function analyzeTeam(party, T) {
  const idx = new Map(T.types.map((t, i) => [t, i]));
  const attackTypes = T.types.map((t, i) => [t, i]).filter(([t]) => t && t !== 'stellar');
  const mult = (atk, defTypes) => defTypes.reduce((m, d) => m * (idx.has(d) ? T.chart[idx.get(atk)][idx.get(d)] : 1), 1);

  const members = party.filter(m => m.species.types.length);
  const defense = attackTypes.map(([t]) => {
    const row = { type: t, weak: [], resist: [], immune: [] };
    for (const m of members) {
      const x = mult(t, m.species.types);
      if (x === 0) row.immune.push(m);
      else if (x > 1) row.weak.push(m);
      else if (x < 1) row.resist.push(m);
    }
    row.alert = row.weak.length >= 3 || row.weak.length > row.resist.length + row.immune.length + 1;
    return row;
  });

  // Tipos de golpes de dano (categoria física ou especial) que a equipe usa
  const moveTypes = new Set();
  for (const m of party) for (const mv of m.moves) if (mv.type && mv.category !== null && mv.category !== 2) moveTypes.add(mv.type);
  const offense = attackTypes.map(([t]) => {
    const hitters = [...moveTypes].filter(a => mult(a, [t]) > 1);
    return { type: t, superEffective: hitters };
  });
  return {
    defense,
    coverage: offense.filter(o => o.superEffective.length).map(o => o.type),
    gaps: offense.filter(o => !o.superEffective.length).map(o => o.type),
    moveTypes: [...moveTypes],
  };
}
