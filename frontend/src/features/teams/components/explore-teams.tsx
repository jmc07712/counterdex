import { Compass } from 'lucide-react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useExploreTeams } from '../hooks/use-explore-teams'
import { TeamCard } from './team-card'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/** Everyone's teams, each by its owner, with more a page at a time. */
export function ExploreTeams() {
  const teams = useExploreTeams()

  if (teams.isPending) {
    return (
      <ul aria-label={m.explore_loading()} className={GRID}>
        {[0, 1, 2].map((each) => (
          <li key={each}>
            <Skeleton className="h-36 rounded-2xl" />
          </li>
        ))}
      </ul>
    )
  }

  if (teams.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.explore_load_failed()}</AlertTitle>
        <AlertDescription>{m.common_check_connection()}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void teams.refetch()}>
            {m.common_try_again()}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const shown = teams.data.pages.flatMap((page) => page.items)

  if (shown.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass />
          </EmptyMedia>
          <EmptyTitle>{m.explore_empty_title()}</EmptyTitle>
          <EmptyDescription>{m.explore_empty_description()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <ul aria-label={m.explore_title()} className={GRID}>
        {shown.map((team) => (
          <li key={team.id}>
            <TeamCard
              to={paths.team.getHref(team.id)}
              name={team.name}
              members={team.members}
              note={m.team_by({ username: team.owner.username })}
            />
          </li>
        ))}
      </ul>
      {teams.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={teams.isFetchingNextPage}
            onClick={() => void teams.fetchNextPage()}
          >
            {teams.isFetchingNextPage ? m.common_loading_more() : m.common_load_more()}
          </Button>
        </div>
      )}
    </>
  )
}
