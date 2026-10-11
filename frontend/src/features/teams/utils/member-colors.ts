import type { TeamMember } from '@/api'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'

/**
 * The colors a member is painted in: its main type's background and the text color that reads on
 * it. Null once it's no longer in the Pokédex, when it's shown muted instead.
 */
export function memberColors(member: TeamMember) {
  return member.removed_at ? null : TYPE_STYLES[member.pokemon.types[0]]
}
