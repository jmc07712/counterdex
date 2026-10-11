import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { serveSession, serveTeams } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamsPage } from './teams'

describe('TeamsPage', () => {
  it('asks someone signed out to sign in or sign up, then come back', async () => {
    serveSession()

    renderWithProviders(<TeamsPage />, { path: '/' })

    expect(await screen.findByText('Sign in to build teams')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2F',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up?next=%2F',
    )
  })

  it('says when it couldn’t check who’s signed in, rather than asking to sign in', async () => {
    const requests = serveSession({ refuse: { currentUser: 500 } })
    const { user } = renderWithProviders(<TeamsPage />, { path: '/' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t check whether you’re signed in',
    )
    expect(screen.queryByText('Sign in to build teams')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(requests.checks).toBe(2))
  })

  it('lists your teams, and only yours, each linking to its builder', async () => {
    serveSession({ signedIn: ASH })
    serveTeams({
      teams: [
        makeTeam({ name: 'Fire', pokemon: [catalog.charizard] }),
        makeTeam({
          id: '00000000-0000-4000-8000-00000000000a',
          name: 'Rain',
          owner: { username: MISTY.username },
          pokemon: [catalog.vaporeon],
        }),
      ],
    })

    renderWithProviders(<TeamsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Your teams' })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Your teams' })
    const cards = within(list).getAllByRole('link')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('href', `/teams/${TEAM_ID}`)
    expect(cards[0]).toHaveTextContent('Fire')
    expect(within(cards[0]).getByText('1 of 6')).toBeInTheDocument()
  })

  it.each([
    ['signed in', ASH],
    ['signed out', null],
  ])('says teams are public, and links to Explore, %s', async (_, signedIn) => {
    serveSession({ signedIn })
    serveTeams()

    renderWithProviders(<TeamsPage />)

    expect(
      await screen.findByText(/Anyone can see your teams on Explore, but only you can change them/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'See what other trainers have built' }),
    ).toHaveAttribute('href', '/explore')
  })

  it('invites you to build your first team', async () => {
    serveSession({ signedIn: ASH })
    serveTeams()

    renderWithProviders(<TeamsPage />)

    expect(await screen.findByText('Build your first team')).toBeInTheDocument()
  })

  it('creates one team however often New team is clicked while it’s creating', async () => {
    serveSession({ signedIn: ASH })
    const api = serveTeams({ signedIn: ASH })
    const { user, router } = renderWithProviders(<TeamsPage />)

    const button = await screen.findByRole('button', { name: 'New team' })
    await user.dblClick(button)

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}$/))
    expect(api.requests.filter((request) => request.method === 'PUT')).toHaveLength(1)
    expect(api.teams().map((team) => team.name)).toEqual(['Team 1'])
  })
})
