import { Compass, SearchX, UsersRound } from 'lucide-react'

import { DealtInItem } from '@/components/lists/dealt-in-item'
import { LoadMore } from '@/components/lists/load-more'
import { ResultsStatus } from '@/components/lists/results-status'
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
import { useDebouncedSearch } from '@/hooks/use-debounced-search'
import { useCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { isFiltered, type TeamsFilters, type TeamsView } from '../hooks/use-teams-filters'
import { useTeamsList } from '../hooks/use-teams-list'
import { CounterTeamButton } from './counter-team-button'
import { NewTeamButton } from './new-team-button'
import { TeamCard } from './team-card'

// On phones, one column as wide as the page, however long a team's name.
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

type TeamsGridProps = {
  filters: TeamsFilters
  // The trainer whose teams to show, empty ones too, or no one for everyone's.
  owner: string | undefined
  onClearFilters: () => void
  onShowEveryone: () => void
}

/** The teams that match `filters`, with more a page at a time. */
export function TeamsGrid({ filters, owner, onClearFilters, onShowEveryone }: TeamsGridProps) {
  const search = useDebouncedSearch(filters.search)
  const teams = useTeamsList({ ...filters, search }, owner)
  const signedInAs = useCurrentUser().data?.username

  // The status comes first in each case below, from the first load on, so it stays the same
  // element as they change: a status that appears with words in it often isn't read out.
  if (teams.isPending) {
    return (
      <>
        <ResultsStatus settled={false} />
        <ul aria-label={m.teams_loading()} className={GRID}>
          {[0, 1, 2].map((each) => (
            <li key={each}>
              {/* As tall as a card with one row of types, which in everyone's teams says whose
                  it is on a line of its own. */}
              <Skeleton className={cn('rounded-2xl', owner === undefined ? 'h-57' : 'h-51')} />
            </li>
          ))}
        </ul>
      </>
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

  const { pages } = teams.data
  const shown = pages.reduce((count, page) => count + page.items.length, 0)
  const settled = !teams.isPlaceholderData

  if (shown === 0) {
    if (isFiltered({ ...filters, search })) {
      return (
        <>
          <ResultsStatus settled={settled}>
            {m.teams_nothing_found_title({ view: filters.view })}
          </ResultsStatus>
          <NoTeamsMatch view={filters.view} onClearFilters={onClearFilters} />
        </>
      )
    }
    return (
      <>
        <ResultsStatus settled={settled}>{m.teams_empty_title()}</ResultsStatus>
        {owner === undefined ? (
          <NoTeamsYet />
        ) : (
          <NoTeamsOfYourOwn onShowEveryone={onShowEveryone} />
        )}
      </>
    )
  }

  return (
    <>
      <ResultsStatus settled={settled}>
        {teams.hasNextPage ? m.teams_shown_more({ count: shown }) : m.teams_shown({ count: shown })}
      </ResultsStatus>
      <ul
        aria-label={owner === undefined ? m.teams_everyones() : m.teams_mine()}
        aria-busy={teams.isPlaceholderData}
        className={`${GRID} transition-opacity duration-200 aria-busy:opacity-60`}
      >
        {pages.flatMap((page) =>
          page.items.map((team, index) => (
            <DealtInItem key={team.id} index={index}>
              <TeamCard
                to={paths.team.getHref(team.id)}
                name={team.name}
                members={team.members}
                // Everyone's teams say whose each is; your own don't need to.
                note={owner === undefined ? m.team_by({ username: team.owner.username }) : undefined}
                // Someone else's, with Pokémon to counter.
                action={
                  team.owner.username !== signedInAs &&
                  team.members.length > 0 && <CounterTeamButton team={team} />
                }
              />
            </DealtInItem>
          )),
        )}
      </ul>
      {teams.hasNextPage && (
        <LoadMore
          loading={teams.isFetchingNextPage}
          onLoadMore={() => void teams.fetchNextPage()}
        />
      )}
    </>
  )
}

function NoTeamsYet() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Compass />
        </EmptyMedia>
        <EmptyTitle>{m.teams_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.teams_empty_description({ scope: 'everyone' })}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function NoTeamsOfYourOwn({ onShowEveryone }: { onShowEveryone: () => void }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersRound />
        </EmptyMedia>
        <EmptyTitle>{m.teams_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.teams_empty_description({ scope: 'mine' })}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        <NewTeamButton teamCount={0} />
        <Button variant="outline" onClick={onShowEveryone}>
          {m.teams_browse_everyone()}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function NoTeamsMatch({ view, onClearFilters }: { view: TeamsView; onClearFilters: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{m.teams_nothing_found_title({ view })}</EmptyTitle>
        <EmptyDescription>{m.teams_nothing_found_description({ view })}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClearFilters}>
          {m.common_clear_filters()}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
