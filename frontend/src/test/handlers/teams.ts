import { http, HttpResponse } from 'msw'

import { type Pokemon, type Team, TeamConflictReason, type User } from '@/api'

import { refusal, server } from '../server'
import { asMember } from '../teams'

/** A request the teams stand-in received: method, path and JSON body. */
export type TeamRequest = { method: string; path: string; body: unknown }

// What the teams stand-in knows, and what it has been asked.
type TeamsStore = {
  // Most recently changed first.
  teams: Team[]
  // Every Pokémon it knows.
  catalog: Pokemon[]
  // Whoever sends the changes.
  signedIn: User | null
  pageSize: number
  requests: TeamRequest[]
  listQueries: string[]
}

function conflict(reason: TeamConflictReason) {
  return HttpResponse.json({ detail: 'Refused.', reason }, { status: 409 })
}

// Whether two Pokémon are from one evolution family. One whose family isn't known yet is from none.
function sameFamily(one: Pokemon, other: Pokemon) {
  return one.family_id != null && one.family_id === other.family_id
}

// Newest first, as the API lists everyone's teams.
function newestFirst(one: Team, other: Team) {
  return Date.parse(other.created_at) - Date.parse(one.created_at) || other.id.localeCompare(one.id)
}

function findPokemon(store: TeamsStore, id: number) {
  return store.catalog.find((each) => each.id === id)
}

function findTeam(store: TeamsStore, id: string) {
  return store.teams.find((each) => each.id === id)
}

// Keeps the team with these Pokémon as its members, as the most recently changed.
function save(store: TeamsStore, changed: Team, members: Pokemon[]): Team {
  const updated = {
    ...changed,
    updated_at: new Date().toISOString(),
    members: members.map(asMember),
  }
  store.teams = [updated, ...store.teams.filter((each) => each.id !== changed.id)]
  return updated
}

async function record(store: TeamsStore, request: Request) {
  const body = request.method === 'DELETE' ? null : await request.json()
  store.requests.push({ method: request.method, path: new URL(request.url).pathname, body })
  return body as Record<string, unknown> | null
}

// The team, if whoever's signed in may change it; otherwise the API's answer.
function owned(store: TeamsStore, teamId: string): Team | Response {
  if (!store.signedIn) return refusal(401)
  const found = findTeam(store, teamId)
  if (!found) return refusal(404)
  if (found.owner.username !== store.signedIn.username) return refusal(403)
  return found
}

// Everyone's teams that have a Pokémon, or one trainer's (`owner`) with empty ones too, newest
// first, a page at a time.
function listTeams(store: TeamsStore, request: Request) {
  const query = new URL(request.url).searchParams
  store.listQueries.push(query.toString())
  const limit = Number(query.get('limit') ?? store.pageSize)
  const cursor = query.get('cursor')
  const owner = query.get('owner')?.toLowerCase()
  if (owner === '') return refusal(422)
  const listed = store.teams
    .filter((each) =>
      owner === undefined ? each.members.length > 0 : each.owner.username.toLowerCase() === owner,
    )
    .sort(newestFirst)
  const after = cursor === null ? -1 : listed.findIndex((each) => each.id === cursor)
  // A cursor that no team has gives an empty page.
  const start = cursor !== null && after === -1 ? listed.length : after + 1
  const items = listed.slice(start, start + limit)
  const more = start + limit < listed.length
  return HttpResponse.json({ items, next_cursor: more ? items[items.length - 1].id : null })
}

function listUserTeams(store: TeamsStore, username: string) {
  const theirs = store.teams.filter(
    (each) => each.owner.username.toLowerCase() === username.toLowerCase(),
  )
  return HttpResponse.json(theirs)
}

function getTeam(store: TeamsStore, teamId: string) {
  const found = findTeam(store, teamId)
  return found ? HttpResponse.json(found) : refusal(404)
}

// Creates the team, or answers with it if its owner already made it.
async function createTeam(store: TeamsStore, request: Request, teamId: string) {
  const body = await record(store, request)
  const { signedIn } = store
  if (!signedIn) return refusal(401)
  const existing = findTeam(store, teamId)
  if (existing) {
    return existing.owner.username === signedIn.username
      ? HttpResponse.json(existing)
      : conflict(TeamConflictReason.TEAM_ID_TAKEN)
  }
  const now = new Date().toISOString()
  const ids = (body?.pokemon_ids as number[] | undefined) ?? []
  const created = save(
    store,
    {
      id: teamId,
      name: String(body?.name),
      owner: { username: signedIn.username },
      created_at: now,
      updated_at: now,
      members: [],
    },
    ids.flatMap((id) => findPokemon(store, id) ?? []),
  )
  return HttpResponse.json(created, { status: 201 })
}

