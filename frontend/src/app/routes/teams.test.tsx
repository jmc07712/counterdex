import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { routes } from '@/app/router'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { paths } from '@/config/paths'
import { serveCounterTeam } from '@/test/handlers/counter'
import { servePokemon } from '@/test/handlers/pokemon'
import { holdNextCurrentUser, serveSession } from '@/test/handlers/session'
import { serveSyncStatus } from '@/test/handlers/sync'
import { serveTeams } from '@/test/handlers/teams'
import { onTouchScreen } from '@/test/media'
import { ON_SCREEN } from '@/test/queries'
import { renderRoutes, renderWithProviders } from '@/test/render'
import { holdRequests, refusal, server } from '@/test/server'
import { asMember, catalog, makeTeam } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamEditPage } from './team-edit'
import { TeamsPage } from './teams'

const RAIN = makeTeam({
  id: '00000000-0000-4000-8000-00000000000a',
  name: 'Rain',
  owner: { username: MISTY.username },
  created_at: '2026-10-11T12:00:00Z',
  pokemon: [catalog.vaporeon],
})
const FIRE = makeTeam({
  id: '00000000-0000-4000-8000-00000000000b',
  name: 'Fire',
  created_at: '2026-10-11T11:00:00Z',
  pokemon: [catalog.charizard],
})
// Ash's, with no Pokémon yet.
const DRAFT = makeTeam({
  id: '00000000-0000-4000-8000-00000000000c',
  name: 'Draft',
  created_at: '2026-10-11T10:00:00Z',
})

// Renders the Teams page at `path`, and waits for its filters, which show once it knows who's
// signed in.
async function renderTeams(path = '/') {
  const rendered = renderWithProviders(<TeamsPage />, { path })
  await screen.findByRole('region', { name: 'Filters' })
  return rendered
}

