import { useSearchParams } from 'react-router'

import { FormFilter, ListingStatus, type PokemonType } from '@/api'
import { MAX_TYPES, toPokemonTypes } from '@/components/pokemon/pokemon-types'

export type PokedexFilters = {
  search: string
  types: PokemonType[]
  forms: FormFilter
  status: ListingStatus
}

export const NO_FILTERS: PokedexFilters = {
  search: '',
  types: [],
  forms: FormFilter.ALL,
  status: ListingStatus.LISTED,
}

/** The option a value names, if it names one of `options`. */
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
    status: parseOption(Object.values(ListingStatus), params.get('status')) ?? ListingStatus.LISTED,
  }

  function setFilters({ search, types, forms, status }: PokedexFilters) {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    // A Pokémon has at most two types: picking a third drops the oldest.
    for (const type of types.slice(-MAX_TYPES)) next.append('type', type)
    if (forms !== FormFilter.ALL) next.set('forms', forms)
    if (status !== ListingStatus.LISTED) next.set('status', status)
    // Replace rather than push, so typing a search doesn't add a history entry per keystroke.
    setParams(next, { replace: true })
  }

  return [filters, setFilters] as const
}