async function renameTeam(store: TeamsStore, request: Request, teamId: string) {
  const body = await record(store, request)
  const found = owned(store, teamId)
  if (found instanceof Response) return found
  const renamed = { ...found, name: String(body?.name).trim() }
  return HttpResponse.json(save(store, renamed, found.members.map((member) => member.pokemon)))
}

async function deleteTeam(store: TeamsStore, request: Request, teamId: string) {
  await record(store, request)
  const found = owned(store, teamId)
  if (found instanceof Response) return found
  store.teams = store.teams.filter((each) => each.id !== found.id)
  return new HttpResponse(null, { status: 204 })
}

// Adds a Pokémon to the end of the team, unless its family is on it or the team is full.
async function addMember(store: TeamsStore, request: Request, teamId: string) {
  const body = await record(store, request)
  const found = owned(store, teamId)
  if (found instanceof Response) return found
  const added = findPokemon(store, Number(body?.pokemon_id))
  if (!added) return refusal(422)
  const members = found.members.map((member) => member.pokemon)
  if (members.some((member) => member.id === added.id || sameFamily(member, added))) {
    return conflict(TeamConflictReason.FAMILY_ON_TEAM)
  }
  if (members.length >= 6) return conflict(TeamConflictReason.TEAM_FULL)
  return HttpResponse.json(save(store, found, [...members, added]))
}

async function replaceMember(
  store: TeamsStore,
  request: Request,
  teamId: string,
  replacedId: number,
) {
  const body = await record(store, request)
  const found = owned(store, teamId)
  if (found instanceof Response) return found
  const added = findPokemon(store, Number(body?.pokemon_id))
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
  return HttpResponse.json(save(store, found, replaced))
}

async function removeMember(
  store: TeamsStore,
  request: Request,
  teamId: string,
  removedId: number,
) {
  await record(store, request)
  const found = owned(store, teamId)
  if (found instanceof Response) return found
  const members = found.members.map((member) => member.pokemon)
  if (!members.some((member) => member.id === removedId)) return refusal(404)
  return HttpResponse.json(save(store, found, members.filter((member) => member.id !== removedId)))
}

// Puts the members in the order given, which must name each of them, as the API does.
async function reorderMembers(store: TeamsStore, request: Request, teamId: string) {
  const body = await record(store, request)
  const found = owned(store, teamId)
  if (found instanceof Response) return found
  const ids = (body?.pokemon_ids as number[] | undefined) ?? []
  const members = found.members.map((member) => member.pokemon)
  const same = ids.length === members.length && members.every((member) => ids.includes(member.id))
  if (!same) return conflict(TeamConflictReason.ORDER_OUT_OF_DATE)
  const ordered = ids.flatMap((id) => members.find((member) => member.id === id) ?? [])
  return HttpResponse.json(save(store, found, ordered))
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
  teams = [],
  catalog = [],
  signedIn = null,
  pageSize = 24,
}: { teams?: Team[]; catalog?: Pokemon[]; signedIn?: User | null; pageSize?: number } = {}) {
  const store: TeamsStore = {
    teams: structuredClone(teams),
    catalog,
    signedIn,
    pageSize,
    requests: [],
    listQueries: [],
  }
  const team = '/api/teams/:teamId'
  const member = `${team}/members/:pokemonId`
  server.use(
    http.get('/api/teams', ({ request }) => listTeams(store, request)),
    http.get('/api/users/:username/teams', ({ params }) =>
      listUserTeams(store, String(params.username)),
    ),
    http.get(team, ({ params }) => getTeam(store, String(params.teamId))),
    http.put(team, ({ request, params }) => createTeam(store, request, String(params.teamId))),
    http.patch(team, ({ request, params }) => renameTeam(store, request, String(params.teamId))),
    http.delete(team, ({ request, params }) => deleteTeam(store, request, String(params.teamId))),
    http.post(`${team}/members`, ({ request, params }) =>
      addMember(store, request, String(params.teamId)),
    ),
    http.put(member, ({ request, params }) =>
      replaceMember(store, request, String(params.teamId), Number(params.pokemonId)),
    ),
    http.delete(member, ({ request, params }) =>
      removeMember(store, request, String(params.teamId), Number(params.pokemonId)),
    ),
    http.put(`${team}/order`, ({ request, params }) =>
      reorderMembers(store, request, String(params.teamId)),
    ),
  )
  return { requests: store.requests, listQueries: store.listQueries, teams: () => store.teams }
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
