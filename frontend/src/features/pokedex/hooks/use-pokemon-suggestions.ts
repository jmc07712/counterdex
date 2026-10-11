import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listPokemonOptions } from '@/api/@tanstack/react-query.gen'
import { MAX_SEARCH_LENGTH } from '@/lib/search-params'

const SUGGESTIONS = 8

/** A few Pokémon whose names match `search`, to suggest while typing it. */
export function usePokemonSuggestions(search: string) {
  return useQuery({
    // Within what the API takes, as a search from a hand-edited URL can be longer.
    ...listPokemonOptions({
      query: { q: search.slice(0, MAX_SEARCH_LENGTH), limit: SUGGESTIONS },
    }),
    enabled: search !== '',
    // Keep the last suggestions showing while the next letter's load.
    placeholderData: keepPreviousData,
  })
}
