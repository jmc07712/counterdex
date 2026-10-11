import type { ReactNode } from 'react'

import type { Team } from '@/api'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { TeamPower } from './team-power'
import { EmptySlots, LeadSlot, PartySlots, ReplaceLink, TeamSlot } from './team-slots'

type TeamPartyProps = {
  team: Team
  onOpenPokemon: (pokemonId: number) => void
  // Above the name, a BackLink.
  back: ReactNode
  // Beside the name, such as the owner's View / Edit toggle.
  actions?: ReactNode
  // Where the empty slots link to be filled; without it, they don't link.
  emptySlotsTo?: string
  // Where a member removed from the Pokédex links to be replaced; without it, there's no link.
  replaceTo?: (pokemonId: number) => string
}

/** A team as its party: its lead large, beside the rest in battle order. Each opens its details. */
export function TeamParty({
  team,
  onOpenPokemon,
  back,
  actions,
  emptySlotsTo,
  replaceTo,
}: TeamPartyProps) {
  const [lead, ...others] = team.members
  return (
    <>
      {back}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-extrabold break-words sm:text-5xl">{team.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="flex items-center gap-2 text-muted-foreground">
              <span>{m.team_by({ username: team.owner.username })}</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-current" />
              <span className="tabular-nums">
                {m.team_member_count({ count: team.members.length, max: MAX_TEAM_SIZE })}
              </span>
            </p>
            <TeamPower members={team.members} className="w-full max-w-xs" />
          </div>
        </div>
        {actions}
      </div>
      <PartySlots>
        {lead && (
          <LeadSlot member={lead} onOpen={() => onOpenPokemon(lead.pokemon.id)}>
            {replaceTo && lead.removed_at && (
              <ReplaceLink member={lead} to={replaceTo(lead.pokemon.id)} />
            )}
          </LeadSlot>
        )}
        {others.map((member) => (
          <TeamSlot
            key={member.pokemon.id}
            member={member}
            onOpen={() => onOpenPokemon(member.pokemon.id)}
          >
            {replaceTo && member.removed_at && (
              <ReplaceLink member={member} to={replaceTo(member.pokemon.id)} />
            )}
          </TeamSlot>
        ))}
        <EmptySlots filled={team.members.length} to={emptySlotsTo} />
      </PartySlots>
    </>
  )
}
