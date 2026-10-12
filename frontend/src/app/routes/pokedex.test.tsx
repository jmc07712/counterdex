import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { servePokemon, servePokemonChanges, servePokemonDetails } from '@/test/handlers/pokemon'
import { onTouchScreen } from '@/test/media'
import { CHARIZARD_MEGA_X, makeDetails, makePage, makePokemon } from '@/test/pokemon'
import { ON_SCREEN } from '@/test/queries'
import { renderWithProviders } from '@/test/render'
import { failOnce, holdRequests } from '@/test/server'

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

  it('explains a filter from its info button', async () => {
    servePokemon()
    const { user } = renderWithProviders(<PokedexPage />)

    await user.click(screen.getByRole('button', { name: 'About status' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('Current is what PokéAPI lists now.')
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

    expect(await screen.findByText(message, ON_SCREEN)).toBeInTheDocument()
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
    failOnce('/api/pokemon', 500)
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
      // Mega Charizard X waits, so the switch can be seen mid-way.
      const megaX = holdRequests('get', `/api/pokemon/${CHARIZARD_MEGA_X.id}`)
      const { user } = renderWithProviders(<PokedexPage />, { path: '/?pokemon=6' })
      const dialog = await screen.findByRole('dialog', { name: 'Charizard' })

      await user.click(within(dialog).getByRole('button', { name: /Charizard Mega X/ }))
      await waitFor(() => expect(megaX.arrived()).toBe(1))

      expect(screen.getByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
      megaX.release()
      expect(await screen.findByRole('dialog', { name: 'Charizard Mega X' })).toBeInTheDocument()
    })

    it('close a shared link without leaving the Pokédex', async () => {
      const { user, router } = renderWithProviders(<PokedexPage />, { path: '/?q=char&pokemon=6' })

      await user.click(await screen.findByRole('button', { name: 'Close' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(router.state.location.search).toBe('?q=char')
    })
  })
})
