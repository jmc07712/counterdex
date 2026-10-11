import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { describe, expect, it } from 'vitest'

import { serveTeams } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam } from '@/test/teams'

import { ExplorePage } from './explore'

// The results status reads an empty state's title out too; text queries skip it to find the one
// on screen.
const ON_SCREEN = { ignore: '[role=status]' }

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
  it('lists the teams in the API’s order, each by its owner and linking to it', async () => {
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

  it('loads more teams as the end of the list scrolls into view', async () => {
    serveTeams({ teams: [FIRE, RAIN], pageSize: 1 })
    renderWithProviders(<ExplorePage />)
    await screen.findByRole('link', { name: /Rain/ })

    mockAllIsIntersecting(true)

    expect(await screen.findByRole('link', { name: /Fire/ })).toBeInTheDocument()
  })

  it('searches by team name, trainer or Pokémon once you pause typing', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })
    const { user, router } = renderWithProviders(<ExplorePage />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search teams, trainers or Pokémon' }),
      ' rain ',
    )

    // One request for the whole search, none for each letter on the way.
    await waitFor(() => expect(listQueries).toEqual(['', 'q=rain']))
    expect(router.state.location.search).toBe('?q=+rain+')
  })

  it('filters by every type picked, with no limit on how many', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })
    const { user, router } = renderWithProviders(<ExplorePage />)
    const types = screen.getByRole('toolbar', { name: 'Types' })

    for (const type of ['Water', 'Fire', 'Grass']) {
      await user.click(within(types).getByRole('button', { name: type }))
    }

    await waitFor(() => expect(listQueries.at(-1)).toBe('type=water&type=fire&type=grass'))
    for (const type of ['Water', 'Fire', 'Grass']) {
      expect(within(types).getByRole('button', { name: type })).toBePressed()
    }
    expect(router.state.location.search).toBe('?type=water&type=fire&type=grass')
  })

  it('can list only the teams a sync changed this week', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })
    const { user, router } = renderWithProviders(<ExplorePage />)

    await user.click(screen.getByRole('radio', { name: 'Changed this week' }))

    await waitFor(() => expect(listQueries.at(-1)).toBe('changed=true'))
    expect(router.state.location.search).toBe('?view=changed')
  })

  it('always keeps one view chosen', async () => {
    serveTeams({ teams: [RAIN] })
    const { user, router } = renderWithProviders(<ExplorePage />)

    await user.click(screen.getByRole('radio', { name: 'All teams' }))

    expect(screen.getByRole('radio', { name: 'All teams' })).toBeChecked()
    expect(router.state.location.search).toBe('')
  })

  it('starts from the filters in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    renderWithProviders(<ExplorePage />, {
      path: '/?q=rain&type=water&type=fire&view=changed',
    })

    await waitFor(() => expect(listQueries).toEqual(['q=rain&type=water&type=fire&changed=true']))
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveValue('rain')
    expect(screen.getByRole('button', { name: 'Water' })).toBePressed()
    expect(screen.getByRole('button', { name: 'Fire' })).toBePressed()
    expect(screen.getByRole('radio', { name: 'Changed this week' })).toBeChecked()
  })

  it('keeps a search within the 50 characters the API takes', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    renderWithProviders(<ExplorePage />, { path: `/?q=${'a'.repeat(60)}` })

    await waitFor(() => expect(listQueries).toEqual([`q=${'a'.repeat(50)}`]))
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveAttribute(
      'maxlength',
      '50',
    )
  })

  it('ignores what isn’t a filter in a hand-edited URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    renderWithProviders(<ExplorePage />, { path: '/?type=fire&type=lava&type=fire&view=old' })

    await waitFor(() => expect(listQueries).toEqual(['type=fire']))
    expect(screen.getByRole('radio', { name: 'All teams' })).toBeChecked()
  })

  it.each([
    ['About views', 'Changed this week is the teams with a Pokémon a sync changed'],
    ['About types', 'Teams with a Pokémon of every type you pick'],
  ])('explains a filter from its info button: %s', async (button, explanation) => {
    serveTeams({ teams: [RAIN] })
    const { user } = renderWithProviders(<ExplorePage />)

    await user.click(screen.getByRole('button', { name: button }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(explanation)
  })

  it('offers to clear the filters when no team matches', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })
    // Added last, so it answers first: nothing matches a search, and anything else goes on to
    // the stand-in.
    server.use(
      http.get('/api/teams', ({ request }) => {
        if (new URL(request.url).searchParams.has('q')) {
          return HttpResponse.json({ items: [], next_cursor: null })
        }
      }),
    )
    const { user, router } = renderWithProviders(<ExplorePage />, { path: '/?q=zzz&type=fire' })

    expect(await screen.findByText('No teams match these filters', ON_SCREEN)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByRole('link', { name: /Rain/ })).toBeInTheDocument()
    expect(listQueries).toEqual([''])
    expect(router.state.location.search).toBe('')
  })

  it('says when no team has changed this week', async () => {
    serveTeams()

    renderWithProviders(<ExplorePage />, { path: '/?view=changed' })

    expect(await screen.findByText('No recent changes', ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('tells screen readers how many teams it shows, and when more can load', async () => {
    serveTeams({ teams: [FIRE, RAIN], pageSize: 1 })
    const { user } = renderWithProviders(<ExplorePage />)

    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('1 team shown, more to load'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(status).toHaveTextContent('2 teams shown'))
    expect(status).not.toHaveTextContent('more')
  })

  it('tells screen readers what the new filters found once it loads', async () => {
    serveTeams({ teams: [RAIN] })
    let release = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    // Added last, so it answers first: a search waits for `release`, then finds nothing.
    server.use(
      http.get('/api/teams', async ({ request }) => {
        if (!new URL(request.url).searchParams.has('q')) return
        await released
        return HttpResponse.json({ items: [], next_cursor: null })
      }),
    )
    const { user } = renderWithProviders(<ExplorePage />)
    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('1 team shown'))

    await user.type(screen.getByRole('searchbox', { name: /Search teams/ }), 'zzz')

    // Nothing while the last results stand in for the new ones.
    await waitFor(() => expect(status).toBeEmptyDOMElement())
    release()
    await waitFor(() => expect(status).toHaveTextContent('No teams match these filters'))
  })

  it('says when there are no teams yet', async () => {
    serveTeams()

    renderWithProviders(<ExplorePage />)

    expect(await screen.findByText('No teams yet', ON_SCREEN)).toBeInTheDocument()
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
