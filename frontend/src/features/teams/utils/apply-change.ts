import type { Pokemon, Team, TeamMember } from '@/api'

export type TeamChange =
  | { kind: 'add'; pokemon: Pokemon }
  // Puts `pokemon` in the slot of the member `pokemonId`. If `pokemon` is on the team already,
  // it moves there.
  | { kind: 'replace'; pokemonId: number; pokemon: Pokemon }
  | { kind: 'remove'; pokemonId: number }
  | { kind: 'reorder'; pokemonIds: number[] }
  | { kind: 'rename'; name: string }

/** The team's Pokémon ids, in slot order, after the change. */
export function changedPokemonIds(ids: number[], change: TeamChange): number[] {
  switch (change.kind) {
    case 'add':
      return [...ids, change.pokemon.id]
    case 'remove':
      return ids.filter((id) => id !== change.pokemonId)
    case 'replace':
      return ids
        .filter((id) => id !== change.pokemon.id)
        .map((id) => (id === change.pokemonId ? change.pokemon.id : id))
    case 'reorder':
      return change.pokemonIds
    case 'rename':
      return ids
  }
}

// The member with this Pokémon: as it is on the team, or new if the change brings it in.
function memberFor(team: Team, change: TeamChange, pokemonId: number): TeamMember | undefined {
  const member = team.members.find((each) => each.pokemon.id === pokemonId)
  if (member) return member
  if ((change.kind === 'add' || change.kind === 'replace') && change.pokemon.id === pokemonId) {
    return { position: 0, pokemon: change.pokemon, removed_at: null, related_pokemon_ids: [] }
  }
  return undefined
}

/** The team as the change would leave it, shown before the API confirms it. */
export function applyChange(team: Team, change: TeamChange): Team {
  const ids = changedPokemonIds(
    team.members.map((member) => member.pokemon.id),
    change,
  )
  const members = ids.flatMap((id, position) => {
    const member = memberFor(team, change, id)
    if (!member) return []
    const related = member.related_pokemon_ids.filter((other) => ids.includes(other))
    return [{ ...member, position, related_pokemon_ids: related }]
  })
  return { ...team, name: change.kind === 'rename' ? change.name : team.name, members }
}
