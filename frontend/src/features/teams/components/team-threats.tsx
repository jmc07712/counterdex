import type { Team } from '@/api'
import { ResultsStatus } from '@/components/lists/results-status'
import { m } from '@/paraglide/messages.js'

import { useMatchupPool } from '../hooks/use-matchup-pool'
import { useTeamThreats } from '../hooks/use-team-threats'
import type { MatchupPool } from '../types'
import { threatsSummary, weakSpotsLine } from '../utils/matchup-summary'
import { weakSpots } from '../utils/weak-spots'
import {
  MatchupLoadFailed,
  MatchupNeedsSync,
  MatchupResults,
  MatchupSection,
  MatchupSkeleton,
} from './matchup-section'
import { ThreatsGrid } from './threats-grid'
import { ThreatsList } from './threats-list'

type TeamThreatsProps = {
  team: Team
  // Opens a threat's details.
  onOpenPokemon: (pokemonId: number) => void
}

/**
 * The Pokémon that threaten your own team the most: where the team is weak to them, then each
 * threat against each member. Each threat opens its details.
 */
export function TeamThreats({ team, onOpenPokemon }: TeamThreatsProps) {
  const [pool, setPool] = useMatchupPool()
  return (
    <MatchupSection
      title={m.team_threats_title()}
      description={m.team_threats_description()}
      howItWorks={{
        title: m.team_threats_how_title(),
        points: [
          m.team_threats_how_score(),
          m.team_threats_how_top(),
          m.team_threats_how_families(),
          m.team_threats_how_weak_spots(),
        ],
      }}
      pool={pool}
      onPoolChange={setPool}
    >
      <Threats team={team} pool={pool} onOpenPokemon={onOpenPokemon} />
    </MatchupSection>
  )
}

function Threats({ team, pool, onOpenPokemon }: TeamThreatsProps & { pool: MatchupPool }) {
  const threats = useTeamThreats(team.members, pool)
  const members = team.members.map((member) => member.pokemon)
  // The first thing returned, from the first load on, so it stays the same element as the threats
  // change. It reads out how many there are, and the biggest, once they've loaded.
  const status = (
    <ResultsStatus settled={!threats.isPlaceholderData}>
      {threats.data && threatsSummary(threats.data, members)}
    </ResultsStatus>
  )

  if (threats.isPending) {
    return (
      <>
        {status}
        <MatchupSkeleton label={m.team_threats_loading()} />
      </>
    )
  }
  if (threats.isError) {
    return (
      <>
        {status}
        <MatchupLoadFailed
          title={m.team_threats_load_failed()}
          onRetry={() => void threats.refetch()}
        />
      </>
    )
  }
  if (threats.data === null) {
    return (
      <>
        {status}
        <MatchupResults busy={threats.isPlaceholderData}>
          <MatchupNeedsSync>{m.team_threats_needs_sync()}</MatchupNeedsSync>
        </MatchupResults>
      </>
    )
  }

  return (
    <>
      {status}
      <MatchupResults busy={threats.isPlaceholderData} className="flex flex-col gap-4">
        <p className="rounded-xl border bg-card px-4 py-3 font-medium">
          {weakSpotsLine(weakSpots(threats.data, members))}
        </p>
        {/* The grid where it fits, and on narrower screens the list. */}
        <ThreatsGrid
          threats={threats.data}
          members={team.members}
          onOpenPokemon={onOpenPokemon}
          className="hidden @2xl:table"
        />
        <ThreatsList
          threats={threats.data}
          members={team.members}
          onOpenPokemon={onOpenPokemon}
          className="@2xl:hidden"
        />
      </MatchupResults>
    </>
  )
}
