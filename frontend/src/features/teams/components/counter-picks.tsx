import type { Challenger, Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

import { asMember } from '../utils/as-member'
import { pickReason } from '../utils/matchup-summary'
import { PickLine, PickName, PickTile } from './pick-tile'

type CounterPicksProps = {
  picks: Challenger[]
  // Their team's Pokémon, in battle order.
  opponents: Pokemon[]
}

/**
 * A counter's picks in battle order, each as a tile in its main type's color with why it's
 * there. The first leads against their lead.
 */
export function CounterPicks({ picks, opponents }: CounterPicksProps) {
  const [theirLead] = opponents
  return (
    <ol
      aria-label={m.team_counter_picks()}
      className="grid grid-cols-1 gap-2 @xl:grid-cols-2 @4xl:grid-cols-3"
    >
      {picks.map((pick, position) => (
        <PickTile key={pick.pokemon.id} member={asMember(pick.pokemon, position)}>
          {position === 0 && theirLead && (
            <LeadNote>{m.team_counter_leads_against({ name: displayName(theirLead.name) })}</LeadNote>
          )}
          <PickName>{displayName(pick.pokemon.name)}</PickName>
          <PickLine>{pickReason(pick.matchups, opponents)}</PickLine>
        </PickTile>
      ))}
    </ol>
  )
}

// A note on a pick's tile, drawn in the tile's text color.
function LeadNote({ children }: { children: string }) {
  return (
    <p className="mb-0.5 rounded-full border border-current px-2 py-0.5 text-xs font-bold">
      {children}
    </p>
  )
}
