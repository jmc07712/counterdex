import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Team } from '@/api'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { EmptySlots, LeadSlot, PartySlots, TeamSlot } from './team-slots'

type TeamPartyProps = {
  team: Team
  onOpenPokemon: (pokemonId: number) => void
  // Beside the name, such as the owner's View / Edit toggle.
  actions?: ReactNode
  // Where the empty slots link to be filled; without it, they don't link.
  emptySlotsTo?: string
}

/** A team as its party: its lead large, beside the rest in battle order. Each opens its details. */
export function TeamParty({ team, onOpenPokemon, actions, emptySlotsTo }: TeamPartyProps) {
  const [lead, ...others] = team.members
  return (
    <>
      <Link
        to={paths.explore.getHref()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {m.team_explore_teams()}
      </Link>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-extrabold break-words sm:text-5xl">{team.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <span>{m.team_by({ username: team.owner.username })}</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-current" />
            <span className="tabular-nums">
              {m.team_member_count({ count: team.members.length, max: MAX_TEAM_SIZE })}
            </span>
          </p>
        </div>
        {actions}
      </div>
      <PartySlots>
        {lead && <LeadSlot member={lead} onOpen={() => onOpenPokemon(lead.pokemon.id)} />}
        {others.map((member) => (
          <TeamSlot
            key={member.pokemon.id}
            member={member}
            onOpen={() => onOpenPokemon(member.pokemon.id)}
          />
        ))}
        <EmptySlots filled={team.members.length} to={emptySlotsTo} />
      </PartySlots>
    </>
  )
}
