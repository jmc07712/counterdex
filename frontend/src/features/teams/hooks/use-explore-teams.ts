import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import type { ListTeamsData } from '@/api'
import { listTeamsInfiniteOptions } from '@/api/@tanstack/react-query.gen'
import { MAX_SEARCH_LENGTH } from '@/lib/search-params'

import type { ExploreFilters } from './use-explore-filters'

type TeamsQuery = NonNullable<ListTeamsData['query']>

// Only the filters in use, so the unfiltered list always requests the same URL. The API rejects
// an empty search, and one longer than it takes, as a hand-edited URL can have.
function toQuery({ search, types, view }: ExploreFilters): TeamsQuery {
  return {
    q: search.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    type: types.length > 0 ? types : undefined,
    changed: view === 'changed' ? true : undefined,
  }
}

/** Everyone's teams that have a Pokémon and match `filters`, newest first, a page at a time. */
export function useExploreTeams(filters: ExploreFilters) {
  return useInfiniteQuery({
    ...listTeamsInfiniteOptions({ query: toQuery(filters) }),
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    // Keep showing the current teams while a changed filter loads, instead of a skeleton.
    placeholderData: keepPreviousData,
  })
}
