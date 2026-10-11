import type { TeamMember } from '@/api'
import { MAX_STAT_TOTAL, statTotal } from '@/components/pokemon/format'

import { MAX_TEAM_SIZE } from './can-add'

/** The power a team's bar measures against: six Pokémon at MAX_STAT_TOTAL. */
export const MAX_TEAM_POWER = MAX_TEAM_SIZE * MAX_STAT_TOTAL

/** A team's power: the sum of its members' base stat totals. */
export function teamPower(members: TeamMember[]): number {
  return members.reduce((power, member) => power + statTotal(member.pokemon.stats), 0)
}
