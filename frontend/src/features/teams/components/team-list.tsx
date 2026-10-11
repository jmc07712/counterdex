import { UsersRound } from 'lucide-react'

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

import { useUserTeams } from '../hooks/use-user-teams'
import { NewTeamButton } from './new-team-button'
import { TeamCard } from './team-card'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/** A user's teams. */
export function TeamList({ username }: { username: string }) {
  const teams = useUserTeams(username)

  if (teams.isPending) {
    return (
      <ul aria-label={m.teams_loading()} className={GRID}>
        {[0, 1, 2].map((each) => (
          <li key={each}>
            {/* As tall as a card with one row of types. */}
            <Skeleton className="h-51 rounded-2xl" />
          </li>
        ))}
      </ul>
    )
  }

  if (teams.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.teams_load_failed()}</AlertTitle>
        <AlertDescription>{m.common_check_connection()}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void teams.refetch()}>
            {m.common_try_again()}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (teams.data.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersRound />
          </EmptyMedia>
          <EmptyTitle>{m.teams_empty_title()}</EmptyTitle>
          <EmptyDescription>{m.teams_empty_description()}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <NewTeamButton teamCount={0} />
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ul aria-label={m.teams_title()} className={GRID}>
      {teams.data.map((team) => (
        <li key={team.id}>
          <TeamCard to={paths.team.getHref(team.id)} name={team.name} members={team.members} />
        </li>
      ))}
    </ul>
  )
}
