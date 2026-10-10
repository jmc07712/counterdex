import { useInfiniteQuery } from '@tanstack/react-query'

import type { ListPokemonData, PokemonType } from '@/api'
import { listPokemonInfiniteOptions } from '@/api/@tanstack/react-query.gen'

export type PokedexFilters = {
  search: string
  types: PokemonType[]
  includeForms: boolean
}

type PokemonQuery = NonNullable<ListPokemonData['query']>

// Only the filters in use, so the default grid always requests the same URL and the browser and
// CDN caches can share it. The API rejects an empty search, and includes forms by default.
function toQuery({ search, types, includeForms }: PokedexFilters): PokemonQuery {
  return {
    q: search.trim() || undefined,
    type: types.length > 0 ? types : undefined,
    forms: includeForms ? undefined : false,
  }
}

/** Pokémon matching the filters, one page at a time, for infinite scrolling. */
export function usePokemonList(filters: PokedexFilters) {
  return useInfiniteQuery({
    ...listPokemonInfiniteOptions({ query: toQuery(filters) }),
    // The first page has no cursor; each later page continues from the one before.
    initialPageParam: {},
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  })
}
