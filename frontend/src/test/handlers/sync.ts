import type { SyncOverview, SyncRunDetails, SyncRunPage } from '@/api'

import { serve } from '../server'

/** Answers the sync status with `overview`; by default, that the Pokédex was never synced. */
export function serveSyncStatus(
  overview: SyncOverview = { last_synced_at: null, latest_run: null },
) {
  return serve('/api/sync/status', () => overview)
}

/**
 * Stands in for the API's list of sync runs: `runs`, in the order given, which the API's is newest
 * first, `pageSize` to a page unless a request asks for another size. Like the API, a page past the
 * last has no runs, and there's always at least one page. Returns each request's query string, in
 * the order they came.
 */
export function serveSyncRuns({
  runs = [],
  pageSize = 20,
}: { runs?: SyncRunDetails[]; pageSize?: number } = {}) {
  return serve('/api/sync/runs', (query): SyncRunPage => {
    const page = Number(query.get('page') ?? 1)
    const size = Number(query.get('page_size') ?? pageSize)
    return {
      items: runs.slice((page - 1) * size, page * size),
      page,
      page_size: size,
      total: runs.length,
      total_pages: Math.max(1, Math.ceil(runs.length / size)),
    }
  })
}
