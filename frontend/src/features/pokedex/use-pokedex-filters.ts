import { useSearchParams } from 'react-router'

import { FormFilter, type PokemonType } from '@/api'

import { MAX_TYPES, toPokemonTypes } from './pokemon-types'

export type PokedexFilters = {
  search: string
  types: PokemonType[]
  forms: FormFilter
}

export const NO_FILTERS: PokedexFilters = { search: '', types: [], forms: FormFilter.ALL }

/** The forms option a value names, if it names one. */
export function parseFormFilter(value: string | null): FormFilter | undefined {
  return Object.values(FormFilter).find((forms) => forms === value)
}

/**
 * The Pokédex filters, kept in the URL (?q=char&type=fire&forms=alternate) so a filtered view can be
 * shared or bookmarked, and the back button undoes a change.
 */
export function usePokedexFilters() {
  const [params, setParams] = useSearchParams()

  const filters: PokedexFilters = {
    search: params.get('q') ?? '',
    types: toPokemonTypes(params.getAll('type')).slice(-MAX_TYPES),
    forms: parseFormFilter(params.get('forms')) ?? FormFilter.ALL,
  }

  function setFilters({ search, types, forms }: PokedexFilters) {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    // A Pokémon has at most two types: picking a third drops the oldest.
    for (const type of types.slice(-MAX_TYPES)) next.append('type', type)
    if (forms !== FormFilter.ALL) next.set('forms', forms)
    // Replace rather than push, so typing a search doesn't add a history entry per keystroke.
    setParams(next, { replace: true })
  }

  return [filters, setFilters] as const
}
