import type { ReactNode } from 'react'

import type { Challenger, Pokemon, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { asMember } from '../utils/as-member'
import { pickReason } from '../utils/matchup-summary'
import { memberColors, MUTED } from '../utils/member-colors'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'

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
        <PickTile
          key={pick.pokemon.id}
          member={asMember(pick.pokemon, position)}
          reason={pickReason(pick.matchups, opponents)}
        >
          {position === 0 && theirLead && (
            <LeadNote>{m.team_counter_leads_against({ name: displayName(theirLead.name) })}</LeadNote>
          )}
        </PickTile>
      ))}
    </ol>
  )
}

type PickTileProps = {
  member: TeamMember
  reason: string | null
  // Above its name, such as a LeadNote.
  children?: ReactNode
}

// A pick's tile: its slot number, its sprite in front of its ghosted Poké Ball, its name, and why
// it's on the team.
function PickTile({ member, reason, children }: PickTileProps) {
  const colors = memberColors(member)
  return (
    <li
      style={{ backgroundColor: colors?.background, color: colors?.foreground }}
      className={cn(
        'group/hop relative isolate flex items-center gap-3 overflow-hidden rounded-2xl py-2 pr-3 pl-4',
        !colors && MUTED,
      )}
    >
      <span className="w-4 shrink-0 text-sm font-medium tabular-nums">{member.position + 1}</span>
      <span className="relative isolate grid size-16 shrink-0 place-items-center">
        <MemberBall member={member} className="absolute -inset-[8%] -z-10" />
        <MemberSprite member={member} className="scale-150" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        {children}
        <h3 className="max-w-full truncate text-lg font-extrabold">
          {displayName(member.pokemon.name)}
        </h3>
        {reason && <p className="text-sm leading-snug">{reason}</p>}
      </div>
    </li>
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
