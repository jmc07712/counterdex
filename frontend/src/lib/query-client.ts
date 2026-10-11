import { type DefaultOptions, QueryClient } from '@tanstack/react-query'

export const queryDefaults = {
  // The API lets browsers reuse Pokémon data for 5 minutes, so queries don't refetch sooner
  // unless they say otherwise.
  queries: { staleTime: 5 * 60 * 1000 },
} satisfies DefaultOptions

export const queryClient = new QueryClient({ defaultOptions: queryDefaults })
