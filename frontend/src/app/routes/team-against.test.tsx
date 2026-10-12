import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { type Matchup, type Pokemon, PokemonType, Rating, RelativeSpeed, type Team } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import { type MatchupOf, serveMatchups } from '@/test/handlers/counter'
import { servePokemon } from '@/test/handlers/pokemon'
import { serveSession } from '@/test/handlers/session'
import { serveTeams } from '@/test/handlers/teams'
import { makeMatchup } from '@/test/matchups'
import { onWideScreen } from '@/test/media'
import { ON_SCREEN } from '@/test/queries'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamEditPage } from './team-edit'

const { charmander, pikachu, gengar, lapras } = catalog
const CATALOG = Object.values(catalog)
const { GOOD, BAD } = Rating

const THEIR_ID = '00000000-0000-4000-8000-000000000002'
const OURS = makeTeam({ pokemon: [charmander, pikachu] })
const THEIRS = makeTeam({
  id: THEIR_ID,
  name: 'Misty’s team',
  owner: { username: MISTY.username },
  pokemon: [gengar, lapras],
})
const EDIT = `/teams/${TEAM_ID}/edit`
const AGAINST = `${EDIT}?against=${THEIR_ID}`

// How each of ours matches up against each of theirs, by their ids; even unless listed here.
const MATCHUPS: Record<number, Record<number, Partial<Matchup>>> = {
  [charmander.id]: { [lapras.id]: { rating: BAD, score: -1 } },
  [pikachu.id]: {
    [lapras.id]: {
      rating: GOOD,
      score: 1.25,
      attack: { type: PokemonType.ELECTRIC, multiplier: 2 },
      opponent_attack: { type: PokemonType.WATER, multiplier: 1 },
      speed: RelativeSpeed.FASTER,
    },
  },
}

const matchupOf: MatchupOf = (pokemon, opponentId) =>
  makeMatchup({ opponent_id: opponentId, ...MATCHUPS[pokemon.id]?.[opponentId] })

function renderEdit(path = AGAINST) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/teams/:teamId/edit" element={<TeamEditPage />} />
      </Routes>
      <Toaster />
    </>,
    { path },
  )
}

// Ash, editing `ours`, with Misty's team to match it up against.
function serveAsh(ours: Team = OURS) {
  serveSession({ signedIn: ASH })
  servePokemon({ items: [], next_cursor: null })
  return serveTeams({ teams: [ours, THEIRS], catalog: CATALOG, signedIn: ASH })
}

function panel() {
  return screen.findByRole('region', { name: 'Against Misty’s team' })
}

function ids(pokemon: Pokemon[]) {
  return pokemon.map((each) => each.id)
}

function query(ours: Pokemon[], theirs: Pokemon[]) {
  return [
    ...ids(ours).map((id) => `pokemon_id=${id}`),
    ...ids(theirs).map((id) => `opponent_id=${id}`),
  ].join('&')
}

