import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { holdNextCurrentUser, serveSession, serveTeams } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { asMember, catalog, makeTeam } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamsPage } from './teams'

// The results status reads an empty state's title out too; text queries skip it to find the one
// on screen.
const ON_SCREEN = { ignore: '[role=status]' }

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

  it('asks you to sign in or sign up to build teams, then come back', async () => {
    serveTeams()

    await renderTeams()

    expect(screen.getByText('Sign in to build teams')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2F',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up?next=%2F',
    )
  })

  it('lists everyone’s teams, with no choice of whose', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })

    await renderTeams()

    expect(await screen.findByRole('list', { name: 'Everyone’s teams' })).toBeInTheDocument()
    expect(listQueries).toEqual([''])
    expect(screen.queryByRole('radio', { name: 'My teams' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New team' })).not.toBeInTheDocument()
  })
})

describe('TeamsPage, before it knows who’s signed in', () => {
  it('shows no teams, so it never shows the wrong ones', async () => {
    serveSession({ signedIn: ASH })
    // Added last, so it answers the first check.
    const release = holdNextCurrentUser(ASH)
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })

    renderWithProviders(<TeamsPage />)

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

  it('lists your teams, empty ones too, without saying whose they are', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })

    await renderTeams()

    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'My teams' })).toBeChecked()
    const list = await screen.findByRole('list', { name: 'My teams' })
    const cards = within(list).getAllByRole('link')
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      `/teams/${FIRE.id}`,
      `/teams/${DRAFT.id}`,
    ])
    expect(within(cards[0]).getByText('1 of 6')).toBeInTheDocument()
    expect(within(cards[1]).getByText('0 of 6')).toBeInTheDocument()
    expect(list).not.toHaveTextContent('by ash')
    expect(listQueries).toEqual(['owner=ash'])
  })

  it('switches to everyone’s teams, keeping the choice in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN, DRAFT] })
    const { user, router } = await renderTeams()
    await screen.findByRole('list', { name: 'My teams' })

    await user.click(screen.getByRole('radio', { name: 'Everyone' }))

    const list = await screen.findByRole('list', { name: 'Everyone’s teams' })
    expect(within(list).getAllByRole('link').map((card) => card.textContent)).toEqual([
      expect.stringContaining('by misty'),
      expect.stringContaining('by ash'),
    ])
    expect(listQueries).toEqual(['owner=ash', ''])
    expect(router.state.location.search).toBe('?scope=everyone')

    await user.click(screen.getByRole('radio', { name: 'My teams' }))

    expect(await screen.findByRole('list', { name: 'My teams' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('starts from everyone’s teams in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE, RAIN] })

    await renderTeams('/?scope=everyone')

    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked()
    await waitFor(() => expect(listQueries).toEqual(['']))
  })

  it('filters your teams as it does everyone’s', async () => {
    const { listQueries } = serveTeams({ teams: [FIRE] })
    const { user } = await renderTeams('/?q=fire')
    const types = screen.getByRole('toolbar', { name: 'Types' })

    await user.click(within(types).getByRole('button', { name: 'Fire' }))
    await user.click(screen.getByRole('radio', { name: 'Changed this week' }))

    await waitFor(() => expect(listQueries.at(-1)).toBe('q=fire&type=fire&changed=true&owner=ash'))
  })

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

    const card = await screen.findByRole('link', { name: /Team 1/ })
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
    const { user, router } = await renderTeams()

    expect(await screen.findByText('No teams yet', ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByText('Pick up to six Pokémon and put them in battle order.')).toBeVisible()
    // Only the empty state's New team, not the header's as well.
    expect(screen.getAllByRole('button', { name: 'New team' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Browse everyone’s teams' }))

    expect(await screen.findByRole('link', { name: /Rain/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked()
    expect(router.state.location.search).toBe('?scope=everyone')
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
    const { user, router } = await renderTeams()
    await screen.findByRole('list', { name: 'My teams' })

    await user.click(await screen.findByRole('button', { name: 'New team' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}\/edit$/),
    )
    expect(api.teams().map((team) => team.name)).toEqual(['Team 2', 'Fire'])
  })

  it('offers New team while showing everyone’s teams too', async () => {
    serveTeams({ teams: [RAIN] })

    await renderTeams('/?scope=everyone')

    expect(await screen.findByRole('button', { name: 'New team' })).toBeInTheDocument()
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
      screen.getByText(/Anyone can see your teams, but only you can change them/),
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
    const { user } = await renderTeams()

    await screen.findByRole('link', { name: /Rain/ })
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('link', { name: /Fire/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rain/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('loads more teams as the end of the list scrolls into view', async () => {
    serveTeams({ teams: [FIRE, RAIN], pageSize: 1 })
    await renderTeams()
    await screen.findByRole('link', { name: /Rain/ })

    mockAllIsIntersecting(true)

    expect(await screen.findByRole('link', { name: /Fire/ })).toBeInTheDocument()
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

  it('always keeps one view chosen', async () => {
    serveTeams({ teams: [RAIN] })
    const { user, router } = await renderTeams()

    await user.click(screen.getByRole('radio', { name: 'All' }))

    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(router.state.location.search).toBe('')
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
    ['About views', 'Changed this week is the teams with a Pokémon a sync changed'],
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

    expect(await screen.findByRole('link', { name: /Rain/ })).toBeInTheDocument()
    // Straight to every team, without asking for the old search on its own on the way.
    expect(queries).toEqual(['q=zzz&type=fire', ''])
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveFocus()
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
    const { user } = await renderTeams()
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

    await renderTeams()

    expect(await screen.findByText('No teams yet', ON_SCREEN)).toBeInTheDocument()
    expect(screen.getByText('Teams show here once they have a Pokémon on them.')).toBeVisible()
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
