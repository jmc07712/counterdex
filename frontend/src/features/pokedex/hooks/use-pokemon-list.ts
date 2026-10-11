import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import { FormFilter, type ListPokemonData, ListingStatus } from '@/api'
import { listPokemonInfiniteOptions } from '@/api/@tanstack/react-query.gen'
import { MAX_SEARCH_LENGTH } from '@/lib/search-params'

import type { PokedexFilters, PokedexView } from './use-pokedex-filters'

type PokemonQuery = NonNullable<ListPokemonData['query']>

const VIEW_QUERIES: Record<PokedexView, PokemonQuery> = {
  listed: {},
  changed: { changed: true },
  removed: { status: ListingStatus.REMOVED },
}

// Only the filters in use, so the default grid always requests the same URL and the browser and
// CDN caches can share it. The API rejects an empty search and one longer than it takes, as a
// hand-edited URL can have, and by default lists all forms of the Pokémon PokéAPI lists.
function toQuery({ search, types, forms, view }: PokedexFilters): PokemonQuery {
  return {
    q: search.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    type: types.length > 0 ? types : undefined,
    forms: forms === FormFilter.ALL ? undefined : forms,
    ...VIEW_QUERIES[view],
  }
}

export function usePokemonList(filters: PokedexFilters) {
  return useInfiniteQuery({
    ...listPokemonInfiniteOptions({ query: toQuery(filters) }),
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    // Keep showing the current results while a changed filter loads, instead of a skeleton.
    placeholderData: keepPreviousData,
  })
}