describe('TeamsPage, signed out', () => {
  beforeEach(() => {
    serveSession()
  })

  it('asks you to sign in or sign up to build teams, then shows you your own', async () => {
    serveTeams()

    await renderTeams()

    expect(screen.getByText('Sign in to build teams')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2F%3Fscope%3Dmine',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up?next=%2F%3Fscope%3Dmine',
    )
  })

  it.each(['/', '/?scope=mine'])(
    'lists everyone’s teams at %s, with no choice of whose',
    async (path) => {
      const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })

      await renderTeams(path)

      expect(await screen.findByRole('list', { name: 'Everyone’s teams' })).toBeInTheDocument()
      expect(listQueries).toEqual([''])
      expect(screen.queryByRole('radio', { name: 'My teams' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'New team' })).not.toBeInTheDocument()
    },
  )
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
    expect(tiles[0]).toHaveStyle({ backgroundColor: TYPE_STYLES.fire.background })
    expect(tiles[0].querySelector('img')).toBeInTheDocument()
    // Removed from the Pokédex, so not painted in its type, but still there, and said so.
    expect(card).toHaveTextContent('Pikachu was removed from PokéAPI on Oct 11, 2026')
    expect(tiles[1]).not.toHaveStyle({ backgroundColor: TYPE_STYLES.electric.background })
    expect(tiles[1].querySelector('img')).toBeInTheDocument()
    for (const empty of tiles.slice(2)) expect(empty.querySelector('img')).not.toBeInTheDocument()
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
    expect(heading.parentElement).toContainElement(button)
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
            .map((card) => card.querySelector('h2')?.textContent),
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

  it('offers New team when your teams couldn’t load, though you have none', async () => {
    serveTeams()
    // Added last, so it answers first: listing teams fails; counting yours finds none.
    server.use(
      http.get('/api/teams', () => HttpResponse.json({ detail: 'Refused.' }, { status: 500 })),
    )

    await renderTeams('/?scope=mine')

    expect(await screen.findByText('Couldn’t load teams')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New team' })).toBeInTheDocument()
  })

  it('offers New team when a filter finds none of your teams, though you have none', async () => {
    serveTeams()

    await renderTeams('/?scope=mine&q=zzz')

    expect(await screen.findByText('No teams match these filters', ON_SCREEN)).toBeInTheDocument()
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

  it('builds a counter to a team from its card, then opens it to edit', async () => {
    const api = serveTeams({ teams: [RAIN], catalog: Object.values(catalog), signedIn: ASH })
    const counters = serveCounterTeam({ catalog: [catalog.pikachu] })
    const { user, router } = await renderTeams()

    await user.click(await screen.findByRole('button', { name: 'Build a counter to Rain' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}\/edit$/),
    )
    expect(counters).toEqual([`pokemon_id=${catalog.vaporeon.id}`])
    expect(api.teams()[0]).toMatchObject({
      name: 'Counter to Rain',
      owner: { username: ASH.username },
      members: [asMember(catalog.pikachu, 0)],
    })
  })
})

describe.each([
  ['signed in', ASH],
  ['signed out', null],
])('TeamsPage, %s', (_, signedIn) => {
  it('says teams are public', async () => {
    serveSession({ signedIn })
    serveTeams()

    await renderTeams()

    expect(
      screen.getByText(/Teams are public: anyone can see them, but only their owner can change one/),
    ).toBeInTheDocument()
  })
})

// Signed out, so everyone's teams.
describe('TeamsPage, everyone’s teams', () => {
  beforeEach(() => {
    serveSession()
  })

  it('lists the teams in the API’s order, each by its owner and linking to it', async () => {
    serveTeams({ teams: [FIRE, RAIN, makeTeam({ name: 'Nothing yet' })] })

    await renderTeams()

    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Everyone’s teams' })
    expect(within(list).getAllByRole('article')).toEqual([
      screen.getByRole('article', { name: 'Rain' }),
      screen.getByRole('article', { name: 'Fire' }),
    ])
    expect(screen.getByRole('link', { name: /^Rain 1 of 6 by misty/ })).toHaveAttribute(
      'href',
      `/teams/${RAIN.id}`,
    )
    expect(screen.getByRole('link', { name: /^Fire 1 of 6 by ash/ })).toHaveAttribute(
      'href',
      `/teams/${FIRE.id}`,
    )
  })

  it('offers to sign in to counter a team, then come back', async () => {
    serveTeams({ teams: [RAIN] })

    await renderTeams('/?q=rain')

    const rain = await screen.findByRole('article', { name: 'Rain' })
    expect(within(rain).getByRole('link', { name: 'Build a counter to Rain' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2F%3Fq%3Drain',
    )
  })

  it('loads the next page of teams', async () => {
    serveTeams({ teams: [FIRE, RAIN], pageSize: 1 })
    const { user } = await renderTeams()

    await screen.findByRole('article', { name: 'Rain' })
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('article', { name: 'Fire' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Rain' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('sends the search once you pause typing, and keeps it in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })
    const { user, router } = await renderTeams()

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
    const { user, router } = await renderTeams()
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
    const { user, router } = await renderTeams()

    await user.click(screen.getByRole('radio', { name: 'Changed this week' }))

    await waitFor(() => expect(listQueries.at(-1)).toBe('changed=true'))
    expect(router.state.location.search).toBe('?view=changed')
  })

  it('opens on the newest teams, and asks for no sort', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams()

    expect(screen.getByRole('radio', { name: 'Newest' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Most powerful' })).not.toBeChecked()
    await waitFor(() => expect(listQueries).toEqual(['']))
  })

  it('can list the most powerful teams first, keeping the choice in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })
    const { user, router } = await renderTeams()

    await user.click(screen.getByRole('radio', { name: 'Most powerful' }))

    await waitFor(() => expect(listQueries.at(-1)).toBe('sort=power'))
    expect(screen.getByRole('radio', { name: 'Most powerful' })).toBeChecked()
    expect(router.state.location.search).toBe('?sort=power')

    await user.click(screen.getByRole('radio', { name: 'Newest' }))

    expect(screen.getByRole('radio', { name: 'Newest' })).toBeChecked()
    expect(router.state.location.search).toBe('')
  })

  it('lists the teams in the order the API gives, newest or most powerful', async () => {
    serveTeams({ teams: [FIRE, RAIN] })
    // Added last, so it answers first: asked for the most powerful, the API puts Fire first.
    server.use(
      http.get('/api/teams', ({ request }) => {
        if (new URL(request.url).searchParams.get('sort') === 'power') {
          return HttpResponse.json({ items: [FIRE, RAIN], next_cursor: null })
        }
      }),
    )
    const { user } = await renderTeams()
    const names = () =>
      within(screen.getByRole('list', { name: 'Everyone’s teams' }))
        .getAllByRole('article')
        .map((card) => card.querySelector('h2')?.textContent)
    await waitFor(() => expect(names()).toEqual(['Rain', 'Fire']))

    await user.click(screen.getByRole('radio', { name: 'Most powerful' }))

    await waitFor(() => expect(names()).toEqual(['Fire', 'Rain']))
  })

  it('starts from the filters in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams('/?q=rain&type=water&type=fire&view=changed')

    await waitFor(() => expect(listQueries).toEqual(['q=rain&type=water&type=fire&changed=true']))
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveValue('rain')
    expect(screen.getByRole('button', { name: 'Water' })).toBePressed()
    expect(screen.getByRole('button', { name: 'Fire' })).toBePressed()
    expect(screen.getByRole('radio', { name: 'Changed this week' })).toBeChecked()
  })

  it('starts from the sort in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams('/?sort=power')

    await waitFor(() => expect(listQueries).toEqual(['sort=power']))
    expect(screen.getByRole('radio', { name: 'Most powerful' })).toBeChecked()
  })

  it('asks for no sort when the URL names the newest, which is the default', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams('/?sort=newest')

    await waitFor(() => expect(listQueries).toEqual(['']))
    expect(screen.getByRole('radio', { name: 'Newest' })).toBeChecked()
  })

  it('lists the newest teams for a sort it doesn’t know', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams('/?sort=weakest')

    await waitFor(() => expect(listQueries).toEqual(['']))
    expect(screen.getByRole('radio', { name: 'Newest' })).toBeChecked()
  })

  it('keeps a search within the 50 characters the API takes', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams(`/?q=${'a'.repeat(60)}`)

    await waitFor(() => expect(listQueries).toEqual([`q=${'a'.repeat(50)}`]))
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveAttribute(
      'maxlength',
      '50',
    )
  })

  it('ignores what isn’t a filter in a hand-edited URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams('/?type=fire&type=lava&type=fire&view=old&scope=mine')

    await waitFor(() => expect(listQueries).toEqual(['type=fire']))
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  })

  it.each([
    ['About what’s shown', 'Changed this week is the teams with a Pokémon a sync changed'],
    ['About sorting', 'Most powerful: the sum of each team’s base stats, highest first.'],
    ['About types', 'Teams with a Pokémon of every type you pick'],
  ])('explains a filter from its info button: %s', async (button, explanation) => {
    serveTeams({ teams: [RAIN] })
    const { user } = await renderTeams()

    await user.click(screen.getByRole('button', { name: button }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(explanation)
  })

  it('offers to clear the filters when no team matches, then waits in the search', async () => {
    serveTeams({ teams: [RAIN] })
    const queries: string[] = []
    // Added last, so it answers first: it notes every request, nothing matches a search, and
    // anything else goes on to the stand-in.
    server.use(
      http.get('/api/teams', ({ request }) => {
        const query = new URL(request.url).searchParams
        queries.push(query.toString())
        if (query.has('q')) return HttpResponse.json({ items: [], next_cursor: null })
      }),
    )
    const { user, router } = await renderTeams('/?q=zzz&type=fire')

    expect(await screen.findByText('No teams match these filters', ON_SCREEN)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByRole('article', { name: 'Rain' })).toBeInTheDocument()
    // Straight to every team, without asking for the old search on its own on the way.
    expect(queries).toEqual(['q=zzz&type=fire', ''])
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveFocus()
  })

  it('waits in the results after clearing the filters on a touch screen', async () => {
    onTouchScreen()
    serveTeams({ teams: [RAIN] })
    // Added last, so it answers first: nothing matches a search.
    server.use(
      http.get('/api/teams', ({ request }) => {
        if (new URL(request.url).searchParams.has('q')) {
          return HttpResponse.json({ items: [], next_cursor: null })
        }
      }),
    )
    const { user } = await renderTeams('/?q=zzz')

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    // Not the search box, which would open the keyboard over the results.
    expect(screen.getByRole('region', { name: 'Results' })).toHaveFocus()
    expect(await screen.findByRole('article', { name: 'Rain' })).toBeInTheDocument()
  })

  it('says when no team has changed this week', async () => {
    serveTeams()

    await renderTeams('/?view=changed')

    expect(await screen.findByText('No recent changes', ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('tells screen readers about the first teams to load as well', async () => {
    serveTeams({ teams: [RAIN] })
    await renderTeams()

    // There, empty, while the first teams load, so that filling it is read out.
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    await waitFor(() => expect(status).toHaveTextContent('1 team shown'))
  })

  it('tells screen readers how many teams it shows, and when more can load', async () => {
    serveTeams({ teams: [FIRE, RAIN], pageSize: 1 })
    const { user } = await renderTeams()

    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('1 team shown, more to load'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(status).toHaveTextContent('2 teams shown'))
    expect(status).not.toHaveTextContent('more')
  })

  it('tells screen readers what the new filters found once it loads', async () => {
    serveTeams({ teams: [RAIN] })
    // Added last, so they answer first: a search waits for `release`, then finds nothing.
    server.use(
      http.get('/api/teams', ({ request }) => {
        if (new URL(request.url).searchParams.has('q')) {
          return HttpResponse.json({ items: [], next_cursor: null })
        }
      }),
    )
    const search = holdRequests('get', '/api/teams', (request) =>
      new URL(request.url).searchParams.has('q'),
    )
    const { user } = await renderTeams()
    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('1 team shown'))

    await user.type(screen.getByRole('searchbox', { name: /Search teams/ }), 'zzz')

    // Nothing while the last results stand in for the new ones.
    await waitFor(() => expect(status).toBeEmptyDOMElement())
    search.release()
    await waitFor(() => expect(status).toHaveTextContent('No teams match these filters'))
  })

  it('says when there are no teams yet', async () => {
    serveTeams()

    await renderTeams()

    expect(await screen.findByText('No teams yet', ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByText('Teams show here once they have a Pokémon on them.')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('No teams yet')
  })

  it('says when the teams couldn’t load, and tries again', async () => {
    let requests = 0
    server.use(
      http.get('/api/teams', () => {
        requests += 1
        return HttpResponse.json({ detail: 'Refused.' }, { status: 500 })
      }),
    )
    const { user } = await renderTeams()

    expect(await screen.findByText('Couldn’t load teams')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(requests).toBe(2))
  })
})
