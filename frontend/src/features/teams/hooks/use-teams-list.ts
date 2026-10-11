import { useInfiniteQuery } from '@tanstack/react-query'

import { type ListTeamsData, TeamSort } from '@/api'
import { listTeamsInfiniteOptions } from '@/api/@tanstack/react-query.gen'
import { MAX_SEARCH_LENGTH } from '@/lib/search-params'

import type { TeamsFilters } from './use-teams-filters'

type TeamsQuery = NonNullable<ListTeamsData['query']>

// Only the filters in use, so an unfiltered list always requests the same URL. The API rejects
// an empty search, and one longer than it takes, as a hand-edited URL can have. Without a sort,
// the API lists the newest first.
function toQuery(
  { search, types, view, sort }: TeamsFilters,
  owner: string | undefined,
): TeamsQuery {
  return {
    q: search.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    type: types.length > 0 ? types : undefined,
    changed: view === 'changed' ? true : undefined,
    owner,
    sort: sort === TeamSort.POWER ? sort : undefined,
  }
}

type ListOptions = {
  // Whose teams to list, empty ones too; without an owner, everyone's that have a Pokémon.
  owner: string | undefined
  // Whether to ask for them yet.
  enabled: boolean
}

/** The teams that match `filters`, in the order they name, a page at a time. */
export function useTeamsList(filters: TeamsFilters, { owner, enabled }: ListOptions) {
  return useInfiniteQuery({
    ...listTeamsInfiniteOptions({ query: toQuery(filters, owner) }),
    enabled,
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    // Keep showing the current teams while a changed filter loads, instead of a skeleton; but not
    // while another owner's, or everyone's, load in their place.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0].query?.owner === owner ? previous : undefined,
  })
}

export type TeamsList = ReturnType<typeof useTeamsList>
