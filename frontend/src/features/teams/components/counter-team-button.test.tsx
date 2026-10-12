import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { Team } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import { holdCounterTeams, serveCounterTeam } from '@/test/handlers/counter'
import { serveSession } from '@/test/handlers/session'
import { serveTeams } from '@/test/handlers/teams'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { asMember, catalog, makeTeam } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { CounterTeamButton } from './counter-team-button'

const { charizard, pikachu, gengar, lapras, vaporeon, snorlax, dragonite } = catalog

// Misty's, with Lapras since removed from the Pokédex.
const RAIN = makeTeam({
  id: '00000000-0000-4000-8000-00000000000a',
  name: 'Rain',
  owner: { username: MISTY.username },
  members: [
    asMember(vaporeon, 0),
    { ...asMember(lapras, 1), removed_at: '2026-10-11T09:00:00Z' },
    asMember(snorlax, 2),
  ],
})

// What the counter-team stand-in picks from: for Rain, Pikachu, Gengar and Dragonite.
const PICKS = [pikachu, gengar, dragonite, charizard]

const EDIT_PAGE = /^\/teams\/([0-9a-f-]{36})\/edit$/

function renderButton(team: Team, { path = '/' } = {}) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/" element={<CounterTeamButton team={team} />} />
        <Route path="/teams/:teamId/edit" element={<p>Editing</p>} />
      </Routes>
      <Toaster />
    </>,
    { path },
  )
}

// Ash, signed in, with Rain among the teams.
function serveAsh(teams: Team[] = [RAIN]) {
  serveSession({ signedIn: ASH })
  return serveTeams({ teams, catalog: Object.values(catalog), signedIn: ASH })
}

function creations(api: ReturnType<typeof serveTeams>) {
  return api.requests.filter((request) => request.method === 'PUT')
}

describe('CounterTeamButton, signed in', () => {
  it('builds a counter to the team as a new team, then opens it to edit', async () => {
    const api = serveAsh()
    const counters = serveCounterTeam({ catalog: PICKS })
    const { user, router } = renderButton(RAIN)

    await user.click(await screen.findByRole('button', { name: 'Build a counter to Rain' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    const [, teamId] = EDIT_PAGE.exec(router.state.location.pathname) ?? []
    // Their Pokémon in battle order, the removed one too.
    expect(counters).toEqual([
      `pokemon_id=${vaporeon.id}&pokemon_id=${lapras.id}&pokemon_id=${snorlax.id}`,
    ])
    // The counter's Pokémon in its battle order.
    expect(creations(api)).toEqual([
      {
        method: 'PUT',
        path: `/api/teams/${teamId}`,
        body: { name: 'Counter to Rain', pokemon_ids: [pikachu.id, gengar.id, dragonite.id] },
      },
    ])
  })

  it('shortens a long team name to fit the counter’s name', async () => {
    const team = { ...RAIN, name: 'The Extremely Long Team Name Of Doom!!' }
    const api = serveAsh([team])
    serveCounterTeam({ catalog: PICKS })
    const { user, router } = renderButton(team)

    await user.click(
      await screen.findByRole('button', {
        name: 'Build a counter to The Extremely Long Team Name Of Doom!!',
      }),
    )

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(creations(api).map((request) => request.body)).toEqual([
      expect.objectContaining({ name: 'Counter to The Extremely Long Team Name…' }),
    ])
  })

  it('shows it’s building, and builds one team however often it’s clicked', async () => {
    const api = serveAsh()
    const counters = serveCounterTeam({ catalog: PICKS })
    const held = holdCounterTeams()
    const { router } = renderButton(RAIN)

    const button = await screen.findByRole('button', { name: 'Build a counter to Rain' })
    expect(button).toHaveAttribute('aria-busy', 'false')
    button.focus()
    // Both before it renders again, as a quick double-click can be.
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'))
    expect(button).toHaveAccessibleName('Building a counter to Rain')
    // Disabled only for assistive technology, so it keeps focus and takes stray taps itself.
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toBeEnabled()
    expect(button).toHaveFocus()
    fireEvent.click(button)
    await waitFor(() => expect(held.arrived()).toBe(1))
    held.release()

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(counters).toHaveLength(1)
    expect(creations(api)).toHaveLength(1)
  })

  it('says a counter team needs a Pokédex sync first, and makes no team', async () => {
    const api = serveAsh()
    serveCounterTeam({ refuse: 503 })
    const { user, router } = renderButton(RAIN)

    const button = await screen.findByRole('button', { name: 'Build a counter to Rain' })
    await user.click(button)

    expect(await screen.findByText('Counter teams need a Pokédex sync first')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(creations(api)).toEqual([])
    expect(router.state.location.pathname).toBe('/')
    expect(button).toHaveAttribute('aria-disabled', 'false')
    expect(button).toHaveAccessibleName('Build a counter to Rain')
    expect(button).toHaveFocus()
  })

  it('says when it couldn’t find a counter, makes no team, and tries again', async () => {
    const api = serveAsh()
    const counters = serveCounterTeam({ catalog: PICKS })
    // Added last, so it answers the first request; the stand-in answers the next.
    server.use(
      http.get(
        '/api/counter-team',
        () => HttpResponse.json({ detail: 'Refused.' }, { status: 500 }),
        { once: true },
      ),
    )
    const { user, router } = renderButton(RAIN)

    await user.click(await screen.findByRole('button', { name: 'Build a counter to Rain' }))

    expect(await screen.findByText('Couldn’t build a counter team')).toBeInTheDocument()
    expect(creations(api)).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(counters).toHaveLength(1)
    expect(creations(api)).toHaveLength(1)
  })

  it('says when it couldn’t save the counter team', async () => {
    serveSession({ signedIn: ASH })
    serveCounterTeam({ catalog: PICKS })
    // Signed out by the time it saves, so the API refuses.
    const api = serveTeams({ teams: [RAIN], catalog: Object.values(catalog) })
    const { user, router } = renderButton(RAIN)

    await user.click(await screen.findByRole('button', { name: 'Build a counter to Rain' }))

    expect(await screen.findByText('Couldn’t build a counter team')).toBeInTheDocument()
    expect(creations(api)).toHaveLength(1)
    expect(api.teams()).toEqual([RAIN])
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('CounterTeamButton, signed out', () => {
  it('links to signing in, then back to this page', async () => {
    serveSession()
    const counters = serveCounterTeam({ catalog: PICKS })

    renderButton(RAIN, { path: '/?q=rain' })

    expect(await screen.findByRole('link', { name: 'Build a counter to Rain' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2F%3Fq%3Drain',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(counters).toEqual([])
  })
})
