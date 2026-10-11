import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listSyncRunsOptions } from '@/api/@tanstack/react-query.gen'

/** One page of every sync run, newest first. Only admins may ask for it. */
export function useSyncRuns(page: number) {
  return useQuery({
    ...listSyncRunsOptions({ query: { page } }),
    // Fetched again each time it's shown, rather than kept for the Pokédex data's 5 minutes, as
    // any sync adds a run.
    staleTime: 0,
    // Keep showing the current page while the next loads, instead of a skeleton.
    placeholderData: keepPreviousData,
  })
}

export type SyncRuns = ReturnType<typeof useSyncRuns>
