import { act, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type Pokemon, type Team, TeamConflictReason } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import {
  holdNewTeams,
  holdNextCurrentUser,
  holdTeamChanges,
  holdUserTeams,
  servePokemon,
  servePokemonChanges,
  servePokemonDetails,
  serveSession,
  serveTeams,
} from '@/test/handlers'
import { CHARIZARD_MEGA_X, makeDetails, makePage, makePokemon } from '@/test/pokemon'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH } from '@/test/users'

import { PokedexPage } from './pokedex'

// The grid's requests, leaving out the search suggestions' (which ask for a few).
function gridRequests(requests: string[]) {
  return requests.filter((query) => !query.includes('limit='))
}

// Charmander, Charmeleon and Charizard for suggestions; Bulbasaur for the grid.
function charmanderLine(query: URLSearchParams) {
  return query.has('limit')
    ? makePage(['charmander', 'charmeleon', 'charizard'], { after: 3 })
    : makePage(['bulbasaur'])
}

// Bulbasaur, with a cursor on to a second page with Ivysaur.
function twoPages(query: URLSearchParams) {
  return query.has('cursor')
    ? makePage(['ivysaur'], { after: 1 })
    : makePage(['bulbasaur'], { more: true })
}

// A touch screen, whose pointer is coarse, as a phone's is.
function onTouchScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('PokedexPage', () => {
  it('shows a card for each Pokémon', async () => {
    servePokemon(makePage(['bulbasaur', 'charizard-mega-x']))

    renderWithProviders(<PokedexPage />)

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Charizard Mega X' })).toBeInTheDocument()
  })

  it('offers on a card to add it to a team, as well as to open it', async () => {
    servePokemon(makePage(['bulbasaur']))

    renderWithProviders(<PokedexPage />)

    const card = await screen.findByRole('article', { name: 'Bulbasaur' })
    expect(within(card).getAllByRole('button')).toEqual([
      within(card).getByRole('button', { name: 'Add to team: Bulbasaur' }),
      within(card).getByRole('button', { name: 'Bulbasaur' }),
    ])
  })

  it('offers only to open a Pokémon PokéAPI no longer lists', async () => {
    servePokemon(makePage(['bulbasaur']))

    renderWithProviders(<PokedexPage />, { path: '/?status=removed' })

    const card = await screen.findByRole('article', { name: 'Bulbasaur' })
    expect(within(card).getAllByRole('button')).toEqual([
      within(card).getByRole('button', { name: 'Bulbasaur' }),
    ])
  })

  it('searches by name once you pause typing, and keeps the search in the URL', async () => {
    const requests = servePokemon()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('combobox', { name: 'Search Pokémon' }), 'char')

    // One request for the whole search, none for each letter on the way.
    await waitFor(() => expect(gridRequests(requests)).toEqual(['', 'q=char']))
    expect(router.state.location.search).toBe('?q=char')
  })

  it('suggests a few Pokémon as you type', async () => {
    const requests = servePokemon(charmanderLine)
    const { user } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('combobox', { name: 'Search Pokémon' }), 'char')

    const suggestions = await screen.findAllByRole('option')
    expect(suggestions.map((option) => option.textContent)).toEqual([
      'CharmanderNo. 0004',
      'CharmeleonNo. 0005',
      'CharizardNo. 0006',
    ])
    expect(requests).toContain('q=char&limit=8')
  })

  it('opens the suggestion you choose', async () => {
    servePokemon(charmanderLine)
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('combobox', { name: 'Search Pokémon' }), 'char')
    await user.click(await screen.findByRole('option', { name: /Charizard/ }))

    expect(new URLSearchParams(router.state.location.search).get('pokemon')).toBe('6')
  })

  it('opens the highlighted suggestion with Enter', async () => {
    servePokemon(charmanderLine)
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('combobox', { name: 'Search Pokémon' }), 'char')
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(new URLSearchParams(router.state.location.search).get('pokemon')).toBe('4')
  })

  it('closes the suggestions with Escape, keeping the search', async () => {
    servePokemon(charmanderLine)
    const { user } = renderWithProviders(<PokedexPage />)
    const search = screen.getByRole('combobox', { name: 'Search Pokémon' })

    await user.type(search, 'char')
    await screen.findAllByRole('option')
    await user.keyboard('{Escape}')

    expect(screen.queryAllByRole('option')).toEqual([])
    expect(search).toHaveValue('char')
  })

  it('ignores spaces around the search', async () => {
    const requests = servePokemon()
    const { user } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('combobox', { name: 'Search Pokémon' }), '  char ')

    await waitFor(() => expect(gridRequests(requests).at(-1)).toBe('q=char'))
  })

  it.each([
    ['About forms', 'Standard is each species’ usual form.'],
    ['About status', 'Current is what PokéAPI lists now.'],
    ['About types', 'Up to 2 types at a time.'],
  ])('explains a filter from its info button: %s', async (button, explanation) => {
    servePokemon()
    const { user } = renderWithProviders(<PokedexPage />)

    await user.click(screen.getByRole('button', { name: button }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(explanation)
  })

  it('filters by up to two types, dropping the oldest for a third', async () => {
    const requests = servePokemon()
    const { user, router } = renderWithProviders(<PokedexPage />)
    const types = screen.getByRole('toolbar', { name: 'Types' })

    for (const type of ['Fire', 'Flying', 'Water']) {
      await user.click(within(types).getByRole('button', { name: type }))
    }

    await waitFor(() => expect(requests.at(-1)).toBe('type=flying&type=water'))
    expect(within(types).getByRole('button', { name: 'Fire' })).not.toBePressed()
    expect(router.state.location.search).toBe('?type=flying&type=water')
  })

  it.each([
    ['Standard', 'default'],
    ['Alternate', 'alternate'],
  ])('can list only %s forms', async (option, forms) => {
    const requests = servePokemon()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.click(screen.getByRole('radio', { name: option }))

    await waitFor(() => expect(requests.at(-1)).toBe(`forms=${forms}`))
    expect(router.state.location.search).toBe(`?forms=${forms}`)
  })

  it('always keeps one forms option chosen', async () => {
    servePokemon()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.click(screen.getByRole('radio', { name: 'All' }))

    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(router.state.location.search).toBe('')
  })

  it('starts from the filters in the URL', async () => {
    const requests = servePokemon()

    const filters = 'q=char&type=fire&forms=default&status=removed'

    renderWithProviders(<PokedexPage />, { path: `/?${filters}` })

    await waitFor(() => expect(requests).toEqual([filters]))
    expect(screen.getByRole('combobox', { name: 'Search Pokémon' })).toHaveValue('char')
    expect(screen.getByRole('button', { name: 'Fire' })).toBePressed()
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Removed' })).toBeChecked()
  })

  it('can list the Pokémon PokéAPI no longer lists, marked as removed', async () => {
    const requests = servePokemon()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.click(screen.getByRole('radio', { name: 'Removed' }))

    await waitFor(() => expect(requests.at(-1)).toBe('status=removed'))
    expect(router.state.location.search).toBe('?status=removed')
    const card = await screen.findByRole('article', { name: 'Bulbasaur' })
    expect(within(card).getByText('Removed')).toBeInTheDocument()
  })

  it('can list the Pokémon syncs changed recently, marked as changed', async () => {
    const bulbasaur = makePokemon({ id: 1, name: 'bulbasaur', changed_recently: true })
    const requests = servePokemon({ items: [bulbasaur], next_cursor: null })
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.click(screen.getByRole('radio', { name: 'Changed' }))

    await waitFor(() => expect(requests.at(-1)).toBe('changed=true'))
    expect(router.state.location.search).toBe('?status=changed')
    const card = await screen.findByRole('article', { name: 'Bulbasaur' })
    expect(within(card).getByText('Changed recently')).toBeInTheDocument()
  })

  it.each([
    ['removed', 'No removed Pokémon'],
    ['changed', 'No recent changes'],
  ])('says when there are no %s Pokémon', async (status, message) => {
    servePokemon(makePage([]))

    renderWithProviders(<PokedexPage />, { path: `/?status=${status}` })

    // The one on screen, not the results status, which reads it out too.
    expect(await screen.findByText(message, { ignore: '[role=status]' })).toBeInTheDocument()
  })

  it('keeps a search within the 50 characters the API takes', async () => {
    const requests = servePokemon()

    renderWithProviders(<PokedexPage />, { path: `/?q=${'a'.repeat(60)}` })

    await waitFor(() => expect(requests).toEqual([`q=${'a'.repeat(50)}`]))
    expect(screen.getByRole('combobox', { name: 'Search Pokémon' })).toHaveAttribute(
      'maxlength',
      '50',
    )
  })

  it('keeps only the last two types from a hand-edited URL', async () => {
    const requests = servePokemon()

    renderWithProviders(<PokedexPage />, { path: '/?type=fire&type=water&type=grass' })

    await waitFor(() => expect(requests).toEqual(['type=water&type=grass']))
  })

  it('loads more Pokémon when asked', async () => {
    const requests = servePokemon(twoPages)
    const { user } = renderWithProviders(<PokedexPage />)

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('article', { name: 'Ivysaur' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    expect(requests).toEqual(['', 'cursor=1'])
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('loads more Pokémon as the end of the list scrolls into view', async () => {
    servePokemon(twoPages)
    renderWithProviders(<PokedexPage />)
    await screen.findByRole('article', { name: 'Bulbasaur' })

    mockAllIsIntersecting(true)

    expect(await screen.findByRole('article', { name: 'Ivysaur' })).toBeInTheDocument()
  })

  it('tells screen readers about the first Pokémon to load as well', async () => {
    servePokemon(makePage(['bulbasaur']))
    renderWithProviders(<PokedexPage />)

    // There, empty, while the first Pokémon load, so that filling it is read out.
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    await waitFor(() => expect(status).toHaveTextContent('1 Pokémon shown'))
  })

  it('tells screen readers how many Pokémon it shows, and when more can load', async () => {
    servePokemon(twoPages)
    const { user } = renderWithProviders(<PokedexPage />)

    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('1 Pokémon shown, more to load'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(status).toHaveTextContent('2 Pokémon shown'))
    expect(status).not.toHaveTextContent('more')
  })

  it('tells screen readers when nothing matches', async () => {
    servePokemon(makePage([]))

    renderWithProviders(<PokedexPage />, { path: '/?status=removed' })

    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('No removed Pokémon'))
  })

  it('offers to clear the filters when nothing matches, then waits in the search', async () => {
    const requests = servePokemon((query) => makePage(query.has('q') ? [] : ['bulbasaur']))
    const { user, router } = renderWithProviders(<PokedexPage />, { path: '/?q=zzz&type=fire' })

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    // Straight to every Pokémon, without asking for the old search on its own on the way.
    expect(gridRequests(requests)).toEqual(['q=zzz&type=fire', ''])
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('combobox', { name: 'Search Pokémon' })).toHaveFocus()
  })

  it('waits in the results after clearing the filters on a touch screen', async () => {
    onTouchScreen()
    servePokemon((query) => makePage(query.has('q') ? [] : ['bulbasaur']))
    const { user } = renderWithProviders(<PokedexPage />, { path: '/?q=zzz' })

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    // Not the search box, which would open the keyboard over the results.
    expect(screen.getByRole('region', { name: 'Results' })).toHaveFocus()
    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
  })

  it('offers a retry when the Pokédex can’t load', async () => {
    servePokemon()
    // Added last, so it answers first: the first request fails, and the retry gets the page.
    server.use(
      http.get('/api/pokemon', () => new HttpResponse(null, { status: 500 }), { once: true }),
    )
    const { user } = renderWithProviders(<PokedexPage />)

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
  })

  describe('Pokémon details', () => {
    beforeEach(() => {
      servePokemon(makePage(['charizard']))
      servePokemonDetails()
      servePokemonChanges()
    })

    it('open from a Pokémon’s card, and go in the URL', async () => {
      const { user, router } = renderWithProviders(<PokedexPage />)

      await user.click(await screen.findByRole('button', { name: 'Charizard' }))

      expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
      expect(router.state.location.search).toBe('?pokemon=1')
    })

    it('open from a shared link', async () => {
      renderWithProviders(<PokedexPage />, { path: '/?pokemon=6' })

      expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    })

    it('close with Back after opening from a card', async () => {
      const { user, router } = renderWithProviders(<PokedexPage />)
      await user.click(await screen.findByRole('button', { name: 'Charizard' }))
      await screen.findByRole('dialog', { name: 'Charizard' })

      await act(() => router.navigate(-1))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(router.state.location.search).toBe('')
    })

    it('keep showing the open Pokémon while the next one loads, instead of flashing', async () => {
      servePokemonDetails((id) =>
        makeDetails(id === CHARIZARD_MEGA_X.id ? { pokemon: CHARIZARD_MEGA_X } : {}),
      )
      // Mega Charizard X answers slowly, so the switch can be seen mid-way.
      server.use(
        http.get(`/api/pokemon/${CHARIZARD_MEGA_X.id}`, async () => {
          await delay(100)
          return HttpResponse.json(makeDetails({ pokemon: CHARIZARD_MEGA_X }))
        }),
      )
      const { user } = renderWithProviders(<PokedexPage />, { path: '/?pokemon=6' })
      const dialog = await screen.findByRole('dialog', { name: 'Charizard' })

      await user.click(within(dialog).getByRole('button', { name: /Charizard Mega X/ }))

      expect(screen.getByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
      expect(await screen.findByRole('dialog', { name: 'Charizard Mega X' })).toBeInTheDocument()
    })

    it('close a shared link without leaving the Pokédex', async () => {
      const { user, router } = renderWithProviders(<PokedexPage />, { path: '/?q=char&pokemon=6' })

      await user.click(await screen.findByRole('button', { name: 'Close' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(router.state.location.search).toBe('?q=char')
    })
  })

  describe('adding a Pokémon to a team', () => {
    const { charmander, charizard, pikachu, gengar, lapras, eevee, snorlax, dragonite } = catalog

    function renderPokedex(path = '/pokedex') {
      return renderWithProviders(
        <>
          <PokedexPage />
          <Toaster />
        </>,
        { path },
      )
    }

    // Ash, signed in, with these teams.
    function serveAsh(teams: Team[] = []) {
      serveSession({ signedIn: ASH })
      return serveTeams({ teams, catalog: Object.values(catalog), signedIn: ASH })
    }

    // The Pokédex lists these, on one page.
    function browse(pokemon: Pokemon[]) {
      return servePokemon({ items: pokemon, next_cursor: null })
    }

    it('lists your teams, each with how many Pokémon it has, without opening the card', async () => {
      serveAsh([
        makeTeam({ name: 'Rain Squad', pokemon: [lapras, gengar, eevee] }),
        makeTeam({ id: crypto.randomUUID(), name: 'Fire' }),
      ])
      browse([pikachu])
      const { user, router } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))

      const menu = await screen.findByRole('menu', { name: 'Add to team: Pikachu' })
      const items = await within(menu).findAllByRole('menuitem')
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveAccessibleName('Rain Squad 3 of 6')
      expect(items[1]).toHaveAccessibleName('Fire 0 of 6')
      expect(items[2]).toHaveAccessibleName('New team')
      expect(router.state.location.search).toBe('')
    })

    it('adds the Pokémon to the team you choose, and says so with a way to the team', async () => {
      const api = serveAsh([makeTeam({ name: 'Rain Squad', pokemon: [lapras] })])
      browse([charizard])
      const { user, router } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Charizard' }))
      await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))

      await waitFor(() =>
        expect(api.requests).toEqual([
          {
            method: 'POST',
            path: `/api/teams/${TEAM_ID}/members`,
            body: { pokemon_id: charizard.id },
          },
        ]),
      )
      const toast = (await screen.findByText('Added Charizard to Rain Squad')).closest('li')!
      await user.click(within(toast).getByRole('button', { name: 'Show team' }))
      expect(router.state.location.pathname).toBe(`/teams/${TEAM_ID}`)
    })

    it('shows the Pokémon on the team at once, before the API has answered', async () => {
      serveAsh([makeTeam({ name: 'Rain Squad', pokemon: [lapras] })])
      const held = holdTeamChanges()
      browse([pikachu])
      const { user } = renderPokedex()
      const button = await screen.findByRole('button', { name: 'Add to team: Pikachu' })

      await user.click(button)
      await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))
      await waitFor(() => expect(held.arrived()).toBe(1))
      await user.click(button)

      const team = await screen.findByRole('menuitem', { name: 'Rain Squad 2 of 6 On the team' })
      expect(team).toHaveAttribute('aria-disabled', 'true')
      held.release()
      expect(await screen.findByText('Added Pikachu to Rain Squad')).toBeInTheDocument()
    })

    it('says why when the API refuses the add', async () => {
      serveAsh([makeTeam({ name: 'Rain Squad', pokemon: [lapras] })])
      // Added last, so it answers first: the team filled up somewhere else.
      server.use(
        http.post('/api/teams/:teamId/members', () =>
          HttpResponse.json(
            { detail: 'Refused.', reason: TeamConflictReason.TEAM_FULL },
            { status: 409 },
          ),
        ),
      )
      browse([pikachu])
      const { user } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
      await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))

      expect(await screen.findByText('That team is full.')).toBeInTheDocument()
      expect(screen.queryByText('Added Pikachu to Rain Squad')).not.toBeInTheDocument()
    })

    it('says which teams can’t take it, and why', async () => {
      serveAsh([
        makeTeam({
          id: crypto.randomUUID(),
          name: 'Full',
          pokemon: [pikachu, gengar, lapras, eevee, snorlax, dragonite],
        }),
        makeTeam({ id: crypto.randomUUID(), name: 'Has Charmander', pokemon: [charmander] }),
        makeTeam({ id: crypto.randomUUID(), name: 'Has Charizard', pokemon: [charizard] }),
      ])
      browse([charizard])
      const { user } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Charizard' }))

      const full = await screen.findByRole('menuitem', { name: 'Full 6 of 6 Team is full' })
      expect(full).toHaveAttribute('aria-disabled', 'true')
      const family = screen.getByRole('menuitem', {
        name: 'Has Charmander 1 of 6 Charmander’s family is on the team',
      })
      expect(family).toHaveAttribute('aria-disabled', 'true')
      const onIt = screen.getByRole('menuitem', { name: 'Has Charizard 1 of 6 On the team' })
      expect(onIt).toHaveAttribute('aria-disabled', 'true')
    })

    it('lets a team that can’t take it be reached, to read why, but adds nothing', async () => {
      const api = serveAsh([makeTeam({ name: 'Has Charizard', pokemon: [charizard] })])
      browse([charizard])
      const { user } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Charizard' }))
      const team = await screen.findByRole('menuitem', { name: /^Has Charizard/ })
      await user.keyboard('{ArrowDown}')
      expect(team).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(api.requests).toEqual([])
    })

    it('starts a new team with the Pokémon, and opens it to edit', async () => {
      const api = serveAsh([makeTeam({ name: 'Team 1', pokemon: [lapras] })])
      browse([pikachu])
      const { user, router } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
      await user.click(await screen.findByRole('menuitem', { name: 'New team' }))

      await waitFor(() => expect(router.state.location.pathname).toMatch(/\/edit$/))
      const [created] = api.requests
      expect(api.requests).toEqual([
        { method: 'PUT', path: created.path, body: { name: 'Team 2', pokemon_ids: [pikachu.id] } },
      ])
      expect(router.state.location.pathname).toBe(`${created.path.replace('/api', '')}/edit`)
    })

    it('stays open while it creates the new team, with New team disabled', async () => {
      serveAsh()
      const held = holdNewTeams()
      browse([pikachu])
      const { user, router } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
      await user.click(await screen.findByRole('menuitem', { name: 'New team' }))

      const creating = await screen.findByRole('menuitem', { name: 'Creating…' })
      expect(creating).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByRole('menu', { name: 'Add to team: Pikachu' })).toBeInTheDocument()
      held.release()
      await waitFor(() => expect(router.state.location.pathname).toMatch(/\/edit$/))
    })

    it('links someone signed out to signing in first, then back to the Pokédex', async () => {
      serveSession()
      browse([pikachu])
      const { user } = renderPokedex('/pokedex?q=pika')

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))

      const signIn = await screen.findByRole('menuitem', { name: 'Sign in' })
      expect(signIn).toHaveAttribute(
        'href',
        `/sign-in?next=${encodeURIComponent('/pokedex?q=pika')}`,
      )
      expect(signIn).toHaveAccessibleDescription(
        'Teams are saved to your account, so you’ll need to sign in.',
      )
    })

    it('says it’s loading your teams while it checks who’s signed in', async () => {
      serveAsh([makeTeam({ name: 'Rain Squad' })])
      const release = holdNextCurrentUser(ASH)
      browse([pikachu])
      const { user } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))

      const loading = await screen.findByRole('menuitem', { name: 'Loading your teams…' })
      expect(loading).toHaveAttribute('aria-disabled', 'true')
      release()
      expect(await screen.findByRole('menuitem', { name: /^Rain Squad/ })).toBeInTheDocument()
    })

    it('says it’s loading your teams until they arrive', async () => {
      serveAsh([makeTeam({ name: 'Rain Squad' })])
      const held = holdUserTeams()
      browse([pikachu])
      const { user } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
      // Asked for only once it's known who's signed in.
      await waitFor(() => expect(held.arrived()).toBe(1))

      const loading = screen.getByRole('menuitem', { name: 'Loading your teams…' })
      expect(loading).toHaveAttribute('aria-disabled', 'true')
      held.release()
      expect(await screen.findByRole('menuitem', { name: /^Rain Squad/ })).toBeInTheDocument()
    })

    it('offers to try again when your teams can’t load', async () => {
      serveAsh([makeTeam({ name: 'Rain Squad' })])
      // Added last, so it answers first: the first request fails, and the retry gets the teams.
      server.use(
        http.get('/api/users/:username/teams', () => new HttpResponse(null, { status: 500 }), {
          once: true,
        }),
      )
      browse([pikachu])
      const { user } = renderPokedex()

      await user.click(await screen.findByRole('button', { name: 'Add to team: Pikachu' }))
      const retry = await screen.findByRole('menuitem', { name: 'Try again' })
      expect(retry).toHaveAccessibleDescription('Couldn’t load your teams')
      await user.click(retry)

      expect(await screen.findByRole('menuitem', { name: /^Rain Squad/ })).toBeInTheDocument()
    })

    it('adds from a Pokémon’s details too', async () => {
      const api = serveAsh([makeTeam({ name: 'Rain Squad' })])
      browse([charizard])
      servePokemonDetails()
      servePokemonChanges()
      const { user } = renderPokedex(`/pokedex?pokemon=${charizard.id}`)

      const dialog = await screen.findByRole('dialog', { name: 'Charizard' })
      await user.click(within(dialog).getByRole('button', { name: 'Add to team: Charizard' }))
      await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))

      await waitFor(() =>
        expect(api.teams()[0].members.map((member) => member.pokemon.id)).toEqual([charizard.id]),
      )
      expect(screen.getByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    })

    it('puts focus back on its button once the menu closes', async () => {
      serveAsh([makeTeam({ name: 'Rain Squad' })])
      browse([pikachu])
      const { user } = renderPokedex()
      const button = await screen.findByRole('button', { name: 'Add to team: Pikachu' })

      await user.click(button)
      await screen.findByRole('menuitem', { name: /^Rain Squad/ })
      await user.keyboard('{Escape}')
      expect(button).toHaveFocus()

      await user.click(button)
      await user.click(await screen.findByRole('menuitem', { name: /^Rain Squad/ }))
      await waitFor(() => expect(button).toHaveFocus())
    })
  })
})
