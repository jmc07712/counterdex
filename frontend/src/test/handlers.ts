import { http, HttpResponse, type JsonBodyType } from 'msw'

import type {
  CredentialsWritable,
  Pokemon,
  PokemonChange,
  PokemonDetails,
  PokemonPage,
  SyncOverview,
  Team,
  TeamMember,
  User,
} from '@/api'

import { makeDetails, makePage } from './pokemon'
import { server } from './server'
import { EVOLUTION_LINES } from './teams'
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

/** A request the teams stand-in received: method, path and JSON body. */
export type TeamRequest = { method: string; path: string; body: unknown }

function conflict(reason: string) {
  return HttpResponse.json({ detail: 'Refused.', reason }, { status: 409 })
}

// Two Pokémon are related when they're different species in one evolution line.
function related(one: Pokemon, other: Pokemon) {
  return (
    one.species_id !== other.species_id &&
    EVOLUTION_LINES.some(
      (line) => line.includes(one.species_id ?? -1) && line.includes(other.species_id ?? -1),
    )
  )
}

// These Pokémon as a team's members, in this order, each with its relatives among them.
function asMembers(pokemon: Pokemon[]): TeamMember[] {
  return pokemon.map((each, position) => ({
    position,
    pokemon: each,
    removed_at: null,
    related_pokemon_ids: pokemon.filter((other) => related(each, other)).map((other) => other.id),
  }))
}

/**
 * Stands in for the API's teams and remembers them: `teams` to begin with, then each change.
 * `catalog` is every Pokémon it knows. Like the API, it refuses a seventh member, a second of a
 * species and an out-of-date order. Returns what it was asked, in order, and its teams as they
 * now are, most recently changed first.
 */
export function serveTeams({
  teams: initial = [],
  catalog = [],
}: { teams?: Team[]; catalog?: Pokemon[] } = {}) {
  let teams = structuredClone(initial)
  const requests: TeamRequest[] = []
  const pokemon = (id: number) => catalog.find((each) => each.id === id)
  const team = (id: unknown) => teams.find((each) => each.id === id)

  // Keeps the team with these Pokémon as its members, as the most recently changed.
  function save(changed: Team, members: Pokemon[]): Team {
    const updated = {
      ...changed,
      updated_at: new Date().toISOString(),
      members: asMembers(members),
    }
    teams = [updated, ...teams.filter((each) => each.id !== changed.id)]
    return updated
  }

  async function record(request: Request, path: string) {
    const body = request.method === 'DELETE' ? null : await request.json()
    requests.push({ method: request.method, path, body })
    return body as Record<string, unknown> | null
  }

  server.use(
    http.get('/api/teams', () => HttpResponse.json(teams)),
    http.get('/api/teams/preview', ({ request }) => {
      const ids = new URL(request.url).searchParams.getAll('pokemon_id').map(Number)
      return HttpResponse.json(asMembers(ids.flatMap((id) => pokemon(id) ?? [])))
    }),
    http.get('/api/teams/:teamId', ({ params }) => {
      const found = team(params.teamId)
      return found ? HttpResponse.json(found) : refusal(404)
    }),
    http.put('/api/teams/:teamId', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}`)
      const existing = team(params.teamId)
      if (existing) return HttpResponse.json(existing)
      const now = new Date().toISOString()
      const ids = (body?.pokemon_ids as number[] | undefined) ?? []
      const created = save(
        {
          id: String(params.teamId),
          name: String(body?.name),
          created_at: now,
          updated_at: now,
          members: [],
        },
        ids.flatMap((id) => pokemon(id) ?? []),
      )
      return HttpResponse.json(created, { status: 201 })
    }),
    http.patch('/api/teams/:teamId', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}`)
      const found = team(params.teamId)
      if (!found) return refusal(404)
      const renamed = { ...found, name: String(body?.name).trim() }
      return HttpResponse.json(save(renamed, found.members.map((member) => member.pokemon)))
    }),
    http.delete('/api/teams/:teamId', async ({ request, params }) => {
      await record(request, `/api/teams/${params.teamId}`)
      if (!team(params.teamId)) return refusal(404)
      teams = teams.filter((each) => each.id !== params.teamId)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('/api/teams/:teamId/members', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}/members`)
      const found = team(params.teamId)
      const added = pokemon(Number(body?.pokemon_id))
      if (!found) return refusal(404)
      if (!added) return refusal(422)
      const members = found.members.map((member) => member.pokemon)
      if (members.some((member) => member.species_id === added.species_id)) {
        return conflict('species_on_team')
      }
      if (members.length >= 6) return conflict('team_full')
      return HttpResponse.json(save(found, [...members, added]))
    }),
    http.put('/api/teams/:teamId/members/:pokemonId', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}/members/${params.pokemonId}`)
      const found = team(params.teamId)
      const added = pokemon(Number(body?.pokemon_id))
      const replacedId = Number(params.pokemonId)
      const members = found?.members.map((member) => member.pokemon) ?? []
      if (!found || !added || !members.some((member) => member.id === replacedId)) {
        return refusal(404)
      }
      const replaced = members
        .filter((member) => member.id !== added.id)
        .map((member) => (member.id === replacedId ? added : member))
      return HttpResponse.json(save(found, replaced))
    }),
    http.delete('/api/teams/:teamId/members/:pokemonId', async ({ request, params }) => {
      await record(request, `/api/teams/${params.teamId}/members/${params.pokemonId}`)
      const found = team(params.teamId)
      const removedId = Number(params.pokemonId)
      const members = found?.members.map((member) => member.pokemon) ?? []
      if (!found || !members.some((member) => member.id === removedId)) return refusal(404)
      return HttpResponse.json(save(found, members.filter((member) => member.id !== removedId)))
    }),
    http.put('/api/teams/:teamId/order', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}/order`)
      const found = team(params.teamId)
      if (!found) return refusal(404)
      const ids = (body?.pokemon_ids as number[] | undefined) ?? []
      const members = found.members.map((member) => member.pokemon)
      const same =
        ids.length === members.length && members.every((member) => ids.includes(member.id))
      if (!same) return conflict('order_out_of_date')
      const ordered = ids.flatMap((id) => members.find((member) => member.id === id) ?? [])
      return HttpResponse.json(save(found, ordered))
    }),
  )
  return { requests, teams: () => teams }
}

/**
 * Holds every change to a team's members or order until `release` is called, then lets the
 * stand-in from serveTeams answer them. `arrived` counts the changes the app has sent so far.
 * Call it after serveTeams, so it comes first.
 */
export function holdTeamChanges() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrived = 0
  // Answering nothing hands the request on to the next handler that matches: the stand-in.
  const hold = async () => {
    arrived += 1
    await released
  }
  server.use(
    http.post('/api/teams/:teamId/*', hold),
    http.put('/api/teams/:teamId/*', hold),
    http.delete('/api/teams/:teamId/*', hold),
  )
  return { release, arrived: () => arrived }
}
