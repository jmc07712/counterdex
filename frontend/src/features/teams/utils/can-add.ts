import type { Pokemon, TeamMember } from '@/api'

export const MAX_TEAM_SIZE = 6

export type CantAdd = 'team_full' | 'species_on_team'

/** Why the Pokémon can't join these members, or null if it can. Matches the API's rules. */
export function cantAdd(members: TeamMember[], pokemon: Pokemon): CantAdd | null {
  const sameSpecies = members.some(
    (member) =>
      member.pokemon.id === pokemon.id ||
      (pokemon.species_id != null && member.pokemon.species_id === pokemon.species_id),
  )
  if (sameSpecies) return 'species_on_team'
  if (members.length >= MAX_TEAM_SIZE) return 'team_full'
  return null
}
