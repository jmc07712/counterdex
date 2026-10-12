import type { Challenger, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { m } from '@/paraglide/messages.js'

import { turnedAround } from '../utils/turned-around'
import { MatchupGrid } from './matchup-grid'
import { MatchupButton } from './matchup-rating'

type ThreatsGridProps = {
  // The biggest first, each with its matchups from its own side.
  threats: Challenger[]
  // The team's members, in battle order.
  members: TeamMember[]
  // Opens a threat's details.
  onOpenPokemon: (pokemonId: number) => void
  className?: string
}

/**
 * Each threat against each of the team's members, rated from the member's side, as the counter's
 * table rates ours: a member's column of bad matchups is a weak spot. Each matchup opens its
 * sentence, and each threat's name its details.
 */
export function ThreatsGrid({ threats, members, onOpenPokemon, className }: ThreatsGridProps) {
  return (
    <MatchupGrid
      caption={m.team_threats_grid_caption({ count: threats.length })}
      rowsName={m.team_threats_threat()}
      rows={threats}
      members={members}
      rowHeader={(threat) => (
        <span className="flex min-w-0 flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => onOpenPokemon(threat.pokemon.id)}
            className="max-w-full rounded-sm text-left font-semibold break-words underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {displayName(threat.pokemon.name)}
          </button>
          <TypeBadges types={threat.pokemon.types} />
        </span>
      )}
      cell={(threat, member, matchup) => (
        <MatchupButton
          pokemon={member.pokemon}
          opponent={threat.pokemon}
          matchup={turnedAround(matchup, threat.pokemon.id)}
        />
      )}
      className={className}
    />
  )
}
