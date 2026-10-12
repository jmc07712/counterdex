import { http, HttpResponse } from 'msw'

import { type Pokemon, type Team, TeamConflictReason, type TeamMember, type User } from '@/api'

import { refusal, server } from '../server'

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

/**
 * Holds every fetch of a trainer's teams until `release` is called, then lets the stand-in from
 * serveTeams answer them. `arrived` counts the fetches the app has sent so far. Call it after
 * serveTeams, so it comes first.
 */
export function holdUserTeams() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrived = 0
  server.use(
    http.get('/api/users/:username/teams', async () => {
      arrived += 1
      await released
    }),
  )
  return { release, arrived: () => arrived }
}

/**
 * Holds every request to create a team until `release` is called, then lets the stand-in from
 * serveTeams answer them. Call it after serveTeams, so it comes first.
 */
export function holdNewTeams() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.put('/api/teams/:teamId', async () => {
      await released
    }),
  )
  return { release }
}
