import type { Challenger, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { asMember } from '../utils/as-member'
import { MatchupButton } from './matchup-rating'
import { MemberThumb } from './member-thumb'

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
    <table className={cn('w-full table-fixed border-separate border-spacing-1.5', className)}>
      <caption className="mb-1 caption-top px-1.5 text-left text-sm text-muted-foreground">
        {m.team_counter_matchups()}
      </caption>
      <thead>
        <tr>
          <th scope="col" className="w-40 @4xl:w-52">
            <span className="sr-only">{m.team_counter_our_pick()}</span>
          </th>
          {members.map((member) => (
            <th key={member.pokemon.id} scope="col" className="px-1 align-bottom">
              <span className="flex flex-col items-center gap-1">
                <MemberThumb member={member} className="size-12" />
                <span className="text-xs leading-tight font-semibold break-words">
                  {displayName(member.pokemon.name)}
                </span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {picks.map((pick, position) => (
          <tr key={pick.pokemon.id}>
            <th scope="row" className="text-left font-normal">
              <span className="flex items-center gap-2">
                <MemberThumb member={asMember(pick.pokemon, position)} className="size-10" />
                <span className="min-w-0 font-semibold break-words">
                  {displayName(pick.pokemon.name)}
                </span>
              </span>
            </th>
            {members.map((member) => {
              const matchup = pick.matchups.find(
                (each) => each.opponent_id === member.pokemon.id,
              )
              return (
                <td key={member.pokemon.id}>
                  {matchup && (
                    <MatchupButton
                      pokemon={pick.pokemon}
                      opponent={member.pokemon}
                      matchup={matchup}
                    />
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
