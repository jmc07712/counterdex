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
import { m } from '@/paraglide/messages.js'

import { useTeam } from '../hooks/use-team'
import { useTeamChanges } from '../hooks/use-team-changes'
import { TeamBuilder } from './team-builder'
import { TeamMenu } from './team-menu'

/** One of the signed-in user's teams, by id, in the builder. */
export function SavedTeam({ teamId }: { teamId: string }) {
  const team = useTeam(teamId)

  if (team.isPending) return <Skeleton className="h-72 rounded-2xl" />

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

  return <SavedTeamBuilder team={team.data} />
}

function SavedTeamBuilder({ team }: { team: Team }) {
  const change = useTeamChanges(team.id)
  return <TeamBuilder editor={{ team, change }} actions={<TeamMenu team={team} />} />
}
