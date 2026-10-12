import { http, HttpResponse } from 'msw'

import type { PokemonChange, PokemonDetails, PokemonPage } from '@/api'

import { makeDetails, makePage } from '../pokemon'
import { serve, server } from '../server'

/** Answers the Pokédex list with `page`, or with the page for each request's query. */
export function servePokemon(
  page: PokemonPage | ((query: URLSearchParams) => PokemonPage) = makePage(['bulbasaur']),
) {
  return serve('/api/pokemon', typeof page === 'function' ? page : () => page)
}

/** Answers each Pokémon's details with `details`, or with the details for its id. */
export function servePokemonDetails(
  details: PokemonDetails | ((id: number) => PokemonDetails) = makeDetails(),
) {
  const detailsFor = typeof details === 'function' ? details : () => details
  server.use(
    http.get('/api/pokemon/:pokemonId', ({ params }) =>
      HttpResponse.json(detailsFor(Number(params.pokemonId))),
    ),
  )
}

/**
 * Answers each Pokémon's change history with `changes`, or with the changes for its id; by
 * default, that it has none. Returns the id of each Pokémon asked about, in the order asked.
 */
export function servePokemonChanges(
  changes: PokemonChange[] | ((id: number) => PokemonChange[]) = [],
) {
  const changesFor = typeof changes === 'function' ? changes : () => changes
  const asked: number[] = []
  server.use(
    http.get('/api/pokemon/:pokemonId/changes', ({ params }) => {
      const id = Number(params.pokemonId)
      asked.push(id)
      return HttpResponse.json(changesFor(id))
    }),
  )
  return asked
}
