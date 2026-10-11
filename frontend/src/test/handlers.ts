import { http, HttpResponse, type JsonBodyType } from 'msw'

import {
  type Challenger,
  type CredentialsWritable,
  type FindCounterTeamResponse,
  type Matchup,
  type Pokemon,
  type PokemonChange,
  type PokemonDetails,
  type PokemonPage,
  type SyncOverview,
  type SyncRunDetails,
  type SyncRunPage,
  type Team,
  TeamConflictReason,
  type TeamMember,
  type User,
} from '@/api'

import { makeMatchup } from './matchups'
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

/**
 * Stands in for the API's list of sync runs: `runs`, in the order given, which the API's is newest
 * first, `pageSize` to a page unless a request asks for another size. Like the API, a page past the
 * last has no runs, and there's always at least one page. Returns each request's query string, in
 * the order they came.
 */
export function serveSyncRuns({
  runs = [],
  pageSize = 20,
}: { runs?: SyncRunDetails[]; pageSize?: number } = {}) {
  return serve('/api/sync/runs', (query): SyncRunPage => {
    const page = Number(query.get('page') ?? 1)
    const size = Number(query.get('page_size') ?? pageSize)
    return {
      items: runs.slice((page - 1) * size, page * size),
      page,
      page_size: size,
      total: runs.length,
      total_pages: Math.max(1, Math.ceil(runs.length / size)),
    }
  })
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

function conflict(reason: TeamConflictReason) {
  return HttpResponse.json({ detail: 'Refused.', reason }, { status: 409 })
}

// Whether two Pokémon are from one evolution family. One whose family isn't known yet is from none.
function sameFamily(one: Pokemon, other: Pokemon) {
  return one.family_id != null && one.family_id === other.family_id
}

// These Pokémon as a team's members, in this order.
function asMembers(pokemon: Pokemon[]): TeamMember[] {
  return pokemon.map((each, position) => ({ position, pokemon: each, removed_at: null }))
}

// Newest first, as the API lists everyone's teams.
function newestFirst(one: Team, other: Team) {
  return Date.parse(other.created_at) - Date.parse(one.created_at) || other.id.localeCompare(one.id)
}

/**
 * Stands in for the API's teams and remembers them: `teams` to begin with, then each change.
 * `catalog` is every Pokémon it knows, and `signedIn` whoever sends the changes. Like the API,
 * it lists everyone's teams that have a Pokémon, or one trainer's (`owner`) with empty ones too,
 * `pageSize` at a time, and refuses an empty `owner`; lets only a team's owner change it; and
 * refuses a seventh member, a second Pokémon from one evolution family and an out-of-date order.
 * Returns the changes it was asked for, in order; the query string of each request for a list of
 * teams, in order; and its teams as they now are, most recently changed first.
 */
export function serveTeams({
  teams: initial = [],
  catalog = [],
  signedIn = null,
  pageSize = 24,
}: { teams?: Team[]; catalog?: Pokemon[]; signedIn?: User | null; pageSize?: number } = {}) {
  let teams = structuredClone(initial)
  const requests: TeamRequest[] = []
  const listQueries: string[] = []
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

  // The team, if whoever's signed in may change it; otherwise the API's answer.
  function owned(teamId: unknown): Team | Response {
    if (!signedIn) return refusal(401)
    const found = team(teamId)
    if (!found) return refusal(404)
    if (found.owner.username !== signedIn.username) return refusal(403)
    return found
  }

  server.use(
    http.get('/api/teams', ({ request }) => {
      const query = new URL(request.url).searchParams
      listQueries.push(query.toString())
      const limit = Number(query.get('limit') ?? pageSize)
      const cursor = query.get('cursor')
      const owner = query.get('owner')?.toLowerCase()
      if (owner === '') return refusal(422)
      const listed = teams
        .filter((each) =>
          owner === undefined
            ? each.members.length > 0
            : each.owner.username.toLowerCase() === owner,
        )
        .sort(newestFirst)
      const after = cursor === null ? -1 : listed.findIndex((each) => each.id === cursor)
      // A cursor that no team has gives an empty page.
      const start = cursor !== null && after === -1 ? listed.length : after + 1
      const items = listed.slice(start, start + limit)
      const more = start + limit < listed.length
      return HttpResponse.json({ items, next_cursor: more ? items[items.length - 1].id : null })
    }),
    http.get('/api/users/:username/teams', ({ params }) => {
      const username = String(params.username).toLowerCase()
      const theirs = teams.filter((each) => each.owner.username.toLowerCase() === username)
      return HttpResponse.json(theirs)
    }),
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
      if (!signedIn) return refusal(401)
      const existing = team(params.teamId)
      if (existing) {
        return existing.owner.username === signedIn.username
          ? HttpResponse.json(existing)
          : conflict(TeamConflictReason.TEAM_ID_TAKEN)
      }
      const now = new Date().toISOString()
      const ids = (body?.pokemon_ids as number[] | undefined) ?? []
      const created = save(
        {
          id: String(params.teamId),
          name: String(body?.name),
          owner: { username: signedIn.username },
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
      const found = owned(params.teamId)
      if (found instanceof Response) return found
      const renamed = { ...found, name: String(body?.name).trim() }
      return HttpResponse.json(save(renamed, found.members.map((member) => member.pokemon)))
    }),
    http.delete('/api/teams/:teamId', async ({ request, params }) => {
      await record(request, `/api/teams/${params.teamId}`)
      const found = owned(params.teamId)
      if (found instanceof Response) return found
      teams = teams.filter((each) => each.id !== found.id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('/api/teams/:teamId/members', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}/members`)
      const found = owned(params.teamId)
      if (found instanceof Response) return found
      const added = pokemon(Number(body?.pokemon_id))
      if (!added) return refusal(422)
      const members = found.members.map((member) => member.pokemon)
      if (members.some((member) => member.id === added.id || sameFamily(member, added))) {
        return conflict(TeamConflictReason.FAMILY_ON_TEAM)
      }
      if (members.length >= 6) return conflict(TeamConflictReason.TEAM_FULL)
      return HttpResponse.json(save(found, [...members, added]))
    }),
    http.put('/api/teams/:teamId/members/:pokemonId', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}/members/${params.pokemonId}`)
      const found = owned(params.teamId)
      if (found instanceof Response) return found
      const added = pokemon(Number(body?.pokemon_id))
      const replacedId = Number(params.pokemonId)
      const members = found.members.map((member) => member.pokemon)
      if (!members.some((member) => member.id === replacedId)) return refusal(404)
      if (!added) return refusal(422)
      if (added.id === replacedId) return HttpResponse.json(found)
      // As the API does: the new Pokémon may be from the replaced one's family, and if it's on the
      // team already, it moves into the slot and the gap it leaves closes.
      const others = members.filter((member) => member.id !== replacedId && member.id !== added.id)
      if (others.some((member) => sameFamily(member, added))) {
        return conflict(TeamConflictReason.FAMILY_ON_TEAM)
      }
      const replaced = members
        .filter((member) => member.id !== added.id)
        .map((member) => (member.id === replacedId ? added : member))
      return HttpResponse.json(save(found, replaced))
    }),
    http.delete('/api/teams/:teamId/members/:pokemonId', async ({ request, params }) => {
      await record(request, `/api/teams/${params.teamId}/members/${params.pokemonId}`)
      const found = owned(params.teamId)
      if (found instanceof Response) return found
      const removedId = Number(params.pokemonId)
      const members = found.members.map((member) => member.pokemon)
      if (!members.some((member) => member.id === removedId)) return refusal(404)
      return HttpResponse.json(save(found, members.filter((member) => member.id !== removedId)))
    }),
    http.put('/api/teams/:teamId/order', async ({ request, params }) => {
      const body = await record(request, `/api/teams/${params.teamId}/order`)
      const found = owned(params.teamId)
      if (found instanceof Response) return found
      const ids = (body?.pokemon_ids as number[] | undefined) ?? []
      const members = found.members.map((member) => member.pokemon)
      const same =
        ids.length === members.length && members.every((member) => ids.includes(member.id))
      if (!same) return conflict(TeamConflictReason.ORDER_OUT_OF_DATE)
      const ordered = ids.flatMap((id) => members.find((member) => member.id === id) ?? [])
      return HttpResponse.json(save(found, ordered))
    }),
  )
  return { requests, listQueries, teams: () => teams }
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

/**
 * Holds every fetch of one team until `release` is called, then lets the stand-in from
 * serveTeams answer them, so a test can see what shows before a refetch lands. Call it after
 * serveTeams, so it comes first.
 */
export function holdTeamFetches() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.get('/api/teams/:teamId', async () => {
      await released
    }),
  )
  return { release }
}

