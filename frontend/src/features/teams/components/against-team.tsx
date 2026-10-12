import { ChevronDown, X } from 'lucide-react'
import { useId } from 'react'

import type { Challenger, Pokemon, TeamMember } from '@/api'
import { LoadFailedAlert } from '@/components/load-failed-alert'
import { displayName } from '@/components/pokemon/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { m } from '@/paraglide/messages.js'

import { useTeam } from '../hooks/use-team'
import { useTeamMatchups } from '../hooks/use-team-matchups'
import { asMember } from '../utils/as-member'
import { bestAnswer, coverage, pickReason } from '../utils/matchup-summary'
import { MatchupAnswer } from './matchup-answer'
import { MatchupButton } from './matchup-rating'
import { MatchupNeedsSync, MatchupResults } from './matchup-section'
import { MemberThumb } from './member-thumb'

type AgainstTeamProps = {
  // Our team's members, as they are now.
  members: TeamMember[]
  // The team to match them up against.
  teamId: string
  // Whether the picks and best answers start shown rather than folded away.
  defaultOpen: boolean
  onStop: () => void
}

/**
 * How our team matches up against another as it's edited: their team, whether each of theirs has
 * a good answer, why each of ours is there, and our best answer to each of theirs, which says why
 * in a sentence when it's pressed. Nothing shows for a team that doesn't exist or has no Pokémon,
 * and a box with Try again if their team couldn't load.
 */
export function AgainstTeam({ members, teamId, defaultOpen, onStop }: AgainstTeamProps) {
  const theirs = useTeam(teamId)
  const headingId = useId()
  if (theirs.isError) {
    return (
      <div className="mt-6">
        <LoadFailedAlert
          title={m.team_against_team_load_failed()}
          onRetry={() => void theirs.refetch()}
        />
      </div>
    )
  }
  if (!theirs.data || theirs.data.members.length === 0) return null
  const { name } = theirs.data
  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 flex flex-col gap-3 rounded-2xl border bg-card p-4"
    >
      <div className="-mt-1 -mr-1 flex items-center gap-2">
        <h2 id={headingId} className="min-w-0 flex-1 truncate font-heading text-lg font-bold">
          {m.team_against_title({ team: name })}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.team_against_close({ team: name })}
          onClick={onStop}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <TheirTiles members={theirs.data.members} />
      <Matchups ours={members} theirs={theirs.data.members} defaultOpen={defaultOpen} />
    </section>
  )
}

function TheirTiles({ members }: { members: TeamMember[] }) {
  return (
    <ol aria-label={m.team_against_their_team()} className="flex gap-1.5">
      {members.map((member) => (
        <li key={member.pokemon.id}>
          <MemberThumb member={member} className="size-10" />
          <span className="sr-only">{displayName(member.pokemon.name)}</span>
        </li>
      ))}
    </ol>
  )
}

type MatchupsProps = { ours: TeamMember[]; theirs: TeamMember[]; defaultOpen: boolean }

function Matchups({ ours, theirs, defaultOpen }: MatchupsProps) {
  const query = useTeamMatchups(ours, theirs)
  const opponents = theirs.map((member) => member.pokemon)
  return (
    <MatchupAnswer
      query={query}
      // What the team covers, each time its matchups load.
      summary={(matchups) => coverage(matchups.members, opponents)}
      loading={
        <Skeleton role="group" aria-label={m.team_against_loading()} className="h-14 rounded-xl" />
      }
      loadFailed={m.team_against_load_failed()}
      needsSync={<MatchupNeedsSync>{m.team_against_needs_sync()}</MatchupNeedsSync>}
      empty={
        ours.length === 0 && (
          <p className="text-sm text-muted-foreground">{m.team_against_empty()}</p>
        )
      }
    >
      {({ members: picks }) => (
        <MatchupResults busy={query.isPlaceholderData} className="flex flex-col gap-3">
          <p className="font-medium">{coverage(picks, opponents)}</p>
          <details open={defaultOpen} className="group/details">
            <summary
              className="-mx-1 flex cursor-pointer list-none items-center gap-1 rounded-md px-1 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
            >
              {m.team_against_details()}
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-open/details:rotate-180"
              />
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <OurPicks picks={picks} ours={ours} opponents={opponents} />
              <BestAnswers picks={picks} theirs={theirs} />
            </div>
          </details>
        </MatchupResults>
      )}
    </MatchupAnswer>
  )
}

type OurPicksProps = { picks: Challenger[]; ours: TeamMember[]; opponents: Pokemon[] }

// Each of ours in battle order, with why it's there.
function OurPicks({ picks, ours, opponents }: OurPicksProps) {
  const headingId = useId()
  return (
    <div className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        {m.team_against_picks()}
      </h3>
      <ol aria-labelledby={headingId} className="flex flex-col gap-2">
        {picks.map((pick, position) => (
          <li key={pick.pokemon.id} className="flex items-center gap-3">
            <MemberThumb
              // As it is on the team, muted if it's been removed from the Pokédex.
              member={
                ours.find((member) => member.pokemon.id === pick.pokemon.id) ??
                asMember(pick.pokemon, position)
              }
              className="size-9"
            />
            <div className="min-w-0">
              <p className="truncate font-bold">{displayName(pick.pokemon.name)}</p>
              <p className="text-sm leading-snug text-muted-foreground">
                {pickReason(pick.matchups, opponents)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

type BestAnswersProps = { picks: Challenger[]; theirs: TeamMember[] }

// Each of theirs in battle order, with our best answer to it, which explains itself when pressed.
function BestAnswers({ picks, theirs }: BestAnswersProps) {
  const headingId = useId()
  return (
    <div className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        {m.team_against_answers()}
      </h3>
      <ol aria-labelledby={headingId} className="flex flex-col gap-2">
        {theirs.map((member) => {
          const best = bestAnswer(picks, member.pokemon.id)
          return (
            <li key={member.pokemon.id} className="flex items-center gap-3">
              <MemberThumb member={member} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {m.team_counter_versus({ name: displayName(member.pokemon.name) })}
                </p>
                {best && (
                  <p className="truncate text-sm text-muted-foreground">
                    {m.team_against_answer({ name: displayName(best.pokemon.name) })}
                  </p>
                )}
              </div>
              {best && (
                <div className="w-20 shrink-0">
                  <MatchupButton
                    pokemon={best.pokemon}
                    opponent={member.pokemon}
                    matchup={best.matchup}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
