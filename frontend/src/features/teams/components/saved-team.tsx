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
import { ReadOnlyTeam } from './read-only-team'
import { TeamBuilder } from './team-builder'
import { TeamMenu } from './team-menu'

/** A team, by id: in the builder for its owner, and as it is for everyone else. */
export function SavedTeam({ teamId }: { teamId: string }) {
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
  return isOwner ? <SavedTeamBuilder team={team.data} /> : <ReadOnlyTeam team={team.data} />
}

function SavedTeamBuilder({ team }: { team: Team }) {
  const editor = useTeamEditor(team)
  return <TeamBuilder editor={editor} actions={<TeamMenu team={team} />} />
}
