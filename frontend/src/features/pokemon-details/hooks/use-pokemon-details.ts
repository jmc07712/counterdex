import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getPokemonOptions, listPokemonChangesOptions } from '@/api/@tanstack/react-query.gen'

/**
 * A Pokémon's details, and the changes syncs have found to it. Choosing another form or stage keeps
 * this one showing until the next arrives, rather than flashing a skeleton in between.
 */
export function usePokemonDetails(pokemonId: number) {
  const path = { pokemon_id: pokemonId }
  const details = useQuery({ ...getPokemonOptions({ path }), placeholderData: keepPreviousData })
  const changes = useQuery({
    ...listPokemonChangesOptions({ path }),
    placeholderData: keepPreviousData,
  })
  return { details, changes }
}

export type PokemonChanges = ReturnType<typeof usePokemonDetails>['changes']
