import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import { FormFilter, type ListPokemonData, ListingStatus } from '@/api'
import { listPokemonInfiniteOptions } from '@/api/@tanstack/react-query.gen'

import type { PokedexFilters, PokedexView } from './use-pokedex-filters'

type PokemonQuery = NonNullable<ListPokemonData['query']>

// What the API is asked for in each view.
const VIEW_QUERIES: Record<PokedexView, PokemonQuery> = {
  listed: {},
  changed: { changed: true },
  removed: { status: ListingStatus.REMOVED },
}

// Only the filters in use, so the default grid always requests the same URL and the browser and
// CDN caches can share it. The API rejects an empty search, and by default lists all forms of the
// Pokémon PokéAPI lists.
function toQuery({ search, types, forms, view }: PokedexFilters): PokemonQuery {
  return {
    q: search.trim() || undefined,
    type: types.length > 0 ? types : undefined,
    forms: forms === FormFilter.ALL ? undefined : forms,
    ...VIEW_QUERIES[view],
  }
}

/** Pokémon matching the filters, one page at a time, for infinite scrolling. */
export function usePokemonList(filters: PokedexFilters) {
  return useInfiniteQuery({
    ...listPokemonInfiniteOptions({ query: toQuery(filters) }),
    // The first page has no cursor; each later page continues from the one before.
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    // Keep showing the current results while a changed filter loads, instead of a skeleton.
    placeholderData: keepPreviousData,
  })
}
