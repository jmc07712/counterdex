import type { FormFilter, ListingStatus, PokemonType } from '@/api'

/**
 * Which Pokémon the Pokédex shows: those PokéAPI lists, those syncs changed recently, or those
 * PokéAPI removed.
 */
export type PokedexView = ListingStatus | 'changed'

export type PokedexFilters = {
  search: string
  types: PokemonType[]
  forms: FormFilter
  view: PokedexView
}
