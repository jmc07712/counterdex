import { http, HttpResponse, type JsonBodyType } from 'msw'

import type {
  CredentialsWritable,
  PokemonChange,
  PokemonDetails,
  PokemonPage,
  SyncOverview,
  User,
} from '@/api'

import { makeDetails, makePage } from './pokemon'
import { server } from './server'
import { ASH } from './users'

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

/** What a test's stand-in for the API's sessions was asked. */
export type SessionRequests = {
  checks: number
  signIns: CredentialsWritable[]
  signUps: CredentialsWritable[]
  signOuts: number
}

type SessionRequest = 'currentUser' | 'signIn' | 'signUp' | 'signOut'

function refusal(status: number) {
  return HttpResponse.json({ detail: 'Refused.' }, { status })
}

/**
 * Stands in for the API's sessions and remembers who's signed in: `signedIn` to begin with, Ash
 * once signed in or up, and nobody once signed out. `refuse` answers a kind of request with an
 * error status instead, e.g. { signIn: 401 }. Returns what was asked, in the order it came.
 */
export function serveSession({
  signedIn = null,
  refuse = {},
}: { signedIn?: User | null; refuse?: Partial<Record<SessionRequest, number>> } = {}) {
  let current = signedIn
  const requests: SessionRequests = { checks: 0, signIns: [], signUps: [], signOuts: 0 }
  server.use(
    http.get('/api/session', () => {
      requests.checks += 1
      if (refuse.currentUser) return refusal(refuse.currentUser)
      return current ? HttpResponse.json(current) : refusal(401)
    }),
    http.post('/api/session', async ({ request }) => {
      requests.signIns.push((await request.json()) as CredentialsWritable)
      if (refuse.signIn) return refusal(refuse.signIn)
      current = ASH
      return HttpResponse.json(current)
    }),
    http.post('/api/users', async ({ request }) => {
      requests.signUps.push((await request.json()) as CredentialsWritable)
      if (refuse.signUp) return refusal(refuse.signUp)
      current = ASH
      return HttpResponse.json(current, { status: 201 })
    }),
    http.delete('/api/session', () => {
      requests.signOuts += 1
      if (refuse.signOut) return refusal(refuse.signOut)
      current = null
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return requests
}

/**
 * Holds the next check of who's signed in until `release` is called, then answers it with
 * `user` (null for nobody), as if it were from before. Later checks go to serveSession.
 */
export function holdNextCurrentUser(user: User | null) {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.get(
      '/api/session',
      async () => {
        await released
        return user ? HttpResponse.json(user) : refusal(401)
      },
      { once: true },
    ),
  )
  return release
}
