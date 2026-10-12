import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { routes } from '@/app/router'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { paths } from '@/config/paths'
import { servePokemon } from '@/test/handlers/pokemon'
import { holdNextCurrentUser, serveSession } from '@/test/handlers/session'
import { serveSyncStatus } from '@/test/handlers/sync'
import { serveTeams } from '@/test/handlers/teams'
import { onTouchScreen } from '@/test/media'
import { ON_SCREEN } from '@/test/queries'
import { renderRoutes, renderWithProviders } from '@/test/render'
import { holdRequests, refusal, server } from '@/test/server'
import { asMember, catalog, makeTeam } from '@/test/teams'
import { FIRE, RAIN, renderTeams } from '@/test/teams-page'
import { ASH } from '@/test/users'

import { TeamEditPage } from './team-edit'
import { TeamsPage } from './teams'

// Ash's, with no Pokémon yet.
const DRAFT = makeTeam({
  id: '00000000-0000-4000-8000-00000000000c',
  name: 'Draft',
  created_at: '2026-10-11T10:00:00Z',
})

describe('TeamsPage, before it knows who’s signed in', () => {
  it('shows no teams, so it never shows the wrong ones', async () => {
    serveSession({ signedIn: ASH })
    // Added last, so it answers the first check.
    const release = holdNextCurrentUser(ASH)
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })

    // Signed out, this would be everyone's teams.
    renderWithProviders(<TeamsPage />, { path: '/?scope=mine' })

    expect(screen.queryByRole('region', { name: 'Filters' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sign in to build teams')).not.toBeInTheDocument()
    release()

    expect(await screen.findByRole('radio', { name: 'My teams' })).toBeChecked()
    // Ash's teams were the first asked for: everyone's never were.
    await waitFor(() => expect(listQueries).toEqual(['owner=ash']))
  })

  it('says when it couldn’t check who’s signed in, rather than asking to sign in', async () => {
    const requests = serveSession({ refuse: { currentUser: 500 } })
    const { user } = renderWithProviders(<TeamsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t check whether you’re signed in',
    )
    expect(screen.queryByText('Sign in to build teams')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(requests.checks).toBe(2))
  })
})

describe('TeamsPage, signed in', () => {
  beforeEach(() => {
    serveSession({ signedIn: ASH })
  })

  it('opens on everyone’s teams, with a choice of your own', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })

    await renderTeams()

    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'My teams' })).not.toBeChecked()
    expect(await screen.findByRole('list', { name: 'Everyone’s teams' })).toBeInTheDocument()
    expect(listQueries).toEqual([''])
  })

  it('opens on everyone’s teams for a scope it doesn’t know', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })

    await renderTeams('/?scope=theirs')

    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked()
    await waitFor(() => expect(listQueries).toEqual(['']))
  })

  it('lists your teams, empty ones too, without saying whose they are', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })

    await renderTeams('/?scope=mine')

    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'My teams' })).toBeChecked()
    const list = await screen.findByRole('list', { name: 'My teams' })
    const cards = within(list).getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('link').getAttribute('href'))).toEqual([
      `/teams/${FIRE.id}`,
      `/teams/${DRAFT.id}`,
    ])
    expect(within(cards[0]).getByText('1 of 6')).toBeInTheDocument()
    expect(within(cards[1]).getByText('0 of 6')).toBeInTheDocument()
    expect(list).not.toHaveTextContent('by ash')
    expect(listQueries).toEqual(['owner=ash'])
  })

  it('switches to your teams, keeping the choice in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })
    const { user, router } = await renderTeams()
    const everyones = await screen.findByRole('list', { name: 'Everyone’s teams' })
    expect(within(everyones).getAllByRole('article').map((card) => card.textContent)).toEqual([
      expect.stringContaining('by misty'),
      expect.stringContaining('by ash'),
    ])

    await user.click(screen.getByRole('radio', { name: 'My teams' }))

    expect(await screen.findByRole('list', { name: 'My teams' })).toBeInTheDocument()
    expect(listQueries).toEqual(['', 'owner=ash'])
    expect(router.state.location.search).toBe('?scope=mine')

    await user.click(screen.getByRole('radio', { name: 'Everyone' }))

    expect(await screen.findByRole('list', { name: 'Everyone’s teams' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('shows no one else’s teams while yours load', async () => {
    serveTeams({ teams: [FIRE, RAIN] })
    // Your teams wait for `release`, then go to the stand-in.
    const yours = holdRequests('get', '/api/teams', (request) =>
      new URL(request.url).searchParams.has('owner'),
    )
    const { user } = await renderTeams()
    await screen.findByRole('article', { name: 'Rain' })
    const status = screen.getByRole('status')

    await user.click(screen.getByRole('radio', { name: 'My teams' }))

    expect(await screen.findByRole('list', { name: 'Loading teams' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Rain' })).not.toBeInTheDocument()
    yours.release()
    expect(await screen.findByRole('article', { name: 'Fire' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Rain' })).not.toBeInTheDocument()
    // The same status throughout, so what it says about your teams is read out.
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('1 team shown')
  })

  it('shows your teams at once when you go back to them, and says how many', async () => {
    serveTeams({ teams: [FIRE, RAIN, DRAFT] })
    const { user } = await renderTeams('/?scope=mine')
    await screen.findByRole('article', { name: 'Draft' })
    await user.click(screen.getByRole('radio', { name: 'Everyone' }))
    await screen.findByRole('article', { name: 'Rain' })
    const status = screen.getByRole('status')

    await user.click(screen.getByRole('radio', { name: 'My teams' }))

    const mine = screen.getByRole('list', { name: 'My teams' })
    expect(within(mine).getByRole('article', { name: 'Draft' })).toBeInTheDocument()
    expect(within(mine).queryByRole('article', { name: 'Rain' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBe(status)
    await waitFor(() => expect(status).toHaveTextContent('2 teams shown'))
  })

  it('filters your teams as it does everyone’s', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE] })
    const { user } = await renderTeams('/?scope=mine&q=fire')
    const types = screen.getByRole('toolbar', { name: 'Types' })

    await user.click(within(types).getByRole('button', { name: 'Fire' }))
    await user.click(screen.getByRole('radio', { name: 'Changed this week' }))

    await waitFor(() => expect(listQueries.at(-1)).toBe('q=fire&type=fire&changed=true&owner=ash'))
  })

  it('loads the next page of your teams', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT], pageSize: 1 })
    const { user } = await renderTeams('/?scope=mine')

    await screen.findByRole('article', { name: 'Fire' })
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('article', { name: 'Draft' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Rain' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    expect(listQueries.map((query) => new URLSearchParams(query).get('owner'))).toEqual([
      'ash',
      'ash',
    ])
  })

  it('keeps showing your teams when the filters are cleared', async () => {
    serveTeams({ teams: [FIRE, RAIN] })
    // Added last, so it answers first: nothing matches a search, and anything else goes on to
    // the stand-in.
    server.use(
      http.get('/api/teams', ({ request }) => {
        if (new URL(request.url).searchParams.has('q')) {
          return HttpResponse.json({ items: [], next_cursor: null })
        }
      }),
    )
    const { user, router } = await renderTeams('/?scope=mine&q=zzz')

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    const mine = await screen.findByRole('list', { name: 'My teams' })
    expect(within(mine).getByRole('article', { name: 'Fire' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'My teams' })).toBeChecked()
    expect(router.state.location.search).toBe('?scope=mine')
  })

  it('lists your teams by power as it does everyone’s', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })

    await renderTeams('/?scope=mine&sort=power')

    await waitFor(() => expect(listQueries).toEqual(['owner=ash&sort=power']))
    expect(screen.getByRole('radio', { name: 'Most powerful' })).toBeChecked()
  })

  it('keeps the sort as you switch whose teams are shown', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })
    const { user, router } = await renderTeams('/?sort=power')

    await user.click(screen.getByRole('radio', { name: 'My teams' }))

    await waitFor(() => expect(listQueries.at(-1)).toBe('owner=ash&sort=power'))
    expect(router.state.location.search).toBe('?scope=mine&sort=power')
  })

  it.each([
    ['everyone’s teams', '/?q=zzz&sort=power', '?sort=power', 'sort=power'],
    [
      'your teams',
      '/?scope=mine&q=zzz&sort=power',
      '?scope=mine&sort=power',
      'owner=ash&sort=power',
    ],
  ])(
    'keeps the sort when the filters are cleared on %s, as it isn’t a filter',
    async (_, path, search, query) => {
      const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })
      // Added last, so it answers first: nothing matches a search, and anything else goes on to
      // the stand-in.
      server.use(
        http.get('/api/teams', ({ request }) => {
          if (new URL(request.url).searchParams.has('q')) {
            return HttpResponse.json({ items: [], next_cursor: null })
          }
        }),
      )
      const { user, router } = await renderTeams(path)

      await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

      await screen.findByRole('article', { name: 'Fire' })
      expect(screen.getByRole('radio', { name: 'Most powerful' })).toBeChecked()
      expect(router.state.location.search).toBe(search)
      expect(listQueries.at(-1)).toBe(query)
    },
  )

  it('shows each team as six tiles: its members, in their types, then its empty slots', async () => {
    serveTeams({
      teams: [
        makeTeam({
          members: [
            asMember(catalog.charizard, 0),
            { ...asMember(catalog.pikachu, 1), removed_at: '2026-10-11T09:00:00Z' },
          ],
        }),
      ],
    })

    await renderTeams()

    const card = await screen.findByRole('article', { name: 'Team 1' })
    // Each catalog Pokémon's base stats add up to 540.
    expect(within(card).getByRole('meter', { name: 'Team power' })).toHaveAttribute(
      'aria-valuetext',
      '1,080',
    )
    // Decoration: the link names the team, so its tiles are hidden from assistive technology.
    // They're the card's first list, before its types.
    const [tileList] = within(card).getAllByRole('list', { hidden: true })
    const tiles = within(tileList).getAllByRole('listitem', { hidden: true })
    expect(tiles).toHaveLength(6)
    // A tile's sprite, hidden with it.
    const sprite = (tile: HTMLElement) => within(tile).queryByRole('presentation', { hidden: true })
    expect(tiles[0]).toHaveStyle({ backgroundColor: TYPE_STYLES.fire.background })
    expect(sprite(tiles[0])).toBeInTheDocument()
    // Removed from the Pokédex, so not painted in its type, but still there, and said so.
    expect(card).toHaveTextContent('Pikachu was removed from PokéAPI on Oct 11, 2026')
    expect(tiles[1]).not.toHaveStyle({ backgroundColor: TYPE_STYLES.electric.background })
    expect(sprite(tiles[1])).toBeInTheDocument()
    for (const empty of tiles.slice(2)) expect(sprite(empty)).not.toBeInTheDocument()
  })

  it('invites you to build your first team, or to browse everyone’s', async () => {
    serveTeams({ teams: [RAIN] })
    const { user, router } = await renderTeams('/?scope=mine')

    expect(await screen.findByText('No teams yet', ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByText('Pick up to six Pokémon and put them in battle order.')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('No teams yet')
    // Only the empty state's New team, not the header's as well, once it's known you have none.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'New team' })).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Browse everyone’s teams' }))

    expect(await screen.findByRole('article', { name: 'Rain' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked()
    expect(router.state.location.search).toBe('')
  })

  it.each([
    ['with a mouse, to the search', false, 'searchbox'],
    ['on a touch screen, to the results', true, 'region'],
  ] as const)(
    'moves focus when you browse everyone’s teams %s',
    async (_, touch, focused) => {
      if (touch) onTouchScreen()
      serveTeams({ teams: [RAIN] })
      const { user } = await renderTeams('/?scope=mine')

      await user.click(await screen.findByRole('button', { name: 'Browse everyone’s teams' }))

      const target =
        focused === 'searchbox'
          ? screen.getByRole('searchbox', { name: /Search teams/ })
          : screen.getByRole('region', { name: 'Results' })
      expect(target).toHaveFocus()
      expect(await screen.findByRole('article', { name: 'Rain' })).toBeInTheDocument()
    },
  )

  it('shows everyone’s teams once you sign out on yours', async () => {
    serveTeams({ teams: [FIRE, RAIN, DRAFT] })
    serveSyncStatus()
    const { user } = renderRoutes(routes, { path: '/?scope=mine' })
    await screen.findByRole('list', { name: 'My teams' })

    const [account] = await screen.findAllByRole('button', { name: 'Account: ash' })
    await user.click(account)
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByText('Sign in to build teams')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'My teams' })).not.toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Draft' })).not.toBeInTheDocument()
    const everyones = await screen.findByRole('list', { name: 'Everyone’s teams' })
    expect(within(everyones).getByRole('article', { name: 'Rain' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'My teams' })).not.toBeInTheDocument()
  })

  it('creates one team however often New team is clicked, and opens it to edit', async () => {
    const api = serveTeams({ signedIn: ASH })
    const { user, router } = await renderTeams()

    const button = await screen.findByRole('button', { name: 'New team' })
    await user.dblClick(button)

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}\/edit$/),
    )
    expect(api.requests.filter((request) => request.method === 'PUT')).toHaveLength(1)
    expect(api.teams().map((team) => team.name)).toEqual(['Team 1'])
  })

  it('puts New team beside the heading once you have a team, named after the next', async () => {
    const api = serveTeams({ teams: [FIRE], signedIn: ASH })
    const { user, router } = await renderTeams('/?scope=mine')
    await screen.findByRole('list', { name: 'My teams' })

    const button = await screen.findByRole('button', { name: 'New team' })
    const heading = screen.getByRole('heading', { level: 1, name: 'Teams' })
    // Next after the heading, before the filters and results.
    expect(heading.compareDocumentPosition(button)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    const filters = screen.getByRole('region', { name: 'Filters' })
    expect(button.compareDocumentPosition(filters)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByRole('region', { name: 'Results' })).not.toContainElement(button)
    await user.click(button)

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}\/edit$/),
    )
    expect(api.teams().map((team) => team.name)).toEqual(['Team 2', 'Fire'])
  })

  it.each([
    ['from the empty state, with no teams yet', [], ['Team 1']],
    ['from beside the heading, with a team', [FIRE], ['Team 2', 'Fire']],
  ])(
    'lists a new team made %s, once you go back to your teams',
    async (_, teams, listed) => {
      serveTeams({ teams, signedIn: ASH })
      servePokemon({ items: [], next_cursor: null })
      const { user } = renderRoutes(
        [
          { path: paths.home.path, element: <TeamsPage /> },
          { path: paths.teamEdit.path, element: <TeamEditPage /> },
        ],
        { path: '/?scope=mine' },
      )
      // Once your teams have loaded, so the list is there to go stale.
      await waitFor(() => expect(screen.getByRole('status')).not.toBeEmptyDOMElement())

      await user.click(screen.getByRole('button', { name: 'New team' }))
      await user.click(await screen.findByRole('link', { name: 'My teams' }))

      const mine = await screen.findByRole('list', { name: 'My teams' })
      await waitFor(() =>
        expect(
          within(mine)
            .getAllByRole('article')
            .map((card) => within(card).getByRole('heading').textContent),
        ).toEqual(listed),
      )
    },
  )

  it('offers New team before it knows how many teams you have, and if it can’t', async () => {
    serveTeams({ teams: [FIRE] })
    // Added last, so they answer first: counting your teams waits, then fails.
    server.use(http.get('/api/users/:username/teams', () => refusal(500)))
    const counting = holdRequests('get', '/api/users/:username/teams')

    await renderTeams('/?scope=mine')

    expect(screen.getByRole('button', { name: 'New team' })).toBeInTheDocument()
    counting.release()
    await screen.findByRole('article', { name: 'Fire' })
    expect(screen.getByRole('button', { name: 'New team' })).toBeInTheDocument()
  })

  it.each([
    ['your teams couldn’t load', '/?scope=mine', true, 'Couldn’t load teams'],
    ['a filter finds none of your teams', '/?scope=mine&q=zzz', false, 'No teams match these filters'],
  ])('offers New team when %s, though you have none', async (_, path, failing, message) => {
    serveTeams()
    // Added last, so it answers first: listing teams fails; counting yours finds none.
    if (failing) server.use(http.get('/api/teams', () => refusal(500)))

    await renderTeams(path)

    expect(await screen.findByText(message, ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New team' })).toBeInTheDocument()
  })

  it('offers New team while showing everyone’s teams too', async () => {
    serveTeams({ teams: [RAIN] })

    await renderTeams()

    expect(await screen.findByRole('button', { name: 'New team' })).toBeInTheDocument()
  })

  it('offers to counter everyone’s teams but your own', async () => {
    serveTeams({ teams: [FIRE, RAIN, DRAFT] })
    const { user } = await renderTeams()

    const rain = await screen.findByRole('article', { name: 'Rain' })
    expect(within(rain).getByRole('button', { name: 'Build a counter to Rain' })).toBeVisible()
    const fire = screen.getByRole('article', { name: 'Fire' })
    expect(within(fire).queryByRole('button')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'My teams' }))

    const mine = await screen.findByRole('list', { name: 'My teams' })
    expect(within(mine).getAllByRole('article')).toHaveLength(2)
    expect(within(mine).queryByRole('button')).not.toBeInTheDocument()
  })
})
