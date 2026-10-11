import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import type { Team } from '@/api'
import { Button } from '@/components/ui/button'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { EmptySlots, TeamSlot, TeamSlots } from './team-slots'

/** Someone else's team, as it is: its name, its owner and its six slots. */
export function ReadOnlyTeam({ team }: { team: Team }) {
  return (
    <div className="max-w-2xl">
      <Link
        to={paths.home.getHref()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {m.team_all_teams()}
      </Link>
      <h1 className="text-3xl font-bold sm:text-4xl">{team.name}</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        {m.team_by({ username: team.owner.username })}
      </p>
      <TeamSlots>
        {team.members.map((member) => (
          <TeamSlot key={member.pokemon.id} member={member} />
        ))}
        <EmptySlots filled={team.members.length} />
      </TeamSlots>
      <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{m.team_build_your_own_description()}</p>
        <Button asChild>
          <Link to={paths.home.getHref()}>{m.team_build_your_own()}</Link>
        </Button>
      </div>
    </div>
  )
}
