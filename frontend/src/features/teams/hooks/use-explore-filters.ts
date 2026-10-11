import { useSearchParams } from 'react-router'

import type { PokemonType } from '@/api'
import { toPokemonTypes } from '@/components/pokemon/pokemon-types'
import { parseOption } from '@/lib/search-params'

/** Which teams Explore shows: all of them, or those with a Pokémon a sync changed lately. */
export type ExploreView = 'all' | 'changed'
export const EXPLORE_VIEWS: ExploreView[] = ['all', 'changed']

export type ExploreFilters = {
  search: string
  types: PokemonType[]
  view: ExploreView
}

export const NO_FILTERS: ExploreFilters = { search: '', types: [], view: 'all' }

/**
 * Explore's filters, kept in the URL (?q=rain&type=water&type=ice&view=changed) so a filtered
 * view can be shared, bookmarked, or reloaded.
 */
export function useExploreFilters() {
  const [params, setParams] = useSearchParams()

  const filters: ExploreFilters = {
    search: params.get('q') ?? '',
    // Each type once, as a hand-edited URL can repeat one.
    types: [...new Set(toPokemonTypes(params.getAll('type')))],
    view: parseOption(EXPLORE_VIEWS, params.get('view')) ?? 'all',
  }

  function setFilters({ search, types, view }: ExploreFilters) {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    for (const type of types) next.append('type', type)
    if (view !== 'all') next.set('view', view)
    // Replace rather than push, so typing a search doesn't add a history entry per keystroke.
    setParams(next, { replace: true })
  }

  return [filters, setFilters] as const
}
