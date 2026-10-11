import type { Team } from '@/api'
import { ResultsStatus } from '@/components/lists/results-status'
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
  MatchupResults,
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
  const opponents = team.members.map((member) => member.pokemon)
  // The first thing returned, from the first load on, so it stays the same element as the counter
  // changes. It reads out what each new counter covers once it has loaded.
  const status = (
    <ResultsStatus settled={!counter.isPlaceholderData}>
      {counter.data && coverage(counter.data, opponents)}
    </ResultsStatus>
  )

  if (counter.isPending) {
    return (
      <>
        {status}
        <MatchupSkeleton label={m.team_counter_loading()} />
      </>
    )
  }
  if (counter.isError) {
    return (
      <>
        {status}
        <MatchupLoadFailed
          title={m.team_counter_load_failed()}
          onRetry={() => void counter.refetch()}
        />
      </>
    )
  }
  if (counter.data === null) {
    return (
      <>
        {status}
        <MatchupResults busy={counter.isPlaceholderData}>
          <MatchupNeedsSync>{m.team_counter_needs_sync()}</MatchupNeedsSync>
        </MatchupResults>
      </>
    )
  }

  const picks = counter.data
  return (
    <>
      {status}
      <MatchupResults busy={counter.isPlaceholderData} className="flex flex-col gap-4">
        <p className="rounded-xl border bg-card px-4 py-3 font-medium">
          {coverage(picks, opponents)}
        </p>
        <CounterPicks picks={picks} opponents={opponents} />
        <div>
          <BuildThisCounter team={team} pool={pool} loading={counter.isPlaceholderData} />
        </div>
        {/* The table where it fits, and on narrower screens the list. */}
        <MatchupTable picks={picks} members={team.members} className="mt-4 hidden @2xl:table" />
        <MatchupList picks={picks} members={team.members} className="mt-4 @2xl:hidden" />
      </MatchupResults>
    </>
  )
}
