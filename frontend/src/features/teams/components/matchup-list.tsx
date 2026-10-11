import type { Challenger, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { asMember } from '../utils/as-member'
import { matchupSentence } from '../utils/matchup-sentence'
import { bestAnswer } from '../utils/matchup-summary'
import { RatingChip } from './matchup-rating'
import { MemberThumb } from './member-thumb'

type MatchupListProps = {
  picks: Challenger[]
  // Their team, in battle order.
  members: TeamMember[]
  className?: string
}

/**
 * Each of their members in battle order, with our best pick against it: its rating, and the
 * matchup in a sentence. For where the table of every matchup doesn't fit.
 */
export function MatchupList({ picks, members, className }: MatchupListProps) {
  const ours = picks.map((pick, position) => asMember(pick.pokemon, position))
  return (
    <ul aria-label={m.team_counter_best_picks()} className={cn('flex flex-col gap-2', className)}>
      {members.map((member) => {
        const best = bestAnswer(picks, member.pokemon.id)
        const pick = best && ours.find((each) => each.pokemon.id === best.pokemon.id)
        return (
          <li key={member.pokemon.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-center gap-2">
              <MemberThumb member={member} className="size-8" />
              <h3 className="font-bold">
                {m.team_counter_versus({ name: displayName(member.pokemon.name) })}
              </h3>
            </div>
            {best && pick && (
              <div className="mt-3 flex items-start gap-3">
                <MemberThumb member={pick} className="size-12" />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{displayName(best.pokemon.name)}</span>{' '}
                    <RatingChip matchup={best.matchup} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {matchupSentence(best.pokemon, member.pokemon, best.matchup)}
                  </p>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
