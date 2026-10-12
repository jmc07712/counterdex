import type { Challenger, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import { MatchupGrid } from './matchup-grid'
import { MatchupButton } from './matchup-rating'

type MatchupTableProps = {
  picks: Challenger[]
  // Their team, in battle order.
  members: TeamMember[]
  className?: string
}

/**
 * How each of our picks matches up against each of their members: their members as columns, our
 * picks as rows, both in battle order. Each matchup opens its sentence.
 */
export function MatchupTable({ picks, members, className }: MatchupTableProps) {
  return (
    <MatchupGrid
      caption={m.team_counter_matchups()}
      rowsName={m.team_counter_our_pick()}
      rows={picks}
      members={members}
      rowHeader={(pick) => (
        <span className="min-w-0 font-semibold break-words">{displayName(pick.pokemon.name)}</span>
      )}
      cell={(pick, member, matchup) => (
        <MatchupButton pokemon={pick.pokemon} opponent={member.pokemon} matchup={matchup} />
      )}
      className={className}
    />
  )
}