describe('TeamEditPage, against the team in ?against', () => {
  it('shows their team, why each of ours is there, our best answer to each of theirs, and what’s covered', async () => {
    onWideScreen()
    serveAsh()
    const requests = serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    renderEdit()

    const against = await panel()
    expect(
      within(within(against).getByRole('list', { name: 'Their team' })).getAllByRole('listitem'),
    ).toHaveLength(2)
    expect(
      await within(against).findByText('No pick clearly beats Gengar', ON_SCREEN),
    ).toBeInTheDocument()
    // Asked for with our Pokémon, then theirs, each in battle order; and read out once loaded.
    expect(requests).toEqual([query([charmander, pikachu], [gengar, lapras])])
    expect(within(against).getByRole('status')).toHaveTextContent('No pick clearly beats Gengar')
    const picks = within(against).getByRole('list', { name: 'Your picks' })
    expect(within(picks).getAllByRole('listitem').map((pick) => pick.textContent)).toEqual([
      'CharmanderHolds its own against Gengar',
      'PikachuStrong against Lapras',
    ])
    const answers = within(against).getAllByRole('listitem').filter((item) =>
      within(against).getByRole('list', { name: 'Your best pick against each of their Pokémon' }).contains(item),
    )
    expect(answers[0]).toHaveTextContent('vs Gengar')
    expect(answers[0]).toHaveTextContent('Best pick: Charmander')
    expect(answers[0]).toHaveTextContent('Even')
    expect(answers[1]).toHaveTextContent('vs Lapras')
    expect(answers[1]).toHaveTextContent('Best pick: Pikachu')
    expect(answers[1]).toHaveTextContent('Good')
  })

  it('explains a best answer in a sentence when it’s tapped', async () => {
    onWideScreen()
    serveAsh()
    serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    const { user } = renderEdit()

    const against = await panel()
    await user.click(await within(against).findByRole('button', { name: /^Pikachu against Lapras/ }))

    expect(await screen.findByRole('dialog', { name: 'Pikachu against Lapras' })).toHaveTextContent(
      'Pikachu’s Electric moves are 2× against Lapras, and Lapras’s Water moves are neutral against Pikachu. Pikachu is faster.',
    )
  })

  it('matches up the team as it is changed', async () => {
    onWideScreen()
    serveAsh()
    const requests = serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    const { user } = renderEdit()

    const against = await panel()
    await within(against).findByText('No pick clearly beats Gengar', ON_SCREEN)
    await user.click(screen.getByRole('button', { name: 'Remove Pikachu' }))

    expect(
      await within(against).findByText('No pick clearly beats Gengar and Lapras', ON_SCREEN),
    ).toBeInTheDocument()
    expect(requests).toContain(query([charmander], [gengar, lapras]))
    const picks = within(against).getByRole('list', { name: 'Your picks' })
    expect(within(picks).getAllByRole('listitem').map((pick) => pick.textContent)).toEqual([
      'CharmanderHolds its own against Gengar',
    ])
  })

  it('asks for Pokémon while the team has none, without asking for matchups', async () => {
    onWideScreen()
    serveAsh(makeTeam())
    const requests = serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    renderEdit()

    const against = await panel()
    expect(within(against).getByText('Add Pokémon to see how they match up')).toBeInTheDocument()
    expect(requests).toEqual([])
  })

  it('says when the matchups need a sync first', async () => {
    onWideScreen()
    serveAsh()
    serveMatchups({ refuse: 503 })
    renderEdit()

    const against = await panel()
    expect(
      await within(against).findByText('Matchups need a Pokédex sync first'),
    ).toBeInTheDocument()
  })

  it('shows nothing for a team that doesn’t exist', async () => {
    onWideScreen()
    serveAsh()
    const requests = serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    const unknown = '00000000-0000-4000-8000-00000000dead'
    const { queryClient } = renderEdit(`${EDIT}?against=${unknown}`)

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toBeInTheDocument()
    // Once their team has been asked for and not found.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(screen.queryByRole('region', { name: /^Against/ })).not.toBeInTheDocument()
    expect(requests).toEqual([])
  })

  it('says when their team couldn’t load, and tries again', async () => {
    onWideScreen()
    serveAsh()
    serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    let fetches = 0
    server.use(
      http.get(`/api/teams/${THEIR_ID}`, () => {
        fetches += 1
        return HttpResponse.json({ detail: 'Refused.' }, { status: 500 })
      }),
    )
    const { user } = renderEdit()

    expect(await screen.findByText('Couldn’t load the team to match up against')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(fetches).toBe(2))
  })

  it('stops matching up on ×, with focus on the team’s slots', async () => {
    onWideScreen()
    serveAsh()
    serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    const { user, router } = renderEdit(`${AGAINST}&q=pika`)

    const against = await panel()
    await user.click(
      within(against).getByRole('button', { name: 'Stop matching up against Misty’s team' }),
    )

    expect(screen.queryByRole('region', { name: /^Against/ })).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=pika')
    expect(screen.getByRole('list', { name: 'Team, in battle order' })).toHaveFocus()
  })

  it('folds the picks and answers away on phones, until asked for', async () => {
    serveAsh()
    serveMatchups({ catalog: CATALOG, matchup: matchupOf })
    const { user } = renderEdit()

    const against = await panel()
    expect(
      await within(against).findByText('No pick clearly beats Gengar', ON_SCREEN),
    ).toBeVisible()
    const picks = within(against).getByRole('list', { name: 'Your picks' })
    expect(picks).not.toBeVisible()

    await user.click(within(against).getByText('Picks and best matchups'))

    expect(picks).toBeVisible()
  })
})
