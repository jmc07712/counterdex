import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import type { Team } from '@/api'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_SIZE } from '../utils/can-add'
import { EmptySlots, LeadSlot, PartySlots, TeamSlot } from './team-slots'

type TeamPartyProps = {
  team: Team
  onOpenPokemon: (pokemonId: number) => void
}

/** A team as its party: its lead large, beside the rest in battle order. Each opens its details. */
export function TeamParty({ team, onOpenPokemon }: TeamPartyProps) {
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
      <h1 className="text-4xl font-extrabold sm:text-5xl">{team.name}</h1>
      <p className="mt-2 mb-6 flex items-center gap-2 text-muted-foreground">
        <span>{m.team_by({ username: team.owner.username })}</span>
        <span aria-hidden="true" className="size-1 rounded-full bg-current" />
        <span className="tabular-nums">
          {m.team_member_count({ count: team.members.length, max: MAX_TEAM_SIZE })}
        </span>
      </p>
      <PartySlots>
        {lead && <LeadSlot member={lead} onOpen={() => onOpenPokemon(lead.pokemon.id)} />}
        {others.map((member) => (
          <TeamSlot
            key={member.pokemon.id}
            member={member}
            onOpen={() => onOpenPokemon(member.pokemon.id)}
          />
        ))}
        <EmptySlots filled={team.members.length} />
      </PartySlots>
      <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">{m.team_build_your_own_description()}</p>
        <Button asChild variant="outline" size="sm">
          <Link to={paths.home.getHref()}>{m.team_build_your_own()}</Link>
        </Button>
      </div>
    </>
  )
}
