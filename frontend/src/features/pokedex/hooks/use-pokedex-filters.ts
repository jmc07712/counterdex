import { useSearchParams } from 'react-router'

import { FormFilter, ListingStatus, type PokemonType } from '@/api'
import { MAX_TYPES, toPokemonTypes } from '@/components/pokemon/pokemon-types'

/**
 * Which Pokémon the Pokédex shows: those PokéAPI lists, those syncs changed lately, or those
 * PokéAPI removed.
 */
export type PokedexView = ListingStatus | 'changed'
export const POKEDEX_VIEWS: PokedexView[] = [ListingStatus.LISTED, 'changed', ListingStatus.REMOVED]

export type PokedexFilters = {
  search: string
  types: PokemonType[]
  forms: FormFilter
  view: PokedexView
}

export const NO_FILTERS: PokedexFilters = {
  search: '',
  types: [],
  forms: FormFilter.ALL,
  view: ListingStatus.LISTED,
}

export function parseOption<T extends string>(options: T[], value: string | null): T | undefined {
  return options.find((option) => option === value)
}

/**
 * The Pokédex filters, kept in the URL (?q=char&type=fire&forms=alternate&status=removed) so a
 * filtered view can be shared, bookmarked, or reloaded.
 */
export function usePokedexFilters() {
  const [params, setParams] = useSearchParams()

  const filters: PokedexFilters = {
    search: params.get('q') ?? '',
    types: toPokemonTypes(params.getAll('type')).slice(-MAX_TYPES),
    forms: parseOption(Object.values(FormFilter), params.get('forms')) ?? FormFilter.ALL,
    view: parseOption(POKEDEX_VIEWS, params.get('status')) ?? ListingStatus.LISTED,
  }

  function setFilters({ search, types, forms, view }: PokedexFilters) {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    // A Pokémon has at most two types: picking a third drops the oldest.
    for (const type of types.slice(-MAX_TYPES)) next.append('type', type)
    if (forms !== FormFilter.ALL) next.set('forms', forms)
    if (view !== ListingStatus.LISTED) next.set('status', view)
    // Replace rather than push, so typing a search doesn't add a history entry per keystroke.
    setParams(next, { replace: true })
  }

  return [filters, setFilters] as const
}
