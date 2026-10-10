import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { type PokedexFilters, usePokemonList } from '@/features/pokedex/use-pokemon-list'
import { makePage } from '@/test/pokemon'
import { server } from '@/test/server'

const NO_FILTERS: PokedexFilters = { search: '', types: [], includeForms: true }

function renderPokemonList(filters: PokedexFilters = NO_FILTERS) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => usePokemonList(filters), { wrapper })
}

// Records each request's query string and answers with the given pages in order.
function servePages(...pages: ReturnType<typeof makePage>[]) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('/api/pokemon', ({ request }) => {
      requests.push(new URL(request.url).searchParams)
      return HttpResponse.json(pages[requests.length - 1])
    }),
  )
  return requests
}

describe('usePokemonList', () => {
  it('loads the first page without a cursor or filters', async () => {
    const requests = servePages(makePage(['bulbasaur', 'ivysaur']))

    const { result } = renderPokemonList()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0].items.map((p) => p.name)).toEqual(['bulbasaur', 'ivysaur'])
    expect(requests[0].toString()).toBe('')
  })

  it('loads the next page from the previous page’s cursor', async () => {
    const requests = servePages(makePage(['bulbasaur'], 1), makePage(['ivysaur']))

    const { result } = renderPokemonList()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(requests[1].get('cursor')).toBe('1')
    expect(result.current.hasNextPage).toBe(false)
  })

  it('sends only the filters in use, as the API expects them', async () => {
    const requests = servePages(makePage(['charizard']))

    const { result } = renderPokemonList({
      search: '  char ',
      types: ['fire', 'flying'],
      includeForms: false,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(requests[0].toString()).toBe('q=char&type=fire&type=flying&forms=false')
  })

  it('reports a failed request as an error', async () => {
    server.use(http.get('/api/pokemon', () => new HttpResponse(null, { status: 500 })))

    const { result } = renderPokemonList()

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
