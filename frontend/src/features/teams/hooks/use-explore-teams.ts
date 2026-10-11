import { useInfiniteQuery } from '@tanstack/react-query'

import { listTeamsInfiniteOptions } from '@/api/@tanstack/react-query.gen'

/** Everyone's teams that have a Pokémon, newest first, a page at a time. */
export function useExploreTeams() {
  return useInfiniteQuery({
    ...listTeamsInfiniteOptions(),
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  })
}
