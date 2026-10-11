import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listPokemonOptions } from '@/api/@tanstack/react-query.gen'

const SUGGESTIONS = 8

/** A few Pokémon whose names match `search`, to suggest while typing it. */
export function usePokemonSuggestions(search: string) {
  return useQuery({
    ...listPokemonOptions({ query: { q: search, limit: SUGGESTIONS } }),
    enabled: search !== '',
    // Keep the last suggestions showing while the next letter's load.
    placeholderData: keepPreviousData,
  })
}
