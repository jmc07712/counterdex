import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { beforeEach, describe, expect, it } from 'vitest'

import type { PokemonPage } from '@/api'
import { PokedexPage } from '@/pages/pokedex-page'
import { makePage } from '@/test/pokemon'
import { server } from '@/test/server'

function renderPokedex(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/', element: <PokedexPage /> }], {
    initialEntries: [path],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// Answers every Pokédex request with `respond`, and records each request's query string.
function servePokedex(respond: (query: URLSearchParams) => PokemonPage) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('/api/pokemon', ({ request }) => {
      const query = new URL(request.url).searchParams
      requests.push(query)
      return HttpResponse.json(respond(query))
    }),
  )
  return requests
}

const lastRequest = (requests: URLSearchParams[]) => requests.at(-1)?.toString()

describe('PokedexPage', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/sync/status', () =>
        HttpResponse.json({ last_synced_at: null, latest_run: null }),
      ),
    )
  })

  it('shows a card for each Pokémon', async () => {
    servePokedex(() => makePage(['bulbasaur', 'charizard-mega-x']))

    renderPokedex()

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Charizard Mega X' })).toBeInTheDocument()
  })

  it('searches by name once you pause typing, and keeps the search in the URL', async () => {
    const requests = servePokedex(() => makePage(['charmander']))
    const router = renderPokedex()

    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search Pokémon' }), 'char')

    await waitFor(() => expect(lastRequest(requests)).toBe('q=char'))
    expect(requests.map((query) => query.get('q'))).not.toContain('cha')
    expect(router.state.location.search).toBe('?q=char')
  })

  it('filters by up to two types, dropping the oldest for a third', async () => {
    const requests = servePokedex(() => makePage(['moltres']))
    const router = renderPokedex()
    const user = userEvent.setup()
    const types = screen.getByRole('toolbar', { name: 'Types' })

    for (const type of ['Fire', 'Flying', 'Water']) {
      await user.click(within(types).getByRole('button', { name: type }))
    }

    await waitFor(() => expect(lastRequest(requests)).toBe('type=flying&type=water'))
    expect(within(types).getByRole('button', { name: 'Fire' })).toHaveAttribute('aria-pressed', 'false')
    expect(router.state.location.search).toBe('?type=flying&type=water')
  })

  it('can list only standard forms', async () => {
    const requests = servePokedex(() => makePage(['charizard']))
    renderPokedex()

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Standard' }))

    await waitFor(() => expect(lastRequest(requests)).toBe('forms=default'))
  })

  it('can list only alternate forms', async () => {
    const requests = servePokedex(() => makePage(['charizard-mega-x']))
    const router = renderPokedex()

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Alternate' }))

    await waitFor(() => expect(lastRequest(requests)).toBe('forms=alternate'))
    expect(router.state.location.search).toBe('?forms=alternate')
  })

  it('always keeps one forms option chosen', async () => {
    servePokedex(() => makePage(['charizard']))
    renderPokedex()

    await userEvent.setup().click(screen.getByRole('radio', { name: 'All' }))

    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  })

  it('starts from the filters in the URL', async () => {
    const requests = servePokedex(() => makePage(['charizard']))

    renderPokedex('/?q=char&type=fire&forms=default')

    await waitFor(() => expect(lastRequest(requests)).toBe('q=char&type=fire&forms=default'))
    expect(screen.getByRole('searchbox', { name: 'Search Pokémon' })).toHaveValue('char')
    expect(screen.getByRole('button', { name: 'Fire' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
  })

  it('keeps only the last two types from a hand-edited URL', async () => {
    const requests = servePokedex(() => makePage(['vileplume']))

    renderPokedex('/?type=fire&type=water&type=grass')

    await waitFor(() => expect(lastRequest(requests)).toBe('type=water&type=grass'))
  })

  it('loads more Pokémon when asked', async () => {
    const requests = servePokedex((query) =>
      query.has('cursor') ? makePage(['ivysaur']) : makePage(['bulbasaur'], 1),
    )
    renderPokedex()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('article', { name: 'Ivysaur' })).toBeInTheDocument()
    expect(lastRequest(requests)).toBe('cursor=1')
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('loads more Pokémon as the end of the list scrolls into view', async () => {
    servePokedex((query) =>
      query.has('cursor') ? makePage(['ivysaur']) : makePage(['bulbasaur'], 1),
    )
    renderPokedex()
    await screen.findByRole('article', { name: 'Bulbasaur' })

    mockAllIsIntersecting(true)

    expect(await screen.findByRole('article', { name: 'Ivysaur' })).toBeInTheDocument()
  })

  it('offers to clear the filters when nothing matches', async () => {
    const requests = servePokedex((query) =>
      query.has('q') ? makePage([]) : makePage(['bulbasaur']),
    )
    const router = renderPokedex('/?q=zzz')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
    expect(lastRequest(requests)).toBe('')
    expect(router.state.location.search).toBe('')
  })

  it('offers a retry when the Pokédex can’t load', async () => {
    let failing = true
    server.use(
      http.get('/api/pokemon', () =>
        failing ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(makePage(['bulbasaur'])),
      ),
    )
    renderPokedex()
    const retry = await screen.findByRole('button', { name: 'Try again' })

    failing = false
    await userEvent.setup().click(retry)

    expect(await screen.findByRole('article', { name: 'Bulbasaur' })).toBeInTheDocument()
  })
})
