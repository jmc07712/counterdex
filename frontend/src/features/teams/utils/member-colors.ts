import type { TeamMember } from '@/api'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'

/**
 * The colors a member is painted in: its main type's background and the text color that reads on
 * it. Null once it's no longer in the Pokédex, when it's painted in MUTED instead.
 */
export function memberColors(member: TeamMember) {
  return member.removed_at ? null : TYPE_STYLES[member.pokemon.types[0]]
}

/** A member no longer in the Pokédex, as its panel or tile: muted, and its text too. */
export const MUTED = 'bg-muted text-muted-foreground'

/** A member no longer in the Pokédex, as its segment of the power bar, on the bar's muted track. */
export const MUTED_SEGMENT = 'bg-muted-foreground/50'
