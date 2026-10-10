import { http, HttpResponse, type JsonBodyType } from 'msw'

import type { PokemonChange, PokemonDetails, PokemonPage, SyncOverview } from '@/api'
import { makeDetails, makePage } from '@/test/pokemon'
import { server } from '@/test/server'

// Answers GET requests to `path` with `respond`'s JSON. Returns each request's query string, in
// the order they came, so tests can check what the app asked for.
function serve(path: string, respond: (query: URLSearchParams) => JsonBodyType): string[] {
  const requests: string[] = []
  server.use(
    http.get(path, ({ request }) => {
      const query = new URL(request.url).searchParams
      requests.push(query.toString())
      return HttpResponse.json(respond(query))
    }),
  )
  return requests
}

/** Answers the Pokédex list with `page`, or with the page for each request's query. */
export function servePokemon(
  page: PokemonPage | ((query: URLSearchParams) => PokemonPage) = makePage(['bulbasaur']),
) {
  return serve('/api/pokemon', typeof page === 'function' ? page : () => page)
}

/** Answers the sync status with `overview`; by default, that the Pokédex was never synced. */
export function serveSyncStatus(
  overview: SyncOverview = { last_synced_at: null, latest_run: null },
) {
  return serve('/api/sync/status', () => overview)
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

/** Answers each Pokémon's change history with `changes`; by default, that it has none. */
export function servePokemonChanges(changes: PokemonChange[] = []) {
  server.use(http.get('/api/pokemon/:pokemonId/changes', () => HttpResponse.json(changes)))
}
