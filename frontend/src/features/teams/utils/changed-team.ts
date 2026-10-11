import type { Pokemon, TeamMember } from '@/api'

import type { TeamShape } from '../types'

function pokemonOf(team: TeamShape): Pokemon[] {
  return team.members.map((member) => member.pokemon)
}

// The team with these Pokémon as its members, in this order: each member as it was, or new,
// numbered by slot, with only the relatives still on the team.
function withMembers<T extends TeamShape>(team: T, pokemon: Pokemon[]): T {
  const ids = pokemon.map((each) => each.id)
  const members = pokemon.map((each, position): TeamMember => {
    const member = team.members.find((other) => other.pokemon.id === each.id)
    if (!member) return { position, pokemon: each, removed_at: null, related_pokemon_ids: [] }
    const related = member.related_pokemon_ids.filter((id) => ids.includes(id))
    return { ...member, position, related_pokemon_ids: related }
  })
  return { ...team, members }
}

/** The team with the Pokémon in its next free slot. */
export function withAdded<T extends TeamShape>(team: T, pokemon: Pokemon): T {
  return withMembers(team, [...pokemonOf(team), pokemon])
}

/** The team without the Pokémon; the members after it move up a slot. */
export function withRemoved<T extends TeamShape>(team: T, pokemonId: number): T {
  return withMembers(team, pokemonOf(team).filter((each) => each.id !== pokemonId))
}

/**
 * The team with `pokemon` in the slot of the member `pokemonId`. If `pokemon` is on the team
 * already, it moves into the slot and the gap it leaves closes.
 */
export function withReplaced<T extends TeamShape>(
  team: T,
  pokemonId: number,
  pokemon: Pokemon,
): T {
  const replaced = pokemonOf(team)
    .filter((each) => each.id !== pokemon.id)
    .map((each) => (each.id === pokemonId ? pokemon : each))
  return withMembers(team, replaced)
}

/** The team with its members in the order of these Pokémon ids. */
export function withOrder<T extends TeamShape>(team: T, pokemonIds: number[]): T {
  const members = pokemonOf(team)
  return withMembers(team, pokemonIds.flatMap((id) => members.filter((each) => each.id === id)))
}

export function withName<T extends TeamShape>(team: T, name: string): T {
  return { ...team, name }
}
