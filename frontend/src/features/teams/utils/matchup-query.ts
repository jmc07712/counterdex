import type { TeamMember } from '@/api'

import type { MatchupPool } from '../types'

/**
 * The API's query for how Pokémon from `pool` match up against a team with these members. Each of
 * the pool's options is sent only when it's on, as the API's default is off, so each answer has
 * one URL to be cached by.
 */
export function matchupQuery(members: TeamMember[], { forms, legendaries }: MatchupPool) {
  return {
    pokemon_id: members.map((member) => member.pokemon.id),
    forms: forms || undefined,
    legendaries: legendaries || undefined,
  }
}
