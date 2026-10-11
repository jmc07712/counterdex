import type { PokemonType, TeamMember } from '@/api'

/** Each type on the team once, in battle order: the lead's types first. */
export function teamTypes(members: TeamMember[]): PokemonType[] {
  return [...new Set(members.flatMap((member) => member.pokemon.types))]
}
