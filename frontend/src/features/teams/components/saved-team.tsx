import { SearchX } from 'lucide-react'
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
import { TeamBuilder } from './team-builder'
import { TeamMenu } from './team-menu'
import { TeamParty } from './team-party'

type SavedTeamProps = {
  teamId: string
  // Opens a member's details.
  onOpenPokemon: (pokemonId: number) => void
}

/** A team, by id: in the builder for its owner, and as its party for everyone else. */
export function SavedTeam({ teamId, onOpenPokemon }: SavedTeamProps) {
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
            <Link to={paths.home.getHref()}>{m.team_all_teams()}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  // Signed out, or not sure who's signed in, counts as not the owner.
  const isOwner = currentUser.data?.username === team.data.owner.username
  if (isOwner) return <SavedTeamBuilder team={team.data} />
  return <TeamParty team={team.data} onOpenPokemon={onOpenPokemon} />
}

function SavedTeamBuilder({ team }: { team: Team }) {
  const editor = useTeamEditor(team)
  return <TeamBuilder editor={editor} actions={<TeamMenu team={team} />} />
}
