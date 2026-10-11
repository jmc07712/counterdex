import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Team } from '@/api'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

import { useTeam } from '../hooks/use-team'
import { useTeamEditor } from '../hooks/use-team-editor'
import { BackLink } from './back-link'
import { BuildYourOwnTeam } from './build-your-own-team'
import { CounterTeamButton } from './counter-team-button'
import { TeamBuilder } from './team-builder'
import { TeamMenu } from './team-menu'
import { TeamModeToggle } from './team-mode-toggle'
import { TeamParty } from './team-party'

type SavedTeamProps = {
  teamId: string
  // Its party, or its builder; only its owner gets the builder.
  mode: 'view' | 'edit'
  // Opens a member's details.
  onOpenPokemon: (pokemonId: number) => void
}

/**
 * A team, by id, as its party. Its owner can switch to editing it in the builder; everyone else
 * sees its party in either mode.
 */
export function SavedTeam({ teamId, mode, onOpenPokemon }: SavedTeamProps) {
  const team = useTeam(teamId)
  const currentUser = useCurrentUser()

  if (team.isPending || currentUser.isPending) return <Skeleton className="h-72 rounded-2xl" />

  if (team.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.team_load_failed()}</AlertTitle>
        <AlertDescription>{m.common_check_connection()}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void team.refetch()}>
            {m.common_try_again()}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (team.data === null) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{m.team_not_found_title()}</EmptyTitle>
          <EmptyDescription>{m.team_not_found_description()}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link to={paths.home.getHref()}>{m.team_go_to_teams()}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  // Signed out, or not sure who's signed in, counts as not the owner.
  const isOwner = currentUser.data?.username === team.data.owner.username
  if (!isOwner) {
    return (
      <>
        <TeamParty
          team={team.data}
          onOpenPokemon={onOpenPokemon}
          back={<BackLink to={paths.home.getHref()}>{m.teams_everyones()}</BackLink>}
          actions={team.data.members.length > 0 && <CounterTeamButton team={team.data} />}
        />
        <BuildYourOwnTeam />
      </>
    )
  }
  // The owner's way back is to their own teams, from either mode.
  const back = <BackLink to={paths.home.getHref({ scope: 'mine' })}>{m.teams_mine()}</BackLink>
  if (mode === 'edit') return <SavedTeamBuilder team={team.data} back={back} />
  return (
    <TeamParty
      team={team.data}
      onOpenPokemon={onOpenPokemon}
      back={back}
      actions={<OwnerActions team={team.data} />}
      emptySlotsTo={paths.teamEdit.getHref(team.data.id)}
      replaceTo={(pokemonId) => paths.teamEdit.getHref(teamId, { replace: pokemonId })}
    />
  )
}

function SavedTeamBuilder({ team, back }: { team: Team; back: ReactNode }) {
  const editor = useTeamEditor(team)
  return <TeamBuilder editor={editor} back={back} actions={<OwnerActions team={team} />} />
}

// The owner's View / Edit toggle and team menu.
function OwnerActions({ team }: { team: Team }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <TeamModeToggle teamId={team.id} />
      <TeamMenu team={team} />
    </div>
  )
}
