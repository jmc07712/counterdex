import type { Team } from '@/api'
import { m } from '@/paraglide/messages.js'

import { useCounterTeam } from '../hooks/use-counter-team'
import { useMatchupPool } from '../hooks/use-matchup-pool'
import type { MatchupPool } from '../types'
import { coverage } from '../utils/matchup-summary'
import { CounterPicks } from './counter-picks'
import { BuildThisCounter } from './counter-team-button'
import { MatchupList } from './matchup-list'
import {
  MatchupLoadFailed,
  MatchupNeedsSync,
  MatchupSection,
  MatchupSkeleton,
} from './matchup-section'
import { MatchupTable } from './matchup-table'

/**
 * How to beat someone else's team: a counter to it, with why each pick is there, how each
 * matches up against each of theirs, and a button to build it as a team of your own.
 */
export function HowToBeatTeam({ team }: { team: Team }) {
  const [pool, setPool] = useMatchupPool()
  return (
    <MatchupSection
      title={m.team_counter_title()}
      description={m.team_counter_description()}
      pool={pool}
      onPoolChange={setPool}
    >
      <CounterPlan team={team} pool={pool} />
    </MatchupSection>
  )
}

function CounterPlan({ team, pool }: { team: Team; pool: MatchupPool }) {
  const counter = useCounterTeam(team.members, pool)

  if (counter.isPending) return <MatchupSkeleton label={m.team_counter_loading()} />
  if (counter.isError) {
    return (
      <MatchupLoadFailed
        title={m.team_counter_load_failed()}
        onRetry={() => void counter.refetch()}
      />
    )
  }
  if (counter.data === null) return <MatchupNeedsSync>{m.team_counter_needs_sync()}</MatchupNeedsSync>

  const picks = counter.data
  const opponents = team.members.map((member) => member.pokemon)
  return (
    <>
      <p className="rounded-xl border bg-card px-4 py-3 font-medium">
        {coverage(picks, opponents)}
      </p>
      <CounterPicks picks={picks} opponents={opponents} />
      <div>
        <BuildThisCounter team={team} pool={pool} />
      </div>
      {/* The table where it fits, and on narrower screens the list. */}
      <MatchupTable picks={picks} members={team.members} className="mt-4 hidden @2xl:table" />
      <MatchupList picks={picks} members={team.members} className="mt-4 @2xl:hidden" />
    </>
  )
}
