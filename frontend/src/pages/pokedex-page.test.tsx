import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { PokedexPage } from '@/pages/pokedex-page'
import { servePokemon, serveSyncStatus } from '@/test/handlers'
import { makePage } from '@/test/pokemon'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'

// Bulbasaur, with a cursor on to a second page with Ivysaur.
function twoPages(query: URLSearchParams) {
  return query.has('cursor')
    ? makePage(['ivysaur'], { after: 1 })
    : makePage(['bulbasaur'], { more: true })
}

describe('PokedexPage', () => {
  // The sync indicator has its own tests; here it only needs an answer.
  beforeEach(() => {
    serveSyncStatus()
  })

  it('shows a card for each Pokémon', async () => {
    servePokemon(makePage(['bulbasaur', 'charizard-mega-x']))

    renderWithProviders(<PokedexPage />)

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Charizard Mega X' })).toBeInTheDocument()
  })

  it('searches by name once you pause typing, and keeps the search in the URL', async () => {
    const requests = servePokemon()
    const { user, router } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('searchbox', { name: 'Search Pokémon' }), 'char')

    // One request for the whole search, none for each letter on the way.
    await waitFor(() => expect(requests).toEqual(['', 'q=char']))
    expect(router.state.location.search).toBe('?q=char')
  })

  it('ignores spaces around the search', async () => {
    const requests = servePokemon()
    const { user } = renderWithProviders(<PokedexPage />)

    await user.type(screen.getByRole('searchbox', { name: 'Search Pokémon' }), '  char ')

    await waitFor(() => expect(requests.at(-1)).toBe('q=char'))
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

    renderWithProviders(<PokedexPage />, { path: '/?q=char&type=fire&forms=default' })

    await waitFor(() => expect(requests).toEqual(['q=char&type=fire&forms=default']))
    expect(screen.getByRole('searchbox', { name: 'Search Pokémon' })).toHaveValue('char')
    expect(screen.getByRole('button', { name: 'Fire' })).toBePressed()
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
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

  it('offers to clear the filters when nothing matches', async () => {
    const requests = servePokemon((query) => makePage(query.has('q') ? [] : ['bulbasaur']))
    const { user, router } = renderWithProviders(<PokedexPage />, { path: '/?q=zzz' })

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    expect(requests.at(-1)).toBe('')
    expect(router.state.location.search).toBe('')
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
})
