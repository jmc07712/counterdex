import type { Team } from '@/api'
import { m } from '@/paraglide/messages.js'

import { useCounterTeam } from '../hooks/use-counter-team'
import { useMatchupPool } from '../hooks/use-matchup-pool'
import type { MatchupPool } from '../types'
import { coverage } from '../utils/matchup-summary'
import { CounterPicks } from './counter-picks'
import { BuildThisCounter } from './counter-team-button'
import { MatchupAnswer } from './matchup-answer'
import { MatchupList } from './matchup-list'
import {
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
      howItWorks={{
        title: m.team_counter_how_title(),
        points: [
          m.team_counter_how_one_at_a_time(),
          m.team_counter_how_weaknesses(),
          m.team_counter_how_families(),
          m.team_counter_how_order(),
          m.team_counter_how_limits(),
        ],
      }}
      pool={pool}
      onPoolChange={setPool}
    >
      <CounterPlan team={team} pool={pool} />
    </MatchupSection>
  )
}

function CounterPlan({ team, pool }: { team: Team; pool: MatchupPool }) {
  const query = useCounterTeam(team.members, pool)
  const opponents = team.members.map((member) => member.pokemon)
  return (
    <MatchupAnswer
      query={query}
      // What each new counter covers.
      summary={(picks) => coverage(picks, opponents)}
      loading={<MatchupSkeleton label={m.team_counter_loading()} />}
      loadFailed={m.team_counter_load_failed()}
      needsSync={
        <MatchupResults busy={query.isPlaceholderData}>
          <MatchupNeedsSync>{m.team_counter_needs_sync()}</MatchupNeedsSync>
        </MatchupResults>
      }
    >
      {(picks) => (
        <MatchupResults busy={query.isPlaceholderData} className="flex flex-col gap-4">
          <p className="rounded-xl border bg-card px-4 py-3 font-medium">
            {coverage(picks, opponents)}
          </p>
          <CounterPicks picks={picks} opponents={opponents} />
          <div>
            <BuildThisCounter team={team} pool={pool} loading={query.isPlaceholderData} />
          </div>
          {/* The table where it fits, and on narrower screens the list. */}
          <MatchupTable picks={picks} members={team.members} className="mt-4 hidden @2xl:table" />
          <MatchupList picks={picks} members={team.members} className="mt-4 @2xl:hidden" />
        </MatchupResults>
      )}
    </MatchupAnswer>
  )
}
