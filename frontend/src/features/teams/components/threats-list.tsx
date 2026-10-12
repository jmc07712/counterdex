import { useId } from 'react'

import type { Challenger, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { asMember } from '../utils/as-member'
import { threatReason, threatWithoutWins } from '../utils/matchup-summary'
import { beats } from '../utils/weak-spots'
import { MemberThumb } from './member-thumb'

type ThreatsListProps = {
  // The biggest first, each with its matchups from its own side.
  threats: Challenger[]
  // The team's members, in battle order.
  members: TeamMember[]
  // Opens a threat's details.
  onOpenPokemon: (pokemonId: number) => void
  className?: string
}

/**
 * Each threat as a card with its types and the team's members it beats, for where the grid
 * doesn't fit. Each card opens the threat's details.
 */
export function ThreatsList({ threats, members, onOpenPokemon, className }: ThreatsListProps) {
  const captionId = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p id={captionId} className="px-1.5 text-sm text-muted-foreground">
        {m.team_threats_top({ count: threats.length })}
      </p>
      <ol aria-labelledby={captionId} className="flex flex-col gap-2">
        {threats.map((threat, position) => (
          <ThreatCard
            key={threat.pokemon.id}
            threat={threat}
            position={position}
            members={members}
            onOpen={() => onOpenPokemon(threat.pokemon.id)}
          />
        ))}
      </ol>
    </div>
  )
}

type ThreatCardProps = {
  threat: Challenger
  position: number
  members: TeamMember[]
  onOpen: () => void
}

// A threat's card, which all opens its details: named by its name, and described by the members
// it beats, or by what it does if it beats none.
function ThreatCard({ threat, position, members, onOpen }: ThreatCardProps) {
  const nameId = useId()
  const lineId = useId()
  const opponents = members.map((member) => member.pokemon)
  const beaten = members.filter((member) => beats(threat, member.pokemon))
  return (
    <li className="relative flex flex-col gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-foreground/30">
      <div className="flex items-center gap-3">
        <MemberThumb member={asMember(threat.pokemon, position)} className="size-12" />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h3 id={nameId} className="max-w-full truncate font-bold">
            {displayName(threat.pokemon.name)}
          </h3>
          <TypeBadges types={threat.pokemon.types} />
        </div>
      </div>
      {beaten.length > 0 ? (
        // The thumbs are decoration, so their names are read out instead.
        <p id={lineId} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span aria-hidden="true">{m.team_threat_beats()}</span>
          {beaten.map((member) => (
            <MemberThumb key={member.pokemon.id} member={member} className="size-8" />
          ))}
          <span className="sr-only">{threatReason(threat.matchups, opponents)}</span>
        </p>
      ) : (
        <p id={lineId} className="text-sm text-muted-foreground">
          {threatWithoutWins(threat.matchups)}
        </p>
      )}
      {/* Over the whole card, so all of it opens the threat's details. */}
      <button
        type="button"
        aria-labelledby={nameId}
        aria-describedby={lineId}
        onClick={onOpen}
        className="absolute -inset-px rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </li>
  )
}
