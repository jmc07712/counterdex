import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { serveSession } from '@/test/handlers/session'
import { serveTeams } from '@/test/handlers/teams'
import { onTouchScreen } from '@/test/media'
import { ON_SCREEN } from '@/test/queries'
import { holdRequests, server } from '@/test/server'
import { makeTeam } from '@/test/teams'
import { FIRE, RAIN, renderTeams } from '@/test/teams-page'

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

  it('says teams are public', async () => {
    serveTeams()

    await renderTeams()

    expect(
      screen.getByText(/Teams are public: anyone can see them, but only their owner can change one/),
    ).toBeInTheDocument()
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

  it.each([
    ['with no sort in the URL', '/'],
    ['when the URL names the newest, which is the default', '/?sort=newest'],
    ['for a sort it doesn’t know', '/?sort=weakest'],
  ])('lists the newest teams, asking for no sort, %s', async (_, path) => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams(path)

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
        .map((card) => within(card).getByRole('heading').textContent)
    await waitFor(() => expect(names()).toEqual(['Rain', 'Fire']))

    await user.click(screen.getByRole('radio', { name: 'Most powerful' }))

    await waitFor(() => expect(names()).toEqual(['Fire', 'Rain']))
  })

  it('starts from the filters and sort in the URL', async () => {
    const { listQueries } = serveTeams({ teams: [RAIN] })

    await renderTeams('/?q=rain&type=water&type=fire&view=changed&sort=power')

    await waitFor(() =>
      expect(listQueries).toEqual(['q=rain&type=water&type=fire&changed=true&sort=power']),
    )
    expect(screen.getByRole('searchbox', { name: /Search teams/ })).toHaveValue('rain')
    expect(screen.getByRole('button', { name: 'Water' })).toBePressed()
    expect(screen.getByRole('button', { name: 'Fire' })).toBePressed()
    expect(screen.getByRole('radio', { name: 'Changed this week' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Most powerful' })).toBeChecked()
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

  it('explains a filter from its info button', async () => {
    serveTeams({ teams: [RAIN] })
    const { user } = await renderTeams()

    await user.click(screen.getByRole('button', { name: 'About what’s shown' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Changed this week is the teams with a Pokémon a sync changed',
    )
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
