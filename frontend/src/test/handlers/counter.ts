import { http, HttpResponse } from 'msw'

import type {
  Challenger,
  FindCounterTeamResponse,
  ListTeamThreatsResponse,
  Matchup,
  Pokemon,
  TeamMatchups,
} from '@/api'

import { makeMatchup } from '../matchups'
import { refusal, server } from '../server'

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
 * Stands in for the API's threats to a team: answers a team with up to 12 of `threats`, those not
 * on it, in order, each with its `matchup` against each of the team's; or, given `refuse`, with
 * that status instead. Returns each request's query string, in the order they came.
 */
export function serveTeamThreats({
  threats = [],
  matchup = evenMatchup,
  refuse,
}: { threats?: Pokemon[]; matchup?: MatchupOf; refuse?: number } = {}) {
  const requests: string[] = []
  server.use(
    http.get('/api/team-threats', ({ request }) => {
      const query = new URL(request.url).searchParams
      requests.push(query.toString())
      if (refuse) return refusal(refuse)
      const theirs = query.getAll('pokemon_id').map(Number)
      const listed = threats.filter((pokemon) => !theirs.includes(pokemon.id)).slice(0, 12)
      const answer: ListTeamThreatsResponse = challengers(listed, theirs, matchup)
      return HttpResponse.json(answer)
    }),
  )
  return requests
}

/**
 * Stands in for the API's matchups between two teams: answers with each of our Pokémon, from
 * `catalog`, and its `matchup` against each of theirs; or, given `refuse`, with that status
 * instead. Returns each request's query string, in the order they came.
 */
export function serveMatchups({
  catalog = [],
  matchup = evenMatchup,
  refuse,
}: { catalog?: Pokemon[]; matchup?: MatchupOf; refuse?: number } = {}) {
  const requests: string[] = []
  server.use(
    http.get('/api/matchups', ({ request }) => {
      const query = new URL(request.url).searchParams
      requests.push(query.toString())
      if (refuse) return refusal(refuse)
      const ours = query
        .getAll('pokemon_id')
        .flatMap((id) => catalog.find((pokemon) => pokemon.id === Number(id)) ?? [])
      const theirs = query.getAll('opponent_id').map(Number)
      const answer: TeamMatchups = { members: challengers(ours, theirs, matchup) }
      return HttpResponse.json(answer)
    }),
  )
  return requests
}

/**
 * Holds every request for a team's threats until `release` is called, then lets the stand-in from
 * serveTeamThreats answer them. `arrived` counts the requests the app has sent so far. Call it
 * after serveTeamThreats, so it comes first.
 */
export function holdTeamThreats() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrived = 0
  server.use(
    http.get('/api/team-threats', async () => {
      arrived += 1
      await released
    }),
  )
  return { release, arrived: () => arrived }
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
