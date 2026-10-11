import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import type { PokemonType } from '@/api'
import { listPokemonInfiniteOptions } from '@/api/@tanstack/react-query.gen'

type PokemonBrowserFilters = { search: string; types: PokemonType[] }

/**
 * Pokémon to add to a team, in Pokédex order, a page at a time. Only the filters in use are
 * sent, so with none it asks for the same page as the Pokédex does.
 */
export function usePokemonBrowser({ search, types }: PokemonBrowserFilters) {
  const query = { q: search || undefined, type: types.length > 0 ? types : undefined }
  return useInfiniteQuery({
    ...listPokemonInfiniteOptions({ query }),
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    // Keep showing the current results while a changed search loads.
    placeholderData: keepPreviousData,
  })
}
