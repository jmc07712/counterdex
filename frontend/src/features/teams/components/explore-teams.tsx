import { Compass, SearchX } from 'lucide-react'

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
import { m } from '@/paraglide/messages.js'

import type { ExploreFilters, ExploreView } from '../hooks/use-explore-filters'
import { useExploreTeams } from '../hooks/use-explore-teams'
import { TeamCard } from './team-card'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

type ExploreTeamsProps = {
  filters: ExploreFilters
  onClearFilters: () => void
}

/** Everyone's teams that match `filters`, each by its owner, with more a page at a time. */
export function ExploreTeams({ filters, onClearFilters }: ExploreTeamsProps) {
  const search = useDebouncedSearch(filters.search)
  const teams = useExploreTeams({ ...filters, search })

  if (teams.isPending) {
    return (
      <ul aria-label={m.explore_loading()} className={GRID}>
        {[0, 1, 2].map((each) => (
          <li key={each}>
            {/* As tall as a card with one row of types. */}
            <Skeleton className="h-57 rounded-2xl" />
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

  const { pages } = teams.data
  const shown = pages.reduce((count, page) => count + page.items.length, 0)
  // The status comes first in each case below, so it stays the same element as they change.
  const settled = !teams.isPlaceholderData

  if (shown === 0) {
    const filtered = search !== '' || filters.types.length > 0 || filters.view !== 'all'
    return filtered ? (
      <>
        <ResultsStatus settled={settled}>
          {m.explore_nothing_found_title({ view: filters.view })}
        </ResultsStatus>
        <NoTeamsMatch view={filters.view} onClearFilters={onClearFilters} />
      </>
    ) : (
      <>
        <ResultsStatus settled={settled}>{m.explore_empty_title()}</ResultsStatus>
        <NoTeamsYet />
      </>
    )
  }

  return (
    <>
      <ResultsStatus settled={settled}>
        {teams.hasNextPage
          ? m.explore_shown_more({ count: shown })
          : m.explore_shown({ count: shown })}
      </ResultsStatus>
      <ul
        aria-label={m.explore_title()}
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
                note={m.team_by({ username: team.owner.username })}
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
        <EmptyTitle>{m.explore_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.explore_empty_description()}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function NoTeamsMatch({ view, onClearFilters }: { view: ExploreView; onClearFilters: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{m.explore_nothing_found_title({ view })}</EmptyTitle>
        <EmptyDescription>{m.explore_nothing_found_description({ view })}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClearFilters}>
          {m.common_clear_filters()}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
