import { useQuery } from '@tanstack/react-query'

import { syncStatusOptions } from '@/api/@tanstack/react-query.gen'

/** When the Pokédex was last synced, and how the latest sync went. */
export function useSyncStatus() {
  return useQuery(syncStatusOptions())
}
