import { useId } from 'react'

import type { Challenger, Pokemon, Team } from '@/api'
import { ResultsStatus } from '@/components/lists/results-status'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import { useMatchupPool } from '../hooks/use-matchup-pool'
import { useTeamThreats } from '../hooks/use-team-threats'
import type { MatchupPool } from '../types'
import { asMember } from '../utils/as-member'
import { threatReason, threatsSummary } from '../utils/matchup-summary'
import {
  MatchupLoadFailed,
  MatchupNeedsSync,
  MatchupSection,
  MatchupSkeleton,
} from './matchup-section'
import { PickLine, PickName, PickTile } from './pick-tile'

type TeamThreatsProps = {
  team: Team
  // Opens a threat's details.
  onOpenPokemon: (pokemonId: number) => void
}

/**
 * The Pokémon that threaten your own team the most, each saying which of its members it beats.
 * Each opens its details.
 */
export function TeamThreats({ team, onOpenPokemon }: TeamThreatsProps) {
  const [pool, setPool] = useMatchupPool()
  return (
    <MatchupSection
      title={m.team_threats_title()}
      description={m.team_threats_description()}
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
        <MatchupNeedsSync>{m.team_threats_needs_sync()}</MatchupNeedsSync>
      </>
    )
  }

  return (
    <>
      {status}
      {/* The last threats stay, dimmed, while a toggle's load. */}
      <ol
        aria-label={m.team_threats_list()}
        aria-busy={threats.isPlaceholderData}
        className="grid grid-cols-1 gap-2 transition-opacity duration-200 aria-busy:opacity-60 @xl:grid-cols-2 @4xl:grid-cols-3"
      >
        {threats.data.map((threat, position) => (
          <ThreatTile
            key={threat.pokemon.id}
            threat={threat}
            position={position}
            members={members}
            onOpen={() => onOpenPokemon(threat.pokemon.id)}
          />
        ))}
      </ol>
    </>
  )
}

type ThreatTileProps = {
  threat: Challenger
  position: number
  members: Pokemon[]
  onOpen: () => void
}

// A threat's tile, which all opens its details: named by its name, and described by what it
// beats.
function ThreatTile({ threat, position, members, onOpen }: ThreatTileProps) {
  const nameId = useId()
  const lineId = useId()
  return (
    <PickTile member={asMember(threat.pokemon, position)}>
      <PickName id={nameId}>{displayName(threat.pokemon.name)}</PickName>
      <PickLine id={lineId}>{threatReason(threat.matchups, members)}</PickLine>
      <button
        type="button"
        aria-labelledby={nameId}
        aria-describedby={lineId}
        onClick={onOpen}
        className="absolute inset-0 rounded-[inherit] outline-none focus-visible:inset-ring-3 focus-visible:inset-ring-current"
      />
    </PickTile>
  )
}
