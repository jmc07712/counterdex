import { QueryClient } from '@tanstack/react-query'

// The API lets browsers reuse Pokémon data for 5 minutes, so the app doesn't refetch sooner.
const STALE_TIME_MS = 5 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: STALE_TIME_MS } },
})