/** How a Pokémon matches up against the Pokémon `opponentId`, for a stand-in to answer with. */
export type MatchupOf = (pokemon: Pokemon, opponentId: number) => Matchup

// Even, with every type neutral both ways.
const evenMatchup: MatchupOf = (_, opponentId) => makeMatchup({ opponent_id: opponentId })

// Each of `pokemon` with its matchup against each of `theirs`, in their order.
function challengers(pokemon: Pokemon[], theirs: number[], matchup: MatchupOf): Challenger[] {
  return pokemon.map((each) => ({
    pokemon: each,
    matchups: theirs.map((opponentId) => matchup(each, opponentId)),
  }))
}

/**
 * Stands in for the API's counter teams: answers a team with as many of `catalog`'s Pokémon as it
 * has, the first ones not on it, in `catalog`'s order, each with its `matchup` against each of
 * the team's; or, given `refuse`, with that status instead. Returns each request's query string,
 * in the order they came.
 */
export function serveCounterTeam({
  catalog = [],
  matchup = evenMatchup,
  refuse,
}: { catalog?: Pokemon[]; matchup?: MatchupOf; refuse?: number } = {}) {
  const requests: string[] = []
  server.use(
    http.get('/api/counter-team', ({ request }) => {
      const query = new URL(request.url).searchParams
      requests.push(query.toString())
      if (refuse) return refusal(refuse)
      const theirs = query.getAll('pokemon_id').map(Number)
      const picks = catalog
        .filter((pokemon) => !theirs.includes(pokemon.id))
        .slice(0, theirs.length)
      const counter: FindCounterTeamResponse = challengers(picks, theirs, matchup)
      return HttpResponse.json(counter)
    }),
  )
  return requests
}

/**
 * Holds every request for a counter team until `release` is called, then lets the stand-in from
 * serveCounterTeam answer them. `arrived` counts the requests the app has sent so far. Call it
 * after serveCounterTeam, so it comes first.
 */
export function holdCounterTeams() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrived = 0
  server.use(
    http.get('/api/counter-team', async () => {
      arrived += 1
      await released
    }),
  )
  return { release, arrived: () => arrived }
}
