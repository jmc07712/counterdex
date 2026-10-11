import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { Team } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import { holdTeamChanges, servePokemon, serveSession, serveTeams } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH } from '@/test/users'

import { TeamPage } from './team'

const { charmander, charizard, pikachu } = catalog
const CATALOG = Object.values(catalog)

function renderTeam(teamId = TEAM_ID) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
      <Toaster />
    </>,
    { path: `/teams/${teamId}` },
  )
}

function memberIds(team: Team) {
  return team.members.map((member) => member.pokemon.id)
}

describe('TeamPage', () => {
  it('adds a Pokémon through the slot picker', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({ teams: [makeTeam({ pokemon: [charmander] })], catalog: CATALOG })
    servePokemon({ items: [pikachu, charizard], next_cursor: null })
    const { user } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Add a Pokémon to slot 2' }))
    await user.click(await screen.findByRole('button', { name: /Pikachu/ }))

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([4, 25]))
    expect(await screen.findByText('Added Pikachu to Team 1')).toBeInTheDocument()
  })

  it('offers to replace an earlier stage of the evolution line', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({ teams: [makeTeam({ pokemon: [charmander] })], catalog: CATALOG })
    servePokemon({ items: [charizard], next_cursor: null })
    const { user } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Add a Pokémon to slot 2' }))
    await user.click(await screen.findByRole('button', { name: /Charizard/ }))
    await user.click(await screen.findByRole('button', { name: 'Replace Charmander' }))

    await waitFor(() => expect(memberIds(api.teams()[0])).toEqual([6]))
  })

  it('shows a species already on the team as such in the picker', async () => {
    serveSession({ signedIn: ASH })
    serveTeams({ teams: [makeTeam({ pokemon: [charizard] })], catalog: CATALOG })
    servePokemon({ items: [catalog.charizardMegaX], next_cursor: null })
    const { user } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Add a Pokémon to slot 2' }))

    expect(await screen.findByRole('button', { name: /Charizard Mega X/ })).toBeDisabled()
  })

  it('removes a Pokémon at once, before the API answers', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({
      teams: [makeTeam({ pokemon: [charmander, pikachu] })],
      catalog: CATALOG,
    })
    const hold = holdTeamChanges()
    const { user } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))

    expect(screen.queryByText('Charmander')).not.toBeInTheDocument()
    hold.release()
    await waitFor(() => expect(api.teams()[0].members).toHaveLength(1))
  })

  it('sends changes to a team one at a time, in order', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({
      teams: [makeTeam({ pokemon: [charmander, pikachu] })],
      catalog: CATALOG,
    })
    const hold = holdTeamChanges()
    const { user } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))
    await user.click(screen.getByRole('button', { name: 'Remove Pikachu' }))
    await waitFor(() => expect(hold.arrived()).toBe(1))
    // Given time, the second still hasn't been sent: it waits for the first, which is held.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(hold.arrived()).toBe(1)

    hold.release()

    await waitFor(() => expect(api.teams()[0].members).toEqual([]))
    expect(api.requests.map((request) => request.path)).toEqual([
      `/api/teams/${TEAM_ID}/members/4`,
      `/api/teams/${TEAM_ID}/members/25`,
    ])
  })

  it('undoes a change the API refuses, and says why', async () => {
    serveSession({ signedIn: ASH })
    serveTeams({ teams: [makeTeam({ pokemon: [charmander] })], catalog: CATALOG })
    server.use(
      http.delete('/api/teams/:teamId/members/:pokemonId', () =>
        HttpResponse.json({ detail: 'Refused.', reason: 'order_out_of_date' }, { status: 409 }),
      ),
    )
    const { user } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Remove Charmander' }))

    expect(
      await screen.findByText('This team changed somewhere else, so it’s been reloaded.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Charmander')).toBeInTheDocument()
  })

  it('renames on Enter, and puts back a blank name', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({ teams: [makeTeam()], catalog: CATALOG })
    const { user } = renderTeam()

    const name = await screen.findByRole('textbox', { name: 'Team name' })
    await user.clear(name)
    await user.type(name, '   {Enter}')
    expect(name).toHaveValue('Team 1')
    expect(api.requests).toHaveLength(0)

    await user.clear(name)
    await user.type(name, 'Rain{Enter}')
    await waitFor(() => expect(api.teams()[0].name).toBe('Rain'))
    expect(api.requests).toEqual([
      { method: 'PATCH', path: `/api/teams/${TEAM_ID}`, body: { name: 'Rain' } },
    ])
  })

  it('stops a name at 40 characters', async () => {
    serveSession({ signedIn: ASH })
    serveTeams({ teams: [makeTeam()], catalog: CATALOG })
    renderTeam()

    expect(await screen.findByRole('textbox', { name: 'Team name' })).toHaveAttribute(
      'maxlength',
      '40',
    )
  })

  it('deletes after you confirm, then goes home', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({ teams: [makeTeam()], catalog: CATALOG })
    const { user, router } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Team actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete team' }))
    await user.click(await screen.findByRole('button', { name: 'Delete team' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(api.teams()).toEqual([])
  })

  it('keeps the team if you don’t confirm, with focus back on its menu', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({ teams: [makeTeam()], catalog: CATALOG })
    const { user } = renderTeam()

    const menu = await screen.findByRole('button', { name: 'Team actions' })
    await user.click(menu)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete team' }))
    await user.click(await screen.findByRole('button', { name: 'Keep it' }))

    await waitFor(() => expect(menu).toHaveFocus())
    expect(api.requests).toHaveLength(0)
  })

  it('says when a team doesn’t exist', async () => {
    serveSession({ signedIn: ASH })
    serveTeams()

    renderTeam()

    expect(await screen.findByText('This team doesn’t exist')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/')
  })

  it('asks someone signed out to sign in, and come back to the team', async () => {
    serveSession()

    renderTeam()

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/sign-in?next=%2Fteams%2F${TEAM_ID}`,
    )
  })
})
