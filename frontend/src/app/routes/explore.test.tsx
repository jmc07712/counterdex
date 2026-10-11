import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { serveTeams } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam } from '@/test/teams'

import { ExplorePage } from './explore'

const RAIN = makeTeam({
  id: '00000000-0000-4000-8000-00000000000a',
  name: 'Rain',
  owner: { username: 'misty' },
  created_at: '2026-10-11T12:00:00Z',
  pokemon: [catalog.vaporeon],
})
const FIRE = makeTeam({
  id: '00000000-0000-4000-8000-00000000000b',
  name: 'Fire',
  created_at: '2026-10-11T11:00:00Z',
  pokemon: [catalog.charizard],
})

describe('ExplorePage', () => {
  it('lists everyone’s teams, newest first, each by its owner and linking to it', async () => {
    serveTeams({ teams: [FIRE, RAIN, makeTeam({ name: 'Nothing yet' })] })

    renderWithProviders(<ExplorePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Explore teams' })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Explore teams' })
    const cards = within(list).getAllByRole('link')
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      `/teams/${RAIN.id}`,
      `/teams/${FIRE.id}`,
    ])
    expect(cards[0]).toHaveTextContent('by misty')
    expect(cards[1]).toHaveTextContent('by ash')
  })

  it('loads the next page of teams', async () => {
    serveTeams({ teams: [FIRE, RAIN], pageSize: 1 })
    const { user } = renderWithProviders(<ExplorePage />)

    await screen.findByRole('link', { name: /Rain/ })
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('link', { name: /Fire/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rain/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('says when there are no teams yet', async () => {
    serveTeams()

    renderWithProviders(<ExplorePage />)

    expect(await screen.findByText('No teams yet')).toBeInTheDocument()
  })

  it('says when the teams couldn’t load, and tries again', async () => {
    let requests = 0
    server.use(
      http.get('/api/teams', () => {
        requests += 1
        return HttpResponse.json({ detail: 'Refused.' }, { status: 500 })
      }),
    )
    const { user } = renderWithProviders(<ExplorePage />)

    expect(await screen.findByText('Couldn’t load teams')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(requests).toBe(2))
  })
})
