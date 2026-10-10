import { useSearchParams } from 'react-router'

import type { PokemonType } from '@/api'

import { MAX_TYPES, toPokemonTypes } from './pokemon-types'

export type PokedexFilters = {
  search: string
  types: PokemonType[]
  includeForms: boolean
}

export const NO_FILTERS: PokedexFilters = { search: '', types: [], includeForms: true }

/**
 * The Pokédex filters, kept in the URL (?q=char&type=fire&forms=false) so a filtered view can be
 * shared or bookmarked, and the back button undoes a change.
 */
export function usePokedexFilters() {
  const [params, setParams] = useSearchParams()

  const filters: PokedexFilters = {
    search: params.get('q') ?? '',
    types: toPokemonTypes(params.getAll('type')).slice(-MAX_TYPES),
    includeForms: params.get('forms') !== 'false',
  }

  function setFilters({ search, types, includeForms }: PokedexFilters) {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    // A Pokémon has at most two types: picking a third drops the oldest.
    for (const type of types.slice(-MAX_TYPES)) next.append('type', type)
    if (!includeForms) next.set('forms', 'false')
    // Replace rather than push, so typing a search doesn't add a history entry per keystroke.
    setParams(next, { replace: true })
  }

  return [filters, setFilters] as const
}
