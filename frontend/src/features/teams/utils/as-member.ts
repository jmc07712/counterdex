import type { Pokemon, TeamMember } from '@/api'

/**
 * A Pokémon picked for a team, such as a counter's pick, as the member it would be at `position`.
 * The API picks only Pokémon still in the Pokédex.
 */
export function asMember(pokemon: Pokemon, position: number): TeamMember {
  return { position, pokemon, removed_at: null }
}
